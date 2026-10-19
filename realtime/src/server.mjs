// Servidor de tempo real do mentoria-board (Hocuspocus + Yjs).
// Documento por quadro: "board:<boardId>".
// Auth: o Next.js assina um token curto (HS256, REALTIME_SECRET) com {sub, kind, name, color, board, role};
// aqui o papel é reconferido no banco a cada conexão (ver storage.mjs).
import { Server } from "@hocuspocus/server";
import { jwtVerify } from "jose";
import * as Y from "yjs";
import { createStorage } from "./storage.mjs";

const PORT = Number(process.env.PORT ?? 1234);
const SECRET = new TextEncoder().encode(process.env.REALTIME_SECRET ?? "dev-only-secret-change-me-0123456789");
const storage = createStorage();
const boardIdOf = (documentName) => documentName.replace(/^board:/, "");

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
    connectionConfig.readOnly = !["owner", "editor"].includes(role);
    return { user: { id: payload.sub, kind: payload.kind, name: payload.name, role } };
  },

  async onLoadDocument({ document, documentName }) {
    const update = await storage.load(boardIdOf(documentName));
    if (update) Y.applyUpdate(document, update);
    return document;
  },

  async onStoreDocument({ document, documentName }) {
    await storage.store(boardIdOf(documentName), Y.encodeStateAsUpdate(document));
  },
});

await server.listen();
console.log(`[rt] Hocuspocus ouvindo em ws://localhost:${PORT} · armazenamento: ${storage.kind}`);
