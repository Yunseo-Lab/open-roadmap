import { Hono } from "hono";
import { runRoadmapAgent, runRoadmapAgentStream, type AgentInput, type AgentResult } from "../ai";
import {
  createAgentConversation,
  getAgentConversationForUser,
  getOrCreateAgentConversation,
  listAgentConversations,
  listAgentMessages,
  listRecentAgentHistory,
  recordAgentUserMessage,
  toAgentConversationPayload,
  type AgentConversationRow,
} from "../db/agent-conversations";
import { recordAgentFailure, recordAgentSuccess } from "../db/agent-runs";
import {
  getOwnedRoadmap,
  notFound,
  optionalString,
  readJson,
  requiredCleanText,
  requireUser,
  responseStatusFromError,
  stringArray,
  type AppBindings,
  type AppContext,
} from "../http";

export const agentRoutes = new Hono<AppBindings>();

// Lists the saved agent chats for this roadmap, newest activity first.
agentRoutes.get("/roadmaps/:id/agent/conversations", async (c) => {
  const user = await requireUser(c);
  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    notFound();
  }

  const conversations = await listAgentConversations(c.env.DB, roadmap.id, user.id);
  return c.json({ conversations: conversations.map(toAgentConversationPayload) });
});

// Creates an empty chat session that can later receive agent messages.
agentRoutes.post("/roadmaps/:id/agent/conversations", async (c) => {
  const user = await requireUser(c);
  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    notFound();
  }

  const body = await readJson(c.req.raw);
  const conversation = await createAgentConversation(c.env.DB, roadmap.id, user.id, optionalString(body.title));
  return c.json({ conversation: toAgentConversationPayload(conversation) }, 201);
});

// Loads one chat session transcript for workspace restoration.
agentRoutes.get("/roadmaps/:id/agent/conversations/:conversationId/messages", async (c) => {
  const user = await requireUser(c);
  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    notFound();
  }

  const conversation = await getAgentConversationForUser(
    c.env.DB,
    c.req.param("conversationId"),
    roadmap.id,
    user.id,
  );
  if (!conversation) {
    notFound();
  }

  return c.json({
    conversation: toAgentConversationPayload(conversation),
    messages: await listAgentMessages(c.env.DB, conversation.id),
  });
});

// Non-streaming endpoint scoped to one explicit chat session.
agentRoutes.post("/roadmaps/:id/agent/conversations/:conversationId/messages", async (c) => {
  return runAgentRequest(c, c.req.param("conversationId"), false);
});

// Streaming endpoint scoped to one explicit chat session.
agentRoutes.post("/roadmaps/:id/agent/conversations/:conversationId/messages/stream", async (c) => {
  return runAgentRequest(c, c.req.param("conversationId"), true);
});

// Backward-compatible non-streaming endpoint. If no conversation is supplied, it uses the latest one.
agentRoutes.post("/roadmaps/:id/agent/messages", async (c) => {
  return runAgentRequest(c, undefined, false);
});

// Backward-compatible streaming endpoint. If no conversation is supplied, it uses the latest one.
agentRoutes.post("/roadmaps/:id/agent/messages/stream", async (c) => {
  return runAgentRequest(c, undefined, true);
});

type PreparedAgentRequest = {
  agentInput: AgentInput;
  conversation: AgentConversationRow;
  roadmapId: string;
};

async function runAgentRequest(c: AppContext, routeConversationId: string | undefined, stream: boolean) {
  const prepared = await prepareAgentRequest(c, routeConversationId);

  if (!stream) {
    try {
      const result = await runRoadmapAgent(prepared.agentInput);
      const conversation = await recordAgentSuccess(
        c.env.DB,
        prepared.conversation,
        prepared.roadmapId,
        prepared.agentInput.message,
        result,
      );
      return c.json(agentResultPayload(result, conversation));
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI generation failed.";
      const statusCode = responseStatusFromError(error);
      await recordAgentFailure(c.env.DB, prepared.conversation.id, prepared.roadmapId, c.env.OPENROUTER_MODEL, message);
      return c.json({ error: message }, statusCode);
    }
  }

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sse(event, payload)));
      };

      try {
        send("status", { message: "Preparing agent run." });
        const result = await runRoadmapAgentStream(prepared.agentInput, (event) => {
          if (event.type === "status") {
            send("status", { message: event.message });
          }
          if (event.type === "operation") {
            send("operation", { operation: event.operation });
          }
        });

        const conversation = await recordAgentSuccess(
          c.env.DB,
          prepared.conversation,
          prepared.roadmapId,
          prepared.agentInput.message,
          result,
        );
        send("final", agentResultPayload(result, conversation));
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI generation failed.";
        const statusCode = responseStatusFromError(error);
        await recordAgentFailure(c.env.DB, prepared.conversation.id, prepared.roadmapId, c.env.OPENROUTER_MODEL, message);
        send("error", {
          message,
          statusCode,
          code: error && typeof error === "object" ? (error as { code?: unknown }).code : undefined,
        });
      } finally {
        send("done", {});
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}

// Shared preparation for all agent endpoints: auth, ownership, body parsing, and message persistence.
async function prepareAgentRequest(
  c: AppContext,
  routeConversationId: string | undefined,
): Promise<PreparedAgentRequest> {
  const user = await requireUser(c);
  const roadmap = await getOwnedRoadmap(c, user);
  if (!roadmap) {
    notFound();
  }

  const body = await readJson(c.req.raw);
  const content = requiredCleanText(body.content, "Message content is required.", 4000);
  const artifactIds = stringArray(body.artifactIds);
  const requestedConversationId = routeConversationId || optionalString(body.conversationId);
  let conversation = await getOrCreateAgentConversation(c.env.DB, roadmap.id, user.id, requestedConversationId);
  if (!conversation) {
    notFound();
  }
  const history = await listRecentAgentHistory(c.env.DB, conversation.id);

  // The user message is recorded before the agent call so failures are auditable.
  conversation = await recordAgentUserMessage(c.env.DB, conversation, content, artifactIds, history.length === 0);

  return {
    agentInput: {
      env: c.env,
      db: c.env.DB,
      userId: user.id,
      roadmapId: roadmap.id,
      conversationId: conversation.id,
      message: content,
      artifactIds,
      history,
      conversationSummary: conversation.summary?.trim() || null,
    },
    conversation,
    roadmapId: roadmap.id,
  };
}

// Keeps route responses stable even as AgentResult grows new internal fields.
function agentResultPayload(result: AgentResult, conversation: AgentConversationRow) {
  return {
    summary: result.summary,
    operations: result.operations,
    graph: result.graph,
    responseType: result.responseType,
    committed: result.committed,
    citations: result.citations,
    riskFlags: result.riskFlags,
    validationReport: result.validationReport,
    approvalRequest: result.approvalRequest,
    conversation: toAgentConversationPayload(conversation),
  };
}

// Minimal server-sent event formatter used by the streaming route.
function sse(event: string, payload: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}
