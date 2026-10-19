"use client";

// Desenho de cada tipo de item no Konva. Sem estado: tudo vem do doc Yjs via props.
import * as tk from "@/styles/tokens";
import { useEffect, useState } from "react";
import Konva from "konva";
import { Arrow, Ellipse, Group, Image as KImage, Line, Rect, Text } from "react-konva";
import {
  FONT, INK, STICKY_HEX, SURFACE, connectorEnds, connectorPoints, fillHex, inkHex, stickyFontSize,
  type ConnectorItem, type FrameItem, type ImageItem, type Item, type ShapeItem, type StickyItem, type StrokeItem, type TextItem,
} from "./model";

export type NodeHandlers = {
  draggable: boolean;
  hideText: boolean;
  onPointerDown: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onDblClick: () => void;
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
};

const labelWidth = (s: string) => Math.min(160, s.length * 7.6 + 14);
const fontStyle = (bold: boolean, italic: boolean) => [italic && "italic", bold && "bold"].filter(Boolean).join(" ") || "normal";

/** Altura que um texto ocupa numa largura (para a caixa do item de texto). */
export function measureTextHeight(i: Pick<TextItem, "text" | "w" | "fontSize" | "bold" | "italic">) {
  const k = new Konva.Text({ text: i.text || " ", width: i.w, fontSize: i.fontSize, fontFamily: FONT, fontStyle: fontStyle(i.bold, i.italic), lineHeight: 1.25, padding: 4 });
  const h = k.height();
  k.destroy();
  return Math.ceil(h);
}

export function ItemNode({ item, byId, h }: { item: Item; byId: Map<string, Item>; h: NodeHandlers }) {
  if (item.type === "connector") return <ConnectorNode item={item} byId={byId} h={h} />;
  return (
    <Group
      id={item.id}
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      draggable={h.draggable}
      onPointerDown={h.onPointerDown}
      onDblClick={h.onDblClick}
      onDblTap={h.onDblClick}
      onDragStart={h.onDragStart}
      onDragMove={h.onDragMove}
      onDragEnd={h.onDragEnd}
    >
      {item.type === "sticky" && <StickyBody item={item} hideText={h.hideText} />}
      {item.type === "shape" && <ShapeBody item={item} hideText={h.hideText} />}
      {item.type === "text" && <TextBody item={item} hideText={h.hideText} />}
      {item.type === "stroke" && <StrokeBody item={item} />}
      {item.type === "frame" && <FrameBody item={item} hideText={h.hideText} />}
      {item.type === "image" && <ImageBody item={item} />}
    </Group>
  );
}

function StickyBody({ item, hideText }: { item: StickyItem; hideText: boolean }) {
  return (
    <>
      <Rect width={item.w} height={item.h} fill={STICKY_HEX[item.color] ?? STICKY_HEX.yellow} shadowColor="black" shadowOpacity={0.12} shadowBlur={10} shadowOffsetY={4} />
      {!hideText && (
        <Text text={item.text} width={item.w} height={item.h} padding={16} align="center" verticalAlign="middle" fontFamily={FONT} fontSize={stickyFontSize(item.text)} lineHeight={1.25} fill={INK} ellipsis listening={false} />
      )}
    </>
  );
}

function ShapeBody({ item, hideText }: { item: ShapeItem; hideText: boolean }) {
  const common = { fill: fillHex(item.fill), stroke: item.stroke === "none" ? undefined : inkHex(item.stroke), strokeWidth: item.strokeWidth, strokeScaleEnabled: false };
  const { w, h } = item;
  return (
    <>
      {item.shape === "rect" && <Rect width={w} height={h} cornerRadius={6} {...common} />}
      {item.shape === "ellipse" && <Ellipse x={w / 2} y={h / 2} radiusX={w / 2} radiusY={h / 2} {...common} />}
      {item.shape === "triangle" && <Line points={[w / 2, 0, w, h, 0, h]} closed {...common} lineJoin="round" />}
      {item.shape === "diamond" && <Line points={[w / 2, 0, w, h / 2, w / 2, h, 0, h / 2]} closed {...common} lineJoin="round" />}
      {!hideText && item.text && (
        <Text
          text={item.text}
          x={item.shape === "triangle" ? w * 0.2 : item.shape === "diamond" ? w * 0.18 : 0}
          y={item.shape === "triangle" ? h * 0.35 : item.shape === "diamond" ? h * 0.18 : 0}
          width={item.shape === "triangle" ? w * 0.6 : item.shape === "diamond" ? w * 0.64 : w}
          height={item.shape === "triangle" ? h * 0.6 : item.shape === "diamond" ? h * 0.64 : h}
          padding={10} align="center" verticalAlign="middle" fontFamily={FONT} fontSize={item.fontSize} lineHeight={1.25} fill={INK} ellipsis listening={false}
        />
      )}
    </>
  );
}

