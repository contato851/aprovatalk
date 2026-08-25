import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKETS = {
  avatars: "avatars",
  media: "post-media",
  covers: "post-covers",
  frames: "adjustment-frames",
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
    const patch: {
      name?: string;
      instagram_handle?: string;
      avatar_url?: string | null;
      status?: "active" | "inactive";
    } = {};
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
    status?: "planning" | "pending" | "approved" | "rejected" | "ready_for_review";
    statuses?: ("planning" | "pending" | "approved" | "rejected" | "ready_for_review")[];
    includeMedia?: boolean;
    includeDetails?: boolean;
    scheduledDate?: string;
  }) =>
    z
      .object({
        clientId: z.string().uuid().optional(),
        type: z.enum(["static", "carousel", "video"]).optional(),
        status: z.enum(["planning", "pending", "approved", "rejected", "ready_for_review"]).optional(),
        statuses: z
          .array(z.enum(["planning", "pending", "approved", "rejected", "ready_for_review"]))
          .optional(),
        includeMedia: z.boolean().optional(),
        includeDetails: z.boolean().optional(),
        scheduledDate: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const includeMedia = data.includeMedia ?? true;
    const includeDetails = data.includeDetails ?? true;
    let q = context.supabase
      .from("posts")
      .select(
        includeMedia
          ? "*, client:clients(id, name, instagram_handle, avatar_url), media:post_media(id, url, position, kind), linked_design_slot:design_slots!linked_design_slot_id(id, slot_date, slot_index, title, done), linked_delivery_slot:delivery_slots!linked_delivery_slot_id(id, slot_date, slot_index, title, done)"
          : includeDetails
            ? "id, client_id, type, status, caption, planning_title, briefing, script, internal_status, scheduled_at, client_comment, midia_arquivada, cover_url, linked_design_slot_id, linked_delivery_slot_id, client:clients(id, name, instagram_handle, avatar_url), linked_design_slot:design_slots!linked_design_slot_id(id, slot_date, slot_index, title, done), linked_delivery_slot:delivery_slots!linked_delivery_slot_id(id, slot_date, slot_index, title, done)"
            : "id, client_id, type, status, caption, planning_title, internal_status, scheduled_at, client_comment, midia_arquivada, linked_design_slot_id, linked_delivery_slot_id, client:clients(id, name, instagram_handle, avatar_url), linked_design_slot:design_slots!linked_design_slot_id(id, slot_date, slot_index, title, done), linked_delivery_slot:delivery_slots!linked_delivery_slot_id(id, slot_date, slot_index, title, done)",
      )
      .order("scheduled_at", { ascending: true });
    if (data.clientId) q = q.eq("client_id", data.clientId);
    if (data.type) q = q.eq("type", data.type);
    if (data.status) q = q.eq("status", data.status);
    if (data.statuses?.length) q = q.in("status", data.statuses);
    if (data.scheduledDate) {
      const [year, month, day] = data.scheduledDate.split("-").map((n) => Number.parseInt(n, 10));
      if (year && month && day) {
        const start = new Date(year, month - 1, day);
        const end = new Date(year, month - 1, day + 1);
        q = q.gte("scheduled_at", start.toISOString()).lt("scheduled_at", end.toISOString());
      }
    }
    const { data: posts, error } = await q;
    if (error) throw error;
    if (!includeMedia) return posts ?? [];
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
        "*, client:clients(id, name, instagram_handle, avatar_url), media:post_media(id, url, position, kind), adjustment_points:post_adjustment_points(id, time_seconds, note, frame_url, created_at), linked_design_slot:design_slots!linked_design_slot_id(id, slot_date, slot_index, title, done), linked_delivery_slot:delivery_slots!linked_delivery_slot_id(id, slot_date, slot_index, title, done)",
      )

      .eq("id", data.id)
      .single();
    if (error) throw error;
    return await enrichPost(context.supabase, post);
  });

