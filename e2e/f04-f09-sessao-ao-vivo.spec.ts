import { test, expect, login, createBoard, shareUrl, joinAsGuest, addSticky, canvasTexts, canvasItemCount, dragCanvas, waitBoard } from "./fixtures";

test.describe("F04–F09 · sessão ao vivo", () => {
  test("F04-H1/H2/H3 os dois veem o que o outro cria; F04-E1 cursor com nome", async ({ guarded: page, browser, guards }) => {
    await login(page, "Mentora Live");
    await createBoard(page, "Sessão ao vivo");
    const guest = await joinAsGuest(browser, guards, await shareUrl(page), "Aluno Live");

    await expect(page.getByRole("button", { name: "2 pessoas no quadro. Ver lista" })).toBeVisible();
    await expect(guest.getByRole("button", { name: "2 pessoas no quadro. Ver lista" })).toBeVisible();

    await addSticky(page, "Do mentor", -200, 0);
    await expect.poll(() => canvasTexts(guest)).toContain("Do mentor");
    await addSticky(guest, "Do aluno", 200, 0);
    await expect.poll(() => canvasTexts(page)).toContain("Do aluno");

    // cursor do aluno com o nome dele aparece para o mentor
    await guest.mouse.move(640, 300);
    await guest.mouse.move(660, 320);
    await expect(page.getByText("Aluno Live", { exact: true })).toBeVisible();
    await guest.context().close();
  });

  test("F04-E2 Ctrl+Z desfaz só as minhas ações", async ({ guarded: page, browser, guards }) => {
    await login(page);
    await createBoard(page, "Desfazer");
    const guest = await joinAsGuest(browser, guards, await shareUrl(page), "Aluno Undo");
    await addSticky(guest, "Sticky do aluno", 200, 0);
    await expect.poll(() => canvasTexts(page)).toContain("Sticky do aluno");
    await addSticky(page, "Sticky da mentora", -200, 0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+z");
    await expect.poll(() => canvasTexts(page)).not.toContain("Sticky da mentora");
    expect(await canvasTexts(page)).toContain("Sticky do aluno");
    await expect.poll(() => canvasTexts(guest)).not.toContain("Sticky da mentora");
    await guest.context().close();
  });

  test("F05-E1 texto longo; F05-E2 Delete e Ctrl+Z; F05-E3 Ctrl+D", async ({ guarded: page }) => {
    await login(page);
    await createBoard(page, "Stickies");
    const long = "Uma reflexão bem longa sobre carreira. ".repeat(9).trim();
    await addSticky(page, long);
    expect(await canvasItemCount(page)).toBe(1);
    // seleciona o sticky (clique no centro) e duplica
    await page.mouse.click(640, 400);
    await page.keyboard.press("Control+d");
    await expect.poll(() => canvasItemCount(page)).toBe(2);
    await page.keyboard.press("Delete");
    await expect.poll(() => canvasItemCount(page)).toBe(1);
    await page.keyboard.press("Control+z");
    await expect.poll(() => canvasItemCount(page)).toBe(2);
  });

  test("F07-H1/H2 caneta desenha e borracha apaga", async ({ guarded: page }) => {
    await login(page);
    await createBoard(page, "Caneta");
    await page.keyboard.press("p");
    await dragCanvas(page, [-150, 0], [150, 40], 20);
    await expect.poll(() => canvasItemCount(page)).toBe(1);
    await page.keyboard.press("e");
    await dragCanvas(page, [0, -60], [0, 80], 20);
    await expect.poll(() => canvasItemCount(page)).toBe(0);
  });

  test("F11-H1 lápis mágico aparece e some sozinho", async ({ guarded: page }) => {
    await login(page);
    await createBoard(page, "Lápis");
    await page.keyboard.press("k");
    await dragCanvas(page, [-200, 0], [200, 0], 25);
    const laserSegs = () => page.evaluate(() => {
      const st = (window as unknown as { Konva: { stages: { getLayers: () => { find: (s: string) => unknown[] }[] }[] } }).Konva.stages[0];
      const layers = st.getLayers();
      return layers[layers.length - 1].find("Line").length;
    });
    expect(await laserSegs()).toBeGreaterThan(0);
    expect(await canvasItemCount(page)).toBe(0); // não grava nada no quadro
    await expect.poll(laserSegs, { timeout: 5000 }).toBe(0);
  });

  test("F09-H1 o conteúdo continua depois de recarregar", async ({ guarded: page }) => {
    await login(page);
    await createBoard(page, "Persistência");
    await addSticky(page, "Fica salvo");
    await page.waitForTimeout(2500); // o servidor grava com debounce de 2s
    await page.reload();
    await waitBoard(page);
    await expect.poll(() => canvasTexts(page)).toContain("Fica salvo");
  });
});
