import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { cloneSheet, question, missingQuestions } from "../src/utils/model.ts";
import { parseAnswer, parseSheet } from "../shared/validation.ts";
import {
  comparisonSchema,
  comparisonRows,
  sharedAnswerId,
} from "../src/utils/comparison.ts";
import { contrastRatio, readableAccent } from "../src/utils/contrast.ts";
import { buildLibrary, filterLibrary } from "../src/utils/library.ts";
import { themePalettes } from "../shared/themes.ts";
import { readDb, writeDb, emptyDb, STORAGE_KEY } from "../src/utils/storage.ts";
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
function answer() {
  const sheet = cloneSheet();
  sheet.sections[0].questions = [
    question("好きな関係", "multiple"),
    question("温度感", "slider"),
  ];
  return {
    id: crypto.randomUUID(),
    sheetId: sheet.id,
    sheet,
    respondentName: "A",
    createdAt: new Date().toISOString(),
    answers: {
      [sheet.sections[0].questions[0].id]: ["0", "1"],
      [sheet.sections[0].questions[1].id]: 0,
    },
    comments: {},
  };
}
const source = (answer, key = "a") => ({ answer, key, origin: "local" });
test("comparison matches equivalent snapshots with different IDs and multi-select order", () => {
  const a = answer(),
    b = structuredClone(a);
  b.id = "b";
  b.sheet.id = "other-sheet";
  b.sheetId = "other-sheet";
  for (const q of b.sheet.sections[0].questions) {
    const previous = q.id;
    q.id = crypto.randomUUID();
    b.answers[q.id] = b.answers[previous];
    delete b.answers[previous];
  }
  const q = b.sheet.sections[0].questions[0];
  b.answers[q.id] = ["1", "0"];
  q.options.forEach((o) => {
    const old = o.value;
    o.value = `new-${old}`;
    b.answers[q.id] = b.answers[q.id].map((value) =>
      value === old ? o.value : value,
    );
  });
  assert.equal(comparisonSchema(a.sheet), comparisonSchema(b.sheet));
  assert.deepEqual(
    comparisonRows([source(a), source(b, "b")]).map((r) => r.different),
    [false, false],
  );
});
test("same question IDs do not allow comparing different questions or changed choices", () => {
  const a = answer(),
    b = structuredClone(a);
  b.sheet.sections[0].questions[0].text = "別の質問";
  assert.throws(() => comparisonRows([source(a), source(b, "b")]), /質問構成/);
  b.sheet = structuredClone(a.sheet);
  b.sheet.sections[0].questions[0].options[0].label = "違う意味";
  assert.notEqual(comparisonSchema(a.sheet), comparisonSchema(b.sheet));
});
test("comparison distinguishes unanswered from zero and includes comment differences", () => {
  const a = answer(),
    b = structuredClone(a);
  delete b.answers[b.sheet.sections[0].questions[1].id];
  b.comments[b.sheet.sections[0].questions[0].id] = "条件あり";
  const rows = comparisonRows([source(a), source(b, "b")]);
  assert.deepEqual(
    rows.map((r) => r.different),
    [true, true],
  );
  assert.equal(rows[1].cells[0].text, "0 / 100");
  assert.equal(rows[1].cells[1].text, "未回答");
});
test("comparison URLs are limited to answer URLs on the current origin", () => {
  const id = `pub_${crypto.randomUUID()}`;
  assert.equal(
    sharedAnswerId(
      `https://sheets.example/result/${id}`,
      "https://sheets.example",
    ),
    id,
  );
  assert.throws(() =>
    sharedAnswerId(
      `https://other.example/result/${id}`,
      "https://sheets.example",
    ),
  );
  assert.throws(() => sharedAnswerId(`/s/${id}`, "https://sheets.example"));
});
test("library deduplicates cross-category questions and searches normalized text", () => {
  const entries = buildLibrary(
    json("src/data/questions/library.json"),
    json("src/data/questions/extended.json"),
  );
  assert.ok(entries.length >= 140);
  assert.equal(entries.filter((e) => e.text === "ハグ").length, 1);
  assert.deepEqual(entries.find((e) => e.text === "ハグ").categories, [
    "恋愛",
    "身体接触",
  ]);
  assert.ok(filterLibrary(entries, "all", "ｔｒｐｇ").length > 0);
  assert.equal(filterLibrary(entries, "設定", "一人称")[0].type, "short");
  assert.equal(filterLibrary(entries, "性格", "落ち込んだ")[0].type, "long");
});
test("all templates and themes pass the same validation as shared sheets", () => {
  for (const file of readdirSync("src/data/templates"))
    assert.doesNotThrow(() => parseSheet(json(`src/data/templates/${file}`)));
  const sheet = answer().sheet;
  for (const theme of Object.keys(themePalettes))
    assert.equal(parseSheet({ ...sheet, theme }).theme, theme);
});
test("text remains readable for very light or dark custom accents on every theme", () => {
  for (const palette of Object.values(themePalettes))
    for (const color of ["#ffffff", "#000000", "#ffff00", "#7566d8"])
      assert.ok(
        contrastRatio(readableAccent(color, palette.bg), palette.bg) >= 4.5,
      );
});
test("whitespace-only required answers are missing on both client and API", () => {
  const a = answer();
  const q = question("必須の文章", "long");
  q.required = true;
  a.sheet.sections[0].questions = [q];
  a.answers = { [q.id]: " \n　" };
  assert.equal(missingQuestions(a.sheet, a).length, 1);
  assert.throws(() => parseAnswer(a), /必須/);
});
test("legacy storage is preserved; corrupted storage cannot be overwritten through strict reads", () => {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    const db = emptyDb();
    delete db.shares;
    db.sheets = [answer().sheet];
    values.set(STORAGE_KEY, JSON.stringify(db));
    assert.equal(readDb(true).sheets.length, 1);
    assert.deepEqual(readDb(true).shares, []);
    values.set(STORAGE_KEY, "invalid json");
    assert.throws(() => readDb(true));
    assert.equal(values.get(STORAGE_KEY), "invalid json");
    writeDb(emptyDb());
    assert.equal(readDb(true).sheets.length, 0);
  } finally {
    globalThis.localStorage = previous;
  }
});
