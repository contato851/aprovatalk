import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getClient,
  listPosts,
  releasePostForApproval,
} from "@/lib/admin.functions";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Plus, Rocket } from "lucide-react";
import { toast } from "sonner";
import { PlanningCalendar } from "@/components/talk/planning-calendar";
import {
  PostSortFilterBar,
  usePostSortFilter,
} from "@/components/talk/post-sort-filter";


const searchSchema = z.object({
  tab: z.enum(["planning", "review", "approval"]).default("approval"),
});

export const Route = createFileRoute("/_authenticated/clients/$clientId/")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const getClientFn = useServerFn(getClient);
  const listPostsFn = useServerFn(listPosts);
  const releaseFn = useServerFn(releasePostForApproval);

  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientFn({ data: { id: clientId } }),
  });
  const postsQ = useQuery({
    queryKey: ["posts", { clientId }],
    queryFn: () => listPostsFn({ data: { clientId } }),
  });

  const all = (postsQ.data ?? []) as any[];
  const planning = all.filter((p) => p.status === "planning");
  const review = all.filter((p) => p.status === "ready_for_review");
  const approval = all.filter(
    (p) => p.status !== "planning" && p.status !== "ready_for_review",
  );
  const baseList =
    tab === "planning" ? planning : tab === "review" ? review : approval;
  const sf = usePostSortFilter(baseList);
  const list = sf.result;
  const c = clientQ.data as any;

  async function handleRelease(id: string) {
    try {
      const res = await releaseFn({ data: { id } });
      if (!res.ok) {
        toast.error(`Faltam: ${res.missing.join(", ")}.`);
        return;
      }
      toast.success("Post liberado para aprovação.");
      postsQ.refetch();
      navigate({
        to: "/clients/$clientId",
        params: { clientId },
        search: { tab: "approval" },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        {c.avatar_signed_url ? (
          <img
            src={c.avatar_signed_url}
            alt=""
            className="h-16 w-16 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-full border border-border bg-muted" />
        )}
        <div>
          <h1 className="font-display text-3xl font-bold">{c.name}</h1>
          <p className="text-sm text-muted-foreground">@{c.instagram_handle}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => {
              const link = `${typeof window !== "undefined" ? window.location.origin : ""}/c/${c.access_token}`;
              navigator.clipboard.writeText(link);
              toast.success("Link copiado!");
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Copy className="h-4 w-4" /> Copiar link do cliente
          </button>
          <Link
            to="/clients/$clientId/new"
            params={{ clientId }}
            search={{ status: tab === "planning" ? "planning" : "pending" }}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {tab === "planning" ? "Novo rascunho" : "Novo post"}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-1 w-full sm:flex-row sm:flex-wrap sm:rounded-full sm:w-fit">
        {(
          [
            { v: "planning", l: `Planejamento (${planning.length})` },
            { v: "review", l: `Pronto p/ revisão (${review.length})` },
            { v: "approval", l: `Aprovação (${approval.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.v}
            onClick={() =>
              navigate({
                to: "/clients/$clientId",
                params: { clientId },
                search: { tab: t.v },
              })
            }
            className={`w-full rounded-full px-4 py-1.5 text-sm font-medium transition sm:w-auto ${
              tab === t.v
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === "planning" && (
        <div className="space-y-2">
          <div>
            <h2 className="font-display text-lg font-semibold">
              Calendário de planejamento
            </h2>
            <p className="text-xs text-muted-foreground">
              Preencha o título e o tipo de conteúdo nas datas do mês e gere os posts de uma vez.
            </p>
          </div>
          <PlanningCalendar
            clientId={clientId}
            existingPosts={all}
            onCreated={() => postsQ.refetch()}
          />
        </div>
      )}

      <div>

        {postsQ.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : list.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {tab === "planning"
              ? "Nenhum rascunho ainda. Crie um novo para começar o planejamento."
              : tab === "review"
                ? "Nenhum post aguardando revisão."
                : "Nenhum post em aprovação."}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => {
              const thumb =
                p.cover_signed_url ??
                (p.media?.[0]?.kind === "image" ? p.media[0].signed_url : null);
              const isPlanning = p.status === "planning";
              const isReady = p.status === "ready_for_review";
              const linkedSlot = p.linked_design_slot ?? p.linked_delivery_slot;
              const linkedKind = p.linked_design_slot
                ? "design"
                : p.linked_delivery_slot
                  ? "delivery"
                  : null;
              return (
                <div
                  key={p.id}
                  className="group overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-lg"
                >
                  <Link
                    to="/posts/$postId/edit"
                    params={{ postId: p.id }}
                    className="block"
                  >
                    <div className="relative aspect-[3/4] bg-muted">
                      {p.midia_arquivada ? (
                        <div className="flex h-full w-full items-center justify-center bg-muted/60">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Mídia arquivada
                          </p>
                        </div>
                      ) : thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Sem mídia
                          </p>
                        </div>
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
                        {p.type === "static"
                          ? "Estático"
                          : p.type === "carousel"
                            ? "Carrossel"
                            : "Reel"}
                      </span>
                      <span
                        className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          p.status === "planning"
                            ? "border-border bg-muted text-muted-foreground"
                            : p.status === "ready_for_review"
                              ? "border-brand-purple/40 bg-brand-purple text-white"
                              : p.status === "approved"
                                ? "border-brand-chartreuse/30 bg-brand-chartreuse-soft text-emerald-700"
                                : p.status === "rejected"
                                  ? "border-brand-purple/30 bg-brand-purple-soft text-brand-purple"
                                  : "border-brand-orange/30 bg-brand-orange-soft text-brand-orange"
                        }`}
                      >
                        {p.status === "planning"
                          ? "Planejamento"
                          : p.status === "ready_for_review"
                            ? "Pronto p/ revisão"
                            : p.status === "approved"
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
                      {linkedSlot && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-brand-purple-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-purple">
                          {linkedKind === "design" ? "🎨 Design" : "🎬 Edição"}
                          {linkedSlot.slot_date &&
                            ` · ${format(parseISO(linkedSlot.slot_date), "dd/MM", { locale: ptBR })}`}
                          {linkedSlot.done ? " ✓" : ""}
                        </div>
                      )}
                      <p className="mt-1 line-clamp-2 text-sm">{p.caption || "—"}</p>
                      {p.status === "rejected" && p.client_comment && (
                        <p className="mt-2 rounded-md bg-brand-purple-soft p-2 text-xs text-brand-purple">
                          💬 {p.client_comment}
                        </p>
                      )}
                    </div>
                  </Link>
                  {(isPlanning || isReady) && (
                    <div className="border-t border-border p-2">
                      <button
                        onClick={() => handleRelease(p.id)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-chartreuse px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-brand-chartreuse/90"
                      >
                        <Rocket className="h-3.5 w-3.5" /> Liberar para aprovação
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
