import { NextRequest, NextResponse } from "next/server";
import { getRecoveryLeads, isAutomationRecoveryLead } from "@/lib/services/lead-recovery.service";
import { authorizeInternal } from "@/lib/api/internal-auth";
export async function GET(request: NextRequest) {
  if (!authorizeInternal(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = (await getRecoveryLeads()).filter((lead) => isAutomationRecoveryLead(lead))
    .map(({ id, stage, telegramUserId, activityAt }) => ({ id, stage, telegramUserId, activityAt }));
  return NextResponse.json(rows);
}
