import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../../lib/api';
import type { CreateRoadmapInput, Roadmap, UpdateRoadmapInput } from '../../types';
import { Dashboard } from './Dashboard';

export function DashboardPage() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updatingRoadmapId, setUpdatingRoadmapId] = useState<string | null>(null);
  const [deletingRoadmapId, setDeletingRoadmapId] = useState<string | null>(null);

  const loadRoadmaps = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.listRoadmaps();
      setRoadmaps(data.roadmaps);
    } catch (loadError) {
      setError(formatError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoadmaps();
  }, [loadRoadmaps]);

  const createRoadmap = useCallback(async (input: CreateRoadmapInput) => {
    setCreating(true);
    setError(null);

    try {
      const data = await api.createRoadmap(input);
      if (!data.roadmap) {
        throw new Error('Unable to create roadmap.');
      }
      navigate(`/workspace/${data.roadmap.id}`);
      return null;
    } catch (createError) {
      const message = formatError(createError);
      setError(message);
      return message;
    } finally {
      setCreating(false);
    }
  }, [navigate]);

  const updateRoadmap = useCallback(async (roadmapId: string, input: UpdateRoadmapInput) => {
    setUpdatingRoadmapId(roadmapId);
    setError(null);

    try {
      const data = await api.updateRoadmap(roadmapId, input);
      if (!data.roadmap) {
        throw new Error('Unable to update roadmap.');
      }
      const updatedRoadmap = data.roadmap;
      setRoadmaps((currentRoadmaps) =>
        currentRoadmaps.map((roadmap) =>
          roadmap.id === roadmapId
            ? { ...updatedRoadmap, nodeCount: roadmap.nodeCount }
            : roadmap,
        ),
      );
      return null;
    } catch (updateError) {
      const message = formatError(updateError);
      setError(message);
      return message;
    } finally {
      setUpdatingRoadmapId(null);
    }
  }, []);

  const deleteRoadmap = useCallback(async (roadmapId: string) => {
    setDeletingRoadmapId(roadmapId);
    setError(null);

    try {
      await api.deleteRoadmap(roadmapId);
      setRoadmaps((currentRoadmaps) => currentRoadmaps.filter((roadmap) => roadmap.id !== roadmapId));
      return null;
    } catch (deleteError) {
      const message = formatError(deleteError);
      setError(message);
      return message;
    } finally {
      setDeletingRoadmapId(null);
    }
  }, []);

  if (!user) {
    return null;
  }

  return (
    <Dashboard
      user={user}
      roadmaps={roadmaps}
      loading={loading}
      error={error}
      creating={creating}
      updatingRoadmapId={updatingRoadmapId}
      deletingRoadmapId={deletingRoadmapId}
      onRetry={loadRoadmaps}
      onSelectRoadmap={(roadmapId) => navigate(`/workspace/${roadmapId}`)}
      onCreateRoadmap={createRoadmap}
      onUpdateRoadmap={updateRoadmap}
      onDeleteRoadmap={deleteRoadmap}
      onSignOut={signOut}
    />
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to process the request.';
}
