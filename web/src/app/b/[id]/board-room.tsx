"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Layer, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Trash2 } from "lucide-react";
import { Popover } from "radix-ui";
import { IconButton, Toaster, TooltipProvider, type ToastData } from "@/components/ui/primitives";
import { type Person, type PresenceColor } from "@/components/ui/board";
import {
  Bar, ColorPicker, ConnectionBanner, CreationToolbar, PeopleBar, RemoteCursor, Sep, ZoomControl, type Tool,
} from "@/components/ui/canvas-chrome";
import type { Actor } from "@/lib/auth";
import * as tk from "@/styles/tokens";
import { inter } from "@/styles/fonts";
import { useBoardDoc, type Item, type StickyItem } from "./use-board-doc";
import { ShareModal } from "./share-modal";

export type RoomProps = { board: { id: string; title: string }; me: Actor; token: string; wsUrl: string };

type View = { x: number; y: number; scale: number };
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const M1_TOOLS: Tool[] = ["select", "hand", "sticky"];

/* Konva desenha em <canvas> e não entende var(--x): usa os mesmos tokens gerados em TS. */
const T = {
  sticky: tk.sticky as Record<string, string>,
  presence: tk.presence as Record<string, string>,
  ink: tk.sticky.ink,
  selection: tk.color.selection,
  surface: tk.color.surface,
  font: inter.style.fontFamily,
};
type Tokens = typeof T;

const fontSizeFor = (text: string) => (text.length < 40 ? 20 : text.length < 100 ? 16 : text.length < 220 ? 13 : 11);

