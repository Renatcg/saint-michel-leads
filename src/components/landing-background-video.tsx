"use client";

import { useEffect, useRef } from "react";

type LandingBackgroundVideoProps = {
  videoUrl: string;
  posterUrl?: string;
  fit: "cover" | "contain";
  position: string;
  playbackRate: number;
};

export function LandingBackgroundVideo({ videoUrl, posterUrl, fit, position, playbackRate }: LandingBackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.playbackRate = playbackRate;
    const play = () => {
      void video.play().catch(() => {
        // Autoplay can still be blocked by rare browser settings; the video remains muted and ready.
      });
    };

    play();
    video.addEventListener("canplay", play);
    video.addEventListener("loadeddata", play);

    return () => {
      video.removeEventListener("canplay", play);
      video.removeEventListener("loadeddata", play);
    };
  }, [playbackRate, videoUrl]);

  return (
    <video
      key={videoUrl}
      ref={videoRef}
      className="absolute inset-0 h-full w-full"
      style={{ objectFit: fit, objectPosition: position }}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      poster={posterUrl || undefined}
    >
      <source src={videoUrl} type="video/mp4" />
    </video>
  );
}
