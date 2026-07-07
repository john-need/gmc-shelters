import { useState, useEffect, useRef } from 'react';

export interface QuoteBlockProps {
  // Plain text is escaped by React; html is raw markup (e.g. FTS5 <mark> snippets) and must
  // already be safe to inject.
  text?: string;
  html?: string;
}

export default function QuoteBlock({ text, html }: QuoteBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, html, expanded]);

  return (
    <div className="source-quote-wrap" onClick={(e) => e.stopPropagation()}>
      {html !== undefined ? (
        <div
          ref={ref}
          className={`source-quote${expanded ? ' expanded' : ''}`}
          dangerouslySetInnerHTML={{ __html: `“${html}”` }}
        />
      ) : (
        <div ref={ref} className={`source-quote${expanded ? ' expanded' : ''}`}>
          &ldquo;{text}&rdquo;
        </div>
      )}
      {overflows && (
        <button className="source-quote-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'show less' : 'show more'}
        </button>
      )}
    </div>
  );
}
