// Teste de "seguir" e "trazer todos": uma visitante que anda pelo quadro e, no fim, traz todo mundo para a visão dela.
// Uso: node --env-file=.env scripts/viewport-peer.mjs <boardId> [segundos]
import { HocuspocusProvider } from "@hocuspocus/provider";
import { SignJWT } from "jose";
import * as Y from "yjs";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [board, secs = "40"] = process.argv.slice(2);
const DB = new URL("../../.data/dev-db.json", import.meta.url);
const db = JSON.parse(await readFile(DB, "utf8"));
const link = db.links.find((l) => l.boardId === board && l.enabled);
const guest = { id: randomUUID(), boardId: board, shareLinkId: link.id, displayName: "Dani (teste)", color: "p3", revokedAt: null, createdAt: new Date().toISOString() };
db.guests.push(guest);
await writeFile(DB, JSON.stringify(db, null, 2));

const token = await new SignJWT({ sub: guest.id, kind: "guest", name: guest.displayName, color: "p3", role: link.role, board })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(process.env.REALTIME_SECRET));
const p = new HocuspocusProvider({ url: "ws://localhost:1234", name: `board:${board}`, document: new Y.Doc(), token });
p.awareness.setLocalStateField("user", { id: guest.id, name: guest.displayName, color: "p3", kind: "guest" });
await new Promise((r) => p.on("synced", r));
console.log("[vp] Dani entrou e está andando pelo quadro (viewport em x=1000..1400)");

const t0 = Date.now();
const timer = setInterval(() => {
  const t = (Date.now() - t0) / 1000;
  p.awareness.setLocalStateField("viewport", { cx: Math.round(1000 + t * 10), cy: 500, scale: 0.8 });
  if (t > Number(secs) - 5 && !p.awareness.getLocalState().summon) {
    p.awareness.setLocalStateField("summon", { ts: Date.now(), view: { cx: 5000, cy: 5000, scale: 1.5 }, target: null });
    console.log("[vp] Dani trouxe todos para (5000, 5000) zoom 150%");
  }
  if (t > Number(secs)) { clearInterval(timer); p.destroy(); setTimeout(() => process.exit(0), 300); }
}, 200);
