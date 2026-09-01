const VIEW_WIDTH = 300;
const VIEW_HEIGHT = 120;
const PAD_Y = 14;

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Small hand-rolled SVG line chart — no charting library, consistent with
// this app's preference for a couple of inline SVGs over a dependency
// (see icons.tsx). Points must already be in chronological (oldest-first)
// order; a single point still renders as a flat line with one dot.
export function TrendChart({
  points,
  unit,
  color = 'var(--color-primary)'
}: {
  points: { date: string; value: number }[];
  unit?: string;
  color?: string;
}) {
  if (points.length === 0) {
    return <p className="trend-chart-empty">Not enough data yet — log a few more entries to see a trend.</p>;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = points.length > 1 ? VIEW_WIDTH / (points.length - 1) : 0;

  const coords = points.map((point, index) => ({
    x: points.length > 1 ? index * stepX : VIEW_WIDTH / 2,
    y: VIEW_HEIGHT - PAD_Y - ((point.value - min) / range) * (VIEW_HEIGHT - PAD_Y * 2)
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${VIEW_HEIGHT} L ${coords[0].x.toFixed(1)} ${VIEW_HEIGHT} Z`;

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="trend-chart">
      <svg
        className="trend-chart-svg"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={`Trend from ${formatShortDate(first.date)} to ${formatShortDate(last.date)}: ${first.value} to ${last.value}${unit ?? ''}`}
      >
        <path d={areaPath} className="trend-chart-area" fill={color} stroke="none" />
        <path d={linePath} className="trend-chart-line" stroke={color} fill="none" />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 3.5 : 2.25}
            className="trend-chart-dot"
            fill={color}
          />
        ))}
      </svg>
      <div className="trend-chart-footer">
        <span className="trend-chart-date">{formatShortDate(first.date)}</span>
        <span className="trend-chart-current">
          {last.value}
          {unit}
        </span>
        <span className="trend-chart-date">{formatShortDate(last.date)}</span>
      </div>
    </div>
  );
}
