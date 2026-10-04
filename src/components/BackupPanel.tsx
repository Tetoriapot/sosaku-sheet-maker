import { useState } from "react";
import { useStore } from "../store";
import { Modal } from "./Modal";
import {
  backupCounts,
  createBackup,
  downloadJson,
  MAX_BACKUP_BYTES,
  mergeBackup,
  parseBackup,
  type Backup,
} from "../utils/backup";
import { readDb } from "../utils/storage";
import { staticHosting } from "../config";

export default function BackupPanel() {
  const { db, update, notify } = useStore();
  const [opened, setOpened] = useState(false);
  const [backup, setBackup] = useState<Backup>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [includeManagement, setIncludeManagement] = useState(false);
  const source = location.origin + import.meta.env.BASE_URL;
  return (
    <>
      <button onClick={() => setOpened(true)}>バックアップ・復元</button>
      {opened && (
        <Modal title="バックアップ・復元" close={() => setOpened(false)}>
          <p>
            シート・途中回答・完成した回答・タグ・再開位置をまとめて保存します。ファイルは端末内で処理します。
          </p>
          <p className="local-notice">{backupCounts(db)}</p>
          {!staticHosting && (
            <label className="check">
              <input
                type="checkbox"
                checked={includeManagement}
                onChange={(e) => setIncludeManagement(e.target.checked)}
              />
              共有を停止するための管理情報も含める
            </label>
          )}
          {includeManagement && (
            <p className="error-text">
              このファイルを持つ人は共有を停止できます。他の人へ渡さず、大切に保管してください。同じサイトに復元した場合だけ管理情報を取り込みます。
            </p>
          )}
          <button
            className="primary wide"
            onClick={() => {
              try {
                const latest = readDb(true);
                downloadJson(
                  createBackup(
                    {
                      ...latest,
                      shares: includeManagement ? latest.shares : [],
                    },
                    source,
                  ),
                  `creative-sheet-backup-${new Date().toISOString().slice(0, 10)}.json`,
                );
                setError("");
                notify("バックアップを書き出しました");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            バックアップを保存
          </button>
          <hr />
          <label>
            バックアップファイルを選ぶ
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                setBackup(undefined);
                setError("");
                if (!file) return;
                setBusy(true);
                try {
                  if (file.size > MAX_BACKUP_BYTES)
                    throw new Error("20MB以内のバックアップを選んでください。");
                  setBackup(parseBackup(JSON.parse(await file.text())));
                } catch (e) {
                  setError(
                    e instanceof SyntaxError
                      ? "JSONを読み取れませんでした。"
                      : (e as Error).message,
                  );
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          {backup && (
            <section className="local-notice">
              <h3>復元する内容</h3>
              <p>{backupCounts(backup.data)}</p>
              <p>
                {new Date(backup.createdAt).toLocaleString("ja-JP")}{" "}
                のバックアップ
              </p>
              <p>
                現在のデータは保持します。同じIDのシート・回答・途中回答は、現在の内容を優先して取り込みません。元のシートがない途中回答は、回答用シートも復元します。
              </p>
              <p>
                新しく追加するシート{" "}
                {
                  backup.data.sheets.filter(
                    (s) => !db.sheets.some((x) => x.id === s.id),
                  ).length
                }
                件・回答{" "}
                {
                  backup.data.answers.filter(
                    (a) => !db.answers.some((x) => x.id === a.id),
                  ).length
                }
                件
              </p>
              {!!backup.data.shares.length && (
                <p>
                  {source === backup.source
                    ? `共有管理情報 ${backup.data.shares.length}件も復元します。停止済みの共有は復活しません。`
                    : "保存元が異なるため、共有管理情報は取り込みません。共有の停止は元のサイトから行ってください。"}
                </p>
              )}
              <button
                className="primary"
                onClick={() => {
                  if (update((d) => mergeBackup(d, backup, source))) {
                    setBackup(undefined);
                    notify("既存データを保持して復元しました");
                  } else
                    setError(
                      "復元できませんでした。元のデータは保持されています。空き容量を確認してください。",
                    );
                }}
              >
                既存データを残して復元
              </button>
            </section>
          )}
          {busy && <p role="status">ファイルを確認中…</p>}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
