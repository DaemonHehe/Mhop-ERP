import { NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/lib/auth/authorize";
import {
  generateMonthlyReportCsv,
  generateMonthlyReportData,
} from "@/lib/services/report.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Enforce staff/admin authentication
  const session = await authorizeStaff(["admin", "staff"]);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized. Staff authentication is required." },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const now = new Date();
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1), 10);

  try {
    const data = await generateMonthlyReportData(year, month);
    const format = searchParams.get("format");

    if (format === "json") {
      return NextResponse.json({ ok: true, data });
    }

    const csv = generateMonthlyReportCsv(data);
    const monthFormatted = String(data.summary.month).padStart(2, "0");
    const filename = `mhop-monthly-report-${data.summary.year}-${monthFormatted}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[MH OP Monthly Report Export]", error);
    return NextResponse.json(
      { ok: false, error: "Failed to generate monthly report." },
      { status: 500 }
    );
  }
}
