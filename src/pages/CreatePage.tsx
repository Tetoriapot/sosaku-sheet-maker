import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { arrayMove } from "@dnd-kit/sortable";
import { useStore } from "../store";
import type { Sheet } from "../types";
import { cloneSheet, id, questionCount } from "../utils/model";
import SectionEditor from "../components/SectionEditor";
import SheetInfoEditor from "../components/SheetInfoEditor";
import AddQuestionModal from "../components/AddQuestionModal";
import SheetView from "../components/SheetView";
import ShareModal from "../components/ShareModal";
import styles from "../components/Editor.module.css";
export default function CreatePage() {
  const [params, setParams] = useSearchParams();
  const { db, update } = useStore();
  const sheet = db.sheets.find((s) => s.id === params.get("id"));
  const [adding, setAdding] = useState<string>();
  const [tab, setTab] = useState("edit");
  const [sharing, setSharing] = useState(false);
  const save = (next: Sheet) =>
    update((d) => ({
      ...d,
      sheets: d.sheets.map((s) =>
        s.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : s,
      ),
    }));
  if (!sheet)
    return (
      <div className="empty-page">
        <h1>まっさらから作ろう</h1>
        <p>質問を追加して、自分だけのシートに。</p>
        <button
          className="primary"
          onClick={() => {
            const s = cloneSheet();
            if (update((d) => ({ ...d, sheets: [s, ...d.sheets] })))
              setParams({ id: s.id });
          }}
        >
          新しいシートを作る
        </button>
      </div>
    );
  const changeSection = (
    sectionId: string,
    fn: (s: Sheet["sections"][number]) => Sheet["sections"][number],
  ) =>
    save({
      ...sheet,
      sections: sheet.sections.map((s) => (s.id === sectionId ? fn(s) : s)),
    });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE IT YOURS</div>
          <h1>シートを編集</h1>
          <p className="muted">質問を少し変えて、あなたらしく。</p>
        </div>
        <div className="actions">
          <button onClick={() => setSharing(true)}>シートを共有</button>
          <Link className="button primary" to={`/answer/${sheet.id}`}>
            回答へ進む →
          </Link>
        </div>
      </div>
      <div className={styles.mobileTabs}>
        <button
          className={tab === "edit" ? "active" : ""}
          onClick={() => setTab("edit")}
        >
          編集
        </button>
        <button
          className={tab === "preview" ? "active" : ""}
          onClick={() => setTab("preview")}
        >
          プレビュー
        </button>
      </div>
      <div className={styles.columns}>
        <div
          className={`${styles.edit} ${tab !== "edit" ? styles.mobileHidden : ""}`}
        >
          <SheetInfoEditor sheet={sheet} save={save} />
          {sheet.sections.map((s, sectionIndex) => (
            <SectionEditor
              key={s.id}
              section={s}
              index={sectionIndex}
              count={sheet.sections.length}
              change={(next) => changeSection(s.id, () => next)}
              move={(direction) =>
                save({
                  ...sheet,
                  sections: arrayMove(
                    sheet.sections,
                    sectionIndex,
                    sectionIndex + direction,
                  ),
                })
              }
              remove={() =>
                save({
                  ...sheet,
                  sections: sheet.sections.filter((v) => v.id !== s.id),
                })
              }
              add={() => setAdding(s.id)}
            />
          ))}
          <button
            className="wide"
            onClick={() =>
              save({
                ...sheet,
                sections: [
                  ...sheet.sections,
                  {
                    id: id(),
                    title: "新しいセクション",
                    description: "",
                    icon: "",
                    questions: [],
                  },
                ],
              })
            }
          >
            ＋ セクション追加
          </button>
        </div>
        <aside
          className={`${styles.preview} ${tab !== "preview" ? styles.mobileHidden : ""}`}
        >
          <div className={styles.previewHeading}>
            <span>プレビュー</span>
            <small>{questionCount(sheet)}項目 · 自動保存</small>
          </div>
          <SheetView sheet={sheet} />
        </aside>
      </div>
      <div className={styles.bottomBar}>
        <span>{questionCount(sheet)}項目</span>
        <button
          onClick={() => {
            if (sheet.sections.length) setAdding(sheet.sections.at(-1)!.id);
            else {
              const sectionId = id();
              if (
                save({
                  ...sheet,
                  sections: [
                    {
                      id: sectionId,
                      title: "質問",
                      description: "",
                      icon: "",
                      questions: [],
                    },
                  ],
                })
              )
                setAdding(sectionId);
            }
          }}
        >
          ＋ 質問を追加
        </button>
        <Link className="button primary" to={`/answer/${sheet.id}`}>
          回答へ →
        </Link>
      </div>
      {adding && (
        <AddQuestionModal
          close={() => setAdding(undefined)}
          existing={sheet.sections.flatMap((s) =>
            s.questions.map((q) => q.text),
          )}
          add={(questions) =>
            changeSection(adding, (s) => ({
              ...s,
              questions: [...s.questions, ...questions],
            }))
          }
        />
      )}
      {sharing && (
        <ShareModal kind="sheet" data={sheet} close={() => setSharing(false)} />
      )}
    </>
  );
}
