import { NextRequest, NextResponse } from "next/server";
import { getLeads } from "@/lib/services/ticket.service";
import { authorizeInternal } from "@/lib/api/internal-auth";
export async function GET(request: NextRequest) {
  if (!authorizeInternal(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = Date.now();
  const rows = (await getLeads())
    .filter(
      (l) =>
        ["new", "contacted", "reserved"].includes(l.stage) &&
        (!l.reserveExpiresAt || l.reserveExpiresAt.getTime() > now),
    )
    .map((l) => ({
      ...l,
      checkout_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/shop`,
    }));
  return NextResponse.json(rows);
}
