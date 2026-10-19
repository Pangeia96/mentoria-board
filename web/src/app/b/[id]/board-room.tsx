"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Eye, Magnet, MessageSquare, Users } from "lucide-react";
import { Button, Drawer, IconButton, Toaster, TooltipProvider, type ToastData } from "@/components/ui/primitives";
import { Avatar, type Person, type PresenceColor } from "@/components/ui/board";
import { ConnectionBanner, CreationToolbar, PeopleBar, RemoteCursor, ZoomControl, type Tool } from "@/components/ui/canvas-chrome";
import type { Actor } from "@/lib/auth";
import { useBoardDoc, type Viewport } from "./use-board-doc";
import { BoardMenu } from "./board-menu";
import { CommentPin, CommentsDrawer, NewCommentBox } from "./board/comments";
import { createThreadAction, listThreadsAction, replyAction, resolveAction, uploadImageAction } from "../../comment-actions";
import type { CommentThread } from "@/lib/data/types";
import { ShareModal } from "./share-modal";
import { ItemNode, measureTextHeight, type NodeHandlers } from "./board/nodes";
import { ContextBar, PenFlyout, ShapeFlyout } from "./board/context-bar";
import { LASER_FADE_MS, LASER_MAX_POINTS, LaserLayer, type LaserPoint, type RemoteLaser } from "./board/laser";
import {
  FONT, INK, PRESENCE_HEX, SELECTION, SURFACE, aabb, connectorBox, connectorEnds, contains, inkHex, intersects, isBox, hitsStroke,
  anchorsOf, connectorPoints, nearestAnchor, newConnector, newFrame, newImage, newShape, newSticky, newStroke, newText, normBox, stickyFontSize, thinPoints,
  type BoxItem, type Box, type ConnectorItem, type Endpoint, type Item, type ItemPatch, type Pt, type ShapeKind,
} from "./board/model";

export type RoomProps = { board: { id: string; title: string }; me: Actor; token: string; wsUrl: string };

type View = { x: number; y: number; scale: number };
type Draft =
  | { kind: "lasso"; start: Pt; cur: Pt; additive: boolean }
  | { kind: "shape"; start: Pt; cur: Pt }
  | { kind: "frame"; start: Pt; cur: Pt }
  | { kind: "connector"; from: Endpoint; cur: Pt; to: Endpoint }
  | { kind: "pen"; points: number[] }
  | { kind: "erase" };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const TOOLS: Tool[] = ["select", "hand", "sticky", "shape", "text", "connector", "pen", "frame", "image", "laser", "comment"];
const CREATE_TOOLS = new Set<Tool>(["sticky", "shape", "text", "connector", "pen", "frame", "laser", "comment"]);

const boxOf = (it: Item, byId: Map<string, Item>): Box => (isBox(it) ? aabb(it) : connectorBox(it, byId));
const union = (boxes: Box[]): Box | null => {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
};

