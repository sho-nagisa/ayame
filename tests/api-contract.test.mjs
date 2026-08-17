import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("新規登録APIは入力検証・重複検知・セッション発行を行う", async () => {
  const route = await source("app/api/auth/register/route.ts");
  assert.match(route, /normalizeStudentName/);
  assert.match(route, /validStudentName/);
  assert.match(route, /validPassword/);
  assert.match(route, /status: 400/);
  assert.match(route, /status: 409/);
  assert.match(route, /createSession/);
  assert.match(route, /set-cookie/);
});

test("ログインAPIは正しいパスワードだけにセッションを発行する", async () => {
  const route = await source("app/api/auth/login/route.ts");
  assert.match(route, /passwordMatches/);
  assert.match(route, /status: 401/);
  assert.match(route, /createSession/);
  assert.match(route, /set-cookie/);
  assert.match(route, /ensureDatabase/);
});

test("認証APIはセッションCookieを安全な属性で発行する", async () => {
  const auth = await source("lib/student-auth.ts");
  assert.match(auth, /HttpOnly/);
  assert.match(auth, /SameSite=Lax/);
  assert.match(auth, /Max-Age=/);
  assert.match(auth, /Secure/);
});

test("受験保存APIは級・モード・問題数・離脱数を検証する", async () => {
  const route = await source("app/api/attempts/route.ts");
  assert.match(route, /LEVELS\.some/);
  assert.match(route, /\["on", "kun", "mixed"\]/);
  assert.match(route, /leaveCount < 0/);
  assert.match(route, /leaveCount > 100/);
  assert.match(route, /submitted\.length < 1/);
  assert.match(route, /submitted\.length > 30/);
  assert.match(route, /seenIds\.has/);
  assert.match(route, /question\.level !== level/);
});

test("受験保存APIはD1の上限を避け、失敗時に途中記録を削除する", async () => {
  const route = await source("app/api/attempts/route.ts");
  assert.match(route, /const answerChunkSize = 4/);
  assert.match(route, /db\.delete\(attempts\)/);
  assert.match(route, /attempt_save_failed/);
  assert.match(route, /status: 500/);
});

test("成績APIは未ログインを拒否し、全体と級別の集計を返す", async () => {
  const route = await source("app/api/progress/route.ts");
  assert.match(route, /getSessionStudent/);
  assert.match(route, /status: 401/);
  assert.match(route, /statsFor/);
  assert.match(route, /byLevel/);
  assert.match(route, /weakQuestions/);
  assert.match(route, /attempts:/);
});

test("管理APIは管理者だけが正解候補を更新できる", async () => {
  const route = await source("app/api/admin/questions/[id]/route.ts");
  assert.match(route, /getAdminUser/);
  assert.match(route, /validateAcceptedReadings/);
  assert.match(route, /questionAnswerOverrides/);
});
