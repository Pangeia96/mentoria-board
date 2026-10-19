// Teste de permissão ao vivo: entra como visitante, espera N segundos e só então tenta escrever.
// Uso: node --env-file=.env scripts/late-writer.mjs <boardId> <segundos> <nome>
import { HocuspocusProvider } from "@hocuspocus/provider";
import { SignJWT } from "jose";
import * as Y from "yjs";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [board, secs = "25", name = "Carla (teste)"] = process.argv.slice(2);
const DB = new URL("../../.data/dev-db.json", import.meta.url);
const db = JSON.parse(await readFile(DB, "utf8"));
const link = db.links.find((l) => l.boardId === board && l.enabled);
const guest = { id: randomUUID(), boardId: board, shareLinkId: link.id, displayName: name, color: "p5", revokedAt: null, createdAt: new Date().toISOString() };
db.guests.push(guest);
await writeFile(DB, JSON.stringify(db, null, 2));

const secret = new TextEncoder().encode(process.env.REALTIME_SECRET);
const token = await new SignJWT({ sub: guest.id, kind: "guest", name, color: "p5", role: link.role, board })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(secret);
const doc = new Y.Doc();
const p = new HocuspocusProvider({ url: "ws://localhost:1234", name: `board:${board}`, document: doc, token });
p.awareness.setLocalStateField("user", { id: guest.id, name, color: "p5", kind: "guest" });
await new Promise((r) => p.on("synced", r));
console.log(`[late] ${name} entrou com papel ${link.role}; vai escrever em ${secs}s`);
setTimeout(() => {
  const m = new Y.Map();
  Object.entries({ type: "sticky", x: 0, y: 300, w: 200, h: 200, rotation: 0, locked: false, color: "blue", text: `Escrito tarde por ${name}`, z: 99999, createdBy: guest.id })
    .forEach(([k, v]) => m.set(k, v));
  doc.getMap("items").set(randomUUID(), m);
  console.log("[late] escreveu (se o papel mudou para só ver, o servidor deve descartar)");
  setTimeout(() => { p.destroy(); process.exit(0); }, 2000);
}, Number(secs) * 1000);
