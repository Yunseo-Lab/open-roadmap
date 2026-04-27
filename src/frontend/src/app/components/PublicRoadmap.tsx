import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, ExternalLink, FileText, Share2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { Artifact, PublicProfile, Roadmap } from '../../types';
import { toWorkspaceEdge, toWorkspaceNode } from '../graph/adapter';
import { graphNodeTypes } from '../graph/nodeTypes';
import type { GraphEdge, GraphNode } from '../graph/types';
import { FullScreenMessage } from './FullScreenMessage';
import { ShareRoadmapDialog } from './ShareRoadmapDialog';

export function PublicRoadmap() {
  const { slug = '' } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  useEffect(() => {
    if (!slug) {
      setError('Roadmap slug is required.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    api
      .getPublicRoadmap(slug)
      .then((data) => {
        if (!isMounted) {
          return;
        }
        setProfile(data.profile);
        setRoadmap(data.roadmap);
        setNodes(data.graph.nodes.map(toWorkspaceNode));
        setEdges(data.graph.edges.map(toWorkspaceEdge));
        setArtifacts(data.artifacts);
      })
      .catch((loadError: unknown) => {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Unable to load public roadmap.');
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) {
    return <FullScreenMessage title="Loadmap" body="Loading public roadmap." />;
  }

  if (error || !roadmap) {
    return <FullScreenMessage title="Roadmap not found" body={error || 'This public roadmap could not be found.'} />;
  }

  const title = roadmap.publicTitle || roadmap.title;
  const summary = roadmap.publicSummary || roadmap.summary;
  const shareUrl = window.location.href;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {profile ? (
              <Link to={`/u/${profile.handle}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to profile
              </Link>
            ) : (
              <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Loadmap
              </Link>
            )}
            <button
              onClick={() => setIsShareDialogOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg hover:bg-accent transition-colors text-sm"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </header>

      <ShareRoadmapDialog
        open={isShareDialogOpen}
        url={shareUrl}
        onOpenChange={setIsShareDialogOpen}
      />

      <div className="max-w-7xl mx-auto px-6 py-8 w-full">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            {profile ? (
              <Link to={`/u/${profile.handle}`} className="hover:text-foreground transition-colors">
                {profile.displayName}
              </Link>
            ) : null}
            {profile ? <span>/</span> : null}
            <span>{roadmap.slug || slug}</span>
          </div>
          <h1 className="mb-3">{title}</h1>
          {summary ? (
            <p className="text-muted-foreground max-w-2xl">{summary}</p>
          ) : null}
          <div className="flex items-center gap-3 mt-4 text-sm text-muted-foreground">
            <span>{nodes.length} nodes</span>
            {roadmap.publishedAt ? (
              <>
                <span>/</span>
                <span>Published {formatDate(roadmap.publishedAt)}</span>
              </>
            ) : null}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden" style={{ height: '600px' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={graphNodeTypes}
            fitView
            minZoom={0.5}
            maxZoom={1.5}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
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

        {artifacts.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-4">Public Artifacts</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {artifacts.map((artifact) => {
                const href = artifact.fileUrl ?? artifact.url;

                return (
                  <a
                    key={artifact.id}
                    href={href || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors ${
                      href ? 'hover:bg-accent' : 'pointer-events-none opacity-70'
                    }`}
                  >
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{artifact.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {artifact.originalName || artifact.mimeType || artifact.kind}
                      </p>
                    </div>
                    {href ? <ExternalLink className="h-4 w-4 text-muted-foreground" /> : null}
                  </a>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString();
}
