"use client";

import { useState, type ReactNode } from "react";
import {
  AlignCenter, AlignLeft, ArrowDownToLine, ArrowUpToLine, Bold, Check, Circle, Copy, Diamond, Eraser, Frame, Hand, ImageIcon,
  Italic, Layers, Lock, Map as MapIcon, MessageSquare, Minus, MousePointer2, MoveUpRight, Pencil, Plus, Redo2, Square,
  StickyNote, Trash2, Triangle, Type, Underline, Undo2, WifiOff,
} from "lucide-react";
import { Popover } from "radix-ui";
import clsx from "clsx";
import { Button, IconButton, Menu, Spinner, Textarea } from "./primitives";
import { Avatar, AvatarStack, presenceVar, type Person } from "./board";

/* ----------------------------------------------------------------- Barra genérica flutuante */
export function Bar({ children, vertical, className, label }: { children: ReactNode; vertical?: boolean; className?: string; label: string }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={clsx("flex gap-1 rounded-lg bg-surface p-1 shadow-md", vertical ? "flex-col" : "items-center", className)}
    >
      {children}
    </div>
  );
}
export const Sep = ({ vertical }: { vertical?: boolean }) => (
  <span aria-hidden className={clsx("bg-border", vertical ? "mx-1.5 h-px" : "mx-0.5 h-6 w-px")} />
);

/* ----------------------------------------------------------------- CreationToolbar */
export type Tool = "select" | "hand" | "sticky" | "shape" | "text" | "connector" | "pen" | "frame" | "comment" | "image";

const TOOLS: { id: Tool; label: string; key: string; icon: ReactNode; edit: boolean }[] = [
  { id: "select", label: "Selecionar", key: "V", icon: <MousePointer2 />, edit: false },
  { id: "hand", label: "Mover o quadro", key: "H", icon: <Hand />, edit: false },
  { id: "sticky", label: "Sticky", key: "N", icon: <StickyNote />, edit: true },
  { id: "shape", label: "Forma", key: "S", icon: <Square />, edit: true },
  { id: "text", label: "Texto", key: "T", icon: <Type />, edit: true },
  { id: "connector", label: "Seta", key: "L", icon: <MoveUpRight />, edit: true },
  { id: "pen", label: "Caneta", key: "P", icon: <Pencil />, edit: true },
  { id: "frame", label: "Frame", key: "F", icon: <Frame />, edit: true },
  { id: "image", label: "Imagem", key: "I", icon: <ImageIcon />, edit: true },
  { id: "comment", label: "Comentário", key: "C", icon: <MessageSquare />, edit: false },
];

export function CreationToolbar({ tool, onTool, canEdit = true, tools, onUndo, onRedo, canUndo = true, canRedo = true }: {
  tool: Tool; onTool: (t: Tool) => void; canEdit?: boolean; tools?: Tool[];
  onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean;
}) {
  return (
    <Bar vertical label="Ferramentas">
      {TOOLS.filter((t) => (canEdit || !t.edit) && (!tools || tools.includes(t.id))).map((t) => (
        <IconButton key={t.id} label={t.label} shortcut={t.key} pressed={tool === t.id} onClick={() => onTool(t.id)}>
          {t.icon}
        </IconButton>
      ))}
      {canEdit && (
        <>
          <Sep vertical />
          <IconButton label="Desfazer" shortcut="Ctrl+Z" onClick={onUndo} disabled={!canUndo}><Undo2 /></IconButton>
          <IconButton label="Refazer" shortcut="Ctrl+Shift+Z" onClick={onRedo} disabled={!canRedo}><Redo2 /></IconButton>
        </>
      )}
    </Bar>
  );
}

