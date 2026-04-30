import { Hono } from "hono";
import { agentRoutes } from "./routes/agent";
import { artifactRoutes } from "./routes/artifacts";
import { profileRoutes } from "./routes/profile";
import { publicRoutes } from "./routes/public";
import { roadmapRoutes } from "./routes/roadmaps";
import { HttpError, type AppBindings } from "./http";
import { errorDetails, logError } from "./logger";

// Main Hono app for the Worker. API routes run first; unmatched requests fall
// through to the static frontend assets binding.
const app = new Hono<AppBindings>();

app.onError((error, c) => {
  // Expected request errors already have a safe status and message for clients.
  if (error instanceof HttpError) {
    return c.json({ error: error.message }, error.status);
  }

  // Unexpected errors are logged with details, but clients get a generic message.
  logError("Unexpected request error.", errorDetails(error));
  return c.json({ error: "Something went wrong while processing the request." }, 500);
});

// Each route module owns its path suffixes under /api.
app.route("/api", profileRoutes);
app.route("/api", roadmapRoutes);
app.route("/api", artifactRoutes);
app.route("/api", agentRoutes);
app.route("/api", publicRoutes);

// Anything outside /api is treated as a frontend route or static asset.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
