import { useState } from "react";
import { Modal } from "./Modal";
import QuestionLibrary from "./QuestionLibrary";
import type { Question, QuestionType } from "../types";
import { question, typeNames } from "../utils/model";
export default function AddQuestionModal({
  add,
  close,
  existing,
}: {
  add: (questions: Question[]) => boolean;
  close: () => void;
  existing?: string[];
}) {
  const [tab, setTab] = useState("custom");
  const [text, setText] = useState("");
  const [type, setType] = useState<QuestionType>("four_level");
  const [error, setError] = useState("");
  const submit = (questions: Question[]) => {
    setError("");
    if (add(questions)) close();
    else
      setError(
        "保存できませんでした。入力内容は残しています。空き容量を確認して再試行してください。",
      );
  };
  return (
    <Modal title="質問を追加" close={close}>
      <div className="tabs">
        <button
          className={tab === "custom" ? "active" : ""}
          onClick={() => setTab("custom")}
        >
          自分で作る
        </button>
        <button
          className={tab === "library" ? "active" : ""}
          onClick={() => setTab("library")}
        >
          質問ライブラリ
        </button>
      </div>
      {tab === "custom" && (
        <label>
          回答形式
          <select
            value={type}
            onChange={(e) => setType(e.target.value as QuestionType)}
          >
            {Object.entries(typeNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}
      {tab === "custom" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) {
              submit([question(text.trim(), type)]);
            }
          }}
        >
          <label>
            質問文
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="どんなことを聞きたい？"
              required
            />
          </label>
          <button className="primary wide" disabled={!text.trim()}>
            質問を追加
          </button>
        </form>
      ) : (
        <QuestionLibrary add={submit} existing={existing} />
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
