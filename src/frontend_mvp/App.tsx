import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import {
  FileUp,
  GitBranch,
  Globe2,
  Link,
  LogOut,
  Plus,
  Save,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./lib/api";
import { authClient } from "./lib/auth-client";
import type {
  Artifact,
  CurrentUser,
  GraphEdgeData,
  GraphNodeData,
  Roadmap,
  RoadmapGraph,
  TypeDefinition,
} from "./types";

type FlowNode = Node<GraphNodeData, "roadmapNode">;
type FlowEdge = Edge<GraphEdgeData>;

const flowNodeTypes = {
  roadmapNode: RoadmapNode,
};

function App() {
  const path = window.location.pathname;
  if (path.startsWith("/u/")) {
    return <PublicProfilePage handle={decodeURIComponent(path.split("/")[2] || "")} />;
  }
  if (path.startsWith("/r/")) {
    return <PublicRoadmapPage slug={decodeURIComponent(path.split("/")[2] || "")} />;
  }

  return <WorkspaceApp />;
}

function WorkspaceApp() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then(({ user: nextUser }) => setUser(nextUser))
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
          return;
        }
        setAuthError(error instanceof Error ? error.message : "Unable to load user information.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <FullScreenMessage title="Open Roadmap" body="Preparing your workspace." />;
  }

  if (!user) {
    return <LoginScreen error={authError} />;
  }

  return (
    <ReactFlowProvider>
      <Dashboard user={user} onUserChange={setUser} />
    </ReactFlowProvider>
  );
}

function LoginScreen({ error }: { error: string | null }) {
  return (
    <main className="login">
      <section className="login-panel">
        <div className="brand-mark">O</div>
        <h1>Open Roadmap</h1>
        <p>Build goal roadmaps with AI and publish your real progress as a portfolio.</p>
        {error ? <p className="error-text">{error}</p> : null}
        <button
          className="primary-action"
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
        >
          <User size={18} />
          Continue with Google
        </button>
      </section>
    </main>
  );
}

