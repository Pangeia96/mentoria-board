"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/primitives";
import type { RoomProps } from "./board-room";

// Konva só roda no navegador.
const BoardRoom = dynamic(() => import("./board-room").then((m) => m.BoardRoom), {
  ssr: false,
  loading: () => <BoardLoading />,
});

export function BoardLoading() {
  return (
    <div role="status" aria-label="Carregando quadro" className="fixed inset-0 bg-canvas">
      <Skeleton className="absolute left-3 top-1/2 h-80 w-12 -translate-y-1/2 rounded-lg" />
      <Skeleton className="absolute right-3 top-3 h-12 w-56 rounded-lg" />
      <Skeleton className="absolute left-3 top-3 h-12 w-64 rounded-lg" />
      <span className="sr-only">Carregando quadro…</span>
    </div>
  );
}

export function BoardRoomLoader(props: RoomProps) {
  return <BoardRoom {...props} />;
}
