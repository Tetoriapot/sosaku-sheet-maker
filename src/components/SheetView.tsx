import type { Answer, Sheet } from "../types";
import { valueLabel } from "../utils/model";
import { themePalettes } from "../../shared/themes";
import { readableAccent } from "../utils/contrast";
import styles from "./SheetView.module.css";
export default function SheetView({
  sheet,
  answer,
}: {
  sheet: Sheet;
  answer?: Answer;
}) {
  const palette = themePalettes[sheet.theme] ?? themePalettes.simple;
  return (
    <article
      className={`${styles.sheet} ${styles[sheet.theme]}`}
      style={
        {
          "--accent":
            sheet.theme === "mono"
              ? palette.fg
              : readableAccent(sheet.color, palette.bg),
          "--sheet-bg": palette.bg,
          "--sheet-fg": palette.fg,
          "--sheet-sub": palette.sub,
          "--sheet-line": palette.line,
        } as React.CSSProperties
      }
    >
      <div className={styles.eyebrow}>CREATIVE SHEET</div>
      <h2>{sheet.title || "タイトル未設定"}</h2>
      <p className={styles.description}>{sheet.description}</p>
      {(answer ? answer.respondentName : sheet.author) && (
        <p className={styles.name}>
          {answer ? `回答：${answer.respondentName}` : `作成：${sheet.author}`}
        </p>
      )}
      {sheet.sections.map((s) => (
        <section key={s.id}>
          <h3>
            {s.icon} {s.title}
          </h3>
          {s.description && <p>{s.description}</p>}
          {s.questions.map((q) => (
            <div key={q.id} className={styles.row}>
              <div>
                <strong>{q.text || "質問文未設定"}</strong>
                {q.description && <small>{q.description}</small>}
              </div>
              {answer ? (
                <div className={styles.answer}>
                  {valueLabel(q, answer.answers[q.id])}
                  {answer.comments[q.id] && (
                    <small>{answer.comments[q.id]}</small>
                  )}
                </div>
              ) : (
                <div className={styles.placeholder}>
                  {q.type === "short" || q.type === "long"
                    ? "................................"
                    : q.type === "slider"
                      ? "────●────"
                      : q.options.map((o) => o.label).join("　")}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
      <footer>創作シートメーカー</footer>
    </article>
  );
}
