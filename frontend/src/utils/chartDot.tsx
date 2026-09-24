// A recharts <Line> dot renderer that navigates somewhere when clicked -- used
// wherever a trend chart's points are individual records (e.g. one inspection
// per point) rather than an aggregate, so the chart is a doorway into the data
// instead of a dead end.
export function clickableDot(onDotClick: (payload: any) => void, color = '#2563eb') {
  return (props: any) => {
    const { cx, cy, payload, index } = props
    // recharts' dot renderer type requires an element back even when there's
    // nothing to plot (e.g. a gap in the data) -- render it with zero radius
    // instead of returning null.
    if (cx == null || cy == null) return <circle key={index} cx={0} cy={0} r={0} fill="none" />
    return (
      <circle
        key={index}
        cx={cx} cy={cy} r={4} fill={color} stroke={color}
        style={{ cursor: 'pointer' }}
        onClick={() => onDotClick(payload)}
      />
    )
  }
}
