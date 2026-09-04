"use client";

import dynamic from "next/dynamic";
import type { RevenuePoint } from "@/app/actions/store";

const RevenueChart = dynamic(
  () => import("./revenue-chart").then((module) => module.RevenueChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-52 w-full animate-pulse rounded-2xl bg-[#efede6]"
        aria-label="Loading revenue chart"
      />
    ),
  },
);

export function RevenueChartLazy({ data }: { data: RevenuePoint[] }) {
  return <RevenueChart data={data} />;
}
