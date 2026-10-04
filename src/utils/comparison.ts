import type { Answer, Question, Sheet, Value } from "../types";
import { isEmpty, valueLabel } from "./model.ts";
export interface ComparisonSource {
  key: string;
  answer: Answer;
  origin: "local" | "url" | "file";
}
const choiceTypes = [
  "four_level",
  "five_level",
  "single",
  "multiple",
  "yes_no",
];
export const MAX_COMPARISONS = 12;
export function compatibilityReason(
  reference: Sheet,
  candidate: Sheet,
): string | undefined {
  if (reference.sections.length !== candidate.sections.length)
    return "セクション数が異なります。";
  for (let si = 0; si < reference.sections.length; si++) {
    const a = reference.sections[si],
      b = candidate.sections[si];
    if (a.title !== b.title || a.description !== b.description)
      return `${si + 1}番目のセクション名・説明が異なります。`;
    if (a.questions.length !== b.questions.length)
      return `「${a.title}」の質問数が異なります。`;
    for (let qi = 0; qi < a.questions.length; qi++) {
      const x = a.questions[qi],
        y = b.questions[qi];
      const at = `「${a.title}」の${qi + 1}問目`;
      if (x.text !== y.text) return `${at}の質問文・順序が異なります。`;
      if (x.description !== y.description) return `${at}の補足が異なります。`;
      if (x.type !== y.type) return `${at}の回答形式が異なります。`;
      if (x.required !== y.required) return `${at}の必須設定が異なります。`;
      if (
        choiceTypes.includes(x.type) &&
        JSON.stringify(x.options.map((o) => o.label)) !==
          JSON.stringify(y.options.map((o) => o.label))
      )
        return `${at}の選択肢・順序が異なります。`;
    }
  }
}
// Position and wording define compatibility; generated IDs differ for copies and shares.
export function comparisonSchema(sheet: Sheet) {
  return JSON.stringify(
    sheet.sections.map((s) => ({
      title: s.title,
      description: s.description,
      questions: s.questions.map((q) => ({
        text: q.text,
        description: q.description,
        type: q.type,
        required: q.required,
        options: choiceTypes.includes(q.type)
          ? q.options.map((o) => o.label)
          : [],
      })),
    })),
  );
}
function normalized(q: Question, value: Value | undefined) {
  if (isEmpty(value)) return null;
  if (q.type === "multiple")
    return Array.isArray(value)
      ? [
          ...new Set(
            value.map((v) => q.options.findIndex((o) => o.value === v)),
          ),
        ].sort((a, b) => a - b)
      : null;
  if (choiceTypes.includes(q.type))
    return q.options.findIndex((o) => o.value === value);
  return value;
}
export function comparisonRows(sources: ComparisonSource[]) {
  if (sources.length < 2) return [];
  const schema = comparisonSchema(sources[0].answer.sheet);
  if (sources.some((s) => comparisonSchema(s.answer.sheet) !== schema))
    throw new Error("質問構成が異なる回答は比較できません。");
  return sources[0].answer.sheet.sections.flatMap((section, si) =>
    section.questions.map((question, qi) => {
      const cells = sources.map((source) => {
        const q = source.answer.sheet.sections[si].questions[qi];
        const value = source.answer.answers[q.id];
        const comment = source.answer.comments[q.id] || "";
        return {
          text: valueLabel(q, value),
          comment,
          empty: isEmpty(value),
          key: JSON.stringify([normalized(q, value), comment]),
        };
      });
      return {
        id: `${si}-${qi}`,
        section: section.title,
        question,
        cells,
        different: new Set(cells.map((cell) => cell.key)).size > 1,
      };
    }),
  );
}
export function sharedAnswerId(input: string, origin: string) {
  let url: URL;
  try {
    url = new URL(input.trim(), origin);
  } catch {
    throw new Error("回答結果のURLを入力してください。");
  }
  const match = /^\/result\/(pub_[0-9a-f-]+)\/?$/.exec(url.pathname);
  if (url.origin !== origin || !match || url.search || url.hash)
    throw new Error(
      "同じサイトの回答結果URL（/result/pub_…）を入力してください。",
    );
  return match[1];
}