/* ----------------------------------------------------------------- ColorPicker */
export const STICKY_COLORS = ["yellow", "orange", "pink", "violet", "blue", "teal", "green", "gray"] as const;
const STICKY_NAMES: Record<(typeof STICKY_COLORS)[number], string> = {
  yellow: "Amarelo", orange: "Laranja", pink: "Rosa", violet: "Lilás", blue: "Azul", teal: "Verde-água", green: "Verde", gray: "Cinza",
};

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: (typeof STICKY_COLORS)[number]) => void }) {
  return (
    <div role="radiogroup" aria-label="Cor" className="grid grid-cols-4 gap-2 p-1">
      {STICKY_COLORS.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={value === c}
          aria-label={STICKY_NAMES[c]}
          onClick={() => onChange(c)}
          className={clsx(
            "flex size-6 items-center justify-center rounded-full border border-border transition-transform hover:scale-110",
            value === c && "ring-2 ring-focus ring-offset-2 ring-offset-surface",
          )}
          style={{ background: `var(--mb-sticky-${c})` }}
        >
          {value === c && <Check className="size-3.5 text-sticky-ink" />}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- ContextToolbar */
export type SelectionKind = "sticky" | "shape" | "text" | "connector" | "pen" | "multi";

export function ContextToolbar({ kind, color, onColor }: { kind: SelectionKind; color: string; onColor: (c: (typeof STICKY_COLORS)[number]) => void }) {
  const [bold, setBold] = useState(false);
  return (
    <Bar label="Opções do objeto selecionado">
      {(kind === "sticky" || kind === "shape") && (
        <Popover.Root>
          <Popover.Trigger asChild>
            <IconButton label="Cor" size="sm" tooltipSide="top">
              <span className="size-4.5 rounded-full border border-border" style={{ background: `var(--mb-sticky-${color})` }} />
            </IconButton>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={8} className="z-50 rounded-md bg-surface p-2 shadow-lg">
              <ColorPicker value={color} onChange={onColor} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
      {kind === "shape" && (
        <>
          <IconButton label="Retângulo" shortcut="R" size="sm" tooltipSide="top" pressed><Square /></IconButton>
          <IconButton label="Círculo" shortcut="O" size="sm" tooltipSide="top"><Circle /></IconButton>
          <IconButton label="Triângulo" size="sm" tooltipSide="top"><Triangle /></IconButton>
          <IconButton label="Losango" size="sm" tooltipSide="top"><Diamond /></IconButton>
        </>
      )}
      {(kind === "sticky" || kind === "text" || kind === "shape") && (
        <>
          <Sep />
          <IconButton label="Negrito" shortcut="Ctrl+B" size="sm" tooltipSide="top" pressed={bold} onClick={() => setBold(!bold)}><Bold /></IconButton>
          <IconButton label="Itálico" shortcut="Ctrl+I" size="sm" tooltipSide="top"><Italic /></IconButton>
          <IconButton label="Sublinhado" shortcut="Ctrl+U" size="sm" tooltipSide="top"><Underline /></IconButton>
          <IconButton label="Alinhar à esquerda" size="sm" tooltipSide="top"><AlignLeft /></IconButton>
          <IconButton label="Centralizar" size="sm" tooltipSide="top" pressed><AlignCenter /></IconButton>
        </>
      )}
      {kind === "pen" && <IconButton label="Borracha" size="sm" tooltipSide="top"><Eraser /></IconButton>}
      <Sep />
      <IconButton label="Travar" size="sm" tooltipSide="top"><Lock /></IconButton>
      <Menu
        align="start"
        trigger={<IconButton label="Ordem" size="sm" tooltipSide="top"><Layers /></IconButton>}
        items={[
          { label: "Trazer para a frente", icon: <ArrowUpToLine />, shortcut: "PgUp" },
          { label: "Enviar para trás", icon: <ArrowDownToLine />, shortcut: "PgDn" },
        ]}
      />
      <IconButton label="Duplicar" shortcut="Ctrl+D" size="sm" tooltipSide="top"><Copy /></IconButton>
      <IconButton label="Apagar" shortcut="Del" size="sm" tooltipSide="top" className="hover:text-danger"><Trash2 /></IconButton>
    </Bar>
  );
}

/* ----------------------------------------------------------------- PeopleBar */
export function PeopleBar({ people, onOpenPeople, onShare, following, onStopFollowing }: {
  people: Person[]; onOpenPeople?: () => void; onShare?: () => void; following?: Person; onStopFollowing?: () => void;
}) {
  return (
    <div className="flex flex-col items-end gap-2">
      <Bar label="Pessoas e compartilhamento" className="gap-2 pl-2">
        <AvatarStack people={people} onClick={onOpenPeople} />
        {onShare && <Button size="sm" onClick={onShare}>Compartilhar</Button>}
      </Bar>
      {following && (
        <div className="flex items-center gap-2 rounded-full py-1 pl-3 pr-1 text-xs font-semibold text-presence-on-presence shadow-md" style={{ background: presenceVar(following.color) }}>
          Seguindo {following.name}
          <button onClick={onStopFollowing} className="rounded-full bg-surface px-2 py-0.5 text-text hover:bg-surface-hover">Parar</button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- ZoomControl */
export function ZoomControl({ zoom, onZoom, minimap, onMinimap, onFit }: { zoom: number; onZoom: (z: number) => void; minimap?: boolean; onMinimap?: () => void; onFit?: () => void }) {
  const clamp = (z: number) => Math.min(4, Math.max(0.1, Math.round(z * 10) / 10));
  return (
    <Bar label="Zoom">
      {onMinimap && (
        <>
          <IconButton label="Mapa do quadro" shortcut="M" size="sm" tooltipSide="top" pressed={minimap} onClick={onMinimap}><MapIcon /></IconButton>
          <Sep />
        </>
      )}
      <IconButton label="Diminuir zoom" shortcut="Ctrl+−" size="sm" tooltipSide="top" onClick={() => onZoom(clamp(zoom - 0.1))}><Minus /></IconButton>
      <Menu
        trigger={
          <button aria-label={`Zoom ${Math.round(zoom * 100)}%, abrir opções`} className="h-8 min-w-14 rounded-md px-1 text-xs font-semibold tabular-nums text-text hover:bg-surface-hover">
            {Math.round(zoom * 100)}%
          </button>
        }
        items={[
          { label: "Ajustar à tela", shortcut: "Alt+1", onSelect: () => (onFit ? onFit() : onZoom(0.6)) },
          { label: "Zoom 100%", shortcut: "Ctrl+0", onSelect: () => onZoom(1) },
                  ]}
      />
      <IconButton label="Aumentar zoom" shortcut="Ctrl+=" size="sm" tooltipSide="top" onClick={() => onZoom(clamp(zoom + 0.1))}><Plus /></IconButton>
    </Bar>
  );
}

/* ----------------------------------------------------------------- RemoteCursor */
export function RemoteCursor({ person, x, y, idle }: { person: Person; x: number; y: number; idle?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute z-10" style={{ left: x, top: y, transition: "left 80ms linear, top 80ms linear" }}>
      <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow-sm">
        <path d="M2 1.5 L16 8 L9.5 9.5 L7 16 Z" fill={presenceVar(person.color)} stroke="var(--mb-surface)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {!idle && (
        <span className="absolute left-4 top-4 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold text-presence-on-presence shadow-sm" style={{ background: presenceVar(person.color) }}>
          {person.name}
        </span>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- ConnectionBanner */
export function ConnectionBanner({ state }: { state: "reconnecting" | "offline" | "synced" }) {
  const conf = {
    reconnecting: { cls: "bg-warning-soft text-warning", icon: <Spinner />, text: "Reconectando…" },
    offline: { cls: "bg-danger-soft text-danger", icon: <WifiOff className="size-4" />, text: "Sem conexão. Suas edições ficam salvas aqui e sincronizam quando voltar." },
    synced: { cls: "bg-success-soft text-success", icon: <Check className="size-4" />, text: "Tudo sincronizado" },
  }[state];
  return (
    <div role="status" aria-live="polite" className={clsx("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm", conf.cls)}>
      {conf.icon}
      {conf.text}
    </div>
  );
}

/* ----------------------------------------------------------------- CommentPin + CommentThread */
export type CommentMsg = { id: string; author: Person; at: string; body: string };

export function CommentPin({ author, count, thread, onSend }: { author: Person; count: number; thread: CommentMsg[]; onSend?: (body: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Comentário de ${author.name}, ${count} ${count === 1 ? "mensagem" : "mensagens"}`}
        className="rounded-full rounded-bl-none bg-surface p-0.5 shadow-md transition-transform hover:scale-105"
      >
        <Avatar person={author} size={24} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="right" align="start" sideOffset={8} className="z-50 flex w-80 flex-col gap-3 rounded-lg bg-surface p-3 shadow-lg">
          <ul className="flex flex-col gap-3">
            {thread.map((m) => (
              <li key={m.id} className="flex gap-2">
                <Avatar person={m.author} size={24} />
                <div className="min-w-0">
                  <p className="text-sm"><span className="font-semibold">{m.author.name}</span> <span className="text-xs text-text-muted">{m.at}</span></p>
                  <p className="text-sm text-text">{m.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <Textarea
            aria-label="Responder"
            placeholder="Responder… (Ctrl+Enter envia)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && draft.trim()) { onSend?.(draft.trim()); setDraft(""); }
            }}
            className="min-h-16"
          />
          <div className="flex justify-between">
            <Button variant="ghost" size="sm" icon={<Check className="size-4" />}>Resolver</Button>
            <Button size="sm" disabled={!draft.trim()} onClick={() => { onSend?.(draft.trim()); setDraft(""); }}>Enviar</Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ----------------------------------------------------------------- Sticky + SelectionBox (visual de referência para o Konva) */
export function StickyPreview({ color, text, selectedBy, locked }: { color: string; text: string; selectedBy?: Person | "me"; locked?: boolean }) {
  const border = selectedBy === "me" ? "var(--mb-selection)" : selectedBy ? presenceVar(selectedBy.color) : undefined;
  return (
    <div className="relative">
      <div
        className="flex size-36 items-center justify-center p-3 text-center text-sm font-medium text-sticky-ink shadow-sticky"
        style={{ background: `var(--mb-sticky-${color})`, outline: border ? `1.5px solid ${border}` : undefined, outlineOffset: 3 }}
      >
        {text}
      </div>
      {selectedBy === "me" && !locked &&
        ["-left-2 -top-2", "-right-2 -top-2", "-left-2 -bottom-2", "-right-2 -bottom-2"].map((pos) => (
          <span key={pos} aria-hidden className={clsx("absolute size-2 rounded-xs border-[1.5px] border-selection bg-surface", pos)} />
        ))}
      {selectedBy && selectedBy !== "me" && (
        <span className="absolute -top-6 left-0 rounded-sm px-1.5 text-xs font-semibold text-presence-on-presence" style={{ background: presenceVar(selectedBy.color) }}>
          {selectedBy.name}
        </span>
      )}
      {locked && (
        <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-surface text-text-muted shadow-sm">
          <Lock className="size-3" />
        </span>
      )}
    </div>
  );
}