/** Lista slots (não vinculados a outro post) para escolher no formulário */
export const listAvailableSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slotType: "design" | "delivery"; includeId?: string | null }) =>
    z
      .object({
        slotType: z.enum(["design", "delivery"]),
        includeId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const table = data.slotType === "design" ? "design_slots" : "delivery_slots";
    const linkCol =
      data.slotType === "design" ? "linked_design_slot_id" : "linked_delivery_slot_id";

    const { data: linkedRows, error: lErr } = await context.supabase
      .from("posts")
      .select(`id, ${linkCol}`)
      .not(linkCol, "is", null);
    if (lErr) throw lErr;
    const linkedIds = new Set<string>(
      ((linkedRows ?? []) as any[])
        .map((r: any) => r[linkCol])
        .filter((v: any) => !!v && v !== data.includeId),
    );

    const { data: slots, error } = await context.supabase
      .from(table)
      .select("id, slot_date, slot_index, title, client, done")
      .order("slot_date", { ascending: true })
      .order("slot_index", { ascending: true });
    if (error) throw error;

    return (slots ?? []).filter((s: any) => !linkedIds.has(s.id));
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
        planning_title: z.string().optional(),
        briefing: z.string().optional(),
        script: z.string().optional(),
        internal_status: z.enum(["draft", "producing", "ready"]).optional(),

        scheduled_at: z.string(),
        cover_path: z.string().nullable().optional(),
        media: z.array(mediaItem).default([]),
        status: z.enum(["planning", "pending"]).default("pending"),
        linked_design_slot_id: z.string().uuid().nullable().optional(),
        linked_delivery_slot_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.linked_design_slot_id && data.linked_delivery_slot_id) {
      throw new Error("Vincule a apenas uma entrega (Design ou Edição).");
    }
    if (data.status === "pending") {
      if (data.media.length === 0) throw new Error("Envie ao menos uma mídia.");
      if (data.type === "video" && !data.cover_path) {
        throw new Error("Vídeo requer capa.");
      }
    }
    const { data: post, error } = await context.supabase
      .from("posts")
      .insert({
        client_id: data.client_id,
        type: data.type,
        caption: data.caption,
        planning_title: data.planning_title ?? "",
        briefing: data.briefing ?? "",
        script: data.script ?? "",
        internal_status: data.internal_status ?? "draft",

        scheduled_at: data.scheduled_at,
        cover_url: data.cover_path ?? null,
        status: data.status,
        client_comment: null,
        responded_at: null,
        linked_design_slot_id: data.linked_design_slot_id ?? null,
        linked_delivery_slot_id: data.linked_delivery_slot_id ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    if (data.media.length > 0) {
      const rows = data.media.map((m, i) => ({
        post_id: post.id,
        url: m.path,
        position: i,
        kind: m.kind,
      }));
      const { error: mErr } = await context.supabase.from("post_media").insert(rows);
      if (mErr) throw mErr;
    }
    return post;
  });

/** Atualiza campos de planejamento de um post. */
export const updatePlanningPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        type: z.enum(["static", "carousel", "video"]).optional(),
        planning_title: z.string().optional(),
        caption: z.string().optional(),
        briefing: z.string().optional(),
        script: z.string().optional(),
        internal_status: z.enum(["draft", "producing", "ready"]).optional(),
        scheduled_at: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { id, ...patch } = data;
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(clean).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("posts")
      .update(clean as any)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

/** Move um post de "planning" para "ready_for_review" (Produção). */
export const movePostToProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: post, error } = await context.supabase
      .from("posts")
      .select("id, status")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    if (post.status !== "planning") {
      throw new Error("Somente posts em planejamento podem ir para produção.");
    }
    const { error: uErr } = await context.supabase
      .from("posts")
      .update({ status: "ready_for_review", internal_status: "producing" })
      .eq("id", data.id);
    if (uErr) throw uErr;
    return { ok: true as const };
  });

/**
 * Atualiza post + substitui mídia.
 * - Se o post estiver em "planning" ou "ready_for_review", mantém o status.
 * - Caso contrário, volta para "pending" (mantém o fluxo atual de reedição).
 */
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
        media: z.array(mediaItem).default([]),
        linked_design_slot_id: z.string().uuid().nullable().optional(),
        linked_delivery_slot_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.linked_design_slot_id && data.linked_delivery_slot_id) {
      throw new Error("Vincule a apenas uma entrega (Design ou Edição).");
    }

    const { data: existing, error: exErr } = await context.supabase
      .from("posts")
      .select("status")
      .eq("id", data.id)
      .single();
    if (exErr) throw exErr;

    const keepStatus =
      existing.status === "planning" || existing.status === "ready_for_review";
    const nextStatus = keepStatus ? existing.status : "pending";

    if (!keepStatus) {
      if (data.media.length === 0) throw new Error("Envie ao menos uma mídia.");
      if (data.type === "video" && !data.cover_path) {
        throw new Error("Vídeo requer capa.");
      }
    }

    const patch: any = {
      type: data.type,
      caption: data.caption,
      scheduled_at: data.scheduled_at,
      cover_url: data.cover_path ?? null,
      status: nextStatus,
      responded_at: null,
    };
    if (data.linked_design_slot_id !== undefined)
      patch.linked_design_slot_id = data.linked_design_slot_id;
    if (data.linked_delivery_slot_id !== undefined)
      patch.linked_delivery_slot_id = data.linked_delivery_slot_id;

    const { error: uErr } = await context.supabase
      .from("posts")
      .update(patch)
      .eq("id", data.id);
    if (uErr) throw uErr;

    const { error: dErr } = await context.supabase
      .from("post_media")
      .delete()
      .eq("post_id", data.id);
    if (dErr) throw dErr;

    if (data.media.length > 0) {
      const rows = data.media.map((m, i) => ({
        post_id: data.id,
        url: m.path,
        position: i,
        kind: m.kind,
      }));
      const { error: iErr } = await context.supabase.from("post_media").insert(rows);
      if (iErr) throw iErr;
    }

    return { ok: true, status: nextStatus };
  });

/**
 * Valida e libera um post em "planning" para "pending" (aprovação do cliente).
 * Retorna a lista de campos faltantes se algum obrigatório estiver ausente.
 */
export const releasePostForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);

    const { data: post, error } = await context.supabase
      .from("posts")
      .select("id, type, caption, scheduled_at, cover_url, status, media:post_media(id, kind)")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    if (post.status !== "planning" && post.status !== "ready_for_review") {
      throw new Error("Este post não pode ser liberado neste status.");
    }

    const missing: string[] = [];
    if (!post.scheduled_at) missing.push("data programada");
    if (!post.caption || !post.caption.trim()) missing.push("legenda");

    const mediaCount = (post.media ?? []).length;
    if (post.type === "static") {
      if (mediaCount < 1) missing.push("imagem");
    } else if (post.type === "carousel") {
      if (mediaCount < 2) missing.push("pelo menos 2 imagens do carrossel");
    } else if (post.type === "video") {
      if (mediaCount < 1) missing.push("vídeo");
      if (!post.cover_url) missing.push("capa");
    }

    if (missing.length > 0) {
      return { ok: false as const, missing };
    }

    const { error: uErr } = await context.supabase
      .from("posts")
      .update({
        status: "pending",
        client_comment: null,
        responded_at: null,
      })
      .eq("id", data.id);
    if (uErr) throw uErr;

    return { ok: true as const };
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

