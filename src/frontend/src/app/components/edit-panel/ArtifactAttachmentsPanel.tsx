import { type ChangeEvent, useRef } from 'react';
import { ExternalLink, FileText, Paperclip, Trash2, Unlink, Upload } from 'lucide-react';
import type { Artifact } from '../../../types';

interface ArtifactAttachmentsPanelProps {
  nodeId: string;
  artifacts: Artifact[];
  availableArtifacts: Artifact[];
  artifactError?: string | null;
  isUploadingArtifact: boolean;
  updatingArtifactId?: string | null;
  onUploadArtifact?: (nodeId: string, file: File) => Promise<string | null>;
  onAttachArtifact?: (nodeId: string, artifactId: string) => Promise<string | null>;
  onDetachArtifact?: (artifactId: string) => Promise<string | null>;
  onDeleteArtifact?: (artifactId: string) => Promise<string | null>;
}

export function ArtifactAttachmentsPanel({
  nodeId,
  artifacts,
  availableArtifacts,
  artifactError,
  isUploadingArtifact,
  updatingArtifactId,
  onUploadArtifact,
  onAttachArtifact,
  onDetachArtifact,
  onDeleteArtifact,
}: ArtifactAttachmentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleArtifactUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadArtifact) {
      event.target.value = '';
      return;
    }

    await onUploadArtifact(nodeId, file);
    event.target.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm">Attachments</label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!onUploadArtifact || isUploadingArtifact}
          className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Upload className="w-4 h-4" />
          {isUploadingArtifact ? 'Uploading' : 'Upload'}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.markdown,.pdf,image/png,image/jpeg,image/webp,image/gif"
        onChange={handleArtifactUpload}
        className="hidden"
      />

      {artifactError && (
        <p className="mb-3 text-xs text-destructive">{artifactError}</p>
      )}

      <div className="space-y-2">
        {artifacts.length > 0 ? (
          artifacts.map((artifact) => (
            <ArtifactRow
              key={artifact.id}
              artifact={artifact}
              isUpdating={updatingArtifactId === artifact.id}
              onDetachArtifact={onDetachArtifact}
              onDeleteArtifact={onDeleteArtifact}
            />
          ))
        ) : (
          <div className="flex items-center gap-2 p-2 bg-accent/50 rounded text-xs text-muted-foreground">
            <Paperclip className="w-4 h-4" />
            <span>No attachments yet.</span>
          </div>
        )}
      </div>

      {availableArtifacts.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <label className="text-sm block mb-2">Attach Existing</label>
          <div className="space-y-2">
            {availableArtifacts.map((artifact) => {
              const isUpdatingArtifact = updatingArtifactId === artifact.id;

              return (
                <div key={artifact.id} className="flex items-center gap-2 p-2 border border-border rounded text-xs">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="min-w-0 flex-1 truncate" title={artifact.title}>
                    {artifact.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => onAttachArtifact?.(nodeId, artifact.id)}
                    disabled={!onAttachArtifact || isUpdatingArtifact}
                    className="px-2 py-1 border border-border rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Attach
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ArtifactRow({
  artifact,
  isUpdating,
  onDetachArtifact,
  onDeleteArtifact,
}: {
  artifact: Artifact;
  isUpdating: boolean;
  onDetachArtifact?: (artifactId: string) => Promise<string | null>;
  onDeleteArtifact?: (artifactId: string) => Promise<string | null>;
}) {
  const artifactHref = artifact.fileUrl ?? artifact.url;

  return (
    <div className="flex items-center gap-2 p-2 bg-accent rounded text-xs">
      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-foreground" title={artifact.title}>
          {artifact.title}
        </p>
        <p className="truncate text-muted-foreground">
          {artifact.originalName || artifact.mimeType || formatArtifactKind(artifact.kind)}
          {artifact.size > 0 ? ` - ${formatFileSize(artifact.size)}` : ''}
        </p>
      </div>
      {artifactHref && (
        <a
          href={artifactHref}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground"
          title="Open artifact"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      <button
        type="button"
        onClick={() => onDetachArtifact?.(artifact.id)}
        disabled={!onDetachArtifact || isUpdating}
        className="text-muted-foreground hover:text-foreground disabled:opacity-40"
        title="Detach artifact"
      >
        <Unlink className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onDeleteArtifact?.(artifact.id)}
        disabled={!onDeleteArtifact || isUpdating}
        className="text-muted-foreground hover:text-destructive disabled:opacity-40"
        title="Delete artifact"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatArtifactKind(kind: Artifact['kind']) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
