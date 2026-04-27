import type { ComponentType } from 'react';
import type { NodeProps, NodeTypes } from '@xyflow/react';
import { ArtifactNode } from '../components/nodes/ArtifactNode';
import { EventNode } from '../components/nodes/EventNode';
import { MilestoneNode } from '../components/nodes/MilestoneNode';
import { ObjectiveNode } from '../components/nodes/ObjectiveNode';

export const graphNodeTypes: NodeTypes = {
  objective: ObjectiveNode as ComponentType<NodeProps>,
  milestone: MilestoneNode as ComponentType<NodeProps>,
  event: EventNode as ComponentType<NodeProps>,
  artifact: ArtifactNode as ComponentType<NodeProps>,
};
