import { Position } from '@xyflow/react';
import type { NodeHandleId } from './types';

export const nodeHandleClassName = 'w-2 h-2';
export const nodeTargetHandleClassName = `${nodeHandleClassName} opacity-0 pointer-events-none`;

export const nodeHandleDefinitions = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const satisfies readonly { id: NodeHandleId; position: Position }[];
