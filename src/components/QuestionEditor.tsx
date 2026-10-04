import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Question, QuestionType } from "../types";
import { optionsFor, typeNames } from "../utils/model";
import styles from "./Editor.module.css";
export default function QuestionEditor({
  q,
  index,
  change,
  remove,
  duplicate,
  move,
}: {
  q: Question;
  index: number;
  change: (q: Question) => void;
  remove: () => void;
  duplicate: () => void;
  move: (n: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: q.id });
  const choices = [
    "four_level",
    "five_level",
    "single",
    "multiple",
    "yes_no",
  ].includes(q.type);
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={styles.question}
    >
      <div className={styles.questionTop}>
        <button
          {...attributes}
          {...listeners}
          className={styles.drag}
          aria-label={`質問${index + 1}を並び替える`}
        >
          ⠿
        </button>
        <span className="eyebrow">
          QUESTION {String(index + 1).padStart(2, "0")}
        </span>
        <div className="actions">
          <button
            className="icon-button"
            aria-label="前へ移動"
            onClick={() => move(-1)}
          >
            ↑
          </button>
          <button
            className="icon-button"
            aria-label="後へ移動"
            onClick={() => move(1)}
          >
            ↓
          </button>
        </div>
      </div>
      <label>
        質問文
        <input
          value={q.text}
          onChange={(e) => change({ ...q, text: e.target.value })}
          placeholder="例：恋愛関係について"
        />
      </label>
      <label>
        回答形式
        <select
          value={q.type}
          onChange={(e) => {
            const type = e.target.value as QuestionType;
            change({ ...q, type, options: optionsFor(type) });
          }}
        >
          {Object.entries(typeNames).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>補足・選択肢・必須設定</summary>
        <label>
          補足
          <textarea
            value={q.description}
            onChange={(e) => change({ ...q, description: e.target.value })}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={q.required}
            onChange={(e) => change({ ...q, required: e.target.checked })}
          />
          必須回答にする
        </label>
        {choices && (
          <div className={styles.options}>
            <p className="muted">回答ラベル</p>
            {q.options.map((o, i) => (
              <div className="actions" key={o.value}>
                <input
                  aria-label={`選択肢${i + 1}`}
                  value={o.label}
                  onChange={(e) =>
                    change({
                      ...q,
                      options: q.options.map((v, j) =>
                        j === i ? { ...v, label: e.target.value } : v,
                      ),
                    })
                  }
                />
                {["single", "multiple"].includes(q.type) && (
                  <button
                    aria-label={`選択肢${i + 1}を削除`}
                    onClick={() =>
                      change({
                        ...q,
                        options: q.options.filter((_, j) => j !== i),
                      })
                    }
                    disabled={q.options.length <= 2}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {["single", "multiple"].includes(q.type) && (
              <button
                onClick={() =>
                  change({
                    ...q,
                    options: [
                      ...q.options,
                      { value: crypto.randomUUID(), label: "新しい選択肢" },
                    ],
                  })
                }
              >
                ＋ 選択肢
              </button>
            )}
          </div>
        )}
      </details>
      <div className={styles.questionFooter}>
        <button onClick={duplicate}>複製</button>
        <button className="danger" onClick={remove}>
          削除
        </button>
      </div>
    </div>
  );
}
