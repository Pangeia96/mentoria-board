"use server";

// Ações do dono sobre um quadro: compartilhamento, visitantes, renomear, duplicar, lixeira.
// Toda ação confere o papel no servidor; mudanças de acesso avisam o tempo real (expulsão na hora).
import { headers } from "next/headers";
import { z } from "zod";
import { data, type LinkRole } from "@/lib/data";
import { currentUser } from "@/lib/auth";
import { realtimeCall } from "@/lib/realtime";

const Id = z.string().uuid();
const Role = z.enum(["editor", "commenter", "viewer"]);
const Title = z.string().trim().min(1, "Dê um nome ao quadro.").max(120, "Use no máximo 120 caracteres.");

export type ShareState = {
  url: string;
  role: LinkRole;
  askVisitorName: boolean;
  guests: { id: string; name: string; color: string }[];
};
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireOwner(boardId: string) {
  if (!Id.safeParse(boardId).success) throw new Error("Quadro inválido.");
  const user = await currentUser();
  if (!user) throw new Error("Faça login de novo.");
  if ((await data.getMemberRole(boardId, user.id)) !== "owner") throw new Error("Só o dono do quadro pode fazer isso.");
  return user;
}

async function guard<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Algo deu errado. Tente de novo." };
  }
}

const kick = (boardId: string) => realtimeCall("kick", boardId);

async function origin() {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

async function shareState(boardId: string, userId: string): Promise<ShareState> {
  const link = await data.getOrCreateShareLink(boardId, userId);
  const guests = await data.listGuests(boardId);
  return {
    url: `${await origin()}/j/${link.token}`,
    role: link.role,
    askVisitorName: link.askVisitorName,
    guests: guests.map((g) => ({ id: g.id, name: g.displayName, color: g.color })),
  };
}

/* ------------------------------------------------------------ S05 compartilhar */
export async function getShareState(boardId: string) {
  return guard(async () => shareState(boardId, (await requireOwner(boardId)).id));
}

export async function updateShare(boardId: string, patch: { role?: LinkRole; askVisitorName?: boolean }) {
  return guard(async () => {
    const user = await requireOwner(boardId);
    const p = z.object({ role: Role.optional(), askVisitorName: z.boolean().optional() }).parse(patch);
    const link = await data.getOrCreateShareLink(boardId, user.id);
    await data.updateShareLink(link.id, p);
    if (p.role) await kick(boardId); // quem já está dentro passa a só ver / volta a editar
    return shareState(boardId, user.id);
  });
}

/** Desativa o link atual (todo mundo que entrou por ele sai) e cria um novo. */
export async function resetShareLink(boardId: string) {
  return guard(async () => {
    const user = await requireOwner(boardId);
    const old = await data.getOrCreateShareLink(boardId, user.id);
    await data.disableShareLink(old.id);
    const fresh = await data.getOrCreateShareLink(boardId, user.id);
    // o link novo mantém as mesmas regras
    if (fresh.role !== old.role || fresh.askVisitorName !== old.askVisitorName) {
      await data.updateShareLink(fresh.id, { role: old.role, askVisitorName: old.askVisitorName });
    }
    await kick(boardId);
    return shareState(boardId, user.id);
  });
}

export async function removeGuest(boardId: string, guestId: string) {
  return guard(async () => {
    const user = await requireOwner(boardId);
    const g = Id.safeParse(guestId).success ? await data.getGuest(guestId) : null;
    if (!g || g.boardId !== boardId) throw new Error("Visitante não encontrado.");
    await data.revokeGuest(guestId);
    await kick(boardId);
    return shareState(boardId, user.id);
  });
}

/* ------------------------------------------------------------ S10 quadro */
export async function renameBoardAction(boardId: string, title: string) {
  return guard(async () => {
    await requireOwner(boardId);
    const t = Title.safeParse(title);
    if (!t.success) throw new Error(t.error.issues[0].message);
    return (await data.renameBoard(boardId, t.data)).title;
  });
}

export async function duplicateBoardAction(boardId: string) {
  return guard(async () => {
    const user = await requireOwner(boardId);
    return (await data.duplicateBoard(boardId, user.id)).id;
  });
}

export async function trashBoardAction(boardId: string) {
  return guard(async () => {
    await requireOwner(boardId);
    await data.trashBoard(boardId);
    await kick(boardId); // quem estiver no quadro sai
    return true;
  });
}
