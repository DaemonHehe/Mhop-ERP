"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { RevenuePoint } from "@/app/actions/store";
const compact = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M MMK`
    : `${new Intl.NumberFormat("en-US").format(value)} MMK`;
export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 5, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6b35" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#ff6b35" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#888" }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #ddd",
              fontSize: 12,
            }}
            formatter={(value) => [compact(Number(value)), "Revenue"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""}
          />
          <Area
            dataKey="value"
            type="monotone"
            stroke="#ff6b35"
            strokeWidth={3}
            fill="url(#fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
