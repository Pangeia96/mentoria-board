// Servidor de tempo real do mentoria-board (Hocuspocus + Yjs).
// Documento por quadro: "board:<boardId>".
// Auth: o Next.js assina um token curto (HS256, REALTIME_SECRET) com {sub, kind, name, color, board, role};
// aqui o papel é reconferido no banco ao conectar, a cada RECHECK_MS e quando o app chama POST /kick.
import { Server } from "@hocuspocus/server";
import { jwtVerify } from "jose";
import { timingSafeEqual } from "node:crypto";
import * as Y from "yjs";
import { createStorage } from "./storage.mjs";

const PORT = Number(process.env.PORT ?? 1234);
const RAW_SECRET = process.env.REALTIME_SECRET ?? "dev-only-secret-change-me-0123456789";
const SECRET = new TextEncoder().encode(RAW_SECRET);
const RECHECK_MS = Number(process.env.RECHECK_MS ?? 30_000);
const storage = createStorage();
const boardIdOf = (documentName) => documentName.replace(/^board:/, "");
const canWrite = (role) => role === "owner" || role === "editor";

/** Reconfere todas as conexões de um quadro: expulsa quem perdeu acesso, ajusta só-leitura. */
async function recheck(documentName) {
  const doc = server.hocuspocus.documents.get(documentName);
  if (!doc) return { checked: 0, closed: 0 };
  let closed = 0;
  const conns = doc.getConnections();
  await Promise.all(conns.map(async (conn) => {
    const auth = conn.context?.auth;
    if (!auth) return;
    let role = null;
    try {
      role = await storage.currentRole(auth);
    } catch (e) {
      console.error(`[rt] recheck falhou: ${e.message}`); // falha de banco não expulsa ninguém
      return;
    }
    if (!role) {
      closed++;
      conn.close({ code: 4403, reason: "acesso removido" });
    } else {
      conn.readOnly = !canWrite(role);
      conn.context.user.role = role;
    }
  }));
  return { checked: conns.length, closed };
}

const server = new Server({
  port: PORT,
  quiet: true,
  debounce: 2000,
  maxDebounce: 10000,

  async onAuthenticate({ token, documentName, connectionConfig }) {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] }));
    } catch {
      throw new Error("token inválido");
    }
    if (`board:${payload.board}` !== documentName) throw new Error("token de outro quadro");
    const role = await storage.currentRole(payload);
    if (!role) throw new Error("sem acesso");
    // Só editor/owner escrevem. Commenter e viewer recebem as mudanças mas não conseguem enviar.
    connectionConfig.readOnly = !canWrite(role);
    const auth = { kind: payload.kind, sub: payload.sub, board: payload.board };
    return { auth, user: { id: payload.sub, kind: payload.kind, name: payload.name, role } };
  },

  async onLoadDocument({ document, documentName }) {
    const update = await storage.load(boardIdOf(documentName));
    if (update) Y.applyUpdate(document, update);
    return document;
  },

  async onStoreDocument({ document, documentName }) {
    await storage.store(boardIdOf(documentName), Y.encodeStateAsUpdate(document));
  },

  /**
   * Chamadas do app (com "Authorization: Bearer <REALTIME_SECRET>"):
   *   POST /kick?board=<id>               mudou acesso: reconfere quem está no quadro agora
   *   POST /notify?board=<id>&what=<tipo> avisa todos no quadro (ex.: comentários mudaram) por mensagem stateless
   */
  async onRequest({ request, response }) {
    const url = new URL(request.url ?? "/", "http://x");
    if (url.pathname !== "/kick" && url.pathname !== "/notify") return;
    const given = Buffer.from(String(request.headers.authorization ?? "").replace(/^Bearer /, ""));
    const want = Buffer.from(RAW_SECRET);
    const ok = request.method === "POST" && given.length === want.length && timingSafeEqual(given, want);
    const board = url.searchParams.get("board") ?? "";
    if (!ok || !/^[0-9a-f-]{36}$/i.test(board)) {
      response.writeHead(ok ? 400 : 401).end();
      throw null; // eslint-disable-line no-throw-literal -- convenção do Hocuspocus: resposta já enviada
    }
    let result;
    if (url.pathname === "/notify") {
      const what = url.searchParams.get("what") ?? "";
      if (!/^[a-z-]{1,32}$/.test(what)) { response.writeHead(400).end(); throw null; }
      server.hocuspocus.documents.get(`board:${board}`)?.broadcastStateless(JSON.stringify({ type: what }));
      result = { notified: what };
    } else {
      result = await recheck(`board:${board}`);
    }
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
    throw null; // eslint-disable-line no-throw-literal
  },
});

setInterval(() => {
  for (const name of server.hocuspocus.documents.keys()) recheck(name);
}, RECHECK_MS).unref();

await server.listen();
console.log(`[rt] Hocuspocus ouvindo em ws://localhost:${PORT} · armazenamento: ${storage.kind} · reconfere a cada ${RECHECK_MS / 1000}s`);
