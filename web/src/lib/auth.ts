// Sessão do mentor, cookie do visitante e token do servidor de tempo real.
// Com Supabase: sessão do Supabase Auth (cookies http-only via @supabase/ssr, renovada no proxy.ts).
// Sem Supabase (dev): login de desenvolvimento com JWT próprio.
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { data, type Role } from "./data";
import { hasSupabase, userClient } from "./supabase/server";
import { colorFor } from "./colors";

const enc = (s: string) => new TextEncoder().encode(s);
const SESSION_SECRET = enc(process.env.SESSION_SECRET ?? "dev-only-session-secret-0123456789abcdef");
const REALTIME_SECRET = enc(process.env.REALTIME_SECRET ?? "dev-only-secret-change-me-0123456789");
const DEV_SESSION_COOKIE = "mb_session";
const guestCookie = (boardId: string) => `mb_g_${boardId}`;
const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

async function sign(payload: Record<string, unknown>, secret: Uint8Array, exp: string) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(exp).sign(secret);
}
async function verify<T>(token: string | undefined, secret: Uint8Array): Promise<T | null> {
  if (!token) return null;
  try {
    return (await jwtVerify(token, secret, { algorithms: ["HS256"] })).payload as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ mentor */
/** Só no modo dev (sem Supabase). */
export async function startDevSession(userId: string) {
  (await cookies()).set(DEV_SESSION_COOKIE, await sign({ uid: userId }, SESSION_SECRET, "30d"), { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
}

export async function endSession() {
  if (hasSupabase) await (await userClient()).auth.signOut();
  (await cookies()).delete(DEV_SESSION_COOKIE);
}

export async function currentUser() {
  if (hasSupabase) {
    // getUser() valida o token no servidor do Supabase (getSession() confiaria no cookie).
    const { data: u } = await (await userClient()).auth.getUser();
    return u.user ? data.getProfile(u.user.id) : null;
  }
  const s = await verify<{ uid: string }>((await cookies()).get(DEV_SESSION_COOKIE)?.value, SESSION_SECRET);
  return s ? data.getProfile(s.uid) : null;
}

/* ------------------------------------------------------------ visitante */
export async function setGuestCookie(boardId: string, guestId: string) {
  (await cookies()).set(guestCookie(boardId), await sign({ gid: guestId, bid: boardId }, SESSION_SECRET, "90d"), { ...cookieOpts, maxAge: 60 * 60 * 24 * 90 });
}
async function currentGuest(boardId: string) {
  const g = await verify<{ gid: string; bid: string }>((await cookies()).get(guestCookie(boardId))?.value, SESSION_SECRET);
  if (!g || g.bid !== boardId) return null;
  const guest = await data.getGuest(g.gid);
  return guest && !guest.revokedAt && guest.boardId === boardId ? guest : null;
}

/* ------------------------------------------------------------ quem está abrindo o quadro */
export type Actor = { id: string; kind: "user" | "guest"; name: string; color: string; role: Role };

export { colorFor } from "./colors";

/** Mentor/membro tem prioridade; senão, visitante com cookie válido e link ainda ativo. */
export async function actorForBoard(boardId: string): Promise<Actor | null> {
  const user = await currentUser();
  if (user) {
    const role = await data.getMemberRole(boardId, user.id);
    if (role) return { id: user.id, kind: "user", name: user.name, color: colorFor(user.id), role };
  }
  const guest = await currentGuest(boardId);
  if (guest) {
    const link = await data.getShareLinkById(guest.shareLinkId);
    if (link?.enabled) return { id: guest.id, kind: "guest", name: guest.displayName, color: guest.color, role: link.role };
  }
  return null;
}

/** Token curto que o navegador usa para entrar no Hocuspocus. O servidor ainda reconfere no banco. */
export function realtimeToken(boardId: string, a: Actor) {
  return sign({ sub: a.id, kind: a.kind, name: a.name, color: a.color, role: a.role, board: boardId }, REALTIME_SECRET, "12h");
}
