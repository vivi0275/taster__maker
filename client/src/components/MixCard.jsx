import MixTracklist from './MixTracklist';
import { formatDuration, formatPublishedDate, formatViewCount } from '../utils/format';

export default function MixCard({
  mix,
  index,
  digLoading,
  digError,
  digData,
  artistName,
  onDig,
  onOutboundClick,
  onPreviewPlay,
}) {
  const embedUrl = `https://www.youtube.com/embed/${mix.videoId}?rel=0`;
  const viewsLabel = formatViewCount(mix.viewCount);
  const dateLabel = formatPublishedDate(mix.publishedAt);
  const durationLabel = formatDuration(mix.durationSeconds);

  const handleOutboundClick = () => {
    onOutboundClick?.({
      platform: 'YouTube',
      signal: 'mix',
      destination: mix.url,
    });
  };

  return (
    <article
      className="animate-fade-up track-card overflow-hidden"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <div className="border-b border-[var(--color-border-subtle)] p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              {mix.rank != null && (
                <span className="badge-mono border-white/15 bg-white/5 text-white/80">
                  #{mix.rank}
                </span>
              )}
              {mix.hasTracklistHint && (
                <span className="badge-mono border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                  Tracklist likely
                </span>
              )}
            </div>
            <h3 className="text-sm font-medium leading-snug text-white">{mix.title}</h3>
          </div>
          <span className="badge-mono shrink-0 border-[var(--color-youtube)]/30 bg-[var(--color-youtube)]/10 text-[var(--color-youtube)]">
            YouTube
          </span>
        </div>

        <p className="text-xs text-[var(--color-muted)]">{mix.channelTitle}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
          {viewsLabel && <span>{viewsLabel}</span>}
          {dateLabel && <span>{dateLabel}</span>}
          {durationLabel && <span>{durationLabel}</span>}
        </div>
      </div>

      <div className="aspect-video bg-black/30">
        <iframe
          title={`YouTube: ${mix.title}`}
          src={embedUrl}
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          loading="lazy"
        />
      </div>

      <div className="space-y-3 p-4">
        {!digData && (
          <button
            type="button"
            onClick={onDig}
            disabled={digLoading}
            className="btn-accent w-full py-2.5 disabled:opacity-50"
          >
            {digLoading ? 'Digging tracklist…' : 'Dig tracklist → SoundCloud'}
          </button>
        )}

        {digError && (
          <p className="text-center text-sm text-red-300">{digError}</p>
        )}

        {digData && (
          <MixTracklist
            digData={digData}
            artistName={artistName}
            onOutboundClick={onOutboundClick}
            onPreviewPlay={onPreviewPlay}
          />
        )}

        <a
          href={mix.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleOutboundClick}
          className="btn-ghost mt-2 w-full py-2 text-[var(--color-youtube)]"
        >
          Open on YouTube
        </a>
      </div>
    </article>
  );
}
