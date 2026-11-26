'use client';

import React, { useState, useRef, useEffect } from 'react';
import { formatVoiceDuration } from '../lib/chats-state';
import { PlayIcon, PauseIcon, MicIcon } from './icons';

export interface VoiceNotePlayerProps {
  mediaId?: string | null;
  initialUrl?: string | null;
  durationSeconds?: number | null;
  isOwn: boolean;
  onMediaAccessDenied?: () => void;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  mediaId,
  initialUrl,
  durationSeconds,
  isOwn,
  onMediaAccessDenied,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(initialUrl ?? null);
  const [playing, setPlaying] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedDuration, setResolvedDuration] = useState<number>(
    Math.max(1, Number(durationSeconds || 1)),
  );
  const [unavailable, setUnavailable] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (initialUrl) {
      setSrcUrl(initialUrl);
    }
  }, [initialUrl]);

  useEffect(() => {
    if (typeof durationSeconds === 'number' && durationSeconds > 0) {
      setResolvedDuration(durationSeconds);
    }
  }, [durationSeconds]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    };
  }, [mediaId]);

  const resolveStreamUrl = (): string | null => {
    if (mediaId) {
      return `/api/bff/v1/messaging/media/${encodeURIComponent(mediaId)}/stream`;
    }
    return srcUrl;
  };

  const probeMediaAccessOnError = async (urlToCheck: string) => {
    try {
      const probe = await fetch(urlToCheck, {
        method: 'HEAD',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (probe.status === 401) {
        setErrorText('Please sign in again to play voice notes.');
        return;
      }
      if (probe.status === 403 || probe.status === 404) {
        setUnavailable(true);
        setErrorText('Voice note no longer available.');
        onMediaAccessDenied?.();
        return;
      }
      setErrorText('Unable to load audio stream.');
    } catch {
      setErrorText('Unable to reach voice-note stream.');
    }
  };

  const togglePlay = async () => {
    if (unavailable || loadingUrl) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    const activeUrl = resolveStreamUrl();
    if (!activeUrl) {
      setErrorText('Audio playback unavailable.');
      return;
    }

    setErrorText(null);
    setLoadingUrl(true);
    if (!audio.src || !audio.src.includes(activeUrl)) {
      audio.src = activeUrl;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      await probeMediaAccessOnError(activeUrl);
    } finally {
      setLoadingUrl(false);
    }
  };

  const progressPct =
    resolvedDuration > 0
      ? Math.min(100, Math.round((currentTime / resolvedDuration) * 100))
      : 0;

  return (
    <div
      data-testid="voice-note-player"
      className={`flex flex-col gap-1.5 min-w-[210px] sm:min-w-[248px] ${
        isOwn ? 'text-[#0B0D10]' : 'text-chalk'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          disabled={unavailable || loadingUrl}
          aria-label={playing ? 'Pause voice note' : 'Play voice note'}
          className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 transition-colors focus-visible:outline-2 ${
            isOwn
              ? 'bg-[#0B0D10]/15 hover:bg-[#0B0D10]/25 text-[#0B0D10] focus-visible:outline-[#0B0D10]'
              : 'bg-stage border border-edge hover:border-iris text-chalk focus-visible:outline-iris'
          } disabled:opacity-45`}
        >
          {loadingUrl ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : playing ? (
            <PauseIcon size={14} />
          ) : (
            <PlayIcon size={14} />
          )}
        </button>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-[11px] font-medium">
            <span className="inline-flex items-center gap-1">
              <MicIcon size={12} />
              <span>Voice Note</span>
            </span>
            <span className="font-mono text-[10px]">
              {playing || currentTime > 0
                ? `${formatVoiceDuration(currentTime)} / ${formatVoiceDuration(resolvedDuration)}`
                : formatVoiceDuration(resolvedDuration)}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={resolvedDuration}
            step={0.25}
            value={Math.min(currentTime, resolvedDuration)}
            aria-label="Voice note playback progress"
            aria-valuemin={0}
            aria-valuemax={resolvedDuration}
            aria-valuenow={Math.round(currentTime)}
            onChange={(e) => {
              const nextSec = Number(e.target.value);
              setCurrentTime(nextSec);
              if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
                audioRef.current.currentTime = nextSec;
              }
            }}
            className="w-full h-1.5 cursor-pointer accent-current"
            style={{ accentColor: isOwn ? '#0B0D10' : '#8580C4' }}
          />
          <div className="sr-only">{progressPct}% played</div>
        </div>
      </div>

      {errorText && (
        <span
          role="status"
          className={`text-[11px] ${
            isOwn ? 'text-[#4B1118]' : 'text-danger'
          }`}
        >
          {errorText}
        </span>
      )}

      <audio
        ref={audioRef}
        preload="none"
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration;
          if (d && Number.isFinite(d) && d > 0) {
            setResolvedDuration(Math.max(1, Math.round(d)));
          }
        }}
        onTimeUpdate={() => {
          setCurrentTime(audioRef.current?.currentTime || 0);
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => {
          setPlaying(false);
          const urlToCheck = resolveStreamUrl();
          if (urlToCheck && !unavailable) {
            void probeMediaAccessOnError(urlToCheck);
          }
        }}
      />
    </div>
  );
};
