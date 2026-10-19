"use client";

import { useActionState } from "react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { devLogin } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(devLogin, undefined);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      <Field label="E-mail" error={state?.error}>
        {(p) => <Input id={p.id} name="email" type="email" autoComplete="email" required autoFocus aria-invalid={p.invalid} aria-describedby={p.describedBy} />}
      </Field>
      <Field label="Seu nome" hint="Aparece no seu cursor para os mentorados">
        {(p) => <Input id={p.id} name="name" autoComplete="name" aria-describedby={p.describedBy} />}
      </Field>
      <Button type="submit" loading={pending} className="w-full">Entrar</Button>
    </form>
  );
}
