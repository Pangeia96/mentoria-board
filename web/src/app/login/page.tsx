import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · Mentoria Board" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-100 rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Entrar</h1>
        <p className="mt-1 text-sm text-text-muted">Acesse os quadros das suas mentorias.</p>
        <LoginForm />
        <p className="mt-6 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          Modo de desenvolvimento: entra só com o e-mail, sem senha. O login real (link mágico e Google) chega com o backend.
        </p>
      </div>
    </main>
  );
}
