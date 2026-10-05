import { useId } from "react";

export function MarketChart({ candlesticks = false, compact = false }: { candlesticks?: boolean; compact?: boolean }) {
  const gradientId = useId().replace(/:/g, "");
  const points = "0,88 16,61 32,72 50,48 67,66 84,82 104,53 122,46 140,65 158,35 177,46 195,21 214,39 233,14 253,29 270,4 290,20 307,45 326,19 345,31 364,9 382,22 400,0";
  return (
    <svg viewBox="0 0 400 110" className={`w-full ${compact ? "h-16" : "h-full min-h-44"}`} preserveAspectRatio="none" aria-label="Rising market chart">
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--chart-positive)" stopOpacity=".2" /><stop offset="1" stopColor="var(--chart-positive)" stopOpacity="0" /></linearGradient></defs>
      {!compact && [20, 45, 70, 95].map((y) => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="var(--border)" strokeWidth=".6" />)}
      {candlesticks ? Array.from({ length: 38 }, (_, index) => {
        const x = index * 10.4 + 4;
        const base = 88 - index * 1.55 + Math.sin(index * 1.7) * 14;
        const rise = index % 3 !== 0;
        return <g key={index}><line x1={x} y1={base - 8} x2={x} y2={base + 12} stroke={rise ? "var(--chart-positive)" : "var(--chart-negative)"} /><rect x={x - 2.5} y={rise ? base - 3 : base} width="5" height="10" fill={rise ? "var(--chart-positive)" : "var(--chart-negative)"} /></g>;
      }) : <><polygon points={`0,110 ${points} 400,110`} fill={`url(#${gradientId})`} /><polyline points={points} fill="none" stroke="var(--chart-positive)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" /></>}
    </svg>
  );
}