import { ChevronRight, Edit3 } from 'lucide-react';
import type { Artifact } from '../../types';
import type { CreateNodeData, ElementUpdates, NodeType, SelectedElementData } from '../graph/types';
import { CreateNodeForm } from './edit-panel/CreateNodeForm';
import { EdgeEditor } from './edit-panel/EdgeEditor';
import { NodeEditor } from './edit-panel/NodeEditor';

interface EditPanelProps {
  selectedElement: SelectedElementData;
  onElementUpdate: (updates: ElementUpdates) => void;
  onCreateNode: (type: NodeType, data: CreateNodeData) => void;
  onDeleteElement: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  artifacts?: Artifact[];
  availableArtifacts?: Artifact[];
  artifactError?: string | null;
  isUploadingArtifact?: boolean;
  updatingArtifactId?: string | null;
  onUploadArtifact?: (nodeId: string, file: File) => Promise<string | null>;
  onAttachArtifact?: (nodeId: string, artifactId: string) => Promise<string | null>;
  onDetachArtifact?: (artifactId: string) => Promise<string | null>;
  onDeleteArtifact?: (artifactId: string) => Promise<string | null>;
}

export function EditPanel({
  selectedElement,
  onElementUpdate,
  onCreateNode,
  onDeleteElement,
  isCollapsed,
  onToggleCollapse,
  artifacts = [],
  availableArtifacts = [],
  artifactError,
  isUploadingArtifact = false,
  updatingArtifactId,
  onUploadArtifact,
  onAttachArtifact,
  onDetachArtifact,
  onDeleteArtifact,
}: EditPanelProps) {
  if (isCollapsed) {
    const label = selectedElement ? 'Edit' : 'Create';
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-2xl">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2 px-3 hover:bg-accent rounded-lg transition-colors h-[42px]"
          title={selectedElement ? 'Expand edit panel' : 'Expand node creation panel'}
        >
          <Edit3 className="w-4 h-4" />
          <span className="text-sm font-medium">{label}</span>
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
          <Edit3 className="w-4 h-4" />
          <h3 className="text-sm">{selectedElement ? 'Edit' : 'Create'}</h3>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {selectedElement?.type === 'node' ? (
          <NodeEditor
            selectedElement={selectedElement}
            onElementUpdate={onElementUpdate}
            onDeleteElement={onDeleteElement}
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
        ) : selectedElement?.type === 'edge' ? (
          <EdgeEditor
            selectedElement={selectedElement}
            onElementUpdate={onElementUpdate}
            onDeleteElement={onDeleteElement}
          />
        ) : (
          <CreateNodeForm onCreateNode={onCreateNode} />
        )}
      </div>
    </div>
  );
}
