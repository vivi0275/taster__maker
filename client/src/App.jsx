import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchArtist, checkHealth } from './api';
import {
  trackSearchCompleted,
  trackPreviewStarted,
  trackOutboundClick,
  trackTrailExtended,
  trackDiscoverArtist,
} from './analytics';
import { getCachedSearch, resolveCacheIds, setCachedSearch } from './utils/searchCache';
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
import SectionTabs from './components/SectionTabs';

export default function App() {
  const resultsRef = useRef(null);
  const searchSeqRef = useRef(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [trail, setTrail] = useState([]);
  const [discoveringArtist, setDiscoveringArtist] = useState(null);
  const [soundcloudSkipped, setSoundcloudSkipped] = useState(false);
  const [spotifySkipped, setSpotifySkipped] = useState(false);
  const [profileSelectionDone, setProfileSelectionDone] = useState(false);
  const [selection, setSelection] = useState({ soundcloudUserId: null, spotifyArtistId: null });
  const [activeSection, setActiveSection] = useState('likes');

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

  const emitSearchCompleted = useCallback((data, trailDepth, fromCache = false) => {
    trackSearchCompleted({
      artist: data.query,
      soundcloudCount: data.soundcloud.tracks?.length ?? 0,
      spotifyCount: (data.spotify.tracks?.length ?? 0) + (data.spotify.playlists?.length ?? 0),
      youtubeCount: data.youtube?.mixes?.length ?? 0,
      trailDepth,
      fromCache,
    });
  }, []);

  const runSearch = useCallback(
    async (artist, overrides = {}) => {
      const searchId = ++searchSeqRef.current;
      setLoading(true);
      setError(null);

      const resetSelection = overrides.resetSelection ?? false;
      const resetSkips = overrides.resetSkips ?? false;

      if (resetSkips) {
        setSoundcloudSkipped(false);
        setSpotifySkipped(false);
        setProfileSelectionDone(false);
      }

      const opts = {
        soundcloudUserId: resetSelection
          ? overrides.soundcloudUserId ?? null
          : overrides.soundcloudUserId ?? selection.soundcloudUserId,
        spotifyArtistId: resetSelection
          ? overrides.spotifyArtistId ?? null
          : overrides.spotifyArtistId ?? selection.spotifyArtistId,
      };

      const cached = overrides.skipCache
        ? null
        : getCachedSearch(artist, opts.soundcloudUserId, opts.spotifyArtistId);

      if (cached) {
        if (searchId !== searchSeqRef.current) return;

        setResults(cached);

        const resolvedIds = resolveCacheIds(opts.soundcloudUserId, opts.spotifyArtistId, cached);
        if (cached.soundcloud.status !== 'ambiguous') {
          setSelection((s) => ({ ...s, soundcloudUserId: resolvedIds.soundcloudUserId }));
        }
        if (cached.spotify.status !== 'ambiguous') {
          setSelection((s) => ({ ...s, spotifyArtistId: resolvedIds.spotifyArtistId }));
        }

        const trailDepth = overrides.trailDepth ?? trail.length;
        emitSearchCompleted(cached, trailDepth, true);
        setLoading(false);
        setDiscoveringArtist(null);
        return;
      }

      try {
        const data = await searchArtist(artist, opts);
        if (searchId !== searchSeqRef.current) return;

        setResults(data);

        const resolvedIds = resolveCacheIds(opts.soundcloudUserId, opts.spotifyArtistId, data);
        setCachedSearch(artist, resolvedIds.soundcloudUserId, resolvedIds.spotifyArtistId, data);

        if (data.soundcloud.status !== 'ambiguous') {
          setSelection((s) => ({ ...s, soundcloudUserId: resolvedIds.soundcloudUserId }));
        }
        if (data.spotify.status !== 'ambiguous') {
          setSelection((s) => ({ ...s, spotifyArtistId: resolvedIds.spotifyArtistId }));
        }

        const trailDepth = overrides.trailDepth ?? trail.length;
        emitSearchCompleted(data, trailDepth, false);
      } catch (err) {
        if (searchId !== searchSeqRef.current) return;
        setError(err.message);
        setResults(null);
      } finally {
        if (searchId === searchSeqRef.current) {
          setLoading(false);
          setDiscoveringArtist(null);
        }
      }
    },
    [selection.soundcloudUserId, selection.spotifyArtistId, trail.length, emitSearchCompleted]
  );

  const handleDiscoverArtist = (artistName, source = 'repost') => {
    const fromArtist = trail[trail.length - 1] ?? results?.query;
    const nextTrail = trail[trail.length - 1] === artistName ? trail : [...trail, artistName];
    const depth = nextTrail.length;

    setQuery(artistName);
    setSelection({ soundcloudUserId: null, spotifyArtistId: null });
    setSoundcloudSkipped(false);
    setSpotifySkipped(false);
    setProfileSelectionDone(false);
    setDiscoveringArtist(artistName);
    setTrail(nextTrail);

    trackDiscoverArtist({ fromArtist, toArtist: artistName, depth, source });
    trackTrailExtended({ artist: artistName, depth });

    runSearch(artistName, {
      resetSelection: true,
      resetSkips: true,
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
    setSoundcloudSkipped(false);
    setSpotifySkipped(false);
    setProfileSelectionDone(false);
    setTrail(nextTrail);
    runSearch(artistName, {
      resetSelection: true,
      resetSkips: true,
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
    setSoundcloudSkipped(false);
    setSpotifySkipped(false);
    setProfileSelectionDone(false);
    setTrail([trimmed]);
    runSearch(trimmed, {
      resetSelection: true,
      resetSkips: true,
      soundcloudUserId: null,
      spotifyArtistId: null,
      trailDepth: 1,
    });
  };

  const handleSoundCloudPick = (userId) => {
    setSelection((s) => ({ ...s, soundcloudUserId: userId }));
  };

  const handleSpotifyPick = (artistId) => {
    setSelection((s) => ({ ...s, spotifyArtistId: artistId }));
  };

  const handleSoundCloudSkip = () => {
    setSoundcloudSkipped(true);
  };

  const handleSpotifySkip = () => {
    setSpotifySkipped(true);
  };

  const handleProfileContinue = () => {
    setProfileSelectionDone(true);
    const opts = {
      soundcloudUserId: soundcloudSkipped ? null : selection.soundcloudUserId,
      spotifyArtistId: spotifySkipped ? null : selection.spotifyArtistId,
      trailDepth: trail.length,
      skipCache: true,
    };
    runSearch(results.query, opts);
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

  // Section counts for tabs
  const sectionCounts = useMemo(() => ({
    likes: likedTracks.length,
    reposts: repostedTracks.length,
    livesets: youtubeMixes.length,
    discovery: scDiscoveries.length,
    spotify: spotifyPlaylistTracks.length + spotifyPlaylists.length,
  }), [likedTracks.length, repostedTracks.length, youtubeMixes.length, scDiscoveries.length, spotifyPlaylistTracks.length, spotifyPlaylists.length]);

  // Available sections based on content (order: likes, reposts, livesets, spotify, discovery)
  const availableSections = useMemo(() => {
    const sections = [];
    if (likedTracks.length > 0) sections.push('likes');
    if (repostedTracks.length > 0) sections.push('reposts');
    if (youtubeMixes.length > 0 || results?.youtube?.message) sections.push('livesets');
    if (!spotifySkipped && (spotifyPlaylistTracks.length > 0 || spotifyPlaylists.length > 0)) sections.push('spotify');
    if (scDiscoveries.length > 0) sections.push('discovery');
    return sections;
  }, [likedTracks.length, repostedTracks.length, youtubeMixes.length, results?.youtube?.message, scDiscoveries.length, spotifySkipped, spotifyPlaylistTracks.length, spotifyPlaylists.length]);

  // Reset active section when content changes
  useEffect(() => {
    if (availableSections.length > 0 && !availableSections.includes(activeSection)) {
      setActiveSection(availableSections[0]);
    }
  }, [availableSections, activeSection]);

  const soundcloudAmbiguous = results?.soundcloud?.status === 'ambiguous';
  const spotifyAmbiguous = results?.spotify?.status === 'ambiguous';

  // Show combined picker if either platform needs selection and we haven't confirmed yet
  const needsProfileSelection = (soundcloudAmbiguous || spotifyAmbiguous) && !profileSelectionDone;

  // Can show dig content when profile selection is complete
  const canShowDigContent = !needsProfileSelection;

  const showResults = Boolean(results);
  const showHero = !results && !loading;

  return (
    <div className="relative min-h-screen">
      <WaveBackground />

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <header className={`text-center transition-all ${showResults ? 'mb-8' : 'mb-12'}`}>
          {showHero && (
            <p className="label-mono mb-4 text-[var(--color-accent)]">For DJs, producers &amp; music addicts</p>
          )}
          <h1 className={`display-title text-white ${showResults ? 'text-3xl sm:text-4xl' : 'text-5xl sm:text-6xl'}`}>
            Tastemaker
          </h1>
          {showHero && (
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--color-muted)]">
              Discover what your favorite artists actually listen to.
            </p>
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

        {loading && !results && <LoadingState />}

        {error && (
          <div className="mx-auto max-w-xl rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        {showResults && (
          <div ref={resultsRef} className="relative space-y-6 scroll-mt-8">
            {loading && (
              <div
                className="absolute inset-0 z-10 flex justify-center rounded-xl bg-[#0a0a12]/70 pt-12 backdrop-blur-[1px]"
                aria-busy="true"
                aria-live="polite"
              >
                <LoadingState />
              </div>
            )}
            {needsProfileSelection && (
              <ArtistPicker
                combined
                soundcloudArtists={soundcloudAmbiguous ? results.soundcloud.artists : null}
                spotifyArtists={spotifyAmbiguous ? results.spotify.artists : null}
                onSoundCloudSelect={handleSoundCloudPick}
                onSpotifySelect={handleSpotifyPick}
                onSoundCloudSkip={handleSoundCloudSkip}
                onSpotifySkip={handleSpotifySkip}
                soundcloudSelected={selection.soundcloudUserId}
                spotifySelected={selection.spotifyArtistId}
                soundcloudSkipped={soundcloudSkipped}
                spotifySkipped={spotifySkipped}
                onContinue={handleProfileContinue}
              />
            )}

            {canShowDigContent && (
              <>
                <PlatformMessage platform="SoundCloud" result={results.soundcloud} />

                <DigSummary
                  artist={artistLabel}
                  likedCount={likedTracks.length}
                  repostedCount={repostedTracks.length}
                />

                {availableSections.length > 1 && (
                  <SectionTabs
                    activeSection={activeSection}
                    onSectionChange={setActiveSection}
                    sections={availableSections}
                    counts={sectionCounts}
                  />
                )}

                <div className="space-y-4" key={activeSection}>
                  {activeSection === 'likes' && likedTracks.length > 0 && (
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

                  {activeSection === 'reposts' && repostedTracks.length > 0 && (
                    <SoundCloudTracksSection
                      title="Reposts"
                      subtitle="Their repost signal. Where the best rabbit holes start."
                      badge={`${repostedTracks.length} ${repostedTracks.length === 1 ? 'track' : 'tracks'}`}
                      tracks={repostedTracks}
                      startIndex={likedTracks.length}
                      defaultOpen
                      onOutboundClick={handleAnalyticsOutbound}
                      onPreviewPlay={handleAnalyticsPreview}
                    />
                  )}

                  {activeSection === 'livesets' && (youtubeMixes.length > 0 || results.youtube?.message) && (
                    <YouTubeSection
                      mixes={youtubeMixes}
                      message={results.youtube?.message}
                      artistName={artistLabel}
                      onOutboundClick={handleAnalyticsOutbound}
                      onPreviewPlay={handleAnalyticsPreview}
                    />
                  )}

                  {activeSection === 'discovery' && scDiscoveries.length > 0 && (
                    <ScDiscoverySection
                      discoveries={scDiscoveries}
                      sourceArtist={artistLabel}
                      onDiscoverArtist={(name) => handleDiscoverArtist(name, 'repost')}
                      discoveringArtist={discoveringArtist}
                    />
                  )}

                  {activeSection === 'spotify' && !spotifySkipped &&
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

                  {!hasSoundcloudCrate && results.soundcloud.message && availableSections.length === 0 && (
                    <div className="empty-state panel">
                      <div className="empty-state-icon">?</div>
                      <h3 className="empty-state-title">No public activity found</h3>
                      <p className="empty-state-text">
                        {results.soundcloud.message}
                        {scDiscoveries.length > 0 && ' Check the Rabbit Hole tab to discover artists they reposted.'}
                      </p>
                    </div>
                  )}
                </div>

                {!hasSoundcloudCrate && !hasSecondaryContent && !results.soundcloud.message && (
                  <p className="py-12 text-center text-[var(--color-muted)]">
                    No public taste signals found for this artist yet. Try another name or pick a different profile.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {showHero && <HowItWorks />}
      </div>
    </div>
  );
}
