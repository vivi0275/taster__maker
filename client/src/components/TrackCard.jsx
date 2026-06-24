const platformStyles = {
  SoundCloud: {
    badge: 'bg-[var(--color-soundcloud)]/15 text-[var(--color-soundcloud)] border-[var(--color-soundcloud)]/25',
    button: 'hover:bg-[var(--color-soundcloud)]/10 border-[var(--color-soundcloud)]/30 text-[var(--color-soundcloud)]',
  },
  Spotify: {
    badge: 'bg-[var(--color-spotify)]/15 text-[var(--color-spotify)] border-[var(--color-spotify)]/25',
    button: 'hover:bg-[var(--color-spotify)]/10 border-[var(--color-spotify)]/30 text-[var(--color-spotify)]',
  },
  'Last.fm': {
    badge: 'bg-[var(--color-lastfm)]/15 text-[var(--color-lastfm)] border-[var(--color-lastfm)]/25',
    button: 'hover:bg-[var(--color-lastfm)]/10 border-[var(--color-lastfm)]/30 text-[var(--color-lastfm)]',
  },
};

export default function TrackCard({ track, index }) {
  const styles = platformStyles[track.source] ?? platformStyles.Spotify;

  return (
    <article
      className="animate-fade-up group flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5 transition-colors hover:border-white/10"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug text-white group-hover:text-white/90">{track.title}</h3>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${styles.badge}`}
        >
          {track.source}
        </span>
      </div>

      <p className="mb-1 text-sm text-[var(--color-muted)]">{track.artist}</p>

      {track.meta && <p className="mb-4 text-xs text-[var(--color-muted)]/70">{track.meta}</p>}

      <div className="mt-auto space-y-2 border-t border-[var(--color-border)] pt-4">
        <p className="text-[11px] text-[var(--color-muted)]">
          {track.source === 'SoundCloud' ? (
            <>
              Uploaded by <span className="text-white/70">{track.attribution}</span> · Source: SoundCloud
            </>
          ) : track.source === 'Last.fm' ? (
            <>
              By <span className="text-white/70">{track.attribution}</span> · Source: Last.fm
            </>
          ) : (
            <>
              By <span className="text-white/70">{track.attribution}</span> · Source: Spotify
            </>
          )}
        </p>
        <a
          href={track.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${styles.button}`}
        >
          {track.source === 'Last.fm' ? 'Explore on Last.fm' : `Listen on ${track.source}`}
        </a>
      </div>
    </article>
  );
}
