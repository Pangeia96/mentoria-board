// Gera web/src/styles/tokens.css a partir de replica/design/tokens.json.
// Uso (na raiz mentoria-board): node replica/design/build-tokens.mjs
// Duas camadas:
//   :root    --mb-*            valores crus (o /replica-brand só mexe no tokens.json)
//   @theme   --color-* etc.    mapeamento do Tailwind v4 -> classes bg-surface, text-muted...
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const t = JSON.parse(readFileSync(join(here, 'tokens.json'), 'utf8'))
const out = join(here, '..', '..', 'web', 'src', 'styles', 'tokens.css')

const root = []
const theme = []
const add = (raw, value, themeName) => {
  root.push(`  --mb-${raw}: ${value};`)
  if (themeName) theme.push(`  --${themeName}: var(--mb-${raw});`)
}

for (const [k, v] of Object.entries(t.color)) add(k, v, `color-${k}`)
for (const [k, v] of Object.entries(t.sticky)) add(`sticky-${k}`, v, `color-sticky-${k}`)
for (const [k, v] of Object.entries(t.presence)) add(`presence-${k}`, v, `color-presence-${k}`)

add('font-sans', t.font['family-sans'], 'font-sans')
add('font-hand', t.font['family-hand'], 'font-hand')

for (const [k, v] of Object.entries(t.size)) {
  add(`text-${k}`, v.font, `text-${k}`)
  add(`text-${k}-lh`, v.line, `text-${k}--line-height`)
}
for (const [k, v] of Object.entries(t.radius)) add(`radius-${k}`, v, `radius-${k}`)
for (const [k, v] of Object.entries(t.shadow)) add(`shadow-${k}`, v, `shadow-${k}`)
for (const [k, v] of Object.entries(t.motion)) add(`motion-${k}`, v)
for (const [k, v] of Object.entries(t.layout)) add(k, v)
for (const [k, v] of Object.entries(t.space)) root.push(`  --mb-space-${k}: ${v};`)

const css = `/* GERADO por replica/design/build-tokens.mjs — não edite à mão; edite tokens.json. */

:root {
${root.join('\n')}
}

/* Tailwind v4: só as cores do sistema existem (sem paleta padrão), para nunca usar hex cru. */
@theme inline {
  --color-*: initial;
  --color-transparent: transparent;
  --color-current: currentColor;
  --spacing: 4px;
  --breakpoint-sm: ${t.layout['bp-sm']};
  --breakpoint-md: ${t.layout['bp-md']};
  --breakpoint-lg: ${t.layout['bp-lg']};
  --ease-standard: var(--mb-motion-ease);
${theme.join('\n')}
}
`
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, css)

// Konva desenha em <canvas> e não lê CSS: os mesmos valores em TS.
const ts = `// GERADO por replica/design/build-tokens.mjs — não edite à mão; edite tokens.json.
export const color = ${JSON.stringify(t.color, null, 2)} as const;
export const sticky = ${JSON.stringify(t.sticky, null, 2)} as const;
export const presence = ${JSON.stringify(t.presence, null, 2)} as const;
`
writeFileSync(join(dirname(out), 'tokens.ts'), ts)
console.log(`tokens.css: ${root.length} variáveis, ${theme.length} mapeadas no Tailwind -> ${out}`)
