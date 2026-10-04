import type { Question, Value } from "../types";
import styles from "./Answer.module.css";
export default function AnswerInput({
  q,
  value,
  change,
  invalid = false,
}: {
  q: Question;
  value?: Value;
  change: (v: Value) => void;
  invalid?: boolean;
}) {
  const validation = {
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `error-${q.id}` : undefined,
  };
  if (q.type === "short")
    return (
      <input
        {...validation}
        aria-label={q.text}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => change(e.target.value)}
        placeholder="回答を入力"
      />
    );
  if (q.type === "long")
    return (
      <textarea
        {...validation}
        rows={4}
        aria-label={q.text}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => change(e.target.value)}
        placeholder="自由に書いてみましょう"
      />
    );
  if (q.type === "slider")
    return (
      <div className={styles.slider}>
        <div>
          <span>やりたくない</span>
          <b>{value === undefined ? "未回答" : `${value} / 100`}</b>
          <span>ぜひやりたい</span>
        </div>
        <input
          {...validation}
          aria-label={q.text}
          type="range"
          min="0"
          max="100"
          value={typeof value === "number" ? value : 50}
          onChange={(e) => change(Number(e.target.value))}
        />
        {value === undefined && (
          <button type="button" onClick={() => change(50)}>
            50（中間）で回答
          </button>
        )}
      </div>
    );
  return (
    <div className={styles.choices}>
      {q.options.map((o) => (
        <label
          key={o.value}
          className={
            (Array.isArray(value) ? value.includes(o.value) : value === o.value)
              ? styles.selected
              : ""
          }
        >
          <input
            {...validation}
            type={q.type === "multiple" ? "checkbox" : "radio"}
            name={q.id}
            value={o.value}
            checked={
              Array.isArray(value) ? value.includes(o.value) : value === o.value
            }
            onChange={(e) => {
              if (q.type === "multiple") {
                const a = Array.isArray(value) ? value : [];
                change(
                  e.target.checked
                    ? [...a, o.value]
                    : a.filter((v) => v !== o.value),
                );
              } else change(o.value);
            }}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
