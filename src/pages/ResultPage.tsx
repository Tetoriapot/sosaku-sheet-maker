import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store";
import { cloneSheet } from "../utils/model";
import SheetView from "../components/SheetView";
import ExportModal from "../components/ExportModal";
import { useSharedResource } from "../hooks/useSharedResource";
import ResourceStatus from "../components/ResourceStatus";
import ShareModal from "../components/ShareModal";
import { staticHosting } from "../config";
export default function ResultPage() {
  const { answerId } = useParams();
  const { db, update, notify } = useStore();
  const navigate = useNavigate();
  const resource = useSharedResource("answer", answerId);
  const answer = resource.data;
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  if (!answer) return <ResourceStatus {...resource} />;
  const copy = () => {
    const sheet = cloneSheet(answer.sheet);
    if (update((d) => ({ ...d, sheets: [sheet, ...d.sheets] })))
      navigate(`/create?id=${sheet.id}`);
  };
  return (
    <div className="result-page">
      <div className="center">
        <div className="success-mark">✓</div>
        <div className="eyebrow">READY TO SHARE</div>
        <h1>{resource.remote ? "回答結果" : "できました！"}</h1>
        <p className="muted">
          {resource.remote
            ? "共有された回答を表示しています。"
            : "あなたの創作スタンスを、1枚のシートに。"}
        </p>
      </div>
      <div className="result-actions">
        <Link
          className="button"
          to={`/compare?${resource.remote ? "shared" : "answer"}=${encodeURIComponent(answer.id)}`}
        >
          回答を比較
        </Link>
        <button className="primary" onClick={() => setExporting(true)}>
          PNGで保存 ↓
        </button>
        {!resource.remote && (
          <button className="primary" onClick={() => setSharing(true)}>
            {staticHosting ? "回答結果をファイルで共有" : "回答結果をURLで共有"}
          </button>
        )}
        <button onClick={copy}>このシートをコピー</button>
        <button
          onClick={() => {
            const sheet =
              db.sheets.find((s) => s.id === answer.sheetId) ??
              cloneSheet(answer.sheet);
            const exists = db.sheets.some((s) => s.id === sheet.id);
            if (
              db.drafts[sheet.id] &&
              !confirm(
                "回答途中の内容があります。途中の回答を消して、最初から回答しますか？",
              )
            )
              return;
            if (
              update((d) => ({
                ...d,
                sheets: exists ? d.sheets : [sheet, ...d.sheets],
                drafts: Object.fromEntries(
                  Object.entries(d.drafts).filter(([k]) => k !== sheet.id),
                ),
              }))
            )
              navigate(`/answer/${sheet.id}`);
          }}
        >
          もう一度回答
        </button>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(answer, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "creative-sheet-answer.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            notify("回答データを書き出しました");
          }}
        >
          回答データを保存
        </button>
      </div>
      <p className="local-notice">
        {resource.remote
          ? "共有時点の回答です。このページから元の回答を変更することはできません。"
          : staticHosting
            ? "この回答はこのブラウザに保存されています。PNGまたは共有ファイルで相手に伝えられます。"
            : "この回答はこのブラウザに保存されています。PNGまたは共有URLで相手に伝えられます。"}
      </p>
      <SheetView sheet={answer.sheet} answer={answer} />
      <Link className="button" to="/">
        ホームへ
      </Link>
      {exporting && (
        <ExportModal answer={answer} close={() => setExporting(false)} />
      )}
      {sharing && (
        <ShareModal
          kind="answer"
          data={answer}
          close={() => setSharing(false)}
        />
      )}
    </div>
  );
}
