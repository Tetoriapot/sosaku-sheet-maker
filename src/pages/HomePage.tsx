import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { templates } from "../data";
import type { Template, Sheet } from "../types";
import { useStore } from "../store";
import { categories, cloneSheet, questionCount } from "../utils/model";
import { Modal } from "../components/Modal";
import SheetView from "../components/SheetView";
import ShareModal from "../components/ShareModal";
import ShareManager from "../components/ShareManager";
import BackupPanel from "../components/BackupPanel";
import ShareFileImport from "../components/ShareFileImport";
import SheetOrganizer from "../components/SheetOrganizer";
import { staticHosting } from "../config";
import styles from "./HomePage.module.css";
export default function HomePage() {
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<Template>();
  const [sharing, setSharing] = useState<Sheet>();
  const [organizing, setOrganizing] = useState<Sheet>();
  const [sheetSearch, setSheetSearch] = useState("");
  const [tag, setTag] = useState("");
  const [archiveView, setArchiveView] = useState("active");
  const [sort, setSort] = useState("updated");
  const { db, update } = useStore();
  const navigate = useNavigate();
  const normalize = (s: string) => s.normalize("NFKC").toLocaleLowerCase();
  const visibleSheets = db.sheets
    .filter((s) => {
      const meta = db.sheetMeta[s.id];
      return (
        (archiveView === "all" ||
          !!meta?.archived === (archiveView === "archived")) &&
        (!tag || meta?.tags.includes(tag)) &&
        normalize(
          [s.title, s.description, s.author, ...(meta?.tags ?? [])].join(" "),
        ).includes(normalize(sheetSearch))
      );
    })
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "ja")
        : Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
  const allTags = [
    ...new Set(db.sheets.flatMap((s) => db.sheetMeta[s.id]?.tags ?? [])),
  ].sort((a, b) => a.localeCompare(b, "ja"));
  const create = (template?: Template) => {
    const sheet = cloneSheet(template);
    if (update((d) => ({ ...d, sheets: [sheet, ...d.sheets] })))
      navigate(`/create?id=${sheet.id}`);
  };
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.kicker}>つくる、答える、わかりあう。</div>
        <h1>
          創作のすりあわせを、
          <br />
          <span>もっと簡単に。</span>
        </h1>
        <p>
          うちの子のこと。交流の距離感。物語の楽しみ方。
          <br />
          あなたの「好き」を伝える質問シートをつくろう。
        </p>
        <button className="primary" onClick={() => create()}>
          ＋ まっさらから作る <span>↗</span>
        </button>
        <small>登録不要・無料で使えます</small>
        <div className="actions">
          <ShareFileImport />
        </div>
        <div className={styles.heroSheet} aria-hidden="true">
          <div>
            MY CREATIVE SHEET <span>✧</span>
          </div>
          <h3>わたしの創作スタンス</h3>
          <p>好きなことから、話してみよう。</p>
          {[
            "関係性をじっくり育てる",
            "日常の何気ないやりとり",
            "新しい物語を一緒につくる",
          ].map((v, i) => (
            <div className={styles.sample} key={v}>
              {v}
              <b>{["◎", "○", "◎"][i]}</b>
            </div>
          ))}
          <footer>◎ 大歓迎　 ○ OK　 △ 要相談　 × NG</footer>
        </div>
      </section>
      <section>
        <div className="section-heading">
          <div>
            <div className="eyebrow">TEMPLATES</div>
            <h2>テンプレートからはじめる</h2>
          </div>
          <span className="muted">少し変えるだけで、あなたのシートに。</span>
        </div>
        <div className="tabs" aria-label="テンプレートカテゴリ">
          {[["all", "すべて"], ...Object.entries(categories)].map(
            ([key, label]) => (
              <button
                aria-pressed={category === key}
                key={key}
                className={category === key ? "active" : ""}
                onClick={() => setCategory(key)}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <div className={styles.grid}>
          {templates
            .filter((t) => category === "all" || t.category === category)
            .map((t, i) => (
              <button
                key={t.id}
                className={styles.card}
                onClick={() => setSelected(t)}
              >
                <div className={`${styles.art} ${styles[`art${i % 6}`]}`}>
                  <span>{t.emoji}</span>
                  <div className={styles.mini}>
                    <b>{t.title}</b>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <span className={styles.category}>
                    {categories[t.category]}
                  </span>
                  <h3>{t.title}</h3>
                  <p>{t.tagline}</p>
                  <footer>
                    <span>{questionCount(t)}項目</span>
                    <b>プレビュー ↗</b>
                  </footer>
                </div>
              </button>
            ))}
        </div>
      </section>
      <section className={styles.recent}>
        <div className="section-heading">
          <div>
            <div className="eyebrow">YOUR SHEETS</div>
            <h2>最近作ったシート</h2>
          </div>
          <div>
            <span className="muted">このブラウザに保存されます </span>
            <BackupPanel />
          </div>
        </div>
        {!!db.sheets.length && (
          <div className="saved-filters">
            <label>
              保存シートを検索
              <input
                type="search"
                value={sheetSearch}
                onChange={(e) => setSheetSearch(e.target.value)}
                placeholder="タイトル・説明・作者・タグ"
              />
            </label>
            <label>
              タグで絞り込み
              <select value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">すべてのタグ</option>
                {allTags.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              表示するシート
              <select
                value={archiveView}
                onChange={(e) => setArchiveView(e.target.value)}
              >
                <option value="active">使用中</option>
                <option value="archived">アーカイブ</option>
                <option value="all">すべて</option>
              </select>
            </label>
            <label>
              並び順
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="updated">更新が新しい順</option>
                <option value="title">タイトル順</option>
              </select>
            </label>
            <p className="muted" role="status">
              {visibleSheets.length} / {db.sheets.length}件
            </p>
          </div>
        )}
        {db.sheets.length === 0 ? (
          <div className={styles.empty}>
            <span>✎</span>
            <h3>まだシートがありません</h3>
            <p>テンプレートから、最初のシートを作ってみましょう。</p>
            <button onClick={() => create()}>シートを作る</button>
          </div>
        ) : (
          visibleSheets.map((s) => (
            <div className={styles.recentRow} key={s.id}>
              <div>
                <h3>{s.title}</h3>
                <small>
                  {questionCount(s)}項目 ·{" "}
                  {new Date(s.updatedAt).toLocaleDateString("ja-JP")} 更新
                </small>
                {!!db.sheetMeta[s.id]?.tags.length && (
                  <p className="muted">
                    {db.sheetMeta[s.id].tags.map((t) => `#${t}`).join(" ")}
                  </p>
                )}
                {db.sheetMeta[s.id]?.archived && <small>アーカイブ済み</small>}
              </div>
              <div className="actions">
                <Link className="button" to={`/create?id=${s.id}`}>
                  編集
                </Link>
                <Link className="button" to={`/answer/${s.id}`}>
                  {db.drafts[s.id] ? "回答を再開" : "回答"}
                </Link>
                <Link className="button" to={`/s/${s.id}`}>
                  シートを見る
                </Link>
                <button onClick={() => setSharing(s)}>共有</button>
                <button onClick={() => setOrganizing(s)}>整理</button>
                <button
                  className="danger"
                  onClick={() => {
                    if (
                      confirm(
                        staticHosting
                          ? "このシートを削除しますか？この操作は元に戻せません。保存済みのバックアップや相手に渡したファイルは残ります。"
                          : "このシートを削除しますか？この操作は元に戻せません。共有URLは残ります。共有の停止は「共有リンク」から行ってください。",
                      )
                    )
                      update((d) => ({
                        ...d,
                        sheets: d.sheets.filter((x) => x.id !== s.id),
                        sheetMeta: Object.fromEntries(
                          Object.entries(d.sheetMeta).filter(
                            ([key]) => key !== s.id,
                          ),
                        ),
                        draftProgress: Object.fromEntries(
                          Object.entries(d.draftProgress).filter(
                            ([key]) => key !== s.id,
                          ),
                        ),
                        drafts: Object.fromEntries(
                          Object.entries(d.drafts).filter(
                            ([key]) => key !== s.id,
                          ),
                        ),
                      }));
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          ))
        )}
        {!!db.sheets.length && !visibleSheets.length && (
          <p className="local-notice">
            条件に合うシートがありません。検索やタグ、表示するシートを変更してください。
          </p>
        )}
        {db.answers.length > 0 && (
          <>
            <div className="section-heading">
              <h3>回答済みのシート</h3>
              <Link className="button" to="/compare">
                回答を比較
              </Link>
            </div>
            {db.answers.map((a) => (
              <Link
                className={styles.answerLink}
                key={a.id}
                to={`/result/${a.id}`}
              >
                {a.sheet.title}
                <span>{a.respondentName || "名前なし"} →</span>
              </Link>
            ))}
          </>
        )}
      </section>
      <ShareManager />
      {!db.answers.length && (
        <p className="center">
          <Link className="button" to="/compare">
            {staticHosting
              ? "回答ファイルを比較する →"
              : "回答URL・JSONを比較する →"}
          </Link>
        </p>
      )}
      {sharing && (
        <ShareModal
          kind="sheet"
          data={sharing}
          close={() => setSharing(undefined)}
        />
      )}
      {organizing && (
        <SheetOrganizer
          sheet={organizing}
          close={() => setOrganizing(undefined)}
        />
      )}
      {selected && (
        <Modal title={selected.title} close={() => setSelected(undefined)}>
          <p>{selected.description}</p>
          <p className="muted">
            {questionCount(selected)}項目 · {categories[selected.category]}
          </p>
          <div className="modal-preview">
            <SheetView sheet={selected} />
          </div>
          <button className="primary wide" onClick={() => create(selected)}>
            このテンプレを使う →
          </button>
        </Modal>
      )}
    </>
  );
}
