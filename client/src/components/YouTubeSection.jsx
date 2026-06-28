import { useMemo, useState } from 'react';
import { fetchYouTubeDig } from '../api';
import { trackYouTubeDigCompleted, trackYouTubeDigStarted } from '../analytics';
import MixCard from './MixCard';

export default function YouTubeSection({
  mixes,
  message,
  artistName,
  onOutboundClick,
  onPreviewPlay,
}) {
  const [digState, setDigState] = useState({});

  const summary = useMemo(() => {
    if (!mixes?.length) return null;
    const withTracklist = mixes.filter((m) => m.hasTracklistHint).length;
    const totalViews = mixes.reduce((sum, m) => sum + (m.viewCount ?? 0), 0);
    return { withTracklist, totalViews };
  }, [mixes]);

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
    <section className="panel w-full animate-fade-up">
      <div className="section-header">
        <div className="section-header-content">
          <div className="section-header-title">
            <span className="section-header-icon section-header-icon-youtube">▶</span>
            <h2 className="section-title text-lg text-white sm:text-xl">Live Sets</h2>
            {mixes?.length > 0 && (
              <span className="badge-mono">
                {mixes.length} {mixes.length === 1 ? 'mix' : 'mixes'}
              </span>
            )}
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">
            Ranked by popularity, recency, and tracklist potential. Dig a set to match tracks on
            SoundCloud.
          </p>
          {summary && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--color-muted)]">
                Sorted: best match first
              </span>
              {summary.withTracklist > 0 && (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-xs text-emerald-300/90">
                  {summary.withTracklist} with tracklist in description
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6 border-t border-[var(--color-border-subtle)] px-4 py-5 sm:px-5">
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
      </div>
    </section>
  );
}
