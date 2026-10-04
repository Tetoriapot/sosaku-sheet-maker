import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store";
import { cloneSheet } from "../utils/model";
import SheetView from "../components/SheetView";
import { useState } from "react";
import { useSharedResource } from "../hooks/useSharedResource";
import ResourceStatus from "../components/ResourceStatus";
import ShareModal from "../components/ShareModal";
export default function SharedSheetPage() {
  const { sheetId } = useParams();
  const { update } = useStore();
  const navigate = useNavigate();
  const resource = useSharedResource("sheet", sheetId);
  const [sharing, setSharing] = useState(false);
  const sheet = resource.data;
  if (!sheet) return <ResourceStatus {...resource} />;
  return (
    <div className="result-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CREATIVE SHEET</div>
          <h1>シートを見てみよう</h1>
        </div>
        <Link className="button primary" to={`/answer/${sheet.id}`}>
          このシートに回答 →
        </Link>
      </div>
      <p className="local-notice">
        {resource.remote
          ? "共有されたシートです。回答内容は自分のブラウザに保存され、回答結果を共有するまでは相手に送信されません。"
          : "このブラウザに保存されているシートです。共有URLを作成すると、相手も回答できます。"}
      </p>
      {!resource.remote && (
        <button className="primary wide" onClick={() => setSharing(true)}>
          シートをURLで共有
        </button>
      )}
      <SheetView sheet={sheet} />
      <button
        className="wide"
        onClick={() => {
          const next = cloneSheet(sheet);
          if (update((d) => ({ ...d, sheets: [next, ...d.sheets] })))
            navigate(`/create?id=${next.id}`);
        }}
      >
        このシートをコピー
      </button>
      {sharing && (
        <ShareModal kind="sheet" data={sheet} close={() => setSharing(false)} />
      )}
    </div>
  );
}
