// Testes do schema + RLS num Postgres em WASM (PGlite), com um stub mínimo do Supabase Auth.
// Uso: npm run db:test
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'

const [stubPath, schemaPath] = process.argv.slice(2)
const db = new PGlite({ extensions: { pgcrypto } })
const v = await db.query('select version()')
console.log(v.rows[0].version)

await db.exec(readFileSync(stubPath, 'utf8'))
console.log('OK stub auth')
await db.exec(readFileSync(schemaPath, 'utf8'))
console.log('OK schema.sql aplicado')

const MENTOR = '11111111-1111-1111-1111-111111111111'
const OUTRO = '22222222-2222-2222-2222-222222222222'
let fails = 0

async function as(role, sub) {
  await db.exec('reset role')
  await db.exec(`select set_config('request.jwt.claim.sub', '${sub ?? ''}', false)`)
  if (role) await db.exec(`set role ${role}`)
}
async function ok(name, sql, check) {
  try {
    const r = await db.query(sql)
    const pass = check ? check(r.rows) : true
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`, pass ? '' : JSON.stringify(r.rows))
    if (!pass) fails++
    return r.rows
  } catch (e) { console.log(`FAIL ${name}: ${e.message}`); fails++ }
}
async function err(name, sql, match) {
  try {
    await db.query(sql)
    console.log(`FAIL ${name}: deveria ter dado erro`); fails++
  } catch (e) {
    const pass = !match || match.test(e.message)
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name} -> erro esperado: ${e.message}`)
    if (!pass) fails++
  }
}

// T1
await as(null)
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${MENTOR}','mentor@ex.com','{"full_name":"Mentor"}'), ('${OUTRO}','outro@ex.com','{}')`)
await ok('T1 cadastro cria profile (nome do meta ou do e-mail)', 'select name from profiles order by name',
  r => r.length === 2 && r[0].name === 'Mentor' && r[1].name === 'outro')

// T2
await as('authenticated', MENTOR)
await ok('T2a mentor cria quadro via RLS (insert ... returning)',
  `insert into boards (owner_id, title, client_name) values ('${MENTOR}','Sessão 1','Ana') returning id`,
  r => r.length === 1)
await ok('T2b trigger põe o dono como owner', 'select m.role from board_members m', r => r.length === 1 && r[0].role === 'owner')

// T3/T4
await as('authenticated', OUTRO)
await ok('T3 outro usuário não vê o quadro', 'select count(*)::int n from boards', r => r[0].n === 0)
await err('T4 outro usuário não cria quadro em nome do mentor', `insert into boards (owner_id, title) values ('${MENTOR}','invasão')`, /row-level security/)
await ok('T4b outro usuário não vê membros', 'select count(*)::int n from board_members', r => r[0].n === 0)

// T5
await as('authenticated', MENTOR)
await ok('T5a dono cria link (token hex de 48)', `insert into share_links (board_id, created_by) select id, '${MENTOR}' from boards returning token`,
  r => r.length === 1 && /^[0-9a-f]{48}$/.test(r[0].token))
await err('T5b segundo link ativo no mesmo quadro é bloqueado',
  `insert into share_links (board_id, created_by) select id, '${MENTOR}' from boards`, /share_links_one_active/)
await err('T5c papel owner no link é bloqueado',
  `update share_links set role = 'owner'`, /check constraint/)

// T6
await as('service_role')
await ok('T6a visitante entra (service role)', `insert into board_guests (board_id, share_link_id, display_name, color)
  select b.id, l.id, 'Ana', 'p2' from boards b join share_links l on l.board_id=b.id returning id`, r => r.length === 1)
await ok('T6b board_docs + coluna gerada size_bytes', `insert into board_docs (board_id, ydoc) select id, '\\x00010203'::bytea from boards returning size_bytes`,
  r => r[0].size_bytes === 4)
await ok('T6c visitante comenta', `with t as (insert into comment_threads (board_id, x, y, created_by_guest)
  select board_id, 10, 20, id from board_guests returning id, created_by_guest)
  insert into comments (thread_id, author_guest, author_name, body) select id, created_by_guest, 'Ana', 'oi' from t returning id`, r => r.length === 1)

// T7
await err('T7a cor inválida', `insert into board_guests (board_id, share_link_id, display_name, color)
  select b.id, l.id, 'X', 'red' from boards b join share_links l on l.board_id=b.id`, /check constraint/)
await err('T7b nome só com espaços', `insert into board_guests (board_id, share_link_id, display_name, color)
  select b.id, l.id, '   ', 'p1' from boards b join share_links l on l.board_id=b.id`, /check constraint/)
await err('T7c tipo de arquivo proibido', `insert into board_assets (board_id, storage_path, mime_type, size_bytes)
  select id, 'x/y.exe', 'application/x-msdownload', 10 from boards`, /check constraint/)
await err('T7d arquivo acima de 10 MB', `insert into board_assets (board_id, storage_path, mime_type, size_bytes)
  select id, 'x/y.png', 'image/png', 20000000 from boards`, /check constraint/)
await err('T7e título vazio', `insert into boards (owner_id, title) values ('${MENTOR}', '  ')`, /check constraint/)

// T8
await as('authenticated', MENTOR)
await ok('T8a mentor vê comentário do visitante', 'select author_name, body from comments', r => r.length === 1 && r[0].body === 'oi')
await ok('T8b client não lê board_docs (só o servidor WS)', 'select count(*)::int n from board_docs', r => r[0].n === 0)
await ok('T8c mentor vê o visitante na lista', 'select display_name from board_guests', r => r.length === 1)
await as('authenticated', OUTRO)
await ok('T8d outro usuário não vê comentários', 'select count(*)::int n from comments', r => r[0].n === 0)
await err('T8e outro usuário não cria thread no quadro alheio',
  `insert into comment_threads (board_id, x, y, created_by_user) select '00000000-0000-0000-0000-000000000000'::uuid, 0, 0, '${OUTRO}'`, /row-level security/)

await as('service_role')
await ok('T6d store_board_doc incrementa versão', `select store_board_doc(id, '\\x0a0b'::bytea) as v from boards`, r => Number(r[0].v) === 1)
await as('authenticated', MENTOR)
await err('T6e client não chama store_board_doc', `select store_board_doc(id, '\\x00'::bytea) from boards`, /permission denied/)

// T9
await as(null)
const before = (await db.query('select updated_at from boards')).rows[0].updated_at
await db.query('select pg_sleep(0.05)')
await ok('T9 updated_at muda no update', `update boards set title = 'Sessão 1b' returning updated_at`, r => r[0].updated_at > before)

// T10
await as('authenticated', OUTRO)
await ok('T10a outro usuário não apaga o quadro (0 linhas)', 'delete from boards returning id', r => r.length === 0)
await as('authenticated', MENTOR)
await ok('T10b dono apaga o quadro', 'delete from boards returning id', r => r.length === 1)
await as(null)
await ok('T10c cascade limpou tudo', `select (select count(*) from board_members)+(select count(*) from share_links)+(select count(*) from board_guests)
  +(select count(*) from board_docs)+(select count(*) from comment_threads)+(select count(*) from comments) as n`, r => Number(r[0].n) === 0)
await ok('T10d profiles continuam', 'select count(*)::int n from profiles', r => r[0].n === 2)

console.log(fails === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${fails} FALHA(S)`)
process.exit(fails ? 1 : 0)
