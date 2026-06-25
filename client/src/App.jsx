import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchArtist, checkHealth } from './api';
import {
  trackSearchCompleted,
  trackPreviewStarted,
  trackOutboundClick,
  trackTrailExtended,
  trackDiscoverArtist,
} from './analytics';
import { getCachedSearch, setCachedSearch } from './utils/searchCache';
import SearchBar from './components/SearchBar';
import WaveBackground from './components/WaveBackground';
import SoundCloudTracksSection from './components/SoundCloudTracksSection';
import SpotifySection from './components/SpotifySection';
import YouTubeSection from './components/YouTubeSection';
import ScDiscoverySection from './components/ScDiscoverySection';
import DigSummary from './components/DigSummary';
import HowItWorks from './components/HowItWorks';
import LoadingState from './components/LoadingState';
import PlatformMessage from './components/PlatformMessage';
import ArtistPicker from './components/ArtistPicker';
import DiscoveryTrail from './components/DiscoveryTrail';

export default function App() {
  const resultsRef = useRef(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [trail, setTrail] = useState([]);
  const [discoveringArtist, setDiscoveringArtist] = useState(null);
  const [spotifySkipped, setSpotifySkipped] = useState(false);
  const [selection, setSelection] = useState({ soundcloudUserId: null, spotifyArtistId: null });

  useEffect(() => {
    checkHealth().then(setApiStatus).catch(() => null);
  }, []);

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const artistLabel =
    results?.soundcloud?.artistName || results?.spotify?.artistName || results?.query;

  const handleAnalyticsPreview = useCallback(
    ({ trackId, signal, platform = 'SoundCloud' }) => {
      trackPreviewStarted({ trackId, artist: artistLabel, signal, platform });
    },
    [artistLabel]
  );

  const handleAnalyticsOutbound = useCallback(
    ({ platform, signal, destination }) => {
      trackOutboundClick({ platform, signal, artist: artistLabel, destination });
    },
    [artistLabel]
  );

  const runSearch = useCallback(
    async (artist, overrides = {}) => {
      setLoading(true);
      setError(null);

      const resetSelection = overrides.resetSelection ?? false;
      const resetSpotifySkip = overrides.resetSpotifySkip ?? false;

      const opts = {
        soundcloudUserId: resetSelection
          ? overrides.soundcloudUserId ?? null
          : overrides.soundcloudUserId ?? selection.soundcloudUserId,
        spotifyArtistId: resetSelection
          ? overrides.spotifyArtistId ?? null
          : overrides.spotifyArtistId ?? selection.spotifyArtistId,
      };

      if (resetSpotifySkip) {
        setSpotifySkipped(false);
      }

      const cached = overrides.skipCache
        ? null
        : getCachedSearch(artist, opts.soundcloudUserId, opts.spotifyArtistId);

      if (cached) {
        setResults(cached);
        setLoading(false);
        setDiscoveringArtist(null);
        return;
      }

      try {
        const data = await searchArtist(artist, opts);
        setResults(data);
        setCachedSearch(artist, opts.soundcloudUserId, opts.spotifyArtistId, data);

        if (data.soundcloud.status !== 'ambiguous') {
          setSelection((s) => ({ ...s, soundcloudUserId: opts.soundcloudUserId }));
        }
        if (data.spotify.status !== 'ambiguous') {
          setSelection((s) => ({ ...s, spotifyArtistId: opts.spotifyArtistId }));
        }

        const trailDepth = overrides.trailDepth ?? trail.length;
        trackSearchCompleted({
          artist: data.query,
          soundcloudCount: data.soundcloud.tracks?.length ?? 0,
          spotifyCount: (data.spotify.tracks?.length ?? 0) + (data.spotify.playlists?.length ?? 0),
          youtubeCount: data.youtube?.mixes?.length ?? 0,
          trailDepth,
        });
      } catch (err) {
        setError(err.message);
        setResults(null);
      } finally {
        setLoading(false);
        setDiscoveringArtist(null);
      }
    },
    [selection.soundcloudUserId, selection.spotifyArtistId, trail.length]
  );

  const handleDiscoverArtist = (artistName, source = 'repost') => {
    const fromArtist = trail[trail.length - 1] ?? results?.query;
    const nextTrail = trail[trail.length - 1] === artistName ? trail : [...trail, artistName];
    const depth = nextTrail.length;

    setQuery(artistName);
    setSelection({ soundcloudUserId: null, spotifyArtistId: null });
    setSpotifySkipped(false);
    setDiscoveringArtist(artistName);
    setTrail(nextTrail);

    trackDiscoverArtist({ fromArtist, toArtist: artistName, depth, source });
    trackTrailExtended({ artist: artistName, depth });

    runSearch(artistName, {
      resetSelection: true,
      resetSpotifySkip: true,
      soundcloudUserId: null,
      spotifyArtistId: null,
      trailDepth: depth,
    });
    scrollToResults();
  };

  const handleTrailSelect = (artistName, index) => {
    const nextTrail = trail.slice(0, index + 1);
    setQuery(artistName);
    setSelection({ soundcloudUserId: null, spotifyArtistId: null });
    setSpotifySkipped(false);
    setTrail(nextTrail);
    runSearch(artistName, {
      resetSelection: true,
      resetSpotifySkip: true,
      soundcloudUserId: null,
      spotifyArtistId: null,
      trailDepth: nextTrail.length,
    });
    scrollToResults();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSelection({ soundcloudUserId: null, spotifyArtistId: null });
    setSpotifySkipped(false);
    setTrail([trimmed]);
    runSearch(trimmed, {
      resetSelection: true,
      resetSpotifySkip: true,
      soundcloudUserId: null,
      spotifyArtistId: null,
      trailDepth: 1,
    });
  };

  const handleSoundCloudPick = (userId) => {
    setSelection((s) => ({ ...s, soundcloudUserId: userId }));
    runSearch(results.query, { soundcloudUserId: userId, trailDepth: trail.length, skipCache: true });
  };

  const handleSpotifyPick = (artistId) => {
    setSpotifySkipped(false);
    setSelection((s) => ({ ...s, spotifyArtistId: artistId }));
    runSearch(results.query, { spotifyArtistId: artistId, trailDepth: trail.length, skipCache: true });
  };

  const handleSpotifySkip = () => {
    setSpotifySkipped(true);
  };

  const soundcloudTracks = results?.soundcloud?.tracks ?? [];

  const likedTracks = useMemo(
    () => soundcloudTracks.filter((t) => t.signal === 'liked'),
    [soundcloudTracks]
  );

  const repostedTracks = useMemo(
    () => soundcloudTracks.filter((t) => t.signal === 'reposted'),
    [soundcloudTracks]
  );

  const scDiscoveries = useMemo(() => {
    const map = new Map();
    for (const track of soundcloudTracks) {
      if (!track.thirdPartyDiscovery) continue;
      const name = track.artist;
      if (!map.has(name)) {
        map.set(name, { name, exampleTrack: track.title });
      }
    }
    return [...map.values()];
  }, [soundcloudTracks]);

  const spotifyPlaylistTracks = results?.spotify?.tracks ?? [];
  const spotifyPlaylists = results?.spotify?.playlists ?? [];
  const youtubeMixes = results?.youtube?.mixes ?? [];
  const hasSoundcloudCrate = soundcloudTracks.length > 0;
  const hasSecondaryContent =
    spotifyPlaylistTracks.length > 0 ||
    spotifyPlaylists.length > 0 ||
    youtubeMixes.length > 0;

  const soundcloudAmbiguous = results?.soundcloud?.status === 'ambiguous';
  const showSpotifyPicker =
    results?.spotify?.status === 'ambiguous' && !spotifySkipped && !soundcloudAmbiguous;

  const canShowDigContent = !showSpotifyPicker;

  const showResults = results && !loading;

  return (
    <div className="relative min-h-screen">
      <WaveBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <header className={`text-center transition-all ${showResults ? 'mb-8' : 'mb-12'}`}>
          {!showResults && (
            <p className="label-mono mb-4 text-[var(--color-accent)]">For DJs &amp; producers</p>
          )}
          <h1 className={`display-title text-white ${showResults ? 'text-3xl sm:text-4xl' : 'text-5xl sm:text-6xl'}`}>
            Tastemaker
          </h1>
          {!showResults && (
            <>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--color-muted)]">
                Dig your reference artists&apos; real SoundCloud crate. Preview tracks up to 30s. Rabbit hole deeper.
              </p>
              <p className="label-mono mx-auto mt-3 max-w-lg text-[var(--color-muted)]/60">
                Real likes &amp; reposts · YouTube sets as bonus
              </p>
            </>
          )}

          {apiStatus && (!apiStatus.soundcloud || !apiStatus.spotify || !apiStatus.youtube) && (
            <p className="mx-auto mt-4 max-w-lg rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/80">
              {[
                !apiStatus.soundcloud && 'SoundCloud credentials missing',
                !apiStatus.spotify && 'Spotify credentials missing',
                !apiStatus.youtube && 'YouTube API key missing (Live sets unavailable)',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </header>

        <div className={`flex justify-center ${showResults ? 'sticky top-4 z-20 mb-6' : 'mb-8'}`}>
          <SearchBar value={query} onChange={setQuery} onSubmit={handleSubmit} loading={loading} compact={showResults} />
        </div>

        {trail.length > 1 && showResults && canShowDigContent && (
          <div className="mb-6">
            <DiscoveryTrail trail={trail} onSelect={handleTrailSelect} />
          </div>
        )}

        {loading && <LoadingState />}

        {error && (
          <div className="mx-auto max-w-xl rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        {showResults && (
          <div ref={resultsRef} className="space-y-6 scroll-mt-8">
            {soundcloudAmbiguous && (
              <ArtistPicker
                platform="soundcloud"
                artists={results.soundcloud.artists}
                onSelect={handleSoundCloudPick}
              />
            )}

            {!soundcloudAmbiguous && (
              <>
                {showSpotifyPicker && (
                  <ArtistPicker
                    platform="spotify"
                    artists={results.spotify.artists}
                    onSelect={handleSpotifyPick}
                    onSkip={handleSpotifySkip}
                  />
                )}

                {canShowDigContent && (
                  <>
                <PlatformMessage platform="SoundCloud" result={results.soundcloud} />

                <DigSummary
                  artist={artistLabel}
                  likedCount={likedTracks.length}
                  repostedCount={repostedTracks.length}
                  discoveryCount={scDiscoveries.length}
                />

                <div className="space-y-4">
                  {likedTracks.length > 0 && (
                    <SoundCloudTracksSection
                      title="Likes"
                      subtitle="What they actually liked. Hit play, open on SoundCloud."
                      badge={`${likedTracks.length} ${likedTracks.length === 1 ? 'track' : 'tracks'}`}
                      tracks={likedTracks}
                      startIndex={0}
                      defaultOpen
                      onOutboundClick={handleAnalyticsOutbound}
                      onPreviewPlay={handleAnalyticsPreview}
                    />
                  )}

                  {repostedTracks.length > 0 && (
                    <SoundCloudTracksSection
                      title="Reposts"
                      subtitle="Their repost signal. Where the best rabbit holes start."
                      badge={`${repostedTracks.length} ${repostedTracks.length === 1 ? 'track' : 'tracks'}`}
                      tracks={repostedTracks}
                      startIndex={likedTracks.length}
                      onOutboundClick={handleAnalyticsOutbound}
                      onPreviewPlay={handleAnalyticsPreview}
                    />
                  )}

                  {scDiscoveries.length > 0 && (
                    <ScDiscoverySection
                      discoveries={scDiscoveries}
                      sourceArtist={artistLabel}
                      onDiscoverArtist={(name) => handleDiscoverArtist(name, 'repost')}
                      discoveringArtist={discoveringArtist}
                    />
                  )}

                  {!hasSoundcloudCrate && results.soundcloud.message && (
                    <p className="panel px-4 py-6 text-center text-sm text-[var(--color-muted)]">
                      {results.soundcloud.message}
                      {scDiscoveries.length > 0 && (
                        <span className="mt-2 block">Expand discovery reposts to keep digging.</span>
                      )}
                    </p>
                  )}

                  {(youtubeMixes.length > 0 || results.youtube?.message) && (
                    <YouTubeSection
                      mixes={youtubeMixes}
                      message={results.youtube?.message}
                      artistName={artistLabel}
                      onOutboundClick={handleAnalyticsOutbound}
                      onPreviewPlay={handleAnalyticsPreview}
                    />
                  )}

                  {!spotifySkipped &&
                    results.spotify.status !== 'ambiguous' &&
                    (spotifyPlaylistTracks.length > 0 || spotifyPlaylists.length > 0) && (
                      <SpotifySection
                        playlistTracks={spotifyPlaylistTracks}
                        playlists={spotifyPlaylists}
                        artistName={artistLabel}
                        message={results.spotify.message}
                        startIndex={soundcloudTracks.length}
                        onOutboundClick={handleAnalyticsOutbound}
                        onPreviewPlay={handleAnalyticsPreview}
                      />
                    )}
                </div>

                {!hasSoundcloudCrate && !hasSecondaryContent && !results.soundcloud.message && (
                  <p className="py-12 text-center text-[var(--color-muted)]">
                    No public taste signals found for this artist yet. Try another name or pick a different profile.
                  </p>
                )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {!showResults && !loading && <HowItWorks />}
      </div>
    </div>
  );
}