function TextBody({ item, hideText }: { item: TextItem; hideText: boolean }) {
  return (
    <>
      {/* área clicável mesmo quando o texto é curto */}
      <Rect width={item.w} height={item.h} fill="transparent" />
      {!hideText && (
        <Text
          text={item.text || " "}
          width={item.w}
          padding={4}
          fontFamily={FONT}
          fontSize={item.fontSize}
          fontStyle={fontStyle(item.bold, item.italic)}
          textDecoration={item.underline ? "underline" : ""}
          align={item.align}
          lineHeight={1.25}
          fill={inkHex(item.color)}
          listening={false}
        />
      )}
    </>
  );
}

function StrokeBody({ item }: { item: StrokeItem }) {
  return (
    <Line
      points={item.points}
      stroke={inkHex(item.color)}
      strokeWidth={item.width}
      lineCap="round"
      lineJoin="round"
      tension={0.4}
      hitStrokeWidth={Math.max(14, item.width + 8)}
    />
  );
}

function FrameBody({ item, hideText }: { item: FrameItem; hideText: boolean }) {
  return (
    <>
      {/* o corpo não captura clique: clicar dentro do frame seleciona o que está nele (ou faz laço); o frame pega pelo título */}
      <Rect width={item.w} height={item.h} fill={fillHex(item.fill)} stroke={tk.color["border-input"]} strokeWidth={1} strokeScaleEnabled={false} cornerRadius={4} listening={false} shadowColor="black" shadowOpacity={0.05} shadowBlur={6} />
      <Rect y={-30} width={Math.min(item.w, Math.max(80, item.title.length * 8 + 24))} height={26} fill="transparent" />
      {!hideText && (
        <Text text={item.title || "Sem título"} y={-24} width={item.w} fontFamily={FONT} fontSize={15} fontStyle="600" fill={tk.color["text-muted"]} wrap="none" ellipsis listening={false} />
      )}
    </>
  );
}

/** Carrega a imagem uma vez por src (o navegador guarda em cache). */
function useHtmlImage(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const el = new window.Image();
    el.onload = () => setImg(el);
    el.src = src;
    return () => { el.onload = null; };
  }, [src]);
  return img;
}

function ImageBody({ item }: { item: ImageItem }) {
  const img = useHtmlImage(item.src);
  return img ? (
    <KImage image={img} width={item.w} height={item.h} />
  ) : (
    <Rect width={item.w} height={item.h} fill={tk.color["surface-muted"]} stroke={tk.color.border} strokeWidth={1} strokeScaleEnabled={false} />
  );
}

function ConnectorNode({ item, byId, h }: { item: ConnectorItem; byId: Map<string, Item>; h: NodeHandlers }) {
  const { a, b, da, db } = connectorEnds(item, byId);
  const { points, tension } = connectorPoints(a, b, item.path, da, db);
  const color = inkHex(item.color);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return (
    <Group id={item.id} onPointerDown={h.onPointerDown} onDblClick={h.onDblClick} onDblTap={h.onDblClick}>
      <Arrow
        points={points}
        tension={tension}
        stroke={color}
        fill={color}
        strokeWidth={item.width}
        pointerLength={item.width * 4 + 4}
        pointerWidth={item.width * 4 + 4}
        pointerAtBeginning={item.startCap === "arrow"}
        pointerAtEnding={item.endCap === "arrow"}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={16}
      />
      {item.label && !h.hideText && (
        // fundo atrás do rótulo para ele não sumir sobre a linha
        <Group x={mid.x} y={mid.y} listening={false}>
          <Rect x={-labelWidth(item.label) / 2} y={-12} width={labelWidth(item.label)} height={24} fill={SURFACE} cornerRadius={4} />
          <Text text={item.label} x={-80} y={-9} width={160} align="center" fontFamily={FONT} fontSize={14} fill={INK} wrap="none" ellipsis />
        </Group>
      )}
    </Group>
  );
}
