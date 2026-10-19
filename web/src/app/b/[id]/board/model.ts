// Modelo dos objetos do quadro (o que vive no Y.Map "items") e geometria pura, sem React.
import * as tk from "@/styles/tokens";
import { inter } from "@/styles/fonts";

/* ----------------------------------------------------------------- tipos */
type Base = { id: string; x: number; y: number; w: number; h: number; rotation: number; z: number; locked: boolean; createdBy: string };

export type ShapeKind = "rect" | "ellipse" | "triangle" | "diamond";
export type StickyItem = Base & { type: "sticky"; color: string; text: string };
export type ShapeItem = Base & { type: "shape"; shape: ShapeKind; fill: string; stroke: string; strokeWidth: number; text: string; fontSize: number };
export type TextItem = Base & {
  type: "text"; text: string; color: string; fontSize: number; bold: boolean; italic: boolean; underline: boolean; align: "left" | "center" | "right";
};
/** Traço da caneta: pontos relativos a (x, y), achatados [x0, y0, x1, y1, ...]. */
export type StrokeItem = Base & { type: "stroke"; points: number[]; color: string; width: number };

export type Endpoint = { itemId: string | null; x: number; y: number };
export type ConnectorPath = "straight" | "elbow" | "curved";
export type Cap = "none" | "arrow";
/** Seta: as pontas presas a um item são recalculadas a cada desenho (acompanham o item). */
export type ConnectorItem = Base & {
  type: "connector"; from: Endpoint; to: Endpoint; path: ConnectorPath; startCap: Cap; endCap: Cap; color: string; width: number; label: string;
};

export type Item = StickyItem | ShapeItem | TextItem | StrokeItem | ConnectorItem;
export type ItemType = Item["type"];
export type BoxItem = Exclude<Item, ConnectorItem>;
/** Patch aceito por update(): qualquer campo de qualquer tipo, menos id e type. */
export type ItemPatch = Partial<Omit<StickyItem, "id" | "type"> & Omit<ShapeItem, "id" | "type"> & Omit<TextItem, "id" | "type"> & Omit<StrokeItem, "id" | "type"> & Omit<ConnectorItem, "id" | "type">>;

export const isBox = (i: Item): i is BoxItem => i.type !== "connector";
export const hasText = (i: Item): i is StickyItem | ShapeItem | TextItem => i.type === "sticky" || i.type === "shape" || i.type === "text";

/* ----------------------------------------------------------------- cores (tokens) */
export const FONT = inter.style.fontFamily;
export const INK = tk.sticky.ink;
export const SELECTION = tk.color.selection;
export const SURFACE = tk.color.surface;
export const STICKY_HEX = tk.sticky as Record<string, string>;
export const PRESENCE_HEX = tk.presence as Record<string, string>;

/** Cores de traço/texto: nomes estáveis gravados no doc → hex dos tokens. */
export const INK_COLORS: { id: string; label: string; hex: string }[] = [
  { id: "ink", label: "Preto", hex: tk.sticky.ink },
  { id: "muted", label: "Cinza", hex: tk.color["text-muted"] },
  { id: "accent", label: "Azul", hex: tk.color.accent },
  { id: "danger", label: "Vermelho", hex: tk.color.danger },
  { id: "success", label: "Verde", hex: tk.color.success },
  { id: "warning", label: "Âmbar", hex: tk.color.warning },
  { id: "p3", label: "Roxo", hex: tk.presence.p3 },
  { id: "p2", label: "Magenta", hex: tk.presence.p2 },
];
/** Preenchimentos: os pastéis dos stickies + branco + sem preenchimento. */
export const FILL_COLORS: { id: string; label: string; hex: string }[] = [
  { id: "none", label: "Sem preenchimento", hex: "transparent" },
  { id: "white", label: "Branco", hex: tk.color.surface },
  ...(["yellow", "orange", "pink", "violet", "blue", "teal", "green", "gray"] as const).map((c) => ({
    id: c, label: { yellow: "Amarelo", orange: "Laranja", pink: "Rosa", violet: "Lilás", blue: "Azul", teal: "Verde-água", green: "Verde", gray: "Cinza" }[c], hex: tk.sticky[c],
  })),
];
export const inkHex = (id: string) => INK_COLORS.find((c) => c.id === id)?.hex ?? INK;
export const fillHex = (id: string) => FILL_COLORS.find((c) => c.id === id)?.hex ?? "transparent";

/* ----------------------------------------------------------------- padrões de criação */
type New<T> = Omit<T, "id" | "z" | "createdBy">;
const base = { rotation: 0, locked: false };

