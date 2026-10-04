import type { Answer, Sheet } from "../types";
import type { ShareKind } from "../../shared/validation";
import { staticHosting } from "../config.ts";
export interface ShareReceipt {
  id: string;
  token: string;
  kind: ShareKind;
  sourceId: string;
  fingerprint: string;
  title: string;
  createdAt: string;
  status: "pending" | "published" | "revoked";
}
export interface PublicShare {
  id: string;
  kind: ShareKind;
  data: Sheet | Answer;
  createdAt: string;
}
export class ShareError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}
async function request(path: string, options: RequestInit = {}) {
  if (staticHosting)
    throw new ShareError(
      "この公開版ではURL共有に対応していません。共有ファイルまたはPNGをお使いください。",
    );
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ShareError(
      "共有サーバーに接続できません。通信を確認して再試行してください。",
    );
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ShareError(
      "共有サーバーから応答がありません。しばらくしてから再試行してください。",
      response.status,
    );
  }
  if (!response.ok)
    throw new ShareError(
      body.error || "共有の操作に失敗しました。",
      response.status,
    );
  return body;
}
export const isPublicId = (id?: string) => id?.startsWith("pub_") ?? false;
export async function readShare(
  id: string,
  signal: AbortSignal,
): Promise<PublicShare> {
  return request(`/api/shares/${encodeURIComponent(id)}`, { signal });
}
export async function publishShare(
  receipt: ShareReceipt,
  data: Sheet | Answer,
) {
  return request(`/api/shares/${receipt.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${receipt.token}`,
    },
    body: JSON.stringify({ kind: receipt.kind, data }),
  });
}
export async function revokeShare(receipt: ShareReceipt) {
  return request(`/api/shares/${receipt.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${receipt.token}` },
  });
}
export function shareUrl(receipt: Pick<ShareReceipt, "id" | "kind">) {
  return `${location.origin}/${receipt.kind === "sheet" ? "s" : "result"}/${receipt.id}`;
}
export async function fingerprint(data: Sheet | Answer) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function newReceipt(
  kind: ShareKind,
  data: Sheet | Answer,
  hash: string,
): ShareReceipt {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return {
    id: `pub_${crypto.randomUUID()}`,
    token,
    kind,
    sourceId: data.id,
    fingerprint: hash,
    title:
      kind === "sheet" ? (data as Sheet).title : (data as Answer).sheet.title,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
}
export async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
