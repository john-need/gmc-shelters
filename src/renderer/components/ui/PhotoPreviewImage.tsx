import { useState } from 'react';

interface Props {
  src: string;
  alt: string;
  fallback: string;
  onLoad?: (img: HTMLImageElement) => void;
}

export default function PhotoPreviewImage({ src, alt, fallback, onLoad }: Props) {
  const [imgError, setImgError] = useState(false);
  return imgError ? (
    <span className="glyph">{fallback}</span>
  ) : (
    <img
      src={src}
      alt={alt}
      onLoad={(e) => onLoad?.(e.currentTarget)}
      onError={() => setImgError(true)}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
}
