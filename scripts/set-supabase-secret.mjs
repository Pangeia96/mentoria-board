// Grava a Secret key do Supabase em web/.env.local e realtime/.env sem ecoar o valor na tela.
// Uso (na pasta mentoria-board): node scripts/set-supabase-secret.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [join(root, "web", ".env.local"), join(root, "realtime", ".env")];

function askHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value.trim());
      } else if (ch === "\u0003") {
        process.exit(1);
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch; // colar funciona: chega tudo de uma vez
      }
    };
    stdin.on("data", onData);
  });
}

const key = await askHidden("Cole a Secret key do Supabase (não aparece na tela) e aperte Enter: ");
if (!/^(sb_secret_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9._-]{40,})$/.test(key)) {
  console.error("Isso não parece uma Secret key (esperado sb_secret_… ou a service_role antiga eyJ…). Nada foi gravado.");
  process.exit(1);
}

for (const f of files) {
  let text = await readFile(f, "utf8");
  if (/^SUPABASE_SECRET_KEY=.*$/m.test(text)) text = text.replace(/^SUPABASE_SECRET_KEY=.*$/m, `SUPABASE_SECRET_KEY=${key}`);
  else text = `${text.trimEnd()}\nSUPABASE_SECRET_KEY=${key}\n`;
  await writeFile(f, text);
  console.log(`ok: ${f}`);
}

// confere se o Supabase aceita a chave (sem mostrar nada dela)
const url = (await readFile(files[0], "utf8")).match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
if (url) {
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  console.log(res.ok ? "O Supabase aceitou a chave." : `O Supabase recusou a chave (HTTP ${res.status}). Confira se ela é deste projeto: ${url}`);
}
