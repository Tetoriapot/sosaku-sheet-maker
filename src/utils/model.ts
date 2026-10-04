import type { Sheet, Question, QuestionType, Answer, Value } from "../types";
import { themePalettes } from "../../shared/themes.ts";
export const id = () => crypto.randomUUID();
export const typeNames: Record<QuestionType, string> = {
  four_level: "4段階評価",
  five_level: "5段階評価",
  slider: "温度感スライダー",
  single: "単一選択",
  multiple: "複数選択",
  short: "短文",
  long: "長文",
  yes_no: "YES / NO",
};
export const categories: Record<string, string> = {
  uchiyoso: "うちよそ",
  character: "キャラクター",
  trpg: "TRPG",
  communication: "交流",
  check: "チェック",
};
export const themes = Object.fromEntries(
  Object.entries(themePalettes).map(([key, value]) => [key, value.label]),
);
export function optionsFor(type: QuestionType) {
  const labels =
    type === "four_level"
      ? ["◎ 大歓迎", "○ OK", "△ 要相談", "× NG"]
      : type === "five_level"
        ? ["1", "2", "3", "4", "5"]
        : type === "yes_no"
          ? ["YES", "NO"]
          : ["選択肢 A", "選択肢 B", "選択肢 C"];
  return labels.map((label, i) => ({ value: String(i), label }));
}
export function question(
  text = "",
  type: QuestionType = "four_level",
): Question {
  return {
    id: id(),
    text,
    type,
    description: "",
    required: false,
    options: optionsFor(type),
  };
}
export const questionCount = (sheet: Sheet) =>
  sheet.sections.reduce((n, s) => n + s.questions.length, 0);
export function cloneSheet(sheet?: Sheet): Sheet {
  const now = new Date().toISOString();
  return {
    ...(sheet
      ? structuredClone(sheet)
      : {
          title: "新しい創作シート",
          description: "",
          author: "",
          category: "uchiyoso",
          color: "#7566d8",
          theme: "simple" as const,
          sections: [
            {
              id: id(),
              title: "質問",
              description: "",
              icon: "",
              questions: [],
            },
          ],
        }),
    id: id(),
    createdAt: now,
    updatedAt: now,
  };
}
export const isEmpty = (v: Value | undefined) =>
  v === undefined ||
  (typeof v === "string" && !v.trim()) ||
  (Array.isArray(v) && v.length === 0);
export function valueLabel(q: Question, value?: Value) {
  if (isEmpty(value)) return "未回答";
  if (q.type === "slider") return `${value} / 100`;
  if (q.type === "short" || q.type === "long") return String(value);
  const vals = Array.isArray(value) ? value : [String(value)];
  return vals
    .map((v) => q.options.find((o) => o.value === v)?.label ?? v)
    .join("、");
}
export const missingQuestions = (sheet: Sheet, answer: Answer) =>
  sheet.sections
    .flatMap((s) => s.questions)
    .filter((q) => q.required && isEmpty(answer.answers[q.id]));
