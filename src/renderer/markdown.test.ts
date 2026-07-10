import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('returns an empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('renders headings h1-h3', () => {
    expect(renderMarkdown('# One\n## Two\n### Three')).toBe('<h1>One</h1>\n<h2>Two</h2>\n<h3>Three</h3>');
  });

  it('renders a horizontal rule', () => {
    expect(renderMarkdown('---')).toBe('<hr/>');
  });

  it('renders a blockquote', () => {
    expect(renderMarkdown('> quoted text')).toBe('<blockquote><p>quoted text</p></blockquote>');
  });

  it('renders a bulleted list', () => {
    expect(renderMarkdown('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>');
  });

  it('renders a numbered list', () => {
    expect(renderMarkdown('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>');
  });

  it('renders a paragraph with bold, italic, inline code, and a link', () => {
    expect(renderMarkdown('**bold** *italic* `code` [text](url)')).toBe(
      '<p><strong>bold</strong> <em>italic</em> <code>code</code> <a href="url">text</a></p>',
    );
  });

  it('escapes HTML-significant characters', () => {
    expect(renderMarkdown('<script>alert(1)</script> & more')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; more</p>');
  });
});
