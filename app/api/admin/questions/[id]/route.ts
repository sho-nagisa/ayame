import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureDatabase } from "@/db/ensure";
import { questionAnswerOverrides } from "@/db/schema";
import { getAdminUser } from "@/lib/admin-auth";
import {
  defaultAcceptedReadings,
  validateAcceptedReadings,
} from "@/lib/question-answers";
import { QUESTIONS } from "@/lib/questions";

function sameReadings(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((reading, index) => reading === right[index])
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return Response.json({ error: "管理者権限が必要です。" }, { status: 403 });
  }
  const { id } = await params;
  const question = QUESTIONS.find((item) => item.id === id);
  if (!question) {
    return Response.json({ error: "問題が見つかりません。" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as {
    readings?: unknown;
  } | null;
  const readings = validateAcceptedReadings(body?.readings);
  if (!readings) {
    return Response.json(
      { error: "ひらがなの正解候補を1～20個入力してください。" },
      { status: 400 },
    );
  }

  await ensureDatabase();
  const db = getDb();
  const defaults = defaultAcceptedReadings(question);
  if (sameReadings(readings, defaults)) {
    await db
      .delete(questionAnswerOverrides)
      .where(eq(questionAnswerOverrides.questionId, id));
    return Response.json({ acceptedReadings: defaults, customized: false });
  }

  await db
    .insert(questionAnswerOverrides)
    .values({
      questionId: id,
      answersJson: JSON.stringify(readings),
      updatedAt: Date.now(),
      updatedBy: admin.email,
    })
    .onConflictDoUpdate({
      target: questionAnswerOverrides.questionId,
      set: {
        answersJson: JSON.stringify(readings),
        updatedAt: Date.now(),
        updatedBy: admin.email,
      },
    });
  return Response.json({ acceptedReadings: readings, customized: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return Response.json({ error: "管理者権限が必要です。" }, { status: 403 });
  }
  const { id } = await params;
  const question = QUESTIONS.find((item) => item.id === id);
  if (!question) {
    return Response.json({ error: "問題が見つかりません。" }, { status: 404 });
  }
  await ensureDatabase();
  await getDb()
    .delete(questionAnswerOverrides)
    .where(eq(questionAnswerOverrides.questionId, id));
  return Response.json({
    acceptedReadings: defaultAcceptedReadings(question),
    customized: false,
  });
}
