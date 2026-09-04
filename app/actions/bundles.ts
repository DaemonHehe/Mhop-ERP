"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { authorizeStaff, requireStaff } from "@/lib/auth/authorize";
import * as service from "@/lib/services/bundle.service";
export type {
  BundleInput,
  BundleItem,
  BundleSet,
} from "@/lib/services/bundle.service";
export async function getBundlesAction() {
  await requireStaff(["admin", "staff"]);
  return service.getBundles();
}
const refresh = () => {
  revalidateTag("public-commerce");
  revalidatePath("/bundles");
  revalidatePath("/shop");
  revalidatePath("/shop/checkout");
  revalidatePath("/dashboard");
};
export async function createBundleAction(input: service.BundleInput) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await service.createBundle(input);
  if (result.ok) refresh();
  return result;
}
export async function updateBundleAction(
  id: string,
  input: service.BundleInput,
) {
  if (!(await authorizeStaff(["admin", "staff"])))
    return { ok: false as const, error: "Unauthorized" };
  const result = await service.updateBundle(id, input);
  if (result.ok) refresh();
  return result;
}
export async function deleteBundleAction(id: string) {
  if (!(await authorizeStaff(["admin"])))
    return { ok: false as const, error: "Administrator access is required." };
  const result = await service.deleteBundle(id);
  if (result.ok) refresh();
  return result;
}
