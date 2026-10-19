import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { hasSupabase } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · Mentoria Board" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await currentUser()) redirect("/");
  const sp = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-100 rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Entrar</h1>
        <p className="mt-1 text-sm text-text-muted">Acesse os quadros das suas mentorias. Sem senha: mandamos um link para o seu e-mail.</p>
        <LoginForm real={hasSupabase} googleError={sp.erro === "google" || sp.erro === "link"} />
        {!hasSupabase && (
          <p className="mt-6 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
            Modo de desenvolvimento: o Supabase ainda não está configurado no .env.local, então o login entra só com o e-mail.
          </p>
        )}
        {sp.erro === "link" && <p role="alert" className="mt-4 text-xs text-danger">Esse link de acesso expirou ou já foi usado. Peça um novo.</p>}
      </div>
    </main>
  );
}
