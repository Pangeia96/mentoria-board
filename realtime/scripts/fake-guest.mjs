// Visitante simulado para testar o tempo real sem um segundo navegador.
// Uso: npm run test:guest -- <boardId> [segundos] [role]
// Entra no quadro, cria um sticky, passeia com o cursor e sai.
import { HocuspocusProvider } from "@hocuspocus/provider";
import { SignJWT } from "jose";
import * as Y from "yjs";
import { randomUUID } from "node:crypto";

const [boardId, secondsArg = "20", role = "editor"] = process.argv.slice(2);
if (!boardId) { console.error("informe o boardId"); process.exit(1); }
const secret = new TextEncoder().encode(process.env.REALTIME_SECRET ?? "dev-only-secret-change-me-0123456789");
const me = { id: randomUUID(), name: "Ana (teste)", color: "p2", kind: "guest" };
const token = await new SignJWT({ sub: me.id, kind: "guest", name: me.name, color: me.color, role, board: boardId })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(secret);

const doc = new Y.Doc();
const provider = new HocuspocusProvider({
  url: `ws://localhost:${process.env.PORT ?? 1234}`,
  name: `board:${boardId}`,
  document: doc,
  token,
  onAuthenticationFailed: ({ reason }) => { console.error("auth falhou:", reason); process.exit(2); },
});
provider.awareness.setLocalStateField("user", me);

await new Promise((r) => provider.on("synced", r));
const items = doc.getMap("items");
console.log(`[guest] sincronizado; ${items.size} itens no quadro`);

const id = randomUUID();
doc.transact(() => {
  const m = new Y.Map();
  Object.entries({ type: "sticky", x: 260, y: -40, w: 200, h: 200, color: "pink", text: "Criado pela Ana em tempo real", z: 999, createdBy: me.id })
    .forEach(([k, v]) => m.set(k, v));
  items.set(id, m);
});
console.log(`[guest] sticky criado (${role === "editor" ? "deve aparecer" : "deve ser REJEITADO pelo servidor"})`);

const t0 = Date.now();
const secs = Number(secondsArg);
const timer = setInterval(() => {
  const t = (Date.now() - t0) / 1000;
  provider.awareness.setLocalStateField("cursor", { x: Math.round(360 + Math.cos(t) * 160), y: Math.round(60 + Math.sin(t) * 120) });
  provider.awareness.setLocalStateField("selection", [id]);
  if (t > secs) {
    clearInterval(timer);
    console.log(`[guest] saindo; o quadro tem ${items.size} itens`);
    provider.destroy();
    setTimeout(() => process.exit(0), 300);
  }
}, 50);
