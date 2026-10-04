import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../store";
import { MAX_BODY_BYTES, parseAnswer } from "../../shared/validation";
import { fingerprint, readShare } from "../utils/sharing";
import {
  comparisonSchema,
  compatibilityReason,
  MAX_COMPARISONS,
  sharedAnswerId,
  type ComparisonSource,
} from "../utils/comparison";
import ComparisonTable from "../components/ComparisonTable";
import styles from "../components/Comparison.module.css";
import { staticHosting } from "../config";
export default function ComparePage() {
  const { db } = useStore();
  const [params] = useSearchParams();
  const initialLocal = params.get("answer");
  const initialShared = params.get("shared");
  const [imported, setImported] = useState<ComparisonSource[]>([]);
  const [selected, setSelected] = useState<string[]>(
    initialLocal ? [`local:${initialLocal}`] : [],
  );
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const local = useMemo(
    () =>
      db.answers.map((answer) => ({
        key: `local:${answer.id}`,
        answer,
        origin: "local" as const,
      })),
    [db.answers],
  );
  const sources = [...local, ...imported];
  const chosen = sources.filter((source) => selected.includes(source.key));
  const schema = chosen[0]
    ? comparisonSchema(chosen[0].answer.sheet)
    : undefined;
  const compatible = chosen.every(
    (source) => comparisonSchema(source.answer.sheet) === schema,
  );
  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);
  useEffect(() => {
    if (!initialShared) return;
    const controller = new AbortController();
    setBusy(true);
    readShare(initialShared, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        if (value.kind !== "answer")
          throw new Error("回答結果のURLを指定してください。");
        const source = {
          key: `url:${initialShared}`,
          answer: parseAnswer(value.data),
          origin: "url" as const,
        };
        setImported([source]);
        setSelected([source.key]);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "読み込めませんでした。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [initialShared]);
  const addSource = (source: ComparisonSource) => {
    if (sources.some((s) => s.key === source.key)) {
      setNotice("この回答は取り込み済みです。");
      return;
    }
    setImported((values) => [...values, source]);
    if (
      chosen.length < MAX_COMPARISONS &&
      (!schema || comparisonSchema(source.answer.sheet) === schema)
    )
      setSelected((keys) => [...keys, source.key]);
    setNotice(
      "回答を取り込みました。質問構成が同じ回答を2〜12件選んでください。",
    );
  };
  const importUrl = async () => {
    setError("");
    setNotice("");
    let id: string;
    try {
      id = sharedAnswerId(url, location.origin);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const value = await readShare(id, controller.signal);
      if (value.kind !== "answer")
        throw new Error("回答結果のURLを指定してください。");
      addSource({
        key: `url:${id}`,
        answer: parseAnswer(value.data),
        origin: "url",
      });
      setUrl("");
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "読み込めませんでした。");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setNotice("");
    if (file.size > MAX_BODY_BYTES) {
      setError("600KiB以内の回答JSONを選んでください。");
      return;
    }
    setBusy(true);
    try {
      let value: unknown;
      try {
        value = JSON.parse(await file.text());
      } catch {
        throw new Error(
          "JSONを読み取れませんでした。「回答データを保存」で書き出したファイルを選んでください。",
        );
      }
      const answer = parseAnswer(
        value &&
          typeof value === "object" &&
          "kind" in value &&
          value.kind === "answer" &&
          "data" in value
          ? value.data
          : value,
      );
      addSource({
        key: `file:${await fingerprint(answer)}`,
        answer,
        origin: "file",
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "ファイルを読み込めませんでした。",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">COMPARE ANSWERS</div>
          <h1>回答を並べて見る</h1>
        </div>
        <Link className="button" to="/">
          ホームへ
        </Link>
      </div>
      <p className={styles.intro}>
        同じ質問にどう答えたか、2〜12件を見比べられます。セクション・質問文・補足・回答形式・選択肢・必須設定・順序が同じ回答を選んでください。
      </p>
      <div className={styles.sources}>
        <section className={styles.panel}>
          <h2>比較する回答を選ぶ</h2>
          <p className="muted">
            選択中 {chosen.length} / {MAX_COMPARISONS}件
          </p>
          <div className={styles.candidates}>
            {sources.map((source) => {
              const checked = selected.includes(source.key);
              const mismatch =
                !!schema && comparisonSchema(source.answer.sheet) !== schema;
              return (
                <label className={styles.candidate} key={source.key}>
                  <input
                    type="checkbox"
                    aria-label={`${source.answer.respondentName || "名前なし"}・${source.answer.sheet.title}を比較する`}
                    checked={checked}
                    disabled={
                      busy ||
                      (!checked &&
                        (chosen.length >= MAX_COMPARISONS || mismatch))
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, source.key]
                          : selected.filter((k) => k !== source.key),
                      )
                    }
                  />
                  <span>
                    {source.answer.respondentName || "名前なし"}
                    <small>{source.answer.sheet.title}</small>
                    <small>
                      {new Date(source.answer.createdAt).toLocaleString(
                        "ja-JP",
                      )}{" "}
                      ·{" "}
                      {
                        {
                          local: "このブラウザ",
                          url: "共有URL",
                          file: "JSONファイル",
                        }[source.origin]
                      }
                    </small>
                    {mismatch && (
                      <small>
                        {compatibilityReason(
                          chosen[0].answer.sheet,
                          source.answer.sheet,
                        )}{" "}
                        選択を解除すると切り替えられます。
                      </small>
                    )}
                  </span>
                </label>
              );
            })}
            {!sources.length && (
              <p className="muted">
                まだ比較できる回答がありません。シートに回答するか、回答結果のURL・JSONを取り込んでください。
              </p>
            )}
          </div>
          <button
            className="wide"
            disabled={!chosen.length || busy}
            onClick={() => setSelected([])}
          >
            選択を解除
          </button>
        </section>
        <section className={styles.panel}>
          <h2>相手の回答を追加</h2>
          {!staticHosting && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void importUrl();
              }}
            >
              <label>
                回答結果の共有URL
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={`${location.origin}/result/pub_…`}
                  required
                  disabled={busy}
                />
              </label>
              <button
                type="submit"
                className="wide"
                disabled={busy || !url.trim()}
              >
                {busy ? "読み込み中…" : "URLから取り込む"}
              </button>
            </form>
          )}
          <div className={styles.upload}>
            <label>
              回答JSONを取り込む
              <input
                className={styles.file}
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={(e) => {
                  void importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className={styles.importNote}>
            {staticHosting
              ? "回答の共有ファイルや、保存した回答JSONを使えます。"
              : "同じサイトの共有URLか、回答JSON・共有ファイルを使えます。"}
            取り込んだ内容はこの画面内だけで使用し、サーバーには送信しません。画面を離れると取り込み内容は消えます。
          </p>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="muted">
              {notice}
            </p>
          )}
        </section>
      </div>
      {chosen.length >= 2 && compatible ? (
        <section>
          <div className={styles.controls}>
            <h2>回答の比較</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={differencesOnly}
                onChange={(e) => setDifferencesOnly(e.target.checked)}
              />
              違いのある項目だけ
            </label>
          </div>
          <ComparisonTable
            key={schema}
            sources={chosen}
            differencesOnly={differencesOnly}
          />
        </section>
      ) : (
        <div className={styles.empty}>
          {!compatible
            ? "質問構成が変わりました。比較する回答を選び直してください。"
            : "回答を2件以上選ぶと、比較表が表示されます。"}
        </div>
      )}
    </>
  );
}
