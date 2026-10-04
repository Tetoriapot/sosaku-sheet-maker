import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
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
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByRole("button", { name: /RP方針シート/ }).waitFor();
  await page.getByRole("button", { name: /創作企画参加前チェック/ }).waitFor();
  await page.getByRole("button", { name: /まっさらから作る/ }).click();
  await page.getByLabel("タイトル", { exact: true }).fill("比較するシート");
  const editorUrl = page.url();
  async function addQuestion(text, type = "four_level") {
    await page
      .getByRole("button", { name: "＋ 質問を追加", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("質問文", { exact: true }).fill(text);
    await dialog.getByLabel("回答形式").selectOption(type);
    await dialog
      .getByRole("button", { name: "質問を追加", exact: true })
      .click();
  }
  await addQuestion("交流の頻度");
  await addQuestion("伝えたいこと", "long");
  // Saving failure leaves the dialog and its input intact.
  await page
    .getByRole("button", { name: "＋ 質問を追加", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("質問文")
    .fill("保存失敗時に残る質問");
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "質問を追加", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("dialog").getByLabel("質問文").inputValue(),
    "保存失敗時に残る質問",
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = window.originalSetItem;
  });
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("link", { name: "回答へ進む" }).click();
  await page.getByLabel("名前・ハンドルネーム（任意）").fill("アオ");
  await page
    .locator("fieldset")
    .first()
    .getByText("◎ 大歓迎", { exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "伝えたいこと", exact: true })
    .fill("相談しながら進めたい");
  await page.getByRole("button", { name: "回答を完成する" }).click();
  await page.getByRole("heading", { name: "できました！" }).waitFor();
  const resultA = page.url();
  await page.getByRole("button", { name: "もう一度回答", exact: true }).click();
  await page.getByLabel("名前・ハンドルネーム（任意）").fill("途中の回答");
  await page.goto(resultA);
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "もう一度回答", exact: true }).click();
  assert.equal(page.url(), resultA);
  const draft = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem("sosaku-sheet-v1")).drafts,
      )[0],
  );
  assert.equal(draft.respondentName, "途中の回答");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "もう一度回答", exact: true }).click();
  assert.equal(
    await page.getByLabel("名前・ハンドルネーム（任意）").inputValue(),
    "",
  );
  await page.getByLabel("名前・ハンドルネーム（任意）").fill("ミドリ");
  await page
    .locator("fieldset")
    .first()
    .getByText("○ OK", { exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "伝えたいこと", exact: true })
    .fill("相談しながら進めたい");
  await page.getByRole("button", { name: "回答を完成する" }).click();
  await page.getByRole("heading", { name: "できました！" }).waitFor();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "回答データを保存", exact: true })
    .click();
  await (await download).saveAs("test-results/comparison-answer.json");
  const exported = JSON.parse(
    readFileSync("test-results/comparison-answer.json", "utf8"),
  );
  await page
    .getByRole("button", { name: "回答結果をURLで共有", exact: true })
    .click();
  await page.getByLabel("相手に見せる内容を確認しました").check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "共有URLを作成", exact: true })
    .click();
  const sharedInput = page.getByLabel("共有URL", { exact: true });
  await sharedInput.waitFor();
  const answerUrl = await sharedInput.inputValue();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("link", { name: "回答を比較", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "アオ・比較するシートを比較する",
      exact: true,
    })
    .check();
  await page.getByRole("table").waitFor();
  assert.equal(await page.locator("tbody tr").count(), 2);
  await page.getByLabel("違いのある項目だけ").check();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel("違いのある項目だけ").uncheck();
  await page.getByLabel("回答JSONを取り込む").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{invalid"),
  });
  await page.getByRole("alert").waitFor();
  assert.equal(await page.locator("tbody td").count(), 4);
  const imported = {
    ...exported,
    id: "imported-answer",
    respondentName: "キイロ",
  };
  await page.getByLabel("回答JSONを取り込む").setInputFiles({
    name: "answer.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await page
    .getByRole("checkbox", {
      name: "キイロ・比較するシートを比較する",
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator("tbody td").count(), 6);
  await page.getByLabel("回答結果の共有URL").fill(answerUrl);
  await page.getByRole("button", { name: "URLから取り込む" }).click();
  await page.getByText("選択中 4 / 12件", { exact: true }).waitFor();
  assert.equal(await page.locator("tbody td").count(), 8);
  const incompatible = structuredClone(exported);
  incompatible.respondentName = "異なるシート";
  incompatible.sheet.sections[0].questions[0].text = "違う質問";
  await page.getByLabel("回答JSONを取り込む").setInputFiles({
    name: "different.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(incompatible)),
  });
  const incompatibleBox = page.getByRole("checkbox", {
    name: "異なるシート・比較するシートを比較する",
    exact: true,
  });
  await incompatibleBox.waitFor();
  assert.equal(await incompatibleBox.isDisabled(), true);
  await page.screenshot({
    path: "test-results/comparison-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page
    .getByRole("heading", { name: "回答の比較", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/comparison-320.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const region = page.getByRole("region", {
    name: "回答比較表（横スクロールできます）",
  });
  assert.ok(await region.evaluate((el) => el.scrollWidth > el.clientWidth));
  await page.getByRole("combobox", { name: "表示モード" }).selectOption("dark");
  await page.screenshot({ path: "test-results/comparison-dark-320.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(editorUrl);
  await page
    .getByRole("button", { name: "＋ 質問を追加", exact: true })
    .click();
  await page
    .getByRole("button", { name: "質問ライブラリ", exact: true })
    .click();
  const lib = page.getByRole("dialog");
  await lib.getByLabel("カテゴリ").selectOption("all");
  await lib.getByLabel("質問を検索").fill("一人称");
  await lib
    .getByRole("checkbox", { name: "一人称と二人称は？", exact: true })
    .check();
  await lib.getByLabel("質問を検索").fill("落ち込んだ");
  await lib.getByRole("button", { name: "表示中をすべて選ぶ" }).click();
  await lib.getByRole("button", { name: "2件追加", exact: true }).click();
  const values = await page
    .getByLabel("回答形式")
    .evaluateAll((elements) => elements.map((e) => e.value));
  assert.deepEqual(values, ["four_level", "long", "short", "long"]);
  await page
    .getByRole("button", { name: "＋ 質問を追加", exact: true })
    .click();
  await page
    .getByRole("button", { name: "質問ライブラリ", exact: true })
    .click();
  await lib.getByLabel("カテゴリ").selectOption("all");
  await lib.getByLabel("質問を検索").fill("一人称");
  assert.equal(
    await lib
      .getByRole("checkbox", { name: "一人称と二人称は？", exact: true })
      .isDisabled(),
    true,
  );
  await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({ path: "test-results/library-320.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await lib.getByRole("button", { name: "閉じる", exact: true }).click();
  // Separate tabs share updated collections without dropping another tab's sheet.
  const other = await context.newPage();
  await other.goto(url);
  await other.getByRole("button", { name: /まっさらから作る/ }).click();
  await other.getByLabel("タイトル", { exact: true }).fill("別タブのシート");
  await page
    .getByLabel("タイトル", { exact: true })
    .fill("比較するシート・編集後");
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("sosaku-sheet-v1")).sheets,
  );
  assert.equal(saved.length, 2);
  assert.ok(saved.some((s) => s.title === "別タブのシート"));
  await other.close();
  // Both added themes render into real PNGs.
  await page.goto(resultA);
  await page.getByRole("button", { name: "PNGで保存" }).click();
  for (const theme of ["sage", "rose"]) {
    const d = page.getByRole("dialog");
    await d.getByLabel("デザイン").selectOption(theme);
    await d.getByLabel("サイズ").selectOption("square");
    await d.getByRole("button", { name: "PNGを作成", exact: true }).click();
    await d.getByRole("link", { name: "PNGを保存", exact: false }).waitFor();
    const dl = page.waitForEvent("download");
    await d.locator("a[download]").first().click();
    await (await dl).saveAs(`test-results/theme-${theme}.png`);
  }
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: comparison (local/JSON/URL, compatibility, differences, 320px/dark), library search/recommended types/duplicates, preserving failed additions and drafts, cross-tab collections, two new PNG themes.",
  );
} finally {
  await browser.close();
}
