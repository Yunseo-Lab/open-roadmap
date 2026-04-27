import { useEffect } from 'react';
import { useUpdateNodeInternals } from '@xyflow/react';
import type { GraphNode } from '../../graph/types';

export function useNodeInternalsUpdate(id: string, data: GraphNode['data']) {
  const updateNodeInternals = useUpdateNodeInternals();
  const attachmentCount = data.attachments?.length ?? 0;

  useEffect(() => {
    updateNodeInternals(id);
  }, [
    attachmentCount,
    data.date,
    data.description,
    data.label,
    data.status,
    id,
    updateNodeInternals,
  ]);
}
