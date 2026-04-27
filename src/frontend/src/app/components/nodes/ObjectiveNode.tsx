import { Target } from 'lucide-react';
import { NodeHandles } from './NodeHandles';
import { useNodeInternalsUpdate } from './useNodeInternalsUpdate';
import type { NodeViewProps } from '../../graph/types';

export function ObjectiveNode({ id, data }: NodeViewProps) {
  useNodeInternalsUpdate(id, data);

  return (
    <div className="bg-background border-2 border-blue-500 rounded-lg shadow-lg w-[240px]">
      <NodeHandles />

      <div className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">Objective</div>
            <h4 className="text-sm leading-tight break-words">{data.label}</h4>
          </div>
        </div>
        {data.description && (
          <p className="text-xs text-muted-foreground mt-2 break-words">{data.description}</p>
        )}
        {data.status && (
          <div className="mt-3 flex items-center gap-2">
            <div className={`text-xs px-2 py-0.5 rounded ${
              data.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
              data.status === 'in-progress' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
              'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}>
              {data.status === 'in-progress' ? 'In Progress' : data.status.charAt(0).toUpperCase() + data.status.slice(1)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
