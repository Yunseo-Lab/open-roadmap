import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { authSchema } from "./db/auth-schema";
import type { AppEnv, CurrentUser } from "./types";

type AuthSession = {
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

type ProfileRow = {
  handle: string;
  display_name: string;
  bio: string;
};

// Builds the Better Auth instance for the current Worker request environment.
export function createAuth(env: AppEnv) {
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const secret = resolveAuthSecret(env);

  return betterAuth({
    appName: "Open Roadmap",
    baseURL: env.BETTER_AUTH_URL,
    secret,
    database: drizzleAdapter(drizzle(env.DB, { schema: authSchema }), {
      provider: "sqlite",
      schema: {
        user: authSchema.users,
        session: authSchema.userSessions,
        account: authSchema.accounts,
        verification: authSchema.verifications,
      },
    }),
    user: {
      modelName: "users",
    },
    session: {
      modelName: "user_sessions",
    },
    account: {
      modelName: "accounts",
    },
    verification: {
      modelName: "verifications",
    },
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
              prompt: "select_account",
            },
          }
        : {},
  });
}

// Production must provide a real secret; local development keeps a stable fallback
// so auth sessions continue to work while running the app locally.
function resolveAuthSecret(env: AppEnv): string {
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (env.APP_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required in production.");
  }

  return "development-only-open-roadmap-secret-change-me";
}

// Reads the Better Auth session and returns the app-level user shape.
// In non-production, it falls back to a local developer user for faster setup.
export async function getCurrentUser(env: AppEnv, request: Request): Promise<CurrentUser | null> {
  const session = await createAuth(env)
    .api.getSession({
      headers: request.headers,
    })
    .catch(() => null);

  const typedSession = session as AuthSession | null;
  if (typedSession?.user?.id) {
    return ensureUserProfile(env.DB, {
      id: typedSession.user.id,
      name: typedSession.user.name ?? typedSession.user.email ?? "User",
      email: typedSession.user.email ?? "",
      image: typedSession.user.image ?? null,
    });
  }

  if (env.APP_ENV !== "production") {
    return ensureDevUser(env.DB);
  }

  return null;
}

// Seeds a predictable local user so protected routes can be used without OAuth.
async function ensureDevUser(db: D1Database): Promise<CurrentUser> {
  const now = Date.now();
  await db
    .prepare(
      `INSERT OR IGNORE INTO users (id, name, email, email_verified, image, created_at, updated_at)
       VALUES (?, ?, ?, 1, NULL, ?, ?)`,
    )
    .bind("dev-user", "Local Developer", "dev@open-roadmap.local", now, now)
    .run();

  return ensureUserProfile(db, {
    id: "dev-user",
    name: "Local Developer",
    email: "dev@open-roadmap.local",
    image: null,
  });
}

// Every authenticated user should also have a profile row used by public pages.
async function ensureUserProfile(
  db: D1Database,
  user: Omit<CurrentUser, "profile">,
): Promise<CurrentUser> {
  const existing = await db
    .prepare("SELECT handle, display_name, bio FROM profiles WHERE user_id = ?")
    .bind(user.id)
    .first<ProfileRow>();

  if (existing) {
    return {
      ...user,
      profile: {
        handle: existing.handle,
        displayName: existing.display_name,
        bio: existing.bio,
      },
    };
  }

  const now = Date.now();
  const handle = await createUniqueHandle(db, user.name || user.email || "user");
  await db
    .prepare(
      `INSERT INTO profiles (user_id, handle, display_name, bio, created_at, updated_at)
       VALUES (?, ?, ?, '', ?, ?)`,
    )
    .bind(user.id, handle, user.name || "User", now, now)
    .run();

  return {
    ...user,
    profile: {
      handle,
      displayName: user.name || "User",
      bio: "",
    },
  };
}

// Starts from a readable slug and appends a suffix only when there is a collision.
async function createUniqueHandle(db: D1Database, source: string): Promise<string> {
  const base = slugify(source).slice(0, 24) || "user";

  for (let index = 0; index < 20; index += 1) {
    const handle = index === 0 ? base : `${base}${index + 1}`;
    const existing = await db
      .prepare("SELECT user_id FROM profiles WHERE handle = ?")
      .bind(handle)
      .first<{ user_id: string }>();

    if (!existing) {
      return handle;
    }
  }

  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

// Normalizes display names and user input into URL-safe handles.
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
