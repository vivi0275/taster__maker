import TrackCard from './TrackCard';
import SpotifyPlaylistCard from './SpotifyPlaylistCard';

export default function SpotifySection({
  playlistTracks,
  playlists,
  artistName,
  message,
  startIndex = 0,
  onOutboundClick,
  onPreviewPlay,
}) {
  const hasTracks = playlistTracks?.length > 0;
  const hasPlaylists = playlists?.length > 0;

  if (!hasTracks && !hasPlaylists) return null;

  const badge = [
    hasTracks && `${playlistTracks.length} tracks`,
    hasPlaylists && `${playlists.length} playlists`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="panel w-full animate-fade-up">
      <div className="section-header">
        <div className="section-header-content">
          <div className="section-header-title">
            <span className="section-header-icon section-header-icon-spotify">♫</span>
            <h2 className="section-title text-lg text-white sm:text-xl">Spotify Playlists</h2>
            {badge && <span className="badge-mono">{badge}</span>}
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">
            Public playlists linked to {artistName}. Not their private liked songs.
          </p>
        </div>
      </div>

      <div className="space-y-6 border-t border-[var(--color-border-subtle)] px-4 py-5 sm:px-5">
        {message && (
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/80">
            {message}
          </p>
        )}

        {hasTracks && (
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
              From playlists · {playlistTracks.length} {playlistTracks.length === 1 ? 'track' : 'tracks'}
            </p>
            <div className="dig-card-grid">
              {playlistTracks.map((track, i) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  index={startIndex + i}
                  onOutboundClick={onOutboundClick}
                  onPreviewPlay={onPreviewPlay}
                  showSpotifyDisclaimer
                />
              ))}
            </div>
          </div>
        )}

        {hasPlaylists && (
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
              {hasTracks ? 'More playlists' : 'Browse playlists'} · {playlists.length}
            </p>
            <p className="text-xs text-[var(--color-muted)]/80">
              Spotify limits third party apps from listing playlist tracks. Use the embedded player to dig
              in, or open on Spotify.
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              {playlists.map((playlist, i) => (
                <SpotifyPlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  index={startIndex + (playlistTracks?.length ?? 0) + i}
                  onOutboundClick={onOutboundClick}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
