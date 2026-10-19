import { redirect } from "next/navigation";
import { data } from "@/lib/data";
import { actorForBoard } from "@/lib/auth";
import { LinkUnavailable } from "@/components/link-unavailable";
import { JoinForm } from "./join-form";

export const metadata = { title: "Entrar no quadro · Mentoria Board" };

/** S06: entrada do visitante pelo link. */
export default async function JoinPage({ params }: PageProps<"/j/[token]">) {
  const { token } = await params;
  const link = await data.getShareLinkByToken(token);
  const board = link?.enabled ? await data.getBoard(link.boardId) : null;
  if (!link || !board) return <LinkUnavailable reason="invalid" />;
  if (await actorForBoard(board.id)) redirect(`/b/${board.id}`); // já entrou antes (ou é o mentor)

  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-12" style={{ backgroundImage: "radial-gradient(var(--mb-canvas-grid) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
      <div className="w-full max-w-100 rounded-lg bg-surface p-8 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Você foi convidado para</p>
        <h1 className="mt-1 text-xl font-semibold break-words">{board.title}</h1>
        <JoinForm token={token} askName={link.askVisitorName} />
        <p className="mt-6 text-xs text-text-muted">Não precisa criar conta. Guardamos só o nome que você digitar, para mostrar no seu cursor.</p>
      </div>
    </main>
  );
}
