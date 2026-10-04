import test from "node:test";
import assert from "node:assert/strict";
import { cloneSheet, question } from "../src/utils/model.ts";
import { emptyDb } from "../src/utils/storage.ts";
import { createBackup, parseBackup, mergeBackup } from "../src/utils/backup.ts";
import { parseSheet, parseAnswer } from "../shared/validation.ts";
import { publicationData } from "../src/utils/publication.ts";
import {
  compatibilityReason,
  comparisonRows,
  MAX_COMPARISONS,
} from "../src/utils/comparison.ts";
function fixture() {
  const sheet = cloneSheet();
  sheet.sections[0].questions = [
    question("必須", "long"),
    question("温度感", "slider"),
  ];
  sheet.sections[0].questions[0].required = true;
  const answer = {
    id: crypto.randomUUID(),
    sheetId: sheet.id,
    sheet,
    respondentName: "秘密の名前",
    createdAt: new Date().toISOString(),
    answers: { [sheet.sections[0].questions[1].id]: 0 },
    comments: { [sheet.sections[0].questions[1].id]: "秘密の補足" },
  };
  return { sheet, answer };
}
test("backup roundtrip preserves unfinished sheets, required drafts, zero, tags and position", () => {
  const { sheet, answer } = fixture(),
    data = emptyDb();
  const blank = cloneSheet();
  blank.title = "";
  data.sheets = [sheet, blank];
  data.drafts[sheet.id] = answer;
  data.sheetMeta[sheet.id] = { tags: ["キャラ"], archived: true };
  data.draftProgress[sheet.id] = {
    questionId: sheet.sections[0].questions[1].id,
    savedAt: answer.createdAt,
  };
  assert.deepEqual(
    parseBackup(JSON.parse(JSON.stringify(createBackup(data, "site")))).data,
    data,
  );
  assert.throws(() => parseSheet(blank));
  assert.throws(() => parseAnswer(answer), /必須/);
});
test("backup merge keeps current data, is repeatable, and only restores management at same site", () => {
  const { sheet, answer } = fixture(),
    data = emptyDb();
  data.sheets = [sheet];
  data.drafts[sheet.id] = answer;
  data.shares = [
    {
      id: `pub_${crypto.randomUUID()}`,
      token: "a".repeat(64),
      fingerprint: "b".repeat(64),
      kind: "sheet",
      sourceId: sheet.id,
      title: sheet.title,
      createdAt: sheet.createdAt,
      status: "published",
    },
  ];
  const backup = createBackup(data, "original");
  const current = emptyDb();
  current.sheets = [{ ...sheet, title: "新しい内容" }];
  current.shares = [{ ...data.shares[0], status: "revoked" }];
  const next = mergeBackup(current, backup, "original");
  assert.equal(next.sheets[0].title, "新しい内容");
  assert.equal(next.shares[0].status, "revoked");
  assert.deepEqual(mergeBackup(next, backup, "original"), next);
  assert.equal(mergeBackup(emptyDb(), backup, "other").shares.length, 0);
});
test("restoring a shared draft creates an answerable local sheet without its API", () => {
  const { sheet, answer } = fixture(),
    data = emptyDb();
  sheet.id = `pub_${crypto.randomUUID()}`;
  answer.sheetId = sheet.id;
  data.drafts[sheet.id] = answer;
  const backup = createBackup(data, "old");
  const merged = mergeBackup(emptyDb(), backup, "new");
  assert.equal(merged.sheets.length, 1);
  assert.ok(!merged.sheets[0].id.startsWith("pub_"));
  assert.equal(
    merged.drafts[merged.sheets[0].id].sheet.id,
    merged.sheets[0].id,
  );
  assert.deepEqual(mergeBackup(merged, backup, "new"), merged);
});
test("invalid backup versions, IDs, metadata and choices fail before any merge", () => {
  const { sheet, answer } = fixture(),
    data = emptyDb();
  data.sheets = [sheet];
  data.drafts[sheet.id] = answer;
  const backup = createBackup(data, "site");
  assert.throws(() => parseBackup({ ...backup, version: 2 }));
  const bad = structuredClone(backup);
  bad.data.drafts[sheet.id].answers[sheet.sections[0].questions[1].id] = 101;
  assert.throws(() => parseBackup(bad));
  assert.throws(() =>
    parseBackup({
      ...backup,
      data: {
        ...backup.data,
        sheetMeta: JSON.parse('{"__proto__":{"tags":[],"archived":false}}'),
      },
    }),
  );
  assert.throws(() =>
    parseBackup({
      ...backup,
      data: { ...backup.data, sheets: [sheet, sheet] },
    }),
  );
});
test("publication physically removes excluded fields, preserves answers and original", () => {
  const { answer } = fixture();
  answer.sheet.author = "秘密の作者";
  answer.sheet.description = "秘密の説明";
  const before = structuredClone(answer);
  const result = publicationData("answer", answer, {
    name: false,
    author: false,
    description: false,
    comments: false,
  });
  assert.deepEqual(answer, before);
  assert.equal(result.respondentName, "");
  assert.equal(result.sheet.author, "");
  assert.equal(result.sheet.description, "");
  assert.deepEqual(result.comments, {});
  assert.deepEqual(result.answers, answer.answers);
  assert.ok(!JSON.stringify(result).includes("秘密の"));
});
test("12 responses compare and incompatibilities explain their location", () => {
  const { sheet, answer } = fixture();
  const sources = Array.from({ length: MAX_COMPARISONS }, (_, i) => ({
    key: String(i),
    origin: "local",
    answer: structuredClone(answer),
  }));
  assert.equal(comparisonRows(sources)[0].cells.length, 12);
  const other = structuredClone(sheet);
  other.sections[0].questions[1].text = "変更した質問";
  assert.match(compatibilityReason(sheet, other), /2問目/);
  assert.equal(compatibilityReason(sheet, sheet), undefined);
});
