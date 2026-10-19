"use client";

// Comentários (S08): pinos no quadro, conversa com respostas, resolver, compositor e painel lateral.
import { useState } from "react";
import { Popover } from "radix-ui";
import { Check, MessageSquare, RotateCcw } from "lucide-react";
import clsx from "clsx";
import { Button, Drawer, Switch, Textarea } from "@/components/ui/primitives";
import { Avatar, type PresenceColor } from "@/components/ui/board";
import type { Comment, CommentThread } from "@/lib/data/types";

const hhmm = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const when = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? hhmm.format(d) : `${day.format(d)}, ${hhmm.format(d)}`;
};
const personOf = (c: Comment) => ({ id: c.author.id, name: c.author.name, color: c.author.color as PresenceColor, guest: c.author.kind === "guest" });

function Composer({ placeholder, onSend, autoFocus, sendLabel = "Enviar", onCancel }: {
  placeholder: string; onSend: (body: string) => Promise<boolean>; autoFocus?: boolean; sendLabel?: string; onCancel?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    const ok = await onSend(body);
    setBusy(false);
    if (ok) setDraft("");
  };
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label={placeholder}
        placeholder={`${placeholder} (Ctrl+Enter envia)`}
        value={draft}
        autoFocus={autoFocus}
        maxLength={5000}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation(); // atalhos do quadro não disparam enquanto se digita
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
          if (e.key === "Escape") onCancel?.();
        }}
        className="min-h-16"
      />
      <div className="flex justify-end gap-2">
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button size="sm" disabled={!draft.trim()} loading={busy} onClick={send}>{sendLabel}</Button>
      </div>
    </div>
  );
}

export function ThreadView({ thread, canComment, onReply, onResolve }: {
  thread: CommentThread; canComment: boolean; onReply: (body: string) => Promise<boolean>; onResolve: (resolved: boolean) => void;
}) {
  return (
    <div className="flex w-80 max-w-[calc(100vw-32px)] flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
          {thread.resolvedAt ? "Resolvido" : `${thread.comments.length} ${thread.comments.length === 1 ? "mensagem" : "mensagens"}`}
        </span>
        {canComment && (
          <Button size="sm" variant="ghost" icon={thread.resolvedAt ? <RotateCcw className="size-4" /> : <Check className="size-4" />} onClick={() => onResolve(!thread.resolvedAt)}>
            {thread.resolvedAt ? "Reabrir" : "Resolver"}
          </Button>
        )}
      </div>
      <ul className="flex max-h-72 flex-col gap-3 overflow-y-auto">
        {thread.comments.map((c) => (
          <li key={c.id} className="flex gap-2">
            <Avatar person={personOf(c)} size={24} />
            <div className="min-w-0">
              <p className="text-sm"><span className="font-semibold">{c.author.name}</span> <span className="text-xs text-text-muted">{when(c.createdAt)}</span></p>
              <p className="whitespace-pre-wrap break-words text-sm text-text">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      {canComment && !thread.resolvedAt && <Composer placeholder="Responder" onSend={onReply} sendLabel="Responder" />}
    </div>
  );
}

/** Pino de um comentário no canvas (posição de tela já calculada). */
export function CommentPin({ thread, at, open, onOpenChange, canComment, onReply, onResolve }: {
  thread: CommentThread; at: { x: number; y: number }; open: boolean; onOpenChange: (v: boolean) => void;
  canComment: boolean; onReply: (body: string) => Promise<boolean>; onResolve: (resolved: boolean) => void;
}) {
  const first = thread.comments[0];
  if (!first) return null;
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        aria-label={`Comentário de ${first.author.name}, ${thread.comments.length} ${thread.comments.length === 1 ? "mensagem" : "mensagens"}`}
        className={clsx(
          "absolute z-10 -translate-y-full rounded-full rounded-bl-none bg-surface p-0.5 shadow-md transition-transform hover:scale-110",
          thread.resolvedAt && "opacity-50",
          open && "ring-2 ring-focus",
        )}
        style={{ left: at.x, top: at.y }}
      >
        <Avatar person={personOf(first)} size={24} />
        {thread.comments.length > 1 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-text px-1 text-[10px] font-semibold text-surface">
            {thread.comments.length}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="right" align="start" sideOffset={8} collisionPadding={12} className="z-50 rounded-lg bg-surface p-3 shadow-lg" onKeyDown={(e) => e.stopPropagation()}>
          <ThreadView thread={thread} canComment={canComment} onReply={onReply} onResolve={onResolve} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Caixa para começar um comentário novo no ponto clicado. */
export function NewCommentBox({ at, onSend, onCancel }: { at: { x: number; y: number }; onSend: (body: string) => Promise<boolean>; onCancel: () => void }) {
  return (
    <Popover.Root open onOpenChange={(v) => !v && onCancel()}>
      <Popover.Anchor className="pointer-events-none absolute size-0" style={{ left: at.x, top: at.y }} />
      <Popover.Portal>
        <Popover.Content side="right" align="start" sideOffset={8} collisionPadding={12} className="z-50 w-80 max-w-[calc(100vw-32px)] rounded-lg bg-surface p-3 shadow-lg" onKeyDown={(e) => e.stopPropagation()}>
          <p className="mb-2 text-sm font-semibold">Novo comentário</p>
          <Composer placeholder="Escreva um comentário" autoFocus onSend={onSend} onCancel={onCancel} sendLabel="Comentar" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Painel lateral com todos os comentários do quadro. */
export function CommentsDrawer({ open, onOpenChange, threads, showResolved, onShowResolved, onPick }: {
  open: boolean; onOpenChange: (v: boolean) => void; threads: CommentThread[]; showResolved: boolean; onShowResolved: (v: boolean) => void; onPick: (t: CommentThread) => void;
}) {
  const list = threads.filter((t) => showResolved || !t.resolvedAt);
  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={`Comentários (${threads.filter((t) => !t.resolvedAt).length})`}>
      <div className="mb-4"><Switch label="Mostrar resolvidos" checked={showResolved} onCheckedChange={onShowResolved} /></div>
      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <MessageSquare className="size-8 text-text-subtle" aria-hidden />
          <p className="text-sm text-text-muted">Nenhum comentário{showResolved ? "" : " aberto"}. Aperte <kbd className="rounded-sm border border-border px-1 font-semibold">C</kbd> e clique no quadro para comentar.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((t) => {
            const first = t.comments[0];
            const last = t.comments[t.comments.length - 1];
            if (!first) return null;
            return (
              <li key={t.id}>
                <button onClick={() => onPick(t)} className={clsx("flex w-full gap-3 rounded-md border border-border p-3 text-left hover:bg-surface-hover", t.resolvedAt && "opacity-60")}>
                  <Avatar person={personOf(first)} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm"><span className="font-semibold">{first.author.name}</span> <span className="text-xs text-text-muted">{when(last.createdAt)}</span></span>
                    <span className="line-clamp-2 block text-sm text-text-muted">{first.body}</span>
                    {t.comments.length > 1 && <span className="mt-1 block text-xs text-text-subtle">{t.comments.length - 1} {t.comments.length === 2 ? "resposta" : "respostas"}</span>}
                  </span>
                  {t.resolvedAt && <Check className="size-4 shrink-0 text-success" aria-label="Resolvido" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
