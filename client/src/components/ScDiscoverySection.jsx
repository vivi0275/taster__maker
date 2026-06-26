export default function ScDiscoverySection({
  discoveries,
  sourceArtist,
  onDiscoverArtist,
  discoveringArtist,
}) {
  if (!discoveries?.length) return null;

  return (
    <section className="panel w-full animate-fade-up">
      <div className="section-header">
        <div className="section-header-content">
          <div className="section-header-title">
            <span className="section-header-icon section-header-icon-discovery">→</span>
            <h2 className="section-title text-lg text-white sm:text-xl">Rabbit Hole</h2>
            <span className="badge-mono">
              {discoveries.length} {discoveries.length === 1 ? 'artist' : 'artists'}
            </span>
            <span className="section-badge-recommended">Discovery</span>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">
            Artists that {sourceArtist} reposted. One click digs into their crate too.
          </p>
        </div>
      </div>

      <div className="space-y-6 border-t border-[var(--color-border-subtle)] px-4 py-5 sm:px-5">
        <div className="tip-banner">
          <span className="tip-banner-icon">*</span>
          <div className="tip-banner-content">
            <p className="tip-banner-title">This is where the magic happens</p>
            <p className="tip-banner-text">
              These are artists discovered through {sourceArtist}'s reposts. Click any of them to explore their taste and go deeper into the rabbit hole.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {discoveries.map((item, i) => (
            <article
              key={item.name}
              className="animate-fade-up track-card track-card-discovery flex flex-col p-4"
              style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <p className="label-mono text-[var(--color-discovery)] mb-1">
                    Discovered via repost
                  </p>
                  <h3 className="text-sm font-medium text-white truncate">{item.name}</h3>
                </div>
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-discovery)]/10 flex items-center justify-center text-[var(--color-discovery)] text-sm">
                  →
                </span>
              </div>

              <p className="text-xs text-[var(--color-muted)] mb-4 line-clamp-2">
                e.g. "{item.exampleTrack}"
              </p>

              <button
                type="button"
                onClick={() => onDiscoverArtist(item.name)}
                disabled={discoveringArtist === item.name}
                className={`btn-ghost mt-auto w-full py-2.5 text-[var(--color-discovery)] disabled:opacity-50 hover:bg-[var(--color-discovery)]/10 hover:border-[var(--color-discovery)]/30 transition-all duration-200 ${
                  discoveringArtist === item.name ? 'bg-[var(--color-discovery)]/5' : ''
                }`}
              >
                {discoveringArtist === item.name ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-pulse-dot text-[var(--color-discovery)]">●</span>
                    <span>Digging {item.name}…</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5 group">
                    <span>Dig their crate</span>
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                )}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
