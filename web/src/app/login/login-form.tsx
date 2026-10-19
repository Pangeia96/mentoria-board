"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { signIn, signInWithGoogle } from "../actions";

export function LoginForm({ real, googleError }: { real: boolean; googleError?: boolean }) {
  const [state, action, pending] = useActionState(signIn, undefined);

  if (state?.sent) {
    return (
      <div role="status" className="mt-6 flex flex-col items-center gap-3 rounded-md bg-success-soft p-6 text-center">
        <MailCheck className="size-8 text-success" aria-hidden />
        <p className="text-sm font-semibold text-text">Confira seu e-mail</p>
        <p className="text-sm text-text-muted break-all">Mandamos um link de acesso para {state.sent}. Ele vale por uma hora.</p>
      </div>
    );
  }

  return (
    <>
      <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label="E-mail" error={state?.error}>
          {(p) => <Input id={p.id} name="email" type="email" autoComplete="email" required autoFocus aria-invalid={p.invalid} aria-describedby={p.describedBy} />}
        </Field>
        <Field label="Seu nome" hint="Aparece no seu cursor para os mentorados">
          {(p) => <Input id={p.id} name="name" autoComplete="name" maxLength={80} aria-describedby={p.describedBy} />}
        </Field>
        <Button type="submit" loading={pending} className="w-full">{real ? "Receber link de acesso" : "Entrar"}</Button>
      </form>
      {real && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-text-subtle" aria-hidden>
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>
          <form action={signInWithGoogle}>
            <Button type="submit" variant="secondary" className="w-full">Continuar com Google</Button>
          </form>
          {googleError && <p role="alert" className="mt-2 text-xs text-danger">Não deu para entrar com o Google. Tente o link por e-mail.</p>}
        </>
      )}
    </>
  );
}