export function BoardRoom({ board, me, token, wsUrl }: RoomProps) {
  const t = T;
  const canEdit = me.role === "owner" || me.role === "editor";
  const router = useRouter();
  const { items, synced, conn, justSynced, authError, peers, actions, canUndo, canRedo } = useBoardDoc({ boardId: board.id, token, wsUrl, me });

  const wrap = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [tool, setTool] = useState<Tool>("select");
  const [space, setSpace] = useState(false);
  const [selectedRaw, setSelected] = useState<string | null>(null);
  const [editingRaw, setEditing] = useState<string | null>(null);
  const [lastColor, setLastColor] = useState<string>("yellow");
  const [shareOpen, setShareOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toast = useCallback((kind: ToastData["kind"], title: string) => setToasts((x) => [...x, { id: Date.now() + Math.random(), kind, title }]), []);

  /* tamanho do palco = janela */
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* seleção/edição somem sozinhas se outra pessoa apagar o item */
  const selectedItem = items.find((i) => i.id === selectedRaw) ?? null;
  const selected = selectedItem ? selectedRaw : null;
  const editing = editingRaw && items.some((i) => i.id === editingRaw) ? editingRaw : null;
  useEffect(() => actions.setSelection(selected ? [selected] : []), [selected, actions]);

  const toWorld = useCallback((sx: number, sy: number) => ({ x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale }), [view]);
  const toScreen = useCallback((wx: number, wy: number) => ({ x: wx * view.scale + view.x, y: wy * view.scale + view.y }), [view]);

  const zoomAt = useCallback((next: number, cx: number, cy: number) => {
    setView((v) => {
      const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      const wx = (cx - v.x) / v.scale;
      const wy = (cy - v.y) / v.scale;
      return { scale, x: cx - wx * scale, y: cy - wy * scale };
    });
  }, []);

  const fit = useCallback(() => {
    if (!items.length || !size.w) return setView({ x: size.w / 2 - 100, y: size.h / 2 - 100, scale: 1 });
    const minX = Math.min(...items.map((i) => i.x)), minY = Math.min(...items.map((i) => i.y));
    const maxX = Math.max(...items.map((i) => i.x + i.w)), maxY = Math.max(...items.map((i) => i.y + i.h));
    const pad = Math.min(120, size.w * 0.08);
    const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((size.w - pad * 2) / (maxX - minX), (size.h - pad * 2) / (maxY - minY), 1.5)));
    setView({ scale, x: size.w / 2 - ((minX + maxX) / 2) * scale, y: size.h / 2 - ((minY + maxY) / 2) * scale });
  }, [items, size]);

  /* redesenha quando a fonte terminar de carregar (o Konva mede o texto ao desenhar) */
  useEffect(() => {
    document.fonts?.ready.then(() => stageRef.current?.batchDraw());
  }, []);

  /* centraliza o conteúdo na primeira sincronização */
  const didFit = useRef(false);
  useEffect(() => {
    if (synced && size.w && !didFit.current) { didFit.current = true; fit(); }
  }, [synced, size.w, fit]);

  const createStickyAt = useCallback((world: { x: number; y: number }) => {
    const id = actions.addSticky({ x: Math.round(world.x - 100), y: Math.round(world.y - 100) }, lastColor);
    setSelected(id);
    setEditing(id);
    setTool("select");
  }, [actions, lastColor]);

  /* atalhos */
  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.code === "Space" && !e.repeat) { setSpace(true); e.preventDefault(); return; }
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (canEdit) { if (e.shiftKey) actions.redo(); else actions.undo(); } return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); if (canEdit) actions.redo(); return; }
      if (mod && e.key === "0") { e.preventDefault(); zoomAt(1, size.w / 2, size.h / 2); return; }
      if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomAt(view.scale * 1.2, size.w / 2, size.h / 2); return; }
      if (mod && e.key === "-") { e.preventDefault(); zoomAt(view.scale / 1.2, size.w / 2, size.h / 2); return; }
      if (e.altKey && e.key === "1") { e.preventDefault(); fit(); return; }
      if (mod) return;
      const k = e.key.toLowerCase();
      if (k === "v") setTool("select");
      else if (k === "h") setTool("hand");
      else if (k === "n" && canEdit) setTool("sticky");
      else if (k === "escape") { setSelected(null); setTool("select"); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selected && canEdit) { actions.remove([selected]); setSelected(null); }
      else if (e.key === "Enter" && selected && canEdit) { e.preventDefault(); setEditing(selected); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpace(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [actions, canEdit, selected, fit, zoomAt, view.scale, size]);

  /* zoom com Ctrl+roda / pinça; roda sozinha faz pan */
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const st = stageRef.current;
    const p = st?.getPointerPosition();
    if (!p) return;
    if (e.evt.ctrlKey || e.evt.metaKey) zoomAt(view.scale * Math.exp(-e.evt.deltaY * 0.0025), p.x, p.y);
    else setView((v) => ({ ...v, x: v.x - e.evt.deltaX, y: v.y - e.evt.deltaY }));
  };

  /* cursor ao vivo (throttle por frame) */
  const rafRef = useRef(0);
  const onPointerMove = () => {
    const p = stageRef.current?.getPointerPosition();
    if (!p) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const w = toWorld(p.x, p.y);
      actions.setCursor({ x: Math.round(w.x), y: Math.round(w.y) });
    });
  };

  const panning = tool === "hand" || space;

  const onStageDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target !== e.target.getStage()) return; // clique em item
    if (panning) return;
    setEditing(null);
    if (tool === "sticky" && canEdit) {
      e.evt.preventDefault(); // senão o mousedown tira o foco do editor que acabou de abrir
      const p = stageRef.current?.getPointerPosition();
      if (p) createStickyAt(toWorld(p.x, p.y));
      return;
    }
    setSelected(null);
  };

  const peopleForBar: Person[] = useMemo(() => {
    const seen = new Map<string, Person>();
    seen.set(me.id, { id: me.id, name: `${me.name} (você)`, color: me.color as PresenceColor, guest: me.kind === "guest" });
    peers.forEach((p) => { if (!seen.has(p.user.id)) seen.set(p.user.id, { id: p.user.id, name: p.user.name, color: p.user.color as PresenceColor, guest: p.user.kind === "guest" }); });
    return [...seen.values()];
  }, [peers, me]);

  /* quem (outra pessoa) está com cada item selecionado */
  const remoteSel = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    peers.forEach((p) => p.selection?.forEach((id) => m.set(id, { name: p.user.name, color: t.presence[p.user.color] ?? t.selection })));
    return m;
  }, [peers, t]);

  if (authError) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center">
        <div className="max-w-100 rounded-lg border border-border bg-surface p-8">
          <h1 className="text-lg font-semibold">Não foi possível abrir o quadro</h1>
          <p className="mt-2 text-sm text-text-muted">Seu acesso expirou ou foi removido. Recarregue a página; se continuar, peça um link novo.</p>
        </div>
      </main>
    );
  }

  const gridSize = 24 * view.scale;
  const cursorStyle = panning ? "grab" : tool === "sticky" ? "crosshair" : "default";
  const editingItem = items.find((i) => i.id === editing) ?? null;

  return (
    <TooltipProvider>
      <div
        ref={wrap}
        className="fixed inset-0 overflow-hidden bg-canvas"
        style={{
          cursor: cursorStyle,
          backgroundImage: view.scale >= 0.3 ? "radial-gradient(var(--mb-canvas-grid) 1px, transparent 1px)" : undefined,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <h1 className="sr-only">{board.title}</h1>
        {size.w > 0 && (
          <Stage
            ref={stageRef}
            width={size.w}
            height={size.h}
            x={view.x}
            y={view.y}
            scaleX={view.scale}
            scaleY={view.scale}
            draggable={panning}
            onDragEnd={(e) => { if (e.target === e.target.getStage()) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() })); }}
            onDragMove={(e) => { if (e.target === e.target.getStage()) setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() })); }}
            onWheel={onWheel}
            onMouseDown={onStageDown}
            onTouchStart={onStageDown}
            onMouseMove={onPointerMove}
            onMouseLeave={() => actions.setCursor(null)}
            role="application"
            aria-label={`Quadro ${board.title}`}
          >
            <Layer>
              {items.map((it) => (
                <Sticky
                  key={it.id}
                  item={it}
                  t={t}
                  draggable={canEdit && !panning && editing !== it.id}
                  selected={selected === it.id}
                  remote={remoteSel.get(it.id)}
                  hideText={editing === it.id}
                  onSelect={() => { if (!panning) setSelected(it.id); }}
                  onEdit={() => { if (canEdit) { setSelected(it.id); setEditing(it.id); } }}
                  onMove={(x, y) => actions.update(it.id, { x: Math.round(x), y: Math.round(y) })}
                  onMoveEnd={() => actions.stopCapturing()}
                />
              ))}
            </Layer>
          </Stage>
        )}

        {/* cursores das outras pessoas */}
        {peers.map((p) => {
          if (!p.cursor) return null;
          const s = toScreen(p.cursor.x, p.cursor.y);
          return <RemoteCursor key={p.clientId} person={{ id: p.user.id, name: p.user.name, color: p.user.color as PresenceColor }} x={s.x} y={s.y} />;
        })}

        {/* edição de texto do sticky */}
        {editingItem && (
          <StickyEditor
            key={editingItem.id}
            item={editingItem}
            view={view}
            font={t.font}
            onCommit={(text) => {
              if (text !== editingItem.text) actions.update(editingItem.id, { text });
              setEditing(null);
            }}
          />
        )}

        {/* barra de opções do sticky selecionado */}
        {selectedItem && canEdit && !editing && (
          <StickyToolbar
            item={selectedItem}
            at={toScreen(selectedItem.x + selectedItem.w / 2, selectedItem.y)}
            onColor={(c) => { actions.update(selectedItem.id, { color: c }); setLastColor(c); }}
            onDelete={() => { actions.remove([selectedItem.id]); setSelected(null); }}
          />
        )}

        {/* cromo */}
        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute left-3 top-3 flex items-center gap-1 rounded-lg bg-surface p-1 pr-3 shadow-md">
            {me.kind === "user" && (
              <IconButton label="Voltar aos quadros" size="sm" tooltipSide="bottom" onClick={() => router.push("/")}><ArrowLeft /></IconButton>
            )}
            <span className={`max-w-60 truncate text-sm font-semibold ${me.kind === "user" ? "" : "pl-2"}`} title={board.title}>{board.title}</span>
          </div>

          <div className="pointer-events-auto absolute left-3 top-1/2 -translate-y-1/2">
            <CreationToolbar
              tool={tool}
              onTool={setTool}
              canEdit={canEdit}
              tools={M1_TOOLS}
              onUndo={actions.undo}
              onRedo={actions.redo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </div>

          <div className="pointer-events-auto absolute right-3 top-3">
            <PeopleBar people={peopleForBar} onShare={me.role === "owner" ? () => setShareOpen(true) : undefined} />
          </div>

          <div className="absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-2">
            {conn === "reconnecting" && <ConnectionBanner state="reconnecting" />}
            {conn === "offline" && <ConnectionBanner state="offline" />}
            {justSynced && <ConnectionBanner state="synced" />}
            {!canEdit && (
              <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted shadow-sm">
                <Eye className="size-4" aria-hidden /> Você está só visualizando
              </span>
            )}
          </div>

          <div className="pointer-events-auto absolute bottom-3 right-3">
            <ZoomControl zoom={view.scale} onZoom={(z) => zoomAt(z, size.w / 2, size.h / 2)} onFit={fit} />
          </div>

          {synced && items.length === 0 && canEdit && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-md font-semibold text-text">Quadro em branco</p>
              <p className="mt-1 text-sm text-text-muted">Aperte <kbd className="rounded-sm border border-border bg-surface px-1.5 font-semibold">N</kbd> e clique em qualquer lugar para criar um sticky.</p>
            </div>
          )}
          {!synced && (
            <div role="status" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface px-4 py-2 text-sm text-text-muted shadow-md">
              Carregando o quadro…
            </div>
          )}
        </div>
      </div>

      {me.role === "owner" && <ShareModal boardId={board.id} open={shareOpen} onOpenChange={setShareOpen} onCopied={() => toast("success", "Link copiado")} onError={(m) => toast("error", m)} />}
      <Toaster toasts={toasts} onDismiss={(id) => setToasts((x) => x.filter((y) => y.id !== id))} />
    </TooltipProvider>
  );
}

