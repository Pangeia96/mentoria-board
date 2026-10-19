import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSbClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

/** Liga o backend real só quando as chaves existem; senão o app roda com a camada fake. */
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && SUPABASE_SECRET_KEY);

/** Cliente com a sessão do usuário (cookies http-only). Todas as queries passam pela RLS. */
export async function userClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Em Server Components não dá para gravar cookie; o proxy.ts renova a sessão.
        }
      },
    },
  });
}

/** Cliente de serviço (ignora RLS). Só para o que o visitante sem conta precisa, sempre com checagem no código. */
let admin: SupabaseClient | null = null;
export function adminClient() {
  admin ??= createSbClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
