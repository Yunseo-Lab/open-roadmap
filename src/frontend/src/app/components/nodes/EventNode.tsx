import { Calendar } from 'lucide-react';
import { NodeHandles } from './NodeHandles';
import { useNodeInternalsUpdate } from './useNodeInternalsUpdate';
import type { NodeViewProps } from '../../graph/types';

export function EventNode({ id, data }: NodeViewProps) {
  useNodeInternalsUpdate(id, data);

  return (
    <div className="bg-background border-2 border-pink-500 rounded-lg shadow-md w-[200px]">
      <NodeHandles />

      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded bg-pink-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Calendar className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-pink-600 dark:text-pink-400 mb-1">Event</div>
            <h4 className="text-sm leading-tight break-words">{data.label}</h4>
          </div>
        </div>
        {data.description && (
          <p className="text-xs text-muted-foreground mt-2 break-words">{data.description}</p>
        )}
        {data.date && (
          <div className="mt-2 text-xs text-muted-foreground">
            {new Date(data.date).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}
