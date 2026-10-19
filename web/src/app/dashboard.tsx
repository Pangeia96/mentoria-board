"use client";

import { useActionState, useState } from "react";
import { LayoutGrid, LogOut, Plus, Search } from "lucide-react";
import { Button, Field, IconButton, Input, Modal, TooltipProvider } from "@/components/ui/primitives";
import { BoardCard, EmptyState } from "@/components/ui/board";
import type { Board } from "@/lib/data/types";
import { createBoard, logout } from "./actions";

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
function ago(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [[60, "second"], [60, "minute"], [24, "hour"], [30, "day"], [12, "month"]];
  let v = s;
  for (const [n, unit] of steps) {
    if (Math.abs(v) < n) return rtf.format(Math.round(v), unit);
    v /= n;
  }
  return rtf.format(Math.round(v), "year");
}

export function Dashboard({ user, boards, q }: { user: { name: string; email: string }; boards: Board[]; q: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider>
      <header className="flex h-(--mb-header-h) items-center justify-between border-b border-border bg-surface px-4 md:px-8">
        <span className="flex items-center gap-2 text-md font-semibold">
          <LayoutGrid className="size-5 text-accent" aria-hidden /> Mentoria Board
        </span>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-text-muted sm:inline">{user.name}</span>
          <form action={logout}>
            <IconButton label="Sair" size="sm" tooltipSide="bottom" type="submit"><LogOut /></IconButton>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-(--mb-dashboard-max) flex-col gap-6 px-4 py-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Seus quadros</h1>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <form role="search" className="flex-1 sm:w-64">
              <Input name="q" defaultValue={q} leading={<Search />} placeholder="Buscar por quadro ou mentorado" aria-label="Buscar quadros" />
            </form>
            <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Novo quadro</Button>
          </div>
        </div>

        {boards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface">
            {q ? (
              <EmptyState icon={<Search />} title="Nada encontrado">Nenhum quadro com “{q}”. Tente outro nome ou mentorado.</EmptyState>
            ) : (
              <EmptyState icon={<LayoutGrid />} title="Nenhum quadro ainda" action={<Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Criar quadro</Button>}>
                Crie o primeiro quadro para um mentorado e mande o link para ele entrar.
              </EmptyState>
            )}
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {boards.map((b) => (
              <li key={b.id}><BoardCard title={b.title} client={b.clientName ?? undefined} updated={ago(b.updatedAt)} href={`/b/${b.id}`} /></li>
            ))}
          </ul>
        )}
      </main>

      <NewBoardModal open={open} onOpenChange={setOpen} />
    </TooltipProvider>
  );
}

function NewBoardModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [state, action, pending] = useActionState(createBoard, undefined);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Novo quadro" description="Você poderá mandar o link para o mentorado logo depois.">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <Field label="Nome do quadro" error={state?.error}>
          {(p) => <Input id={p.id} name="title" maxLength={120} required autoFocus placeholder="Ex.: Plano de carreira" aria-invalid={p.invalid} aria-describedby={p.describedBy} />}
        </Field>
        <Field label="Mentorado (opcional)" hint="Ajuda a encontrar o quadro depois">
          {(p) => <Input id={p.id} name="clientName" maxLength={120} aria-describedby={p.describedBy} />}
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" loading={pending}>Criar quadro</Button>
        </div>
      </form>
    </Modal>
  );
}
