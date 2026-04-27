import { Trash2 } from 'lucide-react';
import type { Artifact } from '../../../types';
import type { ElementUpdates, SelectedElementData } from '../../graph/types';
import { ArtifactAttachmentsPanel } from './ArtifactAttachmentsPanel';

type SelectedNodeElement = Extract<NonNullable<SelectedElementData>, { type: 'node' }>;

interface NodeEditorProps {
  selectedElement: SelectedNodeElement;
  onElementUpdate: (updates: ElementUpdates) => void;
  onDeleteElement: () => void;
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

export function NodeEditor({
  selectedElement,
  onElementUpdate,
  onDeleteElement,
  artifacts,
  availableArtifacts,
  artifactError,
  isUploadingArtifact,
  updatingArtifactId,
  onUploadArtifact,
  onAttachArtifact,
  onDetachArtifact,
  onDeleteArtifact,
}: NodeEditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3>Edit Node</h3>
          <div className={`text-xs px-2 py-1 rounded ${
            selectedElement.data.type === 'objective' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
            selectedElement.data.type === 'milestone' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
            selectedElement.data.type === 'event' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' :
            'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
          }`}>
            {selectedElement.data.type.charAt(0).toUpperCase() + selectedElement.data.type.slice(1)}
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm block mb-2">Title</label>
        <input
          type="text"
          value={selectedElement.data.data.label}
          onChange={(e) => onElementUpdate({ label: e.target.value })}
          className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="text-sm block mb-2">Description</label>
        <textarea
          value={selectedElement.data.data.description || ''}
          onChange={(e) => onElementUpdate({ description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm resize-none"
        />
      </div>

      {(selectedElement.data.type === 'milestone' || selectedElement.data.type === 'event') && (
        <div>
          <label className="text-sm block mb-2">Date</label>
          <input
            type="date"
            value={selectedElement.data.data.date || ''}
            onChange={(e) => onElementUpdate({ date: e.target.value })}
            className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
          />
        </div>
      )}

      {selectedElement.data.type === 'objective' && (
        <div>
          <label className="text-sm block mb-2">Status</label>
          <select
            value={selectedElement.data.data.status || 'pending'}
            onChange={(e) => onElementUpdate({ status: e.target.value })}
            className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
          >
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      )}

      <ArtifactAttachmentsPanel
        nodeId={selectedElement.data.id}
        artifacts={artifacts}
        availableArtifacts={availableArtifacts}
        artifactError={artifactError}
        isUploadingArtifact={isUploadingArtifact}
        updatingArtifactId={updatingArtifactId}
        onUploadArtifact={onUploadArtifact}
        onAttachArtifact={onAttachArtifact}
        onDetachArtifact={onDetachArtifact}
        onDeleteArtifact={onDeleteArtifact}
      />

      <div className="pt-4 border-t border-border">
        <button
          onClick={onDeleteElement}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10 transition-colors text-sm"
        >
          <Trash2 className="w-4 h-4" />
          Delete Node
        </button>
      </div>
    </div>
  );
}
