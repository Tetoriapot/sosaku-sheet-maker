import type { Sheet, Answer } from "../types";
import type { ShareReceipt } from "./sharing";
export const STORAGE_KEY = "sosaku-sheet-v1";
export interface Database {
  sheets: Sheet[];
  answers: Answer[];
  drafts: Record<string, Answer>;
  shares: ShareReceipt[];
  mode: "auto" | "light" | "dark";
  sheetMeta: Record<string, { tags: string[]; archived: boolean }>;
  draftProgress: Record<string, { questionId: string; savedAt: string }>;
}
export const emptyDb = (): Database => ({
  sheets: [],
  answers: [],
  drafts: {},
  shares: [],
  mode: "auto",
  sheetMeta: {},
  draftProgress: {},
});
export function readDb(strict = false): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    const db = JSON.parse(raw);
    if (!Array.isArray(db.sheets) || !Array.isArray(db.answers) || !db.drafts)
      throw new Error("invalid");
    return {
      ...emptyDb(),
      ...db,
      shares: Array.isArray(db.shares) ? db.shares : [],
    };
  } catch {
    if (strict)
      throw new Error(
        "保存データを読み込めません。上書きを防ぐため、保存を停止しています。",
      );
    return emptyDb();
  }
}
export function writeDb(db: Database) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}
