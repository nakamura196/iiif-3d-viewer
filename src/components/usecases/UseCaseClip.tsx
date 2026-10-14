'use client';

// トップのカードの見本。画面に入っている間だけ、短い動画（音なし）をくり返し再生する。
// 動きを減らす設定（prefers-reduced-motion）の人には、動画を再生せずサムネイルだけを見せる。
import { useEffect, useRef } from 'react';

export default function UseCaseClip({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.5 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      width={640}
      height={400}
      className="w-full aspect-[16/10] object-cover bg-[var(--ds-surface-2)]"
    />
  );
}
