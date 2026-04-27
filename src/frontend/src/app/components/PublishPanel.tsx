import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, FileText, Globe } from 'lucide-react';
import type { Artifact, PublishRoadmapInput, Roadmap } from '../../types';

interface PublishPanelProps {
  roadmap: Roadmap;
  artifacts: Artifact[];
  isCollapsed: boolean;
  publishing: boolean;
  publishError: string | null;
  publishedSlug?: string | null;
  onToggleCollapse: () => void;
  onPreview: (data: PublishRoadmapInput) => void;
  onPublish: (data: PublishRoadmapInput) => Promise<string | null>;
}

export function PublishPanel({
  roadmap,
  artifacts,
  isCollapsed,
  publishing,
  publishError,
  publishedSlug,
  onToggleCollapse,
  onPreview,
  onPublish,
}: PublishPanelProps) {
  const [publishTitle, setPublishTitle] = useState('');
  const [publishSlug, setPublishSlug] = useState('');
  const [publishSummary, setPublishSummary] = useState('');
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setPublishTitle(roadmap.publicTitle || roadmap.title);
    setPublishSlug(roadmap.slug || slugify(roadmap.publicTitle || roadmap.title));
    setPublishSummary(roadmap.publicSummary || roadmap.summary);
    setSelectedArtifactIds(artifacts.filter((artifact) => artifact.isPublic).map((artifact) => artifact.id));
    setFormError(null);
  }, [artifacts, roadmap]);

  const publishInput = useMemo<PublishRoadmapInput>(() => ({
    publicTitle: publishTitle.trim() || roadmap.title,
    publicSummary: publishSummary.trim(),
    slug: slugify(publishSlug || publishTitle || roadmap.title),
    artifactIds: selectedArtifactIds,
  }), [publishSlug, publishSummary, publishTitle, roadmap.title, selectedArtifactIds]);

  async function handlePublish() {
    if (!publishInput.publicTitle) {
      setFormError('Public title is required.');
      return;
    }
    if (!publishInput.slug) {
      setFormError('URL slug is required.');
      return;
    }

    const error = await onPublish(publishInput);
    setFormError(error);
  }

  function toggleArtifact(artifactId: string) {
    setSelectedArtifactIds((currentArtifactIds) => (
      currentArtifactIds.includes(artifactId)
        ? currentArtifactIds.filter((id) => id !== artifactId)
        : [...currentArtifactIds, artifactId]
    ));
  }

  if (isCollapsed) {
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-2xl">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2 px-3 hover:bg-accent rounded-lg transition-colors h-[42px]"
          title="Expand publish panel"
        >
          <Globe className="w-4 h-4" />
          <span className="text-sm font-medium">Publish</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-96 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl flex flex-col max-h-[calc(100vh-8rem)] overflow-hidden">
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0 w-full text-left hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4" />
          <h3 className="text-sm">Publish</h3>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <div className="space-y-4">
          <div>
            <h3 className="mb-2">Publish as Portfolio</h3>
            <p className="text-sm text-muted-foreground">
              Make this roadmap public and choose which evidence files are visible.
            </p>
          </div>

          <div>
            <label className="text-sm block mb-2">Public Title</label>
            <input
              type="text"
              value={publishTitle}
              onChange={(e) => {
                setPublishTitle(e.target.value);
                setFormError(null);
              }}
              placeholder="Career Growth Journey 2026"
              maxLength={120}
              className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="text-sm block mb-2">URL Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">/r/</span>
              <input
                type="text"
                value={publishSlug}
                onChange={(e) => {
                  setPublishSlug(slugify(e.target.value));
                  setFormError(null);
                }}
                placeholder="career-2026"
                maxLength={120}
                className="flex-1 px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm block mb-2">Summary</label>
            <textarea
              value={publishSummary}
              onChange={(e) => setPublishSummary(e.target.value)}
              rows={3}
              placeholder="Brief overview of this roadmap..."
              maxLength={1000}
              className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm">Public Artifacts</label>
              <span className="text-xs text-muted-foreground">{selectedArtifactIds.length} selected</span>
            </div>
            <div className="space-y-2">
              {artifacts.length > 0 ? (
                artifacts.map((artifact) => (
                  <label
                    key={artifact.id}
                    className="flex items-start gap-2 rounded-lg border border-border p-2 text-xs cursor-pointer hover:bg-accent/60 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedArtifactIds.includes(artifact.id)}
                      onChange={() => toggleArtifact(artifact.id)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <FileText className="mt-0.5 h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-foreground">{artifact.title}</p>
                      <p className="truncate text-muted-foreground">
                        {artifact.originalName || artifact.mimeType || artifact.kind}
                      </p>
                    </div>
                  </label>
                ))
              ) : (
                <div className="rounded-lg border border-border bg-accent/40 p-3 text-xs text-muted-foreground">
                  No artifacts are attached to this roadmap yet.
                </div>
              )}
            </div>
          </div>

          {(formError || publishError) && (
            <p className="text-xs text-destructive">{formError || publishError}</p>
          )}

          {publishedSlug && (
            <a
              href={`/r/${publishedSlug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
            >
              <Check className="h-4 w-4" />
              View published roadmap
            </a>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onPreview(publishInput)}
              className="flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || !publishInput.publicTitle || !publishInput.slug}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Globe className="w-4 h-4" />
              {publishing ? 'Publishing' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
