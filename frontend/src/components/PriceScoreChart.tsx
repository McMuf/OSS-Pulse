"use client";

import {
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = {
  date: string;
  score: number | null;
  price: number | null;
};

export function PriceScoreChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e2e5ea" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#64707d", fontSize: 11 }}
          axisLine={{ stroke: "#e2e5ea" }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          yAxisId="score"
          domain={[0, 100]}
          tick={{ fill: "#64707d", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <YAxis
          yAxisId="price"
          orientation="right"
          tick={{ fill: "#64707d", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => `$${v}`}
        />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e2e5ea",
            borderRadius: 2,
            fontSize: 12,
          }}
          labelStyle={{ color: "#14171c" }}
        />
        <Line
          yAxisId="score"
          type="monotone"
          dataKey="score"
          name="Commit-velocity score"
          stroke="#0f9d63"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="price"
          name="Stock price"
          stroke="#64707d"
          strokeWidth={1.5}
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
