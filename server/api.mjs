import { createHash, timingSafeEqual } from "node:crypto";
import {
  MAX_BODY_BYTES,
  PUBLIC_ID,
  TOKEN,
  parseSharePayload,
  ValidationError,
} from "../shared/validation.ts";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const equal = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
  });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(415, "JSON形式で送信してください。");
  if (Number(req.headers["content-length"]) > MAX_BODY_BYTES)
    throw new HttpError(
      413,
      "共有データが大きすぎます。質問や回答を短くしてください。",
    );
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES)
      throw new HttpError(
        413,
        "共有データが大きすぎます。質問や回答を短くしてください。",
      );
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "データを読み取れませんでした。");
  }
}
export function createApi({
  store,
  allowedOrigins = [],
  writeLimit = 30,
  readLimit = 300,
  clock = Date.now,
}) {
  const buckets = new Map();
  function rateLimit(req, write) {
    const now = clock();
    for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    const key = `${req.socket.remoteAddress}:${write ? "write" : "read"}`;
    if (buckets.size >= 10000 && !buckets.has(key))
      throw new HttpError(429, "混み合っています。少し待ってお試しください。");
    const bucket = buckets.get(key) ?? { count: 0, reset: now + 60000 };
    bucket.count++;
    buckets.set(key, bucket);
    if (bucket.count > (write ? writeLimit : readLimit))
      throw new HttpError(
        429,
        "操作が多すぎます。1分ほど待ってお試しください。",
      );
  }
  return async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/api/health" && req.method === "GET") {
        json(res, 200, { ok: true });
        return;
      }
      const match = /^\/api\/shares\/([^/]+)$/.exec(url.pathname);
      if (!match || !PUBLIC_ID.test(match[1]))
        throw new HttpError(404, "共有データが見つかりませんでした。");
      const id = match[1];
      const write = ["PUT", "DELETE"].includes(req.method);
      rateLimit(req, write);
      if (
        write &&
        req.headers.origin &&
        !allowedOrigins.includes(req.headers.origin)
      )
        throw new HttpError(403, "このアクセス元からは共有を変更できません。");
      if (req.method === "GET") {
        const row = await store.get(id);
        if (!row || row.revoked_at || !row.data)
          throw new HttpError(
            404,
            "共有が停止されたか、URLが間違っている可能性があります。",
          );
        json(res, 200, {
          id,
          kind: row.kind,
          data: row.data,
          createdAt: row.created_at,
        });
        return;
      }
      if (!write) throw new HttpError(405, "この操作には対応していません。");
      const token = req.headers.authorization?.replace(/^Bearer /, "");
      if (!token || !TOKEN.test(token))
        throw new HttpError(
          401,
          "共有を管理する情報がありません。作成したブラウザから操作してください。",
        );
      const tokenHash = hash(token);
      if (req.method === "DELETE") {
        const row = await store.get(id);
        if (row && !equal(row.token_hash, tokenHash))
          throw new HttpError(403, "この共有を停止する権限がありません。");
        // Keep a tombstone, including for an unknown ID, so an in-flight PUT cannot restore it.
        if (!row)
          await store.create({
            id,
            kind: "sheet",
            data: null,
            token_hash: tokenHash,
            content_hash: "",
            created_at: new Date().toISOString(),
            revoked_at: new Date().toISOString(),
          });
        const current = await store.get(id);
        if (!equal(current.token_hash, tokenHash))
          throw new HttpError(403, "この共有を停止する権限がありません。");
        await store.revoke(id, tokenHash);
        json(res, 200, { revoked: true });
        return;
      }
      const payload = parseSharePayload(await readBody(req));
      // The public snapshot gets its own identity, separate from the local editable original.
      payload.data.id = id;
      if (payload.kind === "answer") {
        payload.data.sheet.id = id;
        payload.data.sheetId = id;
      }
      const contentHash = hash(JSON.stringify(payload));
      await store.create({
        id,
        kind: payload.kind,
        data: payload.data,
        token_hash: tokenHash,
        content_hash: contentHash,
        created_at: new Date().toISOString(),
      });
      const row = await store.get(id);
      if (!equal(row.token_hash, tokenHash))
        throw new HttpError(409, "この共有IDは使用できません。");
      if (row.revoked_at)
        throw new HttpError(
          410,
          "このURLの共有は停止されています。新しい共有を作成してください。",
        );
      if (row.content_hash !== contentHash)
        throw new HttpError(
          409,
          "共有済みの内容は変更できません。新しいURLを作成してください。",
        );
      json(res, 200, { id, kind: row.kind, createdAt: row.created_at });
    } catch (error) {
      const status =
        error instanceof ValidationError
          ? 400
          : error instanceof HttpError
            ? error.status
            : 503;
      if (status === 429) res.setHeader("Retry-After", "60");
      json(res, status, {
        error:
          status === 503
            ? "共有サーバーに接続できません。しばらくしてから再試行してください。"
            : error.message,
      });
    }
  };
}
