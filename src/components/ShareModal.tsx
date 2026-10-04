import { useRef, useState } from "react";
import type { Answer, Sheet } from "../types";
import { useStore } from "../store";
import {
  MAX_BODY_BYTES,
  parseSharePayload,
  type ShareKind,
} from "../../shared/validation";
import {
  copyUrl,
  fingerprint,
  newReceipt,
  publishShare,
  shareUrl,
  ShareError,
  type ShareReceipt,
} from "../utils/sharing";
import { Modal } from "./Modal";
import styles from "./Sharing.module.css";
import SheetView from "./SheetView";
import { publicationData, type PublicationOptions } from "../utils/publication";
import { downloadJson } from "../utils/backup";
import { staticHosting } from "../config";
export default function ShareModal({
  kind,
  data,
  close,
}: {
  kind: ShareKind;
  data: Sheet | Answer;
  close: () => void;
}) {
  const { db, update, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState<ShareReceipt>();
  const [manual, setManual] = useState(false);
  const [options, setOptions] = useState<PublicationOptions>({
    name: true,
    author: true,
    description: true,
    comments: true,
  });
  const [reviewed, setReviewed] = useState(false);
  const publicData = publicationData(kind, data, options);
  const urlRef = useRef<HTMLInputElement>(null);
  const create = async () => {
    setBusy(true);
    setError("");
    let activeReceipt: ShareReceipt | undefined;
    try {
      // Validate before making a receipt or transmitting any data.
      parseSharePayload({ kind, data: publicData });
      const hash = await fingerprint(publicData);
      const previous = db.shares.find(
        (s) =>
          s.kind === kind &&
          s.sourceId === data.id &&
          s.fingerprint === hash &&
          s.status !== "revoked",
      );
      const receipt = previous ?? newReceipt(kind, publicData, hash);
      activeReceipt = receipt;
      // Persist the secret before publishing: a lost response can then be retried safely.
      if (
        !previous &&
        !update((d) => ({ ...d, shares: [receipt, ...d.shares] }))
      ) {
        setError(
          "管理情報を保存できないため、共有を作成できませんでした。ブラウザの空き容量を確認してください。",
        );
        return;
      }
      await publishShare(receipt, publicData);
      const complete = { ...receipt, status: "published" as const };
      const saved = update((d) => ({
        ...d,
        shares: d.shares.map((s) => (s.id === receipt.id ? complete : s)),
      }));
      setPublished(complete);
      if (saved) notify("共有URLを作成しました");
      else
        setError(
          "URLは作成されましたが、管理一覧の状態を保存できませんでした。空き容量を確認してください。共有を停止する情報は作成前に保存済みです。",
        );
    } catch (error) {
      if (error instanceof ShareError && error.status === 410 && activeReceipt)
        update((d) => ({
          ...d,
          shares: d.shares.map((s) =>
            s.id === activeReceipt?.id ? { ...s, status: "revoked" } : s,
          ),
        }));
      setError(
        error instanceof Error
          ? error.message
          : "共有URLを作成できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  };
  const url = published ? shareUrl(published) : "";
  return (
    <Modal
      title={
        staticHosting
          ? kind === "sheet"
            ? "シートをファイルで共有"
            : "回答結果をファイルで共有"
          : kind === "sheet"
            ? "シートをURLで共有"
            : "回答結果をURLで共有"
      }
      close={close}
      dismissible={!busy}
    >
      <p>
        {staticHosting
          ? "共有ファイルを相手に渡すと、このサイトの「共有ファイルを開く」から内容を確認できます。"
          : kind === "sheet"
            ? "URLを受け取った人が、このシートに回答できます。"
            : "URLを受け取った人が、選択した内容を閲覧できます。"}
      </p>
      <div className={styles.note}>
        <strong>共有する内容</strong>
        <p>
          {kind === "sheet"
            ? (data as Sheet).title
            : (data as Answer).sheet.title}
        </p>
        <p>
          {staticHosting
            ? "渡したファイルの内容は相手の端末に残ります。後から取り消すことはできません。"
            : "今の内容を固定して共有します。編集後は新しいURLを作成してください。URLを知っている人は誰でも開けます。"}
        </p>
      </div>
      {published ? (
        <>
          <label>
            共有URL
            <input
              ref={urlRef}
              value={url}
              readOnly
              onFocus={(e) => e.target.select()}
            />
          </label>
          <div className="actions">
            <button
              className="primary"
              onClick={async () => {
                if (await copyUrl(url)) notify("コピーしました");
                else {
                  setManual(true);
                  urlRef.current?.focus();
                  urlRef.current?.select();
                }
              }}
            >
              URLをコピー
            </button>
            <a className="button" href={url} target="_blank" rel="noreferrer">
              共有ページを開く ↗
            </a>
          </div>
          {manual && (
            <p role="status">
              自動コピーできませんでした。選択したURLをコピーしてください。
            </p>
          )}
          {["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) && (
            <p className="local-notice">
              これはローカルのURLです。このPCの別ブラウザで確認できます。インターネットで共有するには、サーバーを公開先へ配置してください。
            </p>
          )}
          <p className="muted">
            共有の停止は、ホームの「共有リンク」から行えます。
          </p>
        </>
      ) : (
        <>
          <fieldset disabled={busy}>
            <legend>相手に見せる項目</legend>
            {(
              [
                ...(kind === "answer" ? (["name", "comments"] as const) : []),
                "author",
                "description",
              ] as (keyof PublicationOptions)[]
            ).map((key) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) => {
                    setOptions({ ...options, [key]: e.target.checked });
                    setReviewed(false);
                  }}
                />
                {
                  {
                    name: "回答者名",
                    comments: "補足コメント",
                    author: "作者名",
                    description: "シートの説明",
                  }[key]
                }
                を含める
              </label>
            ))}
          </fieldset>
          <h3>相手に見える内容のプレビュー</h3>
          <p className="muted">
            質問文や回答本文に書いた名前などは自動では消えません。全体を確認してください。
          </p>
          <div
            className="modal-preview"
            tabIndex={0}
            aria-label="共有する内容のプレビュー"
          >
            <SheetView
              sheet={
                kind === "sheet"
                  ? (publicData as Sheet)
                  : (publicData as Answer).sheet
              }
              answer={kind === "answer" ? (publicData as Answer) : undefined}
            />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={reviewed}
              disabled={busy}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            相手に見せる内容を確認しました
          </label>
          {staticHosting ? (
            <button
              className="primary wide"
              disabled={!reviewed}
              onClick={() => {
                try {
                  const payload = parseSharePayload({ kind, data: publicData });
                  if (
                    new Blob([JSON.stringify(payload, null, 2)]).size >
                    MAX_BODY_BYTES
                  )
                    throw new Error(
                      "共有ファイルが600KiBを超えています。回答やコメントを短くするか、PNGで共有してください。",
                    );
                  downloadJson(payload, `creative-sheet-${kind}-share.json`);
                  notify("共有ファイルを保存しました");
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              共有ファイルを保存
            </button>
          ) : (
            <>
              <p className="muted">
                作成したブラウザから共有を停止できます。ブラウザの保存データを消すと、停止に必要な情報も失われます。
              </p>
              <button
                className="primary wide"
                disabled={busy || !reviewed}
                onClick={create}
              >
                {busy ? "共有URLを作成中…" : "共有URLを作成"}
              </button>
            </>
          )}
        </>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
