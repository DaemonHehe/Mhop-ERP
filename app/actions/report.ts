"use server";

import { authorizeStaff } from "@/lib/auth/authorize";
import * as reportService from "@/lib/services/report.service";

export type {
  MonthlyReportData,
  MonthlyReportSummary,
  CategorySummary,
  PaymentSummary,
  ChannelSummary,
  TopProductSummary,
  ItemizedOrderRow,
  ItemizedExpenseRow,
} from "@/lib/services/report.service";

export async function getMonthlyReportAction(year: number, month: number) {
  const session = await authorizeStaff(["admin", "staff"]);
  if (!session) {
    return { ok: false as const, error: "Unauthorized" };
  }

  try {
    const data = await reportService.generateMonthlyReportData(year, month);
    return { ok: true as const, data };
  } catch (error) {
    console.error("[MH OP Monthly Report Action]", error);
    return {
      ok: false as const,
      error: "Failed to generate monthly report. Try again.",
    };
  }
}
