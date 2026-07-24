import { createFileRoute } from "@tanstack/react-router";

/**
 * Rotina de limpeza automática de mídia.
 * Roda uma vez por dia via pg_cron.
 *
 * Regras:
 * - Considera posts cuja scheduled_at é anterior a 15 dias atrás.
 * - Nunca apaga mídia de posts pendentes (status = 'pending').
 * - Remove arquivos dos buckets post-media e post-covers.
 * - Mantém o registro do post; apenas marca midia_arquivada = true.
 */
export const Route = createFileRoute("/api/public/hooks/cleanup-media")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 15);
        const cutoffIso = cutoff.toISOString();

        // Busca posts elegíveis: data programada > 15 dias atrás e ainda não arquivados
        const { data: posts, error: postsErr } = await supabaseAdmin
          .from("posts")
          .select(
            "id, status, scheduled_at, cover_url, midia_arquivada, media:post_media(id, url)",
          )
          .lt("scheduled_at", cutoffIso)
          .eq("midia_arquivada", false);

        if (postsErr) {
          console.error("[cleanup-media] erro ao buscar posts", postsErr);
          return json({ error: postsErr.message }, 500);
        }

        const skippedPending: string[] = [];
        const processed: string[] = [];
        const errors: Array<{ postId: string; error: string }> = [];
        let deletedMediaFiles = 0;
        let deletedCoverFiles = 0;

        for (const post of posts ?? []) {
          // Regra de segurança: nunca apaga mídia de rascunhos ou pendentes
          if (post.status === "pending" || post.status === "planning") {
            skippedPending.push(post.id);
            console.log(
              `[cleanup-media] IGNORADO (${post.status}) post=${post.id} scheduled_at=${post.scheduled_at}`,
            );
            continue;
          }

          const mediaPaths: string[] = (post.media ?? [])
            .map((m: any) => m.url)
            .filter(Boolean);

          if (mediaPaths.length > 0) {
            const { error: rmErr } = await supabaseAdmin.storage
              .from("post-media")
              .remove(mediaPaths);
            if (rmErr) {
              console.error(
                `[cleanup-media] erro removendo post-media do post=${post.id}`,
                rmErr,
              );
              errors.push({ postId: post.id, error: rmErr.message });
              continue;
            }
            deletedMediaFiles += mediaPaths.length;
          }

          if (post.cover_url) {
            const { error: cErr } = await supabaseAdmin.storage
              .from("post-covers")
              .remove([post.cover_url]);
            if (cErr) {
              console.error(
                `[cleanup-media] erro removendo capa do post=${post.id}`,
                cErr,
              );
              errors.push({ postId: post.id, error: cErr.message });
              continue;
            }
            deletedCoverFiles += 1;
          }

          const { error: updErr } = await supabaseAdmin
            .from("posts")
            .update({ midia_arquivada: true, cover_url: null })
            .eq("id", post.id);
          if (updErr) {
            console.error(
              `[cleanup-media] erro marcando midia_arquivada post=${post.id}`,
              updErr,
            );
            errors.push({ postId: post.id, error: updErr.message });
            continue;
          }

          // Remove também as linhas de post_media (os arquivos já foram removidos)
          await supabaseAdmin.from("post_media").delete().eq("post_id", post.id);

          processed.push(post.id);
          console.log(
            `[cleanup-media] ARQUIVADO post=${post.id} scheduled_at=${post.scheduled_at} media=${mediaPaths.length} cover=${post.cover_url ? 1 : 0}`,
          );
        }

        const summary = {
          ok: true,
          cutoff: cutoffIso,
          totalCandidates: posts?.length ?? 0,
          processed: processed.length,
          skippedPending: skippedPending.length,
          deletedMediaFiles,
          deletedCoverFiles,
          errors,
        };
        console.log("[cleanup-media] resumo", summary);
        return json(summary);
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
