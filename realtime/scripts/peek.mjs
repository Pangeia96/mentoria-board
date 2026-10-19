// Mostra o que um segundo participante recebe do quadro (tipos e contagem).
// Uso: node --env-file=.env scripts/peek.mjs <boardId>
import { HocuspocusProvider } from "@hocuspocus/provider";
import { SignJWT } from "jose";
import * as Y from "yjs";

const [board] = process.argv.slice(2);
const secret = new TextEncoder().encode(process.env.REALTIME_SECRET ?? "dev-only-secret-change-me-0123456789");
// entra como o dono do quadro (modo dev lê o .data/dev-db.json)
const db = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../../.data/dev-db.json", import.meta.url), "utf8"));
const owner = db.members.find((m) => m.boardId === board && m.role === "owner");
const token = await new SignJWT({ sub: owner.userId, kind: "user", name: "Observador", color: "p8", role: "owner", board })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(secret);

const doc = new Y.Doc();
const p = new HocuspocusProvider({ url: `ws://localhost:${process.env.PORT ?? 1234}`, name: `board:${board}`, document: doc, token });
p.on("synced", () => {
  const types = {};
  doc.getMap("items").forEach((m) => { const t = m.get("type"); types[t] = (types[t] ?? 0) + 1; });
  console.log(JSON.stringify(types));
  if (process.argv.includes("--list")) doc.getMap("items").forEach((m, id) => { const j = m.toJSON(); if (j.type === "connector" || j.type === "shape") console.log(id.slice(0, 8), j.type, j.z, j.shape ?? "", JSON.stringify(j.from ?? ""), JSON.stringify(j.to ?? "")); });
  p.destroy();
  setTimeout(() => process.exit(0), 200);
});
