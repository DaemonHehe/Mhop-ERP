import { NextRequest, NextResponse } from "next/server";
import { authorizeInternal } from "@/lib/api/internal-auth";
import { answerSalesQuestion } from "@/lib/ai/sales-agent";

export async function POST(request: NextRequest) {
  if (!authorizeInternal(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    message?: { text?: string; telegram_user_id?: string };
  } | null;
  const question = body?.message?.text?.trim().slice(0, 1000);
  if (!question)
    return NextResponse.json(
      { error: "A message is required" },
      { status: 400 },
    );
  const result = await answerSalesQuestion({
    question,
    customerId: body?.message?.telegram_user_id || "internal-sales-channel",
  });
  return NextResponse.json(result);
}
