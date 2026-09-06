import { PageHeading } from "@/components/page-heading";
import { OrderConsole } from "@/components/order-console";
import { getOrdersAction } from "@/app/actions/store";
export const dynamic = "force-dynamic";
export default async function Orders() {
  const orders = await getOrdersAction();
  return (
    <>
      <PageHeading
        eyebrow="Order management"
        title="Orders & fulfillment"
        description="Review payments, assign exact device serials, and move orders safely through dispatch."
      />
      <OrderConsole orders={orders} />
    </>
  );
}
