import { Trash2 } from 'lucide-react';
import { edgeTypeOptions, type EdgeType, type ElementUpdates, type SelectedElementData } from '../../graph/types';

type SelectedEdgeElement = Extract<NonNullable<SelectedElementData>, { type: 'edge' }>;

interface EdgeEditorProps {
  selectedElement: SelectedEdgeElement;
  onElementUpdate: (updates: ElementUpdates) => void;
  onDeleteElement: () => void;
}

export function EdgeEditor({
  selectedElement,
  onElementUpdate,
  onDeleteElement,
}: EdgeEditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-4">Edit Connection</h3>
      </div>

      <div>
        <label className="text-sm block mb-2">Connection Type</label>
        <select
          value={selectedElement.data.data?.kind || 'supports'}
          onChange={(e) => onElementUpdate({ kind: e.target.value as EdgeType })}
          className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
        >
          {edgeTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm block mb-2">Label (Optional)</label>
        <input
          type="text"
          value={selectedElement.data.data?.label ?? selectedElement.data.label ?? ''}
          onChange={(e) => onElementUpdate({ label: e.target.value })}
          className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="text-sm block mb-2">Description</label>
        <textarea
          value={selectedElement.data.data?.description || ''}
          onChange={(e) => onElementUpdate({ description: e.target.value })}
          rows={3}
          placeholder="Describe this connection..."
          className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm resize-none"
        />
      </div>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          From: <span className="text-foreground">{selectedElement.data.source}</span><br/>
          To: <span className="text-foreground">{selectedElement.data.target}</span>
        </p>
      </div>

      <div className="pt-4 border-t border-border">
        <button
          onClick={onDeleteElement}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10 transition-colors text-sm"
        >
          <Trash2 className="w-4 h-4" />
          Delete Connection
        </button>
      </div>
    </div>
  );
}
