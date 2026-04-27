import { Handle } from '@xyflow/react';
import {
  nodeHandleClassName,
  nodeHandleDefinitions,
  nodeTargetHandleClassName,
} from '../../graph/layout';

export function NodeHandles() {
  return (
    <>
      {nodeHandleDefinitions.map((handle) => (
        <Handle
          key={`${handle.id}-target`}
          id={handle.id}
          type="target"
          position={handle.position}
          className={nodeTargetHandleClassName}
        />
      ))}
      {nodeHandleDefinitions.map((handle) => (
        <Handle
          key={`${handle.id}-source`}
          id={handle.id}
          type="source"
          position={handle.position}
          className={nodeHandleClassName}
        />
      ))}
    </>
  );
}
