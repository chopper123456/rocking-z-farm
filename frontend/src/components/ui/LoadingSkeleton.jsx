import './LoadingSkeleton.css';

export function SkeletonLine({ width = '100%', height = '1rem' }) {
  return <div className="skeleton-line" style={{ width, height }} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-card-icon" />
      <SkeletonLine width="70%" height="1.25rem" />
      <SkeletonLine width="90%" height="0.9rem" />
    </div>
  );
}

export function SkeletonList({ count = 5 }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonFieldList() {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skeleton-field-row">
          <SkeletonLine width="40%" height="1.25rem" />
          <SkeletonLine width="60%" height="0.9rem" />
        </div>
      ))}
    </div>
  );
}

export default function LoadingSkeleton({ type = 'list', count }) {
  if (type === 'fieldList') return <SkeletonFieldList />;
  return <SkeletonList count={count ?? 5} />;
}
