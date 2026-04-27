import type {
  Artifact,
  CreateRoadmapInput,
  CurrentUser,
  PublicProfile,
  PublishRoadmapInput,
  Roadmap,
  RoadmapGraph,
  SaveRoadmapGraphInput,
  UpdateArtifactInput,
  UpdateProfileInput,
  UpdateRoadmapInput,
  UserProfile,
} from "../types";

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
  updateProfile: (body: UpdateProfileInput) =>
    apiRequest<{ profile: UserProfile }>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  listRoadmaps: () => apiRequest<{ roadmaps: Roadmap[] }>("/api/roadmaps"),
  createRoadmap: (body: CreateRoadmapInput) =>
    apiRequest<{ roadmap: Roadmap | null }>("/api/roadmaps", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateRoadmap: (id: string, body: UpdateRoadmapInput) =>
    apiRequest<{ roadmap: Roadmap | null }>(`/api/roadmaps/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteRoadmap: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/roadmaps/${id}`, {
      method: "DELETE",
    }),
  getRoadmap: (id: string) =>
    apiRequest<{ roadmap: Roadmap; artifacts: Artifact[] }>(`/api/roadmaps/${id}`),
  getGraph: (id: string) => apiRequest<{ graph: RoadmapGraph }>(`/api/roadmaps/${id}/graph`),
  saveGraph: (id: string, graph: SaveRoadmapGraphInput) =>
    apiRequest<{ graph: RoadmapGraph }>(`/api/roadmaps/${id}/graph`, {
      method: "PATCH",
      body: JSON.stringify({ graph }),
    }),
  publishRoadmap: (id: string, body: PublishRoadmapInput) =>
    apiRequest<{ roadmap: Roadmap | null }>(`/api/roadmaps/${id}/publish`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  uploadArtifact: (body: FormData) =>
    apiRequest<{ artifact: Artifact | null }>("/api/uploads", {
      method: "POST",
      body,
    }),
  updateArtifact: (id: string, body: UpdateArtifactInput) =>
    apiRequest<{ artifact: Artifact | null }>(`/api/artifacts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteArtifact: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/artifacts/${id}`, {
      method: "DELETE",
    }),
  getPublicProfile: (handle: string) =>
    apiRequest<{ profile: PublicProfile; roadmaps: Roadmap[] }>(
      `/api/public/users/${encodeURIComponent(handle)}`,
    ),
  getPublicRoadmap: (slug: string) =>
    apiRequest<{
      profile: PublicProfile | null;
      roadmap: Roadmap;
      graph: RoadmapGraph;
      artifacts: Artifact[];
    }>(`/api/public/roadmaps/${encodeURIComponent(slug)}`),
};
