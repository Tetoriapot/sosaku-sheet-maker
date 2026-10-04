import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  cloneSheet,
  question,
  missingQuestions,
  valueLabel,
} from "../src/utils/model.ts";
test("8 templates have unique question IDs; character template has exactly 50 questions", () => {
  const files = readdirSync("src/data/templates");
  assert.equal(files.length, 8);
  for (const f of files) {
    const t = JSON.parse(readFileSync(`src/data/templates/${f}`, "utf8"));
    const questions = t.sections.flatMap((s) => s.questions);
    assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
    assert.ok(questions.every((q) => q.text.trim()));
    if (f === "fifty-questions.json") assert.equal(questions.length, 50);
  }
});
test("copy has a new ID and does not modify the original", () => {
  const original = cloneSheet();
  original.sections[0].questions = [question("テスト")];
  const copy = cloneSheet(original);
  assert.notEqual(copy.id, original.id);
  copy.sections[0].questions[0].text = "変更";
  assert.equal(original.sections[0].questions[0].text, "テスト");
});
test("required questions reject empty values, but accept zero slider values", () => {
  const sheet = cloneSheet();
  const q = question("温度感", "slider");
  q.required = true;
  sheet.sections[0].questions = [q];
  const answer = { answers: {} };
  assert.equal(missingQuestions(sheet, answer).length, 1);
  answer.answers[q.id] = 0;
  assert.equal(missingQuestions(sheet, answer).length, 0);
  answer.answers[q.id] = [];
  assert.equal(missingQuestions(sheet, answer).length, 1);
});
test("result labels use custom options and preserve multiline text", () => {
  const q = question("選択", "multiple");
  q.options[0].label = "好き";
  assert.equal(valueLabel(q, ["0", "1"]), "好き、選択肢 B");
  assert.equal(valueLabel(q, []), "未回答");
  const text = question("自由回答", "long");
  assert.equal(valueLabel(text, "長い回答\n二行目"), "長い回答\n二行目");
});