/* ----------------------------------------------------------------- Sticky no Konva */
function Sticky({ item, t, draggable, selected, remote, hideText, onSelect, onEdit, onMove, onMoveEnd }: {
  item: StickyItem; t: Tokens; draggable: boolean; selected: boolean; remote?: { name: string; color: string };
  hideText: boolean; onSelect: () => void; onEdit: () => void; onMove: (x: number, y: number) => void; onMoveEnd: () => void;
}) {
  const fs = fontSizeFor(item.text);
  return (
    <Group
      x={item.x}
      y={item.y}
      draggable={draggable}
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      onDblClick={onEdit}
      onDblTap={onEdit}
      onDragStart={onSelect}
      onDragMove={(e) => onMove(e.target.x(), e.target.y())}
      onDragEnd={(e) => { onMove(e.target.x(), e.target.y()); onMoveEnd(); }}
    >
      <Rect
        width={item.w}
        height={item.h}
        fill={t.sticky[item.color] ?? t.sticky.yellow}
        shadowColor="black"
        shadowOpacity={0.12}
        shadowBlur={10}
        shadowOffsetY={4}
      />
      {!hideText && (
        <Text
          text={item.text}
          width={item.w}
          height={item.h}
          padding={16}
          align="center"
          verticalAlign="middle"
          fontFamily={t.font}
          fontSize={fs}
          lineHeight={1.25}
          fill={t.ink}
          ellipsis
        />
      )}
      {(selected || remote) && (
        <Rect x={-4} y={-4} width={item.w + 8} height={item.h + 8} stroke={selected ? t.selection : remote!.color} strokeWidth={1.5} strokeScaleEnabled={false} listening={false} />
      )}
      {remote && !selected && (
        <Group y={-26} listening={false}>
          <Rect width={remote.name.length * 7.2 + 12} height={20} fill={remote.color} cornerRadius={4} />
          <Text text={remote.name} x={6} y={4} fontSize={12} fontStyle="600" fontFamily={t.font} fill={t.surface} />
        </Group>
      )}
    </Group>
  );
}

