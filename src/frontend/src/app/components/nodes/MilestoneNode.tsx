import { Flag } from 'lucide-react';
import { NodeHandles } from './NodeHandles';
import { useNodeInternalsUpdate } from './useNodeInternalsUpdate';
import type { NodeViewProps } from '../../graph/types';

export function MilestoneNode({ id, data }: NodeViewProps) {
  useNodeInternalsUpdate(id, data);

  return (
    <div className="bg-background border-2 border-purple-500 rounded-lg shadow-lg w-[220px]">
      <NodeHandles />

      <div className="p-3.5">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-5 h-5 rounded bg-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Flag className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">Milestone</div>
            <h4 className="text-sm leading-tight break-words">{data.label}</h4>
          </div>
        </div>
        {data.description && (
          <p className="text-xs text-muted-foreground mt-2 break-words">{data.description}</p>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {data.date && <span>{new Date(data.date).toLocaleDateString()}</span>}
          {data.status === 'completed' && (
            <span className="text-green-600 dark:text-green-400">✓ Completed</span>
          )}
        </div>
      </div>
    </div>
  );
}
