export type ProfileUpdate = {
  handle: string;
  displayName: string;
  bio: string;
};

// Public handles are unique across profiles, excluding the current user.
export async function profileHandleExistsForAnotherUser(
  db: D1Database,
  handle: string,
  userId: string,
): Promise<boolean> {
  const existing = await db
    .prepare("SELECT user_id FROM profiles WHERE handle = ? AND user_id != ?")
    .bind(handle, userId)
    .first<{ user_id: string }>();

  return Boolean(existing);
}

export async function updateProfile(db: D1Database, userId: string, input: ProfileUpdate): Promise<ProfileUpdate> {
  await db
    .prepare(
      `UPDATE profiles
       SET handle = ?, display_name = ?, bio = ?, updated_at = ?
       WHERE user_id = ?`,
    )
    .bind(input.handle, input.displayName, input.bio, Date.now(), userId)
    .run();

  return input;
}
