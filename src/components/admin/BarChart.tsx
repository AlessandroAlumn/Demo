/** A small accessible bar chart (inline SVG): one bar per label, a tooltip with the value on each. */
export default function BarChart({
  data,
  label,
  format,
}: {
  data: { label: string; value: number }[];
  label: string;
  format: (value: number) => string;
}) {
  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 8, bottom: 28, left: 8 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = (width - pad.left - pad.right) / Math.max(1, data.length);
  const barWidth = slot * 0.62;

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="h-auto w-full">
        <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="#d0d5dd" />
        {data.map((d, i) => {
          const h = ((height - pad.top - pad.bottom) * d.value) / max;
          const x = pad.left + i * slot + (slot - barWidth) / 2;
          const y = height - pad.bottom - h;
          const last = i === data.length - 1;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={barWidth} height={Math.max(h, d.value > 0 ? 1 : 0)} rx={3} fill={last ? "#f9cf00" : "#0050b4"} opacity={last ? 1 : 0.85}>
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
              <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" fontSize="11" fill="#667085">
                {d.label}
              </text>
              {d.value > 0 && (
                <text x={x + barWidth / 2} y={Math.max(y - 4, 11)} textAnchor="middle" fontSize="10" fill="#475467">
                  {format(d.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
