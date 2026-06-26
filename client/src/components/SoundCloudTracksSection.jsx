import TrackCard from './TrackCard';

const SECTION_ICONS = {
  Likes: '♥',
  Reposts: '↻',
};

const SECTION_COLORS = {
  Likes: 'accent',
  Reposts: 'accent',
};

export default function SoundCloudTracksSection({
  title,
  subtitle,
  badge,
  tracks,
  startIndex = 0,
  defaultOpen = true,
  onOutboundClick,
  onPreviewPlay,
}) {
  if (!tracks?.length) return null;

  const icon = SECTION_ICONS[title] || '♫';
  const color = SECTION_COLORS[title] || 'accent';

  return (
    <section className="panel w-full animate-fade-up">
      <div className="section-header">
        <div className="section-header-content">
          <div className="section-header-title">
            <span className={`section-header-icon section-header-icon-${color}`}>
              {icon}
            </span>
            <h2 className="section-title text-lg text-white sm:text-xl">{title}</h2>
            {badge != null && <span className="badge-mono">{badge}</span>}
          </div>
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-6 border-t border-[var(--color-border-subtle)] px-4 py-5 sm:px-5">
        <div className="dig-card-grid">
          {tracks.map((track, i) => (
            <TrackCard
              key={track.id}
              track={track}
              index={startIndex + i}
              onOutboundClick={onOutboundClick}
              onPreviewPlay={onPreviewPlay}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
