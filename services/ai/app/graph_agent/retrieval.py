from ..schemas import GraphNode, RoadmapGraph


def graph_overview(graph: RoadmapGraph) -> dict[str, object]:
    return {
        "nodeCount": len(graph.nodes),
        "edgeCount": len(graph.edges),
        "nodeTypes": [definition.model_dump() for definition in graph.nodeTypes],
        "edgeTypes": [definition.model_dump() for definition in graph.edgeTypes],
        "nodes": [_node_summary(node) for node in graph.nodes[:20]],
        "edges": [
            {
                "id": edge.id,
                "source": edge.source,
                "target": edge.target,
                "kind": edge.data.kind,
                "label": edge.data.label or edge.label,
            }
            for edge in graph.edges[:30]
        ],
    }


def search_graph(
    graph: RoadmapGraph,
    query: str,
    node_type: str | None = None,
    limit: int = 5,
) -> dict[str, object]:
    terms = [term for term in query.lower().replace("-", " ").split() if len(term) > 1]
    scored: list[tuple[int, GraphNode]] = []

    for node in graph.nodes:
        if node_type and node.type != node_type:
            continue
        haystack = f"{node.id} {node.type} {node.data.title} {node.data.description}".lower()
        score = sum(1 for term in terms if term in haystack)
        if score or not terms:
            scored.append((score, node))

    scored.sort(key=lambda item: (-item[0], item[1].id))
    selected = [node for _, node in scored[: max(1, min(limit, 20))]]
    selected_ids = {node.id for node in selected}

    return {
        "query": query,
        "nodes": [_node_summary(node) for node in selected],
        "edges": [
            {
                "id": edge.id,
                "source": edge.source,
                "target": edge.target,
                "kind": edge.data.kind,
                "label": edge.data.label or edge.label,
            }
            for edge in graph.edges
            if edge.source in selected_ids or edge.target in selected_ids
        ],
    }


def _node_summary(node: GraphNode) -> dict[str, object]:
    return {
        "id": node.id,
        "type": node.type,
        "title": node.data.title,
        "description": node.data.description[:240],
        "status": node.data.status,
        "metadata": node.data.metadata,
    }