export const newSticky = (x: number, y: number, color: string): New<StickyItem> => ({ ...base, type: "sticky", x, y, w: 200, h: 200, color, text: "" });
export const newShape = (x: number, y: number, w: number, h: number, shape: ShapeKind): New<ShapeItem> => ({
  ...base, type: "shape", x, y, w, h, shape, fill: "white", stroke: "ink", strokeWidth: 2, text: "", fontSize: 18,
});
export const newText = (x: number, y: number): New<TextItem> => ({
  ...base, type: "text", x, y, w: 260, h: 40, text: "", color: "ink", fontSize: 24, bold: false, italic: false, underline: false, align: "left",
});
export const newStroke = (points: number[], color: string, width: number): New<StrokeItem> => {
  const xs = points.filter((_, i) => i % 2 === 0), ys = points.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return {
    ...base, type: "stroke", x: minX, y: minY, w: Math.max(1, Math.max(...xs) - minX), h: Math.max(1, Math.max(...ys) - minY),
    points: points.map((v, i) => Math.round((v - (i % 2 === 0 ? minX : minY)) * 10) / 10), color, width,
  };
};
export const newConnector = (from: Endpoint, to: Endpoint): New<ConnectorItem> => ({
  ...base, type: "connector", x: 0, y: 0, w: 0, h: 0, from, to, path: "straight", startCap: "none", endCap: "arrow", color: "ink", width: 2, label: "",
});

/* ----------------------------------------------------------------- geometria */
export type Box = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

/** Caixa alinhada aos eixos que contém o item girado. */
export function aabb(i: BoxItem): Box {
  if (!i.rotation) return { x: i.x, y: i.y, w: i.w, h: i.h };
  const r = (i.rotation * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const pts = [[0, 0], [i.w, 0], [i.w, i.h], [0, i.h]].map(([px, py]) => ({ x: i.x + px * c - py * s, y: i.y + px * s + py * c }));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
export const center = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
export const intersects = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const contains = (b: Box, p: Pt, pad = 0) => p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
export const normBox = (a: Pt, b: Pt): Box => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

/** Ponto onde a reta do centro da caixa até `toward` cruza a borda (com folga). */
export function borderPoint(b: Box, toward: Pt, gap = 6): Pt {
  const c = center(b);
  const dx = toward.x - c.x, dy = toward.y - c.y;
  if (!dx && !dy) return c;
  const hw = b.w / 2 + gap, hh = b.h / 2 + gap;
  const t = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/** Pontas finais da seta, resolvendo itens presos. */
export function connectorEnds(c: ConnectorItem, byId: Map<string, Item>): { a: Pt; b: Pt } {
  const box = (e: Endpoint) => {
    const it = e.itemId ? byId.get(e.itemId) : undefined;
    return it && isBox(it) ? aabb(it) : null;
  };
  const ba = box(c.from), bb = box(c.to);
  const pa = ba ? center(ba) : { x: c.from.x, y: c.from.y };
  const pb = bb ? center(bb) : { x: c.to.x, y: c.to.y };
  return { a: ba ? borderPoint(ba, pb) : pa, b: bb ? borderPoint(bb, pa) : pb };
}

/** Pontos do caminho (para Konva Line/Arrow) conforme o tipo. */
export function connectorPoints(a: Pt, b: Pt, path: ConnectorPath): { points: number[]; tension: number } {
  if (path === "elbow") {
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    const mid = horizontal ? (a.x + b.x) / 2 : (a.y + b.y) / 2;
    const pts = horizontal ? [a.x, a.y, mid, a.y, mid, b.y, b.x, b.y] : [a.x, a.y, a.x, mid, b.x, mid, b.x, b.y];
    return { points: pts, tension: 0 };
  }
  if (path === "curved") {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const k = 0.2; // desvio perpendicular
    return { points: [a.x, a.y, mx - dy * k, my + dx * k, b.x, b.y], tension: 0.5 };
  }
  return { points: [a.x, a.y, b.x, b.y], tension: 0 };
}

/** Caixa de um conector (para laço e seleção remota). */
export function connectorBox(c: ConnectorItem, byId: Map<string, Item>): Box {
  const { a, b } = connectorEnds(c, byId);
  return normBox(a, b);
}

/** Distância de um ponto a um segmento. */
export function distToSegment(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** O ponteiro (mundo) passa sobre o traço? Usado pela borracha. */
export function hitsStroke(s: StrokeItem, p: Pt, radius: number) {
  if (!contains({ x: s.x, y: s.y, w: s.w, h: s.h }, p, radius + s.width)) return false;
  for (let i = 0; i + 3 < s.points.length; i += 2) {
    const a = { x: s.x + s.points[i], y: s.y + s.points[i + 1] };
    const b = { x: s.x + s.points[i + 2], y: s.y + s.points[i + 3] };
    if (distToSegment(p, a, b) <= radius + s.width / 2) return true;
  }
  return false;
}

/** Simplifica o traço: descarta pontos a menos de `min` px do anterior. */
export function thinPoints(points: number[], min = 2) {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const n = out.length;
    if (n >= 2 && Math.hypot(points[i] - out[n - 2], points[i + 1] - out[n - 1]) < min) continue;
    out.push(points[i], points[i + 1]);
  }
  return out;
}

export const stickyFontSize = (text: string) => (text.length < 40 ? 20 : text.length < 100 ? 16 : text.length < 220 ? 13 : 11);
