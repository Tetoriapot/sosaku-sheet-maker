import type { ComparisonSource } from "../utils/comparison";
import { comparisonRows } from "../utils/comparison";
import styles from "./Comparison.module.css";
import { useState } from "react";
export default function ComparisonTable({
  sources,
  differencesOnly,
}: {
  sources: ComparisonSource[];
  differencesOnly: boolean;
}) {
  const rows = comparisonRows(sources);
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = rows.filter(
    (row) =>
      (!differencesOnly || row.different) &&
      !hidden.includes(row.id) &&
      `${row.section} ${row.question.text}`
        .normalize("NFKC")
        .toLowerCase()
        .includes(query.normalize("NFKC").toLowerCase()),
  );
  const count = rows.filter((row) => row.different).length;
  return (
    <>
      <label>
        比較する質問を検索
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="質問文・セクション名"
        />
      </label>
      <details>
        <summary>
          比較する質問を選ぶ（{rows.length - hidden.length} / {rows.length}
          項目）
        </summary>
        <div className="actions">
          <button type="button" onClick={() => setHidden([])}>
            すべて表示
          </button>
          <button
            type="button"
            onClick={() => setHidden(rows.map((r) => r.id))}
          >
            すべて非表示
          </button>
        </div>
        <div className={styles.candidates}>
          {rows.map((row) => (
            <label key={row.id} className="check">
              <input
                type="checkbox"
                checked={!hidden.includes(row.id)}
                onChange={(e) =>
                  setHidden(
                    e.target.checked
                      ? hidden.filter((key) => key !== row.id)
                      : [...hidden, row.id],
                  )
                }
              />
              {row.section}：{row.question.text}
            </label>
          ))}
        </div>
      </details>
      <p className="muted" aria-live="polite">
        {rows.length}項目中、回答・補足が異なる項目は{count}
        件です。未回答は「未回答」と表示します。
      </p>
      {visible.length ? (
        <div
          className={styles.scroll}
          role="region"
          tabIndex={0}
          aria-label="回答比較表（横スクロールできます）"
        >
          <table className={styles.table}>
            <caption>
              回答の比較 · {visible.length}項目（横にスクロールできます）
            </caption>
            <thead>
              <tr>
                <th scope="col">質問</th>
                {sources.map((source, i) => (
                  <th scope="col" key={source.key}>
                    <span className={styles.person}>回答 {i + 1}</span>
                    {source.answer.respondentName || "名前なし"}
                    <small>{source.answer.sheet.title}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    <small>{row.section}</small>
                    {row.question.text}
                    {row.question.description && (
                      <small>{row.question.description}</small>
                    )}
                    {row.different && (
                      <span className={styles.badge}>違いあり</span>
                    )}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td key={sources[i].key}>
                      <span className={cell.empty ? styles.unanswered : ""}>
                        {cell.text}
                      </span>
                      {cell.comment && (
                        <p className={styles.comment}>
                          <strong>補足</strong>
                          {cell.comment}
                        </p>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.empty}>
          表示条件に合う質問がありません。質問の選択・検索・差分の絞り込みを確認してください。
        </div>
      )}
    </>
  );
}
