import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

export class SqliteShareStore {
  constructor(path = ".data/shares.sqlite") {
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS shares (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('sheet','answer')),
        data TEXT, token_hash TEXT NOT NULL, content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL, revoked_at TEXT
      );`);
  }
  async get(id) {
    const row = this.db.prepare("SELECT * FROM shares WHERE id=?").get(id);
    return row
      ? { ...row, data: row.data ? JSON.parse(row.data) : null }
      : null;
  }
  async create(row) {
    const result = this.db
      .prepare(
        "INSERT OR IGNORE INTO shares (id,kind,data,token_hash,content_hash,created_at,revoked_at) VALUES (?,?,?,?,?,?,?)",
      )
      .run(
        row.id,
        row.kind,
        row.data === null ? null : JSON.stringify(row.data),
        row.token_hash,
        row.content_hash,
        row.created_at,
        row.revoked_at ?? null,
      );
    return result.changes > 0;
  }
  async revoke(id, tokenHash) {
    this.db
      .prepare(
        "UPDATE shares SET data=NULL, revoked_at=COALESCE(revoked_at,?) WHERE id=? AND token_hash=?",
      )
      .run(new Date().toISOString(), id, tokenHash);
  }
  close() {
    this.db.close();
  }
}

// Only the Node server holds this key. The browser never talks to Supabase directly.
export class SupabaseShareStore {
  constructor(url, key, fetchImpl = fetch) {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(parsed.hostname)
    )
      throw new Error("SUPABASE_URL must use HTTPS.");
    this.base = `${parsed.origin}/rest/v1/creative_shares`;
    this.key = key;
    this.fetch = fetchImpl;
  }
  async request(query, options = {}) {
    const headers = {
      apikey: this.key,
      "Content-Type": "application/json",
      ...options.headers,
    };
    // Legacy service_role JWTs require Authorization. New sb_secret_* keys use apikey.
    if (!this.key.startsWith("sb_secret_"))
      headers.Authorization = `Bearer ${this.key}`;
    const response = await this.fetch(`${this.base}${query}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const error = new Error("共有データベースに接続できません。");
      error.status = response.status;
      throw error;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  async get(id) {
    const rows = await this.request(
      `?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    );
    return rows[0] ?? null;
  }
  async create(row) {
    const rows = await this.request("?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(row),
    });
    return rows.length > 0;
  }
  async revoke(id, tokenHash) {
    await this.request(
      `?id=eq.${encodeURIComponent(id)}&token_hash=eq.${tokenHash}&revoked_at=is.null`,
      {
        method: "PATCH",
        body: JSON.stringify({
          data: null,
          revoked_at: new Date().toISOString(),
        }),
      },
    );
  }
  close() {}
}
export function createStore(env = process.env) {
  const mode = env.SHARE_STORAGE || "sqlite";
  if (mode === "sqlite")
    return new SqliteShareStore(env.SQLITE_PATH || ".data/shares.sqlite");
  if (mode === "supabase") {
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY)
      throw new Error(
        "Supabase接続にはSUPABASE_URLとSUPABASE_SECRET_KEYが必要です。",
      );
    return new SupabaseShareStore(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
  }
  throw new Error("SHARE_STORAGEはsqliteまたはsupabaseを指定してください。");
}
