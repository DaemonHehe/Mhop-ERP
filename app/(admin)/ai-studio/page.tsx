import { PageHeading } from "@/components/page-heading";
import { AiCreativeStudio } from "@/components/ai-creative-studio";
import { getInventoryAction } from "@/app/actions/store";
export const dynamic = "force-dynamic";
export default async function AiStudioPage() {
  const products = (await getInventoryAction()).filter(
    (product) => product.category === "Gaming Gadgets",
  );
  return (
    <>
      <PageHeading
        eyebrow="No-API creative workflow"
        title="AI Creative Studio"
        description="Turn physical gaming gadgets from Products & Stock into accurate, commercial-grade image prompts. PUBG accounts are intentionally excluded from image generation."
      />
      <AiCreativeStudio products={products} />
    </>
  );
}
