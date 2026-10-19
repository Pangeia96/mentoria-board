// Observa o lápis mágico dos outros por N segundos (entra como o dono, modo dev).
// Uso: node --env-file=.env scripts/watch-laser.mjs <boardId> [segundos]
import { HocuspocusProvider } from "@hocuspocus/provider";
import { SignJWT } from "jose";
import * as Y from "yjs";
import { readFile } from "node:fs/promises";

const [board, secs = "10"] = process.argv.slice(2);
const db = JSON.parse(await readFile(new URL("../../.data/dev-db.json", import.meta.url), "utf8"));
const owner = db.members.find((m) => m.boardId === board && m.role === "owner");
const token = await new SignJWT({ sub: owner.userId, kind: "user", name: "Observador", color: "p8", role: "owner", board })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode(process.env.REALTIME_SECRET));
const p = new HocuspocusProvider({ url: "ws://localhost:1234", name: `board:${board}`, document: new Y.Doc(), token });
let max = 0, updates = 0;
p.awareness.on("change", () => {
  p.awareness.getStates().forEach((s, id) => {
    if (id === p.awareness.clientID || !s.laser) return;
    updates++;
    max = Math.max(max, s.laser.pts.length);
  });
});
setTimeout(() => { console.log(JSON.stringify({ updates, maxPoints: max })); p.destroy(); process.exit(0); }, Number(secs) * 1000);
