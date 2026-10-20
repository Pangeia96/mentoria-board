import { test, expect, login, createBoard, canvasTexts, clickCanvas, waitBoard } from "./fixtures";

test.describe("F12 · frames, imagens, exportar e menu do quadro", () => {
  test("F12-H1 frame com F + clique", async ({ guarded: page }) => {
    await login(page);
    await createBoard(page, "Frames");
    await page.keyboard.press("f");
    await clickCanvas(page, 0, 0);
    await expect.poll(() => canvasTexts(page)).toContain("Frame 1");
  });

  test("F12-H2 soltar PNG cria imagem; F12-N1 imagem sem cookie dá 403", async ({ guarded: page, playwright, baseURL }) => {
    await login(page);
    await createBoard(page, "Imagens");
    await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 300; c.height = 200;
      const x = c.getContext("2d")!;
      x.fillStyle = "#C6DEFF"; x.fillRect(0, 0, 300, 200);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "teste.png", { type: "image/png" }));
      const target = document.querySelector(".konvajs-content")!.parentElement!;
      const opts = { dataTransfer: dt, bubbles: true, cancelable: true, clientX: 640, clientY: 400 };
      target.dispatchEvent(new DragEvent("dragover", opts));
      target.dispatchEvent(new DragEvent("drop", opts));
    });
    let src = "";
    await expect
      .poll(async () => (src = await page.evaluate(() => (window as unknown as { Konva: { stages: { find: (s: string) => { image: () => HTMLImageElement }[] }[] } }).Konva.stages[0].find("Image")[0]?.image()?.src ?? "")), { timeout: 15_000 })
      .toMatch(/\/api\/assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/);
    const anon = await playwright.request.newContext({ baseURL });
    expect((await anon.get(new URL(src).pathname)).status()).toBe(403);
    await anon.dispose();
  });

  test("F12-H3 baixar PNG gera um arquivo .png", async ({ guarded: page }) => {
    await login(page);
    await createBoard(page, "Exportar Sessão");
    await page.keyboard.press("n");
    await clickCanvas(page);
    await page.keyboard.type("Para exportar");
    await page.keyboard.press("Escape");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar como imagem (PNG)" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("Exportar Sessão.png");
  });

  test("F12-H4 renomear e duplicar pelo menu do quadro", async ({ guarded: page }) => {
    await login(page);
    await createBoard(page, "Original");
    await page.getByRole("button", { name: "Opções do quadro Original" }).click();
    await page.getByRole("menuitem", { name: "Renomear" }).click();
    const name = page.getByRole("dialog", { name: "Renomear quadro" }).getByLabel("Nome do quadro");
    await expect(name).toBeFocused();
    await name.fill("Renomeado");
    await name.press("Enter");
    await expect(page.getByRole("button", { name: "Opções do quadro Renomeado" })).toBeVisible();

    await page.getByRole("button", { name: "Opções do quadro Renomeado" }).click();
    await page.getByRole("menuitem", { name: "Duplicar" }).click();
    await expect(page).toHaveTitle(/Renomeado \(cópia\)/);
    await waitBoard(page);
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^Renomeado/ })).toHaveCount(2);
  });
});
