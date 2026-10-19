// Camada de dados FAKE para o M1: um arquivo JSON em <repo>/.data/dev-db.json.
// Mesmas regras do schema.sql (1 link ativo por quadro, dono vira membro owner, título 1–120).
// Será trocada pela implementação Supabase no /replica-backend sem mudar nenhuma tela.
import { randomBytes, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Asset, Board, Comment, CommentThread, DataLayer, Guest, Profile, Role, ShareLink } from "./types";

type Member = { boardId: string; userId: string; role: Role };
type ThreadRow = Omit<CommentThread, "comments">;
type Db = {
  profiles: Profile[]; boards: Board[]; members: Member[]; links: ShareLink[]; guests: Guest[];
  threads?: ThreadRow[]; comments?: Comment[]; assets?: Asset[];
};

const FILE = process.env.DEV_DB_FILE ?? join(process.cwd(), "..", ".data", "dev-db.json");
const DOCS = join(dirname(FILE), "docs"); // onde o servidor de tempo real (modo dev) grava os docs Yjs
const ASSETS = join(dirname(FILE), "assets");
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const now = () => new Date().toISOString();

let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Db> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Db;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return { profiles: [], boards: [], members: [], links: [], guests: [] };
  }
}
async function save(db: Db) {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(`${FILE}.tmp`, JSON.stringify(db, null, 2));
  await rename(`${FILE}.tmp`, FILE);
}
/** Serializa leituras+escritas para não perder dados com requisições paralelas. */
function tx<T>(fn: (db: Db) => T | Promise<T>, write = false): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const out = await fn(db);
    if (write) await save(db);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

function checkTitle(title: string) {
  const t = title.trim();
  if (t.length < 1 || t.length > 120) throw new Error("O nome do quadro precisa ter de 1 a 120 caracteres.");
  return t;
}

