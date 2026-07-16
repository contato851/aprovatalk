import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BUCKETS = {
  avatars: "avatars",
  media: "post-media",
  covers: "post-covers",
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
  // CallMeBot espera o número com "+" e código do país. Normaliza removendo espaços/traços
  // e garantindo o "+" no início.
  const digits = rawPhone.replace(/[^\d]/g, "");
  const phone = `+${digits}`;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`;
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
      .select("*, media:post_media(id, url, position, kind)")
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
        return {
          ...p,
          media,
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

export const rejectPostByToken = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; postId: string; comment: string }) =>
    z
      .object({
        token: z.string().uuid(),
        postId: z.string().uuid(),
        comment: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = await getClientByToken(supabaseAdmin, data.token);
    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .update({
        status: "rejected",
        client_comment: data.comment,
        responded_at: new Date().toISOString(),
      })
      .eq("id", data.postId)
      .eq("client_id", client.id)
      .select("scheduled_at")
      .single();
    if (error) throw error;
    await notifyWhatsApp(
      `❌ ${client.name} reprovou o post de ${formatScheduledDate(post.scheduled_at)}. Comentário: ${data.comment}`,
    );
    return { ok: true };
  });

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
