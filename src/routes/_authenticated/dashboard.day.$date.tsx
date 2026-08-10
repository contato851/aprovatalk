import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPosts, listClients } from "@/lib/admin.functions";
import { format, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { PlanningRow, statusLabel } from "@/components/talk/planning-row";

export const Route = createFileRoute("/_authenticated/dashboard/day/$date")({
  component: DayPage,
  head: ({ params }) => ({
    meta: [
      { title: `Planejamento de ${params.date} — Talk` },
      {
        name: "description",
        content: `Cards de planejamento de cada cliente para ${params.date}.`,
      },
    ],
  }),
});

function DayPage() {
  const { date } = Route.useParams();
  const listPostsFn = useServerFn(listPosts);
  const listClientsFn = useServerFn(listClients);
  const day = parseISO(date);

  const postsQ = useQuery({
    queryKey: ["posts", {}],
    queryFn: () => listPostsFn({ data: {} }),
  });
  const clientsQ = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClientsFn({ data: {} } as any),
  });

  const clients = (clientsQ.data ?? []) as any[];
  const dayPosts = ((postsQ.data ?? []) as any[]).filter((p) =>
    isSameDay(parseISO(p.scheduled_at), day),
  );

  // um card por cliente: prioriza o post em planejamento daquele dia
  function postFor(clientId: string) {
    const list = dayPosts.filter((p) => p.client_id === clientId);
    return list.find((p) => p.status === "planning") ?? list[0] ?? null;
  }

  const clientsWithEvents = clients.filter((c) => postFor(c.id));

  function refetch() {
    postsQ.refetch();
  }

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
          Planejamento do dia — um card por cliente.
        </p>
      </div>

      {postsQ.isLoading || clientsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Nenhum cliente cadastrado.
        </div>
      ) : (
        <ul className="space-y-3">
          {clients.map((c) => {
            const post = postFor(c.id);
            return (
              <PlanningRow
                key={c.id}
                clientId={c.id}
                dateKey={date}
                post={post}
                onSaved={refetch}
                header={
                  <>
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId: c.id }}
                      className="truncate text-sm font-semibold hover:underline"
                    >
                      {c.name}
                    </Link>
                    {post && (
                      <span className="w-fit max-w-full truncate rounded-full bg-brand-purple-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-purple">
                        {statusLabel(post.status)}
                      </span>
                    )}
                  </>
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
