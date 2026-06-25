import { useEffect, useRef, useState } from 'react';
import { usePreviewContext } from '../context/PreviewContext';

export default function SoundCloudPreview({
  trackId,
  maxDuration = 30,
  attribution,
  onPreviewPlay,
  compact = false,
}) {
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [durationLimit, setDurationLimit] = useState(maxDuration);
  const { registerPlay, registerStop } = usePreviewContext();

  useEffect(() => {
    setDurationLimit(maxDuration);
    setProgress(0);
    setPlaying(false);
    setError(null);
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
    setPlaying(false);
    setProgress(0);
    registerStop(trackId);
  };

  const handlePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      stopPlayback();
      return;
    }

    setError(null);
    registerPlay(trackId, stopPlayback);

    try {
      const response = await fetch(
        `/api/soundcloud/preview?trackId=${encodeURIComponent(trackId)}`
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Preview unavailable for this track.');
      }

      const headerDuration = Number(response.headers.get('X-Preview-Max-Duration'));
      if (Number.isFinite(headerDuration) && headerDuration > 0) {
        setDurationLimit(headerDuration);
      }

      const blob = await response.blob();
      if (!blob.size || (!blob.type.includes('audio') && !blob.type.includes('mpeg'))) {
        throw new Error('Preview unavailable for this track.');
      }

      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }

      blobUrlRef.current = URL.createObjectURL(blob);
      audio.src = blobUrlRef.current;
      await audio.play();
      setPlaying(true);
      onPreviewPlay?.();
    } catch (err) {
      setError(err.message || 'Preview unavailable for this track.');
      setPlaying(false);
      registerStop(trackId);
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
      setPlaying(false);
      setProgress(0);
      registerStop(trackId);
    }
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
    registerStop(trackId);
  };

  const labelSeconds = durationLimit;

  return (
    <div className={compact ? 'dig-card-preview' : 'space-y-2'}>
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={() => {
          setError('Preview unavailable for this track.');
          setPlaying(false);
          registerStop(trackId);
        }}
      />

      <button
        type="button"
        onClick={handlePlay}
        className={compact ? 'dig-card-play' : 'btn-ghost w-full gap-2 py-2.5 text-[var(--color-accent)]'}
      >
        {playing ? 'Stop' : compact ? `▶ ${labelSeconds}s` : `▶ Preview ${labelSeconds}s`}
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
