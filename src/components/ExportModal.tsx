import { useEffect, useState } from "react";
import type { Answer } from "../types";
import { themes } from "../utils/model";
import { exportImages, type ExportSettings } from "../utils/exportImage";
import { Modal } from "./Modal";
export default function ExportModal({
  answer,
  close,
}: {
  answer: Answer;
  close: () => void;
}) {
  const [settings, setSettings] = useState<ExportSettings>({
    size: "auto",
    theme: answer.sheet.theme,
    name: true,
    description: true,
    comments: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>([]);
  useEffect(() => () => images.forEach(URL.revokeObjectURL), [images]);
  return (
    <Modal title="画像を書き出す" close={close}>
      <label>
        サイズ
        <select
          value={settings.size}
          onChange={(e) =>
            setSettings({
              ...settings,
              size: e.target.value as ExportSettings["size"],
            })
          }
        >
          <option value="square">正方形 · 1080 × 1080</option>
          <option value="portrait">SNS縦 · 1080 × 1350</option>
          <option value="story">ストーリー · 1080 × 1920</option>
          <option value="auto">長文 · 自動高さ</option>
        </select>
      </label>
      <label>
        デザイン
        <select
          value={settings.theme}
          onChange={(e) =>
            setSettings({
              ...settings,
              theme: e.target.value as ExportSettings["theme"],
            })
          }
        >
          {Object.entries(themes).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <div className="actions">
        {(["name", "description", "comments"] as const).map((key, i) => (
          <label className="check" key={key}>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) =>
                setSettings({ ...settings, [key]: e.target.checked })
              }
            />
            {["名前", "説明", "コメント"][i]}
          </label>
        ))}
      </div>
      <p className="muted">
        長い回答は複数枚に分けます。内容が切れずに保存できます。
      </p>
      <button
        className="primary wide"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const blobs = await exportImages(answer, settings);
            setImages(blobs.map((b) => URL.createObjectURL(b)));
          } catch {
            setError(
              "画像を生成できませんでした。別のサイズでお試しください。",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "画像を作成中…" : "PNGを作成"}
      </button>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {images.map((url, i) => (
        <div className="export-preview" key={url}>
          <img src={url} alt={`書き出し画像 ${i + 1}`} />
          <a
            className="button primary wide"
            href={url}
            download={`creative-sheet-${i + 1}.png`}
          >
            {images.length > 1 ? `${i + 1}枚目を` : "PNGを"}保存 ↓
          </a>
        </div>
      ))}
    </Modal>
  );
}
