import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './AIChat';

describe('AI chat markdown content', () => {
  it('renders common markdown blocks and inline marks', () => {
    const html = renderToStaticMarkup(
      <MarkdownContent
        content={[
          '# Result',
          '',
          '- **Created** node',
          '- [Docs](https://example.com)',
          '',
          '`commit_graph` is internal',
        ].join('\n')}
      />,
    );

    expect(html).toContain('Result');
    expect(html).toContain('<ul');
    expect(html).toContain('<strong');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('<code');
  });
});
