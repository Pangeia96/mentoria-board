"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { IconButton, Toaster, TooltipProvider, type ToastData } from "@/components/ui/primitives";
import { type Person, type PresenceColor } from "@/components/ui/board";
import { ConnectionBanner, CreationToolbar, PeopleBar, RemoteCursor, ZoomControl, type Tool } from "@/components/ui/canvas-chrome";
import type { Actor } from "@/lib/auth";
import { useBoardDoc } from "./use-board-doc";
import { ShareModal } from "./share-modal";
import { ItemNode, measureTextHeight, type NodeHandlers } from "./board/nodes";
import { ContextBar, PenFlyout, ShapeFlyout } from "./board/context-bar";
import {
  FONT, INK, PRESENCE_HEX, SELECTION, SURFACE, aabb, connectorBox, connectorEnds, contains, inkHex, intersects, isBox, hitsStroke,
  anchorsOf, connectorPoints, nearestAnchor, newConnector, newShape, newSticky, newStroke, newText, normBox, stickyFontSize, thinPoints,
  type BoxItem, type Box, type ConnectorItem, type Endpoint, type Item, type ItemPatch, type Pt, type ShapeKind,
} from "./board/model";

export type RoomProps = { board: { id: string; title: string }; me: Actor; token: string; wsUrl: string };

type View = { x: number; y: number; scale: number };
type Draft =
  | { kind: "lasso"; start: Pt; cur: Pt; additive: boolean }
  | { kind: "shape"; start: Pt; cur: Pt }
  | { kind: "connector"; from: Endpoint; cur: Pt; to: Endpoint }
  | { kind: "pen"; points: number[] }
  | { kind: "erase" };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const TOOLS: Tool[] = ["select", "hand", "sticky", "shape", "text", "connector", "pen"];
const CREATE_TOOLS = new Set<Tool>(["sticky", "shape", "text", "connector", "pen"]);

const boxOf = (it: Item, byId: Map<string, Item>): Box => (isBox(it) ? aabb(it) : connectorBox(it, byId));
const union = (boxes: Box[]): Box | null => {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
};

