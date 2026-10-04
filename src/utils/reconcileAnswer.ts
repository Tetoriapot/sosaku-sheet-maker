import type { Answer, Sheet, Value } from "../types";
// A saved draft can outlive edits to its sheet. Keep only answers that still fit.
export function reconcileAnswer(sheet: Sheet, draft: Answer): Answer {
  const answers: Record<string, Value> = {};
  const comments: Record<string, string> = {};
  const previousQuestions = new Map(
    draft.sheet.sections.flatMap((s) => s.questions).map((q) => [q.id, q]),
  );
  for (const question of sheet.sections.flatMap((s) => s.questions)) {
    const previous = previousQuestions.get(question.id);
    if (
      !previous ||
      previous.type !== question.type ||
      previous.text !== question.text ||
      previous.description !== question.description
    )
      continue;
    const optionStillMeansTheSame = (value: string) =>
      question.options.some(
        (o) =>
          o.value === value &&
          o.label ===
            previous.options.find((old) => old.value === value)?.label,
      );
    const value = draft.answers[question.id];
    if (question.type === "short" || question.type === "long") {
      if (typeof value === "string") answers[question.id] = value;
    } else if (question.type === "slider") {
      if (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 100
      )
        answers[question.id] = value;
    } else if (question.type === "multiple") {
      if (Array.isArray(value))
        answers[question.id] = [
          ...new Set(value.filter(optionStillMeansTheSame)),
        ];
    } else if (typeof value === "string" && optionStillMeansTheSame(value))
      answers[question.id] = value;
    if (typeof draft.comments[question.id] === "string")
      comments[question.id] = draft.comments[question.id];
  }
  return { ...draft, sheetId: sheet.id, sheet, answers, comments };
}
