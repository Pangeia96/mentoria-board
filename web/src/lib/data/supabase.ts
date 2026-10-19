// Camada de dados real (Supabase). Mesma interface da fake.
// Mentor: cliente com sessão (RLS). Visitante sem conta: cliente de serviço + checagem explícita
// (o visitante nunca fala direto com o Supabase; ver architecture.md §2).
import "server-only";
import { adminClient, userClient } from "../supabase/server";
import type { Board, DataLayer, Guest, Profile, Role, ShareLink } from "./types";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));

const toBoard = (r: Row): Board => ({
  id: String(r.id), ownerId: String(r.owner_id), title: String(r.title), clientName: s(r.client_name),
  deletedAt: s(r.deleted_at), createdAt: String(r.created_at), updatedAt: String(r.updated_at),
});
const toLink = (r: Row): ShareLink => ({
  id: String(r.id), boardId: String(r.board_id), token: String(r.token), role: r.role as ShareLink["role"],
  askVisitorName: Boolean(r.ask_visitor_name), enabled: Boolean(r.enabled), createdBy: String(r.created_by), createdAt: String(r.created_at),
});
const toGuest = (r: Row): Guest => ({
  id: String(r.id), boardId: String(r.board_id), shareLinkId: String(r.share_link_id), displayName: String(r.display_name),
  color: String(r.color), revokedAt: s(r.revoked_at), createdAt: String(r.created_at),
});

function fail(e: { message: string; code?: string } | null, what: string): never {
  // Mensagem genérica para o usuário; o detalhe fica no log do servidor (sem dados pessoais).
  console.error(`[data] ${what}: ${e?.code ?? ""} ${e?.message ?? ""}`);
  throw new Error(`Não foi possível ${what}. Tente de novo.`);
}

