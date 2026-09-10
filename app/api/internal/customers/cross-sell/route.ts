import { NextRequest, NextResponse } from "next/server";
import { authorizeInternal } from "@/lib/api/internal-auth";

export async function GET(request: NextRequest) {
  if (!authorizeInternal(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Post-Purchase Accessory Follow-Up (21-30 Days) has been decommissioned.
  return NextResponse.json([]);
}
