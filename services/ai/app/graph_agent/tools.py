from typing import Any

from .graph_tools import GraphToolRuntime


def build_graph_tools(runtime: GraphToolRuntime) -> list[Any]:
    from langchain.tools import tool

    @tool
    def read_graph() -> dict[str, object]:
        """Read a compact overview of the current roadmap graph or draft graph."""
        return runtime.read_graph()

    @tool
    def search_graph(query: str, node_type: str | None = None, limit: int = 5) -> dict[str, object]:
        """Search the roadmap graph and return matching nodes plus neighboring edges."""
        return runtime.search_graph(query=query, node_type=node_type, limit=limit)

    @tool
    def start_graph_draft() -> dict[str, object]:
        """Start a draft by copying the current roadmap graph."""
        return runtime.start_graph_draft()

    @tool
    def scaffold_graph_from_objective(objective: str | None = None) -> dict[str, object]:
        """Create a new scaffold draft graph for the user's objective."""
        return runtime.scaffold_graph_from_objective(objective=objective)

    @tool
    def create_node(
        title: str,
        node_type: str = "milestone",
        description: str = "",
        status: str = "planned",
    ) -> dict[str, object]:
        """Create one node in the draft graph."""
        return runtime.create_node(title=title, node_type=node_type, description=description, status=status)

    @tool
    def create_edge(source: str, target: str, kind: str = "supports", label: str | None = None) -> dict[str, object]:
        """Create one typed edge in the draft graph."""
        return runtime.create_edge(source=source, target=target, kind=kind, label=label)

    @tool
    def delete_node(node_id: str) -> dict[str, object]:
        """Delete one node from the draft graph and remove all connected edges."""
        return runtime.delete_node(node_id=node_id)

    @tool
    def delete_edge(edge_id: str) -> dict[str, object]:
        """Delete one edge from the draft graph."""
        return runtime.delete_edge(edge_id=edge_id)

    @tool
    def clear_graph() -> dict[str, object]:
        """Delete all nodes and edges from the draft graph."""
        return runtime.clear_graph()

    @tool
    def validate_graph() -> dict[str, object]:
        """Validate the active graph or draft graph."""
        return runtime.validate_graph()

    return [
        read_graph,
        search_graph,
        start_graph_draft,
        scaffold_graph_from_objective,
        create_node,
        create_edge,
        delete_node,
        delete_edge,
        clear_graph,
        validate_graph,
    ]
