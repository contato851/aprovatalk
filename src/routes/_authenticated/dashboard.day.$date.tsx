import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPosts } from "@/lib/admin.functions";
import { format, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/day/$date")({
  component: DayPage,
  head: ({ params }) => ({
    meta: [
      { title: `Eventos de ${params.date} — Talk` },
      { name: "description", content: `Posts agendados para ${params.date}.` },
    ],
  }),
});

type Post = Awaited<ReturnType<typeof listPosts>>[number];

function DayPage() {
  const { date } = Route.useParams();
  const listPostsFn = useServerFn(listPosts);
  const day = parseISO(date);

  const postsQ = useQuery({
    queryKey: ["posts", {}],
    queryFn: () => listPostsFn({ data: {} }),
  });

  const dayPosts = (postsQ.data ?? []).filter((p: Post) =>
    isSameDay(parseISO(p.scheduled_at), day),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao calendário
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold capitalize">
          {format(day, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dayPosts.length} {dayPosts.length === 1 ? "post agendado" : "posts agendados"}.
        </p>
      </div>

      {postsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : dayPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Nenhum post para este dia.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {dayPosts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-brand-orange-soft text-brand-orange border-brand-orange/20" },
    approved: { label: "Aprovado", className: "bg-brand-chartreuse-soft text-emerald-700 border-brand-chartreuse/30" },
    rejected: { label: "Reprovado", className: "bg-brand-purple-soft text-brand-purple border-brand-purple/30" },
    planning: { label: "Planejamento", className: "bg-muted text-muted-foreground border-border" },
    ready_for_review: { label: "Pronto p/ revisão", className: "bg-brand-chartreuse-soft text-emerald-700 border-brand-chartreuse/30" },
  };
  const it = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${it.className}`}>
      {it.label}
    </span>
  );
}

function TypeLabel({ type }: { type: string }) {
  const label = type === "static" ? "Estático" : type === "carousel" ? "Carrossel" : "Reel";
  return (
    <span
      className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${
        type === "static"
          ? "bg-brand-orange text-white"
          : type === "carousel"
            ? "bg-brand-purple text-white"
            : "bg-brand-chartreuse text-emerald-950"
      }`}
    >
      {label}
    </span>
  );
}

function PostCard({ post }: { post: Post }) {
  const firstMedia = post.media?.[0];
  const thumb =
    post.cover_signed_url ??
    (firstMedia?.kind === "image" ? firstMedia.signed_url : null);
  return (
    <Link
      to="/posts/$postId/edit"
      params={{ postId: post.id }}
      className="group overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-lg"
    >
      <div className="relative aspect-[3/4] bg-muted">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            sem mídia
          </div>
        )}
        <div className="absolute left-2 top-2">
          <StatusBadge status={post.status} />
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <TypeLabel type={post.type} />
          <span className="text-[11px] text-muted-foreground">
            {format(parseISO(post.scheduled_at), "HH'h'mm", { locale: ptBR })}
          </span>
        </div>
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {post.client?.name ?? "—"}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-foreground/90">
          {post.caption || "—"}
        </p>
      </div>
    </Link>
  );
}
