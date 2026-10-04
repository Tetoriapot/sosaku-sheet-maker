import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MAX_BODY_BYTES,
  parseAnswer,
  parseSharePayload,
  type SharePayload,
} from "../../shared/validation";
import { useStore } from "../store";
import { cloneSheet, id } from "../utils/model";
import type { Answer, Sheet } from "../types";
import { Modal } from "./Modal";
import SheetView from "./SheetView";
export default function ShareFileImport() {
  const [opened, setOpened] = useState(false);
  const [payload, setPayload] = useState<SharePayload>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { update } = useStore();
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => setOpened(true)}>共有ファイルを開く</button>
      {opened && (
        <Modal title="共有ファイルを開く" close={() => setOpened(false)}>
          <p>
            相手から受け取ったシート・回答のJSONを選びます。内容を確認してから、このブラウザにコピーできます。ファイルはサーバーに送信しません。
          </p>
          <label>
            共有JSONファイル
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                setPayload(undefined);
                setError("");
                if (!file) return;
                setBusy(true);
                try {
                  if (file.size > MAX_BODY_BYTES)
                    throw new Error("600KiB以内のファイルを選んでください。");
                  const raw = JSON.parse(await file.text());
                  setPayload(
                    raw && typeof raw === "object" && raw.kind
                      ? parseSharePayload(raw)
                      : { kind: "answer", data: parseAnswer(raw) },
                  );
                } catch (e) {
                  setError(
                    e instanceof SyntaxError
                      ? "JSONを読み取れませんでした。"
                      : (e as Error).message,
                  );
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          {payload && (
            <>
              <div className="modal-preview" tabIndex={0}>
                <SheetView
                  sheet={
                    payload.kind === "sheet"
                      ? (payload.data as Sheet)
                      : (payload.data as Answer).sheet
                  }
                  answer={
                    payload.kind === "answer"
                      ? (payload.data as Answer)
                      : undefined
                  }
                />
              </div>
              <button
                className="primary wide"
                onClick={() => {
                  if (payload.kind === "sheet") {
                    const sheet = cloneSheet(payload.data as Sheet);
                    if (
                      update((d) => ({ ...d, sheets: [sheet, ...d.sheets] }))
                    ) {
                      setOpened(false);
                      navigate(`/answer/${sheet.id}`);
                    }
                  } else {
                    const answer = { ...(payload.data as Answer), id: id() };
                    if (
                      update((d) => ({ ...d, answers: [answer, ...d.answers] }))
                    ) {
                      setOpened(false);
                      navigate(`/result/${answer.id}`);
                    }
                  }
                }}
              >
                {payload.kind === "sheet"
                  ? "コピーして回答する"
                  : "回答を保存して開く"}
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