export function BoardRoom({ board, me, token, wsUrl }: RoomProps) {
  const canEdit = me.role === "owner" || me.role === "editor";
  const router = useRouter();
  const sizeRef = useRef({ w: 0, h: 0 });
  const [following, setFollowing] = useState<number | null>(null); // clientId de quem estou seguindo
  const [localView, setLocalView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toast = useCallback((kind: ToastData["kind"], title: string) => setToasts((x) => [...x, { id: Date.now() + Math.random(), kind, title }]), []);
  const viewFrom = (v: Viewport): View => ({ scale: v.scale, x: sizeRef.current.w / 2 - v.cx * v.scale, y: sizeRef.current.h / 2 - v.cy * v.scale });
  const canComment = me.role !== "viewer";
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ x: number; y: number; itemId: string | null } | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const loadThreads = useCallback(async () => {
    const res = await listThreadsAction(board.id);
    if (res.ok) setThreads(res.data);
  }, [board.id]);
  const { items, synced, conn, justSynced, authError, peers, actions, canUndo, canRedo } = useBoardDoc({
    boardId: board.id, token, wsUrl, me,
    onEvent: (type) => { if (type === "comments") loadThreads(); },
    onSummon: (v, by) => { setFollowing(null); setLocalView(viewFrom(v)); toast("info", `${by} trouxe você para a visão dele`); },
  });
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const wrap = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
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
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [title, setTitle] = useState(board.title);
  const clipboard = useRef<Item[]>([]);
  const pasteCount = useRef(0);
  const newTextId = useRef<string | null>(null);
  const dragStart = useRef<Map<string, Pt> | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const laserPts = useRef<LaserPoint[]>([]);
  const laserDown = useRef(false);
  const laserStroke = useRef(0);
  const laserColor = PRESENCE_HEX[me.color] ?? SELECTION;
  const [hoverId, setHoverId] = useState<string | null>(null); // objeto mostrando os pontos de conexão
  const [endDrag, setEndDrag] = useState<{ which: "from" | "to"; to: Endpoint } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const setTool = useCallback((t: Tool) => {
    if (t === "image") { fileInput.current?.click(); return; } // não é um modo: abre o seletor e volta
    setToolRaw(t);
    setDraft(null);
  }, []);

  /* seguir alguém: a visão vem da visão publicada pela pessoa */
  const leader = following !== null ? peers.find((p) => p.clientId === following) : undefined;
  const lv = leader?.viewport;
  const view: View = useMemo(
    () => (lv && size.w ? { scale: lv.scale, x: size.w / 2 - lv.cx * lv.scale, y: size.h / 2 - lv.cy * lv.scale } : localView),
    [lv, size.w, size.h, localView],
  );
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; sizeRef.current = size; });
  /** Mexer na visão (pan/zoom) para de seguir, partindo de onde a pessoa estava. */
  const setView = useCallback((upd: View | ((v: View) => View)) => {
    setFollowing(null);
    setLocalView(() => (typeof upd === "function" ? upd(viewRef.current) : upd));
  }, []);

  /* publica a minha visão (para quem me segue / "trazer para mim") */
  useEffect(() => {
    if (!size.w) return;
    const id = setTimeout(() => actions.setViewport({ cx: (size.w / 2 - view.x) / view.scale, cy: (size.h / 2 - view.y) / view.scale, scale: view.scale }), 120);
    return () => clearTimeout(id);
  }, [view.x, view.y, view.scale, size.w, size.h, actions]);
  const myViewport = (): Viewport => ({ cx: (size.w / 2 - view.x) / view.scale, cy: (size.h / 2 - view.y) / view.scale, scale: view.scale });

  /* seleção/edição somem sozinhas se outra pessoa apagar o item */
  const selected = useMemo(() => selRaw.filter((id) => byId.has(id)), [selRaw, byId]);
  const selectedItems = useMemo(() => selected.map((id) => byId.get(id)!), [selected, byId]);
  const editing = editingRaw && byId.has(editingRaw) ? editingRaw : null;
  useEffect(() => actions.setSelection(selected), [selected, actions]);

  /* comentários: carrega ao abrir; depois o servidor avisa quando mudam */
  useEffect(() => {
    let alive = true;
    listThreadsAction(board.id).then((res) => { if (alive && res.ok) setThreads(res.data); });
    return () => { alive = false; };
  }, [board.id]);

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
  }, [setView]);

  const fit = useCallback(() => {
    const b = union(items.map((i) => boxOf(i, byId)));
    if (!b || !size.w) return setView({ x: size.w / 2, y: size.h / 2, scale: 1 });
    const pad = Math.min(120, size.w * 0.08);
    const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((size.w - pad * 2) / Math.max(b.w, 1), (size.h - pad * 2) / Math.max(b.h, 1), 1.5)));
    setView({ scale, x: size.w / 2 - (b.x + b.w / 2) * scale, y: size.h / 2 - (b.y + b.h / 2) * scale });
  }, [items, byId, size, setView]);

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
    if (!canEdit || !it || it.locked || it.type === "stroke" || it.type === "image") return;
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
      else if (k === "k") setTool("laser");
      else if (k === "c" && e.shiftKey) setShowComments((v) => !v);
      else if (k === "c" && canComment) setTool("comment");
      else if (!canEdit) return;
      else if (k === "n") setTool("sticky");
      else if (k === "s") setTool("shape");
      else if (k === "r") { setShapeKind("rect"); setTool("shape"); }
      else if (k === "o") { setShapeKind("ellipse"); setTool("shape"); }
      else if (k === "t") setTool("text");
      else if (k === "f") setTool("frame");
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
  }, [actions, canEdit, canComment, items, selected, selectedItems, fit, zoomAt, view.scale, size, duplicate, deleteSelection, patchSelection, startEditing, setTool]);

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
    if (tool === "comment") {
      if (!canComment) return;
      e.evt.preventDefault();
      setOpenThread(null);
      setComposer({ x: Math.round(p.x), y: Math.round(p.y), itemId: boxUnder(p)?.id ?? null });
      return;
    }
    if (tool === "laser") {
      laserDown.current = true;
      laserStroke.current += 1;
      laserPts.current.push({ x: p.x, y: p.y, t: Date.now(), s: laserStroke.current });
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
    } else if (tool === "frame") {
      setDraft({ kind: "frame", start: p, cur: p });
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
    if (laserDown.current) {
      const pts = laserPts.current;
      pts.push({ x: p.x, y: p.y, t: Date.now(), s: laserStroke.current });
      if (pts.length > LASER_MAX_POINTS) pts.splice(0, pts.length - LASER_MAX_POINTS);
    }
    if (!draft) return;
    if (draft.kind === "connector") setDraft({ ...draft, cur: p, to: resolveEnd(p, draft.from.itemId) });
    else if (draft.kind === "pen") setDraft({ ...draft, points: [...draft.points, p.x, p.y] });
    else if (draft.kind === "erase") eraseAt(p);
    else setDraft({ ...draft, cur: p });
  };

  const onStageUp = () => {
    laserDown.current = false;
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
    } else if (d.kind === "frame") {
      const b = normBox(d.start, d.cur);
      const box = b.w > 40 && b.h > 40 ? b : { x: d.start.x - 320, y: d.start.y - 200, w: 640, h: 400 };
      const n = items.filter((i) => i.type === "frame").length + 1;
      const id = actions.add(newFrame(Math.round(box.x), Math.round(box.y), Math.round(box.w), Math.round(box.h), n));
      actions.reorder([id], -1); // frames ficam atrás do conteúdo
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
      const moving = group.map((id) => byId.get(id)).filter((x): x is BoxItem => !!x && isBox(x) && !x.locked);
      // frame arrastado leva junto o que está inteiro dentro dele
      moving.filter((x) => x.type === "frame").forEach((fr) => {
        const fb = aabb(fr);
        items.forEach((o) => {
          if (o.id === fr.id || !isBox(o) || o.locked || moving.includes(o)) return;
          const ob = aabb(o);
          if (ob.x >= fb.x && ob.y >= fb.y && ob.x + ob.w <= fb.x + fb.w && ob.y + ob.h <= fb.y + fb.h) moving.push(o);
        });
      });
      dragStart.current = new Map(moving.map((x) => [x.id, { x: x.x, y: x.y }]));
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

  /* envia o rastro do lápis mágico para os outros enquanto houver algo visível */
  useEffect(() => {
    let live = false;
    const id = setInterval(() => {
      const now = Date.now();
      const alive = laserPts.current.filter((p) => now - p.t < LASER_FADE_MS);
      if (alive.length) {
        live = true;
        actions.setLaser({ sentAt: now, color: laserColor, pts: alive.map((p) => [Math.round(p.x), Math.round(p.y), p.t, p.s]) });
      } else if (live) {
        live = false;
        actions.setLaser(null);
      }
    }, 60);
    return () => clearInterval(id);
  }, [actions, laserColor]);
  const remoteLasers: RemoteLaser[] = peers.filter((p) => p.laser && p.laserAt).map((p) => ({ clientId: p.clientId, laser: p.laser!, receivedAt: p.laserAt! }));

  /* comentários: posição do pino (canto do objeto, se preso a um) */
  const pinWorld = (t: { itemId: string | null; x: number; y: number }) => {
    const it = t.itemId ? byId.get(t.itemId) : undefined;
    if (it && isBox(it)) { const b = aabb(it); return { x: b.x + b.w, y: b.y }; }
    return { x: t.x, y: t.y };
  };
  const visibleThreads = showComments ? threads.filter((t) => showResolved || !t.resolvedAt || t.id === openThread) : [];
  const sendNew = async (body: string) => {
    if (!composer) return false;
    const res = await createThreadAction(board.id, { ...composer, body });
    if (!res.ok) { toast("error", res.error); return false; }
    setComposer(null);
    setTool("select");
    setThreads((ts) => [res.data, ...ts.filter((t) => t.id !== res.data.id)]);
    setOpenThread(res.data.id);
    return true;
  };
  const reply = (threadId: string) => async (body: string) => {
    const res = await replyAction(board.id, threadId, body);
    if (!res.ok) { toast("error", res.error); return false; }
    await loadThreads();
    return true;
  };
  const resolve = (threadId: string) => async (resolved: boolean) => {
    const res = await resolveAction(board.id, threadId, resolved);
    if (!res.ok) return toast("error", res.error);
    if (resolved) setOpenThread(null);
    await loadThreads();
  };
  const pickThread = (t: CommentThread) => {
    const w = pinWorld(t);
    setView((v) => ({ ...v, x: size.w / 2 - w.x * v.scale, y: size.h / 2 - w.y * v.scale }));
    setShowComments(true);
    if (t.resolvedAt) setShowResolved(true);
    setOpenThread(t.id);
    setCommentsOpen(false);
  };

  /* imagens: do seletor, colando (Ctrl+V) ou soltando arquivos no quadro */
  const insertImages = useCallback(async (files: File[], at?: Pt) => {
    if (!canEdit) return;
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    const center = at ?? { x: (size.w / 2 - view.x) / view.scale, y: (size.h / 2 - view.y) / view.scale };
    let offset = 0;
    for (const file of imgs) {
      let w = 0, h = 0;
      try {
        const bmp = await createImageBitmap(file);
        w = bmp.width; h = bmp.height;
        bmp.close();
      } catch {
        toast("error", `"${file.name}" não parece ser uma imagem válida.`);
        continue;
      }
      const form = new FormData();
      form.set("file", file);
      form.set("width", String(w));
      form.set("height", String(h));
      toast("info", "Enviando imagem…");
      const res = await uploadImageAction(board.id, form);
      if (!res.ok) { toast("error", res.error); continue; }
      const k = Math.min(1, 480 / Math.max(w, h)); // cabe num quadrado de 480
      const iw = Math.round(w * k), ih = Math.round(h * k);
      const id = actions.add(newImage(Math.round(center.x - iw / 2 + offset), Math.round(center.y - ih / 2 + offset), iw, ih, res.data.url, res.data.id));
      setSel([id]);
      offset += 24;
    }
    setTool("select");
  }, [canEdit, size, view, board.id, actions, toast, setTool]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA"].includes(t.tagName))) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.some((f) => f.type.startsWith("image/"))) { e.preventDefault(); insertImages(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [insertImages]);

  /* exportar PNG: só os objetos (sem seleção, cursores, lápis), fundo claro, ~2x a escala real */
  const exportPng = () => {
    const st = stageRef.current;
    const b = union(items.map((i) => boxOf(i, byId)));
    if (!st || !b) return toast("info", "O quadro está vazio.");
    const pad = 48, top = 32; // folga + espaço para o título dos frames
    const s = view.scale;
    const area = { x: (b.x - pad) * s + view.x, y: (b.y - pad - top) * s + view.y, width: (b.w + pad * 2) * s, height: (b.h + pad * 2 + top) * s };
    const pixelRatio = Math.max(0.1, Math.min(2 / s, 8000 / area.width, 8000 / area.height)); // limite do canvas do navegador
    const others = st.getLayers().slice(1);
    const tr = trRef.current, trNodes = tr?.nodes() ?? [];
    others.forEach((l) => l.hide());
    tr?.nodes([]);
    let url: string;
    try {
      url = st.toDataURL({ ...area, pixelRatio });
    } finally {
      others.forEach((l) => l.show());
      tr?.nodes(trNodes);
    }
    const img = new window.Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--mb-canvas").trim() || SURFACE;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      c.toBlob((blob) => {
        if (!blob) return toast("error", "Não foi possível gerar a imagem.");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim() || "quadro"}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        toast("success", "Imagem baixada");
      }, "image/png");
    };
    img.src = url;
  };

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
        onDragOver={(e) => { if (canEdit && e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
        onDrop={(e) => {
          if (!canEdit || !e.dataTransfer.files.length) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          insertImages([...e.dataTransfer.files], toWorld(e.clientX - rect.left, e.clientY - rect.top));
        }}
        style={{
          cursor: cursorStyle,
          backgroundImage: view.scale >= 0.3 ? "radial-gradient(var(--mb-canvas-grid) 1px, transparent 1px)" : undefined,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <h1 className="sr-only">{title}</h1>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => { insertImages([...(e.target.files ?? [])]); e.target.value = ""; }}
        />
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
              {draft?.kind === "frame" && (() => {
                const b = normBox(draft.start, draft.cur);
                return <Rect x={b.x} y={b.y} width={b.w} height={b.h} stroke={SELECTION} strokeWidth={1.5 * sw} dash={[6 * sw, 4 * sw]} cornerRadius={4} listening={false} />;
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
            <LaserLayer local={laserPts} localColor={laserColor} remote={remoteLasers} scale={view.scale} />
          </Stage>
        )}

        {/* cursores das outras pessoas */}
        {peers.map((p) => {
          if (!p.cursor) return null;
          const s = toScreen(p.cursor.x, p.cursor.y);
          return <RemoteCursor key={p.clientId} person={{ id: p.user.id, name: p.user.name, color: p.user.color as PresenceColor }} x={s.x} y={s.y} />;
        })}

        {/* comentários */}
        {visibleThreads.map((t) => {
          const s = toScreen(pinWorld(t).x, pinWorld(t).y);
          return (
            <CommentPin
              key={t.id}
              thread={t}
              at={s}
              open={openThread === t.id}
              onOpenChange={(v) => setOpenThread(v ? t.id : null)}
              canComment={canComment}
              onReply={reply(t.id)}
              onResolve={resolve(t.id)}
            />
          );
        })}
        {composer && <NewCommentBox at={toScreen(composer.x, composer.y)} onSend={sendNew} onCancel={() => setComposer(null)} />}

        {/* edição de texto sobre o canvas */}
        {editingItem && editingItem.type !== "stroke" && editingItem.type !== "image" && (
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
              if (it.type === "frame") { if (text.trim() !== it.title) actions.update(it.id, { title: text.trim().slice(0, 80) }); return; }
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
          <div className="pointer-events-auto absolute left-3 top-3 flex items-center gap-1 rounded-lg bg-surface p-1 shadow-md">
            {me.kind === "user" && (
              <IconButton label="Voltar aos quadros" size="sm" tooltipSide="bottom" onClick={() => router.push("/")}><ArrowLeft /></IconButton>
            )}
            {me.role === "owner" ? (
              <BoardMenu boardId={board.id} title={title} onRenamed={setTitle} onError={(m) => toast("error", m)} />
            ) : (
              <span className={`max-w-60 truncate text-sm font-semibold ${me.kind === "user" ? "" : "pl-2"}`} title={title}>{title}</span>
            )}
            <IconButton label="Baixar como imagem (PNG)" size="sm" tooltipSide="bottom" onClick={exportPng}><Download /></IconButton>
          </div>

          <div className="pointer-events-auto absolute left-3 top-1/2 flex -translate-y-1/2 items-start gap-2">
            <CreationToolbar tool={tool} onTool={setTool} canEdit={canEdit} tools={canComment ? TOOLS : TOOLS.filter((t) => t !== "comment")} onUndo={actions.undo} onRedo={actions.redo} canUndo={canUndo} canRedo={canRedo} />
            {tool === "shape" && <ShapeFlyout value={shapeKind} onChange={setShapeKind} />}
            {tool === "pen" && <PenFlyout mode={penMode} color={penColor} width={penWidth} onMode={setPenMode} onColor={setPenColor} onWidth={setPenWidth} />}
          </div>

          <div className="pointer-events-auto absolute right-3 top-3 flex items-start gap-2">
            <div className="rounded-lg bg-surface p-1 shadow-md">
              <IconButton label={`Comentários (${threads.filter((t) => !t.resolvedAt).length})`} shortcut="Shift+C esconde" tooltipSide="bottom" pressed={commentsOpen} onClick={() => setCommentsOpen(true)}>
                <MessageSquare />
              </IconButton>
            </div>
            <PeopleBar
              people={peopleForBar}
              onOpenPeople={() => setPeopleOpen(true)}
              onShare={me.role === "owner" ? () => setShareOpen(true) : undefined}
              following={leader ? { id: leader.user.id, name: leader.user.name, color: leader.user.color as PresenceColor } : undefined}
              onStopFollowing={() => setView(view)}
            />
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

      <CommentsDrawer open={commentsOpen} onOpenChange={setCommentsOpen} threads={threads} showResolved={showResolved} onShowResolved={setShowResolved} onPick={pickThread} />

      <Drawer open={peopleOpen} onOpenChange={setPeopleOpen} title={`No quadro agora (${1 + peers.filter((p, i, a) => a.findIndex((q) => q.user.id === p.user.id) === i && p.user.id !== me.id).length})`}>
        <ul className="flex flex-col gap-1">
          <li className="flex items-center gap-3 rounded-md px-2 py-1.5">
            <Avatar person={{ id: me.id, name: me.name, color: me.color as PresenceColor, guest: me.kind === "guest" }} />
            <span className="flex-1 truncate text-sm">{me.name} <span className="text-xs text-text-muted">(você)</span></span>
          </li>
          {peers.filter((p, i, a) => a.findIndex((q) => q.user.id === p.user.id) === i && p.user.id !== me.id).map((p) => (
            <li key={p.clientId} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-hover">
              <Avatar person={{ id: p.user.id, name: p.user.name, color: p.user.color as PresenceColor, guest: p.user.kind === "guest" }} following={following === p.clientId} />
              <span className="min-w-0 flex-1 truncate text-sm">{p.user.name}{p.user.kind === "guest" && <span className="text-xs text-text-muted"> · visitante</span>}</span>
              {canEdit && (
                <IconButton label={`Trazer ${p.user.name} para a minha visão`} size="sm" tooltipSide="left" onClick={() => { actions.summon(myViewport(), p.clientId); toast("success", `${p.user.name} veio para a sua visão`); }}>
                  <Magnet />
                </IconButton>
              )}
              <Button size="sm" variant={following === p.clientId ? "primary" : "ghost"} disabled={!p.viewport} onClick={() => { if (following === p.clientId) setView(view); else { setFollowing(p.clientId); setPeopleOpen(false); } }}>
                {following === p.clientId ? "Parar" : "Seguir"}
              </Button>
            </li>
          ))}
        </ul>
        {peers.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">Só você por aqui. Mande o link para o mentorado entrar.</p>
        ) : canEdit && (
          <Button className="mt-4 w-full" variant="secondary" icon={<Users className="size-4" />} onClick={() => { actions.summon(myViewport(), null); toast("success", "Todo mundo veio para a sua visão"); }}>
            Trazer todos para a minha visão
          </Button>
        )}
      </Drawer>

      {me.role === "owner" && <ShareModal boardId={board.id} open={shareOpen} onOpenChange={setShareOpen} onCopied={() => toast("success", "Link copiado")} onError={(m) => toast("error", m)} />}
      <Toaster toasts={toasts} onDismiss={(id) => setToasts((x) => x.filter((y) => y.id !== id))} />
    </TooltipProvider>
  );
}

const Kbd = ({ children }: { children: string }) => <kbd className="rounded-sm border border-border bg-surface px-1.5 font-semibold">{children}</kbd>;

/* ----------------------------------------------------------------- editor de texto (textarea sobre o canvas) */
function TextEditor({ item, byId, view, onCommit }: { item: Exclude<Item, { type: "stroke" } | { type: "image" }>; byId: Map<string, Item>; view: View; onCommit: (text: string) => void }) {
  const [text, setText] = useState(item.type === "connector" ? item.label : item.type === "frame" ? item.title : item.text);
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
  } else if (item.type === "frame") {
    label = "Nome do frame";
    style = { left: item.x * view.scale + view.x, top: item.y * view.scale + view.y - 30, width: Math.max(160, Math.min(item.w * view.scale, 320)), height: 28, fontSize: 15, fontWeight: 600, padding: 4, background: "var(--mb-surface)", borderRadius: 6, boxShadow: "var(--mb-shadow-md)" };
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
      maxLength={item.type === "connector" || item.type === "frame" ? 80 : 2000}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => {
        const enterCommits = (item.type === "connector" || item.type === "frame") && e.key === "Enter";
        if (e.key === "Escape" || enterCommits || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); onCommit(text); }
        e.stopPropagation();
      }}
      className="absolute z-10 resize-none overflow-hidden bg-transparent outline-none"
      style={{ fontFamily: FONT, ...style }}
    />
  );
}
