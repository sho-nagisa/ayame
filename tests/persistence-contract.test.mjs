import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("成績DBはユーザー・級・モード・得点・日時を保存する", async () => {
  const schema = await source("db/schema.ts");
  for (const field of ["studentId", "level", "mode", "score", "total", "leaveCount", "createdAt"]) {
    assert.match(schema, new RegExp(`${field}:`));
  }
  assert.match(schema, /attempts_level_idx/);
});

test("回答DBは問題・正解候補・回答内容・正誤を保存する", async () => {
  const schema = await source("db/schema.ts");
  for (const field of ["attemptId", "questionId", "questionOrder", "word", "sentence", "reading", "acceptedReadingsJson", "response", "correct"]) {
    assert.match(schema, new RegExp(`${field}:`));
  }
  assert.match(schema, /attempt_answers_attempt_id_idx/);
  assert.match(schema, /attempt_answers_level_idx/);
});

test("保存時に受験と回答の紐付けを維持し、回答失敗時は受験を削除する", async () => {
  const route = await source("app/api/attempts/route.ts");
  assert.match(route, /attemptId/);
  assert.match(route, /attemptId \}\)\)/);
  assert.match(route, /db\.delete\(attempts\)\.where/);
});
