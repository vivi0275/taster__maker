import { useState } from 'react';
import { fetchYouTubeDig } from '../api';
import { trackYouTubeDigCompleted, trackYouTubeDigStarted } from '../analytics';
import CollapsibleSection from './CollapsibleSection';
import MixCard from './MixCard';

export default function YouTubeSection({
  mixes,
  message,
  artistName,
  onOutboundClick,
  onPreviewPlay,
}) {
  const [digState, setDigState] = useState({});

  if (!mixes?.length && !message) return null;

  const handleDig = async (mix) => {
    trackYouTubeDigStarted({ videoId: mix.videoId, artist: artistName });

    setDigState((prev) => ({
      ...prev,
      [mix.videoId]: { loading: true, error: null, data: null },
    }));

    try {
      const data = await fetchYouTubeDig(mix.videoId);
      setDigState((prev) => ({
        ...prev,
        [mix.videoId]: { loading: false, error: null, data },
      }));

      if (data.status === 'success') {
        trackYouTubeDigCompleted({
          videoId: mix.videoId,
          artist: artistName,
          tracklistSource: data.tracklistSource,
          trackCount: data.tracks?.length ?? 0,
          matchedCount: data.tracks?.filter((t) => t.matchStatus !== 'not_found').length ?? 0,
        });
      }
    } catch (err) {
      setDigState((prev) => ({
        ...prev,
        [mix.videoId]: { loading: false, error: err.message, data: null },
      }));
    }
  };

  return (
    <CollapsibleSection
      title="Live sets"
      subtitle="YouTube mixes. Dig the tracklist, find each track on SoundCloud. Bonus signal after the dig crate."
      badge={mixes?.length ? `${mixes.length} mixes` : null}
      defaultOpen={false}
    >
      {message && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/80">
          {message}
        </p>
      )}

      {mixes?.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {mixes.map((mix, i) => {
            const state = digState[mix.videoId] ?? { loading: false, error: null, data: null };
            return (
              <MixCard
                key={mix.videoId}
                mix={mix}
                index={i}
                artistName={artistName}
                digLoading={state.loading}
                digError={state.error}
                digData={state.data}
                onDig={() => handleDig(mix)}
                onOutboundClick={onOutboundClick}
                onPreviewPlay={onPreviewPlay}
              />
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}
