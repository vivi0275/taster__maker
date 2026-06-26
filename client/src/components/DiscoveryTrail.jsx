export default function DiscoveryTrail({ trail, onSelect }) {
  if (!trail || trail.length === 0) return null;

  const depth = trail.length;

  return (
    <nav
      aria-label="Discovery path"
      className="panel flex flex-wrap items-center justify-center gap-2 px-4 py-3 animate-fade-up"
    >
      <span className="label-mono text-[var(--color-discovery)] flex items-center gap-1.5">
        <span>Depth {depth}</span>
      </span>
      <span className="mx-1 text-[var(--color-border)]">|</span>
      {trail.map((name, i) => {
        const isLast = i === trail.length - 1;

        return (
          <span key={`${name}-${i}`} className="flex items-center gap-2">
            {i > 0 && (
              <span className="label-mono text-[var(--color-discovery)]/40">→</span>
            )}
            {isLast ? (
              <span className="tab-pill tab-pill-active cursor-default">{name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(name, i)}
                className="tab-pill trail-item hover:text-[var(--color-discovery)]"
                title={`Go back to ${name}`}
              >
                {name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
