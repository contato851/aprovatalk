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
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { createPost, updatePlanningPost } from "@/lib/admin.functions";

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
  const updatePlanningFn = useServerFn(updatePlanningPost);
  const [cursor, setCursor] = useState(new Date());
  const [collapsed, setCollapsed] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState(false);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(cursor),
        end: endOfMonth(cursor),
      }),
    [cursor],
  );

  // Posts já em planejamento, indexados por data (o primeiro de cada dia)
  const baseline = useMemo(() => {
    const map: Record<string, { id: string; title: string; type: Row["type"] }> =
      {};
    for (const p of existingPosts) {
      if (p.status !== "planning") continue;
      const key = format(parseISO(p.scheduled_at), "yyyy-MM-dd");
      if (map[key]) continue;
      map[key] = { id: p.id, title: p.caption ?? "", type: p.type };
    }
    return map;
  }, [existingPosts]);

  function rowFor(key: string): Row {
    const o = overrides[key];
    if (o) return o;
    const b = baseline[key];
    return b ? { title: b.title, type: b.type } : { title: "", type: "" };
  }

  function setRow(key: string, patch: Partial<Row>) {
    setOverrides((prev) => ({ ...prev, [key]: { ...rowFor(key), ...patch } }));
  }

  const pending = useMemo(() => {
    const creates: { key: string; row: Row }[] = [];
    const updates: { id: string; row: Row }[] = [];
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      const r = rowFor(key);
      if (!r.title.trim() || r.type === "") continue;
      const b = baseline[key];
      if (!b) creates.push({ key, row: r });
      else if (b.title !== r.title || b.type !== r.type)
        updates.push({ id: b.id, row: r });
    }
    return { creates, updates };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, overrides, baseline]);

  const changes = pending.creates.length + pending.updates.length;

  async function handleGenerate() {
    if (changes === 0) {
      toast.error("Nada novo para salvar.");
      return;
    }
    setSaving(true);
    try {
      for (const { key, row } of pending.creates) {
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
            type: row.type as "static" | "carousel" | "video",
            caption: row.title.trim(),
            scheduled_at: scheduled.toISOString(),
            media: [],
            status: "planning",
          },
        });
      }
      for (const { id, row } of pending.updates) {
        await updatePlanningFn({
          data: {
            id,
            type: row.type as "static" | "carousel" | "video",
            caption: row.title.trim(),
          },
        });
      }
      toast.success(
        `${pending.creates.length} criado(s), ${pending.updates.length} atualizado(s).`,
      );
      setOverrides({});
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar posts.");
    } finally {
      setSaving(false);
    }
  }

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
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expandir calendário" : "Recolher calendário"}
          className="ml-1 inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          {collapsed ? "Expandir" : "Recolher"}
        </button>
      </div>

      {!collapsed && (
        <>
          <ul className="divide-y divide-border">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const row = rowFor(key);
              const linked = baseline[key];
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
                    className={`w-full rounded-md border bg-background px-3 py-1.5 text-sm ${
                      linked ? "border-brand-purple/40" : "border-input"
                    }`}
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
              {changes === 0
                ? "Nenhuma alteração pendente"
                : `${pending.creates.length} novo(s) · ${pending.updates.length} alterado(s)`}
            </p>
            <button
              onClick={handleGenerate}
              disabled={saving || changes === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Salvar planejamento
            </button>
          </div>
        </>
      )}
    </div>
  );
}
