import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createPost } from "@/lib/admin.functions";

type Row = { title: string; type: "static" | "carousel" | "video" | "" };

const TYPES = [
  { v: "static", l: "Estático" },
  { v: "carousel", l: "Carrossel" },
  { v: "video", l: "Reels" },
] as const;

export function PlanningCalendar({
  clientId,
  existingPosts,
  onCreated,
}: {
  clientId: string;
  existingPosts: any[];
  onCreated: () => void;
}) {
  const createPostFn = useServerFn(createPost);
  const [cursor, setCursor] = useState(new Date());
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState(false);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(cursor),
        end: endOfMonth(cursor),
      }),
    [cursor],
  );

  const filled = Object.entries(rows).filter(
    ([, r]) => r.title.trim() !== "" && r.type !== "",
  );

  function setRow(key: string, patch: Partial<Row>) {
    setRows((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { title: "", type: "" }), ...patch },
    }));
  }


  async function handleGenerate() {
    if (filled.length === 0) {
      toast.error("Preencha ao menos uma data com título e tipo.");
      return;
    }
    setSaving(true);
    let ok = 0;
    try {
      for (const [key, r] of filled) {
        const d = parseISO(key);
        const scheduled = new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate(),
          12,
          0,
          0,
        );
        await createPostFn({
          data: {
            client_id: clientId,
            type: r.type as "static" | "carousel" | "video",
            caption: r.title.trim(),
            scheduled_at: scheduled.toISOString(),
            media: [],
            status: "planning",
          },
        });
        ok++;
      }
      toast.success(
        `${ok} ${ok === 1 ? "post criado" : "posts criados"} no planejamento.`,
      );
      setRows({});
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar posts.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-3">
        <button
          onClick={() => setCursor(subMonths(cursor, 1))}
          className="rounded-full p-1.5 hover:bg-accent"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="font-display text-base font-semibold capitalize">
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

      <ul className="divide-y divide-border">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const row = rows[key] ?? { title: "", type: "" };
          const count = existingPosts.filter((p) =>
            isSameDay(parseISO(p.scheduled_at), day),
          ).length;
          const weekend = [0, 6].includes(day.getDay());
          return (
            <li
              key={key}
              className={`flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center ${
                weekend ? "bg-muted/40" : ""
              }`}
            >
              <div className="flex w-full shrink-0 items-center gap-2 sm:w-32">
                <span className="font-display text-lg font-bold leading-none">
                  {format(day, "dd")}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {format(day, "EEE", { locale: ptBR })}
                </span>
                {count > 0 && (
                  <span className="ml-auto rounded-full bg-brand-purple-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-purple sm:ml-0">
                    {count}
                  </span>
                )}
              </div>
              <input
                value={row.title}
                onChange={(e) => setRow(key, { title: e.target.value })}
                placeholder="Título do conteúdo"
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              <div className="flex shrink-0 gap-1">
                {TYPES.map((t) => (
                  <button
                    key={t.v}
                    type="button"
                    onClick={() =>
                      setRow(key, { type: row.type === t.v ? "" : t.v })
                    }
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      row.type === t.v
                        ? t.v === "static"
                          ? "border-brand-orange bg-brand-orange text-white"
                          : t.v === "carousel"
                            ? "border-brand-purple bg-brand-purple text-white"
                            : "border-brand-chartreuse bg-brand-chartreuse text-emerald-950"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.l}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3">
        <p className="text-xs text-muted-foreground">
          {filled.length} {filled.length === 1 ? "data preenchida" : "datas preenchidas"}
        </p>
        <button
          onClick={handleGenerate}
          disabled={saving || filled.length === 0}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Gerar posts no planejamento
        </button>
      </div>
    </div>
  );
}
