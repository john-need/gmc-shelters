import { useEffect, useState } from 'react';

interface Props {
  src: string;
  alt: string;
  fallback: string;
  onLoad?: (img: HTMLImageElement) => void;
}

export default function PhotoPreviewImage({ src, alt, fallback, onLoad }: Props) {
  const [imgError, setImgError] = useState(false);
  const [current, setCurrent] = useState(src);
  const [previous, setPrevious] = useState<string | null>(null);

  useEffect(() => {
    if (src === current) return;
    setPrevious(current);
    setCurrent(src);
    setImgError(false);
  }, [src, current]);

  if (imgError) return <span className="glyph">{fallback}</span>;

  return (
    <>
      {previous && (
        <img
          src={previous}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
        />
      )}
      <img
        key={current}
        src={current}
        alt={alt}
        onLoad={(e) => onLoad?.(e.currentTarget)}
        onError={() => setImgError(true)}
        onAnimationEnd={() => setPrevious(null)}
        className={previous ? 'photo-preview-fade-in' : undefined}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </>
  );
}
