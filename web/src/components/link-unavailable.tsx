import { ShieldOff } from "lucide-react";
import { EmptyState } from "@/components/ui/board";

/** S07: link inválido, desativado ou sem permissão. */
export function LinkUnavailable({ reason }: { reason: "invalid" | "no-access" }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-120 rounded-lg border border-border bg-surface">
        {reason === "invalid" ? (
          <EmptyState icon={<ShieldOff />} title="Este link não funciona mais">
            Ele foi desativado ou digitado errado. Peça um link novo para quem te convidou.
          </EmptyState>
        ) : (
          <EmptyState icon={<ShieldOff />} title="Você não tem acesso a este quadro" action={<a href="/login" className="text-sm font-semibold text-accent underline-offset-2 hover:underline">Entrar com outra conta</a>}>
            Se você recebeu um convite, abra o link que veio na mensagem.
          </EmptyState>
        )}
      </div>
    </main>
  );
}
