import { Modal } from "./Modal";

const previousUpdates = [
  {
    version: "0.3.1",
    title: "右上に共通メニューを配置",
    items: [
      "更新情報、ライト・ダーク・自動の切り替え、Helpを右上にまとめました。",
    ],
  },
  {
    version: "0.3.0",
    title: "質問を見つけやすく、回答を比べやすく",
    items: [
      "2〜4件の回答を比較。共有URLや回答JSONの取り込み、違いのある項目への絞り込みに対応しました。",
      "質問ライブラリを154件に拡充。検索、一括追加、追加済みの表示に対応しました。",
      "テンプレートが8種類、シートのデザインが7種類になりました。",
      "保存失敗時の質問入力の保持、途中回答の上書き確認、必須項目の空白判定を改善しました。",
    ],
  },
  {
    version: "0.2.0",
    title: "シートと回答をURLで共有",
    items: [
      "回答用のシートと閲覧用の回答結果を、それぞれURLで共有できるようになりました。",
      "共有した内容は作成時点のまま保存され、ホームの「共有リンク」から共有を停止できます。",
    ],
  },
  {
    version: "0.1.0",
    title: "創作シートメーカーの基本機能",
    items: [
      "テンプレート選択、質問の編集と並べ替え、8種類の回答形式に対応しました。",
      "このブラウザへの自動保存、回答結果の閲覧、PNGと回答JSONの保存に対応しました。",
    ],
  },
];

export default function UpdatesModal({ close }: { close: () => void }) {
  return (
    <Modal title="更新情報" close={close}>
      <p className="muted">
        新しく使える機能と、使いやすさの改善をお知らせします。
      </p>
      <div className="updates-list">
        <section aria-labelledby="latest-update-title">
          <div className="update-meta">
            <span>最新 · v0.4.0</span>
            <time dateTime="2026-10-05">2026年10月5日</time>
          </div>
          <h3 id="latest-update-title">保存・共有・再開・比較を使いやすく</h3>
          <ul>
            <li>
              シート・途中回答をまとめてバックアップし、既存データを残して復元できます。
            </li>
            <li>
              共有する名前・説明・コメントを選び、プレビューで確認できます。公開版ではPNGと共有ファイルを使います。
            </li>
            <li>
              前回の回答位置から再開し、未回答やセクションへ移動できます。
            </li>
            <li>
              保存したシートの検索・タグ・アーカイブと、最大12件の回答比較に対応しました。
            </li>
          </ul>
        </section>
        {previousUpdates.map(({ version, title, items }) => (
          <section key={version} aria-labelledby={`update-${version}`}>
            <div className="update-meta">v{version}</div>
            <h3 id={`update-${version}`}>{title}</h3>
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
