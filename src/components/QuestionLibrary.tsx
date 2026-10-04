import { useMemo, useState } from "react";
import baseLibrary from "../data/questions/library.json";
import extendedLibrary from "../data/questions/extended.json";
import { buildLibrary, filterLibrary, normalizeSearch } from "../utils/library";
import { question, typeNames } from "../utils/model";
import type { Question, QuestionType } from "../types";
import styles from "./QuestionLibrary.module.css";
const entries = buildLibrary(baseLibrary, extendedLibrary);
const categories = [...new Set(entries.flatMap((entry) => entry.categories))];
export default function QuestionLibrary({
  add,
  existing = [],
}: {
  add: (questions: Question[]) => void;
  existing?: string[];
}) {
  const [category, setCategory] = useState("恋愛");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<QuestionType | "recommended">("recommended");
  const [selected, setSelected] = useState<string[]>([]);
  const visible = useMemo(
    () => filterLibrary(entries, category, search),
    [category, search],
  );
  const present = new Set(existing.map(normalizeSearch));
  const eligible = visible.filter(
    (entry) => !present.has(normalizeSearch(entry.text)),
  );
  const allSelected =
    eligible.length > 0 &&
    eligible.every((entry) => selected.includes(entry.text));
  const chosen = entries.filter(
    (entry) =>
      selected.includes(entry.text) &&
      !present.has(normalizeSearch(entry.text)),
  );
  return (
    <>
      <label>
        回答形式
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          <option value="recommended">質問に合う形式（おすすめ）</option>
          {Object.entries(typeNames).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.filters}>
        <label>
          カテゴリ
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">全カテゴリ</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          質問を検索
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="例：返信、価値観、TRPG"
          />
        </label>
      </div>
      <div className={styles.toolbar}>
        <span aria-live="polite">{visible.length}件見つかりました</span>
        <button
          disabled={!eligible.length}
          onClick={() =>
            setSelected(
              allSelected
                ? selected.filter((t) => !eligible.some((e) => e.text === t))
                : [...new Set([...selected, ...eligible.map((e) => e.text)])],
            )
          }
        >
          {allSelected ? "表示中の選択を解除" : "表示中をすべて選ぶ"}
        </button>
      </div>
      <div className={styles.list}>
        {visible.map((entry) => {
          const disabled = present.has(normalizeSearch(entry.text));
          return (
            <label className="check" key={entry.text}>
              <input
                type="checkbox"
                aria-label={entry.text}
                checked={selected.includes(entry.text)}
                disabled={disabled}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, entry.text]
                      : selected.filter((t) => t !== entry.text),
                  )
                }
              />
              <span>
                {entry.text}
                <small>
                  {disabled
                    ? "追加済み"
                    : `${entry.categories.join("・")} / ${typeNames[type === "recommended" ? entry.type : type]}`}
                </small>
              </span>
            </label>
          );
        })}
        {!visible.length && (
          <p className="muted">
            該当する質問がありません。別の言葉や全カテゴリで探してみましょう。
          </p>
        )}
      </div>
      {chosen.length > 0 && (
        <details className={styles.selection}>
          <summary>選択中の質問 {chosen.length}件</summary>
          {chosen.map((entry) => (
            <button
              key={entry.text}
              onClick={() =>
                setSelected(selected.filter((t) => t !== entry.text))
              }
              aria-label={`${entry.text}の選択を解除`}
            >
              {entry.text} ×
            </button>
          ))}
        </details>
      )}
      <button
        className="primary wide"
        disabled={!chosen.length}
        onClick={() =>
          add(
            chosen.map((entry) =>
              question(entry.text, type === "recommended" ? entry.type : type),
            ),
          )
        }
      >
        {chosen.length}件追加
      </button>
    </>
  );
}
