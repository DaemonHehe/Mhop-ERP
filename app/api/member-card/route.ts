import { NextRequest, NextResponse } from "next/server";
import { renderMemberCardImage } from "@/lib/services/member-card-image";
import { lookupCustomerLoyalty } from "@/lib/services/customer.service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const telegramUserId = searchParams.get("telegramUserId") || searchParams.get("userId");
  const phone = searchParams.get("phone");
  const customerCode = searchParams.get("code") || searchParams.get("customerCode");
  const demoTier = searchParams.get("tier") || searchParams.get("demoTier");
  const demoName = searchParams.get("name");
  const demoPoints = searchParams.get("points");

  let customerName = demoName || "MH OP VIP MEMBER";
  let tier = demoTier || "classic";
  let points = demoPoints ? parseInt(demoPoints, 10) : 0;
  let memberId = customerCode || (telegramUserId ? `TG-${telegramUserId}` : phone || "MH-VIP-0001");

  if (telegramUserId || phone || customerCode) {
    const loyalty = await lookupCustomerLoyalty({ telegramUserId, phone, customerCode });
    if (loyalty.found) {
      customerName = loyalty.name || customerName;
      tier = loyalty.tier;
      points = loyalty.points;
      memberId = loyalty.customerCode || loyalty.id || loyalty.phone || memberId;
    }
  }

  try {
    const buffer = await renderMemberCardImage({
      customerName,
      memberId,
      phone,
      tier,
      points,
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="mhop-member-card-${tier}.png"`,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("[member-card-route error]", err);
    return NextResponse.json(
      { error: "Failed to generate member card image" },
      { status: 500 },
    );
  }
}
