import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Renova a sessão do Supabase Auth a cada request (o token de acesso dura pouco). Sem autorização aqui. */
export async function proxy(request: NextRequest) {
  if (!URL_ || !KEY) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(URL_, KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // tudo menos arquivos estáticos e o link do visitante (que não usa sessão)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|j/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
