import { Hono } from "hono";
import { createAuth } from "../auth";
import {
  cleanHandle,
  cleanText,
  conflict,
  readJson,
  requireUser,
  type AppBindings,
} from "../http";

export const profileRoutes = new Hono<AppBindings>();

// Better Auth owns its nested /auth/* handlers for sign-in, callback, and session APIs.
profileRoutes.on(["GET", "POST"], "/auth/*", (c) => {
  return createAuth(c.env).handler(c.req.raw);
});

// Returns the normalized app user, including the profile row created in auth.ts.
profileRoutes.get("/me", async (c) => {
  const user = await requireUser(c);

  return c.json({ user });
});

profileRoutes.patch("/profile", async (c) => {
  const user = await requireUser(c);

  const body = await readJson(c.req.raw);
  const displayName = cleanText(body.displayName, user.profile.displayName, 80);
  const bio = cleanText(body.bio, "", 240);
  const requestedHandle = cleanHandle(body.handle) || user.profile.handle;

  // Handles are public URLs, so uniqueness is checked before updating the profile.
  const existing = await c.env.DB.prepare(
    "SELECT user_id FROM profiles WHERE handle = ? AND user_id != ?",
  )
    .bind(requestedHandle, user.id)
    .first<{ user_id: string }>();

  if (existing) {
    conflict("This handle is already in use.");
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
