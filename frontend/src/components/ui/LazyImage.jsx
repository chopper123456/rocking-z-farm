import { useState } from 'react';

/**
 * Image with lazy loading and optional placeholder.
 */
export default function LazyImage({ src, alt, className, ...props }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && (
        <div
          className={`lazy-image-placeholder ${className || ''}`}
          aria-hidden
          style={{ minHeight: 80, background: '#e8e8e8', borderRadius: 8 }}
        />
      )}
      <img
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        className={className}
        onLoad={() => setLoaded(true)}
        style={{ display: loaded ? undefined : 'none' }}
        {...props}
      />
    </>
  );
}