/* ----------------------------------------------------------------- Editor de texto (textarea sobre o canvas) */
function StickyEditor({ item, view, font, onCommit }: { item: Item; view: View; font: string; onCommit: (text: string) => void }) {
  const [text, setText] = useState(item.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const s = view.scale;
  return (
    <textarea
      ref={ref}
      aria-label="Texto do sticky"
      value={text}
      maxLength={1000}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); onCommit(text); }
        e.stopPropagation();
      }}
      className="absolute resize-none overflow-hidden bg-transparent text-center text-sticky-ink outline-none"
      style={{
        left: item.x * s + view.x,
        top: item.y * s + view.y,
        width: item.w * s,
        height: item.h * s,
        padding: 16 * s,
        fontSize: fontSizeFor(text) * s,
        lineHeight: 1.25,
        fontFamily: font,
        // centraliza verticalmente como o Konva
        paddingTop: Math.max(16 * s, (item.h * s - Math.min(item.h * s, (text.split("\n").length + Math.floor(text.length / 18)) * fontSizeFor(text) * s * 1.25)) / 2),
      }}
    />
  );
}

/* ----------------------------------------------------------------- Barra do sticky selecionado */
function StickyToolbar({ item, at, onColor, onDelete }: { item: StickyItem; at: { x: number; y: number }; onColor: (c: string) => void; onDelete: () => void }) {
  return (
    <div className="absolute z-20 -translate-x-1/2 -translate-y-full" style={{ left: at.x, top: at.y - 14 }}>
      <Bar label="Opções do sticky">
        <Popover.Root>
          <Popover.Trigger asChild>
            <IconButton label="Cor" size="sm" tooltipSide="top">
              <span className="size-4.5 rounded-full border border-border" style={{ background: `var(--mb-sticky-${item.color})` }} />
            </IconButton>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={8} className="z-50 rounded-md bg-surface p-2 shadow-lg">
              <ColorPicker value={item.color} onChange={onColor} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <Sep />
        <IconButton label="Apagar" shortcut="Del" size="sm" tooltipSide="top" className="hover:text-danger" onClick={onDelete}><Trash2 /></IconButton>
      </Bar>
    </div>
  );
}
