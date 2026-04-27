import type { Artifact, CurrentUser, PublicProfile, Roadmap, RoadmapGraph, TypeDefinition } from "../types";

type ApiResponse<T> = T & {
  error?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  const data = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok) {
    throw new ApiError(data.error || "Request failed.", response.status);
  }

  return data;
}

export const api = {
  me: () => apiRequest<{ user: CurrentUser }>("/api/me"),
  updateProfile: (body: { handle: string; displayName: string; bio: string }) =>
    apiRequest<{ profile: CurrentUser["profile"] }>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  listRoadmaps: () => apiRequest<{ roadmaps: Roadmap[] }>("/api/roadmaps"),
  createRoadmap: (body: { title: string; summary: string }) =>
    apiRequest<{ roadmap: Roadmap }>("/api/roadmaps", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateRoadmap: (id: string, body: { title: string; summary: string }) =>
    apiRequest<{ roadmap: Roadmap }>(`/api/roadmaps/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  getRoadmap: (id: string) =>
    apiRequest<{ roadmap: Roadmap; artifacts: Artifact[] }>(`/api/roadmaps/${id}`),
  deleteRoadmap: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/roadmaps/${id}`, {
      method: "DELETE",
    }),
  getGraph: (id: string) => apiRequest<{ graph: RoadmapGraph }>(`/api/roadmaps/${id}/graph`),
  createType: (
    id: string,
    body: {
      scope: "node" | "edge";
      name: string;
      color: string;
      description?: string;
      icon?: string;
    },
  ) =>
    apiRequest<{ type: TypeDefinition }>(`/api/roadmaps/${id}/types`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  saveGraph: (id: string, graph: RoadmapGraph) =>
    apiRequest<{ graph: RoadmapGraph }>(`/api/roadmaps/${id}/graph`, {
      method: "PATCH",
      body: JSON.stringify({ graph }),
    }),
  uploadArtifact: (form: FormData) =>
    apiRequest<{ artifact: Artifact }>("/api/uploads", {
      method: "POST",
      body: form,
    }),
  runAgent: (id: string, body: { content: string; artifactIds: string[] }) =>
    apiRequest<{
      summary: string;
      operations: Array<Record<string, unknown>>;
      graph: RoadmapGraph;
    }>(`/api/roadmaps/${id}/agent/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  publish: (
    id: string,
    body: {
      publicTitle: string;
      publicSummary: string;
      slug: string;
      artifactIds: string[];
    },
  ) =>
    apiRequest<{ roadmap: Roadmap }>(`/api/roadmaps/${id}/publish`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  publicUser: (handle: string) =>
    apiRequest<{ profile: PublicProfile; roadmaps: Roadmap[] }>(`/api/public/users/${handle}`),
  publicRoadmap: (slug: string) =>
    apiRequest<{
      profile: PublicProfile | null;
      roadmap: Roadmap;
      graph: RoadmapGraph;
      artifacts: Artifact[];
    }>(`/api/public/roadmaps/${slug}`),
};
