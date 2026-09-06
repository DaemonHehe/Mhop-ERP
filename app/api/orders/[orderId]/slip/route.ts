import { NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/lib/auth/authorize";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTelegramFileDownloadUrl } from "@/lib/telegram/bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await authorizeStaff(["admin", "staff"]);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized. Staff login is required to view payment slips." },
      { status: 401 }
    );
  }

  const { orderId } = await params;
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const [order] = await db
      .select({
        id: orders.id,
        orderCode: orders.orderCode,
        paymentSlipUrl: orders.paymentSlipUrl,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || !order.paymentSlipUrl) {
      return NextResponse.json(
        { error: "Payment slip not found for this order" },
        { status: 404 }
      );
    }

    // 1. Telegram File Proxy
    if (order.paymentSlipUrl.startsWith("telegram-file:")) {
      const fileId = order.paymentSlipUrl.replace("telegram-file:", "").trim();
      const downloadUrl = await getTelegramFileDownloadUrl(fileId);

      if (!downloadUrl) {
        return NextResponse.json(
          { error: "Could not resolve Telegram image file path" },
          { status: 502 }
        );
      }

      const fileRes = await fetch(downloadUrl, {
        signal: AbortSignal.timeout(20_000),
      });

      if (!fileRes.ok) {
        return NextResponse.json(
          { error: `Telegram returned ${fileRes.status} when downloading slip` },
          { status: 502 }
        );
      }

      const contentType = fileRes.headers.get("content-type") || "image/jpeg";
      const arrayBuffer = await fileRes.arrayBuffer();

      return new NextResponse(arrayBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${order.orderCode}-slip.jpg"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // 2. Direct HTTPS URL
    if (/^https?:\/\//i.test(order.paymentSlipUrl)) {
      return NextResponse.redirect(order.paymentSlipUrl);
    }

    return NextResponse.json(
      { error: "Unsupported payment slip format" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Order Slip Proxy Error]", error);
    return NextResponse.json(
      { error: "Failed to load payment slip" },
      { status: 500 }
    );
  }
}
