import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { CreateNodeData, NodeType } from '../../graph/types';

interface CreateNodeFormProps {
  onCreateNode: (type: NodeType, data: CreateNodeData) => void;
}

export function CreateNodeForm({ onCreateNode }: CreateNodeFormProps) {
  const [newNodeType, setNewNodeType] = useState<NodeType>('objective');
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeDescription, setNewNodeDescription] = useState('');

  const handleCreateNode = () => {
    if (!newNodeTitle.trim()) return;

    onCreateNode(newNodeType, {
      label: newNodeTitle,
      description: newNodeDescription || undefined,
    });

    setNewNodeTitle('');
    setNewNodeDescription('');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2">Create New Node</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Add a new element to your roadmap
        </p>
      </div>

      <div>
        <label className="text-sm block mb-2">Node Type</label>
        <select
          value={newNodeType}
          onChange={(e) => setNewNodeType(e.target.value as NodeType)}
          className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
        >
          <option value="objective">Objective</option>
          <option value="milestone">Milestone</option>
          <option value="event">Event</option>
          <option value="artifact">Artifact</option>
        </select>
      </div>

      <div>
        <label className="text-sm block mb-2">Title</label>
        <input
          type="text"
          value={newNodeTitle}
          onChange={(e) => setNewNodeTitle(e.target.value)}
          placeholder="Enter node title..."
          className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
        />
      </div>

      <div>
        <label className="text-sm block mb-2">Description (Optional)</label>
        <textarea
          value={newNodeDescription}
          onChange={(e) => setNewNodeDescription(e.target.value)}
          placeholder="Add a description..."
          rows={3}
          className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm resize-none"
        />
      </div>

      <button
        onClick={handleCreateNode}
        disabled={!newNodeTitle.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Plus className="w-4 h-4" />
        Create Node
      </button>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Tip: Click on a node or connection to edit it
        </p>
      </div>
    </div>
  );
}
