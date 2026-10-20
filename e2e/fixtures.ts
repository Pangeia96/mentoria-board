// Base de todas as specs: falha com erro no console ou resposta 5xx; helpers de login, quadro, canvas e axe.
import { test as base, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Mensagens que não são bug do app (rede do dev, reconexão esperada após expulsão, etc.)
const IGNORE = [
  /Failed to load resource: the server responded with a status of 40[134]/, // 401/403/404 esperados em testes negativos
  /WebSocket connection to .* failed/, // reconexão depois de expulsão / fim do teste
  /Download the React DevTools/,
];

type Guard = { errors: string[] };

function guard(page: Page): Guard {
  const g: Guard = { errors: [] };
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORE.some((r) => r.test(m.text()))) g.errors.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => g.errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) g.errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  return g;
}

export const test = base.extend<{ guarded: Page; guards: Guard[] }>({
  guards: async ({}, use) => {
    const list: Guard[] = [];
    await use(list);
    const errors = list.flatMap((g) => g.errors);
    expect(errors, "erros de console / 5xx durante o teste").toEqual([]);
  },
  guarded: async ({ page, guards }, use) => {
    guards.push(guard(page));
    await use(page);
  },
});
export { expect };

let seq = 0;
export const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Login de dev (modo sem Supabase). */
export async function login(page: Page, name = "Mentora Teste", email = `mentora.${uid()}@exemplo.test`) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Seu nome").fill(name);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Seus quadros" })).toBeVisible();
  return { name, email };
}

/** Cria um quadro pelo painel e espera o canvas sincronizar. */
export async function createBoard(page: Page, title: string, client = "") {
  await page.getByRole("button", { name: "Novo quadro" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo quadro" });
  await dialog.getByLabel("Nome do quadro").fill(title);
  if (client) await dialog.getByLabel("Mentorado (opcional)").fill(client);
  await dialog.getByRole("button", { name: "Criar quadro" }).click();
  await page.waitForURL(/\/b\/[0-9a-f-]{36}$/);
  await waitBoard(page);
  return page.url().split("/b/")[1];
}

/** Espera o quadro abrir e sincronizar com o tempo real. */
export async function waitBoard(page: Page) {
  await expect(page.getByRole("application", { name: /^Quadro / })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Carregando o quadro…")).toHaveCount(0, { timeout: 20_000 });
}

export async function shareUrl(page: Page) {
  await page.getByRole("button", { name: "Compartilhar" }).click();
  const input = page.getByRole("textbox", { name: "Link do quadro" });
  await expect(input).toHaveValue(/\/j\/[0-9a-f]{48}$/);
  const url = await input.inputValue();
  await page.keyboard.press("Escape");
  return url;
}

/** Um segundo navegador (contexto sem cookies) entra pelo link como visitante. */
export async function joinAsGuest(browser: Browser, guards: Guard[], url: string, name: string) {
  const ctx = await browser.newContext({ locale: "pt-BR", viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  guards.push(guard(page));
  await page.goto(url);
  await page.getByLabel("Como você quer aparecer?").fill(name);
  await page.getByRole("button", { name: "Entrar no quadro" }).click();
  await waitBoard(page);
  return page;
}

/** Textos desenhados no canvas (Konva não tem DOM por objeto). */
export async function canvasTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const st = (window as unknown as { Konva?: { stages: { find: (s: string) => { text: () => string }[] }[] } }).Konva?.stages?.[0];
    return st ? st.find("Text").map((t) => t.text()).filter((t) => t.trim()) : [];
  });
}

/** Quantos objetos (grupos com id) existem no canvas. */
export async function canvasItemCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const st = (window as unknown as { Konva?: { stages: { find: (s: string) => { id: () => string }[] }[] } }).Konva?.stages?.[0];
    return st ? st.find("Group").filter((g) => g.id()).length : 0;
  });
}

/** Clica no canvas a partir do centro da tela (dx, dy em px). */
export async function clickCanvas(page: Page, dx = 0, dy = 0) {
  const vp = page.viewportSize()!;
  await page.mouse.click(vp.width / 2 + dx, vp.height / 2 + dy);
}

export async function dragCanvas(page: Page, from: [number, number], to: [number, number], steps = 12) {
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width / 2 + from[0], vp.height / 2 + from[1]);
  await page.mouse.down();
  await page.mouse.move(vp.width / 2 + to[0], vp.height / 2 + to[1], { steps });
  await page.mouse.up();
}

/** Cria um sticky com texto no ponto (a partir do centro). */
export async function addSticky(page: Page, text: string, dx = 0, dy = 0) {
  await page.keyboard.press("n");
  await clickCanvas(page, dx, dy);
  const editor = page.getByRole("textbox", { name: "Texto do sticky" });
  await expect(editor).toBeFocused();
  await editor.fill(text);
  await page.keyboard.press("Escape");
  await expect.poll(() => canvasTexts(page)).toContain(text);
}

/** Varredura de acessibilidade (WCAG 2.1 A/AA). O canvas é ignorado (desenho, não DOM). */
export async function axe(page: Page, label: string) {
  const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude(".konvajs-content").analyze();
  const found = res.violations.map((v) => `${label}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length}x: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")})`);
  expect(found, `violações de acessibilidade em ${label}`).toEqual([]);
}
