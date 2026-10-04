import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const url = process.env.TEST_URL || "http://127.0.0.1:5174";
mkdirSync("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto(url);
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /うちよそ温度感シート/ }).click();
  await page.getByRole("button", { name: "このテンプレを使う" }).click();
  await page.getByRole("heading", { name: "シートを編集" }).waitFor();
  const title = page.getByLabel("タイトル", { exact: true });
  await title.fill("テスト：創作温度感");
  await page.reload();
  await title.waitFor();
  assert.equal(await title.inputValue(), "テスト：創作温度感");
  await page
    .getByRole("button", { name: "＋ 質問を追加", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("質問文").fill("好きな色は？");
  await page.getByRole("dialog").getByLabel("回答形式").selectOption("short");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "質問を追加", exact: true })
    .click();
  await page
    .getByRole("button", { name: "＋ セクション追加", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("セクション名", { exact: true }).count(),
    3,
  );
  const first = page.locator('[class*="question_"]').first();
  await first.getByRole("button", { name: "複製", exact: true }).click();
  assert.equal(await page.getByLabel("質問文", { exact: true }).count(), 26);
  await first.getByRole("button", { name: "後へ移動" }).click();
  await page.getByLabel("質問文", { exact: true }).first().fill("必須のテスト");
  const requiredCard = page.locator('[class*="question_"]').first();
  await requiredCard.locator("summary").click();
  await requiredCard.getByLabel("必須回答にする").check();
  await page.screenshot({
    path: "test-results/editor-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "回答へ進む" }).click();
  await page.getByLabel("名前・ハンドルネーム（任意）").fill("テスター");
  await page.getByRole("button", { name: "回答を完成する" }).click();
  await page.getByText("この質問に回答してください。").waitFor();
  await page
    .locator("fieldset")
    .first()
    .getByText("◎ 大歓迎", { exact: true })
    .click();
  await page.getByLabel("好きな色は？", { exact: true }).fill("紫");
  await page.reload();
  assert.equal(
    await page.getByLabel("好きな色は？", { exact: true }).inputValue(),
    "紫",
  );
  await page.getByRole("button", { name: "回答を完成する" }).click();
  await page.getByRole("heading", { name: "できました！" }).waitFor();
  await page.getByRole("button", { name: "PNGで保存" }).click();
  await page.getByRole("dialog").getByLabel("サイズ").selectOption("square");
  await page.getByRole("button", { name: "PNGを作成", exact: true }).click();
  const image = page.getByRole("dialog").locator("img").first();
  await image.waitFor();
  const dimensions = await image.evaluate(
    (el) =>
      new Promise((resolve) => {
        if (el.complete) resolve([el.naturalWidth, el.naturalHeight]);
        else el.onload = () => resolve([el.naturalWidth, el.naturalHeight]);
      }),
  );
  assert.deepEqual(dimensions, [1080, 1080]);
  assert.ok((await page.getByRole("dialog").locator("img").count()) > 1);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "1枚目を保存" }).click();
  await (await download).saveAs("test-results/export-square.png");
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.screenshot({
    path: "test-results/result-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "ホームへ", exact: true }).click();
  await page.getByRole("link", { name: "編集", exact: true }).click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({
      path: `test-results/editor-${width}.png`,
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.getByRole("button", { name: "プレビュー", exact: true }).click();
    await page.screenshot({
      path: `test-results/preview-${width}.png`,
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.getByRole("button", { name: "編集", exact: true }).click();
  }
  await page.getByRole("combobox", { name: "表示モード" }).selectOption("dark");
  await page.screenshot({
    path: "test-results/editor-dark-320.png",
    fullPage: true,
  });
  assert.equal(await page.locator("html").getAttribute("data-mode"), "dark");
  await page
    .getByRole("link", { name: /創作シートメーカー/ })
    .first()
    .click();
  await page.screenshot({
    path: "test-results/home-dark-320.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: template → editing → reload persistence → required validation → answering → paginated 1080px PNG download; 320/390px layouts; dark mode; no console errors.",
  );
} finally {
  await browser.close();
}
