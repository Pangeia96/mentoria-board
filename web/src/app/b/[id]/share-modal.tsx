"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2, RefreshCw, UserX } from "lucide-react";
import { Button, Input, Modal, Select, Skeleton, Switch } from "@/components/ui/primitives";
import { Avatar, type PresenceColor } from "@/components/ui/board";
import type { LinkRole } from "@/lib/data/types";
import { getShareState, removeGuest, resetShareLink, updateShare, type ShareState } from "../../board-actions";

const ROLE_OPTIONS: { value: LinkRole; label: string }[] = [
  { value: "editor", label: "Pode editar" },
  { value: "commenter", label: "Pode comentar" },
  { value: "viewer", label: "Só ver" },
];

/** S05: link do quadro, papel de quem entra, pedir nome, visitantes com acesso, gerar link novo. */
export function ShareModal({ boardId, open, onOpenChange, onCopied, onError }: {
  boardId: string; open: boolean; onOpenChange: (v: boolean) => void; onCopied: () => void; onError: (msg: string) => void;
}) {
  const [state, setState] = useState<ShareState | null>(null);
  const [pending, start] = useTransition();
  const [confirmReset, setConfirmReset] = useState(false);

  const run = (fn: () => Promise<{ ok: true; data: ShareState } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) setState(r.data);
      else onError(r.error);
    });

  // carrega sempre que abre (visitantes podem ter entrado desde a última vez)
  useEffect(() => {
    if (open) run(() => getShareState(boardId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, boardId]);

  const copy = async () => {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(state.url);
      onCopied();
    } catch {
      onError("Não deu para copiar. Selecione o link e copie à mão.");
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { setConfirmReset(false); onOpenChange(v); }}
      title="Compartilhar quadro"
      description="Quem abrir o link entra sem criar conta."
      footer={<Button icon={<Link2 className="size-4" />} onClick={copy} disabled={!state}>Copiar link</Button>}
    >
      {!state ? (
        <div className="flex flex-col gap-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /></div>
      ) : (
        <div className="flex flex-col gap-5">
          <Input aria-label="Link do quadro" readOnly value={state.url} onFocus={(e) => e.currentTarget.select()} />

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Quem tem o link</span>
            <Select label="Papel de quem tem o link" value={state.role} options={ROLE_OPTIONS} onValueChange={(v) => run(() => updateShare(boardId, { role: v as LinkRole }))} />
          </div>
          <Switch label="Pedir o nome ao entrar" checked={state.askVisitorName} onCheckedChange={(v) => run(() => updateShare(boardId, { askVisitorName: v }))} />

          <section aria-labelledby="share-guests" className="flex flex-col gap-2">
            <h3 id="share-guests" className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
              Visitantes com acesso ({state.guests.length})
            </h3>
            {state.guests.length === 0 ? (
              <p className="text-sm text-text-muted">Ninguém entrou por este link ainda.</p>
            ) : (
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {state.guests.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 rounded-md px-1 py-1">
                    <Avatar person={{ id: g.id, name: g.name, color: g.color as PresenceColor, guest: true }} size={24} />
                    <span className="flex-1 truncate text-sm">{g.name}</span>
                    <Button size="sm" variant="ghost" icon={<UserX className="size-4" />} disabled={pending} onClick={() => run(() => removeGuest(boardId, g.id))}>
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="rounded-md border border-border p-3">
            {confirmReset ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm">Todo mundo que entrou pelo link atual sai do quadro na hora e precisa do link novo para voltar.</p>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setConfirmReset(false)}>Cancelar</Button>
                  <Button size="sm" variant="danger" loading={pending} onClick={() => { setConfirmReset(false); run(() => resetShareLink(boardId)); }}>Gerar link novo</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-text-muted">O link vazou ou a mentoria acabou?</p>
                <Button size="sm" variant="secondary" icon={<RefreshCw className="size-4" />} onClick={() => setConfirmReset(true)}>Gerar link novo</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