export const fakeData: DataLayer = {
  upsertProfileByEmail: (email, name) =>
    tx((db) => {
      const e = email.trim().toLowerCase();
      let p = db.profiles.find((x) => x.email === e);
      if (!p) {
        p = { id: randomUUID(), email: e, name: name.trim() || e.split("@")[0], createdAt: now() };
        db.profiles.push(p);
      } else if (name.trim()) p.name = name.trim();
      return p;
    }, true),

  getProfile: (id) => tx((db) => db.profiles.find((p) => p.id === id) ?? null),

  listBoards: (ownerId, opts) =>
    tx((db) => {
      const q = opts?.q?.trim().toLowerCase();
      const mine = new Set(db.members.filter((m) => m.userId === ownerId).map((m) => m.boardId));
      return db.boards
        .filter((b) => mine.has(b.id) && !b.deletedAt)
        .filter((b) => !q || b.title.toLowerCase().includes(q) || b.clientName?.toLowerCase().includes(q))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }),

  createBoard: (ownerId, input) =>
    tx((db) => {
      const b: Board = {
        id: randomUUID(),
        ownerId,
        title: checkTitle(input.title),
        clientName: input.clientName?.trim() || null,
        deletedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };
      db.boards.push(b);
      db.members.push({ boardId: b.id, userId: ownerId, role: "owner" });
      return b;
    }, true),

  getBoard: (id) => tx((db) => db.boards.find((b) => b.id === id && !b.deletedAt) ?? null),

  getMemberRole: (boardId, userId) =>
    tx((db) => db.members.find((m) => m.boardId === boardId && m.userId === userId)?.role ?? null),

  getOrCreateShareLink: (boardId, createdBy) =>
    tx((db) => {
      const active = db.links.find((l) => l.boardId === boardId && l.enabled);
      if (active) return active;
      const l: ShareLink = {
        id: randomUUID(),
        boardId,
        token: randomBytes(24).toString("hex"),
        role: "editor",
        askVisitorName: true,
        enabled: true,
        createdBy,
        createdAt: now(),
      };
      db.links.push(l);
      return l;
    }, true),

  getShareLinkByToken: (token) => tx((db) => db.links.find((l) => l.token === token) ?? null),

  getShareLinkById: (id) => tx((db) => db.links.find((l) => l.id === id) ?? null),

  createGuest: (input) =>
    tx((db) => {
      const name = input.displayName.trim();
      if (name.length < 1 || name.length > 60) throw new Error("O nome precisa ter de 1 a 60 caracteres.");
      const g: Guest = { id: randomUUID(), ...input, displayName: name, revokedAt: null, createdAt: now() };
      db.guests.push(g);
      return g;
    }, true),

  getGuest: (id) => tx((db) => db.guests.find((g) => g.id === id) ?? null),

  updateShareLink: (id, patch) =>
    tx((db) => {
      const l = db.links.find((x) => x.id === id);
      if (!l) throw new Error("Link não encontrado.");
      if (patch.role) l.role = patch.role;
      if (patch.askVisitorName !== undefined) l.askVisitorName = patch.askVisitorName;
      return l;
    }, true),

  disableShareLink: (id) =>
    tx((db) => {
      const l = db.links.find((x) => x.id === id);
      if (l) l.enabled = false;
    }, true),

  listGuests: (boardId) =>
    tx((db) => {
      const active = new Set(db.links.filter((l) => l.boardId === boardId && l.enabled).map((l) => l.id));
      return db.guests.filter((g) => g.boardId === boardId && !g.revokedAt && active.has(g.shareLinkId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }),

  revokeGuest: (id) =>
    tx((db) => {
      const g = db.guests.find((x) => x.id === id);
      if (g && !g.revokedAt) g.revokedAt = now();
    }, true),

  renameBoard: (id, title) =>
    tx((db) => {
      const b = db.boards.find((x) => x.id === id && !x.deletedAt);
      if (!b) throw new Error("Quadro não encontrado.");
      b.title = checkTitle(title);
      b.updatedAt = now();
      return b;
    }, true),

  duplicateBoard: (id, ownerId) =>
    tx(async (db) => {
      const src = db.boards.find((x) => x.id === id && !x.deletedAt);
      if (!src) throw new Error("Quadro não encontrado.");
      const title = `${src.title} (cópia)`.slice(0, 120);
      const b: Board = { ...src, id: randomUUID(), ownerId, title, deletedAt: null, createdAt: now(), updatedAt: now() };
      db.boards.push(b);
      db.members.push({ boardId: b.id, userId: ownerId, role: "owner" });
      try {
        await copyFile(join(DOCS, `${src.id}.bin`), join(DOCS, `${b.id}.bin`));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; // quadro vazio: nada a copiar
      }
      return b;
    }, true),

  trashBoard: (id) =>
    tx((db) => {
      const b = db.boards.find((x) => x.id === id);
      if (b && !b.deletedAt) b.deletedAt = now();
    }, true),

  listThreads: (boardId) =>
    tx((db) =>
      (db.threads ?? []).filter((t) => t.boardId === boardId)
        .map((t) => ({ ...t, comments: (db.comments ?? []).filter((c) => c.threadId === t.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),

  createThread: (input) =>
    tx((db) => {
      const t: ThreadRow = { id: randomUUID(), boardId: input.boardId, itemId: input.itemId, x: input.x, y: input.y, resolvedAt: null, createdAt: now() };
      const c: Comment = { id: randomUUID(), threadId: t.id, author: input.author, body: input.body, createdAt: now() };
      (db.threads ??= []).push(t);
      (db.comments ??= []).push(c);
      return { ...t, comments: [c] };
    }, true),

  addComment: (input) =>
    tx((db) => {
      const c: Comment = { id: randomUUID(), threadId: input.threadId, author: input.author, body: input.body, createdAt: now() };
      (db.comments ??= []).push(c);
      return c;
    }, true),

  getThread: (id) =>
    tx((db) => {
      const t = (db.threads ?? []).find((x) => x.id === id);
      return t ? { ...t, comments: (db.comments ?? []).filter((c) => c.threadId === id) } : null;
    }),

  setThreadResolved: (id, resolved) =>
    tx((db) => {
      const t = (db.threads ?? []).find((x) => x.id === id);
      if (t) t.resolvedAt = resolved ? now() : null;
    }, true),

  saveAsset: (input) =>
    tx(async (db) => {
      const ext = EXT[input.mimeType];
      if (!ext) throw new Error("Tipo de imagem não aceito.");
      const a: Asset = { id: randomUUID(), boardId: input.boardId, mimeType: input.mimeType, sizeBytes: input.bytes.byteLength, width: input.width, height: input.height, createdAt: now() };
      await mkdir(ASSETS, { recursive: true });
      await writeFile(join(ASSETS, `${a.id}.${ext}`), input.bytes);
      (db.assets ??= []).push(a);
      return a;
    }, true),

  readAsset: (boardId, id) =>
    tx(async (db) => {
      const a = (db.assets ?? []).find((x) => x.id === id && x.boardId === boardId);
      if (!a) return null;
      try {
        return { asset: a, bytes: new Uint8Array(await readFile(join(ASSETS, `${a.id}.${EXT[a.mimeType]}`))) };
      } catch {
        return null;
      }
    }),
};
