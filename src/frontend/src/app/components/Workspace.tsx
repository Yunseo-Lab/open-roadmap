import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Sidebar } from './Sidebar';
import { GraphCanvas } from './GraphCanvas';
import { EditPanel } from './EditPanel';
import { PublishPanel } from './PublishPanel';
import { PublishPreview } from './PublishPreview';
import { AIChat } from './AIChat';
import { AccountButton } from './AccountButton';
import { FullScreenMessage } from './FullScreenMessage';
import { SaveStatus } from './SaveStatus';
import { RoadmapDeleteDialog } from './RoadmapDeleteDialog';
import { useAuth } from '../auth/AuthProvider';
import { useWorkspaceGraph } from '../graph/useWorkspaceGraph';
import { api } from '../../lib/api';
import type { AgentResponse, PublishRoadmapInput, Roadmap } from '../../types';
import type { AgentStreamHandlers } from '../../lib/api';

export function Workspace() {
  const { roadmapId } = useParams<{ roadmapId: string }>();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const selectedRoadmap = roadmapId || '';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isEditPanelCollapsed, setIsEditPanelCollapsed] = useState(true);
  const [isPublishPanelCollapsed, setIsPublishPanelCollapsed] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PublishRoadmapInput>({
    publicTitle: '',
    publicSummary: '',
    slug: '',
    artifactIds: [],
  });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [deletingRoadmap, setDeletingRoadmap] = useState<Roadmap | null>(null);
  const [deletingRoadmapId, setDeletingRoadmapId] = useState<string | null>(null);
  const [deleteRoadmapError, setDeleteRoadmapError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedRoadmap) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, selectedRoadmap]);

  useEffect(() => {
    setIsEditPanelCollapsed(true);
  }, [selectedRoadmap]);

  const openEditPanel = useCallback(() => {
    setIsEditPanelCollapsed(false);
  }, []);

  const closeEditPanel = useCallback(() => {
    setIsEditPanelCollapsed(true);
  }, []);

  const graph = useWorkspaceGraph(selectedRoadmap, {
    onElementSelected: openEditPanel,
    onNodeCreated: openEditPanel,
    onPaneCleared: closeEditPanel,
  });
  const selectedNodeId = graph.selectedElementData?.type === 'node'
    ? graph.selectedElementData.data.id
    : null;
  const selectedNodeArtifacts = selectedNodeId
    ? graph.artifacts.filter((artifact) => artifact.nodeId === selectedNodeId)
    : [];
  const unattachedArtifacts = graph.artifacts.filter((artifact) => !artifact.nodeId);

  const handlePreview = (data: PublishRoadmapInput) => {
    setPreviewData(data);
    setIsPreviewOpen(true);
  };

  const handlePublishRoadmap = useCallback(async (input: PublishRoadmapInput) => {
    if (!selectedRoadmap) {
      return 'Roadmap is required.';
    }

    setPublishing(true);
    setPublishError(null);

    try {
      await graph.ensureGraphSaved();

      const data = await api.publishRoadmap(selectedRoadmap, input);
      if (!data.roadmap) {
        throw new Error('Unable to publish roadmap.');
      }

      graph.applyArtifactVisibility(input.artifactIds);
      graph.applyRoadmapUpdate(data.roadmap);
      setPublishedSlug(data.roadmap.slug);
      setPreviewData((currentPreviewData) => ({
        ...currentPreviewData,
        slug: data.roadmap?.slug || currentPreviewData.slug,
      }));
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to publish roadmap.';
      setPublishError(message);
      return message;
    } finally {
      setPublishing(false);
    }
  }, [graph, selectedRoadmap]);

  const handleAgentMessage = useCallback(async (
    message: string,
    handlers: AgentStreamHandlers,
  ): Promise<AgentResponse> => {
    if (!selectedRoadmap) {
      throw new Error('Roadmap is required.');
    }

    handlers.onStatus?.('Saving current graph.');
    await graph.ensureGraphSaved();
    const result = await api.runAgentStream(selectedRoadmap, { content: message, artifactIds: [] }, handlers);
    graph.applyServerGraph(result.graph);
    return result;
  }, [graph, selectedRoadmap]);

  function openDeleteRoadmapDialog(roadmap: Roadmap) {
    setDeletingRoadmap(roadmap);
    setDeleteRoadmapError(null);
  }

  const handleDeleteRoadmap = useCallback(async () => {
    if (!deletingRoadmap) {
      return;
    }

    setDeletingRoadmapId(deletingRoadmap.id);
    setDeleteRoadmapError(null);

    try {
      await api.deleteRoadmap(deletingRoadmap.id);
      setDeletingRoadmap(null);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setDeleteRoadmapError(error instanceof Error ? error.message : 'Unable to delete roadmap.');
    } finally {
      setDeletingRoadmapId(null);
    }
  }, [deletingRoadmap, navigate]);

  if (!user) {
    return null;
  }

  if (graph.loading) {
    return <FullScreenMessage title="Open Roadmap" body="Loading roadmap graph." />;
  }

  if (graph.loadError || !graph.roadmap) {
    return <FullScreenMessage title="Unable to open roadmap" body={graph.loadError || 'Roadmap details could not be found.'} />;
  }

  return (
    <div className="size-full relative bg-background">
      <GraphCanvas
        key={selectedRoadmap}
        nodes={graph.nodes}
        edges={graph.edges}
        onNodesChange={graph.handleNodesChange}
        onEdgesChange={graph.handleEdgesChange}
        onConnect={graph.handleConnect}
        onElementSelect={graph.handleElementSelect}
        onPaneClick={graph.handlePaneClick}
      />

      <div className="absolute top-4 left-4 z-40">
        <Sidebar
          selectedRoadmap={selectedRoadmap}
          roadmaps={graph.roadmaps}
          onSelectRoadmap={(id) => navigate(`/workspace/${id}`)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onCreateRoadmap={() => navigate('/dashboard')}
          onGoToDashboard={() => navigate('/dashboard')}
          onGoToSettings={() => navigate('/settings')}
          onRequestDeleteRoadmap={openDeleteRoadmapDialog}
        />
      </div>

      <div className="absolute top-4 right-4 z-40 flex items-start gap-2">
        <SaveStatus
          isDirty={graph.isDirty}
          isSaving={graph.isSaving}
          error={graph.saveError}
          onSave={graph.handleSaveGraph}
        />
        <EditPanel
          selectedElement={graph.selectedElementData}
          onElementUpdate={graph.handleElementUpdate}
          onCreateNode={graph.handleCreateNode}
          onDeleteElement={graph.handleDeleteSelectedElement}
          isCollapsed={isEditPanelCollapsed}
          onToggleCollapse={() => setIsEditPanelCollapsed(!isEditPanelCollapsed)}
          artifacts={selectedNodeArtifacts}
          availableArtifacts={unattachedArtifacts}
          artifactError={graph.artifactError}
          isUploadingArtifact={graph.isUploadingArtifact}
          updatingArtifactId={graph.updatingArtifactId}
          onUploadArtifact={graph.handleUploadArtifact}
          onAttachArtifact={graph.handleAttachArtifact}
          onDetachArtifact={graph.handleDetachArtifact}
          onDeleteArtifact={graph.handleDeleteArtifact}
        />
        <PublishPanel
          roadmap={graph.roadmap}
          artifacts={graph.artifacts}
          isCollapsed={isPublishPanelCollapsed}
          publishing={publishing}
          publishError={publishError}
          publishedSlug={publishedSlug || graph.roadmap.slug}
          onToggleCollapse={() => setIsPublishPanelCollapsed(!isPublishPanelCollapsed)}
          onPreview={handlePreview}
          onPublish={handlePublishRoadmap}
        />
        <AccountButton user={user} onSignOut={signOut} />
      </div>

      <AIChat isOpen={true} disabled={graph.isSaving} onSend={handleAgentMessage} />

      <PublishPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        nodes={graph.nodes}
        edges={graph.edges}
        title={previewData.publicTitle || graph.roadmap.publicTitle || graph.roadmap.title}
        slug={previewData.slug}
        summary={previewData.publicSummary || graph.roadmap.publicSummary || graph.roadmap.summary}
        publishing={publishing}
        publishError={publishError}
        onPublish={() => handlePublishRoadmap(previewData)}
      />
      <RoadmapDeleteDialog
        roadmap={deletingRoadmap}
        open={Boolean(deletingRoadmap)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingRoadmap(null);
            setDeleteRoadmapError(null);
          }
        }}
        deleting={Boolean(deletingRoadmapId)}
        error={deleteRoadmapError}
        onConfirm={handleDeleteRoadmap}
      />
    </div>
  );
}
