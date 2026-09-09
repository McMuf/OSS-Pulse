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
        <CartesianGrid stroke="#23262c" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#8b8f98", fontSize: 11 }}
          axisLine={{ stroke: "#23262c" }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          yAxisId="score"
          domain={[0, 100]}
          tick={{ fill: "#8b8f98", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <YAxis
          yAxisId="price"
          orientation="right"
          tick={{ fill: "#8b8f98", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => `$${v}`}
        />
        <Tooltip
          contentStyle={{
            background: "#131519",
            border: "1px solid #23262c",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#e8e9ec" }}
        />
        <Line
          yAxisId="score"
          type="monotone"
          dataKey="score"
          name="Commit-velocity score"
          stroke="#3ecf8e"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="price"
          name="Stock price"
          stroke="#8b8f98"
          strokeWidth={1.5}
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
