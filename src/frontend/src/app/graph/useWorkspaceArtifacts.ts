import { useCallback, useState } from 'react';
import { api } from '../../lib/api';
import type { Artifact } from '../../types';

type UseWorkspaceArtifactsOptions = {
  selectedRoadmap: string;
  ensureGraphSaved: () => Promise<void>;
};

export function useWorkspaceArtifacts({
  selectedRoadmap,
  ensureGraphSaved,
}: UseWorkspaceArtifactsOptions) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [isUploadingArtifact, setIsUploadingArtifact] = useState(false);
  const [updatingArtifactId, setUpdatingArtifactId] = useState<string | null>(null);
  const [artifactError, setArtifactError] = useState<string | null>(null);

  const resetArtifacts = useCallback(() => {
    setArtifacts([]);
    setIsUploadingArtifact(false);
    setUpdatingArtifactId(null);
    setArtifactError(null);
  }, []);

  const replaceArtifacts = useCallback((nextArtifacts: Artifact[]) => {
    setArtifacts(nextArtifacts);
  }, []);

  const applyArtifactVisibility = useCallback((publicArtifactIds: string[]) => {
    const publicArtifactIdSet = new Set(publicArtifactIds);
    setArtifacts((currentArtifacts) =>
      currentArtifacts.map((artifact) => ({
        ...artifact,
        isPublic: publicArtifactIdSet.has(artifact.id),
      })),
    );
  }, []);

  const detachArtifactsFromNodes = useCallback((nodeIds: string[]) => {
    if (nodeIds.length === 0) {
      return;
    }

    const nodeIdSet = new Set(nodeIds);
    setArtifacts((currentArtifacts) =>
      currentArtifacts.map((artifact) => (
        artifact.nodeId && nodeIdSet.has(artifact.nodeId)
          ? { ...artifact, nodeId: null }
          : artifact
      )),
    );
  }, []);

  const uploadArtifact = useCallback(async (nodeId: string, file: File) => {
    if (!selectedRoadmap) {
      return 'Roadmap is required.';
    }

    setIsUploadingArtifact(true);
    setArtifactError(null);

    try {
      await ensureGraphSaved();

      const body = new FormData();
      body.set('file', file);
      body.set('roadmapId', selectedRoadmap);
      body.set('nodeId', nodeId);
      body.set('title', file.name);

      const data = await api.uploadArtifact(body);
      if (!data.artifact) {
        throw new Error('Unable to upload artifact.');
      }

      const uploadedArtifact = data.artifact;
      setArtifacts((currentArtifacts) => [
        uploadedArtifact,
        ...currentArtifacts.filter((artifact) => artifact.id !== uploadedArtifact.id),
      ]);
      return null;
    } catch (error) {
      const message = formatError(error);
      setArtifactError(message);
      return message;
    } finally {
      setIsUploadingArtifact(false);
    }
  }, [ensureGraphSaved, selectedRoadmap]);

  const attachArtifact = useCallback(async (nodeId: string, artifactId: string) => {
    setUpdatingArtifactId(artifactId);
    setArtifactError(null);

    try {
      await ensureGraphSaved();

      const data = await api.updateArtifact(artifactId, { nodeId });
      if (!data.artifact) {
        throw new Error('Unable to attach artifact.');
      }

      const updatedArtifact = data.artifact;
      setArtifacts((currentArtifacts) =>
        currentArtifacts.map((artifact) => (
          artifact.id === artifactId ? updatedArtifact : artifact
        )),
      );
      return null;
    } catch (error) {
      const message = formatError(error);
      setArtifactError(message);
      return message;
    } finally {
      setUpdatingArtifactId(null);
    }
  }, [ensureGraphSaved]);

  const detachArtifact = useCallback(async (artifactId: string) => {
    setUpdatingArtifactId(artifactId);
    setArtifactError(null);

    try {
      const data = await api.updateArtifact(artifactId, { nodeId: null });
      if (!data.artifact) {
        throw new Error('Unable to detach artifact.');
      }

      const updatedArtifact = data.artifact;
      setArtifacts((currentArtifacts) =>
        currentArtifacts.map((artifact) => (
          artifact.id === artifactId ? updatedArtifact : artifact
        )),
      );
      return null;
    } catch (error) {
      const message = formatError(error);
      setArtifactError(message);
      return message;
    } finally {
      setUpdatingArtifactId(null);
    }
  }, []);

  const deleteArtifact = useCallback(async (artifactId: string) => {
    setUpdatingArtifactId(artifactId);
    setArtifactError(null);

    try {
      await api.deleteArtifact(artifactId);
      setArtifacts((currentArtifacts) =>
        currentArtifacts.filter((artifact) => artifact.id !== artifactId),
      );
      return null;
    } catch (error) {
      const message = formatError(error);
      setArtifactError(message);
      return message;
    } finally {
      setUpdatingArtifactId(null);
    }
  }, []);

  return {
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
  };
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to process the artifact request.';
}
