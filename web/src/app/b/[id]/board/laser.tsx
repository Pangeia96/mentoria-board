"use client";

// Lápis mágico: rastro efêmero que some devagar a partir do fim. Não entra no doc (nem no desfazer);
// vai pelo awareness para os outros verem ao vivo.
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Layer, Line } from "react-konva";

export const LASER_FADE_MS = 2500; // "câmera lenta": quanto tempo um trecho leva para sumir
export const LASER_MAX_POINTS = 240;

/** s = número do traço: só se ligam pontos do mesmo traço (soltar e desenhar de novo não cria "ponte"). */
export type LaserPoint = { x: number; y: number; t: number; s: number };
/** O que vai no awareness: pontos com o relógio de quem desenha + a hora do envio (para corrigir diferença de relógio). */
export type LaserWire = { sentAt: number; color: string; pts: [number, number, number, number][] };
export type LaserTrail = { color: string; points: { x: number; y: number; age: number; s: number }[] };

/** Rastros remotos já convertidos para "idade" no relógio local. */
export type RemoteLaser = { clientId: number; laser: LaserWire; receivedAt: number };

type Seg = { key: string; points: number[]; color: string; opacity: number; width: number; blur: number };

export function LaserLayer({ local, localColor, remote, scale }: {
  local: MutableRefObject<LaserPoint[]>;
  localColor: string;
  remote: RemoteLaser[];
  scale: number;
}) {
  const [segs, setSegs] = useState<Seg[]>([]);
  const remoteRef = useRef(remote);
  const scaleRef = useRef(scale);
  useEffect(() => { remoteRef.current = remote; scaleRef.current = scale; });

  useEffect(() => {
    let raf = 0;
    let had = false;
    const frame = () => {
      const now = Date.now();
      const trails: LaserTrail[] = [];
      local.current = local.current.filter((p) => now - p.t < LASER_FADE_MS);
      if (local.current.length) trails.push({ color: localColor, points: local.current.map((p) => ({ x: p.x, y: p.y, age: now - p.t, s: p.s })) });
      for (const r of remoteRef.current) {
        const lag = now - r.receivedAt;
        const pts = r.laser.pts.map(([x, y, t, st]) => ({ x, y, age: r.laser.sentAt - t + lag, s: st })).filter((p) => p.age < LASER_FADE_MS);
        if (pts.length) trails.push({ color: r.laser.color, points: pts });
      }
      const out: Seg[] = [];
      const w = 5 / scaleRef.current;
      const blur = 12 / scaleRef.current;
      trails.forEach((tr, ti) => {
        for (let i = 1; i < tr.points.length; i++) {
          const a = tr.points[i - 1], b = tr.points[i];
          if (a.s !== b.s) continue;
          const life = 1 - Math.max(a.age, b.age) / LASER_FADE_MS; // 1 = recém-desenhado, 0 = sumindo
          if (life <= 0) continue;
          out.push({ key: `${ti}-${i}`, points: [a.x, a.y, b.x, b.y], color: tr.color, opacity: Math.pow(life, 0.8), width: w * (0.35 + 0.65 * life), blur });
        }
      });
      if (out.length || had) setSegs(out);
      had = out.length > 0;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [local, localColor]);

  return (
    <Layer listening={false}>
      {segs.map((s) => (
        <Line
          key={s.key}
          points={s.points}
          stroke={s.color}
          strokeWidth={s.width}
          opacity={s.opacity}
          lineCap="round"
          shadowColor={s.color}
          shadowBlur={s.blur}
          shadowOpacity={0.6}
          perfectDrawEnabled={false}
        />
      ))}
    </Layer>
  );
}
