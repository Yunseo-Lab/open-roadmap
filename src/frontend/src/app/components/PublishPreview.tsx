import { useState } from 'react';
import { X, Share2, ExternalLink } from 'lucide-react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { graphNodeTypes } from '../graph/nodeTypes';
import type { GraphEdge, GraphNode } from '../graph/types';
import { ShareRoadmapDialog } from './ShareRoadmapDialog';

interface PublishPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: () => Promise<string | null>;
  nodes: GraphNode[];
  edges: GraphEdge[];
  title: string;
  slug: string;
  summary?: string;
  publishing: boolean;
  publishError: string | null;
}

export function PublishPreview({
  isOpen,
  onClose,
  onPublish,
  nodes,
  edges,
  title,
  slug,
  summary,
  publishing,
  publishError,
}: PublishPreviewProps) {
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  if (!isOpen) return null;
  const shareUrl = `${window.location.origin}/r/${slug}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span>Preview</span>
              <span>•</span>
              <span className="text-foreground">loadmap.io/r/{slug}</span>
            </div>
            <h2 className="text-xl">{title || 'Untitled Roadmap'}</h2>
            {summary && (
              <p className="text-sm text-muted-foreground mt-1">{summary}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsShareDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              onClick={onPublish}
              disabled={publishing}
              className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ExternalLink className="w-4 h-4" />
              {publishing ? 'Publishing' : 'Publish Now'}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <ShareRoadmapDialog
          open={isShareDialogOpen}
          url={shareUrl}
          onOpenChange={setIsShareDialogOpen}
        />

        {/* Graph Preview */}
        <div className="flex-1 bg-accent/20 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={graphNodeTypes}
            fitView
            minZoom={0.5}
            maxZoom={1.5}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={true}
            zoomOnScroll={true}
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'objective': return '#3b82f6';
                  case 'milestone': return '#8b5cf6';
                  case 'event': return '#ec4899';
                  case 'artifact': return '#10b981';
                  default: return '#94a3b8';
                }
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          </ReactFlow>
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3 border-t border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{nodes.length} nodes • {edges.length} connections</span>
            <span className={publishError ? 'text-destructive' : ''}>
              {publishError || 'This is how your roadmap will appear to others'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
