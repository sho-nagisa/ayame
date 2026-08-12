import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { studentSessions, students } from "@/db/schema";
import { ensureDatabase } from "@/db/ensure";

const COOKIE_NAME = "yomitoku_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 100_000;

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

async function derivePassword(password: string, saltHex: string) {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function makePassword(password: string) {
  const salt = randomHex(16);
  return { salt, hash: await derivePassword(password, salt) };
}

export async function passwordMatches(password: string, salt: string, expectedHash: string) {
  return (await derivePassword(password, salt)) === expectedHash;
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

export function normalizeStudentName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function validStudentName(name: string) {
  return name.length >= 2 && name.length <= 20 && /^[\p{L}\p{N} ._-]+$/u.test(name);
}

export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 6 && value.length <= 72;
}
