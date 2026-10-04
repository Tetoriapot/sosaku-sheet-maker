import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { useStore } from "./store";
import HomePage from "./pages/HomePage";
import CreatePage from "./pages/CreatePage";
import AnswerPage from "./pages/AnswerPage";
import ResultPage from "./pages/ResultPage";
import SharedSheetPage from "./pages/SharedSheetPage";
import ComparePage from "./pages/ComparePage";
import UpdatesModal from "./components/UpdatesModal";
import { staticHosting } from "./config";
export function NotFound() {
  return (
    <div className="empty-page">
      <h1>シートが見つかりませんでした。</h1>
      <p>このブラウザに保存されていないか、削除された可能性があります。</p>
      <Link className="button primary" to="/">
        ホームへ
      </Link>
    </div>
  );
}
function Help() {
  return (
    <div className="help-page">
      <div className="eyebrow">HOW TO USE</div>
      <h1>質問シートを、かんたんに。</h1>
      {[
        [
          "テンプレートを選ぶ",
          "気になるカードのプレビューを開き、「このテンプレを使う」を押します。まっさらからも作れます。",
        ],
        [
          "質問を編集する",
          "質問文・形式を変更し、不要な質問を削除。⠿をドラッグして並べ替えできます。スマホでは長押し、キーボードではスペースでつかみ矢印で移動できます。↑↓ボタンも使えます。",
        ],
        [
          "自分のペースで回答する",
          "名前は任意です。入力内容は自動保存され、同じブラウザから続けられます。必須の質問は回答後に完成できます。",
        ],
        [
          staticHosting ? "PNGやファイルで共有する" : "PNGやURLで共有する",
          staticHosting
            ? "共有画面で名前やコメントなど、相手に見せる項目を選んで確認します。保存した共有ファイルを相手に渡すと、ホームの「共有ファイルを開く」から回答・閲覧できます。PNGも保存できます。"
            : "共有画面で相手に見せる項目を選び、プレビューを確認してからURLを作成します。回答用のシートと閲覧用の結果は別々に共有できます。PNGも保存できます。",
        ],
      ].map(([title, text], i) => (
        <section key={title}>
          <span className="step-number">{i + 1}</span>
          <div>
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
        </section>
      ))}
      <h2>保存について</h2>
      <p>
        シートと回答はこの端末のブラウザに保存されます。ブラウザのデータを消すと失われるため、大切な回答はPNGまたはJSONで保存してください。プライベートブラウジングでは、終了時にデータが消える場合があります。
      </p>
      <h2>バックアップと復元</h2>
      <p>
        ホームの「バックアップ・復元」から、シート・途中回答・完成した回答・タグ・再開位置をまとめて保存できます。復元前に件数を確認し、既存データを残して取り込みます。同じIDは現在の内容を優先します。表示モードは復元先の設定を使います。
      </p>
      <p>
        バックアップは自分用です。相手に渡すときは、公開内容を選べる共有ファイルを使ってください。ローカル版の共有停止情報を含める場合、同じサイトでだけ復元できます。
      </p>
      <h2>途中から再開・シートを整理</h2>
      <p>
        回答画面の「前回の回答位置から再開」「未回答の質問へ」「セクション目次」を使えます。ホームの「整理」からタグ付け・アーカイブできます。アーカイブは「表示するシート」で切り替えて戻せます。
      </p>
      <h2>回答を比較するには</h2>
      <p>
        ホームや回答結果の「回答を比較」から2〜12件を選びます。回答の共有ファイルやJSONを取り込めます。セクション、質問文、補足、回答形式、選択肢、必須設定、順序が同じ回答だけを比較できます。構成の違いは質問単位で表示します。「違いのある項目だけ」、質問検索、質問の選択で確認したい項目に絞れます。
      </p>
      <p>
        取り込みは比較画面内だけで使用し、内容をサーバーに送信しません。比較画面から移動すると取り込み内容は消えます。
      </p>
      <h2>{staticHosting ? "共有した内容について" : "共有を停止するには"}</h2>
      <p>
        {staticHosting
          ? "この公開版は共有用サーバーを使いません。相手に渡したファイルや画像は相手の端末に残り、後から取り消せません。ブラウザのアドレスを送るだけでは、保存したシートや回答は共有されません。"
          : "ホームの「共有リンク」から停止できます。シートを削除しても共有URLは残ります。共有停止情報は作成したブラウザか、管理情報を含めたバックアップに保管してください。相手が保存した画像やコピーは、共有を停止しても消えません。"}
      </p>
      <Link className="button primary" to="/">
        テンプレートを選ぶ →
      </Link>
    </div>
  );
}
export default function App() {
  const { db, update } = useStore();
  const [showUpdates, setShowUpdates] = useState(false);
  const location = useLocation();
  const active = location.pathname.startsWith("/create")
    ? 1
    : location.pathname.startsWith("/answer")
      ? 2
      : location.pathname.startsWith("/result") ||
          location.pathname.startsWith("/s/") ||
          location.pathname.startsWith("/compare")
        ? 3
        : 0;
  useEffect(() => {
    document.documentElement.dataset.mode = db.mode;
  }, [db.mode]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        本文へ移動
      </a>
      <header className="header">
        <Link className="brand" to="/">
          <span className="brand-icon">✎</span>
          <span>
            創作シートメーカー<small>CREATIVE SHEET MAKER</small>
          </span>
        </Link>
        <nav aria-label="共通メニュー">
          <Link className="button primary" to="/create">
            ＋ 新しく作る
          </Link>
          <button
            className="header-link"
            type="button"
            aria-haspopup="dialog"
            onClick={() => setShowUpdates(true)}
          >
            更新情報
          </button>
          <label className="mode-label">
            <span className="sr-only">表示モード</span>
            <select
              aria-label="表示モード"
              title="ライトモード・ダークモード・OSに合わせた自動表示"
              value={db.mode}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  mode: e.target.value as typeof db.mode,
                }))
              }
            >
              <option value="auto">◐ 自動</option>
              <option value="light">☀ ライト</option>
              <option value="dark">☾ ダーク</option>
            </select>
          </label>
          <Link
            className="header-link"
            to="/help"
            title="Help・使い方"
            aria-current={location.pathname === "/help" ? "page" : undefined}
          >
            Help
          </Link>
        </nav>
      </header>
      <div className="steps">
        <ol>
          {["テンプレ", "編集", "回答", "共有"].map((label, i) => (
            <li
              key={label}
              className={i === active ? "current" : i < active ? "done" : ""}
              aria-current={i === active ? "step" : undefined}
            >
              <span>{i < active ? "✓" : i + 1}</span>
              {label}
              {i < 3 && <b>—</b>}
            </li>
          ))}
        </ol>
      </div>
      <main id="main" className="container" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/answer/:sheetId" element={<AnswerPage />} />
          <Route path="/result/:answerId" element={<ResultPage />} />
          <Route path="/s/:sheetId" element={<SharedSheetPage />} />
          <Route path="/help" element={<Help />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <Link to="/">✎ 創作シートメーカー</Link>
        <span>あなたの物語を、もっと心地よく。</span>
        <Link to="/help">使い方・保存について ↗</Link>
      </footer>
      {showUpdates && <UpdatesModal close={() => setShowUpdates(false)} />}
    </>
  );
}
