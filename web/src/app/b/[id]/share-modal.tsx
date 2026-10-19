"use client";

import { useEffect, useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { Button, Input, Modal, Skeleton } from "@/components/ui/primitives";
import { getShareUrl } from "../../actions";

/** S05 (M1): um link "pode editar" por quadro. Papéis, revogar e "pedir nome" chegam no M3. */
export function ShareModal({ boardId, open, onOpenChange, onCopied, onError }: {
  boardId: string; open: boolean; onOpenChange: (v: boolean) => void; onCopied: () => void; onError: (msg: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open || url) return;
    start(async () => {
      const r = await getShareUrl(boardId);
      if (r.url) setUrl(r.url);
      else { onError(r.error ?? "Não foi possível gerar o link."); onOpenChange(false); }
    });
  }, [open, url, boardId, onError, onOpenChange]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      onCopied();
      onOpenChange(false);
    } catch {
      onError("Não deu para copiar. Selecione o link e copie à mão.");
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Compartilhar quadro"
      description="Quem abrir este link entra sem criar conta e pode editar."
      footer={<Button icon={<Link2 className="size-4" />} onClick={copy} disabled={!url} loading={pending}>Copiar link</Button>}
    >
      {url ? (
        <Input aria-label="Link do quadro" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      ) : (
        <Skeleton className="h-10 w-full" />
      )}
    </Modal>
  );
}
