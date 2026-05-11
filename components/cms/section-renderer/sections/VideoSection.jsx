/**
 * VideoSection — Phase E (2026-05-10)
 *
 * Showcase a single video with optional headline + description. Embeds
 * an autoplay-muted-loop element by default; clicking the play overlay
 * unmutes and resumes from the start.
 *
 * Expected blocks:
 *   { type: 'video',         content: { src, thumbnail, duration } }
 *   { type: 'section_title', content: { title: i18n, subtitle: i18n } }   // optional
 */

'use client';

import { useRef, useState } from 'react';
import { findBlock, pickI18n } from '../blocks.js';

export default function VideoSection({ section, locale = 'en' }) {
  const titleBlock = findBlock(section, 'section_title');
  const videoBlock = findBlock(section, 'video');
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted]     = useState(true);

  if (!videoBlock?.content?.src) return null;

  const title = pickI18n(titleBlock?.content?.title, locale);
  const subtitle = pickI18n(titleBlock?.content?.subtitle, locale);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.muted = false; setMuted(false); v.play(); setPlaying(true); }
  };

  return (
    <section className="w-full py-14 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        {(title || subtitle) ? (
          <div className="text-center mb-8">
            {title ? <h2 className="text-3xl md:text-4xl font-open-sauce-bold text-[#26472B] mb-2">{title}</h2> : null}
            {subtitle ? <p className="text-base text-[#636363]">{subtitle}</p> : null}
          </div>
        ) : null}

        <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-xl">
          <video
            ref={videoRef}
            src={videoBlock.content.src}
            poster={videoBlock.content.thumbnail}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onClick={togglePlay}
          />
          {muted ? (
            <button
              type="button"
              onClick={togglePlay}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-full font-open-sauce-semibold backdrop-blur-sm"
            >
              Tap to unmute
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
