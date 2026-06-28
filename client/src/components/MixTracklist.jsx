import SoundCloudPreview from './SoundCloudPreview';
import SignalBadge from './SignalBadge';
import { trackYouTubeScMatchClick } from '../analytics';

const MATCH_STYLES = {
  matched: 'badge-accent',
  probable: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  not_found: 'text-[var(--color-muted)] border-[var(--color-border-subtle)] bg-transparent',
};

const MATCH_ORDER = { matched: 0, probable: 1, not_found: 2 };

export default function MixTracklist({
  digData,
  artistName,
  onOutboundClick,
  onPreviewPlay,
}) {
  if (digData.status === 'no_tracklist') {
    return (
      <p className="rounded-xl border border-[var(--color-border)] bg-white/5 px-4 py-3 text-sm text-[var(--color-muted)]">
        {digData.message || 'No tracklist in description or comments. Try another mix.'}
      </p>
    );
  }

  if (digData.status !== 'success') {
    return (
      <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
        {digData.message || 'Could not dig this mix.'}
      </p>
    );
  }

  const sourceLabel =
    digData.tracklistSource === 'comment' ? 'From comment' : 'From description';

  const foundTracks = digData.tracks.filter(
    (t) => t.matchStatus !== 'not_found' && t.url
  );

  const sortedTracks = [...foundTracks].sort((a, b) => {
    const orderA = MATCH_ORDER[a.matchStatus] ?? 2;
    const orderB = MATCH_ORDER[b.matchStatus] ?? 2;
    return orderA - orderB;
  });

  if (sortedTracks.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--color-border)] bg-white/5 px-4 py-3 text-sm text-[var(--color-muted)]">
        No tracks from this mix were found on SoundCloud.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
        <span className="uppercase tracking-widest">
          {sortedTracks.length} {sortedTracks.length === 1 ? 'track' : 'tracks'} on SoundCloud
        </span>
        <span className="rounded-full border border-white/10 px-2 py-0.5">{sourceLabel}</span>
      </div>

      <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {sortedTracks.map((track, i) => {
          const matchStyle = MATCH_STYLES[track.matchStatus] ?? MATCH_STYLES.probable;

          return (
            <li
              key={`${track.rawLine}-${i}`}
              className="track-card p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {track.timestamp && (
                    <span className="mr-2 font-mono text-xs text-[var(--color-muted)]">
                      {track.timestamp}
                    </span>
                  )}
                  <p className="text-sm font-medium text-white">
                    {track.parsedTitle ?? track.title}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {track.parsedArtist ?? track.artist}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`badge-mono ${matchStyle}`}>
                    {track.matchStatus === 'matched' ? 'Found' : 'Probable'}
                  </span>
                  {track.signal && <SignalBadge signal={track.signal} />}
                </div>
              </div>

              {track.previewable && track.soundcloudTrackId && (
                <SoundCloudPreview
                  trackId={track.soundcloudTrackId}
                  maxDuration={track.previewMaxDuration ?? 30}
                  attribution={track.attribution}
                  onPreviewPlay={() =>
                    onPreviewPlay?.({
                      trackId: track.soundcloudTrackId,
                      signal: 'from_mix',
                    })
                  }
                />
              )}

              <a
                href={track.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  trackYouTubeScMatchClick({
                    videoId: digData.videoId,
                    artist: artistName,
                    trackId: track.soundcloudTrackId,
                    destination: track.url,
                  });
                  onOutboundClick?.({
                    platform: 'SoundCloud',
                    signal: 'from_mix',
                    destination: track.url,
                  });
                }}
                className="btn-ghost mt-2 w-full py-2 text-[var(--color-accent)]"
              >
                Open on SoundCloud
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
