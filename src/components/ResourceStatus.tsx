import { Link } from "react-router-dom";
export default function ResourceStatus({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error?: string;
  retry: () => void;
}) {
  return (
    <div className="empty-page" aria-live="polite">
      {loading ? (
        <>
          <h1>共有データを読み込んでいます</h1>
          <p>少しお待ちください。</p>
        </>
      ) : error ? (
        <>
          <h1>読み込めませんでした</h1>
          <p>{error}</p>
          <button onClick={retry}>再試行</button>
        </>
      ) : (
        <>
          <h1>シートが見つかりませんでした。</h1>
          <p>共有が停止されたか、URLが間違っている可能性があります。</p>
        </>
      )}
      <p>
        <Link className="button" to="/">
          ホームへ
        </Link>
      </p>
    </div>
  );
}
