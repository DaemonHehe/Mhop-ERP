import { NextRequest, NextResponse } from "next/server";
import { authorizeInternal } from "@/lib/api/internal-auth";
import { sendRecoveryReminder } from "@/lib/services/lead-recovery.service";
import { z } from "zod";
const schema = z.object({ id: z.string().regex(/^(order|session):[0-9a-f-]{36}$/i), activityAt: z.iso.datetime() });
export async function POST(request: NextRequest) {
  if (!authorizeInternal(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reminder request" }, { status: 400 });
  const result = await sendRecoveryReminder(parsed.data.id, parsed.data.activityAt);
  return NextResponse.json(result, { status: result.ok || "skipped" in result ? 200 : 502 });
}
