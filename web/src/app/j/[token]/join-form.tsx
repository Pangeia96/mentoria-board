"use client";

import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { joinAsGuest } from "../../actions";

export function JoinForm({ token, askName }: { token: string; askName: boolean }) {
  const [state, action, pending] = useActionState(joinAsGuest.bind(null, token), undefined);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      <Field label="Como você quer aparecer?" error={state?.error} hint={askName ? undefined : "Se deixar em branco, você recebe um nome aleatório"}>
        {(p) => <Input id={p.id} name="name" maxLength={60} autoComplete="given-name" autoFocus placeholder="Seu nome" aria-invalid={p.invalid} aria-describedby={p.describedBy} />}
      </Field>
      <Button type="submit" loading={pending} className="w-full">Entrar no quadro</Button>
    </form>
  );
}
