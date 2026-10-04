import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store";
import { id, isEmpty, missingQuestions, questionCount } from "../utils/model";
import type { Answer, Sheet } from "../types";
import AnswerInput from "../components/AnswerInput";
import { useSharedResource } from "../hooks/useSharedResource";
import ResourceStatus from "../components/ResourceStatus";
import { reconcileAnswer } from "../utils/reconcileAnswer";
import styles from "../components/Answer.module.css";
export default function AnswerPage() {
  const { sheetId } = useParams();
  const resource = useSharedResource("sheet", sheetId);
  if (!resource.data) return <ResourceStatus {...resource} />;
  return (
    <AnswerForm
      key={resource.data.id}
      sheet={resource.data}
      shared={resource.remote}
    />
  );
}
function AnswerForm({ sheet, shared }: { sheet: Sheet; shared: boolean }) {
  const { db, update } = useStore();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<string[]>([]);
  const [resumeAt] = useState(db.draftProgress[sheet.id]);
  const questions = sheet.sections.flatMap((s) => s.questions);
  const jumpTo = (questionId: string) => {
    const field = document.getElementById(`question-${questionId}`);
    field?.scrollIntoView({ behavior: "auto", block: "center" });
    field
      ?.querySelector<HTMLElement>("input, textarea, select")
      ?.focus({ preventScroll: true });
  };
  const [fresh] = useState(
    () =>
      ({
        id: id(),
        sheetId: sheet.id,
        respondentName: "",
        answers: {},
        comments: {},
        createdAt: new Date().toISOString(),
        sheet: structuredClone(sheet),
      }) as Answer,
  );
  const answer = reconcileAnswer(sheet, db.drafts[sheet.id] ?? fresh);
  const save = (next: Answer, questionId?: string) =>
    update((d) => ({
      ...d,
      drafts: { ...d.drafts, [sheet.id]: next },
      draftProgress: questionId
        ? {
            ...d.draftProgress,
            [sheet.id]: { questionId, savedAt: new Date().toISOString() },
          }
        : d.draftProgress,
    }));
  const completed = sheet.sections
    .flatMap((s) => s.questions)
    .filter((q) => !isEmpty(answer.answers[q.id])).length;
  return (
    <div className={styles.form}>
      <div className="eyebrow">TELL YOUR STORY</div>
      <h1>{sheet.title}</h1>
      <p className="muted">{sheet.description}</p>
      {shared && (
        <p className="local-notice">
          共有されたシートへの回答です。入力内容はこのブラウザに保存されます。回答結果を共有するまでは、相手に送信されません。
        </p>
      )}
      <div className={styles.progress}>
        <span>
          回答済み {completed} / {questionCount(sheet)}
        </span>
        <span>必須の未回答 {missingQuestions(sheet, answer).length}件</span>
        <progress value={completed} max={questionCount(sheet) || 1} />
      </div>
      <div className="answer-navigation">
        {resumeAt && questions.some((q) => q.id === resumeAt.questionId) && (
          <button type="button" onClick={() => jumpTo(resumeAt.questionId)}>
            前回の回答位置から再開
          </button>
        )}
        <button
          type="button"
          disabled={!questions.some((q) => isEmpty(answer.answers[q.id]))}
          onClick={() => {
            const next = questions.find((q) => isEmpty(answer.answers[q.id]));
            if (next) jumpTo(next.id);
          }}
        >
          未回答の質問へ
        </button>
        {db.draftProgress[sheet.id] && (
          <p className="muted">
            最終保存：
            {new Date(db.draftProgress[sheet.id].savedAt).toLocaleString(
              "ja-JP",
            )}
          </p>
        )}
        <details>
          <summary>セクション目次</summary>
          <div className="actions">
            {sheet.sections
              .filter((s) => s.questions.length)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jumpTo(s.questions[0].id)}
                >
                  {s.title}
                </button>
              ))}
          </div>
        </details>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const missing = missingQuestions(sheet, answer);
          if (missing.length) {
            setErrors(missing.map((q) => q.id));
            requestAnimationFrame(() => jumpTo(missing[0].id));
            return;
          }
          const result = {
            ...answer,
            sheet: structuredClone(sheet),
            createdAt: new Date().toISOString(),
          };
          if (
            update((d) => ({
              ...d,
              answers: [result, ...d.answers.filter((a) => a.id !== result.id)],
              drafts: Object.fromEntries(
                Object.entries(d.drafts).filter(([key]) => key !== sheet.id),
              ),
              draftProgress: Object.fromEntries(
                Object.entries(d.draftProgress).filter(
                  ([key]) => key !== sheet.id,
                ),
              ),
            }))
          )
            navigate(`/result/${result.id}`);
        }}
      >
        {errors.some((qid) => isEmpty(answer.answers[qid])) && (
          <div role="alert" className="local-notice">
            <h2>未回答の必須項目があります</h2>
            <ul>
              {questions
                .filter(
                  (q) => errors.includes(q.id) && isEmpty(answer.answers[q.id]),
                )
                .map((q) => (
                  <li key={q.id}>
                    <button type="button" onClick={() => jumpTo(q.id)}>
                      {q.text}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
        <label>
          名前・ハンドルネーム（任意）
          <input
            value={answer.respondentName}
            onChange={(e) =>
              save({ ...answer, respondentName: e.target.value })
            }
            placeholder="入力しなくてもOK"
          />
        </label>
        {sheet.sections.map((s) => (
          <section key={s.id}>
            <h2>
              {s.icon} {s.title}
            </h2>
            <p className="muted">{s.description}</p>
            {s.questions.map((q, i) => (
              <fieldset
                id={`question-${q.id}`}
                key={q.id}
                className={`${styles.field} ${errors.includes(q.id) && isEmpty(answer.answers[q.id]) ? styles.error : ""}`}
              >
                <legend>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {q.text}
                  {q.required && <small>必須</small>}
                </legend>
                {q.description && <p className="muted">{q.description}</p>}
                <AnswerInput
                  q={q}
                  value={answer.answers[q.id]}
                  invalid={
                    errors.includes(q.id) && isEmpty(answer.answers[q.id])
                  }
                  change={(value) =>
                    save(
                      {
                        ...answer,
                        answers: { ...answer.answers, [q.id]: value },
                      },
                      q.id,
                    )
                  }
                />
                {errors.includes(q.id) && isEmpty(answer.answers[q.id]) && (
                  <p id={`error-${q.id}`} className="error-text">
                    この質問に回答してください。
                  </p>
                )}
                <details>
                  <summary>補足コメントを書く</summary>
                  <textarea
                    aria-label={`${q.text}の補足コメント`}
                    value={answer.comments[q.id] ?? ""}
                    onChange={(e) =>
                      save(
                        {
                          ...answer,
                          comments: {
                            ...answer.comments,
                            [q.id]: e.target.value,
                          },
                        },
                        q.id,
                      )
                    }
                  />
                </details>
              </fieldset>
            ))}
          </section>
        ))}
        <button className="primary wide" type="submit">
          回答を完成する →
        </button>
        <p className="muted center">
          入力内容は、このブラウザに自動保存されます。
        </p>
      </form>
    </div>
  );
}
