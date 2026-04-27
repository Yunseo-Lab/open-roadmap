import { FileText, Paperclip } from 'lucide-react';
import { NodeHandles } from './NodeHandles';
import { useNodeInternalsUpdate } from './useNodeInternalsUpdate';
import type { NodeViewProps } from '../../graph/types';

export function ArtifactNode({ id, data }: NodeViewProps) {
  useNodeInternalsUpdate(id, data);

  return (
    <div className="bg-background border-2 border-emerald-500 rounded-lg shadow-md w-[200px]">
      <NodeHandles />

      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileText className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Artifact</div>
            <h4 className="text-sm leading-tight break-words">{data.label}</h4>
          </div>
        </div>
        {data.description && (
          <p className="text-xs text-muted-foreground mt-2 break-words">{data.description}</p>
        )}
        {data.attachments && data.attachments.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Paperclip className="w-3 h-3" />
            <span>{data.attachments.length} attachment{data.attachments.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
