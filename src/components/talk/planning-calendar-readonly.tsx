import { useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

function typeLabel(t: string) {
  return t === "static" ? "Estático" : t === "carousel" ? "Carrossel" : "Reels";
}
function typeBadgeClass(t: string) {
  return t === "static"
    ? "bg-brand-orange text-white"
    : t === "carousel"
      ? "bg-brand-purple text-white"
      : "bg-brand-chartreuse text-emerald-950";
}

/** Calendário de planejamento em modo somente leitura (portal do cliente). */
export function PlanningCalendarReadOnly({ posts }: { posts: any[] }) {
  const [cursor, setCursor] = useState(new Date());
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const monthPosts = useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    return posts
      .filter((p) => {
        try {
          return isWithinInterval(parseISO(p.scheduled_at), { start, end });
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }, [posts, cursor]);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <button
          onClick={() => setCursor(subMonths(cursor, 1))}
          className="rounded-full p-1.5 hover:bg-accent"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="flex-1 text-center font-display text-base font-semibold capitalize">
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

      {monthPosts.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Nenhum conteúdo planejado neste mês.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {monthPosts.map((p) => {
            const d = parseISO(p.scheduled_at);
            const isOpen = !!open[p.id];
            const title = p.planning_title || p.caption || "Sem título";
            const hasDetails = p.briefing || p.script || p.caption;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))}
                  aria-expanded={isOpen}
                  className="flex w-full items-start gap-3 p-3 text-left hover:bg-accent/40"
                >
                  <div className="w-12 shrink-0 text-center">
                    <div className="font-display text-lg font-bold leading-none">
                      {format(d, "dd")}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {format(d, "EEE", { locale: ptBR })}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${typeBadgeClass(p.type)}`}
                      >
                        {typeLabel(p.type)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {format(d, "dd/MM 'às' HH'h'mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-sm font-medium">
                      {title}
                    </p>
                  </div>
                  <ChevronDown
                    className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`}
                  />
                </button>

                {isOpen && (
                  <div className="space-y-3 border-t border-border/60 bg-background/40 p-3">
                    {!hasDetails && (
                      <p className="text-xs text-muted-foreground">
                        Detalhes ainda não preenchidos.
                      </p>
                    )}
                    {p.briefing && <Block label="Briefing" text={p.briefing} />}
                    {p.script && (
                      <Block label="Roteiro / Estrutura" text={p.script} />
                    )}
                    {p.caption && <Block label="Legenda" text={p.caption} />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <FormattedText
        text={text}
        className="rounded-md bg-muted/60 p-2 break-words"
      />
    </div>
  );
}
