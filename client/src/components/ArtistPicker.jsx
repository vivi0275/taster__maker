function ProfileOption({ artist, platform, selected, onSelect, index = 0 }) {
  const isSoundCloud = platform === 'soundcloud';
  const isSelected = selected === artist.id;

  return (
    <button
      type="button"
      onClick={() => onSelect(artist.id)}
      className={`profile-option ${isSelected ? 'profile-option-selected' : ''}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {(artist.avatarUrl || artist.imageUrl) ? (
        <img
          src={artist.avatarUrl || artist.imageUrl}
          alt=""
          className="profile-option-avatar"
        />
      ) : (
        <div className="profile-option-avatar flex items-center justify-center bg-[var(--color-surface)] text-[var(--color-muted)]">
          {isSoundCloud ? '◉' : '♫'}
        </div>
      )}
      <div className="profile-option-info">
        <p className="profile-option-name">{artist.name}</p>
        <p className="profile-option-meta">
          {isSoundCloud
            ? `@${artist.username}${artist.followers != null ? ` · ${artist.followers.toLocaleString()} followers` : ''}`
            : artist.subtitle || (artist.genres?.length ? artist.genres.join(', ') : 'Spotify artist')}
        </p>
      </div>
      <span className={`profile-option-check ${isSelected ? 'animate-check-pop' : ''}`}>
        {isSelected && '✓'}
      </span>
    </button>
  );
}

function PlatformPicker({
  platform,
  artists,
  onSelect,
  onSkip,
  selected,
  skipped,
}) {
  const isSoundCloud = platform === 'soundcloud';
  const isResolved = selected || skipped;

  if (!artists?.length) return null;

  return (
    <div
      className={`rounded-xl border p-5 transition-all ${
        isResolved
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-[var(--color-border)] bg-white/[0.02]'
      }`}
    >
      <div className="profile-picker-header">
        <div
          className={`profile-picker-icon ${
            isSoundCloud ? 'profile-picker-icon-soundcloud' : 'profile-picker-icon-spotify'
          }`}
        >
          {isSoundCloud ? '◉' : '♫'}
        </div>
        <div className="profile-picker-info">
          <h4 className="profile-picker-title">
            {isSoundCloud ? 'SoundCloud Profile' : 'Spotify Profile'}
          </h4>
          <p className="profile-picker-subtitle">
            {isResolved
              ? skipped
                ? 'Skipped'
                : `Selected: ${artists.find((a) => a.id === selected)?.name}`
              : isSoundCloud
              ? 'Multiple profiles found. Pick the right one.'
              : 'Optional. Skip if not needed.'}
          </p>
        </div>
        {isResolved && (
          <span className="text-green-400 text-sm">✓</span>
        )}
      </div>

      {!isResolved && (
        <>
          <div className="space-y-2 mb-4">
            {artists.slice(0, 5).map((artist, i) => (
              <ProfileOption
                key={artist.id}
                artist={artist}
                platform={platform}
                selected={selected}
                onSelect={onSelect}
                index={i}
              />
            ))}
          </div>

          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="btn-ghost w-full py-2.5 text-sm"
            >
              Skip {isSoundCloud ? 'SoundCloud' : 'Spotify'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function ArtistPicker({
  platform,
  artists,
  onSelect,
  onDismiss,
  onSkip,
  // Combined mode props
  combined = false,
  soundcloudArtists,
  spotifyArtists,
  onSoundCloudSelect,
  onSpotifySelect,
  onSoundCloudSkip,
  onSpotifySkip,
  soundcloudSelected,
  spotifySelected,
  soundcloudSkipped,
  spotifySkipped,
  onContinue,
}) {
  // Combined mode - show both platforms side by side
  if (combined) {
    const scResolved = soundcloudSelected || soundcloudSkipped || !soundcloudArtists?.length;
    const spResolved = spotifySelected || spotifySkipped || !spotifyArtists?.length;
    const canContinue = scResolved && spResolved;

    const hasBoth = soundcloudArtists?.length > 0 && spotifyArtists?.length > 0;

    const totalSteps = (soundcloudArtists?.length > 0 ? 1 : 0) + (spotifyArtists?.length > 0 ? 1 : 0);
    const completedSteps = (scResolved ? 1 : 0) + (spResolved ? 1 : 0);

    return (
      <div className="animate-scale-up panel p-6">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="progress-steps">
              {soundcloudArtists?.length > 0 && (
                <span className={`progress-step ${scResolved ? 'progress-step-completed' : ''}`} />
              )}
              {spotifyArtists?.length > 0 && (
                <span className={`progress-step ${spResolved ? 'progress-step-completed' : ''}`} />
              )}
            </div>
          </div>
          <p className="label-mono text-[var(--color-accent)] mb-2">Profile Selection</p>
          <h3 className="display-title text-xl text-white mb-2">
            {hasBoth ? 'Multiple profiles found' : 'Select a profile'}
          </h3>
          <p className="text-sm text-[var(--color-muted)] max-w-md mx-auto">
            {hasBoth
              ? `We found multiple matches on both platforms. Select or skip each one. (${completedSteps}/${totalSteps} done)`
              : 'We found multiple profiles. Pick the one you want to dig.'}
          </p>
        </div>

        <div className={`grid gap-4 ${hasBoth ? 'md:grid-cols-2' : ''} mb-6`}>
          {soundcloudArtists?.length > 0 && (
            <PlatformPicker
              platform="soundcloud"
              artists={soundcloudArtists}
              onSelect={onSoundCloudSelect}
              onSkip={onSoundCloudSkip}
              selected={soundcloudSelected}
              skipped={soundcloudSkipped}
            />
          )}

          {spotifyArtists?.length > 0 && (
            <PlatformPicker
              platform="spotify"
              artists={spotifyArtists}
              onSelect={onSpotifySelect}
              onSkip={onSpotifySkip}
              selected={spotifySelected}
              skipped={spotifySkipped}
            />
          )}
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className={`btn-primary w-full ${canContinue ? 'animate-pulse-glow' : ''}`}
        >
          {canContinue ? 'Continue to dig crate →' : 'Select or skip profiles above'}
        </button>
      </div>
    );
  }

  // Legacy single-platform mode
  const isSoundCloud = platform === 'soundcloud';

  return (
    <div className="animate-fade-up panel p-6">
      <div className="profile-picker-header mb-4">
        <div
          className={`profile-picker-icon ${
            isSoundCloud ? 'profile-picker-icon-soundcloud' : 'profile-picker-icon-spotify'
          }`}
        >
          {isSoundCloud ? '◉' : '♫'}
        </div>
        <div className="profile-picker-info">
          <h3 className="profile-picker-title">
            {isSoundCloud ? 'Pick the right SoundCloud profile' : 'Spotify profile (optional)'}
          </h3>
          <p className="profile-picker-subtitle">
            {isSoundCloud
              ? 'Multiple users match. Select the DJ or producer you mean.'
              : 'Bonus context. Skip if not needed.'}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-sm text-[var(--color-muted)] hover:text-white"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {artists.map((artist) => (
          <ProfileOption
            key={artist.id}
            artist={artist}
            platform={platform}
            selected={null}
            onSelect={onSelect}
          />
        ))}
      </div>

      {onSkip && (
        <button type="button" onClick={onSkip} className="btn-ghost w-full py-2.5">
          Skip {isSoundCloud ? 'SoundCloud' : 'Spotify'}
        </button>
      )}
    </div>
  );
}
