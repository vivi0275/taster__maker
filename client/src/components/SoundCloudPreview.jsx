import { useEffect, useRef, useState } from 'react';
import { usePreviewContext } from '../context/PreviewContext';

const PREVIEW_MAX_SECONDS = 30;

export default function SoundCloudPreview({
  trackId,
  maxDuration = PREVIEW_MAX_SECONDS,
  attribution,
  onPreviewPlay,
  compact = false,
}) {
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [durationLimit, setDurationLimit] = useState(
    Math.min(maxDuration, PREVIEW_MAX_SECONDS)
  );
  const { registerPlay, registerStop } = usePreviewContext();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const capped = Math.min(maxDuration, PREVIEW_MAX_SECONDS);
    setDurationLimit(capped);
    setProgress(0);
    setPlaying(false);
    setLoading(false);
    setError(null);
    loadingRef.current = false;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
  }, [trackId, maxDuration]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleStop = (e) => {
      if (e.detail?.trackId === trackId) {
        audioRef.current?.pause();
        setPlaying(false);
        setProgress(0);
      }
    };

    window.addEventListener('tastemaker:preview-stop', handleStop);
    return () => {
      window.removeEventListener('tastemaker:preview-stop', handleStop);
      audioRef.current?.pause();
      registerStop(trackId);
    };
  }, [trackId, registerStop]);

  const stopPlayback = () => {
    audioRef.current?.pause();
    if (mountedRef.current) {
      setPlaying(false);
      setProgress(0);
    }
    registerStop(trackId);
  };

  const handlePlay = async () => {
    const audio = audioRef.current;
    if (!audio || loadingRef.current) return;

    if (playing) {
      stopPlayback();
      return;
    }

    if (mountedRef.current) {
      setError(null);
      setLoading(true);
    }
    loadingRef.current = true;
    registerPlay(trackId, stopPlayback);

    try {
      const response = await fetch(
        `/api/soundcloud/preview?trackId=${encodeURIComponent(trackId)}`
      );

      if (!mountedRef.current) return;

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Preview unavailable for this track.');
      }

      const headerDuration = Number(response.headers.get('X-Preview-Max-Duration'));
      const cappedDuration = Number.isFinite(headerDuration) && headerDuration > 0
        ? Math.min(headerDuration, PREVIEW_MAX_SECONDS)
        : Math.min(maxDuration, PREVIEW_MAX_SECONDS);

      if (mountedRef.current) {
        setDurationLimit(cappedDuration);
      }

      const blob = await response.blob();
      if (!mountedRef.current) return;

      if (!blob.size || (!blob.type.includes('audio') && !blob.type.includes('mpeg'))) {
        throw new Error('Preview unavailable for this track.');
      }

      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }

      blobUrlRef.current = URL.createObjectURL(blob);
      audio.src = blobUrlRef.current;
      await audio.play();

      if (!mountedRef.current) {
        audio.pause();
        return;
      }

      setPlaying(true);
      onPreviewPlay?.();
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Preview unavailable for this track.');
        setPlaying(false);
      }
      registerStop(trackId);
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const pct = Math.min((audio.currentTime / durationLimit) * 100, 100);
    setProgress(pct);

    if (audio.currentTime >= durationLimit) {
      audio.pause();
      audio.currentTime = 0;
      if (mountedRef.current) {
        setPlaying(false);
        setProgress(0);
      }
      registerStop(trackId);
    }
  };

  const handleEnded = () => {
    if (mountedRef.current) {
      setPlaying(false);
      setProgress(0);
    }
    registerStop(trackId);
  };

  const labelSeconds = durationLimit;
  const playLabel = playing
    ? 'Stop'
    : loading
      ? 'Loading…'
      : compact
        ? `▶ ${labelSeconds}s`
        : `▶ Preview ${labelSeconds}s`;

  return (
    <div className={compact ? 'dig-card-preview' : 'space-y-2'}>
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={() => {
          if (mountedRef.current) {
            setError('Preview unavailable for this track.');
            setPlaying(false);
          }
          registerStop(trackId);
        }}
      />

      <button
        type="button"
        onClick={handlePlay}
        disabled={loading}
        className={
          compact
            ? 'dig-card-play disabled:opacity-50'
            : 'btn-ghost w-full gap-2 py-2.5 text-[var(--color-accent)] disabled:opacity-50'
        }
      >
        {playLabel}
      </button>

      {(playing || progress > 0) && (
        <div className={`overflow-hidden rounded-sm bg-white/10 ${compact ? 'h-px' : 'h-0.5'}`}>
          <div
            className="h-full bg-[var(--color-accent)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {!compact && (
        <p className="label-mono text-[var(--color-muted)]/60 normal-case tracking-normal">
          {attribution} · session only
        </p>
      )}

      {error && <p className="text-xs text-amber-300/80">{error}</p>}
    </div>
  );
}
