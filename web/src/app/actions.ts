"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { data } from "@/lib/data";
import { colorFor, currentUser, endSession, setGuestCookie, startSession } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

/* ------------------------------------------------------------ S01 login (dev) */
export async function devLogin(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  const name = String(form.get("name") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Digite um e-mail válido." };
  const profile = await data.upsertProfileByEmail(email, name);
  await startSession(profile.id);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

/* ------------------------------------------------------------ S03 novo quadro */
export async function createBoard(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/login");
  const title = String(form.get("title") ?? "").trim();
  const clientName = String(form.get("clientName") ?? "").trim() || null;
  if (!title) return { error: "Dê um nome ao quadro." };
  if (title.length > 120) return { error: "Use no máximo 120 caracteres." };
  const board = await data.createBoard(user.id, { title, clientName });
  redirect(`/b/${board.id}`);
}

/* ------------------------------------------------------------ S05 link de compartilhamento */
export async function getShareUrl(boardId: string): Promise<{ url?: string; error?: string }> {
  const user = await currentUser();
  if (!user) return { error: "Faça login de novo." };
  if ((await data.getMemberRole(boardId, user.id)) !== "owner") return { error: "Só o dono do quadro pode compartilhar." };
  const link = await data.getOrCreateShareLink(boardId, user.id);
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return { url: `${origin}/j/${link.token}` };
}

/* ------------------------------------------------------------ S06 visitante entra */
const RANDOM_NAMES = ["Visitante Curioso", "Visitante Criativo", "Visitante Atento", "Visitante Sonhador", "Visitante Ousado"];

export async function joinAsGuest(token: string, _: FormState, form: FormData): Promise<FormState> {
  const link = await data.getShareLinkByToken(token);
  if (!link || !link.enabled) redirect(`/j/${token}`); // a página mostra o S07
  let name = String(form.get("name") ?? "").trim();
  if (name.length > 60) return { error: "Use no máximo 60 caracteres." };
  if (!name) {
    if (link.askVisitorName) return { error: "Digite como você quer aparecer no quadro." };
    name = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  }
  const tmpId = crypto.randomUUID();
  const guest = await data.createGuest({ boardId: link.boardId, shareLinkId: link.id, displayName: name, color: colorFor(tmpId) });
  await setGuestCookie(link.boardId, guest.id);
  redirect(`/b/${link.boardId}`);
}
