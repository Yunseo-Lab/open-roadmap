import { Hono } from "hono";
import { createAuth } from "../auth";
import { profileHandleExistsForAnotherUser, updateProfile } from "../db/profiles";
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
  if (await profileHandleExistsForAnotherUser(c.env.DB, requestedHandle, user.id)) {
    conflict("This handle is already in use.");
  }

  const profile = await updateProfile(c.env.DB, user.id, {
    handle: requestedHandle,
    displayName,
    bio,
  });

  return c.json({ profile });
});
