/** Generic route-loading placeholder: mirrors the header/stats/table shape
 * every list page shares, so navigation gives instant feedback instead of a
 * blank screen while the server component's queries resolve. */
export function PageSkeleton({ statCount = 4 }: { statCount?: number }) {
  return (
    <>
      <div className="page-header">
        <div className="skeleton" style={{ width: 120, height: 12, marginBottom: 10 }} />
        <div className="skeleton" style={{ width: 220, height: 26, marginBottom: 10 }} />
        <div className="skeleton" style={{ width: 340, height: 14 }} />
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns: `repeat(${statCount}, 1fr)`, marginBottom: 20 }}>
        {Array.from({ length: statCount }).map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton" style={{ width: '60%', height: 10, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: '40%', height: 24 }} />
          </div>
        ))}
      </div>
      <div className="table-card">
        <div style={{ padding: 20 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 16, marginBottom: 14, width: `${88 - i * 4}%` }} />
          ))}
        </div>
      </div>
    </>
  );
}
