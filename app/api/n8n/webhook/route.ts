import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
const supported = new Set([
  "order.created",
  "inventory.low_stock",
  "ticket.created",
  "payment.slip_uploaded",
  "briefing.requested",
  "digest.requested",
]);
function validSignature(raw: string, provided: string | null) {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret || !provided) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected),
    b = Buffer.from(provided.replace(/^sha256=/, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-gadgetos-signature")))
    return NextResponse.json(
      { ok: false, error: "Invalid webhook signature" },
      { status: 401 },
    );
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("event" in body) ||
    typeof body.event !== "string" ||
    !supported.has(body.event)
  )
    return NextResponse.json(
      { ok: false, error: "Unsupported event" },
      { status: 422 },
    );
  return NextResponse.json({
    ok: true,
    event: body.event,
    receivedAt: new Date().toISOString(),
  });
}
export async function GET() {
  return NextResponse.json({
    service: "gadgetos-n8n-webhook",
    status: "healthy",
    events: [...supported],
  });
}
