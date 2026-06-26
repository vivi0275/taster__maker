export default function DigSummary({
  artist,
  likedCount = 0,
  repostedCount = 0,
}) {
  if (!artist) return null;

  const hasCrate = likedCount + repostedCount > 0;

  return (
    <section className="panel-hero animate-fade-up px-5 py-6 sm:px-6">
      <div>
        <p className="label-mono text-[var(--color-accent)] mb-1">Dig crate</p>
        <h2 className="display-title text-2xl sm:text-3xl text-white">{artist}</h2>

        {hasCrate ? (
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--color-muted)]">
            Explore their public SoundCloud taste. Preview tracks, then follow artists they repost.
          </p>
        ) : (
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--color-muted)]">
            No public likes or reposts yet. Check other sections or try another profile.
          </p>
        )}
      </div>
    </section>
  );
}
