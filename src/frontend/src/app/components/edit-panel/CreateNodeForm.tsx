import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  nodeStatusOptions,
  nodeTypeOptions,
  type CreateNodeData,
  type NodeType,
} from '../../graph/types';

interface CreateNodeFormProps {
  onCreateNode: (type: NodeType, data: CreateNodeData) => void;
}

export function CreateNodeForm({ onCreateNode }: CreateNodeFormProps) {
  const [newNodeType, setNewNodeType] = useState<NodeType>('objective');
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeDescription, setNewNodeDescription] = useState('');
  const [newNodeStatus, setNewNodeStatus] = useState('planned');
  const [newNodeDate, setNewNodeDate] = useState('');

  const handleCreateNode = () => {
    if (!newNodeTitle.trim()) return;

    onCreateNode(newNodeType, {
      label: newNodeTitle,
      description: newNodeDescription || undefined,
      status: newNodeStatus,
      date: newNodeDate || undefined,
    });

    setNewNodeTitle('');
    setNewNodeDescription('');
    setNewNodeStatus('planned');
    setNewNodeDate('');
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
          {nodeTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
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
        <label className="text-sm block mb-2">Description</label>
        <textarea
          value={newNodeDescription}
          onChange={(e) => setNewNodeDescription(e.target.value)}
          placeholder="Add a description..."
          rows={3}
          className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm resize-none"
        />
      </div>

      <div>
        <label className="text-sm block mb-2">Status</label>
        <select
          value={newNodeStatus}
          onChange={(e) => setNewNodeStatus(e.target.value)}
          className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
        >
          {nodeStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm block mb-2">Date</label>
        <input
          type="date"
          value={newNodeDate}
          onChange={(e) => setNewNodeDate(e.target.value)}
          className="w-full px-3 py-2 bg-input-background border border-border rounded-lg text-sm"
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
