"use client";

import type { ReactNode } from "react";
import { Popover } from "radix-ui";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowRight, ArrowUpToLine, Bold, Check, Circle, Copy, CornerDownRight, Diamond,
  Eraser, Italic, Layers, Lock, LockOpen, Minus, MoveRight, Pencil, Spline, Square, Trash2, Triangle, Type, Underline,
} from "lucide-react";
import clsx from "clsx";
import { IconButton, Menu } from "@/components/ui/primitives";
import { Bar, Sep } from "@/components/ui/canvas-chrome";
import { FILL_COLORS, INK_COLORS, STICKY_HEX, type Item, type ItemPatch, type ShapeKind } from "./model";

/* ----------------------------------------------------------------- amostras de cor */
type Swatch = { id: string; label: string; hex: string };

function SwatchButton({ label, value, swatches, onChange, ring }: { label: string; value: string; swatches: Swatch[]; onChange: (id: string) => void; ring?: boolean }) {
  const current = swatches.find((s) => s.id === value);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton label={label} size="sm" tooltipSide="top">
          <span
            className={clsx("size-4.5 rounded-full border border-border", ring && "bg-transparent")}
            style={ring ? { boxShadow: `inset 0 0 0 3px ${current?.hex ?? "transparent"}` } : { background: current?.hex === "transparent" ? undefined : current?.hex }}
          >
            {current?.hex === "transparent" && <span className="block h-full w-full rounded-full bg-[linear-gradient(135deg,transparent_45%,var(--mb-danger)_45%,var(--mb-danger)_55%,transparent_55%)]" />}
          </span>
        </IconButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} className="z-50 rounded-md bg-surface p-2 shadow-lg">
          <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2 p-1">
            {swatches.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={value === s.id}
                aria-label={s.label}
                title={s.label}
                onClick={() => onChange(s.id)}
                className={clsx("flex size-6 items-center justify-center rounded-full border border-border transition-transform hover:scale-110", value === s.id && "ring-2 ring-focus ring-offset-2 ring-offset-surface")}
                style={{ background: s.hex === "transparent" ? undefined : s.hex }}
              >
                {s.hex === "transparent" ? <Minus className="size-3.5 rotate-45 text-danger" /> : value === s.id && <Check className="size-3.5 text-surface mix-blend-difference" />}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const STICKY_SWATCHES: Swatch[] = (["yellow", "orange", "pink", "violet", "blue", "teal", "green", "gray"] as const).map((c) => ({
  id: c, hex: STICKY_HEX[c], label: { yellow: "Amarelo", orange: "Laranja", pink: "Rosa", violet: "Lilás", blue: "Azul", teal: "Verde-água", green: "Verde", gray: "Cinza" }[c],
}));
const STROKE_SWATCHES: Swatch[] = [{ id: "none", label: "Sem borda", hex: "transparent" }, ...INK_COLORS];

function Toggle({ label, pressed, onClick, children, shortcut }: { label: string; pressed?: boolean; onClick: () => void; children: ReactNode; shortcut?: string }) {
  return <IconButton label={label} shortcut={shortcut} size="sm" tooltipSide="top" pressed={pressed} onClick={onClick}>{children}</IconButton>;
}

function WidthMenu({ value, options, onChange, label }: { value: number; options: number[]; onChange: (v: number) => void; label: string }) {
  return (
    <Menu
      align="start"
      trigger={<button aria-label={`${label}: ${value}`} className="h-8 min-w-10 rounded-md px-2 text-xs font-semibold tabular-nums text-text hover:bg-surface-hover">{value}px</button>}
      items={options.map((o) => ({ label: `${o}px${o === value ? " ✓" : ""}`, onSelect: () => onChange(o) }))}
    />
  );
}

/* ----------------------------------------------------------------- barra contextual */
export function ContextBar({ items, onPatch, onDuplicate, onDelete, onReorder, onEditText }: {
  items: Item[];
  onPatch: (patch: ItemPatch) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (dir: 1 | -1) => void;
  onEditText?: () => void;
}) {
  const one = items.length === 1 ? items[0] : null;
  const locked = items.every((i) => i.locked);
  const type = items.every((i) => i.type === items[0].type) ? items[0].type : null;
  const first = items[0];

  return (
    <Bar label="Opções do objeto selecionado">
      {!locked && type === "sticky" && first.type === "sticky" && (
        <SwatchButton label="Cor" value={first.color} swatches={STICKY_SWATCHES} onChange={(c) => onPatch({ color: c })} />
      )}

      {!locked && type === "shape" && first.type === "shape" && (
        <>
          {([["rect", "Retângulo", <Square key="r" />], ["ellipse", "Círculo", <Circle key="e" />], ["triangle", "Triângulo", <Triangle key="t" />], ["diamond", "Losango", <Diamond key="d" />]] as [ShapeKind, string, ReactNode][]).map(([k, label, icon]) => (
            <Toggle key={k} label={label} pressed={items.every((i) => i.type === "shape" && i.shape === k)} onClick={() => onPatch({ shape: k })}>{icon}</Toggle>
          ))}
          <Sep />
          <SwatchButton label="Preenchimento" value={first.fill} swatches={FILL_COLORS} onChange={(c) => onPatch({ fill: c })} />
          <SwatchButton label="Borda" value={first.stroke} swatches={STROKE_SWATCHES} onChange={(c) => onPatch({ stroke: c })} ring />
          <WidthMenu label="Espessura da borda" value={first.strokeWidth} options={[1, 2, 4, 6]} onChange={(v) => onPatch({ strokeWidth: v })} />
        </>
      )}

      {!locked && type === "text" && first.type === "text" && (
        <>
          <SwatchButton label="Cor do texto" value={first.color} swatches={INK_COLORS} onChange={(c) => onPatch({ color: c })} />
          <Menu
            align="start"
            trigger={<button aria-label={`Tamanho do texto: ${first.fontSize}`} className="h-8 min-w-10 rounded-md px-2 text-xs font-semibold tabular-nums text-text hover:bg-surface-hover">{first.fontSize}</button>}
            items={[14, 18, 24, 32, 48, 64].map((s) => ({ label: `${s}${s === first.fontSize ? " ✓" : ""}`, onSelect: () => onPatch({ fontSize: s }) }))}
          />
          <Toggle label="Negrito" shortcut="Ctrl+B" pressed={first.bold} onClick={() => onPatch({ bold: !first.bold })}><Bold /></Toggle>
          <Toggle label="Itálico" shortcut="Ctrl+I" pressed={first.italic} onClick={() => onPatch({ italic: !first.italic })}><Italic /></Toggle>
          <Toggle label="Sublinhado" shortcut="Ctrl+U" pressed={first.underline} onClick={() => onPatch({ underline: !first.underline })}><Underline /></Toggle>
          <Toggle label="Alinhar à esquerda" pressed={first.align === "left"} onClick={() => onPatch({ align: "left" })}><AlignLeft /></Toggle>
          <Toggle label="Centralizar" pressed={first.align === "center"} onClick={() => onPatch({ align: "center" })}><AlignCenter /></Toggle>
          <Toggle label="Alinhar à direita" pressed={first.align === "right"} onClick={() => onPatch({ align: "right" })}><AlignRight /></Toggle>
        </>
      )}

      {!locked && type === "connector" && first.type === "connector" && (
        <>
          <Toggle label="Reta" pressed={first.path === "straight"} onClick={() => onPatch({ path: "straight" })}><MoveRight /></Toggle>
          <Toggle label="Cotovelo" pressed={first.path === "elbow"} onClick={() => onPatch({ path: "elbow" })}><CornerDownRight /></Toggle>
          <Toggle label="Curva" pressed={first.path === "curved"} onClick={() => onPatch({ path: "curved" })}><Spline /></Toggle>
          <Sep />
          <Toggle label="Seta no início" pressed={first.startCap === "arrow"} onClick={() => onPatch({ startCap: first.startCap === "arrow" ? "none" : "arrow" })}><ArrowRight className="rotate-180" /></Toggle>
          <Toggle label="Seta no fim" pressed={first.endCap === "arrow"} onClick={() => onPatch({ endCap: first.endCap === "arrow" ? "none" : "arrow" })}><ArrowRight /></Toggle>
          <SwatchButton label="Cor da seta" value={first.color} swatches={INK_COLORS} onChange={(c) => onPatch({ color: c })} />
          <WidthMenu label="Espessura" value={first.width} options={[1, 2, 3, 5]} onChange={(v) => onPatch({ width: v })} />
        </>
      )}

      {!locked && type === "stroke" && first.type === "stroke" && (
        <>
          <SwatchButton label="Cor do traço" value={first.color} swatches={INK_COLORS} onChange={(c) => onPatch({ color: c })} />
          <WidthMenu label="Espessura" value={first.width} options={[2, 4, 8, 12]} onChange={(v) => onPatch({ width: v })} />
        </>
      )}

      {!locked && one && onEditText && (one.type === "shape" || one.type === "text" || one.type === "sticky" || one.type === "connector") && (
        <Toggle label={one.type === "connector" ? "Rótulo da seta" : "Editar texto"} shortcut="Enter" onClick={onEditText}><Type /></Toggle>
      )}

      {type && !locked && <Sep />}
      <Toggle label={locked ? "Destravar" : "Travar"} shortcut="Ctrl+Shift+L" pressed={locked} onClick={() => onPatch({ locked: !locked })}>{locked ? <LockOpen /> : <Lock />}</Toggle>
      {!locked && (
        <>
          <Menu
            align="start"
            trigger={<IconButton label="Ordem" size="sm" tooltipSide="top"><Layers /></IconButton>}
            items={[
              { label: "Trazer para a frente", icon: <ArrowUpToLine />, shortcut: "PgUp", onSelect: () => onReorder(1) },
              { label: "Enviar para trás", icon: <ArrowDownToLine />, shortcut: "PgDn", onSelect: () => onReorder(-1) },
            ]}
          />
          <Toggle label="Duplicar" shortcut="Ctrl+D" onClick={onDuplicate}><Copy /></Toggle>
          <IconButton label="Apagar" shortcut="Del" size="sm" tooltipSide="top" className="hover:text-danger" onClick={onDelete}><Trash2 /></IconButton>
        </>
      )}
    </Bar>
  );
}

/* ----------------------------------------------------------------- submenu de forma / caneta ao lado da barra de ferramentas */
export function ShapeFlyout({ value, onChange }: { value: ShapeKind; onChange: (k: ShapeKind) => void }) {
  return (
    <Bar label="Tipo de forma">
      <Toggle label="Retângulo" shortcut="R" pressed={value === "rect"} onClick={() => onChange("rect")}><Square /></Toggle>
      <Toggle label="Círculo" shortcut="O" pressed={value === "ellipse"} onClick={() => onChange("ellipse")}><Circle /></Toggle>
      <Toggle label="Triângulo" pressed={value === "triangle"} onClick={() => onChange("triangle")}><Triangle /></Toggle>
      <Toggle label="Losango" pressed={value === "diamond"} onClick={() => onChange("diamond")}><Diamond /></Toggle>
    </Bar>
  );
}

export function PenFlyout({ mode, color, width, onMode, onColor, onWidth }: {
  mode: "draw" | "erase"; color: string; width: number; onMode: (m: "draw" | "erase") => void; onColor: (c: string) => void; onWidth: (w: number) => void;
}) {
  return (
    <Bar label="Caneta">
      <Toggle label="Desenhar" shortcut="P" pressed={mode === "draw"} onClick={() => onMode("draw")}><Pencil /></Toggle>
      <Toggle label="Borracha" shortcut="E" pressed={mode === "erase"} onClick={() => onMode("erase")}><Eraser /></Toggle>
      <Sep />
      <SwatchButton label="Cor da caneta" value={color} swatches={INK_COLORS} onChange={onColor} />
      <WidthMenu label="Espessura" value={width} options={[2, 4, 8, 12]} onChange={onWidth} />
    </Bar>
  );
}