export function BoardRoom({ board, me, token, wsUrl }: RoomProps) {
  const canEdit = me.role === "owner" || me.role === "editor";
  const router = useRouter();
  const { items, synced, conn, justSynced, authError, peers, actions, canUndo, canRedo } = useBoardDoc({ boardId: board.id, token, wsUrl, me });
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const wrap = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [tool, setToolRaw] = useState<Tool>("select");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect");
  const [penMode, setPenMode] = useState<"draw" | "erase">("draw");
  const [penColor, setPenColor] = useState("ink");
  const [penWidth, setPenWidth] = useState(4);
  const [lastSticky, setLastSticky] = useState("yellow");
  const [space, setSpace] = useState(false);
  const [selRaw, setSel] = useState<string[]>([]);
  const [editingRaw, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false); // arrastando/transformando: esconde a barra
  const [shareOpen, setShareOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toast = useCallback((kind: ToastData["kind"], title: string) => setToasts((x) => [...x, { id: Date.now() + Math.random(), kind, title }]), []);
  const clipboard = useRef<Item[]>([]);
  const pasteCount = useRef(0);
  const newTextId = useRef<string | null>(null);
  const dragStart = useRef<Map<string, Pt> | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null); // objeto mostrando os pontos de conexão
  const [endDrag, setEndDrag] = useState<{ which: "from" | "to"; to: Endpoint } | null>(null);

  const setTool = useCallback((t: Tool) => { setToolRaw(t); setDraft(null); }, []);

  /* seleção/edição somem sozinhas se outra pessoa apagar o item */
  const selected = useMemo(() => selRaw.filter((id) => byId.has(id)), [selRaw, byId]);
  const selectedItems = useMemo(() => selected.map((id) => byId.get(id)!), [selected, byId]);
  const editing = editingRaw && byId.has(editingRaw) ? editingRaw : null;
  useEffect(() => actions.setSelection(selected), [selected, actions]);

  /* tamanho do palco = janela */
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toWorld = useCallback((sx: number, sy: number) => ({ x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale }), [view]);
  const toScreen = useCallback((wx: number, wy: number) => ({ x: wx * view.scale + view.x, y: wy * view.scale + view.y }), [view]);
  const pointer = useCallback((): Pt | null => {
    const p = stageRef.current?.getPointerPosition();
    return p ? toWorld(p.x, p.y) : null;
  }, [toWorld]);

  const zoomAt = useCallback((next: number, cx: number, cy: number) => {
    setView((v) => {
      const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      const wx = (cx - v.x) / v.scale;
      const wy = (cy - v.y) / v.scale;
      return { scale, x: cx - wx * scale, y: cy - wy * scale };
    });
  }, []);

  const fit = useCallback(() => {
    const b = union(items.map((i) => boxOf(i, byId)));
    if (!b || !size.w) return setView({ x: size.w / 2, y: size.h / 2, scale: 1 });
    const pad = Math.min(120, size.w * 0.08);
    const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((size.w - pad * 2) / Math.max(b.w, 1), (size.h - pad * 2) / Math.max(b.h, 1), 1.5)));
    setView({ scale, x: size.w / 2 - (b.x + b.w / 2) * scale, y: size.h / 2 - (b.y + b.h / 2) * scale });
  }, [items, byId, size]);

  /* redesenha quando a fonte terminar de carregar (o Konva mede o texto ao desenhar) */
  useEffect(() => {
    document.fonts?.ready.then(() => stageRef.current?.batchDraw());
  }, []);

  /* centraliza o conteúdo na primeira sincronização */
  const didFit = useRef(false);
  useEffect(() => {
    if (synced && size.w && !didFit.current) { didFit.current = true; fit(); }
  }, [synced, size.w, fit]);

  /* Transformer (redimensionar/girar) nos itens selecionados que são caixas e não estão travados */
  const transformable = useMemo(
    () => (canEdit && tool === "select" && !editing ? selectedItems.filter((i) => isBox(i) && !i.locked).map((i) => i.id) : []),
    [canEdit, tool, editing, selectedItems],
  );
  useEffect(() => {
    const tr = trRef.current, st = stageRef.current;
    if (!tr || !st) return;
    tr.nodes(transformable.map((id) => st.findOne(`#${id}`)).filter(Boolean) as Konva.Node[]);
    tr.getLayer()?.batchDraw();
  }, [transformable, items]);

  const onTransformEnd = () => {
    const tr = trRef.current;
    if (!tr) return;
    const patches: { id: string; patch: ItemPatch }[] = [];
    tr.nodes().forEach((n) => {
      const it = byId.get(n.id());
      if (!it || !isBox(it)) return;
      const sx = n.scaleX(), sy = n.scaleY();
      n.scale({ x: 1, y: 1 });
      const base: ItemPatch = { x: Math.round(n.x()), y: Math.round(n.y()), rotation: Math.round(n.rotation() * 10) / 10 };
      if (it.type === "stroke") {
        patches.push({ id: it.id, patch: { ...base, w: it.w * sx, h: it.h * sy, points: it.points.map((v, i) => Math.round(v * (i % 2 === 0 ? sx : sy) * 10) / 10) } });
      } else if (it.type === "text") {
        const w = Math.max(40, Math.round(it.w * sx));
        patches.push({ id: it.id, patch: { ...base, w, h: measureTextHeight({ ...it, w }) } });
      } else {
        patches.push({ id: it.id, patch: { ...base, w: Math.max(20, Math.round(it.w * sx)), h: Math.max(20, Math.round(it.h * sy)) } });
      }
    });
    actions.updateMany(patches);
    actions.stopCapturing();
    setBusy(false);
  };

  /* ----------------------------------------------------------------- operações na seleção */
  const deleteSelection = useCallback(() => {
    if (!selected.length || !canEdit) return;
    const ids = selectedItems.filter((i) => !i.locked).map((i) => i.id);
    if (!ids.length) return;
    // fixa onde as setas presas estão hoje, para elas ficarem no lugar quando o item sumir
    const gone = new Set(ids);
    const pin: { id: string; patch: ItemPatch }[] = [];
    items.forEach((c) => {
      if (c.type !== "connector" || gone.has(c.id)) return;
      if ((c.from.itemId && gone.has(c.from.itemId)) || (c.to.itemId && gone.has(c.to.itemId))) {
        const { a, b } = connectorEnds(c, byId);
        pin.push({ id: c.id, patch: { from: { ...c.from, ...a }, to: { ...c.to, ...b } } });
      }
    });
    if (pin.length) actions.updateMany(pin);
    actions.remove(ids);
    setSel([]);
  }, [selected, selectedItems, items, byId, actions, canEdit]);

  const duplicate = useCallback((list: Item[], offset: number) => {
    if (!list.length || !canEdit) return;
    const ids = actions.clone(list, offset, offset);
    setSel(ids);
  }, [actions, canEdit]);

  const patchSelection = useCallback((patch: ItemPatch) => {
    if (!canEdit) return;
    const keepLock = "locked" in patch;
    const targets = selectedItems.filter((i) => keepLock || !i.locked);
    actions.updateMany(targets.map((i) => {
      const p: ItemPatch = { ...patch };
      if (i.type === "text" && ("fontSize" in p || "bold" in p || "italic" in p)) p.h = measureTextHeight({ ...i, ...(p as object) });
      return { id: i.id, patch: p };
    }));
    if (patch.color && selectedItems.every((i) => i.type === "sticky")) setLastSticky(patch.color);
  }, [actions, selectedItems, canEdit]);

  const startEditing = useCallback((id: string) => {
    const it = byId.get(id);
    if (!canEdit || !it || it.locked || it.type === "stroke") return;
    setSel([id]);
    setEditing(id);
  }, [byId, canEdit]);

  /* ----------------------------------------------------------------- atalhos */
  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.code === "Space" && !e.repeat) { setSpace(true); e.preventDefault(); return; }
      if (mod && k === "z") { e.preventDefault(); if (canEdit) { if (e.shiftKey) actions.redo(); else actions.undo(); } return; }
      if (mod && k === "y") { e.preventDefault(); if (canEdit) actions.redo(); return; }
      if (mod && e.key === "0") { e.preventDefault(); zoomAt(1, size.w / 2, size.h / 2); return; }
      if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoomAt(view.scale * 1.2, size.w / 2, size.h / 2); return; }
      if (mod && e.key === "-") { e.preventDefault(); zoomAt(view.scale / 1.2, size.w / 2, size.h / 2); return; }
      if (e.altKey && e.key === "1") { e.preventDefault(); fit(); return; }
      if (mod && k === "a") { e.preventDefault(); setTool("select"); setSel(items.map((i) => i.id)); return; }
      if (mod && k === "d") { e.preventDefault(); duplicate(selectedItems, 24); return; }
      if (mod && k === "c") { if (selectedItems.length) { clipboard.current = structuredClone(selectedItems); pasteCount.current = 0; } return; }
      if (mod && k === "x") { if (selectedItems.length) { clipboard.current = structuredClone(selectedItems); pasteCount.current = 0; deleteSelection(); } return; }
      if (mod && k === "v") { e.preventDefault(); pasteCount.current += 1; duplicate(clipboard.current, 32 * pasteCount.current); return; }
      if (mod && e.shiftKey && k === "l") { e.preventDefault(); if (selectedItems.length) patchSelection({ locked: !selectedItems.every((i) => i.locked) }); return; }
      const oneText = selectedItems.length === 1 && selectedItems[0].type === "text" ? selectedItems[0] : null;
      if (mod && oneText && (k === "b" || k === "i" || k === "u")) {
        e.preventDefault();
        patchSelection(k === "b" ? { bold: !oneText.bold } : k === "i" ? { italic: !oneText.italic } : { underline: !oneText.underline });
        return;
      }
      if (mod) return;
      if (e.key === "PageUp" && selected.length && canEdit) { e.preventDefault(); actions.reorder(selected, 1); return; }
      if (e.key === "PageDown" && selected.length && canEdit) { e.preventDefault(); actions.reorder(selected, -1); return; }
      if (e.key.startsWith("Arrow") && selected.length && canEdit) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0, dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        actions.updateMany(selectedItems.filter((i) => isBox(i) && !i.locked).map((i) => ({ id: i.id, patch: { x: i.x + dx, y: i.y + dy } })));
        return;
      }
      if (k === "v") setTool("select");
      else if (k === "h") setTool("hand");
      else if (!canEdit) return;
      else if (k === "n") setTool("sticky");
      else if (k === "s") setTool("shape");
      else if (k === "r") { setShapeKind("rect"); setTool("shape"); }
      else if (k === "o") { setShapeKind("ellipse"); setTool("shape"); }
      else if (k === "t") setTool("text");
      else if (k === "l") setTool("connector");
      else if (k === "p") { setPenMode("draw"); setTool("pen"); }
      else if (k === "e") { setPenMode("erase"); setTool("pen"); }
      if (k === "escape") { setSel([]); setTool("select"); }
      else if (e.key === "Delete" || e.key === "Backspace") deleteSelection();
      else if (e.key === "Enter" && selected.length === 1) { e.preventDefault(); startEditing(selected[0]); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpace(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [actions, canEdit, items, selected, selectedItems, fit, zoomAt, view.scale, size, duplicate, deleteSelection, patchSelection, startEditing, setTool]);

  /* ----------------------------------------------------------------- roda, pinça, cursor */
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const p = stageRef.current?.getPointerPosition();
    if (!p) return;
    if (e.evt.ctrlKey || e.evt.metaKey) zoomAt(view.scale * Math.exp(-e.evt.deltaY * 0.0025), p.x, p.y);
    else setView((v) => ({ ...v, x: v.x - e.evt.deltaX, y: v.y - e.evt.deltaY }));
  };

  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const t = e.evt.touches;
    if (t.length !== 2) return;
    e.evt.preventDefault();
    const rect = wrap.current!.getBoundingClientRect();
    const cx = (t[0].clientX + t[1].clientX) / 2 - rect.left, cy = (t[0].clientY + t[1].clientY) / 2 - rect.top;
    const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const last = pinch.current;
    pinch.current = { dist, cx, cy };
    setDraft(null);
    if (!last) return;
    setView((v) => {
      const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.scale * (dist / last.dist)));
      const wx = (last.cx - v.x) / v.scale, wy = (last.cy - v.y) / v.scale;
      return { scale, x: cx - wx * scale, y: cy - wy * scale };
    });
  };

  const rafRef = useRef(0);
  const sendCursor = () => {
    const w = pointer();
    if (!w) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => actions.setCursor({ x: Math.round(w.x), y: Math.round(w.y) }));
  };

  /* ----------------------------------------------------------------- ponteiro no palco (ferramentas) */
  const panning = tool === "hand" || space;

  /** Objeto mais no topo sob o ponto (com folga): alvo de seta. Todos os tipos, menos setas. */
  const boxUnder = useCallback((p: Pt, pad = 0, exclude?: string | null): BoxItem | null => {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (isBox(it) && it.id !== exclude && contains(aabb(it), p, pad)) return it;
    }
    return null;
  }, [items]);

  /** Onde uma ponta de seta encaixa: num ponto de conexão (pregada), no objeto (automático) ou solta. */
  const resolveEnd = useCallback((p: Pt, exclude?: string | null): Endpoint => {
    const snap = nearestAnchor(items, p, 22 / view.scale, exclude);
    if (snap) return { itemId: snap.item.id, anchor: snap.side, x: Math.round(snap.p.x), y: Math.round(snap.p.y) };
    const it = boxUnder(p, 0, exclude);
    return { itemId: it?.id ?? null, anchor: null, x: Math.round(p.x), y: Math.round(p.y) };
  }, [items, view.scale, boxUnder]);

  const startConnector = (from: Endpoint, p: Pt) => setDraft({ kind: "connector", from, cur: p, to: { itemId: null, x: p.x, y: p.y } });

  const eraseAt = (p: Pt) => {
    const r = 8 / view.scale;
    const hit = items.filter((i) => i.type === "stroke" && !i.locked && hitsStroke(i, p, r)).map((i) => i.id);
    if (hit.length) actions.remove(hit);
  };

  const onStageDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (pinch.current || panning || e.evt.button === 1 || e.evt.button === 2) return;
    const p = pointer();
    if (!p) return;
    if (tool === "select") {
      if (e.target !== e.target.getStage()) return; // clique em item: tratado no item
      setEditing(null);
      if (!e.evt.shiftKey) setSel([]);
      setDraft({ kind: "lasso", start: p, cur: p, additive: e.evt.shiftKey });
      return;
    }
    if (!canEdit) return;
    setEditing(null);
    e.evt.preventDefault(); // não deixa o mousedown tirar o foco do editor que vai abrir
    if (tool === "sticky") {
      const id = actions.add(newSticky(Math.round(p.x - 100), Math.round(p.y - 100), lastSticky));
      setSel([id]); setEditing(id); setTool("select");
    } else if (tool === "text") {
      const id = actions.add(newText(Math.round(p.x), Math.round(p.y - 20)));
      newTextId.current = id;
      setSel([id]); setEditing(id); setTool("select");
    } else if (tool === "shape") {
      setDraft({ kind: "shape", start: p, cur: p });
    } else if (tool === "connector") {
      startConnector(resolveEnd(p), p);
    } else if (tool === "pen") {
      if (penMode === "erase") { setDraft({ kind: "erase" }); eraseAt(p); }
      else setDraft({ kind: "pen", points: [p.x, p.y] });
    }
  };

  const onStageMove = () => {
    sendCursor();
    const p = pointer();
    if (!p) return;
    // pontos de conexão aparecem no objeto sob o ponteiro enquanto se faz uma seta
    if (tool === "connector" || draft?.kind === "connector") {
      const h = boxUnder(p, 24 / view.scale)?.id ?? null;
      if (h !== hoverId) setHoverId(h);
    } else if (hoverId) setHoverId(null);
    if (!draft) return;
    if (draft.kind === "connector") setDraft({ ...draft, cur: p, to: resolveEnd(p, draft.from.itemId) });
    else if (draft.kind === "pen") setDraft({ ...draft, points: [...draft.points, p.x, p.y] });
    else if (draft.kind === "erase") eraseAt(p);
    else setDraft({ ...draft, cur: p });
  };

  const onStageUp = () => {
    const d = draft;
    setDraft(null);
    if (!d) return;
    if (d.kind === "lasso") {
      const lb = normBox(d.start, d.cur);
      if (lb.w < 3 && lb.h < 3) return;
      const hit = items.filter((i) => intersects(lb, boxOf(i, byId))).map((i) => i.id);
      setSel((s) => (d.additive ? [...new Set([...s, ...hit])] : hit));
    } else if (d.kind === "shape") {
      const b = normBox(d.start, d.cur);
      const big = b.w > 8 || b.h > 8;
      const box = big ? b : { x: d.start.x - 80, y: d.start.y - 60, w: 160, h: 120 };
      const id = actions.add(newShape(Math.round(box.x), Math.round(box.y), Math.max(20, Math.round(box.w)), Math.max(20, Math.round(box.h)), shapeKind));
      setSel([id]); setTool("select");
    } else if (d.kind === "connector") {
      setHoverId(null);
      const to = resolveEnd(d.cur, d.from.itemId);
      if (Math.hypot(d.cur.x - d.from.x, d.cur.y - d.from.y) < 10 && !to.itemId) return;
      const id = actions.add(newConnector(d.from, to));
      setSel([id]); setTool("select");
    } else if (d.kind === "pen") {
      const pts = thinPoints(d.points.map((v) => Math.round(v * 10) / 10), 1.5 / view.scale);
      if (pts.length >= 4) actions.add(newStroke(pts, penColor, penWidth));
      actions.stopCapturing();
    } else if (d.kind === "erase") {
      actions.stopCapturing();
    }
  };

  /* ----------------------------------------------------------------- arrastar itens (em grupo) */
  const handlersFor = (it: Item): NodeHandlers => ({
    draggable: canEdit && tool === "select" && !space && !it.locked && editing !== it.id && it.type !== "connector",
    hideText: editing === it.id,
    onPointerDown: (e) => {
      if (tool !== "select" || panning) return;
      e.cancelBubble = true;
      if (e.evt.shiftKey) setSel((s) => (s.includes(it.id) ? s.filter((x) => x !== it.id) : [...s, it.id]));
      else if (!selected.includes(it.id)) setSel([it.id]);
    },
    onDblClick: () => startEditing(it.id),
    onDragStart: () => {
      setBusy(true);
      const group = selected.includes(it.id) ? selected : [it.id];
      if (!selected.includes(it.id)) setSel([it.id]);
      dragStart.current = new Map(group.map((id) => byId.get(id)).filter((x): x is Item => !!x && isBox(x) && !x.locked).map((x) => [x.id, { x: x.x, y: x.y }]));
    },
    onDragMove: (e) => {
      const starts = dragStart.current;
      const s0 = starts?.get(it.id);
      if (!starts || !s0) return;
      const dx = e.target.x() - s0.x, dy = e.target.y() - s0.y;
      actions.updateMany([...starts].map(([id, s]) => ({ id, patch: { x: Math.round(s.x + dx), y: Math.round(s.y + dy) } })));
    },
    onDragEnd: () => { dragStart.current = null; actions.stopCapturing(); setBusy(false); },
  });

  /* ----------------------------------------------------------------- pontas de seta arrastáveis */
  const oneConnector = selectedItems.length === 1 && selectedItems[0].type === "connector" && !selectedItems[0].locked ? (selectedItems[0] as ConnectorItem) : null;
  const moveEnd = (c: ConnectorItem, which: "from" | "to", node: Konva.Node, final: boolean) => {
    const p = { x: node.x(), y: node.y() };
    const other = c[which === "from" ? "to" : "from"].itemId;
    const end = resolveEnd(p, other);
    setHoverId(final ? null : boxUnder(p, 24 / view.scale, other)?.id ?? null);
    setEndDrag(final ? null : { which, to: end });
    // enquanto arrasta, a ponta fica solta sob o ponteiro; ao soltar, encaixa
    actions.update(c.id, { [which]: final ? end : { itemId: null, anchor: null, x: Math.round(p.x), y: Math.round(p.y) } });
    if (final) { actions.stopCapturing(); setBusy(false); }
  };

  /* pontos de conexão visíveis: no objeto sob o ponteiro (ao fazer seta) e no objeto selecionado */
  const oneBox = selectedItems.length === 1 && isBox(selectedItems[0]) && !selectedItems[0].locked ? (selectedItems[0] as BoxItem) : null;
  const dotItems: BoxItem[] = [];
  if (canEdit) {
    const h = hoverId ? byId.get(hoverId) : null;
    if (h && isBox(h)) dotItems.push(h);
    if (oneBox && tool === "select" && !editing && !busy && oneBox.id !== hoverId) dotItems.push(oneBox);
  }
  const snapTarget = draft?.kind === "connector" ? draft.to : endDrag?.to ?? null;

  /* ----------------------------------------------------------------- presença */
  const peopleForBar: Person[] = useMemo(() => {
    const seen = new Map<string, Person>();
    seen.set(me.id, { id: me.id, name: `${me.name} (você)`, color: me.color as PresenceColor, guest: me.kind === "guest" });
    peers.forEach((p) => { if (!seen.has(p.user.id)) seen.set(p.user.id, { id: p.user.id, name: p.user.name, color: p.user.color as PresenceColor, guest: p.user.kind === "guest" }); });
    return [...seen.values()];
  }, [peers, me]);

  const remoteSel = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    peers.forEach((p) => p.selection?.forEach((id) => m.set(id, { name: p.user.name, color: PRESENCE_HEX[p.user.color] ?? SELECTION })));
    return m;
  }, [peers]);

  /* mantém a barra de opções dentro da tela e fora da barra de ferramentas (mexe só no DOM, sem estado) */
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect();
    const min = 72, max = size.w - 8;
    const dx = r.left < min ? min - r.left : r.right > max ? max - r.right : 0;
    el.style.marginLeft = `${dx}px`;
  });

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
  const cursorStyle = panning ? "grab" : tool === "text" ? "text" : CREATE_TOOLS.has(tool) ? "crosshair" : "default";
  const editingItem = editing ? byId.get(editing) ?? null : null;
  const selBox = union(selectedItems.map((i) => boxOf(i, byId)));
  const barAt = selBox ? toScreen(selBox.x + selBox.w / 2, selBox.y) : null;
  const barBelow = selBox && barAt && barAt.y < 120 ? toScreen(selBox.x + selBox.w / 2, selBox.y + selBox.h) : null;
  const sw = 1 / view.scale; // traço de 1px na tela

  return (
    <TooltipProvider>
      <div
        ref={wrap}
        className="fixed inset-0 touch-none overflow-hidden bg-canvas"
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
            onPointerDown={onStageDown}
            onPointerMove={onStageMove}
            onPointerUp={onStageUp}
            onPointerLeave={() => actions.setCursor(null)}
            onTouchMove={onTouchMove}
            onTouchEnd={() => { pinch.current = null; }}
            role="application"
            aria-label={`Quadro ${board.title}`}
          >
            <Layer listening={tool === "select" && !panning}>
              {items.map((it) => <ItemNode key={it.id} item={it} byId={byId} h={handlersFor(it)} />)}
              <Transformer
                ref={trRef}
                rotateEnabled
                keepRatio={false}
                flipEnabled={false}
                anchorSize={9}
                anchorCornerRadius={2}
                anchorStroke={SELECTION}
                borderStroke={SELECTION}
                rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
                boundBoxFunc={(oldB, newB) => (Math.abs(newB.width) < 12 || Math.abs(newB.height) < 12 ? oldB : newB)}
                onTransformStart={() => setBusy(true)}
                onTransformEnd={onTransformEnd}
              />
            </Layer>

            {/* sobreposições: seleção, seleções remotas, rascunhos */}
            <Layer listening={tool === "select" && (!!oneConnector || dotItems.length > 0)}>
              {selectedItems.filter((i) => !transformable.includes(i.id)).map((i) => {
                const b = boxOf(i, byId);
                return <Rect key={i.id} x={b.x - 4 * sw} y={b.y - 4 * sw} width={b.w + 8 * sw} height={b.h + 8 * sw} stroke={SELECTION} strokeWidth={1.5 * sw} dash={i.locked ? [4 * sw, 3 * sw] : undefined} listening={false} />;
              })}
              {[...remoteSel].map(([id, who]) => {
                const it = byId.get(id);
                if (!it || selected.includes(id)) return null;
                const b = boxOf(it, byId);
                return (
                  <Group key={id} listening={false}>
                    <Rect x={b.x - 4 * sw} y={b.y - 4 * sw} width={b.w + 8 * sw} height={b.h + 8 * sw} stroke={who.color} strokeWidth={1.5 * sw} />
                    <Group x={b.x - 4 * sw} y={b.y - 26 * sw} scaleX={sw} scaleY={sw}>
                      <Rect width={who.name.length * 7.2 + 12} height={20} fill={who.color} cornerRadius={4} />
                      <Text text={who.name} x={6} y={4} fontSize={12} fontStyle="600" fontFamily={FONT} fill={SURFACE} />
                    </Group>
                  </Group>
                );
              })}
              {oneConnector && (() => {
                const { a, b } = connectorEnds(oneConnector, byId);
                return ([["from", a], ["to", b]] as const).map(([which, pt]) => (
                  <Circle
                    key={which}
                    x={pt.x}
                    y={pt.y}
                    radius={6 * sw}
                    fill={SURFACE}
                    stroke={SELECTION}
                    strokeWidth={2 * sw}
                    draggable={canEdit}
                    onDragStart={() => setBusy(true)}
                    onDragMove={(e) => moveEnd(oneConnector, which, e.target, false)}
                    onDragEnd={(e) => moveEnd(oneConnector, which, e.target, true)}
                  />
                ));
              })()}
              {draft?.kind === "lasso" && (() => {
                const b = normBox(draft.start, draft.cur);
                return <Rect x={b.x} y={b.y} width={b.w} height={b.h} fill={SELECTION} opacity={0.08} stroke={SELECTION} strokeWidth={sw} listening={false} />;
              })()}
              {draft?.kind === "shape" && (() => {
                const b = normBox(draft.start, draft.cur);
                return <Rect x={b.x} y={b.y} width={b.w} height={b.h} stroke={SELECTION} strokeWidth={1.5 * sw} dash={[6 * sw, 4 * sw]} cornerRadius={shapeKind === "ellipse" ? Math.min(b.w, b.h) / 2 : 6} listening={false} />;
              })()}
              {draft?.kind === "connector" && (() => {
                // prévia com a mesma geometria da seta final (encaixe já resolvido)
                const to: Endpoint = draft.to.itemId ? draft.to : { itemId: null, anchor: null, x: draft.cur.x, y: draft.cur.y };
                const tmp = { ...newConnector(draft.from, to), id: "draft", z: 0, createdBy: "" } as ConnectorItem;
                const { a, b, da, db } = connectorEnds(tmp, byId);
                const { points, tension } = connectorPoints(a, b, "straight", da, db);
                const target = draft.to.itemId && !draft.to.anchor ? byId.get(draft.to.itemId) : null;
                return (
                  <>
                    {target && isBox(target) && (() => { const bx = aabb(target); return <Rect x={bx.x - 4 * sw} y={bx.y - 4 * sw} width={bx.w + 8 * sw} height={bx.h + 8 * sw} stroke={SELECTION} strokeWidth={2 * sw} listening={false} />; })()}
                    <Arrow points={points} tension={tension} stroke={INK} fill={INK} strokeWidth={2} pointerLength={12} pointerWidth={12} dash={[8, 6]} listening={false} />
                  </>
                );
              })()}
              {dotItems.map((it) =>
                anchorsOf(it).map(({ side, p, dir }) => {
                  const on = snapTarget?.itemId === it.id && snapTarget.anchor === side;
                  // no objeto selecionado o ponto fica um pouco para fora, para não brigar com as alças de redimensionar
                  const off = it.id === oneBox?.id && it.id !== hoverId ? 18 * sw : 0;
                  return (
                    <Circle
                      key={`${it.id}-${side}`}
                      x={p.x + dir.x * off}
                      y={p.y + dir.y * off}
                      radius={(on ? 7 : 5) * sw}
                      fill={on ? SELECTION : SURFACE}
                      stroke={SELECTION}
                      strokeWidth={2 * sw}
                      hitStrokeWidth={14 * sw}
                      listening={tool === "select"}
                      onPointerDown={(e) => {
                        // arrastar de um ponto do objeto selecionado já começa uma seta pregada ali
                        e.cancelBubble = true;
                        e.evt.preventDefault();
                        startConnector({ itemId: it.id, anchor: side, x: Math.round(p.x), y: Math.round(p.y) }, p);
                      }}
                      onMouseEnter={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = "crosshair"; }}
                      onMouseLeave={(e) => { const c = e.target.getStage()?.container(); if (c) c.style.cursor = ""; }}
                    />
                  );
                }),
              )}
              {draft?.kind === "pen" && <Line points={draft.points} stroke={inkHex(penColor)} strokeWidth={penWidth} lineCap="round" lineJoin="round" tension={0.4} listening={false} />}
            </Layer>
          </Stage>
        )}

        {/* cursores das outras pessoas */}
        {peers.map((p) => {
          if (!p.cursor) return null;
          const s = toScreen(p.cursor.x, p.cursor.y);
          return <RemoteCursor key={p.clientId} person={{ id: p.user.id, name: p.user.name, color: p.user.color as PresenceColor }} x={s.x} y={s.y} />;
        })}

        {/* edição de texto sobre o canvas */}
        {editingItem && editingItem.type !== "stroke" && (
          <TextEditor
            key={editingItem.id}
            item={editingItem}
            byId={byId}
            view={view}
            onCommit={(text) => {
              const it = editingItem;
              const isNewText = newTextId.current === it.id;
              newTextId.current = null;
              setEditing(null);
              if (it.type === "connector") { if (text !== it.label) actions.update(it.id, { label: text.trim() }); return; }
              if (it.type === "text" && !text.trim()) { actions.remove([it.id]); setSel([]); if (isNewText) actions.stopCapturing(); return; }
              if (text === it.text) return;
              actions.update(it.id, it.type === "text" ? { text, h: measureTextHeight({ ...it, text }) } : { text });
            }}
          />
        )}

        {/* barra de opções da seleção */}
        {selectedItems.length > 0 && canEdit && !editing && !busy && !draft && barAt && (
          <div
            ref={barRef}
            className="absolute z-20 -translate-x-1/2"
            style={barBelow ? { left: barBelow.x, top: barBelow.y + 14 } : { left: barAt.x, top: barAt.y - 14, transform: "translate(-50%, -100%)" }}
          >
            <ContextBar
              items={selectedItems}
              onPatch={patchSelection}
              onDuplicate={() => duplicate(selectedItems, 24)}
              onDelete={deleteSelection}
              onReorder={(dir) => actions.reorder(selected, dir)}
              onEditText={selectedItems.length === 1 ? () => startEditing(selectedItems[0].id) : undefined}
            />
          </div>
        )}

        {/* cromo */}
        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute left-3 top-3 flex items-center gap-1 rounded-lg bg-surface p-1 pr-3 shadow-md">
            {me.kind === "user" && (
              <IconButton label="Voltar aos quadros" size="sm" tooltipSide="bottom" onClick={() => router.push("/")}><ArrowLeft /></IconButton>
            )}
            <span className={`max-w-60 truncate text-sm font-semibold ${me.kind === "user" ? "" : "pl-2"}`} title={board.title}>{board.title}</span>
          </div>

          <div className="pointer-events-auto absolute left-3 top-1/2 flex -translate-y-1/2 items-start gap-2">
            <CreationToolbar tool={tool} onTool={setTool} canEdit={canEdit} tools={TOOLS} onUndo={actions.undo} onRedo={actions.redo} canUndo={canUndo} canRedo={canRedo} />
            {tool === "shape" && <ShapeFlyout value={shapeKind} onChange={setShapeKind} />}
            {tool === "pen" && <PenFlyout mode={penMode} color={penColor} width={penWidth} onMode={setPenMode} onColor={setPenColor} onWidth={setPenWidth} />}
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
            <div className="absolute left-1/2 top-1/2 max-w-[calc(100vw-120px)] -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-md font-semibold text-text">Quadro em branco</p>
              <p className="mt-1 text-sm text-text-muted">
                Escolha uma ferramenta à esquerda ou use o teclado: <Kbd>N</Kbd> sticky, <Kbd>S</Kbd> forma, <Kbd>T</Kbd> texto, <Kbd>L</Kbd> seta, <Kbd>P</Kbd> caneta.
              </p>
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

