// Onde o servidor guarda os documentos e confere permissões.
// Com SUPABASE_URL + SUPABASE_SECRET_KEY: Postgres (board_docs, board_members, share_links, board_guests).
// Sem: arquivos em .data/docs e confiança só no token (modo dev, igual ao M1).
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const UUID = /^[0-9a-f-]{36}$/i;
const toHex = (u8) => "\\x" + Buffer.from(u8).toString("hex");
const fromHex = (s) => new Uint8Array(Buffer.from(String(s).replace(/^\\x/, ""), "hex"));

export function createStorage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? supabaseStorage(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })) : fileStorage();
}

function supabaseStorage(sb) {
  return {
    kind: "postgres",
    async load(boardId) {
      const { data, error } = await sb.from("board_docs").select("ydoc").eq("board_id", boardId).maybeSingle();
      if (error) throw new Error(`load ${boardId}: ${error.code}`);
      return data ? fromHex(data.ydoc) : null;
    },
    async store(boardId, update) {
      const { error } = await sb.rpc("store_board_doc", { b: boardId, doc: toHex(update) });
      if (error) throw new Error(`store ${boardId}: ${error.code} ${error.message}`);
    },
    /** Papel atual no banco (o token pode estar velho: link desativado, visitante removido). */
    async currentRole({ kind, sub, board }) {
      if (!UUID.test(sub) || !UUID.test(board)) return null;
      const { data: b } = await sb.from("boards").select("id").eq("id", board).is("deleted_at", null).maybeSingle();
      if (!b) return null; // quadro na lixeira: ninguém entra
      if (kind === "user") {
        const { data } = await sb.from("board_members").select("role").eq("board_id", board).eq("user_id", sub).maybeSingle();
        return data?.role ?? null;
      }
      const { data: g } = await sb.from("board_guests").select("board_id, revoked_at, share_links(enabled, role)").eq("id", sub).maybeSingle();
      if (!g || g.board_id !== board || g.revoked_at || !g.share_links?.enabled) return null;
      return g.share_links.role;
    },
  };
}

function fileStorage() {
  const dir = process.env.DOCS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".data", "docs");
  const file = (id) => {
    if (!UUID.test(id)) throw new Error("documento inválido");
    return join(dir, `${id}.bin`);
  };
  return {
    kind: "file",
    async load(boardId) {
      await mkdir(dir, { recursive: true });
      try {
        return new Uint8Array(await readFile(file(boardId)));
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async store(boardId, update) {
      await mkdir(dir, { recursive: true });
      const f = file(boardId);
      await writeFile(`${f}.tmp`, update);
      await rename(`${f}.tmp`, f);
    },
    /** Modo dev: mesma regra do Postgres, lendo o JSON da camada fake do web (.data/dev-db.json). */
    async currentRole({ kind, sub, board }) {
      let db;
      try {
        db = JSON.parse(await readFile(join(dir, "..", "dev-db.json"), "utf8"));
      } catch {
        return null;
      }
      if (!db.boards?.some((b) => b.id === board && !b.deletedAt)) return null;
      if (kind === "user") return db.members?.find((m) => m.boardId === board && m.userId === sub)?.role ?? null;
      const g = db.guests?.find((x) => x.id === sub);
      const link = g && db.links?.find((l) => l.id === g.shareLinkId);
      if (!g || g.boardId !== board || g.revokedAt || !link?.enabled) return null;
      return link.role;
    },
  };
}