function Dashboard({ user, onUserChange }: { user: CurrentUser; onUserChange: (user: CurrentUser) => void }) {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRoadmap, setSelectedRoadmap] = useState<Roadmap | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [nodeTypeDefs, setNodeTypeDefs] = useState<TypeDefinition[]>([]);
  const [edgeTypeDefs, setEdgeTypeDefs] = useState<TypeDefinition[]>([]);
  const [nodeKind, setNodeKind] = useState("objective");
  const [edgeKind, setEdgeKind] = useState("supports");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingRoadmapDelete, setConfirmingRoadmapDelete] = useState(false);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;

  const loadRoadmaps = useCallback(async () => {
    const data = await api.listRoadmaps();
    setRoadmaps(data.roadmaps);
    setSelectedId((current) => current ?? data.roadmaps[0]?.id ?? null);
  }, []);

  const loadRoadmap = useCallback(
    async (id: string) => {
      const [detail, graphData] = await Promise.all([api.getRoadmap(id), api.getGraph(id)]);
      setSelectedRoadmap(detail.roadmap);
      setArtifacts(detail.artifacts);
      setNodeTypeDefs(graphData.graph.nodeTypes);
      setEdgeTypeDefs(graphData.graph.edgeTypes);
      setNodeKind(graphData.graph.nodeTypes[0]?.id ?? "objective");
      setEdgeKind(graphData.graph.edgeTypes[0]?.id ?? "supports");
      setNodes(graphToFlowNodes(graphData.graph));
      setEdges(graphData.graph.edges as FlowEdge[]);
      setSelectedNodeId(null);
      setSelectedEdgeIds([]);
    },
    [setEdges, setNodes],
  );

  useEffect(() => {
    void loadRoadmaps().catch((error: unknown) => setNotice(formatError(error)));
  }, [loadRoadmaps]);

  useEffect(() => {
    if (selectedId) {
      void loadRoadmap(selectedId).catch((error: unknown) => setNotice(formatError(error)));
    }
  }, [loadRoadmap, selectedId]);

  useEffect(() => {
    setConfirmingRoadmapDelete(false);
  }, [selectedId]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            id: `edge-${crypto.randomUUID().slice(0, 8)}`,
            type: "smoothstep",
            label: findType(edgeTypeDefs, edgeKind)?.name ?? edgeKind,
            data: {
              kind: edgeKind,
              label: findType(edgeTypeDefs, edgeKind)?.name ?? edgeKind,
              metadata: {},
            },
          },
          currentEdges,
        ),
      );
    },
    [edgeKind, edgeTypeDefs, setEdges],
  );

  const onSelectionChange = useCallback((selection: OnSelectionChangeParams<FlowNode, FlowEdge>) => {
    setSelectedNodeId(selection.nodes[0]?.id ?? null);
    setSelectedEdgeIds(selection.edges.map((edge) => edge.id));
  }, []);

  async function createNewRoadmap() {
    setBusy(true);
    setNotice(null);
    try {
      const data = await api.createRoadmap({
        title: "New Roadmap",
        summary: "Organize goals and progress events with AI.",
      });
      await loadRoadmaps();
      setSelectedId(data.roadmap.id);
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedRoadmap() {
    if (!selectedRoadmap) {
      return;
    }

    const deletedId = selectedRoadmap.id;
    const remainingRoadmaps = roadmaps.filter((roadmap) => roadmap.id !== deletedId);
    const nextSelectedId = remainingRoadmaps[0]?.id ?? null;

    setBusy(true);
    setNotice(null);
    try {
      await api.deleteRoadmap(deletedId);
      setRoadmaps(remainingRoadmaps);
      setSelectedId(nextSelectedId);
      setConfirmingRoadmapDelete(false);
      setNotice("Roadmap deleted.");

      if (!nextSelectedId) {
        setSelectedRoadmap(null);
        setArtifacts([]);
        setNodeTypeDefs([]);
        setEdgeTypeDefs([]);
        setNodes([]);
        setEdges([]);
      }
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveGraph() {
    if (!selectedRoadmap) {
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const graph = flowToGraph(nodes, edges, nodeTypeDefs, edgeTypeDefs);
      const data = await api.saveGraph(selectedRoadmap.id, graph);
      setNodeTypeDefs(data.graph.nodeTypes);
      setEdgeTypeDefs(data.graph.edgeTypes);
      setNodes(graphToFlowNodes(data.graph));
      setEdges(data.graph.edges as FlowEdge[]);
      setNotice("Graph saved.");
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  function addNode() {
    const id = `${nodeKind}-${crypto.randomUUID().slice(0, 8)}`;
    const typeDef = findType(nodeTypeDefs, nodeKind);
    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id,
        type: "roadmapNode",
        position: {
          x: 120 + currentNodes.length * 34,
          y: 120 + currentNodes.length * 28,
        },
        data: {
          title: `${typeDef?.name ?? "Custom"} Node`,
          description: "",
          status: "planned",
          metadata: {},
          typeId: nodeKind,
          typeName: typeDef?.name ?? nodeKind,
          color: typeDef?.color ?? "#2c7a6f",
          icon: typeDef?.icon ?? "circle",
        },
      },
    ]);
  }

  function deleteSelection() {
    const nodeIds = new Set(selectedNodeId ? [selectedNodeId] : []);
    const edgeIds = new Set(selectedEdgeIds);
    setNodes((currentNodes) => currentNodes.filter((node) => !nodeIds.has(node.id)));
    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target),
      ),
    );
    setSelectedNodeId(null);
    setSelectedEdgeIds([]);
  }

  async function reloadSelected() {
    if (selectedId) {
      await loadRoadmap(selectedId);
      await loadRoadmaps();
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <div className="brand-row">
              <span className="brand-mark small">O</span>
              <strong>Open Roadmap</strong>
            </div>
            <span className="muted">{user.profile.displayName}</span>
          </div>
          <button className="icon-button" title="Sign out" onClick={() => authClient.signOut()}>
            <LogOut size={18} />
          </button>
        </div>

        <ProfilePanel user={user} onUserChange={onUserChange} />

        <div className="section-heading">
          <span>Roadmaps</span>
          <button className="icon-button" title="Add roadmap" onClick={createNewRoadmap} disabled={busy}>
            <Plus size={17} />
          </button>
        </div>
        <nav className="roadmap-list">
          {roadmaps.map((roadmap) => (
            <button
              key={roadmap.id}
              className={roadmap.id === selectedId ? "roadmap-item active" : "roadmap-item"}
              onClick={() => setSelectedId(roadmap.id)}
            >
              <span>{roadmap.title}</span>
              {roadmap.status === "published" ? <Globe2 size={14} /> : <GitBranch size={14} />}
            </button>
          ))}
        </nav>

        {selectedRoadmap ? (
          <div className="roadmap-delete-card">
            {confirmingRoadmapDelete ? (
              <>
                <p>Delete "{selectedRoadmap.title}" permanently?</p>
                <div className="inline-actions">
                  <button className="mini-button" onClick={() => setConfirmingRoadmapDelete(false)} disabled={busy}>
                    Cancel
                  </button>
                  <button className="mini-button danger" onClick={deleteSelectedRoadmap} disabled={busy}>
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <button className="mini-button danger full-width" onClick={() => setConfirmingRoadmapDelete(true)}>
                <Trash2 size={14} />
                Delete this Roadmap
              </button>
            )}
          </div>
        ) : null}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <RoadmapTitleEditor
            roadmap={selectedRoadmap}
            onSaved={(roadmap) => {
              setSelectedRoadmap(roadmap);
              void loadRoadmaps();
            }}
          />
          <div className="toolbar">
            <select value={nodeKind} onChange={(event) => setNodeKind(event.target.value)}>
              {nodeTypeDefs.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
            <button className="tool-button" onClick={addNode}>
              <Plus size={16} />
              Node
            </button>
            <select value={edgeKind} onChange={(event) => setEdgeKind(event.target.value)}>
              {edgeTypeDefs.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                </option>
              ))}
            </select>
            <button className="tool-button danger" onClick={deleteSelection}>
              <Trash2 size={16} />
            </button>
            <button className="tool-button primary" onClick={saveGraph} disabled={!selectedRoadmap || busy}>
              <Save size={16} />
              Save
            </button>
          </div>
        </header>

        {notice ? <div className="notice">{notice}</div> : null}

        <div className="workspace-grid">
          <div className="canvas-panel">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={flowNodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              fitView
            >
              <Background />
              <MiniMap pannable zoomable />
              <Controls />
            </ReactFlow>
          </div>

          <aside className="inspector">
            <NodeInspector node={selectedNode} nodeTypes={nodeTypeDefs} setNodes={setNodes} />
            {selectedRoadmap ? (
              <>
                <TypePanel
                  roadmap={selectedRoadmap}
                  nodeTypes={nodeTypeDefs}
                  edgeTypes={edgeTypeDefs}
                  onNodeTypesChange={(definitions) => {
                    setNodeTypeDefs(definitions);
                    setNodeKind(definitions.at(-1)?.id ?? nodeKind);
                  }}
                  onEdgeTypesChange={(definitions) => {
                    setEdgeTypeDefs(definitions);
                    setEdgeKind(definitions.at(-1)?.id ?? edgeKind);
                  }}
                  onNotice={setNotice}
                />
                <ArtifactPanel
                  roadmap={selectedRoadmap}
                  artifacts={artifacts}
                  onArtifactsChange={setArtifacts}
                  onNotice={setNotice}
                />
                <AgentPanel
                  roadmap={selectedRoadmap}
                  artifacts={artifacts}
                  onGraph={(graph) => {
                    setNodeTypeDefs(graph.nodeTypes);
                    setEdgeTypeDefs(graph.edgeTypes);
                    setNodes(graphToFlowNodes(graph));
                    setEdges(graph.edges as FlowEdge[]);
                  }}
                  onNotice={setNotice}
                  onReload={reloadSelected}
                />
                <PublishPanel
                  roadmap={selectedRoadmap}
                  artifacts={artifacts}
                  onPublished={(roadmap) => {
                    setSelectedRoadmap(roadmap);
                    void loadRoadmaps();
                  }}
                  onNotice={setNotice}
                />
              </>
            ) : (
              <EmptyPanel />
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function RoadmapNode({ data }: NodeProps<FlowNode>) {
  return (
    <div className="roadmap-node" style={{ borderLeftColor: data.color ?? "#2c7a6f" }}>
      <Handle className="node-handle input" type="target" position={Position.Left} />
      <span>{data.typeName ?? data.typeId ?? "Node"}</span>
      <strong>{data.title}</strong>
      {data.description ? <p>{data.description}</p> : null}
      <Handle className="node-handle output" type="source" position={Position.Right} />
    </div>
  );
}

function ProfilePanel({
  user,
  onUserChange,
}: {
  user: CurrentUser;
  onUserChange: (user: CurrentUser) => void;
}) {
  const [handle, setHandle] = useState(user.profile.handle);
  const [displayName, setDisplayName] = useState(user.profile.displayName);
  const [bio, setBio] = useState(user.profile.bio);
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    setSaving(true);
    try {
      const data = await api.updateProfile({ handle, displayName, bio });
      onUserChange({
        ...user,
        profile: data.profile,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel slim">
      <label>
        Handle
        <input value={handle} onChange={(event) => setHandle(event.target.value)} />
      </label>
      <label>
        Name
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </label>
      <label>
        Bio
        <textarea rows={2} value={bio} onChange={(event) => setBio(event.target.value)} />
      </label>
      <div className="inline-actions">
        <a href={`/u/${user.profile.handle}`} target="_blank" rel="noreferrer">
          <Link size={14} />
          Public profile
        </a>
        <button className="mini-button" onClick={saveProfile} disabled={saving}>
          Save
        </button>
      </div>
    </section>
  );
}

function RoadmapTitleEditor({
  roadmap,
  onSaved,
}: {
  roadmap: Roadmap | null;
  onSaved: (roadmap: Roadmap) => void;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    setTitle(roadmap?.title ?? "");
    setSummary(roadmap?.summary ?? "");
  }, [roadmap]);

  async function save() {
    if (!roadmap) {
      return;
    }

    const data = await api.updateRoadmap(roadmap.id, { title, summary });
    onSaved(data.roadmap);
  }

  return (
    <div className="title-editor">
      <input value={title} placeholder="Roadmap title" onChange={(event) => setTitle(event.target.value)} />
      <input
        value={summary}
        placeholder="One-line summary"
        onChange={(event) => setSummary(event.target.value)}
      />
      <button className="mini-button" onClick={save} disabled={!roadmap}>
        Save
      </button>
    </div>
  );
}

function NodeInspector({
  node,
  nodeTypes,
  setNodes,
}: {
  node: FlowNode | null;
  nodeTypes: TypeDefinition[];
  setNodes: ReturnType<typeof useNodesState<FlowNode>>[1];
}) {
  if (!node) {
    return (
      <section className="panel">
        <h2>Node</h2>
        <p className="muted">Select a node on the canvas to edit goals and records.</p>
      </section>
    );
  }

  function updateData(nextData: Partial<GraphNodeData>) {
    setNodes((currentNodes) =>
      currentNodes.map((candidate) =>
        candidate.id === node.id
          ? {
              ...candidate,
              data: {
                ...candidate.data,
                ...nextData,
              },
            }
          : candidate,
      ),
    );
  }

  function updateType(typeId: string) {
    const definition = findType(nodeTypes, typeId);
    updateData({
      typeId,
      typeName: definition?.name ?? typeId,
      color: definition?.color ?? "#2c7a6f",
      icon: definition?.icon ?? "circle",
    });
  }

  return (
    <section className="panel">
      <h2>{node.data.typeName ?? "Node"}</h2>
      <label>
        Type
        <select value={node.data.typeId ?? "objective"} onChange={(event) => updateType(event.target.value)}>
          {nodeTypes.map((definition) => (
            <option key={definition.id} value={definition.id}>
              {definition.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Title
        <input value={node.data.title} onChange={(event) => updateData({ title: event.target.value })} />
      </label>
      <label>
        Description
        <textarea
          rows={4}
          value={node.data.description}
          onChange={(event) => updateData({ description: event.target.value })}
        />
      </label>
      <label>
        Status
        <input value={node.data.status} onChange={(event) => updateData({ status: event.target.value })} />
      </label>
    </section>
  );
}

function TypePanel({
  roadmap,
  nodeTypes,
  edgeTypes,
  onNodeTypesChange,
  onEdgeTypesChange,
  onNotice,
}: {
  roadmap: Roadmap;
  nodeTypes: TypeDefinition[];
  edgeTypes: TypeDefinition[];
  onNodeTypesChange: (types: TypeDefinition[]) => void;
  onEdgeTypesChange: (types: TypeDefinition[]) => void;
  onNotice: (notice: string | null) => void;
}) {
  const [nodeName, setNodeName] = useState("");
  const [edgeName, setEdgeName] = useState("");
  const [nodeColor, setNodeColor] = useState("#2c7a6f");
  const [edgeColor, setEdgeColor] = useState("#4469a8");
  const [saving, setSaving] = useState(false);

  async function addType(scope: "node" | "edge") {
    const name = scope === "node" ? nodeName : edgeName;
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    try {
      const data = await api.createType(roadmap.id, {
        scope,
        name,
        color: scope === "node" ? nodeColor : edgeColor,
      });
      if (scope === "node") {
        onNodeTypesChange([...nodeTypes, data.type]);
        setNodeName("");
      } else {
        onEdgeTypesChange([...edgeTypes, data.type]);
        setEdgeName("");
      }
      onNotice(`Added ${data.type.name} type.`);
    } catch (error) {
      onNotice(formatError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <h2>Types</h2>
      <div className="type-create-row">
        <input value={nodeName} placeholder="New node type" onChange={(event) => setNodeName(event.target.value)} />
        <input
          className="color-input"
          type="color"
          value={nodeColor}
          onChange={(event) => setNodeColor(event.target.value)}
        />
        <button className="icon-button" title="Add node type" onClick={() => addType("node")} disabled={saving}>
          <Plus size={16} />
        </button>
      </div>
      <div className="type-create-row">
        <input value={edgeName} placeholder="New edge type" onChange={(event) => setEdgeName(event.target.value)} />
        <input
          className="color-input"
          type="color"
          value={edgeColor}
          onChange={(event) => setEdgeColor(event.target.value)}
        />
        <button className="icon-button" title="Add edge type" onClick={() => addType("edge")} disabled={saving}>
          <Plus size={16} />
        </button>
      </div>
      <div className="type-chip-list">
        {nodeTypes.map((definition) => (
          <span key={`node-${definition.id}`} style={{ borderColor: definition.color }}>
            {definition.name}
          </span>
        ))}
        {edgeTypes.map((definition) => (
          <span key={`edge-${definition.id}`} style={{ borderColor: definition.color }}>
            {definition.name}
          </span>
        ))}
      </div>
    </section>
  );
}

function ArtifactPanel({
  roadmap,
  artifacts,
  onArtifactsChange,
  onNotice,
}: {
  roadmap: Roadmap;
  artifacts: Artifact[];
  onArtifactsChange: (artifacts: Artifact[]) => void;
  onNotice: (notice: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function uploadFile(file: File) {
    const form = new FormData();
    form.set("file", file);
    form.set("roadmapId", roadmap.id);
    const data = await api.uploadArtifact(form);
    onArtifactsChange([data.artifact, ...artifacts]);
    onNotice("File uploaded.");
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Evidence</h2>
        <button className="icon-button" title="Upload file" onClick={() => fileRef.current?.click()}>
          <FileUp size={17} />
        </button>
      </div>
      <input
        ref={fileRef}
        className="hidden"
        type="file"
        accept=".txt,.md,.markdown,.pdf,image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void uploadFile(file).catch((error: unknown) => onNotice(formatError(error)));
          }
          event.currentTarget.value = "";
        }}
      />
      <div className="artifact-list">
        {artifacts.map((artifact) => (
          <a key={artifact.id} href={artifact.fileUrl ?? "#"} target="_blank" rel="noreferrer">
            <span>{artifact.title}</span>
            <small>{formatFileSize(artifact.size)}</small>
          </a>
        ))}
        {artifacts.length === 0 ? <p className="muted">Attach PDFs, images, and text records.</p> : null}
      </div>
    </section>
  );
}

function AgentPanel({
  roadmap,
  artifacts,
  onGraph,
  onNotice,
  onReload,
}: {
  roadmap: Roadmap;
  artifacts: Artifact[];
  onGraph: (graph: RoadmapGraph) => void;
  onNotice: (notice: string | null) => void;
  onReload: () => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [selectedArtifacts, setSelectedArtifacts] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  async function runAgent() {
    setRunning(true);
    onNotice(null);
    try {
      const data = await api.runAgent(roadmap.id, { content, artifactIds: selectedArtifacts });
      onGraph(data.graph);
      setContent("");
      onNotice(data.summary);
      await onReload();
    } catch (error) {
      onNotice(formatError(error));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>AI Generation</h2>
        <Sparkles size={17} />
      </div>
      <textarea
        rows={4}
        placeholder="Describe your goal, timeline, current state, and desired portfolio direction."
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="check-list">
        {artifacts.map((artifact) => (
          <label key={artifact.id}>
            <input
              type="checkbox"
              checked={selectedArtifacts.includes(artifact.id)}
              onChange={(event) =>
                setSelectedArtifacts((current) =>
                  event.target.checked
                    ? [...current, artifact.id]
                    : current.filter((id) => id !== artifact.id),
                )
              }
            />
            {artifact.title}
          </label>
        ))}
      </div>
      <button className="primary-action compact" onClick={runAgent} disabled={running || !content.trim()}>
        <Sparkles size={16} />
        Generate roadmap draft
      </button>
    </section>
  );
}

function PublishPanel({
  roadmap,
  artifacts,
  onPublished,
  onNotice,
}: {
  roadmap: Roadmap;
  artifacts: Artifact[];
  onPublished: (roadmap: Roadmap) => void;
  onNotice: (notice: string | null) => void;
}) {
  const [publicTitle, setPublicTitle] = useState(roadmap.publicTitle ?? roadmap.title);
  const [publicSummary, setPublicSummary] = useState(roadmap.publicSummary ?? roadmap.summary);
  const [slug, setSlug] = useState(roadmap.slug ?? slugify(roadmap.title));
  const [artifactIds, setArtifactIds] = useState<string[]>(artifacts.filter((item) => item.isPublic).map((item) => item.id));
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    setPublicTitle(roadmap.publicTitle ?? roadmap.title);
    setPublicSummary(roadmap.publicSummary ?? roadmap.summary);
    setSlug(roadmap.slug ?? slugify(roadmap.title));
  }, [roadmap]);

  useEffect(() => {
    setArtifactIds(artifacts.filter((item) => item.isPublic).map((item) => item.id));
  }, [artifacts]);

  async function publish() {
    setPublishing(true);
    try {
      const data = await api.publish(roadmap.id, { publicTitle, publicSummary, slug, artifactIds });
      onPublished(data.roadmap);
      onNotice("Published as a public portfolio.");
    } catch (error) {
      onNotice(formatError(error));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Publish</h2>
        <Globe2 size={17} />
      </div>
      <label>
        Public title
        <input value={publicTitle} onChange={(event) => setPublicTitle(event.target.value)} />
      </label>
      <label>
        Public summary
        <textarea rows={3} value={publicSummary} onChange={(event) => setPublicSummary(event.target.value)} />
      </label>
      <label>
        Slug
        <input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
      </label>
      <div className="check-list">
        {artifacts.map((artifact) => (
          <label key={artifact.id}>
            <input
              type="checkbox"
              checked={artifactIds.includes(artifact.id)}
              onChange={(event) =>
                setArtifactIds((current) =>
                  event.target.checked
                    ? [...current, artifact.id]
                    : current.filter((id) => id !== artifact.id),
                )
              }
            />
            {artifact.title}
          </label>
        ))}
      </div>
      <button className="primary-action compact" onClick={publish} disabled={publishing || !slug}>
        <Globe2 size={16} />
        Publish
      </button>
      {roadmap.slug ? (
        <a className="public-link" href={`/r/${roadmap.slug}`} target="_blank" rel="noreferrer">
          /r/{roadmap.slug}
        </a>
      ) : null}
    </section>
  );
}

function PublicProfilePage({ handle }: { handle: string }) {
  const [data, setData] = useState<{ profile: { displayName: string; bio: string }; roadmaps: Roadmap[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .publicUser(handle)
      .then(setData)
      .catch((nextError: unknown) => setError(formatError(nextError)));
  }, [handle]);

  if (error) {
    return <FullScreenMessage title="Profile not found" body={error} />;
  }
  if (!data) {
    return <FullScreenMessage title="Open Roadmap" body="Loading public profile." />;
  }

  return (
    <main className="public-page">
      <header className="public-header">
        <span className="brand-mark small">O</span>
        <div>
          <h1>{data.profile.displayName}</h1>
          <p>{data.profile.bio || "Published roadmap portfolio"}</p>
        </div>
      </header>
      <section className="public-roadmaps">
        {data.roadmaps.map((roadmap) => (
          <a key={roadmap.id} className="public-card" href={`/r/${roadmap.slug}`}>
            <span>{roadmap.publicTitle ?? roadmap.title}</span>
            <p>{roadmap.publicSummary ?? roadmap.summary}</p>
          </a>
        ))}
      </section>
    </main>
  );
}

function PublicRoadmapPage({ slug }: { slug: string }) {
  const [data, setData] = useState<{
    roadmap: Roadmap;
    graph: RoadmapGraph;
    artifacts: Artifact[];
    profile: { displayName: string; handle: string } | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .publicRoadmap(slug)
      .then(setData)
      .catch((nextError: unknown) => setError(formatError(nextError)));
  }, [slug]);

  if (error) {
    return <FullScreenMessage title="Roadmap not found" body={error} />;
  }
  if (!data) {
    return <FullScreenMessage title="Open Roadmap" body="Loading public roadmap." />;
  }

  return (
    <main className="public-roadmap-page">
      <header className="public-roadmap-header">
        <a href={data.profile ? `/u/${data.profile.handle}` : "/"}>{data.profile?.displayName ?? "Open Roadmap"}</a>
        <h1>{data.roadmap.publicTitle ?? data.roadmap.title}</h1>
        <p>{data.roadmap.publicSummary ?? data.roadmap.summary}</p>
      </header>
      <section className="public-canvas">
        <ReactFlow
          nodes={graphToFlowNodes(data.graph)}
          edges={data.graph.edges as FlowEdge[]}
          nodeTypes={flowNodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </section>
      <section className="public-artifacts">
        {data.artifacts.map((artifact) => (
          <a key={artifact.id} href={artifact.fileUrl ?? "#"} target="_blank" rel="noreferrer">
            {artifact.title}
          </a>
        ))}
      </section>
    </main>
  );
}

function EmptyPanel() {
  return (
    <section className="panel">
      <h2>Get started</h2>
      <p className="muted">Create a roadmap on the left to open the canvas and AI generation tools.</p>
    </section>
  );
}

function FullScreenMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="center-screen">
      <div className="brand-mark">O</div>
      <h1>{title}</h1>
      <p>{body}</p>
    </main>
  );
}

function graphToFlowNodes(graph: RoadmapGraph): FlowNode[] {
  return graph.nodes.map((node) => {
    const definition = findType(graph.nodeTypes, node.type);
    return {
      id: node.id,
      type: "roadmapNode",
      position: node.position,
      data: {
        ...node.data,
        typeId: node.type,
        typeName: definition?.name ?? node.type,
        color: definition?.color ?? "#2c7a6f",
        icon: definition?.icon ?? "circle",
      },
    };
  });
}

function flowToGraph(
  nodes: FlowNode[],
  edges: FlowEdge[],
  nodeTypes: TypeDefinition[],
  edgeTypes: TypeDefinition[],
): RoadmapGraph {
  return {
    nodeTypes,
    edgeTypes,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.data.typeId ?? nodeTypes[0]?.id ?? "objective",
      position: node.position,
      data: {
        title: node.data.title,
        description: node.data.description,
        status: node.data.status,
        metadata: node.data.metadata ?? {},
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      label: edge.label ? String(edge.label) : edge.data?.label ?? "",
      data: {
        kind: edge.data?.kind ?? edgeTypes[0]?.id ?? "supports",
        label: edge.data?.label ?? (edge.label ? String(edge.label) : ""),
        metadata: edge.data?.metadata ?? {},
      },
    })),
  };
}

function findType(definitions: TypeDefinition[], id: string | undefined): TypeDefinition | undefined {
  return definitions.find((definition) => definition.id === id);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default App;
