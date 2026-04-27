import { Hono } from "hono";
import { createAuth } from "../auth";
import {
  cleanHandle,
  cleanText,
  readJson,
  requireUser,
  unauthorized,
  type AppBindings,
} from "../http";

export const profileRoutes = new Hono<AppBindings>();

profileRoutes.on(["GET", "POST"], "/auth/*", (c) => {
  return createAuth(c.env).handler(c.req.raw);
});

profileRoutes.get("/me", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return c.json({ error: "Authentication required." }, 401);
  }

  return c.json({ user });
});

profileRoutes.patch("/profile", async (c) => {
  const user = await requireUser(c);
  if (!user) {
    return unauthorized(c);
  }

  const body = await readJson(c.req.raw);
  const displayName = cleanText(body.displayName, user.profile.displayName, 80);
  const bio = cleanText(body.bio, "", 240);
  const requestedHandle = cleanHandle(body.handle) || user.profile.handle;
  const existing = await c.env.DB.prepare(
    "SELECT user_id FROM profiles WHERE handle = ? AND user_id != ?",
  )
    .bind(requestedHandle, user.id)
    .first<{ user_id: string }>();

  if (existing) {
    return c.json({ error: "This handle is already in use." }, 409);
  }

  await c.env.DB.prepare(
    `UPDATE profiles
     SET handle = ?, display_name = ?, bio = ?, updated_at = ?
     WHERE user_id = ?`,
  )
    .bind(requestedHandle, displayName, bio, Date.now(), user.id)
    .run();

  return c.json({
    profile: {
      handle: requestedHandle,
      displayName,
      bio,
    },
  });
});
