import { env } from "cloudflare:workers";

let initialization: Promise<unknown> | null = null;

export function ensureDatabase() {
  if (initialization) return initialization;
  const d1 = env.DB;
  initialization = d1.batch([
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS student_sessions (
        token_hash TEXT PRIMARY KEY NOT NULL,
        student_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY NOT NULL,
        student_id TEXT NOT NULL,
        level TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'mixed',
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        leave_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS attempt_answers (
        id TEXT PRIMARY KEY NOT NULL,
        attempt_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        question_order INTEGER NOT NULL,
        level TEXT NOT NULL,
        word TEXT NOT NULL,
        sentence TEXT NOT NULL,
        reading TEXT NOT NULL,
        accepted_readings_json TEXT NOT NULL DEFAULT '[]',
        kind TEXT NOT NULL,
        response TEXT NOT NULL,
        correct INTEGER NOT NULL,
        FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS question_answer_overrides (
        question_id TEXT PRIMARY KEY NOT NULL,
        answers_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        updated_by TEXT NOT NULL
      )
    `),
    d1.prepare("CREATE INDEX IF NOT EXISTS students_created_at_idx ON students(created_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS student_sessions_student_id_idx ON student_sessions(student_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS student_sessions_expires_at_idx ON student_sessions(expires_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS attempts_student_id_idx ON attempts(student_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS attempts_level_idx ON attempts(level)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS attempts_created_at_idx ON attempts(created_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS attempt_answers_attempt_id_idx ON attempt_answers(attempt_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS attempt_answers_question_id_idx ON attempt_answers(question_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS attempt_answers_level_idx ON attempt_answers(level)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS question_answer_overrides_updated_at_idx ON question_answer_overrides(updated_at)"),
  ]).catch((error: unknown) => {
    initialization = null;
    throw error;
  });
  return initialization;
}
