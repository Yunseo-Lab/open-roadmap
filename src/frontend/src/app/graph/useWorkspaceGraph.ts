import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { api } from '../../lib/api';
import type { Roadmap, RoadmapGraph } from '../../types';
import { toApiGraph, toWorkspaceEdge, toWorkspaceNode } from './adapter';
import type {
  CreateNodeData,
  ElementUpdates,
  GraphEdge,
  GraphNode,
  NodeType,
  SelectedElement,
  SelectedElementData,
} from './types';
import { useWorkspaceArtifacts } from './useWorkspaceArtifacts';

type UseWorkspaceGraphOptions = {
  onElementSelected?: () => void;
  onPaneCleared?: () => void;
  onNodeCreated?: () => void;
};

export function useWorkspaceGraph(
  selectedRoadmap: string,
  {
    onElementSelected,
    onPaneCleared,
    onNodeCreated,
  }: UseWorkspaceGraphOptions = {},
) {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const persistGraph = useCallback(async () => {
    if (!selectedRoadmap) {
      throw new Error('Roadmap is required.');
    }

    const graphData = await api.saveGraph(selectedRoadmap, toApiGraph(nodes, edges));
    setNodes(graphData.graph.nodes.map(toWorkspaceNode));
    setEdges(graphData.graph.edges.map(toWorkspaceEdge));
    setIsDirty(false);

    const roadmapsData = await api.listRoadmaps();
    setRoadmaps(roadmapsData.roadmaps);
  }, [edges, nodes, selectedRoadmap]);

  const ensureGraphSaved = useCallback(async () => {
    if (!isDirty) {
      return;
    }

    if (isSaving) {
      throw new Error('Graph is still saving. Please try again.');
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await persistGraph();
    } catch (error) {
      setSaveError(formatError(error));
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [isDirty, isSaving, persistGraph]);

  const applyRoadmapUpdate = useCallback((updatedRoadmap: Roadmap) => {
    setRoadmap(updatedRoadmap);
    setRoadmaps((currentRoadmaps) =>
      currentRoadmaps.map((currentRoadmap) => (
        currentRoadmap.id === updatedRoadmap.id
          ? { ...updatedRoadmap, nodeCount: currentRoadmap.nodeCount }
          : currentRoadmap
      )),
    );
  }, []);

  const applyServerGraph = useCallback((serverGraph: RoadmapGraph) => {
    setNodes(serverGraph.nodes.map(toWorkspaceNode));
    setEdges(serverGraph.edges.map(toWorkspaceEdge));
    setSelectedElement(null);
    setIsDirty(false);
    setSaveError(null);
  }, []);

  const {
    artifacts,
    isUploadingArtifact,
    updatingArtifactId,
    artifactError,
    resetArtifacts,
    replaceArtifacts,
    applyArtifactVisibility,
    detachArtifactsFromNodes,
    uploadArtifact,
    attachArtifact,
    detachArtifact,
    deleteArtifact,
  } = useWorkspaceArtifacts({
    selectedRoadmap,
    ensureGraphSaved,
  });

  useEffect(() => {
    if (!selectedRoadmap) {
      return;
    }

    let isMounted = true;
    setLoading(true);
    setLoadError(null);
    setSelectedElement(null);
    resetArtifacts();
    setNodes([]);
    setEdges([]);
    setIsDirty(false);
    setIsSaving(false);
    setSaveError(null);

    Promise.all([
      api.getRoadmap(selectedRoadmap),
      api.getGraph(selectedRoadmap),
      api.listRoadmaps(),
    ])
      .then(([roadmapData, graphData, roadmapsData]) => {
        if (!isMounted) {
          return;
        }
        setRoadmap(roadmapData.roadmap);
        replaceArtifacts(roadmapData.artifacts);
        setNodes(graphData.graph.nodes.map(toWorkspaceNode));
        setEdges(graphData.graph.edges.map(toWorkspaceEdge));
        setRoadmaps(roadmapsData.roadmaps);
        setIsDirty(false);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }
        setLoadError(formatError(error));
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [replaceArtifacts, resetArtifacts, selectedRoadmap]);

  const selectedElementData = useMemo<SelectedElementData>(() => {
    if (!selectedElement) {
      return null;
    }

    if (selectedElement.type === 'node') {
      const node = nodes.find((item) => item.id === selectedElement.id);
      return node ? { type: 'node', data: node } : null;
    }

    const edge = edges.find((item) => item.id === selectedElement.id);
    return edge ? { type: 'edge', data: edge } : null;
  }, [edges, nodes, selectedElement]);

  const handleElementSelect = useCallback((element: SelectedElement) => {
    setSelectedElement(element);
    if (element) {
      onElementSelected?.();
    }
  }, [onElementSelected]);

  const clearSelectedElement = useCallback(() => {
    setSelectedElement(null);
    onPaneCleared?.();
  }, [onPaneCleared]);

  const handlePaneClick = clearSelectedElement;

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const removedNodeIds = getRemovedNodeIds(changes);

    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes as any) as GraphNode[]);

    if (removedNodeIds.length > 0) {
      const removedNodeIdSet = new Set(removedNodeIds);
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => !isConnectedToNode(edge, removedNodeIdSet)),
      );
      detachArtifactsFromNodes(removedNodeIds);

      if (
        selectedElement?.type === 'edge' ||
        (selectedElement?.type === 'node' && removedNodeIdSet.has(selectedElement.id))
      ) {
        clearSelectedElement();
      }
    }

    if (changes.some(isPersistentNodeChange)) {
      setIsDirty(true);
      setSaveError(null);
    }
  }, [clearSelectedElement, detachArtifactsFromNodes, selectedElement]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removedEdgeIds = getRemovedEdgeIds(changes);

    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges as any) as GraphEdge[]);

    if (
      removedEdgeIds.length > 0 &&
      selectedElement?.type === 'edge' &&
      removedEdgeIds.includes(selectedElement.id)
    ) {
      clearSelectedElement();
    }

    if (changes.some(isPersistentEdgeChange)) {
      setIsDirty(true);
      setSaveError(null);
    }
  }, [clearSelectedElement, selectedElement]);

  const handleConnect = useCallback((connection: Connection) => {
    setIsDirty(true);
    setSaveError(null);
    setEdges((currentEdges) =>
      addEdge(
        {
          ...connection,
          id: createGraphId('edge'),
          type: 'smoothstep',
          label: 'supports',
          data: {
            kind: 'supports',
            label: 'supports',
            metadata: createEdgeMetadata(connection),
          },
        },
        currentEdges as any,
      ) as GraphEdge[],
    );
  }, []);

  const handleCreateNode = useCallback((type: NodeType, data: CreateNodeData) => {
    const nodeId = createGraphId(type);
    const nodeData: GraphNode['data'] = {
      label: data.label || 'Untitled node',
      description: data.description,
      status: data.status,
      date: data.date,
      attachments: data.attachments,
      metadata: data.metadata,
    };

    setIsDirty(true);
    setSaveError(null);
    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id: nodeId,
        type,
        position: {
          x: 140 + (currentNodes.length % 4) * 240,
          y: 120 + Math.floor(currentNodes.length / 4) * 180,
        },
        data: nodeData,
      },
    ]);
    setSelectedElement({ type: 'node', id: nodeId });
    onNodeCreated?.();
  }, [onNodeCreated]);

  const handleElementUpdate = useCallback((updates: ElementUpdates) => {
    if (!selectedElement) {
      return;
    }

    setIsDirty(true);
    setSaveError(null);
    if (selectedElement.type === 'node') {
      setNodes((currentNodes) =>
        currentNodes.map((node) => (
          node.id === selectedElement.id
            ? updateGraphNode(node, updates)
            : node
        )),
      );
      return;
    }

    setEdges((currentEdges) =>
      currentEdges.map((edge) => (
        edge.id === selectedElement.id ? updateGraphEdge(edge, updates) : edge
      )),
    );
  }, [selectedElement]);

  const handleDeleteSelectedElement = useCallback(() => {
    if (!selectedElement) {
      return;
    }

    setIsDirty(true);
    setSaveError(null);

    if (selectedElement.type === 'node') {
      const nodeId = selectedElement.id;
      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      );
      detachArtifactsFromNodes([nodeId]);
    } else {
      setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== selectedElement.id));
    }

    clearSelectedElement();
  }, [clearSelectedElement, detachArtifactsFromNodes, selectedElement]);

  const handleSaveGraph = useCallback(async () => {
    if (!selectedRoadmap || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await persistGraph();
    } catch (error) {
      setSaveError(formatError(error));
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, persistGraph, selectedRoadmap]);

  return {
    roadmap,
    roadmaps,
    artifacts,
    nodes,
    edges,
    loading,
    loadError,
    selectedElementData,
    isDirty,
    isSaving,
    saveError,
    isUploadingArtifact,
    updatingArtifactId,
    artifactError,
    handleElementSelect,
    handlePaneClick,
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleCreateNode,
    handleElementUpdate,
    handleDeleteSelectedElement,
    handleSaveGraph,
    ensureGraphSaved,
    applyServerGraph,
    applyRoadmapUpdate,
    applyArtifactVisibility,
    handleUploadArtifact: uploadArtifact,
    handleAttachArtifact: attachArtifact,
    handleDetachArtifact: detachArtifact,
    handleDeleteArtifact: deleteArtifact,
  };
}

