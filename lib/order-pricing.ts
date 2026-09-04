export interface PricingLine {
  key: string;
  retailPrice: number;
  quantity: number;
}
export interface AllocatedUnit {
  key: string;
  unitPrice: number;
}

export function allocateDiscountedUnits(
  lines: PricingLine[],
  targetTotal: number,
): AllocatedUnit[] {
  const expanded = lines.flatMap((line) =>
    Array.from({ length: line.quantity }, () => ({
      key: line.key,
      retailCents: Math.round(line.retailPrice * 100),
    })),
  );
  const retailCents = expanded.reduce((sum, item) => sum + item.retailCents, 0),
    targetCents = Math.round(targetTotal * 100);
  if (!expanded.length || retailCents <= 0 || targetCents <= 0)
    throw new Error("Order pricing could not be allocated");
  let remaining = targetCents;
  return expanded.map((item, index) => {
    const cents =
      index === expanded.length - 1
        ? remaining
        : Math.min(
            remaining,
            Math.round((targetCents * item.retailCents) / retailCents),
          );
    remaining -= cents;
    return { key: item.key, unitPrice: cents / 100 };
  });
}