export const supabaseData: DataLayer = {
  async getProfile(id) {
    const sb = await userClient();
    const [{ data: p }, { data: u }] = await Promise.all([
      sb.from("profiles").select("id, name, created_at").eq("id", id).maybeSingle(),
      sb.auth.getUser(),
    ]);
    if (!p) return null;
    return { id: p.id, name: p.name, email: u.user?.id === id ? (u.user.email ?? "") : "", createdAt: p.created_at } satisfies Profile;
  },

  async listBoards(ownerId, opts) {
    const sb = await userClient();
    let q = sb.from("boards").select("*").is("deleted_at", null).order("updated_at", { ascending: false }).limit(200);
    const term = opts?.q?.trim().replace(/[%_,()]/g, " ");
    if (term) q = q.or(`title.ilike.%${term}%,client_name.ilike.%${term}%`);
    const { data, error } = await q;
    if (error) fail(error, "carregar os quadros");
    // RLS já limita aos quadros em que a pessoa é membro; ownerId fica para a interface.
    void ownerId;
    return (data ?? []).map(toBoard);
  },

  async createBoard(ownerId, input) {
    const sb = await userClient();
    const { data, error } = await sb.from("boards")
      .insert({ owner_id: ownerId, title: input.title.trim(), client_name: input.clientName?.trim() || null })
      .select("*").single();
    if (error) fail(error, "criar o quadro");
    return toBoard(data);
  },

  async getBoard(id) {
    // Metadados (título) também para visitante; a página só mostra depois de achar o actor.
    const { data } = await adminClient().from("boards").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
    return data ? toBoard(data) : null;
  },

  async getMemberRole(boardId, userId) {
    const sb = await userClient();
    const { data } = await sb.from("board_members").select("role").eq("board_id", boardId).eq("user_id", userId).maybeSingle();
    return (data?.role as Role) ?? null;
  },

  async getOrCreateShareLink(boardId, createdBy) {
    const sb = await userClient(); // RLS: só o owner gerencia links
    const active = await sb.from("share_links").select("*").eq("board_id", boardId).eq("enabled", true).maybeSingle();
    if (active.data) return toLink(active.data);
    const { data, error } = await sb.from("share_links").insert({ board_id: boardId, created_by: createdBy }).select("*").single();
    if (error?.code === "23505") {
      // outra aba criou ao mesmo tempo: o índice único parcial garante um só ativo
      const again = await sb.from("share_links").select("*").eq("board_id", boardId).eq("enabled", true).single();
      return toLink(again.data!);
    }
    if (error) fail(error, "gerar o link");
    return toLink(data);
  },

  async getShareLinkByToken(token) {
    if (!/^[0-9a-f]{48}$/.test(token)) return null;
    const { data } = await adminClient().from("share_links").select("*").eq("token", token).maybeSingle();
    return data ? toLink(data) : null;
  },

  async getShareLinkById(id) {
    const { data } = await adminClient().from("share_links").select("*").eq("id", id).maybeSingle();
    return data ? toLink(data) : null;
  },

  async createGuest(input) {
    const { data, error } = await adminClient().from("board_guests")
      .insert({ board_id: input.boardId, share_link_id: input.shareLinkId, display_name: input.displayName.trim(), color: input.color })
      .select("*").single();
    if (error) fail(error, "entrar no quadro");
    return toGuest(data);
  },

  async getGuest(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data } = await adminClient().from("board_guests").select("*").eq("id", id).maybeSingle();
    return data ? toGuest(data) : null;
  },

  async updateShareLink(id, patch) {
    const sb = await userClient(); // RLS: só o owner
    const row: Row = {};
    if (patch.role) row.role = patch.role;
    if (patch.askVisitorName !== undefined) row.ask_visitor_name = patch.askVisitorName;
    const { data, error } = await sb.from("share_links").update(row).eq("id", id).select("*").single();
    if (error) fail(error, "salvar o link");
    return toLink(data);
  },

  async disableShareLink(id) {
    const sb = await userClient();
    const { error } = await sb.from("share_links").update({ enabled: false }).eq("id", id);
    if (error) fail(error, "desativar o link");
  },

  async listGuests(boardId) {
    const sb = await userClient(); // RLS: membros veem os visitantes
    const { data, error } = await sb.from("board_guests").select("*, share_links!inner(enabled)")
      .eq("board_id", boardId).is("revoked_at", null).eq("share_links.enabled", true).order("created_at");
    if (error) fail(error, "carregar os visitantes");
    return (data ?? []).map(toGuest);
  },

  async revokeGuest(id) {
    const sb = await userClient(); // RLS: só o owner revoga
    const { error } = await sb.from("board_guests").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null);
    if (error) fail(error, "remover o visitante");
  },

  async renameBoard(id, title) {
    const sb = await userClient();
    const { data, error } = await sb.from("boards").update({ title: title.trim() }).eq("id", id).select("*").single();
    if (error) fail(error, "renomear o quadro");
    return toBoard(data);
  },

  async duplicateBoard(id, ownerId) {
    const sb = await userClient();
    const { data: src } = await sb.from("boards").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
    if (!src) throw new Error("Quadro não encontrado.");
    const { data: copy, error } = await sb.from("boards")
      .insert({ owner_id: ownerId, title: `${src.title} (cópia)`.slice(0, 120), client_name: src.client_name })
      .select("*").single();
    if (error) fail(error, "duplicar o quadro");
    // o conteúdo (board_docs) só a service role lê; quem chamou já provou acesso ao lido acima via RLS
    const { data: doc } = await adminClient().from("board_docs").select("ydoc").eq("board_id", id).maybeSingle();
    if (doc) {
      const { error: e2 } = await adminClient().rpc("store_board_doc", { b: copy.id, doc: doc.ydoc });
      if (e2) fail(e2, "copiar o conteúdo do quadro");
    }
    return toBoard(copy);
  },

  async trashBoard(id) {
    const sb = await userClient();
    const { error } = await sb.from("boards").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) fail(error, "mover o quadro para a lixeira");
  },
};
