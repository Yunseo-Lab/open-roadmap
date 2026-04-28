import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock3,
  FileSearch,
  GitCommit,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import type { AgentOperation, AgentResponse } from '../../types';
import type { AgentStreamHandlers } from '../../lib/api';

type RunStatus = 'running' | 'completed' | 'error';

type TranscriptRun = {
  id: string;
  userMessage: string;
  createdAt: number;
  status: RunStatus;
  statusMessages: string[];
  operations: AgentOperation[];
  summary: string | null;
  error: string | null;
  responseType?: AgentResponse['responseType'];
  committed?: boolean;
};

interface AIChatProps {
  isOpen: boolean;
  disabled?: boolean;
  onSend?: (message: string, handlers: AgentStreamHandlers) => Promise<AgentResponse>;
}

export function AIChat({ isOpen, disabled = false, onSend }: AIChatProps) {
  const [input, setInput] = useState('');
  const [runs, setRuns] = useState<TranscriptRun[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const transcriptBodyRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const previousRunCountRef = useRef(0);

  useEffect(() => {
    const runWasAdded = runs.length > previousRunCountRef.current;
    previousRunCountRef.current = runs.length;

    if (runWasAdded) {
      shouldAutoScrollRef.current = true;
    }

    if (runWasAdded || shouldAutoScrollRef.current) {
      endRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [runs]);

  const updateAutoScrollPreference = () => {
    const body = transcriptBodyRef.current;
    if (!body) {
      shouldAutoScrollRef.current = true;
      return;
    }

    shouldAutoScrollRef.current = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
  };

  const handleSend = async () => {
    const message = input.trim();
    if (!message || disabled || isSending || !onSend) return;

    const runId = crypto.randomUUID();
    setInput('');
    setIsCollapsed(false);
    setIsSending(true);
    setRuns((current) => [
      ...current,
      {
        id: runId,
        userMessage: message,
        createdAt: Date.now(),
        status: 'running',
        statusMessages: ['Queued agent run.'],
        operations: [],
        summary: null,
        error: null,
      },
    ]);

    const handlers: AgentStreamHandlers = {
      onStatus: (statusMessage) => {
        updateRun(runId, (run) => ({
          ...run,
          statusMessages: appendStatus(run.statusMessages, statusMessage),
        }));
      },
      onOperation: (operation) => {
        updateRun(runId, (run) => ({
          ...run,
          operations: mergeOperations(run.operations, [operation]),
        }));
      },
      onError: (message) => {
        updateRun(runId, (run) => ({
          ...run,
          status: 'error',
          error: message,
        }));
      },
    };

    try {
      const result = await onSend(message, handlers);
      updateRun(runId, (run) => ({
        ...run,
        status: 'completed',
        operations: mergeOperations(run.operations, result.operations),
        summary: result.summary,
        responseType: result.responseType,
        committed: result.committed,
      }));
    } catch (sendError) {
      updateRun(runId, (run) => ({
        ...run,
        status: 'error',
        error: sendError instanceof Error ? sendError.message : 'Unable to run the agent.',
      }));
    } finally {
      setIsSending(false);
    }
  };

  const updateRun = (runId: string, updater: (run: TranscriptRun) => TranscriptRun) => {
    setRuns((current) => current.map((run) => (run.id === runId ? updater(run) : run)));
  };

  if (!isOpen) return null;

  const runningCount = runs.filter((run) => run.status === 'running').length;
  const shouldShowTranscript = runs.length > 0 || isSending;

  return (
    <>
      {shouldShowTranscript && isCollapsed && (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="fixed bottom-4 left-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-md border border-border bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur-sm"
        >
          <Bot className="size-4" />
          <span>Agent history</span>
          {runningCount > 0 && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <ChevronUp className="size-4 text-muted-foreground" />
        </button>
      )}

      {shouldShowTranscript && !isCollapsed && (
        <section className="fixed bottom-4 left-4 z-40 flex max-h-[calc(100vh-2rem)] w-[min(380px,calc(100vw-2rem))] min-h-0 flex-col overflow-hidden rounded-md border border-border bg-background/95 shadow-2xl backdrop-blur-sm lg:max-h-[680px]">
          <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-medium">Agent history</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {isSending ? 'Running' : `${runs.length} run${runs.length === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Clear transcript"
                disabled={!runs.length || isSending}
                onClick={() => setRuns([])}
                className="size-8"
              >
                <Trash2 className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Collapse agent history"
                onClick={() => setIsCollapsed(true)}
                className="size-8"
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
          </header>

          <div
            ref={transcriptBodyRef}
            onScroll={updateAutoScrollPreference}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div className="max-w-full space-y-3 p-3">
              {runs.map((run) => <RunCard key={run.id} run={run} />)}
              <div ref={endRef} />
            </div>
          </div>
        </section>
      )}

      <form
        className="fixed bottom-4 left-1/2 z-50 w-full max-w-xl -translate-x-1/2 px-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSend();
        }}
      >
        <div className="rounded-full border border-border bg-background/95 px-3 py-2 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex-shrink-0 rounded-full p-1.5 transition-colors hover:bg-accent disabled:opacity-40"
              title="Add new node"
              disabled={disabled || isSending}
            >
              <Plus className="size-4" />
            </button>
            <button
              type="button"
              className="flex-shrink-0 rounded-full p-1.5 transition-colors hover:bg-accent disabled:opacity-40"
              title="Attach file"
              disabled={disabled || isSending}
            >
              <Paperclip className="size-4" />
            </button>
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Describe your goal or generate a roadmap..."
                disabled={disabled || isSending}
                className="w-full border-none bg-transparent px-3 py-1.5 text-sm focus:outline-none disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || disabled || isSending || !onSend}
              className="flex-shrink-0 rounded-full bg-foreground p-1.5 text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              title={isSending ? 'Running agent' : 'Send'}
            >
              {isSending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function RunCard({ run }: { run: TranscriptRun }) {
  const latestStatus = run.statusMessages[run.statusMessages.length - 1];

  return (
    <article className="overflow-hidden rounded-md border border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>User</span>
          <span>{formatTime(run.createdAt)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm">{run.userMessage}</p>
      </div>

      <div className="space-y-3 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {statusIcon(run.status)}
            <span>{run.status === 'running' ? latestStatus : run.status}</span>
          </div>
          <RunBadge run={run} />
        </div>

        {run.operations.length > 0 && <ToolTimeline operations={run.operations} />}

        {run.status === 'running' && run.operations.length === 0 && (
          <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            <span>{latestStatus}</span>
          </div>
        )}

        {run.summary && (
          <div className="rounded-md bg-muted/60 px-3 py-2 text-sm leading-relaxed">
            <MarkdownContent content={run.summary} />
          </div>
        )}

        {run.error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {run.error}
          </div>
        )}
      </div>
    </article>
  );
}

export function MarkdownContent({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += index < lines.length ? 1 : 0;
      blocks.push(
        <pre key={`code-${index}`} className="my-2 max-w-full overflow-auto rounded bg-background p-2 text-[11px] leading-relaxed text-foreground">
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const className = level <= 2 ? 'mt-3 text-sm font-medium' : 'mt-2 text-xs font-medium';
      blocks.push(
        <div key={`heading-${index}`} className={cn(className, 'break-words first:mt-0')}>
          {renderInlineMarkdown(heading[2], `heading-${index}`)}
        </div>,
      );
      index += 1;
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push(<div key={`hr-${index}`} className="my-3 border-t border-border" />);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`} className="my-2 list-disc space-y-1 pl-4">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className="break-words">
              {renderInlineMarkdown(item, `ul-${index}-${itemIndex}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`} className="my-2 list-decimal space-y-1 pl-4">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className="break-words">
              {renderInlineMarkdown(item, `ol-${index}-${itemIndex}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${index}`} className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
          {quoteLines.map((quote, quoteIndex) => (
            <p key={`${quote}-${quoteIndex}`} className="break-words">
              {renderInlineMarkdown(quote, `quote-${index}-${quoteIndex}`)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim() && !isMarkdownBlockStart(lines[index].trim())) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push(
      <p key={`p-${index}`} className="my-2 break-words first:mt-0 last:mb-0">
        {renderInlineMarkdown(paragraphLines.join(' '), `p-${index}`)}
      </p>,
    );
  }

  return <div className="max-w-full text-sm leading-relaxed">{blocks}</div>;
}

function isMarkdownBlockStart(line: string): boolean {
  return (
    line.startsWith('```') ||
    /^(#{1,4})\s+/.test(line) ||
    /^[-*_]{3,}$/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^>\s?/.test(line)
  );
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${match.index}`}
          href={match[3]}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {match[2]}
        </a>,
      );
    } else if (match[4]) {
      nodes.push(
        <code key={`${keyPrefix}-code-${match.index}`} className="rounded bg-background px-1 py-0.5 text-[0.92em]">
          {match[4]}
        </code>,
      );
    } else if (match[5]) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${match.index}`} className="font-medium">
          {match[5]}
        </strong>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function ToolTimeline({ operations }: { operations: AgentOperation[] }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Tool calls</div>
      <div className="space-y-1.5">
        {operations.map((operation, index) => (
          <OperationRow key={operation.id || `${operation.tool}-${index}`} operation={operation} />
        ))}
      </div>
    </div>
  );
}

function OperationRow({ operation }: { operation: AgentOperation }) {
  const hasDetails = Object.keys(operation.args || {}).length > 0 || Object.keys(operation.result || {}).length > 0;

  return (
    <div
      className={cn(
        'max-w-full overflow-hidden rounded-md border px-2.5 py-2 text-xs',
        operation.status === 'error' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-background/70',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 text-muted-foreground">{toolIcon(operation)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <code className="truncate text-[11px] font-medium">{operation.tool}</code>
            <span className={cn('rounded px-1.5 py-0.5 text-[10px]', statusClass(operation.status))}>
              {operation.status || 'success'}
            </span>
          </div>
          <p className="mt-1 break-words text-muted-foreground">{operationSummary(operation)}</p>
          {hasDetails && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                Details
              </summary>
              <pre className="mt-2 max-h-40 max-w-full overflow-auto rounded bg-muted p-2 text-[11px] leading-relaxed text-muted-foreground">
                {JSON.stringify({ args: operation.args, result: operation.result }, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function RunBadge({ run }: { run: TranscriptRun }) {
  if (run.status === 'error') {
    return <span className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">error</span>;
  }
  if (run.status === 'running') {
    return <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">live</span>;
  }
  if (run.committed) {
    return <span className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">committed</span>;
  }
  return <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{run.responseType || 'answer'}</span>;
}

function statusIcon(status: RunStatus) {
  if (status === 'running') return <Loader2 className="size-3.5 animate-spin" />;
  if (status === 'completed') return <CheckCircle2 className="size-3.5" />;
  return <XCircle className="size-3.5" />;
}

function toolIcon(operation: AgentOperation) {
  if (operation.status === 'error') return <CircleAlert className="size-3.5 text-destructive" />;
  if (operation.tool.includes('search')) return <Search className="size-3.5" />;
  if (operation.tool.includes('read')) return <FileSearch className="size-3.5" />;
  if (operation.tool.includes('commit')) return <GitCommit className="size-3.5" />;
  if (operation.tool.includes('delete')) return <Trash2 className="size-3.5" />;
  if (!operation.completedAt) return <Clock3 className="size-3.5" />;
  return <Wrench className="size-3.5" />;
}

function statusClass(status: AgentOperation['status']) {
  if (status === 'error') return 'bg-destructive/10 text-destructive';
  if (status === 'approval_required') return 'bg-secondary text-secondary-foreground';
  if (status === 'skipped') return 'bg-muted text-muted-foreground';
  return 'bg-primary/10 text-primary';
}

function operationSummary(operation: AgentOperation): string {
  const result = operation.result || {};
  if (typeof result.error === 'string') return result.error;

  if (operation.tool === 'read_graph') {
    const graph = recordField(result, 'graph');
    const nodeCount = numberField(graph, 'nodeCount');
    const edgeCount = numberField(graph, 'edgeCount');
    return `Read graph context${nodeCount !== null ? `: ${nodeCount} nodes` : ''}${edgeCount !== null ? `, ${edgeCount} edges` : ''}.`;
  }
  if (operation.tool === 'search_graph') {
    const matches = recordField(result, 'matches');
    const nodes = arrayField(matches, 'nodes');
    return `Searched graph context and found ${nodes.length} matching node${nodes.length === 1 ? '' : 's'}.`;
  }
  if (operation.tool === 'start_graph_draft') {
    const nodeCount = numberField(result, 'nodeCount');
    const edgeCount = numberField(result, 'edgeCount');
    return `Started graph draft${nodeCount !== null ? ` with ${nodeCount} nodes` : ''}${edgeCount !== null ? ` and ${edgeCount} edges` : ''}.`;
  }
  if (operation.tool === 'scaffold_graph_from_objective') {
    const nodeCount = numberField(result, 'nodeCount');
    const edgeCount = numberField(result, 'edgeCount');
    return `Scaffolded graph draft${nodeCount !== null ? ` with ${nodeCount} nodes` : ''}${edgeCount !== null ? ` and ${edgeCount} edges` : ''}.`;
  }
  if (operation.tool === 'create_node') {
    return `Created node ${stringField(result, 'nodeId') || stringField(result, 'id') || ''}`.trim();
  }
  if (operation.tool === 'create_edge') {
    return `Created edge ${stringField(result, 'edgeId') || stringField(result, 'id') || ''}`.trim();
  }
  if (operation.tool === 'delete_node') {
    const deletedEdgeCount = numberField(result, 'deletedEdgeCount');
    const deletedEdgeIds = arrayField(result, 'deletedEdgeIds');
    const edgeCount = deletedEdgeCount ?? deletedEdgeIds.length;
    return `Deleted node ${stringField(result, 'nodeId') || stringField(result, 'id') || ''} and ${edgeCount} connected edge${edgeCount === 1 ? '' : 's'}.`.trim();
  }
  if (operation.tool === 'delete_edge') {
    return `Deleted edge ${stringField(result, 'edgeId') || stringField(result, 'id') || ''}`.trim();
  }
  if (operation.tool === 'clear_graph') {
    const deletedNodeCount = numberField(result, 'deletedNodeCount') ?? 0;
    const deletedEdgeCount = numberField(result, 'deletedEdgeCount') ?? 0;
    return `Cleared graph: deleted ${deletedNodeCount} node${deletedNodeCount === 1 ? '' : 's'} and ${deletedEdgeCount} edge${deletedEdgeCount === 1 ? '' : 's'}.`;
  }
  if (operation.tool === 'validate_graph') {
    const validation = recordField(result, 'validation');
    const ok = booleanField(validation, 'ok');
    return ok === false ? 'Graph validation found issues.' : 'Graph validation passed.';
  }
  if (operation.tool === 'commit_graph') {
    return 'Committed the validated graph draft.';
  }

  return typeof result.ok === 'boolean' ? (result.ok ? 'Tool completed.' : 'Tool returned an issue.') : 'Tool completed.';
}

function appendStatus(messages: string[], message: string): string[] {
  if (!message || messages[messages.length - 1] === message) return messages;
  return [...messages.slice(-4), message];
}

function mergeOperations(current: AgentOperation[], incoming: AgentOperation[]): AgentOperation[] {
  const merged = [...current];
  for (const operation of incoming) {
    const existingIndex = operation.id ? merged.findIndex((candidate) => candidate.id === operation.id) : -1;
    if (existingIndex >= 0) {
      merged[existingIndex] = operation;
    } else {
      merged.push(operation);
    }
  }
  return merged;
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function recordField(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arrayField(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function numberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' ? value : null;
}

function booleanField(record: Record<string, unknown>, key: string): boolean | null {
  const value = record[key];
  return typeof value === 'boolean' ? value : null;
}
