import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { studentSessions, students } from "@/db/schema";
import { ensureDatabase } from "@/db/ensure";
export { normalizeStudentName, validPassword, validStudentName } from "./auth-validation.mjs";
export { makePassword, passwordMatches } from "./password-core.mjs";

const COOKIE_NAME = "yomitoku_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export type SessionStudent = {
  id: string;
  name: string;
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(byteLength: number) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function readCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === COOKIE_NAME) return decodeURIComponent(rawValue.join("="));
  }
  return null;
}

export async function createSession(studentId: string) {
  await ensureDatabase();
  const token = randomHex(32);
  const now = Date.now();
  await getDb().insert(studentSessions).values({
    tokenHash: await sha256(token),
    studentId,
    createdAt: now,
    expiresAt: now + SESSION_SECONDS * 1000,
  });
  return token;
}

export async function deleteSession(request: Request) {
  await ensureDatabase();
  const token = readCookie(request);
  if (!token) return;
  await getDb().delete(studentSessions).where(eq(studentSessions.tokenHash, await sha256(token)));
}

export async function getSessionStudent(request: Request): Promise<SessionStudent | null> {
  await ensureDatabase();
  const token = readCookie(request);
  if (!token) return null;
  const rows = await getDb()
    .select({ id: students.id, name: students.name })
    .from(studentSessions)
    .innerJoin(students, eq(studentSessions.studentId, students.id))
    .where(
      and(
        eq(studentSessions.tokenHash, await sha256(token)),
        gt(studentSessions.expiresAt, Date.now()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function expiredSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
}
