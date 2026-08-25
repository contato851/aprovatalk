import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPosts, listClients } from "@/lib/admin.functions";
import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TalkStar } from "@/components/talk/star";
import { PostMediaPlaceholder } from "@/components/talk/post-media-placeholder";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Calendário de posts — Aprova Talk" },
      {
        name: "description",
        content: "Calendário administrativo de posts programados por cliente e data.",
      },
      { property: "og:title", content: "Calendário de posts — Aprova Talk" },
      {
        property: "og:description",
        content: "Calendário administrativo de posts programados por cliente e data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Post = Awaited<ReturnType<typeof listPosts>>[number];

function DashboardPage() {
  const listPostsFn = useServerFn(listPosts);
  const listClientsFn = useServerFn(listClients);

  const [filters, setFilters] = useState<{
    clientId?: string;
    type?: "static" | "carousel" | "video";
    status?: "pending" | "approved" | "rejected";
  }>({});
  

  const clientsQ = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClientsFn({ data: undefined as any }),
  });

  const postsQ = useQuery({
    queryKey: ["posts", filters],
    queryFn: () =>
      listPostsFn({ data: { ...filters, includeMedia: false, includeDetails: false } }),
  });

  const posts = postsQ.data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Calendário</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os posts programados, por cliente e por data.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap">
        <FilterSelect
          value={filters.clientId ?? ""}
          onChange={(v) =>
            setFilters((f) => ({ ...f, clientId: v || undefined }))
          }
          label="Cliente"
          options={[
            { value: "", label: "Todos os clientes" },
            ...(clientsQ.data ?? []).map((c: any) => ({
              value: c.id,
              label: c.name,
            })),
          ]}
        />
        <FilterSelect
          value={filters.type ?? ""}
          onChange={(v) => setFilters((f) => ({ ...f, type: (v || undefined) as any }))}
          label="Tipo"
          options={[
            { value: "", label: "Todos os tipos" },
            { value: "static", label: "Estático" },
            { value: "carousel", label: "Carrossel" },
            { value: "video", label: "Vídeo" },
          ]}
        />
        <FilterSelect
          value={filters.status ?? ""}
          onChange={(v) => setFilters((f) => ({ ...f, status: (v || undefined) as any }))}
          label="Status"
          options={[
            { value: "", label: "Todos os status" },
            { value: "pending", label: "Pendente" },
            { value: "approved", label: "Aprovado" },
            { value: "rejected", label: "Reprovado" },
          ]}
        />
      </div>

      {postsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : posts.length === 0 ? (
        <EmptyState />
      ) : (
        <CalendarView posts={posts as Post[]} />
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex w-full flex-col gap-1 sm:w-auto">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm sm:w-auto"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: {
      label: "Pendente",
      className: "bg-brand-orange-soft text-brand-orange border-brand-orange/20",
    },
    approved: {
      label: "Aprovado",
      className:
        "bg-brand-chartreuse-soft text-emerald-700 border-brand-chartreuse/30",
    },
    rejected: {
      label: "Reprovado",
      className:
        "bg-brand-purple-soft text-brand-purple border-brand-purple/30",
    },
  };
  const it = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${it.className}`}
    >
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

function ListView({ posts }: { posts: Post[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, { client: any; posts: Post[] }>();
    for (const p of posts) {
      const key = p.client?.id ?? "sem-cliente";
      if (!map.has(key)) map.set(key, { client: p.client, posts: [] });
      map.get(key)!.posts.push(p);
    }
    return Array.from(map.values());
  }, [posts]);

  return (
    <div className="space-y-8">
      {grouped.map((g) => (
        <section key={g.client?.id ?? "x"}>
          <header className="mb-3 flex items-center gap-3">
            {g.client?.avatar_signed_url ? (
              <img
                src={g.client.avatar_signed_url}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-muted" />
            )}
            <div>
              <h2 className="font-display text-lg font-semibold leading-none">
                {g.client?.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                @{g.client?.instagram_handle}
              </p>
            </div>
            <Link
              to="/clients/$clientId"
              params={{ clientId: g.client?.id }}
              search={{ tab: "approval" }}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Abrir cliente →
            </Link>
          </header>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {g.posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
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
        {post.midia_arquivada ? (
          <div className="flex h-full w-full items-center justify-center bg-muted/60">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Mídia arquivada
            </p>
          </div>
        ) : thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <PostMediaPlaceholder type={post.type} status={post.status} />
        )}
        <div className="absolute left-2 top-2">
          <StatusBadge status={post.status} />
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <TypeLabel type={post.type} />
          <span className="text-[11px] text-muted-foreground">
            {format(parseISO(post.scheduled_at), "dd/MM 'às' HH'h'", {
              locale: ptBR,
            })}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-foreground/90">
          {post.caption || "—"}
        </p>
        {post.status === "rejected" && post.client_comment && (
          <p className="mt-2 rounded-md bg-brand-purple-soft p-2 text-xs text-brand-purple">
            💬 {post.client_comment}
          </p>
        )}
      </div>
    </Link>
  );
}

function CalendarView({ posts }: { posts: Post[] }) {
  const [cursor, setCursor] = useState(new Date());
  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);
  const days = eachDayOfInterval({ start, end });
  const leadingBlanks = start.getDay();

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-center gap-2">
        <button
          onClick={() => setCursor(subMonths(cursor, 1))}
          className="rounded-full p-1.5 hover:bg-accent"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="font-display text-lg font-semibold capitalize">
          {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
        </h3>
        <button
          onClick={() => setCursor(addMonths(cursor, 1))}
          className="rounded-full p-1.5 hover:bg-accent"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`b${i}`} />
        ))}
        {days.map((day) => {
          const dayPosts = posts.filter((p) =>
            isSameDay(parseISO(p.scheduled_at), day),
          );
          return (
            <Link
              key={day.toISOString()}
              to="/dashboard/day/$date"
              params={{ date: format(day, "yyyy-MM-dd") }}
              className="min-h-[92px] rounded-lg border border-border bg-background p-1.5 text-left transition hover:border-foreground/30 hover:bg-accent/40"
            >
              <div className="text-[11px] font-medium text-muted-foreground">
                {format(day, "d")}
              </div>
              <div className="mt-1 space-y-1">
                {dayPosts.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className={`block truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      p.status === "approved"
                        ? "bg-brand-chartreuse-soft text-emerald-700"
                        : p.status === "rejected"
                          ? "bg-brand-purple-soft text-brand-purple"
                          : "bg-brand-orange-soft text-brand-orange"
                    }`}
                  >
                    {p.client?.name ?? "post"}
                  </div>
                ))}
                {dayPosts.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">
                    +{dayPosts.length - 3}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-20 text-center">
      <TalkStar className="h-12 w-12 text-brand-orange-soft" />
      <h3 className="mt-4 font-display text-lg font-semibold">
        Nada por aqui ainda
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Cadastre um cliente e comece a enviar posts para aprovação.
      </p>
      <Link
        to="/clients"
        className="mt-6 inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Ir para clientes
      </Link>
    </div>
  );
}
