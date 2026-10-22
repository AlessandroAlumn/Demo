export default function ProgressBar({
  value,
  max,
  label,
  tone = "yellow",
}: {
  value: number;
  max: number;
  label?: string;
  tone?: "yellow" | "blue";
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
    >
      <div
        className={`h-full rounded-full ${tone === "yellow" ? "bg-brand-yellow" : "bg-brand-blue"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
