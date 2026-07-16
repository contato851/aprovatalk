import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClient, listPosts } from "@/lib/admin.functions";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";



export const Route = createFileRoute("/_authenticated/clients/$clientId/")({
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const getClientFn = useServerFn(getClient);
  const listPostsFn = useServerFn(listPosts);

  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientFn({ data: { id: clientId } }),
  });
  const postsQ = useQuery({
    queryKey: ["posts", { clientId }],
    queryFn: () => listPostsFn({ data: { clientId } }),
  });

  if (!clientQ.data) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const c = clientQ.data as any;


  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        {c.avatar_signed_url ? (
          <img
            src={c.avatar_signed_url}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-muted" />
        )}
        <div>
          <h1 className="font-display text-3xl font-bold">{c.name}</h1>
          <p className="text-sm text-muted-foreground">@{c.instagram_handle}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link
            to="/clients/$clientId/new"
            params={{ clientId }}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Novo post
          </Link>
        </div>

      </div>

      <div>
        <h2 className="font-display text-lg font-semibold">Posts</h2>
        {postsQ.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : (postsQ.data ?? []).length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum post ainda. Crie o primeiro.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(postsQ.data as any[]).map((p) => {
              const thumb =
                p.cover_signed_url ??
                (p.media?.[0]?.kind === "image" ? p.media[0].signed_url : null);
              return (
                <Link
                  key={p.id}
                  to="/posts/$postId/edit"
                  params={{ postId: p.id }}
                  className="group overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-lg"
                >
                  <div className="relative aspect-[3/4] bg-muted">
                    {p.midia_arquivada ? (
                      <div className="flex h-full w-full items-center justify-center bg-muted/60">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Mídia arquivada
                        </p>
                      </div>
                    ) : (
                      thumb && (
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      )
                    )}
                    <span
                      className={`absolute left-2 top-2 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                        p.type === "static"
                          ? "bg-brand-orange text-white"
                          : p.type === "carousel"
                            ? "bg-brand-purple text-white"
                            : "bg-brand-chartreuse text-emerald-950"
                      }`}
                    >
                      {p.type === "static" ? "Estático" : p.type === "carousel" ? "Carrossel" : "Reel"}
                    </span>
                    <span
                      className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        p.status === "approved"
                          ? "border-brand-chartreuse/30 bg-brand-chartreuse-soft text-emerald-700"
                          : p.status === "rejected"
                            ? "border-brand-purple/30 bg-brand-purple-soft text-brand-purple"
                            : "border-brand-orange/30 bg-brand-orange-soft text-brand-orange"
                      }`}
                    >
                      {p.status === "approved"
                        ? "Aprovado"
                        : p.status === "rejected"
                          ? "Reprovado"
                          : "Pendente"}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {format(parseISO(p.scheduled_at), "dd/MM 'às' HH'h'", { locale: ptBR })}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm">{p.caption || "—"}</p>
                    {p.status === "rejected" && p.client_comment && (
                      <p className="mt-2 rounded-md bg-brand-purple-soft p-2 text-xs text-brand-purple">
                        💬 {p.client_comment}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
