import type {
  Answer,
  Question,
  QuestionType,
  Sheet,
  Value,
} from "../src/types.ts";
import { themePalettes } from "./themes.ts";

export const MAX_BODY_BYTES = 600 * 1024;
export const PUBLIC_ID =
  /^pub_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const TOKEN = /^[0-9a-f]{64}$/;
export type ShareKind = "sheet" | "answer";
export interface SharePayload {
  kind: ShareKind;
  data: Sheet | Answer;
}
export class ValidationError extends Error {}
const fail = (message: string): never => {
  throw new ValidationError(message);
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail("データ形式を確認してください。");
  return value as Record<string, unknown>;
}
function text(
  value: unknown,
  label: string,
  max: number,
  required = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    return fail(
      `${label}は${required ? "1〜" : ""}${max}文字以内で入力してください。`,
    );
  return value;
}
function identifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(value) ||
    ["__proto__", "constructor", "prototype"].includes(value)
  )
    return fail("IDの形式が正しくありません。");
  return value;
}
function array(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    return fail(`${label}は${max}件以内にしてください。`);
  return value;
}
function date(value: unknown): string {
  const result = text(value, "日時", 40, true);
  if (!Number.isFinite(Date.parse(result)))
    return fail("日時の形式が正しくありません。");
  return result;
}
function unique(ids: string[]) {
  if (new Set(ids).size !== ids.length) fail("IDが重複しています。");
}
const choiceTypes = [
  "four_level",
  "five_level",
  "single",
  "multiple",
  "yes_no",
];
function parseQuestion(value: unknown, local = false): Question {
  const q = record(value);
  const type = text(q.type, "回答形式", 20) as QuestionType;
  if (![...choiceTypes, "slider", "short", "long"].includes(type))
    return fail("未対応の回答形式です。");
  const options =
    local || choiceTypes.includes(type)
      ? array(q.options, "選択肢", 50).map((value) => {
          const o = record(value);
          return {
            value: identifier(o.value),
            label: text(o.label, "選択肢", 300, !local),
          };
        })
      : [];
  if (!local && choiceTypes.includes(type) && options.length < 2)
    return fail("選択肢は2件以上にしてください。");
  const expected = { four_level: 4, five_level: 5, yes_no: 2 }[
    type as "four_level" | "five_level" | "yes_no"
  ];
  if (!local && expected && options.length !== expected)
    return fail("回答形式と選択肢の数が一致しません。");
  unique(options.map((o) => o.value));
  if (typeof q.required !== "boolean")
    return fail("必須設定の形式が正しくありません。");
  return {
    id: identifier(q.id),
    text: text(q.text, "質問文", 2000, !local),
    description: text(q.description, "質問の補足", 4000),
    type,
    required: q.required,
    options,
  };
}
export function parseSheet(value: unknown, local = false): Sheet {
  const s = record(value);
  const sections = array(s.sections, "セクション", 40).map((value) => {
    const section = record(value);
    return {
      id: identifier(section.id),
      title: text(section.title, "セクション名", 200, !local),
      description: text(section.description, "セクションの説明", 4000),
      icon: text(section.icon, "アイコン", 32),
      questions: array(section.questions, "質問", 300).map((q) =>
        parseQuestion(q, local),
      ),
    };
  });
  const questions = sections.flatMap((s) => s.questions);
  if ((!local && !questions.length) || questions.length > 300)
    return fail("質問は1〜300件にしてください。");
  unique(sections.map((s) => s.id));
  unique(questions.map((q) => q.id));
  if (typeof s.color !== "string" || !/^#[0-9a-f]{6}$/i.test(s.color))
    return fail("テーマカラーが正しくありません。");
  if (!Object.hasOwn(themePalettes, String(s.theme)))
    return fail("テーマが正しくありません。");
  return {
    id: identifier(s.id),
    title: text(s.title, "タイトル", 200, !local),
    description: text(s.description, "説明", 10000),
    author: text(s.author, "作者名", 200),
    category: text(s.category, "カテゴリ", 60, true),
    color: s.color,
    theme: s.theme as Sheet["theme"],
    sections,
    createdAt: date(s.createdAt),
    updatedAt: date(s.updatedAt),
  };
}
export function parseAnswer(value: unknown, local = false): Answer {
  const a = record(value);
  const sheet = parseSheet(a.sheet, local);
  const rawAnswers = record(a.answers);
  const rawComments = record(a.comments);
  const answers: Record<string, Value> = {};
  const comments: Record<string, string> = {};
  const questions = sheet.sections.flatMap((s) => s.questions);
  const ids = new Set(questions.map((q) => q.id));
  if (
    [...Object.keys(rawAnswers), ...Object.keys(rawComments)].some(
      (id) => !ids.has(id),
    )
  )
    return fail("シートにない質問の回答が含まれています。");
  for (const q of questions) {
    const v = rawAnswers[q.id];
    const empty =
      v === undefined ||
      (typeof v === "string" && !v.trim()) ||
      (Array.isArray(v) && v.length === 0);
    if (!local && q.required && empty)
      return fail(`「${q.text.slice(0, 40)}」は必須回答です。`);
    if (!empty || (local && v !== undefined)) {
      if (q.type === "short" || q.type === "long")
        answers[q.id] = text(v, "回答", q.type === "short" ? 2000 : 20000);
      else if (q.type === "slider") {
        if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100)
          return fail("温度感は0〜100で回答してください。");
        answers[q.id] = v;
      } else if (q.type === "multiple") {
        const values = array(v, "複数選択", 50).map(identifier);
        unique(values);
        if (values.some((v) => !q.options.some((o) => o.value === v)))
          return fail("選択肢にない回答です。");
        answers[q.id] = values;
      } else {
        if (typeof v !== "string" || !q.options.some((o) => o.value === v))
          return fail("選択肢にない回答です。");
        answers[q.id] = v;
      }
    }
    if (rawComments[q.id] !== undefined)
      comments[q.id] = text(rawComments[q.id], "補足コメント", 5000);
  }
  const sheetId = identifier(a.sheetId);
  if (sheetId !== sheet.id) return fail("回答とシートのIDが一致しません。");
  return {
    id: identifier(a.id),
    sheetId,
    respondentName: text(a.respondentName, "回答者名", 200),
    answers,
    comments,
    createdAt: date(a.createdAt),
    sheet,
  };
}
export function parseSharePayload(value: unknown): SharePayload {
  const p = record(value);
  if (p.kind === "sheet") return { kind: "sheet", data: parseSheet(p.data) };
  if (p.kind === "answer") return { kind: "answer", data: parseAnswer(p.data) };
  return fail("共有するデータを確認してください。");
}
