import { test, expect, login, createBoard, shareUrl, joinAsGuest, addSticky, clickCanvas, axe } from "./fixtures";
import type { Page } from "@playwright/test";

async function setLinkRole(page: Page, label: "Pode editar" | "Pode comentar" | "Só ver") {
  await page.getByRole("button", { name: "Compartilhar" }).click();
  await page.getByRole("combobox", { name: "Papel de quem tem o link" }).click();
  await page.getByRole("option", { name: label }).click();
  await expect(page.getByRole("combobox", { name: "Papel de quem tem o link" })).toHaveText(new RegExp(label));
}

test.describe("F08 · comentários", () => {
  test("F08-H1/H2 comentário aparece para o outro sem recarregar; F08-E1 resolver", async ({ guarded: page, browser, guards }) => {
    await login(page, "Mentora Coment");
    await createBoard(page, "Comentários");
    const guest = await joinAsGuest(browser, guards, await shareUrl(page), "Aluna Coment");
    await addSticky(page, "Ponto a discutir");

    await page.keyboard.press("c");
    await clickCanvas(page, 0, 0);
    const box = page.getByRole("textbox", { name: "Escreva um comentário" });
    await expect(box).toBeFocused();
    await box.fill("Vamos aprofundar isso na próxima sessão?");
    await box.press("Control+Enter");
    await expect(page.getByRole("button", { name: /Comentário de Mentora Coment, 1 mensagem/ })).toBeVisible();
    await axe(page, "S08 conversa aberta");

    await expect(guest.getByRole("button", { name: /Comentário de Mentora Coment/ })).toBeVisible();
    await expect(guest.getByRole("button", { name: "Comentários (1)" })).toBeVisible();

    await page.getByRole("button", { name: "Resolver" }).click();
    await expect(page.getByRole("button", { name: /Comentário de Mentora Coment/ })).toHaveCount(0);
    await expect(guest.getByRole("button", { name: /Comentário de Mentora Coment/ })).toHaveCount(0);
    await guest.context().close();
  });
});

test.describe("F10 · revogar e restringir acesso", () => {
  test("F10-H1 'Só ver' vale na hora; F08-N1 sem ferramenta de comentário", async ({ guarded: page, browser, guards }) => {
    await login(page);
    await createBoard(page, "Permissões");
    const guest = await joinAsGuest(browser, guards, await shareUrl(page), "Aluno Viewer");
    await expect(guest.getByRole("button", { name: "Sticky" })).toBeVisible();

    await setLinkRole(page, "Só ver");
    await page.keyboard.press("Escape");
    // sem recarregar: a interface do aluno tem de virar só leitura na hora
    await expect(guest.getByText("Você está só visualizando")).toBeVisible({ timeout: 15_000 });
    await expect(guest.getByRole("button", { name: "Sticky" })).toHaveCount(0);
    await expect(guest.getByRole("button", { name: "Comentário" })).toHaveCount(0);
    await guest.context().close();
  });

  test("F10-H2 remover o visitante o expulsa na hora", async ({ guarded: page, browser, guards }) => {
    await login(page);
    await createBoard(page, "Expulsar");
    const guest = await joinAsGuest(browser, guards, await shareUrl(page), "Aluno Expulso");
    await page.getByRole("button", { name: "Compartilhar" }).click();
    const dialog = page.getByRole("dialog", { name: "Compartilhar quadro" });
    await expect(dialog.getByText("Aluno Expulso")).toBeVisible();
    await dialog.getByRole("button", { name: "Remover" }).click();
    await expect(dialog.getByText("Ninguém entrou por este link ainda.")).toBeVisible();
    await expect(guest.getByRole("heading", { name: "Não foi possível abrir o quadro" })).toBeVisible({ timeout: 15_000 });
    await guest.context().close();
  });

  test("F10-E1 quadro na lixeira tira quem estava dentro", async ({ guarded: page, browser, guards }) => {
    await login(page);
    await createBoard(page, "Lixeira");
    const guest = await joinAsGuest(browser, guards, await shareUrl(page), "Aluno Lixeira");
    await page.getByRole("button", { name: "Opções do quadro Lixeira" }).click();
    await page.getByRole("menuitem", { name: "Mover para a lixeira" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Mover para a lixeira" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: /Lixeira/ })).toHaveCount(0);
    await expect(guest.getByRole("heading", { name: "Não foi possível abrir o quadro" })).toBeVisible({ timeout: 15_000 });
    await guest.context().close();
  });
});
