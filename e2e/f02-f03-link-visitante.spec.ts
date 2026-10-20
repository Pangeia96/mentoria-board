import { test, expect, login, createBoard, shareUrl, joinAsGuest, waitBoard, axe } from "./fixtures";

test.describe("F02/F03 · link de compartilhar e entrada do visitante", () => {
  test("F02-H1/E1 o link é estável; F03-H1 visitante entra; F02-N1 sem Compartilhar para o visitante", async ({ guarded: page, browser, guards }) => {
    await login(page);
    await createBoard(page, "Quadro compartilhado");
    const url = await shareUrl(page);
    expect(await shareUrl(page)).toBe(url);

    const guest = await joinAsGuest(browser, guards, url, "Ana Visitante");
    await expect(guest.getByRole("button", { name: "Compartilhar" })).toHaveCount(0);
    await expect(guest.getByRole("button", { name: "Voltar aos quadros" })).toHaveCount(0);
    await axe(guest, "S04 quadro (visitante)");
    await guest.context().close();
  });

  test("F03-E1 nome vazio; F03-E2 acento e emoji; F03-E3 voltar pelo link não pede nome de novo", async ({ guarded: page, browser, guards }) => {
    await login(page);
    await createBoard(page, "Quadro nomes");
    const url = await shareUrl(page);

    const ctx = await browser.newContext();
    const g = await ctx.newPage();
    await g.goto(url);
    await axe(g, "S06 entrada do visitante");
    await g.getByRole("button", { name: "Entrar no quadro" }).click();
    await expect(g.getByText("Digite como você quer aparecer no quadro.")).toBeVisible();
    await g.getByLabel("Como você quer aparecer?").fill("João 🎯 Ção");
    await g.getByRole("button", { name: "Entrar no quadro" }).click();
    await waitBoard(g);
    await g.getByRole("button", { name: /no quadro\. Ver lista/ }).click();
    await expect(g.getByRole("dialog").getByText("João 🎯 Ção")).toBeVisible();

    await g.goto(url);
    await expect(g).toHaveURL(/\/b\//);
    await waitBoard(g);
    void guards;
    await ctx.close();
  });

  test("F03-N1 link inexistente mostra S07", async ({ guarded: page }) => {
    await page.goto("/j/0123456789abcdef0123456789abcdef0123456789abcdef");
    await expect(page.getByRole("heading", { name: "Este link não funciona mais" })).toBeVisible();
    await axe(page, "S07 link inválido");
  });

  test("F02-E2 gerar link novo: o antigo para de funcionar", async ({ guarded: page, browser }) => {
    await login(page);
    await createBoard(page, "Quadro link novo");
    const oldUrl = await shareUrl(page);
    await page.getByRole("button", { name: "Compartilhar" }).click();
    await page.getByRole("button", { name: "Gerar link novo" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Gerar link novo" }).last().click();
    const input = page.getByRole("textbox", { name: "Link do quadro" });
    await expect(input).not.toHaveValue(oldUrl);
    await expect(input).toHaveValue(/\/j\/[0-9a-f]{48}$/);

    const ctx = await browser.newContext();
    const g = await ctx.newPage();
    await g.goto(oldUrl);
    await expect(g.getByRole("heading", { name: "Este link não funciona mais" })).toBeVisible();
    await ctx.close();
  });
});
