// Seed com dados fictícios (nenhuma pessoa real). Uso: npm run db:seed
// Cria 2 mentores de teste (o 2º serve para provar que um não vê os quadros do outro),
// 3 quadros e 1 link ativo. Idempotente: rodar de novo não duplica.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no web/.env.local");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function user(email, name) {
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const found = list?.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  return data.user.id;
}

const mentor = await user("mentora.teste@exemplo.test", "Mentora Teste");
const other = await user("outro.mentor@exemplo.test", "Outro Mentor");

async function board(owner, title, client) {
  const { data: has } = await sb.from("boards").select("id").eq("owner_id", owner).eq("title", title).maybeSingle();
  if (has) return has.id;
  const { data, error } = await sb.from("boards").insert({ owner_id: owner, title, client_name: client }).select("id").single();
  if (error) throw error;
  return data.id;
}

const b1 = await board(mentor, "Plano de carreira", "Cliente Exemplo A");
await board(mentor, "Roda da vida — sessão 2", "Cliente Exemplo B");
await board(other, "Quadro de outro mentor", null);

const { data: link } = await sb.from("share_links").select("token").eq("board_id", b1).eq("enabled", true).maybeSingle();
const token = link?.token ?? (await sb.from("share_links").insert({ board_id: b1, created_by: mentor }).select("token").single()).data.token;

console.log("seed ok");
console.log(`  mentora de teste: mentora.teste@exemplo.test (e-mail fictício: não recebe link; serve para dados e testes de RLS)`);
console.log(`  link de visitante do "Plano de carreira": /j/${token}`);
