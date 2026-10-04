import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
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
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(url);
  await page.getByRole("button", { name: /まっさらから作る/ }).click();
  const types = [
    "four_level",
    "five_level",
    "slider",
    "single",
    "multiple",
    "short",
    "long",
    "yes_no",
  ];
  for (const type of types) {
    await page
      .getByRole("button", { name: "＋ 質問を追加", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("質問文").fill(type);
    await dialog.getByLabel("回答形式").selectOption(type);
    await dialog
      .getByRole("button", { name: "質問を追加", exact: true })
      .click();
  }
  // Keyboard drag verifies the actual dnd-kit sensor rather than only the fallback buttons.
  const first = page.getByRole("button", {
    name: "質問1を並び替える",
    exact: true,
  });
  await first.focus();
  await page.keyboard.press("Space");
  await page.waitForFunction(() =>
    document.querySelector("[aria-pressed=true]"),
  );
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  assert.equal(
    await page.getByLabel("質問文", { exact: true }).first().inputValue(),
    "five_level",
  );
  await page
    .getByRole("button", { name: "＋ 質問を追加", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "質問ライブラリ" }).click();
  await dialog.getByLabel("恋愛関係", { exact: true }).check();
  await dialog.getByLabel("片思い", { exact: true }).check();
  await dialog.getByRole("button", { name: "2件追加" }).click();
  assert.equal(await page.getByLabel("質問文", { exact: true }).count(), 10);
  await page.getByLabel("回答形式").first().selectOption("long");
  await page.getByLabel("回答形式").first().selectOption("five_level");
  await page.getByRole("link", { name: "回答へ進む" }).click();
  const field = (text) =>
    page
      .locator("fieldset")
      .filter({ has: page.locator("legend").filter({ hasText: text }) });
  await field("four_level").getByText("○ OK", { exact: true }).click();
  await field("five_level").getByText("5", { exact: true }).click();
  await field("slider")
    .getByRole("button", { name: "50（中間）で回答" })
    .click();
  await field("slider").getByRole("slider").fill("0");
  await field("single").getByText("選択肢 B", { exact: true }).click();
  await field("multiple").getByText("選択肢 A", { exact: true }).click();
  await field("multiple").getByText("選択肢 C", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "short", exact: true })
    .fill("短い回答");
  const longText =
    "日本語の長文と絵文字🌸、英数字ABC123。".repeat(140) +
    "\n二行目も保存します。";
  await page.getByRole("textbox", { name: "long", exact: true }).fill(longText);
  await field("yes_no").getByText("YES", { exact: true }).click();
  await field("short").getByText("補足コメントを書く").click();
  await page.getByLabel("shortの補足コメント").fill("この補足も表示します。");
  await page.reload();
  assert.equal(
    await page.getByRole("textbox", { name: "long", exact: true }).inputValue(),
    longText,
  );
  await page.getByRole("button", { name: "回答を完成する" }).click();
  await page.getByRole("heading", { name: "できました！" }).waitFor();
  await page.getByText("0 / 100", { exact: true }).waitFor();
  await page.getByText("選択肢 A、選択肢 C", { exact: true }).waitFor();
  await page.getByText("この補足も表示します。", { exact: true }).waitFor();
  await page.getByRole("button", { name: "PNGで保存" }).click();
  const exportDialog = page.getByRole("dialog");
  for (const [size, theme, height] of [
    ["portrait", "dark", 1350],
    ["story", "notebook", 1920],
    ["auto", "mono", null],
  ]) {
    await exportDialog.getByLabel("サイズ").selectOption(size);
    await exportDialog.getByLabel("デザイン").selectOption(theme);
    await exportDialog
      .getByRole("button", { name: "PNGを作成", exact: true })
      .click();
    await exportDialog
      .getByRole("button", { name: "PNGを作成", exact: true })
      .waitFor({ state: "visible" });
    const image = exportDialog.locator("img").first();
    await image.waitFor();
    await page.waitForFunction(() => {
      const img = document.querySelector("dialog img");
      return img && img.complete && img.naturalWidth > 0;
    });
    const dim = await image.evaluate((el) => [
      el.naturalWidth,
      el.naturalHeight,
    ]);
    assert.equal(dim[0], 1080);
    if (height) assert.equal(dim[1], height);
    const download = page.waitForEvent("download");
    await exportDialog.locator("a[download]").first().click();
    await (await download).saveAs(`test-results/export-${size}-${theme}.png`);
  }
  await exportDialog
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  // A mobile context checks answer hit targets and light/dark views with long content.
  await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({ path: "test-results/result-long-320.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole("link", { name: "ホームへ", exact: true }).click();
  await page
    .getByRole("heading", { name: "テンプレートからはじめる" })
    .waitFor();
  await page.screenshot({ path: "test-results/home-light-320-viewport.png" });
  await page.getByRole("combobox", { name: "表示モード" }).selectOption("dark");
  await page.screenshot({ path: "test-results/home-dark-320-viewport.png" });
  await page.getByRole("link", { name: "編集", exact: true }).click();
  // Storage failure must leave the previous saved data intact and give actionable feedback.
  const before = await page
    .getByLabel("タイトル", { exact: true })
    .inputValue();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.getByLabel("タイトル", { exact: true }).fill("保存失敗テスト");
  await page
    .getByRole("status")
    .getByText(/保存できませんでした/)
    .waitFor();
  await page.reload();
  assert.equal(
    await page.getByLabel("タイトル", { exact: true }).inputValue(),
    before,
  );
  await page.goto(`${url}/result/nonexistent`);
  await page
    .getByRole("heading", { name: "シートが見つかりませんでした。" })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 8 input types, keyboard drag, library batch, 0 slider, multiple selections, comments, long Japanese text, PNG themes/sizes, storage failure, missing IDs, no console errors.",
  );
} finally {
  await browser.close();
}
