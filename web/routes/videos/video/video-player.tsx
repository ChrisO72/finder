import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    YT: { Player: new (...args: any[]) => any };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface VideoPlayerProps {
  youtubeVideoId: string;
  initialTime: number;
  onReady?: () => void;
  onPlayerRef?: (ref: VideoPlayerHandle) => void;
}

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
}

export function VideoPlayer({
  youtubeVideoId,
  initialTime,
  onReady,
  onPlayerRef,
}: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.YT?.Player) {
      createPlayer();
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => createPlayer();

    return () => {
      window.onYouTubeIframeAPIReady = undefined;
    };
  }, []);

  function createPlayer() {
    if (playerRef.current) return;
    playerRef.current = new window.YT.Player("yt-player", {
      width: "100%",
      height: "100%",
      videoId: youtubeVideoId,
      playerVars: {
        autoplay: 0,
        start: initialTime || undefined,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: () => {
          setReady(true);
          onReady?.();
        },
      },
    });
  }

  useEffect(() => {
    if (!ready || !playerRef.current) return;
    const handle: VideoPlayerHandle = {
      seekTo: (seconds: number) => {
        playerRef.current?.seekTo(seconds, true);
        playerRef.current?.playVideo();
      },
      getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
      getPlayerState: () => playerRef.current?.getPlayerState?.() ?? -1,
    };
    onPlayerRef?.(handle);
  }, [ready, onPlayerRef]);

  useEffect(() => {
    if (ready && initialTime > 0) {
      playerRef.current?.seekTo(initialTime, true);
      playerRef.current?.playVideo();
    }
  }, [ready, initialTime]);

  return (
    <div className="relative min-h-[360px] w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16/9" }}>
      <div id="yt-player" className="absolute inset-0 h-full w-full" />
    </div>
  );
}
