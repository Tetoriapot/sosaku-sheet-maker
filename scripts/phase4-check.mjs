import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { cloneSheet, question } from "../src/utils/model.ts";
import { createBackup } from "../src/utils/backup.ts";
import { emptyDb } from "../src/utils/storage.ts";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const url = process.env.TEST_URL || "http://127.0.0.1:4174/sosaku-sheet-maker/";
mkdirSync("test-results", { recursive: true });
const sheet = cloneSheet();
sheet.title = "復元するシート";
sheet.author = "秘密の作者";
sheet.description = "秘密の説明";
sheet.sections[0].questions = [
  question("必須の本文", "long"),
  question("数値の質問", "slider"),
  question("任意の質問", "short"),
];
sheet.sections[0].questions[0].required = true;
const [q1, q2, q3] = sheet.sections[0].questions;
const data = emptyDb();
data.sheets = [sheet];
data.sheetMeta[sheet.id] = { tags: ["企画A", "キャラB"], archived: false };
data.answers = Array.from({ length: 12 }, (_, i) => ({
  id: crypto.randomUUID(),
  sheetId: sheet.id,
  sheet: structuredClone(sheet),
  respondentName: `回答者${i + 1}`,
  createdAt: new Date().toISOString(),
  answers: {
    [q1.id]: "回答本文",
    [q2.id]: i,
    [q3.id]: i % 2 ? "はい" : "いいえ",
  },
  comments: { [q1.id]: "秘密のコメント" },
}));
data.drafts[sheet.id] = {
  ...structuredClone(data.answers[0]),
  respondentName: "再開回答者",
  id: crypto.randomUUID(),
  answers: { [q2.id]: 0 },
};
data.draftProgress[sheet.id] = {
  questionId: q2.id,
  savedAt: new Date().toISOString(),
};
const backup = createBackup(data, url);
const file = (value, name = "backup.json") => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(value)),
});
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const apis = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) apis.push(r.url());
  });
  await page.goto(url);
  await page.getByRole("button", { name: /まっさらから作る/ }).click();
  await page.getByLabel("タイトル", { exact: true }).fill("既存シートを保持");
  await page.goto(url);
  await page
    .getByRole("button", { name: "バックアップ・復元", exact: true })
    .click();
  await page
    .getByLabel("バックアップファイルを選ぶ")
    .setInputFiles(file({ invalid: true }));
  await page.getByRole("alert").waitFor();
  await page
    .getByLabel("バックアップファイルを選ぶ")
    .setInputFiles(file(backup));
  await page.getByRole("button", { name: "既存データを残して復元" }).click();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page
    .getByRole("heading", { name: "既存シートを保持", exact: true })
    .waitFor();
  await page.getByRole("heading", { name: sheet.title, exact: true }).waitFor();
  let state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sosaku-sheet-v1")),
  );
  assert.equal(state.sheets.length, 2);
  assert.equal(state.answers.length, 12);
  await page
    .getByRole("button", { name: "バックアップ・復元", exact: true })
    .click();
  await page
    .getByLabel("バックアップファイルを選ぶ")
    .setInputFiles(file(backup));
  await page.getByRole("button", { name: "既存データを残して復元" }).click();
  const backupDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "バックアップを保存", exact: true })
    .click();
  await (await backupDownload).saveAs("test-results/phase4-backup.json");
  const restored = JSON.parse(
    readFileSync("test-results/phase4-backup.json", "utf8"),
  );
  assert.equal(restored.data.sheets.length, 2);
  assert.equal(restored.data.answers.length, 12);
  assert.equal(restored.data.shares.length, 0);
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByLabel("保存シートを検索").fill("企画A");
  assert.equal(
    await page
      .getByRole("heading", { name: "既存シートを保持", exact: true })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "整理", exact: true }).click();
  await page.getByLabel("アーカイブする", { exact: true }).check();
  await page.getByRole("button", { name: "整理を保存" }).click();
  await page
    .getByText(
      "条件に合うシートがありません。検索やタグ、表示するシートを変更してください。",
      { exact: true },
    )
    .waitFor();
  await page.getByLabel("表示するシート").selectOption("archived");
  await page.getByRole("button", { name: "整理", exact: true }).click();
  await page.getByLabel("アーカイブする", { exact: true }).uncheck();
  await page.getByRole("button", { name: "整理を保存" }).click();
  await page.getByLabel("表示するシート").selectOption("active");
  await page.getByRole("link", { name: "回答を再開", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "前回の回答位置から再開" }).click();
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    q2.text,
  );
  await page.getByRole("button", { name: "回答を完成する" }).click();
  await page.getByRole("alert").waitFor();
  await page.waitForFunction((label) => document.activeElement?.getAttribute("aria-label") === label, q1.text);
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    q1.text,
  );
  assert.equal(
    await page
      .getByLabel(q1.text, { exact: true })
      .getAttribute("aria-invalid"),
    "true",
  );
  await page.getByLabel(q1.text, { exact: true }).fill("完成した回答");
  await page.getByRole("button", { name: "回答を完成する" }).click();
  await page.getByRole("button", { name: "回答結果をファイルで共有" }).click();
  const modal = page.getByRole("dialog");
  assert.equal(
    await modal.getByRole("button", { name: "共有ファイルを保存" }).isEnabled(),
    false,
  );
  for (const name of [
    "回答者名を含める",
    "補足コメントを含める",
    "作者名を含める",
    "シートの説明を含める",
  ])
    await modal.getByLabel(name, { exact: true }).uncheck();
  assert.equal(
    await modal.getByText("秘密の作者", { exact: false }).count(),
    0,
  );
  await modal.getByLabel("相手に見せる内容を確認しました").check();
  const sharedDownload = page.waitForEvent("download");
  await modal.getByRole("button", { name: "共有ファイルを保存" }).click();
  await (await sharedDownload).saveAs("test-results/phase4-shared.json");
  const shared = JSON.parse(
    readFileSync("test-results/phase4-shared.json", "utf8"),
  );
  assert.equal(shared.data.respondentName, "");
  assert.deepEqual(shared.data.comments, {});
  assert.equal(shared.data.sheet.author, "");
  assert.equal(shared.data.sheet.description, "");
  await page.screenshot({ path: "test-results/phase4-share-desktop.png" });
  await modal.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.goto(`${url}#/compare`);
  for (let i = 1; i <= 12; i++)
    await page
      .getByRole("checkbox", {
        name: `回答者${i}・${sheet.title}を比較する`,
        exact: true,
      })
      .check();
  await page.getByText("選択中 12 / 12件", { exact: true }).waitFor();
  assert.equal(await page.locator("tbody td").count(), 36);
  await page.getByLabel("比較する質問を検索").fill("数値");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel("比較する質問を検索").fill("");
  await page
    .locator("summary")
    .filter({ hasText: "比較する質問を選ぶ" })
    .click();
  await page.getByRole("button", { name: "すべて非表示" }).click();
  assert.equal(await page.getByRole("table").count(), 0);
  await page.getByRole("button", { name: "すべて表示" }).click();
  const different = structuredClone(data.answers[0]);
  different.respondentName = "比較不可";
  different.sheet.sections[0].questions[1].text = "別の数値";
  await page.getByLabel("回答JSONを取り込む").setInputFiles(file(different));
  await page.getByText(/2問目の質問文・順序が異なります/).waitFor();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByLabel("表示モード").selectOption("dark");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: "test-results/phase4-comparison-320.png" });
  await page.goto(url);
  await page
    .getByRole("button", { name: "バックアップ・復元", exact: true })
    .click();
  await page.screenshot({ path: "test-results/phase4-backup-320.png" });
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("link", { name: "Help", exact: true }).click();
  await page.reload();
  await page
    .getByRole("heading", { name: "質問シートを、かんたんに。" })
    .waitFor();
  await page.getByRole("link", { name: "本文へ移動" }).focus();
  await page.keyboard.press("Enter");
  assert.ok(page.url().endsWith("#/help"));
  const guest = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await guest.goto(url);
  await guest
    .getByRole("button", { name: "共有ファイルを開く", exact: true })
    .click();
  await guest
    .getByLabel("共有JSONファイル")
    .setInputFiles(file(shared, "shared.json"));
  await guest.getByRole("button", { name: "回答を保存して開く" }).click();
  await guest.reload();
  await guest
    .getByRole("heading", { name: sheet.title, exact: true })
    .waitFor();
  await guest.goto(url);
  await guest
    .getByRole("button", { name: "バックアップ・復元", exact: true })
    .click();
  await guest
    .getByLabel("バックアップファイルを選ぶ")
    .setInputFiles(file(backup));
  const beforeFailure = await guest.evaluate(() =>
    localStorage.getItem("sosaku-sheet-v1"),
  );
  await guest.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await guest.getByRole("button", { name: "既存データを残して復元" }).click();
  await guest.getByRole("alert").waitFor();
  assert.equal(
    await guest.evaluate(() => localStorage.getItem("sosaku-sheet-v1")),
    beforeFailure,
  );
  assert.deepEqual(apis, []);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      backup: "roundtrip, additive restore, duplicate preservation",
      sharing: "redacted file download and independent import",
      resume: "reload and required error focus",
      organize: "search, tags, archive restore",
      compare: "12 people, question filters, mismatch details",
      pages: "hash route reload, no API requests, 320px dark",
      errors,
    }),
  );
} finally {
  await browser.close();
}
