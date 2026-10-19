"use client";

import type { ReactNode } from "react";
import { Copy, Ellipsis, Link2, Pencil, Trash2 } from "lucide-react";
import clsx from "clsx";
import { IconButton, Menu } from "./primitives";

/* As 8 cores de presença: cursor, avatar e borda de seleção da mesma pessoa. */
export const PRESENCE = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"] as const;
export type PresenceColor = (typeof PRESENCE)[number];
export const presenceVar = (c: PresenceColor) => `var(--mb-presence-${c})`;

export type Person = { id: string; name: string; color: PresenceColor; guest?: boolean };

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

/* ----------------------------------------------------------------- Avatar */
export function Avatar({ person, size = 32, ring, following }: { person: Person; size?: 24 | 32; ring?: boolean; following?: boolean }) {
  return (
    <span
      role="img"
      aria-label={person.guest ? `${person.name} (visitante)` : person.name}
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-presence-on-presence",
        size === 32 ? "size-8 text-xs" : "size-6 text-[10px]",
        ring && "ring-2 ring-offset-2 ring-offset-surface",
        following && "outline-2 outline-dashed outline-offset-3 outline-accent",
      )}
      style={{ background: presenceVar(person.color), ["--tw-ring-color" as string]: presenceVar(person.color) }}
    >
      {initials(person.name)}
      {person.guest && (
        <span aria-hidden className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-surface text-text-muted shadow-sm">
          <Link2 className="size-2.5" />
        </span>
      )}
    </span>
  );
}

export function AvatarStack({ people, max = 4, onClick }: { people: Person[]; max?: number; onClick?: () => void }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <button
      onClick={onClick}
      aria-label={`${people.length} ${people.length === 1 ? "pessoa" : "pessoas"} no quadro. Ver lista`}
      className="flex items-center rounded-full p-0.5 hover:bg-surface-hover"
    >
      {shown.map((p, i) => (
        <span key={p.id} className={clsx("rounded-full ring-2 ring-surface", i > 0 && "-ml-2")}>
          <Avatar person={p} />
        </span>
      ))}
      {extra > 0 && (
        <span className="-ml-2 inline-flex size-8 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-text-muted ring-2 ring-surface">
          +{extra}
        </span>
      )}
    </button>
  );
}

/* ----------------------------------------------------------------- BoardCard */
export function BoardCard({ title, client, updated, href, thumbnail }: { title: string; client?: string; updated: string; href: string; thumbnail?: ReactNode }) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition-shadow duration-(--mb-motion-fast) hover:shadow-md focus-within:shadow-md">
      <a href={href} className="flex flex-col outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-focus">
        <div className="aspect-[16/10] border-b border-border bg-canvas">{thumbnail}</div>
        <div className="flex flex-col gap-0.5 px-3 py-2.5 pr-12">
          <span className="truncate text-sm font-semibold text-text">{title}</span>
          <span className="truncate text-xs text-text-muted">{client ? `${client} · ` : ""}editado {updated}</span>
        </div>
      </a>
      <div className="absolute bottom-2 right-2 z-10">
        <Menu
          trigger={<IconButton label="Opções do quadro" size="sm" tooltipSide="top"><Ellipsis /></IconButton>}
          items={[
            { label: "Renomear", icon: <Pencil /> },
            { label: "Duplicar", icon: <Copy /> },
            "separator",
            { label: "Mover para a lixeira", icon: <Trash2 />, danger: true },
          ]}
        />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- EmptyState */
export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-90 flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent [&_svg]:size-8">{icon}</span>
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      {children && <p className="text-sm text-text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
