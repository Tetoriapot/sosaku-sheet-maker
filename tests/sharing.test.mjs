import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { once } from "node:events";
import {
  SqliteShareStore,
  SupabaseShareStore,
  createStore,
} from "../server/storage.mjs";
import { buildServer } from "../server/index.mjs";
import { cloneSheet, question } from "../src/utils/model.ts";
import { parseSharePayload, MAX_BODY_BYTES } from "../shared/validation.ts";
const token = "a".repeat(64),
  otherToken = "b".repeat(64);
const publicId = () => `pub_${randomUUID()}`;
function sheet() {
  const s = cloneSheet();
  s.sections[0].questions = [question("公開テスト")];
  return s;
}
function answer() {
  const s = sheet();
  return {
    id: randomUUID(),
    sheetId: s.id,
    respondentName: "回答者",
    answers: { [s.sections[0].questions[0].id]: "0" },
    comments: {},
    createdAt: new Date().toISOString(),
    sheet: s,
  };
}
async function serve(options = {}) {
  const store = options.store ?? new SqliteShareStore(":memory:");
  const server = buildServer({
    store,
    allowedOrigins: ["http://localhost:5173"],
    ...options,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    store,
    server,
    base,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      store.close();
    },
  };
}
const publish = (base, id, data, secret = token) =>
  fetch(`${base}/api/shares/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify(data),
  });
test("independent clients can read immutable shares; management token never leaves API", async () => {
  const app = await serve();
  try {
    const id = publicId();
    const data = { kind: "sheet", data: sheet() };
    let res = await publish(app.base, id, data);
    assert.equal(res.status, 200);
    assert.equal((await publish(app.base, id, data)).status, 200);
    res = await fetch(`${app.base}/api/shares/${id}`);
    const published = await res.json();
    assert.equal(published.data.id, id);
    assert.equal(published.data.sections[0].questions[0].text, "公開テスト");
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.ok(!JSON.stringify(published).includes(token));
    assert.ok(!("token_hash" in published));
    data.data.title = "上書き攻撃";
    assert.equal((await publish(app.base, id, data)).status, 409);
    assert.equal((await publish(app.base, id, data, otherToken)).status, 409);
    assert.equal((await fetch(`${app.base}/api/shares`)).status, 404);
    assert.equal(
      (
        await fetch(`${app.base}/api/shares/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${otherToken}` },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${app.base}/api/shares/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
      200,
    );
    assert.equal((await fetch(`${app.base}/api/shares/${id}`)).status, 404);
    assert.equal((await publish(app.base, id, data)).status, 410);
    assert.equal((await app.store.get(id)).data, null);
  } finally {
    await app.close();
  }
});
test("revoking a pending unknown ID prevents delayed creation", async () => {
  const app = await serve();
  try {
    const id = publicId();
    assert.equal(
      (
        await fetch(`${app.base}/api/shares/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
      200,
    );
    assert.equal(
      (await publish(app.base, id, { kind: "sheet", data: sheet() })).status,
      410,
    );
  } finally {
    await app.close();
  }
});
test("answers retain their own sheet snapshot without exposing drafts or source IDs", async () => {
  const app = await serve();
  try {
    const id = publicId();
    const data = { kind: "answer", data: answer() };
    assert.equal((await publish(app.base, id, data)).status, 200);
    const result = await (await fetch(`${app.base}/api/shares/${id}`)).json();
    assert.equal(result.kind, "answer");
    assert.equal(result.data.id, id);
    assert.equal(result.data.sheetId, id);
    assert.equal(result.data.sheet.id, id);
    assert.equal(result.data.respondentName, "回答者");
    assert.equal(parseSharePayload(result).data.respondentName, "回答者");
  } finally {
    await app.close();
  }
});
test("payloads, origin, size and required answers are checked on the server", async () => {
  const app = await serve();
  try {
    const id = publicId();
    assert.equal(
      (await publish(app.base, id, { kind: "sheet", data: {} })).status,
      400,
    );
    const bad = answer();
    bad.sheet.sections[0].questions[0].required = true;
    bad.answers = {};
    assert.equal(
      (await publish(app.base, id, { kind: "answer", data: bad })).status,
      400,
    );
    const duplicate = sheet();
    duplicate.sections[0].questions.push({
      ...duplicate.sections[0].questions[0],
    });
    assert.equal(
      (await publish(app.base, id, { kind: "sheet", data: duplicate })).status,
      400,
    );
    const unknown = answer();
    unknown.answers.unknown = "秘密";
    assert.equal(
      (await publish(app.base, id, { kind: "answer", data: unknown })).status,
      400,
    );
    assert.equal(
      (
        await fetch(`${app.base}/api/shares/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Origin: "https://unrelated.example",
          },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${app.base}/api/shares/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: "x".repeat(MAX_BODY_BYTES + 1),
        })
      ).status,
      413,
    );
    assert.equal((await fetch(`${app.base}/api/shares/${id}`)).status, 404);
  } finally {
    await app.close();
  }
});
test("rate limits return a retry interval", async () => {
  const app = await serve({ writeLimit: 1 });
  try {
    const body = { kind: "sheet", data: sheet() };
    assert.equal((await publish(app.base, publicId(), body)).status, 200);
    const response = await publish(app.base, publicId(), body);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "60");
  } finally {
    await app.close();
  }
});
test("SQLite shares survive closing and reopening the database", async () => {
  mkdirSync("test-results", { recursive: true });
  const dir = mkdtempSync(resolve("test-results", "sqlite-"));
  const path = resolve(dir, "shares.sqlite");
  let app = await serve({ store: new SqliteShareStore(path) });
  const id = publicId();
  await publish(app.base, id, { kind: "sheet", data: sheet() });
  await app.close();
  app = await serve({ store: new SqliteShareStore(path) });
  try {
    assert.equal((await fetch(`${app.base}/api/shares/${id}`)).status, 200);
  } finally {
    await app.close();
  }
});
test("Supabase adapter sends only server credentials and handles insert conflicts", async () => {
  const calls = [];
  const responses = [[], [{ id: "test" }], [], null];
  const mock = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      responses.length ? JSON.stringify(responses.shift()) : "null",
      { status: 200 },
    );
  };
  const store = new SupabaseShareStore(
    "https://project.supabase.co",
    "sb_secret_test",
    mock,
  );
  assert.equal(await store.get(publicId()), null);
  assert.equal(await store.create({ id: publicId() }), true);
  assert.equal(await store.create({ id: publicId() }), false);
  await store.revoke(publicId(), "hash");
  assert.equal(calls[0].options.headers.apikey, "sb_secret_test");
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.match(calls[0].url, /limit=1/);
  assert.match(calls[3].url, /token_hash=eq.hash/);
  assert.match(calls[1].options.headers.Prefer, /ignore-duplicates/);
});
test("invalid Supabase configuration fails instead of silently using local storage", () => {
  assert.throws(
    () => createStore({ SHARE_STORAGE: "supabase" }),
    /SUPABASE_URL/,
  );
  assert.throws(() => createStore({ SHARE_STORAGE: "unknown" }));
});
