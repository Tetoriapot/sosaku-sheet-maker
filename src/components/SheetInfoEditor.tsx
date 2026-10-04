import type { Sheet, Theme } from "../types";
import { categories, themes } from "../utils/model";
import styles from "./Editor.module.css";
export default function SheetInfoEditor({
  sheet,
  save,
}: {
  sheet: Sheet;
  save: (s: Sheet) => void;
}) {
  return (
    <div className={styles.basic}>
      <h2>シートの基本情報</h2>
      <label>
        タイトル
        <input
          value={sheet.title}
          onChange={(e) => save({ ...sheet, title: e.target.value })}
        />
      </label>
      <label>
        説明
        <textarea
          value={sheet.description}
          onChange={(e) => save({ ...sheet, description: e.target.value })}
        />
      </label>
      <details>
        <summary>作者・カテゴリ・デザイン</summary>
        <label>
          作者名（任意）
          <input
            value={sheet.author}
            onChange={(e) => save({ ...sheet, author: e.target.value })}
          />
        </label>
        <label>
          カテゴリ
          <select
            value={sheet.category}
            onChange={(e) => save({ ...sheet, category: e.target.value })}
          >
            {Object.entries(categories).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          テーマ
          <select
            value={sheet.theme}
            onChange={(e) => save({ ...sheet, theme: e.target.value as Theme })}
          >
            {Object.entries(themes).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          テーマカラー
          <input
            type="color"
            value={sheet.color}
            onChange={(e) => save({ ...sheet, color: e.target.value })}
          />
        </label>
      </details>
    </div>
  );
}
