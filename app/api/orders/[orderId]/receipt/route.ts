import { NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/lib/auth/authorize";
import { getReceiptOrders } from "@/lib/services/order.service";
import { renderCustomerReceiptImage } from "@/lib/services/receipt-image";
import type { ReceiptSummaryInput } from "@/lib/services/receipt-summary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await authorizeStaff(["admin", "staff"]);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized. Staff login is required to download receipts." },
      { status: 401 },
    );
  }

  const { orderId } = await params;
  const orders = await getReceiptOrders();
  const order = orders.find((o) => o.id === orderId || o.code === orderId);

  if (!order) {
    return NextResponse.json(
      { error: "Order was not found" },
      { status: 404 },
    );
  }

  try {
    const receiptData: ReceiptSummaryInput = {
      orderCode: order.code,
      customerName: order.customer,
      phone: order.phone,
      shippingAddress: order.address,
      shippingFee: order.shippingFee,
      totalAmount: order.total,
      paymentMethod: order.paymentMethod,
      items: order.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        sku: it.sku,
      })),
      bundles: order.bundles.map((b) => ({
        name: b,
        price: 0,
      })),
    };

    const pngBuffer = await renderCustomerReceiptImage(receiptData);

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${order.code}-receipt.png"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[Receipt Download API error]", err);
    return NextResponse.json(
      { error: "Failed to generate receipt image" },
      { status: 500 },
    );
  }
}
