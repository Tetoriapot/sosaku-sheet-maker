import { useRef, useState } from "react";
import { useStore } from "../store";
import {
  copyUrl,
  revokeShare,
  shareUrl,
  type ShareReceipt,
} from "../utils/sharing";
import styles from "./Sharing.module.css";
import { staticHosting } from "../config";
export default function ShareManager() {
  const { db, update, notify } = useStore();
  const shares = db.shares.filter((s) => s.status !== "revoked");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const manualRef = useRef<HTMLInputElement>(null);
  const revoke = async (receipt: ShareReceipt) => {
    if (
      !confirm(
        "このURLの共有を停止しますか？相手はこのURLを開けなくなります。保存済みの画像やコピーは残ります。",
      )
    )
      return;
    setBusy(receipt.id);
    setError("");
    try {
      await revokeShare(receipt);
      const saved = update((d) => ({
        ...d,
        shares: d.shares.map((s) =>
          s.id === receipt.id ? { ...s, status: "revoked" } : s,
        ),
      }));
      if (saved) notify("共有を停止しました");
      else
        setError(
          "共有は停止しましたが、このブラウザの表示を更新できませんでした。空き容量を確認して、もう一度停止ボタンを押してください。",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "共有を停止できませんでした。");
    } finally {
      setBusy(undefined);
    }
  };
  if (!shares.length || staticHosting) return null;
  return (
    <section className={styles.manager}>
      <div className="section-heading">
        <div>
          <div className="eyebrow">SHARED LINKS</div>
          <h2>共有リンク</h2>
        </div>
        <span className="muted">シートの削除とは別に、共有を停止できます</span>
      </div>
      {shares.map((s) => (
        <div className={styles.row} key={s.id}>
          <div>
            <h3>{s.title}</h3>
            <small>
              {s.kind === "sheet" ? "回答用シート" : "回答結果"} ·{" "}
              {new Date(s.createdAt).toLocaleDateString("ja-JP")} ·{" "}
              {s.status === "pending" ? "通信結果が未確認" : "共有中"}
            </small>
          </div>
          <div className="actions">
            {s.status === "published" && (
              <>
                <a
                  className="button"
                  href={shareUrl(s)}
                  target="_blank"
                  rel="noreferrer"
                >
                  開く ↗
                </a>
                <button
                  onClick={async () => {
                    const url = shareUrl(s);
                    if (await copyUrl(url)) notify("コピーしました");
                    else {
                      setManual(url);
                      setTimeout(() => {
                        manualRef.current?.focus();
                        manualRef.current?.select();
                      }, 0);
                    }
                  }}
                >
                  URLをコピー
                </button>
              </>
            )}
            <button
              className="danger"
              disabled={!!busy}
              onClick={() => revoke(s)}
            >
              {busy === s.id ? "停止中…" : "共有を停止"}
            </button>
          </div>
          {s.status === "pending" && (
            <p className="muted">
              元のシート・回答からもう一度共有を作成すると再試行できます。不要な共有はここで停止できます。
            </p>
          )}
        </div>
      ))}
      {manual && (
        <label>
          選択したURLをコピーしてください
          <input
            ref={manualRef}
            value={manual}
            readOnly
            onFocus={(e) => e.target.select()}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </section>
  );
}
