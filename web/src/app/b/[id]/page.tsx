import { data } from "@/lib/data";
import { actorForBoard, currentUser, realtimeToken } from "@/lib/auth";
import { LinkUnavailable } from "@/components/link-unavailable";
import { BoardRoomLoader } from "./board-room-loader";

export async function generateMetadata({ params }: PageProps<"/b/[id]">) {
  const board = await data.getBoard((await params).id).catch(() => null);
  return { title: board ? `${board.title} · Mentoria Board` : "Quadro · Mentoria Board" };
}

/** S04: o quadro. */
export default async function BoardPage({ params }: PageProps<"/b/[id]">) {
  const { id } = await params;
  const board = /^[0-9a-f-]{36}$/i.test(id) ? await data.getBoard(id) : null;
  if (!board) return <LinkUnavailable reason="invalid" />;
  const actor = await actorForBoard(board.id);
  if (!actor) return <LinkUnavailable reason={(await currentUser()) ? "no-access" : "invalid"} />;

  return (
    <BoardRoomLoader
      board={{ id: board.id, title: board.title }}
      me={actor}
      token={await realtimeToken(board.id, actor)}
      wsUrl={process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:1234"}
    />
  );
}
