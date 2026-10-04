import {
  parseAnswer,
  parseSheet,
  PUBLIC_ID,
  TOKEN,
} from "../../shared/validation.ts";
import type { Database } from "./storage.ts";
import { emptyDb } from "./storage.ts";

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export interface Backup {
  format: "sosaku-sheet-backup";
  version: 1;
  createdAt: string;
  source: string;
  data: Database;
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("バックアップの形式が正しくありません。");
  return value as Record<string, unknown>;
};
const validId = (value: string) =>
  /^[a-zA-Z0-9_-]{1,100}$/.test(value) &&
  !["__proto__", "constructor", "prototype"].includes(value);
function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 3000)
    throw new Error(
      "バックアップ内の件数が多すぎるか、形式が正しくありません。",
    );
  return value;
}
function unique<T extends { id: string }>(items: T[]) {
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new Error("バックアップ内でIDが重複しています。");
  return items;
}
export function parseBackup(value: unknown): Backup {
  const file = object(value);
  if (file.format !== "sosaku-sheet-backup" || file.version !== 1)
    throw new Error(
      "対応するバックアップファイルを選んでください。回答JSONとは異なります。",
    );
  if (
    typeof file.createdAt !== "string" ||
    !Number.isFinite(Date.parse(file.createdAt)) ||
    typeof file.source !== "string" ||
    file.source.length > 2048
  )
    throw new Error("バックアップの日時・保存元が正しくありません。");
  const raw = object(file.data);
  const data = emptyDb();
  data.sheets = unique(list(raw.sheets).map((s) => parseSheet(s, true)));
  data.answers = unique(list(raw.answers).map((a) => parseAnswer(a, true)));
  for (const [key, value] of Object.entries(object(raw.drafts))) {
    const answer = parseAnswer(value, true);
    if (!validId(key) || key !== answer.sheetId)
      throw new Error("途中回答のIDが一致しません。");
    data.drafts[key] = answer;
  }
  if (!["auto", "light", "dark"].includes(String(raw.mode)))
    throw new Error("表示モードが正しくありません。");
  data.mode = raw.mode as Database["mode"];
  data.shares = unique(
    list(raw.shares ?? []).map((value) => {
      const s = object(value);
      if (
        !PUBLIC_ID.test(String(s.id)) ||
        !TOKEN.test(String(s.token)) ||
        !TOKEN.test(String(s.fingerprint)) ||
        !["sheet", "answer"].includes(String(s.kind)) ||
        !["pending", "published", "revoked"].includes(String(s.status)) ||
        typeof s.sourceId !== "string" ||
        !validId(s.sourceId) ||
        typeof s.title !== "string" ||
        s.title.length > 200 ||
        typeof s.createdAt !== "string" ||
        !Number.isFinite(Date.parse(s.createdAt))
      )
        throw new Error("共有管理情報が正しくありません。");
      return {
        id: String(s.id),
        token: String(s.token),
        fingerprint: String(s.fingerprint),
        kind: s.kind as "sheet" | "answer",
        status: s.status as "pending" | "published" | "revoked",
        sourceId: s.sourceId,
        title: s.title,
        createdAt: s.createdAt,
      };
    }),
  );
  for (const [key, value] of Object.entries(object(raw.sheetMeta ?? {}))) {
    const meta = object(value);
    if (
      !validId(key) ||
      typeof meta.archived !== "boolean" ||
      !Array.isArray(meta.tags) ||
      meta.tags.length > 20 ||
      meta.tags.some((t) => typeof t !== "string" || t.length > 40)
    )
      throw new Error("シートの整理情報が正しくありません。");
    data.sheetMeta[key] = {
      tags: [...new Set(meta.tags as string[])],
      archived: meta.archived,
    };
  }
  for (const [key, value] of Object.entries(object(raw.draftProgress ?? {}))) {
    const progress = object(value);
    if (
      !validId(key) ||
      typeof progress.questionId !== "string" ||
      !validId(progress.questionId) ||
      typeof progress.savedAt !== "string" ||
      !Number.isFinite(Date.parse(progress.savedAt))
    )
      throw new Error("再開位置が正しくありません。");
    data.draftProgress[key] = {
      questionId: progress.questionId,
      savedAt: progress.savedAt,
    };
  }
  return {
    format: "sosaku-sheet-backup",
    version: 1,
    createdAt: file.createdAt,
    source: file.source,
    data,
  };
}
export function createBackup(data: Database, source: string): Backup {
  return parseBackup({
    format: "sosaku-sheet-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    source,
    data,
  });
}
export function backupCounts(data: Database) {
  return `シート${data.sheets.length}件・途中回答${Object.keys(data.drafts).length}件・完成した回答${data.answers.length}件`;
}
// Existing records win. This also keeps a locally revoked share from being revived by an old backup.
export function mergeBackup(
  current: Database,
  backup: Backup,
  source: string,
): Database {
  const merged: Database = {
    ...current,
    sheets: [
      ...current.sheets,
      ...backup.data.sheets.filter(
        (s) => !current.sheets.some((x) => x.id === s.id),
      ),
    ],
    answers: [
      ...current.answers,
      ...backup.data.answers.filter(
        (a) => !current.answers.some((x) => x.id === a.id),
      ),
    ],
    drafts: { ...backup.data.drafts, ...current.drafts },
    sheetMeta: { ...backup.data.sheetMeta, ...current.sheetMeta },
    draftProgress: { ...backup.data.draftProgress, ...current.draftProgress },
    shares:
      source === backup.source
        ? [
            ...current.shares,
            ...backup.data.shares.filter(
              (s) => !current.shares.some((x) => x.id === s.id),
            ),
          ]
        : current.shares,
  };
  // A draft received from a shared URL can outlive its source. Restore its snapshot
  // as a local sheet so it remains answerable without that server.
  for (const [key, draft] of Object.entries(merged.drafts)) {
    if (merged.sheets.some((s) => s.id === key)) continue;
    const localId = key.startsWith("pub_")
      ? key.replace(/^pub_/, "restored_")
      : key;
    const sheet = { ...draft.sheet, id: localId };
    if (!merged.sheets.some((s) => s.id === localId)) merged.sheets.push(sheet);
    if (localId !== key) {
      merged.drafts[localId] ??= { ...draft, sheetId: localId, sheet };
      if (merged.draftProgress[key])
        merged.draftProgress[localId] ??= merged.draftProgress[key];
      delete merged.drafts[key];
      delete merged.draftProgress[key];
    }
  }
  return merged;
}
export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
