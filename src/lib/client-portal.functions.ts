import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BUCKETS = {
  avatars: "avatars",
  media: "post-media",
  covers: "post-covers",
  frames: "adjustment-frames",
};
const SIGNED_URL_TTL = 60 * 60 * 24 * 30;

async function signPath(admin: any, bucket: string, path: string | null) {
  if (!path) return null;
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}


async function notifyWhatsApp(message: string) {
  const rawPhone = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;
  if (!rawPhone || !apikey) {
    console.warn("[whatsapp] CALLMEBOT_PHONE/CALLMEBOT_APIKEY não configurados", {
      hasPhone: !!rawPhone,
      hasApiKey: !!apikey,
    });
    return;
  }
  // CallMeBot espera apenas os dígitos (código do país + número), sem "+".
  const phone = rawPhone.replace(/[^\d]/g, "");
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`;
  console.log("[whatsapp] enviando", { phone, messagePreview: message.slice(0, 60) });
  try {
    const res = await fetch(url, { method: "GET" });
    const body = await res.text().catch(() => "");
    console.log("[whatsapp] resposta", { status: res.status, ok: res.ok, body: body.slice(0, 400) });
  } catch (err) {
    console.error("[whatsapp] erro", err);
  }
}

function formatScheduledDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Retorna cliente + posts (todos) validando pelo access_token do link.
 */
export const getClientPortal = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) =>
    z.object({ token: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: client, error } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("access_token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!client) throw new Error("Link inválido");
    if (client.status === "inactive") throw new Error("Acesso desativado");

    const { data: posts, error: pErr } = await supabaseAdmin
      .from("posts")
      .select("*, media:post_media(id, url, position, kind), adjustment_points:post_adjustment_points(id, time_seconds, note, frame_url, created_at)")
      .eq("client_id", client.id)
      .order("scheduled_at", { ascending: true });
    if (pErr) throw pErr;

    const enrichedPosts = await Promise.all(
      (posts ?? []).map(async (p: any) => {
        const sorted = [...(p.media ?? [])].sort(
          (a: any, b: any) => a.position - b.position,
        );
        const media = await Promise.all(
          sorted.map(async (m: any) => ({
            ...m,
            signed_url: await signPath(supabaseAdmin, BUCKETS.media, m.url),
          })),
        );
        const points = await Promise.all(
          [...(p.adjustment_points ?? [])]
            .sort((a: any, b: any) => a.time_seconds - b.time_seconds)
            .map(async (pt: any) => ({
              ...pt,
              frame_signed_url: await signPath(supabaseAdmin, BUCKETS.frames, pt.frame_url),
            })),
        );
        return {
          ...p,
          media,
          adjustment_points: points,
          cover_signed_url: await signPath(
            supabaseAdmin,
            BUCKETS.covers,
            p.cover_url,
          ),
        };
      }),
    );


    return {
      client: {
        id: client.id,
        name: client.name,
        instagram_handle: client.instagram_handle,
        avatar_signed_url: await signPath(
          supabaseAdmin,
          BUCKETS.avatars,
          client.avatar_url,
        ),
      },
      posts: enrichedPosts,
    };
  });

export const approvePostByToken = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; postId: string }) =>
    z
      .object({ token: z.string().uuid(), postId: z.string().uuid() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = await getClientByToken(supabaseAdmin, data.token);
    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .update({ status: "approved", responded_at: new Date().toISOString() })
      .eq("id", data.postId)
      .eq("client_id", client.id)
      .select("scheduled_at")
      .single();
    if (error) throw error;
    await notifyWhatsApp(
      `✅ ${client.name} aprovou o post de ${formatScheduledDate(post.scheduled_at)}`,
    );
    return { scheduled_at: post.scheduled_at };
  });

function formatSeconds(total: number) {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export const rejectPostByToken = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; postId: string; comment?: string }) =>
    z
      .object({
        token: z.string().uuid(),
        postId: z.string().uuid(),
        comment: z.string().optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = await getClientByToken(supabaseAdmin, data.token);

    // Verifica se o post pertence ao cliente
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("posts")
      .select("id, scheduled_at")
      .eq("id", data.postId)
      .eq("client_id", client.id)
      .maybeSingle();
    if (exErr) throw exErr;
    if (!existing) throw new Error("Post não encontrado");

    const { data: points, error: pErr } = await supabaseAdmin
      .from("post_adjustment_points")
      .select("time_seconds, note")
      .eq("post_id", data.postId)
      .order("time_seconds", { ascending: true });
    if (pErr) throw pErr;

    const userComment = (data.comment ?? "").trim();
    if ((points ?? []).length === 0 && !userComment) {
      throw new Error("Deixe seu comentário ou marque ao menos um ponto de ajuste.");
    }

    const pointsText = (points ?? [])
      .map(
        (p: any, i: number) =>
          `${i + 1}. [${formatSeconds(Number(p.time_seconds))}] ${p.note || "—"}`,
      )
      .join("\n");

    const finalComment = [userComment, pointsText].filter(Boolean).join("\n\n");

    const { error } = await supabaseAdmin
      .from("posts")
      .update({
        status: "rejected",
        client_comment: finalComment,
        responded_at: new Date().toISOString(),
      })
      .eq("id", data.postId)
      .eq("client_id", client.id);
    if (error) throw error;

    await notifyWhatsApp(
      `❌ ${client.name} reprovou o post de ${formatScheduledDate(existing.scheduled_at)}.\n${finalComment}`,
    );
    return { ok: true };
  });

/** Cria signed upload URL para o frame capturado do vídeo (bucket adjustment-frames). */
export const createAdjustmentFrameUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; postId: string }) =>
    z
      .object({ token: z.string().uuid(), postId: z.string().uuid() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = await getClientByToken(supabaseAdmin, data.token);
    await ensurePostBelongsToClient(supabaseAdmin, data.postId, client.id);

    const path = `${data.postId}/${crypto.randomUUID()}.jpg`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKETS.frames)
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const addAdjustmentPointByToken = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      token: string;
      postId: string;
      time_seconds: number;
      note: string;
      frame_path?: string | null;
    }) =>
      z
        .object({
          token: z.string().uuid(),
          postId: z.string().uuid(),
          time_seconds: z.number().min(0),
          note: z.string().min(1),
          frame_path: z.string().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = await getClientByToken(supabaseAdmin, data.token);
    await ensurePostBelongsToClient(supabaseAdmin, data.postId, client.id);

    const { data: point, error } = await supabaseAdmin
      .from("post_adjustment_points")
      .insert({
        post_id: data.postId,
        time_seconds: data.time_seconds,
        note: data.note,
        frame_url: data.frame_path ?? null,
      })
      .select("id, time_seconds, note, frame_url, created_at")
      .single();
    if (error) throw error;

    const frame_signed_url = await signPath(
      supabaseAdmin,
      BUCKETS.frames,
      point.frame_url,
    );
    return { ...point, frame_signed_url };
  });

export const deleteAdjustmentPointByToken = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; pointId: string }) =>
    z
      .object({ token: z.string().uuid(), pointId: z.string().uuid() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = await getClientByToken(supabaseAdmin, data.token);

    const { data: point, error: pErr } = await supabaseAdmin
      .from("post_adjustment_points")
      .select("id, post_id, frame_url, posts:posts!inner(client_id)")
      .eq("id", data.pointId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!point || (point as any).posts.client_id !== client.id) {
      throw new Error("Ponto não encontrado");
    }

    if (point.frame_url) {
      await supabaseAdmin.storage.from(BUCKETS.frames).remove([point.frame_url]);
    }
    const { error } = await supabaseAdmin
      .from("post_adjustment_points")
      .delete()
      .eq("id", data.pointId);
    if (error) throw error;
    return { ok: true };
  });

async function ensurePostBelongsToClient(admin: any, postId: string, clientId: string) {
  const { data, error } = await admin
    .from("posts")
    .select("id, status")
    .eq("id", postId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Post não encontrado");
  return data;
}

async function getClientByToken(admin: any, token: string) {
  const { data, error } = await admin
    .from("clients")
    .select("id, name, status")
    .eq("access_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Link inválido");
  if (data.status === "inactive") throw new Error("Acesso desativado");
  return data;
}


/**
 * Retorna slots de Edição (delivery_slots) para um cliente, validando pelo token.
 * Somente leitura.
 */
export const getDeliverySlotsByToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string; monthStart: string; monthEnd: string }) =>
    z
      .object({
        token: z.string().uuid(),
        monthStart: z.string(),
        monthEnd: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await getClientByToken(supabaseAdmin, data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("delivery_slots")
      .select("*")
      .gte("slot_date", data.monthStart)
      .lte("slot_date", data.monthEnd);
    if (error) throw error;
    return rows ?? [];
  });

/**
 * Retorna slots de Design (design_slots) para um cliente, validando pelo token.
 * Também devolve URLs assinadas das referências.
 */
export const getDesignSlotsByToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string; monthStart: string; monthEnd: string }) =>
    z
      .object({
        token: z.string().uuid(),
        monthStart: z.string(),
        monthEnd: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await getClientByToken(supabaseAdmin, data.token);
    const { data: rows, error } = await supabaseAdmin
      .from("design_slots")
      .select("*")
      .gte("slot_date", data.monthStart)
      .lte("slot_date", data.monthEnd);
    if (error) throw error;

    const allPaths = new Set<string>();
    for (const r of rows ?? []) {
      for (const p of (r as any).references_images ?? []) allPaths.add(p);
    }
    const signedByPath: Record<string, string> = {};
    if (allPaths.size > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from("design-references")
        .createSignedUrls([...allPaths], 60 * 60);
      const paths = [...allPaths];
      (signed ?? []).forEach((s, i) => {
        if (s.signedUrl) signedByPath[paths[i]] = s.signedUrl;
      });
    }
    return { rows: rows ?? [], signedByPath };
  });
