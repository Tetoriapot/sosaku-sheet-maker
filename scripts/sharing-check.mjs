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
  const ownerContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const viewerContext = await browser.newContext({
    viewport: { width: 320, height: 844 },
  });
  const owner = await ownerContext.newPage();
  const guest = await guestContext.newPage();
  const viewer = await viewerContext.newPage();
  const errors = [];
  for (const page of [owner, guest, viewer])
    page.on("pageerror", (e) => errors.push(e.message));
  await owner.goto(url);
  await owner.getByRole("button", { name: /うちよそ温度感シート/ }).click();
  await owner.getByRole("button", { name: "このテンプレを使う" }).click();
  await owner
    .getByLabel("タイトル", { exact: true })
    .fill("共有テスト・交流スタンス");
  const localEditor = owner.url();
  await owner
    .getByRole("button", { name: "シートを共有", exact: true })
    .click();
  const dialog = owner.getByRole("dialog");
  await dialog.getByLabel("相手に見せる内容を確認しました").check();
  await dialog
    .getByRole("button", { name: "共有URLを作成", exact: true })
    .click();
  await dialog.getByLabel("共有URL", { exact: true }).waitFor();
  const sheetUrl = await dialog
    .getByLabel("共有URL", { exact: true })
    .inputValue();
  assert.match(sheetUrl, /\/s\/pub_/);
  await owner.screenshot({ path: "test-results/share-modal-desktop.png" });
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  // The local original can change, while the public URL continues to show its snapshot.
  await owner
    .getByLabel("タイトル", { exact: true })
    .fill("編集後のローカルシート");
  await guest.goto(sheetUrl);
  await guest
    .getByRole("heading", { name: "共有テスト・交流スタンス", exact: true })
    .waitFor();
  assert.equal(
    await guest
      .getByRole("button", { name: "シートを共有", exact: true })
      .count(),
    0,
  );
  assert.equal(await guest.getByRole("textbox").count(), 0);
  assert.equal(
    await guest.evaluate(() => localStorage.getItem("sosaku-sheet-v1")),
    null,
  );
  await guest.screenshot({ path: "test-results/shared-sheet-mobile.png" });
  assert.ok(
    await guest.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await guest.getByRole("link", { name: "このシートに回答" }).click();
  await guest.getByLabel("名前・ハンドルネーム（任意）").fill("共有先の人");
  await guest
    .locator("fieldset")
    .first()
    .getByText("◎ 大歓迎", { exact: true })
    .click();
  await guest.reload();
  assert.equal(
    await guest.getByLabel("名前・ハンドルネーム（任意）").inputValue(),
    "共有先の人",
  );
  await guest.getByRole("button", { name: "回答を完成する" }).click();
  await guest.getByRole("heading", { name: "できました！" }).waitFor();
  const resultLocalUrl = guest.url();
  const state = await guest.evaluate(() =>
    JSON.parse(localStorage.getItem("sosaku-sheet-v1")),
  );
  assert.equal(state.shares.length, 0);
  assert.equal(state.sheets.length, 0);
  assert.equal(state.answers.length, 1);
  await guest
    .getByRole("button", { name: "回答結果をURLで共有", exact: true })
    .click();
  await guest.getByLabel("相手に見せる内容を確認しました").check();
  await guest
    .getByRole("dialog")
    .getByRole("button", { name: "共有URLを作成", exact: true })
    .click();
  await guest.getByLabel("共有URL", { exact: true }).waitFor();
  const answerUrl = await guest
    .getByLabel("共有URL", { exact: true })
    .inputValue();
  assert.match(answerUrl, /\/result\/pub_/);
  await guest.getByRole("button", { name: "閉じる", exact: true }).click();
  await viewer.goto(answerUrl);
  await viewer
    .getByRole("heading", { name: "回答結果", exact: true })
    .waitFor();
  await viewer.getByText("回答：共有先の人", { exact: true }).waitFor();
  assert.equal(
    await viewer
      .getByRole("button", { name: "回答結果をURLで共有", exact: true })
      .count(),
    0,
  );
  assert.equal(await viewer.getByRole("textbox").count(), 0);
  await viewer.screenshot({ path: "test-results/shared-result-320.png" });
  assert.ok(
    await viewer.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await viewer
    .getByRole("button", { name: "このシートをコピー", exact: true })
    .click();
  await viewer
    .getByRole("heading", { name: "シートを編集", exact: true })
    .waitFor();
  await viewer
    .getByLabel("タイトル", { exact: true })
    .fill("共有先が作ったコピー");
  await viewer.goto(answerUrl);
  await viewer
    .getByRole("heading", { name: "共有テスト・交流スタンス", exact: true })
    .waitFor();
  // Retrying after the server accepted a PUT but its response was lost reuses the ID.
  await owner.goto(localEditor);
  let dropped = false;
  await owner.route("**/api/shares/*", async (route) => {
    if (route.request().method() === "PUT" && !dropped) {
      dropped = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await owner
    .getByRole("button", { name: "シートを共有", exact: true })
    .click();
  await owner.getByLabel("相手に見せる内容を確認しました").check();
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "共有URLを作成", exact: true })
    .click();
  await owner.getByRole("alert").waitFor();
  const before = await owner.evaluate(
    () => JSON.parse(localStorage.getItem("sosaku-sheet-v1")).shares,
  );
  assert.equal(before.length, 2);
  assert.equal(before[0].status, "pending");
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "共有URLを作成", exact: true })
    .click();
  await owner.getByLabel("共有URL", { exact: true }).waitFor();
  const secondUrl = await owner
    .getByLabel("共有URL", { exact: true })
    .inputValue();
  const after = await owner.evaluate(
    () => JSON.parse(localStorage.getItem("sosaku-sheet-v1")).shares,
  );
  assert.equal(after.length, 2);
  assert.equal(after[0].status, "published");
  assert.ok(secondUrl.endsWith(before[0].id));
  await owner.unroute("**/api/shares/*");
  await owner.getByRole("button", { name: "閉じる", exact: true }).click();
  await owner
    .getByRole("link", { name: /創作シートメーカー/ })
    .first()
    .click();
  owner.on("dialog", (dialog) => dialog.accept());
  await owner
    .getByRole("heading", { name: "最近作ったシート", exact: true })
    .waitFor();
  // Original deletion does not remove the independently managed public snapshot.
  await owner.getByRole("button", { name: "削除", exact: true }).click();
  await guest.goto(secondUrl);
  await guest
    .getByRole("heading", { name: "編集後のローカルシート", exact: true })
    .waitFor();
  const secondRow = owner
    .locator("section")
    .filter({
      has: owner.getByRole("heading", { name: "共有リンク", exact: true }),
    })
    .locator('[class*="row_"]')
    .filter({
      has: owner.getByRole("heading", {
        name: "編集後のローカルシート",
        exact: true,
      }),
    });
  await secondRow
    .getByRole("button", { name: "共有を停止", exact: true })
    .click();
  await guest.reload();
  await guest
    .getByRole("heading", { name: "シートが見つかりませんでした。" })
    .waitFor();
  await owner.getByRole("button", { name: "共有を停止", exact: true }).click();
  await guest.goto(sheetUrl);
  await guest
    .getByRole("heading", { name: "シートが見つかりませんでした。" })
    .waitFor();
  // An already published answer remains its own snapshot after its source sheet is revoked.
  await viewer.goto(answerUrl);
  await viewer
    .getByRole("heading", { name: "回答結果", exact: true })
    .waitFor();
  await guest.goto(resultLocalUrl);
  await guest.getByRole("link", { name: "ホームへ", exact: true }).click();
  guest.on("dialog", (dialog) => dialog.accept());
  await guest.getByRole("button", { name: "共有を停止", exact: true }).click();
  await viewer.reload();
  await viewer
    .getByRole("heading", { name: "シートが見つかりませんでした。" })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: three isolated browsers; shared sheet → private draft → shared result; immutable snapshots; 320px; copy isolation; lost-response retry; original deletion; revocation; no page errors.",
  );
} finally {
  await browser.close();
}
