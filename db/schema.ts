import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const students = sqliteTable(
  "students",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("students_created_at_idx").on(table.createdAt)],
);

export const studentSessions = sqliteTable(
  "student_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("student_sessions_student_id_idx").on(table.studentId),
    index("student_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    level: text("level").notNull(),
    mode: text("mode").notNull().default("mixed"),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    leaveCount: integer("leave_count").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("attempts_student_id_idx").on(table.studentId),
    index("attempts_level_idx").on(table.level),
    index("attempts_created_at_idx").on(table.createdAt),
  ],
);

export const attemptAnswers = sqliteTable(
  "attempt_answers",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    questionOrder: integer("question_order").notNull(),
    level: text("level").notNull(),
    word: text("word").notNull(),
    sentence: text("sentence").notNull(),
    reading: text("reading").notNull(),
    acceptedReadingsJson: text("accepted_readings_json").notNull().default("[]"),
    kind: text("kind").notNull(),
    response: text("response").notNull(),
    correct: integer("correct", { mode: "boolean" }).notNull(),
  },
  (table) => [
    index("attempt_answers_attempt_id_idx").on(table.attemptId),
    index("attempt_answers_question_id_idx").on(table.questionId),
    index("attempt_answers_level_idx").on(table.level),
  ],
);

export const questionAnswerOverrides = sqliteTable(
  "question_answer_overrides",
  {
    questionId: text("question_id").primaryKey(),
    answersJson: text("answers_json").notNull(),
    updatedAt: integer("updated_at").notNull(),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [index("question_answer_overrides_updated_at_idx").on(table.updatedAt)],
);
