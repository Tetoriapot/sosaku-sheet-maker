import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { Answer, Sheet } from "../types";
import { isPublicId, readShare, ShareError } from "../utils/sharing";
import {
  parseAnswer,
  parseSheet,
  type ShareKind,
} from "../../shared/validation";
export function useSharedResource<K extends ShareKind>(kind: K, id?: string) {
  type Data = K extends "sheet" ? Sheet : Answer;
  const { db } = useStore();
  const remote = isPublicId(id);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    id?: string;
    data?: Data;
    error?: string;
    missing?: boolean;
  }>({});
  useEffect(() => {
    if (!remote || !id) return;
    const controller = new AbortController();
    setState({ id });
    readShare(id, controller.signal)
      .then((share) => {
        if (controller.signal.aborted) return;
        if (share.kind !== kind) {
          setState({ id, missing: true });
          return;
        }
        const data = (
          kind === "sheet" ? parseSheet(share.data) : parseAnswer(share.data)
        ) as Data;
        setState({ id, data });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState(
          error instanceof ShareError && error.status === 404
            ? { id, missing: true }
            : {
                id,
                error:
                  error instanceof ShareError
                    ? error.message
                    : "共有データを読み取れませんでした。",
              },
        );
      });
    return () => controller.abort();
  }, [id, kind, remote, retry]);
  const current = state.id === id ? state : {};
  const data = remote
    ? current.data
    : ((kind === "sheet" ? db.sheets : db.answers).find(
        (value) => value.id === id,
      ) as Data | undefined);
  return {
    data,
    remote,
    loading: remote && !current.data && !current.error && !current.missing,
    error: current.error,
    missing: remote ? current.missing : !data,
    retry: () => setRetry((n) => n + 1),
  };
}
