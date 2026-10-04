import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import type { Section } from "../types";
import { id } from "../utils/model";
import QuestionEditor from "./QuestionEditor";
import styles from "./Editor.module.css";
interface Props {
  section: Section;
  index: number;
  count: number;
  change: (s: Section) => void;
  move: (direction: number) => void;
  remove: () => void;
  add: () => void;
}
export default function SectionEditor({
  section: s,
  index,
  count,
  change,
  move,
  remove,
  add,
}: Props) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>
        <span className="eyebrow">SECTION {index + 1}</span>
        <div className="actions">
          <button
            aria-label="セクションを前へ"
            disabled={index === 0}
            onClick={() => move(-1)}
          >
            ↑
          </button>
          <button
            aria-label="セクションを後へ"
            disabled={index === count - 1}
            onClick={() => move(1)}
          >
            ↓
          </button>
          <button
            className="danger"
            onClick={() => {
              if (confirm("セクション内の質問も削除しますか？")) remove();
            }}
          >
            削除
          </button>
        </div>
      </div>
      <label>
        セクション名
        <input
          value={s.title}
          onChange={(e) => change({ ...s, title: e.target.value })}
        />
      </label>
      <details>
        <summary>セクションの説明・アイコン</summary>
        <label>
          説明
          <textarea
            value={s.description}
            onChange={(e) => change({ ...s, description: e.target.value })}
          />
        </label>
        <label>
          アイコン（任意）
          <input
            value={s.icon}
            onChange={(e) => change({ ...s, icon: e.target.value })}
          />
        </label>
      </details>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (over && active.id !== over.id) {
            const from = s.questions.findIndex((q) => q.id === active.id);
            const to = s.questions.findIndex((q) => q.id === over.id);
            if (from >= 0 && to >= 0)
              change({ ...s, questions: arrayMove(s.questions, from, to) });
          }
        }}
      >
        <SortableContext
          items={s.questions.map((q) => q.id)}
          strategy={verticalListSortingStrategy}
        >
          {s.questions.map((q, i) => (
            <QuestionEditor
              key={q.id}
              q={q}
              index={i}
              change={(next) =>
                change({
                  ...s,
                  questions: s.questions.map((x) => (x.id === q.id ? next : x)),
                })
              }
              remove={() =>
                change({
                  ...s,
                  questions: s.questions.filter((x) => x.id !== q.id),
                })
              }
              duplicate={() =>
                change({
                  ...s,
                  questions: [
                    ...s.questions.slice(0, i + 1),
                    { ...structuredClone(q), id: id() },
                    ...s.questions.slice(i + 1),
                  ],
                })
              }
              move={(n) => {
                if (i + n >= 0 && i + n < s.questions.length)
                  change({ ...s, questions: arrayMove(s.questions, i, i + n) });
              }}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button className="wide dashed" onClick={add}>
        ＋ このセクションに質問を追加
      </button>
    </section>
  );
}