function updateGraphNode(node: GraphNode, updates: ElementUpdates): GraphNode {
  const nextData: GraphNode['data'] = { ...node.data };

  if (updates.label !== undefined) {
    nextData.label = updates.label;
  }

  if (updates.description !== undefined) {
    nextData.description = updates.description;
  }

  if (updates.status !== undefined) {
    nextData.status = updates.status;
  }

  if (updates.date !== undefined) {
    nextData.date = updates.date;
  }

  if (updates.attachments !== undefined) {
    nextData.attachments = updates.attachments;
  }

  if (updates.metadata !== undefined) {
    nextData.metadata = updates.metadata;
  }

  return {
    ...node,
    type: updates.type ?? node.type,
    data: nextData,
  };
}

function updateGraphEdge(edge: GraphEdge, updates: ElementUpdates): GraphEdge {
  const nextData = { ...edge.data };
  let nextLabel = edge.label;

  if (updates.kind) {
    const previousKind = edge.data?.kind;
    nextData.kind = updates.kind;

    if (!nextData.label || nextData.label === previousKind) {
      nextData.label = updates.kind;
      nextLabel = updates.kind;
    }
  }

  if (updates.label !== undefined) {
    nextData.label = updates.label;
    nextLabel = updates.label;
  }

  if (updates.description !== undefined) {
    nextData.description = updates.description;
  }

  return {
    ...edge,
    label: nextLabel,
    data: nextData,
  };
}

function createEdgeMetadata(connection: Connection): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (connection.sourceHandle) {
    metadata.sourceHandle = connection.sourceHandle;
  }

  if (connection.targetHandle) {
    metadata.targetHandle = connection.targetHandle;
  }

  return metadata;
}

function isPersistentNodeChange(change: NodeChange) {
  return change.type !== 'select' && change.type !== 'dimensions';
}

function isPersistentEdgeChange(change: EdgeChange) {
  return change.type !== 'select';
}

function getRemovedNodeIds(changes: NodeChange[]) {
  return changes.flatMap((change) => (change.type === 'remove' ? [change.id] : []));
}

function getRemovedEdgeIds(changes: EdgeChange[]) {
  return changes.flatMap((change) => (change.type === 'remove' ? [change.id] : []));
}

function isConnectedToNode(edge: GraphEdge, nodeIds: Set<string>) {
  return nodeIds.has(edge.source) || nodeIds.has(edge.target);
}

function createGraphId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load roadmap details.';
}
