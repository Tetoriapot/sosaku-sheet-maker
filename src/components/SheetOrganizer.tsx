import { useState } from "react";
import type { Sheet } from "../types";
import { useStore } from "../store";
import { Modal } from "./Modal";
export default function SheetOrganizer({
  sheet,
  close,
}: {
  sheet: Sheet;
  close: () => void;
}) {
  const { db, update } = useStore();
  const meta = db.sheetMeta[sheet.id];
  const [tags, setTags] = useState(meta?.tags.join(", ") ?? "");
  const [archived, setArchived] = useState(meta?.archived ?? false);
  const [error, setError] = useState("");
  return (
    <Modal title="シートを整理" close={close}>
      <p>{sheet.title}</p>
      <label>
        タグ（カンマ区切り）
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="キャラ名, 企画名"
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />
        アーカイブする
      </label>
      <p className="muted">
        タグはこのブラウザ内の整理に使います。共有内容には含めません。アーカイブしたシートは一覧を切り替えると表示・復帰できます。
      </p>
      <button
        className="primary wide"
        onClick={() => {
          const values = [
            ...new Set(
              tags
                .split(/[,、\n]/)
                .map((t) => t.trim())
                .filter(Boolean),
            ),
          ];
          if (values.length > 20 || values.some((t) => t.length > 40)) {
            setError("タグは20個まで、1個40文字以内にしてください。");
            return;
          }
          if (
            update((d) => ({
              ...d,
              sheetMeta: {
                ...d.sheetMeta,
                [sheet.id]: { tags: values, archived },
              },
            }))
          )
            close();
        }}
      >
        整理を保存
      </button>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </Modal>
  );
}
