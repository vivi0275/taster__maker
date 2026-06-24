export default function ArtistCard({ artist, index }) {
  return (
    <article
      className="animate-fade-up group flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5 transition-colors hover:border-[var(--color-lastfm)]/20"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <div className="mb-4 flex items-center gap-3">
        {artist.imageUrl ? (
          <img
            src={artist.imageUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-lastfm)]/10 text-sm font-medium text-[var(--color-lastfm)]">
            {artist.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-white">{artist.name}</h3>
          {artist.meta && (
            <p className="text-xs text-[var(--color-muted)]">{artist.meta}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full border border-[var(--color-lastfm)]/25 bg-[var(--color-lastfm)]/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--color-lastfm)]">
          Last.fm
        </span>
      </div>

      <a
        href={artist.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex w-full items-center justify-center rounded-xl border border-[var(--color-lastfm)]/30 px-4 py-2.5 text-sm font-medium text-[var(--color-lastfm)] transition-colors hover:bg-[var(--color-lastfm)]/10"
      >
        Discover on Last.fm
      </a>
    </article>
  );
}