const Kbd = ({ children }: { children: string }) => <kbd className="rounded-sm border border-border bg-surface px-1.5 font-semibold">{children}</kbd>;

/* ----------------------------------------------------------------- editor de texto (textarea sobre o canvas) */
function TextEditor({ item, byId, view, onCommit }: { item: Exclude<Item, { type: "stroke" }>; byId: Map<string, Item>; view: View; onCommit: (text: string) => void }) {
  const [text, setText] = useState(item.type === "connector" ? item.label : item.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const s = view.scale;

  let style: React.CSSProperties;
  let label = "Texto";
  if (item.type === "connector") {
    const { a, b } = connectorEnds(item, byId);
    const mid = { x: ((a.x + b.x) / 2) * s + view.x, y: ((a.y + b.y) / 2) * s + view.y };
    label = "Rótulo da seta";
    style = { left: mid.x - 90, top: mid.y - 16, width: 180, height: 32, fontSize: 14, textAlign: "center", padding: 6, background: "var(--mb-surface)", borderRadius: 6, boxShadow: "var(--mb-shadow-md)" };
  } else {
    const base: React.CSSProperties = {
      left: item.x * s + view.x, top: item.y * s + view.y, width: item.w * s, transformOrigin: "0 0", transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined, lineHeight: 1.25,
    };
    if (item.type === "text") {
      label = "Texto livre";
      style = {
        ...base, minHeight: item.h * s, height: Math.max(item.h, (text.split("\n").length) * item.fontSize * 1.25 + 8) * s, padding: 4 * s, fontSize: item.fontSize * s,
        fontWeight: item.bold ? 700 : 400, fontStyle: item.italic ? "italic" : "normal", textDecoration: item.underline ? "underline" : "none", textAlign: item.align, color: inkHex(item.color),
      };
    } else {
      const fs = item.type === "sticky" ? stickyFontSize(text) : item.fontSize;
      const lines = text.split("\n").length + Math.floor(text.length / Math.max(8, (item.w - 32) / (fs * 0.55)));
      const contentH = Math.min(item.h, lines * fs * 1.25) * s;
      label = item.type === "sticky" ? "Texto do sticky" : "Texto da forma";
      style = { ...base, height: item.h * s, padding: 16 * s, paddingTop: Math.max(16 * s, (item.h * s - contentH) / 2), fontSize: fs * s, textAlign: "center", color: INK };
    }
  }

  return (
    <textarea
      ref={ref}
      aria-label={label}
      value={text}
      maxLength={item.type === "connector" ? 80 : 2000}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => {
        const enterCommits = item.type === "connector" && e.key === "Enter";
        if (e.key === "Escape" || enterCommits || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); onCommit(text); }
        e.stopPropagation();
      }}
      className="absolute z-10 resize-none overflow-hidden bg-transparent outline-none"
      style={{ fontFamily: FONT, ...style }}
    />
  );
}
