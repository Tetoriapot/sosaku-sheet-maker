import test from "node:test";
import assert from "node:assert/strict";
import { cloneSheet, question } from "../src/utils/model.ts";
import { reconcileAnswer } from "../src/utils/reconcileAnswer.ts";
import { parseAnswer } from "../shared/validation.ts";
test("changed question meanings and answer types do not silently reuse old values", () => {
  const sheet = cloneSheet();
  const q = question("恋愛関係");
  sheet.sections[0].questions = [q];
  const draft = {
    id: "draft",
    sheetId: sheet.id,
    sheet: structuredClone(sheet),
    respondentName: "",
    createdAt: new Date().toISOString(),
    answers: { [q.id]: "0" },
    comments: { [q.id]: "以前の補足" },
  };
  const changed = structuredClone(sheet);
  changed.sections[0].questions[0].type = "yes_no";
  assert.deepEqual(reconcileAnswer(changed, draft).answers, {});
  changed.sections[0].questions[0].type = "four_level";
  changed.sections[0].questions[0].options[0].label = "NG";
  assert.deepEqual(reconcileAnswer(changed, draft).answers, {});
  changed.sections[0].questions[0].text = "まったく別の質問";
  assert.deepEqual(reconcileAnswer(changed, draft).comments, {});
});
test("editing questions discards obsolete draft values before completing or sharing", () => {
  const sheet = cloneSheet();
  const slider = question("温度感", "slider"),
    single = question("変更された選択肢", "single"),
    multiple = question("複数", "multiple");
  sheet.sections[0].questions = [slider, single, multiple];
  const draft = {
    id: "draft",
    sheetId: sheet.id,
    sheet,
    respondentName: "",
    createdAt: new Date().toISOString(),
    answers: {
      deleted: "非公開の下書き",
      [slider.id]: 0,
      [single.id]: "removed-option",
      [multiple.id]: ["0", "bad", "0"],
    },
    comments: { deleted: "削除したコメント", [slider.id]: "残すコメント" },
  };
  const clean = reconcileAnswer(sheet, draft);
  assert.equal(clean.answers.deleted, undefined);
  assert.equal(clean.comments.deleted, undefined);
  assert.equal(clean.answers[slider.id], 0);
  assert.equal(clean.answers[single.id], undefined);
  assert.deepEqual(clean.answers[multiple.id], ["0"]);
  assert.equal(clean.comments[slider.id], "残すコメント");
  assert.doesNotThrow(() => parseAnswer(clean));
  assert.equal(draft.answers.deleted, "非公開の下書き");
});
