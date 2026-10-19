// Visitante simulado para testar o tempo real sem um segundo navegador (modo dev).
// Uso: npm run test:guest -- <boardId> [segundos] [nome]
// Usa um visitante de verdade do .data/dev-db.json (cria um se preciso), entra no quadro,
// cria um sticky, passeia com o cursor, e avisa se o servidor o expulsar.
import { HocuspocusProvider } from "@hocuspocus/provider";
import { SignJWT } from "jose";
import * as Y from "yjs";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [boardId, secondsArg = "20", name = "Ana (teste)"] = process.argv.slice(2);
if (!boardId) { console.error("informe o boardId"); process.exit(1); }
const DB = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".data", "dev-db.json");

const db = JSON.parse(await readFile(DB, "utf8"));
const link = db.links.find((l) => l.boardId === boardId && l.enabled);
if (!link) { console.error("o quadro não tem link ativo: gere um em Compartilhar"); process.exit(1); }
let guest = db.guests.find((g) => g.shareLinkId === link.id && g.displayName === name && !g.revokedAt);
if (!guest) {
  guest = { id: randomUUID(), boardId, shareLinkId: link.id, displayName: name, color: "p2", revokedAt: null, createdAt: new Date().toISOString() };
  db.guests.push(guest);
  await writeFile(DB, JSON.stringify(db, null, 2));
}

const secret = new TextEncoder().encode(process.env.REALTIME_SECRET ?? "dev-only-secret-change-me-0123456789");
const token = await new SignJWT({ sub: guest.id, kind: "guest", name, color: guest.color, role: link.role, board: boardId })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(secret);

const doc = new Y.Doc();
const provider = new HocuspocusProvider({
  url: `ws://localhost:${process.env.PORT ?? 1234}`,
  name: `board:${boardId}`,
  document: doc,
  token,
  onAuthenticationFailed: ({ reason }) => { console.log(`[guest] servidor recusou: ${reason}`); process.exit(0); },
  onClose: ({ event }) => console.log(`[guest] conexão fechada pelo servidor: ${event?.code ?? "?"} ${event?.reason ?? ""}`),
});
provider.awareness.setLocalStateField("user", { id: guest.id, name, color: guest.color, kind: "guest" });

await new Promise((r) => provider.on("synced", r));
const items = doc.getMap("items");
console.log(`[guest] ${name} entrou (link: ${link.role}); ${items.size} itens no quadro`);

const id = randomUUID();
doc.transact(() => {
  const m = new Y.Map();
  Object.entries({ type: "sticky", x: 260, y: -40, w: 200, h: 200, rotation: 0, locked: false, color: "pink", text: `Criado por ${name}`, z: 9999, createdBy: guest.id })
    .forEach(([k, v]) => m.set(k, v));
  items.set(id, m);
});

const t0 = Date.now();
const secs = Number(secondsArg);
const timer = setInterval(() => {
  const t = (Date.now() - t0) / 1000;
  provider.awareness.setLocalStateField("cursor", { x: Math.round(360 + Math.cos(t) * 160), y: Math.round(60 + Math.sin(t) * 120) });
  if (t > secs) {
    clearInterval(timer);
    console.log(`[guest] saindo`);
    provider.destroy();
    setTimeout(() => process.exit(0), 300);
  }
}, 50);
