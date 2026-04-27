import { Handle } from '@xyflow/react';
import { nodeHandleClassName, nodeHandleDefinitions } from '../../graph/layout';

export function NodeHandles() {
  return (
    <>
      {nodeHandleDefinitions.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={handle.position}
          className={nodeHandleClassName}
        />
      ))}
    </>
  );
}
