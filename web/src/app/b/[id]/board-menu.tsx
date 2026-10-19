"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, Pencil, Trash2 } from "lucide-react";
import { Button, Field, Input, Menu, Modal } from "@/components/ui/primitives";
import { duplicateBoardAction, renameBoardAction, trashBoardAction } from "../../board-actions";

/** Abre um modal depois que o menu terminar de devolver o foco ao gatilho (senão o modal perde o foco). */
export const afterMenu = (fn: () => void) => setTimeout(fn, 0);

/** S10: menu do quadro (só o dono). Também usado nos cards do painel. */
export function useBoardOps(boardId: string, onError: (m: string) => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return {
    pending,
    rename: (title: string, done: (t: string) => void) =>
      start(async () => {
        const r = await renameBoardAction(boardId, title);
        if (r.ok) done(r.data);
        else onError(r.error);
      }),
    duplicate: () =>
      start(async () => {
        const r = await duplicateBoardAction(boardId);
        if (r.ok) router.push(`/b/${r.data}`);
        else onError(r.error);
      }),
    trash: (after: () => void) =>
      start(async () => {
        const r = await trashBoardAction(boardId);
        if (r.ok) after();
        else onError(r.error);
      }),
  };
}

export function RenameModal({ open, onOpenChange, initial, pending, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; initial: string; pending: boolean; onSave: (t: string) => void }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  return (
    <Modal open={open} onOpenChange={(v) => { if (v) setValue(initial); setError(undefined); onOpenChange(v); }} title="Renomear quadro">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return setError("Dê um nome ao quadro.");
          onSave(value.trim());
        }}
      >
        <Field label="Nome do quadro" error={error}>
          {(p) => <Input id={p.id} value={value} maxLength={120} autoFocus onChange={(e) => setValue(e.target.value)} aria-invalid={p.invalid} aria-describedby={p.describedBy} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" loading={pending}>Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}

export function TrashModal({ open, onOpenChange, title, pending, onConfirm }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; pending: boolean; onConfirm: () => void }) {
  return (
    <Modal
      size="sm"
      open={open}
      onOpenChange={onOpenChange}
      title="Mover para a lixeira?"
      description={`“${title}” some do painel e quem estiver dentro sai na hora. Ele é apagado de vez em 30 dias.`}
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button variant="danger" loading={pending} onClick={onConfirm}>Mover para a lixeira</Button></>}
    />
  );
}

export function BoardMenu({ boardId, title, onRenamed, onError }: { boardId: string; title: string; onRenamed: (t: string) => void; onError: (m: string) => void }) {
  const router = useRouter();
  const ops = useBoardOps(boardId, onError);
  const [renaming, setRenaming] = useState(false);
  const [trashing, setTrashing] = useState(false);
  return (
    <>
      <Menu
        align="start"
        trigger={
          <button className="flex max-w-64 items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold hover:bg-surface-hover" aria-label={`Opções do quadro ${title}`}>
            <span className="truncate">{title}</span>
            <ChevronDown className="size-4 shrink-0 text-text-muted" aria-hidden />
          </button>
        }
        items={[
          { label: "Renomear", icon: <Pencil />, onSelect: () => afterMenu(() => setRenaming(true)) },
          { label: "Duplicar", icon: <Copy />, onSelect: ops.duplicate },
          "separator",
          { label: "Mover para a lixeira", icon: <Trash2 />, danger: true, onSelect: () => afterMenu(() => setTrashing(true)) },
        ]}
      />
      <RenameModal open={renaming} onOpenChange={setRenaming} initial={title} pending={ops.pending} onSave={(t) => ops.rename(t, (saved) => { onRenamed(saved); setRenaming(false); })} />
      <TrashModal open={trashing} onOpenChange={setTrashing} title={title} pending={ops.pending} onConfirm={() => ops.trash(() => router.push("/"))} />
    </>
  );
}
