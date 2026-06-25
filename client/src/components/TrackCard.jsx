import { useMemo, useState } from 'react';
import SoundCloudPreview from './SoundCloudPreview';
import SpotifyPreview from './SpotifyPreview';

const platformLinkLabel = {
  SoundCloud: 'Open in SoundCloud',
  Spotify: 'Open in Spotify',
  'Last.fm': 'Open on Last.fm',
};

function buildSoundCloudArtworkSrc(track) {
  if (!track.soundcloudTrackId) return null;
  const params = new URLSearchParams({ trackId: track.soundcloudTrackId });
  if (track.url) params.set('url', track.url);
  return `/api/soundcloud/artwork?${params}`;
}

function CoverArt({ track }) {
  const candidates = useMemo(() => {
    const list = [];
    const proxy = track.source === 'SoundCloud' ? buildSoundCloudArtworkSrc(track) : null;
    if (proxy) list.push(proxy);
    if (track.artworkUrl) list.push(track.artworkUrl);
    if (track.imageUrl) list.push(track.imageUrl);
    return [...new Set(list.filter(Boolean))];
  }, [track.source, track.soundcloudTrackId, track.url, track.artworkUrl, track.imageUrl]);

  const [index, setIndex] = useState(0);
  const artworkSrc = candidates[index] ?? null;

  const handleImageError = () => {
    setIndex((i) => (i + 1 < candidates.length ? i + 1 : i));
  };

  return (
    <div className="dig-card-cover" aria-hidden="true">
      {artworkSrc ? (
        <img
          src={artworkSrc}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleImageError}
        />
      ) : (
        <div className="dig-card-cover-fallback">
          <span>{track.source === 'Spotify' ? '♫' : '◉'}</span>
        </div>
      )}
    </div>
  );
}

export default function TrackCard({
  track,
  index,
  onOutboundClick,
  onPreviewPlay,
  onRemove,
  showSpotifyDisclaimer = false,
}) {
  const showSoundCloudPreview =
    track.source === 'SoundCloud' && track.previewable && track.soundcloudTrackId;
  const showSpotifyPreview =
    track.source === 'Spotify' && track.previewable && track.previewUrl;

  const handleOutboundClick = () => {
    onOutboundClick?.({
      platform: track.source,
      signal: track.signal,
      destination: track.url,
    });
  };

  const handlePreviewPlay = () => {
    onPreviewPlay?.({
      trackId: track.soundcloudTrackId ?? track.spotifyId,
      signal: track.signal,
      platform: track.source,
    });
  };

  const linkLabel =
    track.kind === 'playlist' ? 'Open playlist' : platformLinkLabel[track.source] ?? `Open on ${track.source}`;

  return (
    <article
      className="dig-card animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <h3 className="dig-card-title" title={track.title}>
        {track.title}
      </h3>

      <CoverArt track={track} />

      <p className="dig-card-artist" title={track.artist}>
        {track.artist}
      </p>

      {showSpotifyDisclaimer && (
        <p className="dig-card-note">Public playlists, not private likes</p>
      )}

      <div className="dig-card-actions">
        {showSoundCloudPreview && (
          <SoundCloudPreview
            trackId={track.soundcloudTrackId}
            maxDuration={track.previewMaxDuration ?? 30}
            attribution={track.attribution}
            onPreviewPlay={handlePreviewPlay}
            compact
          />
        )}

        {showSpotifyPreview && (
          <SpotifyPreview
            previewUrl={track.previewUrl}
            title={track.title}
            onPreviewPlay={handlePreviewPlay}
            compact
          />
        )}

        {onRemove && (
          <button type="button" onClick={onRemove} className="dig-card-link dig-card-link-muted">
            Remove
          </button>
        )}

        <a
          href={track.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOutboundClick}
          className="dig-card-link"
        >
          {linkLabel} ↗
        </a>
      </div>
    </article>
  );
}
