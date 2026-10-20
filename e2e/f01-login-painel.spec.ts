import { test, expect, login, createBoard, axe, uid } from "./fixtures";

test.describe("F01 · mentor entra e cria quadros", () => {
  test("F01-N2 sem login vai para /login; F01-N1 e-mail inválido mostra erro", async ({ guarded: page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await axe(page, "S01 login");
    await page.getByLabel("E-mail").fill("isso-nao-e-email");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Digite um e-mail válido.")).toBeVisible();
  });

  test("F01-H1/H2 painel vazio → criar quadro → aparece no painel", async ({ guarded: page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "Nenhum quadro ainda" })).toBeVisible();
    await axe(page, "S02 painel vazio");
    const title = `Plano ${uid()}`;
    await createBoard(page, title, "Cliente Exemplo");
    await expect(page.getByText("Quadro em branco")).toBeVisible();
    await axe(page, "S04 quadro vazio");
    await page.getByRole("button", { name: "Voltar aos quadros" }).click();
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
    await expect(page.getByText(/Cliente Exemplo · editado/)).toBeVisible();
    await axe(page, "S02 painel com quadro");
  });

  test("F01-E1 nome vazio; F01-E3 limite de 120; F01-E2 acento e emoji", async ({ guarded: page }) => {
    await login(page);
    await page.getByRole("button", { name: "Novo quadro" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo quadro" });
    await axe(page, "S03 novo quadro");
    await dialog.getByRole("button", { name: "Criar quadro" }).click();
    await expect(dialog.getByText("Dê um nome ao quadro.")).toBeVisible();
    await dialog.getByLabel("Nome do quadro").fill("x".repeat(150));
    await expect(dialog.getByLabel("Nome do quadro")).toHaveValue("x".repeat(120));
    await dialog.getByLabel("Nome do quadro").fill("Sessão 🚀 Ação");
    await dialog.getByRole("button", { name: "Criar quadro" }).click();
    await page.waitForURL(/\/b\//);
    await expect(page).toHaveTitle(/Sessão 🚀 Ação/);
  });

  test("F01-E4 duplo clique em Criar cria um quadro só", async ({ guarded: page }) => {
    await login(page);
    await page.getByRole("button", { name: "Novo quadro" }).click();
    const dialog = page.getByRole("dialog", { name: "Novo quadro" });
    await dialog.getByLabel("Nome do quadro").fill("Duplo clique");
    await dialog.getByRole("button", { name: "Criar quadro" }).dblclick();
    await page.waitForURL(/\/b\//);
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Duplo clique/ })).toHaveCount(1);
  });

  test("F01-E5 busca por título e por mentorado", async ({ guarded: page }) => {
    await login(page);
    for (const [t, c] of [["Roda da vida", "Ana"], ["Metas 2027", "Bruno"]]) {
      await createBoard(page, t, c);
      await page.goto("/");
    }
    const search = page.getByRole("textbox", { name: "Buscar quadros" });
    await search.fill("roda");
    await search.press("Enter");
    await expect(page.getByRole("link", { name: /Roda da vida/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Metas 2027/ })).toHaveCount(0);
    await search.fill("bruno");
    await search.press("Enter");
    await expect(page.getByRole("link", { name: /Metas 2027/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Roda da vida/ })).toHaveCount(0);
    await search.fill("nada-assim");
    await search.press("Enter");
    await expect(page.getByRole("heading", { name: "Nada encontrado" })).toBeVisible();
  });

  test("F01-N3/N4 outro mentor não vê nem abre os quadros do primeiro", async ({ guarded: page, browser }) => {
    await login(page, "Mentora A");
    const id = await createBoard(page, "Quadro só da A");
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await login(other, "Mentor B");
    await expect(other.getByRole("heading", { name: "Nenhum quadro ainda" })).toBeVisible();
    await other.goto(`/b/${id}`);
    await expect(other.getByRole("heading", { name: "Você não tem acesso a este quadro" })).toBeVisible();
    await ctx.close();
  });

  test("F01-E6 painel em 390px sem rolagem horizontal", async ({ guarded: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await createBoard(page, "Quadro no celular", "Cliente com nome bem comprido para testar o corte");
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
