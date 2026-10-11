"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import Image from "next/image";

export function ProductFilm() {
  const video = useRef<HTMLVideoElement>(null);
  const manualPause = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let visible = false;
    const update = () => {
      if (visible && !document.hidden && !preference.matches && !connection?.saveData && !manualPause.current) {
        void element.play().catch(() => {});
      } else element.pause();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: 0.25 });
    observer.observe(element);
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); preference.removeEventListener("change", update); document.removeEventListener("visibilitychange", update); element.pause(); };
  }, []);

  function toggle() {
    const element = video.current;
    if (!element) return;
    if (element.paused) {
      manualPause.current = false;
      void element.play().catch(() => {});
    } else { manualPause.current = true; element.pause(); }
  }

  return <div className="product-film">
    <div className="product-film-stage">
    <Image className="product-film-poster" src="/design/product-tour-poster.png" alt="Synthetic JalDrishti Overview preview" width={960} height={640} loading="eager" unoptimized />
    <video ref={video} className="product-film-video" style={{ opacity: hasFrame && !failed ? 1 : 0 }} src={failed ? undefined : "/design/product-tour.mp4"}
      poster="/design/product-tour-poster.png" width={960} height={640} muted playsInline loop preload="none"
      aria-label="Muted synthetic demo walkthrough: Overview and scenario comparisons. Use the interactive Sample Demo for accessible results."
      onLoadStart={() => setHasFrame(false)} onLoadedData={() => setHasFrame(true)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)} />
    </div>
    <div className="product-film-controls"><span>ACTUAL PRODUCT · SYNTHETIC DEMO</span>
      {!failed && <button type="button" onClick={toggle} aria-label={playing ? "Pause product tour" : "Play product tour"}>
        {playing ? <Pause size={15} /> : <Play size={15} />} {playing ? "Pause" : "Play tour"}
      </button>}
      {failed && <span>Tour unavailable · explore the interactive demo</span>}
    </div>
  </div>;
}
