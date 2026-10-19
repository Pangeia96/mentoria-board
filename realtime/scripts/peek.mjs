// Mostra o que um segundo participante recebe do quadro (tipos e contagem).
// Uso: node --env-file=.env scripts/peek.mjs <boardId>
import { HocuspocusProvider } from "@hocuspocus/provider";
import { SignJWT } from "jose";
import * as Y from "yjs";

const [board] = process.argv.slice(2);
const secret = new TextEncoder().encode(process.env.REALTIME_SECRET ?? "dev-only-secret-change-me-0123456789");
const token = await new SignJWT({ sub: crypto.randomUUID(), kind: "guest", name: "Observador", color: "p8", role: "viewer", board })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(secret);

const doc = new Y.Doc();
const p = new HocuspocusProvider({ url: `ws://localhost:${process.env.PORT ?? 1234}`, name: `board:${board}`, document: doc, token });
p.on("synced", () => {
  const types = {};
  doc.getMap("items").forEach((m) => { const t = m.get("type"); types[t] = (types[t] ?? 0) + 1; });
  console.log(JSON.stringify(types));
  p.destroy();
  setTimeout(() => process.exit(0), 200);
});
