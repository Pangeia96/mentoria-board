"use server";

// Comentários (S08) e imagens: qualquer pessoa no quadro com papel que permite, mentor ou visitante.
import { z } from "zod";
import { data, type Author, type CommentThread } from "@/lib/data";
import { actorForBoard, type Actor } from "@/lib/auth";
import { realtimeCall } from "@/lib/realtime";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const Id = z.string().uuid();
const Body = z.string().trim().min(1, "Escreva alguma coisa.").max(5000, "Use no máximo 5000 caracteres.");

const canComment = (a: Actor) => a.role === "owner" || a.role === "editor" || a.role === "commenter";
const authorOf = (a: Actor): Author => ({ kind: a.kind, id: a.id, name: a.name, color: a.color });

async function actor(boardId: string) {
  if (!Id.safeParse(boardId).success) throw new Error("Quadro inválido.");
  const a = await actorForBoard(boardId);
  if (!a) throw new Error("Você não tem mais acesso a este quadro.");
  return a;
}
async function guard<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message;
    return { ok: false, error: msg || "Algo deu errado. Tente de novo." };
  }
}
const changed = (boardId: string) => realtimeCall("notify", boardId, { what: "comments" });

async function threadOnBoard(boardId: string, threadId: string) {
  const t = Id.safeParse(threadId).success ? await data.getThread(threadId) : null;
  if (!t || t.boardId !== boardId) throw new Error("Comentário não encontrado.");
  return t;
}

export async function listThreadsAction(boardId: string): Promise<Result<CommentThread[]>> {
  return guard(async () => {
    await actor(boardId);
    return data.listThreads(boardId);
  });
}

export async function createThreadAction(boardId: string, input: { itemId: string | null; x: number; y: number; body: string }) {
  return guard(async () => {
    const a = await actor(boardId);
    if (!canComment(a)) throw new Error("Seu acesso é só para ver.");
    const p = z.object({ itemId: z.string().uuid().nullable(), x: z.number().finite(), y: z.number().finite(), body: Body }).parse(input);
    const t = await data.createThread({ boardId, ...p, author: authorOf(a) });
    await changed(boardId);
    return t;
  });
}

export async function replyAction(boardId: string, threadId: string, body: string) {
  return guard(async () => {
    const a = await actor(boardId);
    if (!canComment(a)) throw new Error("Seu acesso é só para ver.");
    await threadOnBoard(boardId, threadId);
    await data.addComment({ threadId, author: authorOf(a), body: Body.parse(body) });
    await changed(boardId);
    return true;
  });
}

export async function resolveAction(boardId: string, threadId: string, resolved: boolean) {
  return guard(async () => {
    const a = await actor(boardId);
    if (!canComment(a)) throw new Error("Seu acesso é só para ver.");
    await threadOnBoard(boardId, threadId);
    await data.setThreadResolved(threadId, resolved);
    await changed(boardId);
    return true;
  });
}

/* ------------------------------------------------------------ imagens */
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAGIC: [string, number[]][] = [["image/png", [0x89, 0x50, 0x4e, 0x47]], ["image/jpeg", [0xff, 0xd8, 0xff]], ["image/gif", [0x47, 0x49, 0x46]], ["image/webp", [0x52, 0x49, 0x46, 0x46]]];

export async function uploadImageAction(boardId: string, form: FormData): Promise<Result<{ id: string; url: string }>> {
  return guard(async () => {
    const a = await actor(boardId);
    if (a.role !== "owner" && a.role !== "editor") throw new Error("Só quem pode editar adiciona imagens.");
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Nenhum arquivo.");
    if (!TYPES.includes(file.type)) throw new Error("Use PNG, JPG, WebP ou GIF.");
    if (file.size > MAX_BYTES) throw new Error("A imagem passa de 10 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    // confere o conteúdo, não só o tipo declarado
    const sig = MAGIC.find(([t]) => t === file.type)![1];
    if (!sig.every((b, i) => bytes[i] === b)) throw new Error("O arquivo não parece ser uma imagem válida.");
    const w = Number(form.get("width")), h = Number(form.get("height"));
    const asset = await data.saveAsset({
      boardId, mimeType: file.type, bytes, width: Number.isFinite(w) && w > 0 ? Math.round(w) : null, height: Number.isFinite(h) && h > 0 ? Math.round(h) : null, author: authorOf(a),
    });
    return { id: asset.id, url: `/api/assets/${boardId}/${asset.id}` };
  });
}
