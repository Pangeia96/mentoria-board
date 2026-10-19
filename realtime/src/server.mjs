// Servidor de tempo real do mentoria-board (Hocuspocus + Yjs).
// Documento por quadro: "board:<boardId>".
// Auth: o Next.js assina um token curto (HS256, REALTIME_SECRET) com {sub, kind, name, color, board, role}.
// M1: persistência em arquivo (.data/docs). No /replica-backend vira board_docs no Postgres.
import { Server } from "@hocuspocus/server";
import { jwtVerify } from "jose";
import * as Y from "yjs";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 1234);
const SECRET = new TextEncoder().encode(process.env.REALTIME_SECRET ?? "dev-only-secret-change-me-0123456789");
const DATA_DIR = process.env.DOCS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".data", "docs");
await mkdir(DATA_DIR, { recursive: true });

const fileFor = (documentName) => {
  const id = documentName.replace(/^board:/, "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("documento inválido");
  return join(DATA_DIR, `${id}.bin`);
};

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
    // Só editor/owner escrevem. Commenter e viewer recebem as mudanças mas não conseguem enviar.
    connectionConfig.readOnly = !["owner", "editor"].includes(payload.role);
    return { user: { id: payload.sub, kind: payload.kind, name: payload.name, role: payload.role } };
  },

  async onLoadDocument({ document, documentName }) {
    try {
      Y.applyUpdate(document, await readFile(fileFor(documentName)));
    } catch (e) {
      if (e.code !== "ENOENT") throw e; // quadro novo: começa vazio
    }
    return document;
  },

  async onStoreDocument({ document, documentName }) {
    const file = fileFor(documentName);
    await writeFile(`${file}.tmp`, Y.encodeStateAsUpdate(document));
    await rename(`${file}.tmp`, file); // grava atômico
  },

  async onConnect({ documentName }) {
    console.log(`[rt] conexão em ${documentName}`);
  },
});

await server.listen();
console.log(`[rt] Hocuspocus ouvindo em ws://localhost:${PORT} · docs em ${DATA_DIR}`);
