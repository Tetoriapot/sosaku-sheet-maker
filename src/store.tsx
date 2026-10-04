import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { readDb, writeDb, STORAGE_KEY, type Database } from "./utils/storage";
const Context = createContext<{
  db: Database;
  update: (fn: (db: Database) => Database) => boolean;
  notify: (text: string) => void;
} | null>(null);
export function Store({ children }: { children: ReactNode }) {
  const [db, setDb] = useState(readDb);
  const [loadError, setLoadError] = useState(() => {
    try {
      readDb(true);
      return "";
    } catch (e) {
      return (e as Error).message;
    }
  });
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        try {
          const latest = readDb(true);
          setDb(latest);
          setLoadError("");
        } catch (e) {
          setLoadError((e as Error).message);
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
      clearTimeout(timer.current);
    };
  }, []);
  const notify = (text: string) => {
    setToast(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 2400);
  };
  const update = (fn: (db: Database) => Database) => {
    try {
      const next = fn(readDb(true));
      writeDb(next);
      setDb(next);
      setLoadError("");
      notify("保存しました");
      return true;
    } catch {
      notify(
        "保存できませんでした。空き容量やブラウザ設定を確認してください。",
      );
      return false;
    }
  };
  return (
    <Context.Provider value={{ db, update, notify }}>
      {loadError && (
        <div className="local-notice error-text" role="alert">
          {loadError}
        </div>
      )}
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`toast ${toast ? "visible" : ""}`}
      >
        {toast}
      </div>
    </Context.Provider>
  );
}
export function useStore() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Store missing");
  return ctx;
}
