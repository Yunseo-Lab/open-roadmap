import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent, runsFromConversationMessages } from './AIChat';

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

  it('rehydrates persisted messages into transcript runs', () => {
    const runs = runsFromConversationMessages([
      {
        id: 'message-1',
        role: 'user',
        content: 'Add a milestone',
        metadata: {},
        createdAt: 1,
      },
      {
        id: 'message-2',
        role: 'assistant',
        content: 'Added it.',
        metadata: {
          operations: [{ tool: 'create_node', args: {}, result: { nodeId: 'node-1' } }],
          responseType: 'graph_update',
          committed: true,
        },
        createdAt: 2,
      },
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      userMessage: 'Add a milestone',
      summary: 'Added it.',
      responseType: 'graph_update',
      committed: true,
    });
    expect(runs[0].operations[0]?.tool).toBe('create_node');
  });

  it('marks user-only persisted messages as running', () => {
    const runs = runsFromConversationMessages([
      {
        id: 'message-1',
        role: 'user',
        content: 'Continue this chat',
        metadata: {},
        createdAt: 1,
      },
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      status: 'running',
      summary: null,
      statusMessages: ['Waiting for assistant response.'],
    });
  });
});
