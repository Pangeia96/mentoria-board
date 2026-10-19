"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { data } from "@/lib/data";
import { colorFor, currentUser, endSession, setGuestCookie, startDevSession } from "@/lib/auth";
import { hasSupabase, userClient } from "@/lib/supabase/server";

export type FormState = { error?: string; sent?: string } | undefined;

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Dados inválidos.";

async function origin() {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/* ------------------------------------------------------------ S01 login */
const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido.").max(254),
  name: z.string().trim().max(80, "Use no máximo 80 caracteres.").default(""),
});

/** Com Supabase: manda o link mágico (também cria a conta no 1º acesso). Sem Supabase: login de dev. */
export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = LoginInput.safeParse({ email: form.get("email"), name: form.get("name") ?? "" });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { email, name } = parsed.data;

  if (!hasSupabase) {
    const profile = await data.upsertProfileByEmail!(email, name);
    await startDevSession(profile.id);
    redirect("/");
  }

  const { error } = await (await userClient()).auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await origin()}/auth/callback`, data: name ? { full_name: name } : undefined },
  });
  if (error) {
    console.error(`[auth] otp: ${error.status ?? ""} ${error.code ?? ""}`);
    return { error: error.status === 429 ? "Muitas tentativas. Espere um minuto e tente de novo." : "Não foi possível enviar o link agora." };
  }
  return { sent: email };
}

export async function signInWithGoogle() {
  if (!hasSupabase) redirect("/login");
  const { data: d, error } = await (await userClient()).auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback` },
  });
  if (error || !d.url) redirect("/login?erro=google");
  redirect(d.url);
}

export async function logout() {
  await endSession();
  redirect("/login");
}

/* ------------------------------------------------------------ S03 novo quadro */
const BoardInput = z.object({
  title: z.string().trim().min(1, "Dê um nome ao quadro.").max(120, "Use no máximo 120 caracteres."),
  clientName: z.string().trim().max(120, "Use no máximo 120 caracteres.").transform((v) => v || null),
});

export async function createBoard(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/login");
  const parsed = BoardInput.safeParse({ title: form.get("title") ?? "", clientName: form.get("clientName") ?? "" });
  if (!parsed.success) return { error: firstError(parsed.error) };
  let id: string;
  try {
    id = (await data.createBoard(user.id, parsed.data)).id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/b/${id}`);
}

/* ------------------------------------------------------------ S06 visitante entra */
const RANDOM_NAMES = ["Visitante Curioso", "Visitante Criativo", "Visitante Atento", "Visitante Sonhador", "Visitante Ousado"];
const GuestName = z.string().trim().max(60, "Use no máximo 60 caracteres.");

/** Limite simples por IP para entradas pelo link (por instância; suficiente para o tamanho da mentoria). */
const joins = new Map<string, number[]>();
async function tooManyJoins() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const now = Date.now();
  const recent = (joins.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  joins.set(ip, recent);
  return recent.length > 20;
}

export async function joinAsGuest(token: string, _: FormState, form: FormData): Promise<FormState> {
  if (await tooManyJoins()) return { error: "Muitas tentativas. Espere um minuto e tente de novo." };
  const link = await data.getShareLinkByToken(String(token));
  if (!link || !link.enabled) redirect(`/j/${encodeURIComponent(token)}`); // a página mostra o S07
  const parsed = GuestName.safeParse(form.get("name") ?? "");
  if (!parsed.success) return { error: firstError(parsed.error) };
  let name = parsed.data;
  if (!name) {
    if (link.askVisitorName) return { error: "Digite como você quer aparecer no quadro." };
    name = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  }
  let guestId: string;
  try {
    guestId = (await data.createGuest({ boardId: link.boardId, shareLinkId: link.id, displayName: name, color: colorFor(crypto.randomUUID()) })).id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  await setGuestCookie(link.boardId, guestId);
  redirect(`/b/${link.boardId}`);
}
