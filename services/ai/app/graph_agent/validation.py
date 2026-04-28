from ..schemas import RoadmapGraph, ValidationReport


def validate_graph(graph: RoadmapGraph) -> ValidationReport:
    errors: list[str] = []
    warnings: list[str] = []
    node_type_ids = {definition.id for definition in graph.nodeTypes}
    edge_type_ids = {definition.id for definition in graph.edgeTypes}
    node_ids: set[str] = set()
    edge_ids: set[str] = set()

    for node in graph.nodes:
        if node.id in node_ids:
            errors.append(f"Duplicate node id: {node.id}")
        node_ids.add(node.id)
        if node.type not in node_type_ids:
            errors.append(f"Unsupported node type for {node.id}: {node.type}")
        if not node.data.title.strip():
            warnings.append(f"Node {node.id} has an empty title.")

    for edge in graph.edges:
        if edge.id in edge_ids:
            errors.append(f"Duplicate edge id: {edge.id}")
        edge_ids.add(edge.id)
        if edge.source not in node_ids or edge.target not in node_ids:
            errors.append(f"Edge {edge.id} connects a missing node.")
        if edge.data.kind not in edge_type_ids:
            errors.append(f"Unsupported edge type for {edge.id}: {edge.data.kind}")

    return ValidationReport(ok=not errors, errors=errors, warnings=warnings)
