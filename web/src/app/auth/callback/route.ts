import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase, userClient } from "@/lib/supabase/server";

/** Volta do link mágico e do Google: troca o código pela sessão (cookies http-only). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!hasSupabase || !code) return NextResponse.redirect(new URL("/login?erro=link", url.origin));
  const { error } = await (await userClient()).auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?erro=link", url.origin));
  return NextResponse.redirect(new URL("/", url.origin));
}
