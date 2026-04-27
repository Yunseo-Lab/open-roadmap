import { Hono } from "hono";
import { agentRoutes } from "./routes/agent";
import { artifactRoutes } from "./routes/artifacts";
import { profileRoutes } from "./routes/profile";
import { publicRoutes } from "./routes/public";
import { roadmapRoutes } from "./routes/roadmaps";
import type { AppBindings } from "./http";

const app = new Hono<AppBindings>();

app.onError((error, c) => {
  console.error(JSON.stringify({ level: "error", message: error.message, stack: error.stack }));
  return c.json({ error: "Something went wrong while processing the request." }, 500);
});

app.route("/api", profileRoutes);
app.route("/api", roadmapRoutes);
app.route("/api", artifactRoutes);
app.route("/api", agentRoutes);
app.route("/api", publicRoutes);

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
