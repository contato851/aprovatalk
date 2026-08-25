const BUCKETS = {
  avatars: "avatars",
  media: "post-media",
  covers: "post-covers",
  frames: "adjustment-frames",
} as const;

const SIGNED_URL_TTL = 60 * 60 * 24 * 30; // 30 dias

export async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

export async function signAvatarUrl(
  supabase: any,
  path: string | null | undefined,
): Promise<string | null> {
  return path ? signStoragePath(supabase, BUCKETS.avatars, path) : null;
}

async function signStoragePath(
  supabase: any,
  bucket: string,
  path: string,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function enrichPost(supabase: any, post: any) {
  const sorted = [...(post.media ?? [])].sort(
    (a: any, b: any) => a.position - b.position,
  );
  const media = await Promise.all(
    sorted.map(async (m: any) => ({
      ...m,
      signed_url: await signStoragePath(supabase, BUCKETS.media, m.url),
    })),
  );
  const cover_signed_url = post.cover_url
    ? await signStoragePath(supabase, BUCKETS.covers, post.cover_url)
    : null;
  const client_avatar_signed_url = post.client?.avatar_url
    ? await signStoragePath(supabase, BUCKETS.avatars, post.client.avatar_url)
    : null;
  const points = await Promise.all(
    [...(post.adjustment_points ?? [])]
      .sort((a: any, b: any) => a.time_seconds - b.time_seconds)
      .map(async (pt: any) => ({
        ...pt,
        frame_signed_url: pt.frame_url
          ? await signStoragePath(supabase, BUCKETS.frames, pt.frame_url)
          : null,
      })),
  );
  return {
    ...post,
    media,
    cover_signed_url,
    adjustment_points: points,
    client: post.client
      ? { ...post.client, avatar_signed_url: client_avatar_signed_url }
      : null,
  };
}