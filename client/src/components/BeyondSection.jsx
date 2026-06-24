import TrackCard from './TrackCard';
import ArtistCard from './ArtistCard';
import LoadingState from './LoadingState';

export default function BeyondSection({ data, loading, error, onGoBeyond, disabled }) {
  const hasResults =
    data?.lastfm?.similarArtists?.length > 0 || data?.lastfm?.similarTracks?.length > 0;

  return (
    <section className="space-y-6 border-t border-[var(--color-border)] pt-10">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Go beyond
          </h2>
          <p className="mt-1 max-w-md text-sm text-[var(--color-muted)]">
            Discover new artists and tracks similar to what they like — powered by Last.fm.
          </p>
        </div>

        {!hasResults && (
          <button
            onClick={onGoBeyond}
            disabled={disabled || loading}
            className="shrink-0 rounded-xl border border-[var(--color-lastfm)]/40 bg-[var(--color-lastfm)]/10 px-6 py-3 text-sm font-medium text-[var(--color-lastfm)] transition-all hover:bg-[var(--color-lastfm)]/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Exploring…' : 'Go beyond →'}
          </button>
        )}
      </div>

      {loading && <LoadingState />}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-center text-sm text-red-300">
          {error}
        </div>
      )}

      {data?.lastfm?.message && !hasResults && !loading && !error && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3 text-sm text-[var(--color-muted)]">
          <span className="font-medium text-[var(--color-lastfm)]">Last.fm: </span>
          {data.lastfm.message}
        </div>
      )}

      {hasResults && (
        <div className="space-y-10">
          {data.lastfm.similarArtists?.length > 0 && (
            <div>
              <p className="mb-4 text-xs uppercase tracking-widest text-[var(--color-muted)]">
                Artists to discover · {data.lastfm.similarArtists.length}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.lastfm.similarArtists.map((artist, i) => (
                  <ArtistCard key={artist.id} artist={artist} index={i} />
                ))}
              </div>
            </div>
          )}

          {data.lastfm.similarTracks?.length > 0 && (
            <div>
              <p className="mb-4 text-xs uppercase tracking-widest text-[var(--color-muted)]">
                Similar tracks · {data.lastfm.similarTracks.length}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.lastfm.similarTracks.map((track, i) => (
                  <TrackCard key={track.id} track={track} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
