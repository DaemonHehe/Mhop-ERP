import { notFound } from "next/navigation";
import { getOrderByIdAction, getInventoryAction } from "@/app/actions/store";
import { OrderDetailView } from "@/components/order-detail-view";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, inventory] = await Promise.all([
    getOrderByIdAction(id),
    getInventoryAction(),
  ]);

  if (!order) {
    notFound();
  }

  return <OrderDetailView order={order} inventory={inventory} />;
}
