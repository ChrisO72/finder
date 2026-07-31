import { useEffect, useRef } from "react";

export type AudioPlayerHandle = {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  isPlaying: () => boolean;
};

export function AudioPlayer({
  audioUrl,
  initialTime,
  onPlayerRef,
}: {
  audioUrl: string;
  initialTime: number;
  onPlayerRef: (handle: AudioPlayerHandle) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    onPlayerRef({
      seekTo(seconds) {
        audio.currentTime = seconds;
        void audio.play();
      },
      getCurrentTime() {
        return audio.currentTime;
      },
      isPlaying() {
        return !audio.paused && !audio.ended;
      },
    });
  }, [onPlayerRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || initialTime <= 0) return;
    const seek = () => {
      audio.currentTime = initialTime;
    };
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
    else audio.addEventListener("loadedmetadata", seek, { once: true });
    return () => audio.removeEventListener("loadedmetadata", seek);
  }, [initialTime]);

  return (
    <audio ref={audioRef} controls preload="metadata" src={audioUrl} className="h-12 w-full">
      Your browser does not support audio playback.
    </audio>
  );
}
