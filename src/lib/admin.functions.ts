import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKETS = {
  avatars: "avatars",
  media: "post-media",
  covers: "post-covers",
} as const;

const SIGNED_URL_TTL = 60 * 60 * 24 * 30; // 30 dias

async function assertAdmin(context: {
  supabase: any;
  userId: string;
}) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

/** Lista todos os clientes (admin) */
export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const clients = data ?? [];
    // sign avatar urls
    const enriched = await Promise.all(
      clients.map(async (c: any) => ({
        ...c,
        avatar_signed_url: c.avatar_url
          ? await signStoragePath(context.supabase, BUCKETS.avatars, c.avatar_url)
          : null,
      })),
    );
    return enriched;
  });

/** Buscar um cliente por id */
export const getClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: client, error } = await context.supabase
      .from("clients")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    return {
      ...client,
      avatar_signed_url: client.avatar_url
        ? await signStoragePath(context.supabase, BUCKETS.avatars, client.avatar_url)
        : null,
    };
  });

/** Criar cliente */
export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string;
    instagram_handle: string;
    avatar_path?: string | null;
  }) =>
    z
      .object({
        name: z.string().min(1),
        instagram_handle: z.string().min(1),
        avatar_path: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: client, error } = await context.supabase
      .from("clients")
      .insert({
        name: data.name,
        instagram_handle: data.instagram_handle.replace(/^@/, ""),
        avatar_url: data.avatar_path ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return client;
  });

/** Atualizar cliente */
export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    name?: string;
    instagram_handle?: string;
    avatar_path?: string | null;
    status?: "active" | "inactive";
  }) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        instagram_handle: z.string().min(1).optional(),
        avatar_path: z.string().nullable().optional(),
        status: z.enum(["active", "inactive"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.instagram_handle !== undefined)
      patch.instagram_handle = data.instagram_handle.replace(/^@/, "");
    if (data.avatar_path !== undefined) patch.avatar_url = data.avatar_path;
    if (data.status !== undefined) patch.status = data.status;
    const { data: client, error } = await context.supabase
      .from("clients")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return client;
  });

/** Lista posts (admin, com filtros opcionais) */
export const listPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    clientId?: string;
    type?: "static" | "carousel" | "video";
    status?: "pending" | "approved" | "rejected";
  }) =>
    z
      .object({
        clientId: z.string().uuid().optional(),
        type: z.enum(["static", "carousel", "video"]).optional(),
        status: z.enum(["pending", "approved", "rejected"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("posts")
      .select(
        "*, client:clients(id, name, instagram_handle, avatar_url), media:post_media(id, url, position, kind)",
      )
      .order("scheduled_at", { ascending: true });
    if (data.clientId) q = q.eq("client_id", data.clientId);
    if (data.type) q = q.eq("type", data.type);
    if (data.status) q = q.eq("status", data.status);
    const { data: posts, error } = await q;
    if (error) throw error;
    return await Promise.all(
      (posts ?? []).map((p: any) => enrichPost(context.supabase, p)),
    );
  });

/** Obter um post por id */
export const getPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: post, error } = await context.supabase
      .from("posts")
      .select(
        "*, client:clients(id, name, instagram_handle, avatar_url), media:post_media(id, url, position, kind)",
      )
      .eq("id", data.id)
      .single();
    if (error) throw error;
    return await enrichPost(context.supabase, post);
  });

/** Cria post + mídia */
const mediaItem = z.object({
  path: z.string(),
  kind: z.enum(["image", "video"]),
});

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        client_id: z.string().uuid(),
        type: z.enum(["static", "carousel", "video"]),
        caption: z.string().default(""),
        scheduled_at: z.string(),
        cover_path: z.string().nullable().optional(),
        media: z.array(mediaItem).min(1),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.type === "video" && !data.cover_path) {
      throw new Error("Vídeo requer capa.");
    }
    const { data: post, error } = await context.supabase
      .from("posts")
      .insert({
        client_id: data.client_id,
        type: data.type,
        caption: data.caption,
        scheduled_at: data.scheduled_at,
        cover_url: data.cover_path ?? null,
        status: "pending",
        client_comment: null,
        responded_at: null,
      })
      .select("*")
      .single();
    if (error) throw error;

    const rows = data.media.map((m, i) => ({
      post_id: post.id,
      url: m.path,
      position: i,
      kind: m.kind,
    }));
    const { error: mErr } = await context.supabase.from("post_media").insert(rows);
    if (mErr) throw mErr;
    return post;
  });

/** Atualiza post + substitui mídia. Sempre volta status para pending. */
export const updatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        type: z.enum(["static", "carousel", "video"]),
        caption: z.string().default(""),
        scheduled_at: z.string(),
        cover_path: z.string().nullable().optional(),
        media: z.array(mediaItem).min(1),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.type === "video" && !data.cover_path) {
      throw new Error("Vídeo requer capa.");
    }
    const { error: uErr } = await context.supabase
      .from("posts")
      .update({
        type: data.type,
        caption: data.caption,
        scheduled_at: data.scheduled_at,
        cover_url: data.cover_path ?? null,
        status: "pending",
        responded_at: null,
      })
      .eq("id", data.id);
    if (uErr) throw uErr;

    const { error: dErr } = await context.supabase
      .from("post_media")
      .delete()
      .eq("post_id", data.id);
    if (dErr) throw dErr;

    const rows = data.media.map((m, i) => ({
      post_id: data.id,
      url: m.path,
      position: i,
      kind: m.kind,
    }));
    const { error: iErr } = await context.supabase.from("post_media").insert(rows);
    if (iErr) throw iErr;

    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("posts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Upload URL: create signed upload URL on a bucket */
export const createUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bucket: "avatars" | "post-media" | "post-covers"; ext: string }) =>
    z
      .object({
        bucket: z.enum(["avatars", "post-media", "post-covers"]),
        ext: z.string().max(10),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const path = `${crypto.randomUUID()}.${data.ext.replace(/^\./, "")}`;
    const { data: signed, error } = await context.supabase.storage
      .from(data.bucket)
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

// --- Helpers ---

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

async function enrichPost(supabase: any, post: any) {
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
  return {
    ...post,
    media,
    cover_signed_url,
    client: post.client
      ? { ...post.client, avatar_signed_url: client_avatar_signed_url }
      : null,
  };
}
