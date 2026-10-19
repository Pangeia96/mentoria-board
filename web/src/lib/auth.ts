// Sessão do mentor, cookie do visitante e token do servidor de tempo real.
// M1: login de desenvolvimento (e-mail + nome, sem senha). No /replica-backend vira Supabase Auth.
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { data, type Role } from "./data";

const enc = (s: string) => new TextEncoder().encode(s);
const SESSION_SECRET = enc(process.env.SESSION_SECRET ?? "dev-only-session-secret-0123456789abcdef");
const REALTIME_SECRET = enc(process.env.REALTIME_SECRET ?? "dev-only-secret-change-me-0123456789");
const SESSION_COOKIE = "mb_session";
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
export async function startSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, await sign({ uid: userId }, SESSION_SECRET, "30d"), { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
}
export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
export async function currentUser() {
  const s = await verify<{ uid: string }>((await cookies()).get(SESSION_COOKIE)?.value, SESSION_SECRET);
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
  return guest && !guest.revokedAt ? guest : null;
}

/* ------------------------------------------------------------ quem está abrindo o quadro */
export type Actor = { id: string; kind: "user" | "guest"; name: string; color: string; role: Role };

const PRESENCE = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
export const colorFor = (id: string) => PRESENCE[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % PRESENCE.length];

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

/** Token curto que o navegador usa para entrar no Hocuspocus. */
export function realtimeToken(boardId: string, a: Actor) {
  return sign({ sub: a.id, kind: a.kind, name: a.name, color: a.color, role: a.role, board: boardId }, REALTIME_SECRET, "12h");
}
