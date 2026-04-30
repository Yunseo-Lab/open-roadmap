import { normalizeGraph } from "../../shared/graph";
import type { AppEnv, RoadmapGraph } from "../types";
import { buildUserContent, type ArtifactPromptPart, type OpenRouterContentPart } from "./artifact-prompts";
import { applyToolCall, describeTypes, parseToolArguments } from "./graph-tools";
import { readResponsePreview } from "./response-preview";
import { roadmapTools } from "./tool-schema";
import type { AgentOperation, AgentResult } from "./types";

type OpenRouterMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | OpenRouterContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type ToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

// Runs a tool-calling loop where the model proposes graph edits and local code applies them.
export async function callOpenRouterAgent(
  env: AppEnv,
  startingGraph: RoadmapGraph,
  message: string,
  artifacts: ArtifactPromptPart[],
): Promise<AgentResult> {
  const model = env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";
  const draft: RoadmapGraph = structuredClone(startingGraph);
  const operations: AgentOperation[] = [];
  const userContent = await buildUserContent(message, artifacts);

  const messages: OpenRouterMessage[] = [
    {
      role: "system",
      content:
        "You are Open Roadmap's roadmap graph generation agent. Build goal-oriented graphs from the user's documents and conversation. " +
        "Modify the graph only through the provided tools. Prefer the default types, but create new node or edge types when the user's thinking structure needs them. " +
        `Current node types: ${describeTypes(startingGraph.nodeTypes)}. ` +
        `Current edge types: ${describeTypes(startingGraph.edgeTypes)}. ` +
        "After tool calls, respond with a one or two sentence summary in English.",
    },
    {
      role: "user",
      content: userContent,
    },
  ];

  // Keep the loop bounded so one request cannot run indefinitely.
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.BETTER_AUTH_URL,
        "X-Title": "Open Roadmap",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: roadmapTools,
        tool_choice: "auto",
        parallel_tool_calls: false,
        plugins: [
          {
            id: "file-parser",
            pdf: {
              engine: "cloudflare-ai",
            },
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await readResponsePreview(response);
      throw new Error(`OpenRouter request failed: ${response.status} ${errorText.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: OpenRouterMessage;
      }>;
    };
    const assistantMessage = payload.choices?.[0]?.message;
    if (!assistantMessage) {
      throw new Error("OpenRouter response did not include an assistant message.");
    }

    messages.push(assistantMessage);
    const toolCalls = assistantMessage.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        graph: normalizeGraph(draft),
        summary:
          typeof assistantMessage.content === "string" && assistantMessage.content.trim()
            ? assistantMessage.content.trim()
            : "Updated the roadmap draft.",
        operations,
        model,
      };
    }

    // Tool calls are applied to a draft graph before being persisted.
    for (const toolCall of toolCalls) {
      const args = parseToolArguments(toolCall.function.arguments);
      const result = applyToolCall(draft, artifacts, toolCall.function.name, args);
      operations.push({
        tool: toolCall.function.name,
        args,
        result,
      });
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    graph: normalizeGraph(draft),
    summary: "Reached the tool call limit and saved the current roadmap draft.",
    operations,
    model,
  };
}
