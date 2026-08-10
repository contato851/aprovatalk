import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
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
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { createPost, updatePlanningPost } from "@/lib/admin.functions";
import { RichTextArea } from "@/components/talk/rich-textarea";

type PostType = "static" | "carousel" | "video" | "";
type InternalStatus = "draft" | "producing" | "ready";

type Row = {
  title: string;
  type: PostType;
  time: string;
  briefing: string;
  script: string;
  caption: string;
  internal_status: InternalStatus;
};

const TYPES = [
  { v: "static", l: "Estático" },
  { v: "carousel", l: "Carrossel" },
  { v: "video", l: "Reels" },
] as const;

const INTERNAL = [
  { v: "draft", l: "Rascunho" },
  { v: "producing", l: "Em produção" },
  { v: "ready", l: "Pronto" },
] as const;

export function scriptPlaceholder(type: PostType) {
  if (type === "video") return "Roteiro de fala e cenas";
  if (type === "carousel") return "O que entra em cada slide";
  if (type === "static") return "Estrutura da arte / elementos da imagem";
  return "Roteiro / estrutura do conteúdo";
}

const emptyRow: Row = {
  title: "",
  type: "",
  time: "12:00",
  briefing: "",
  script: "",
  caption: "",
  internal_status: "draft",
};

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(cursor),
        end: endOfMonth(cursor),
      }),
    [cursor],
  );

  // Posts já criados, indexados por data (o primeiro de cada dia)
  const baseline = useMemo(() => {
    const map: Record<string, Row & { id: string; status: string }> = {};
    for (const p of existingPosts) {
      const d = parseISO(p.scheduled_at);
      const key = format(d, "yyyy-MM-dd");
      const existing = map[key];
      // prioriza o post ainda em planejamento no mesmo dia
      if (existing && !(existing.status !== "planning" && p.status === "planning"))
        continue;
      map[key] = {
        id: p.id,
        status: p.status,
        title: p.planning_title || p.caption || "",
        type: p.type,
        time: format(d, "HH:mm"),
        briefing: p.briefing ?? "",
        script: p.script ?? "",
        caption: p.caption ?? "",
        internal_status: (p.internal_status ?? "draft") as InternalStatus,
      };
    }
    return map;
  }, [existingPosts]);

  function rowFor(key: string): Row {
    const o = overrides[key];
    if (o) return o;
    const b = baseline[key];
    if (!b) return emptyRow;
    const { id: _id, status: _s, ...rest } = b;
    return rest;
  }


  function scheduledISO(key: string, time: string) {
    const [h, m] = (time || "12:00").split(":").map((n) => parseInt(n, 10));
    const d = parseISO(key);
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      isNaN(h) ? 12 : h,
      isNaN(m) ? 0 : m,
      0,
    ).toISOString();
  }

  function setRow(key: string, patch: Partial<Row>) {
    const next = { ...rowFor(key), ...patch };
    setOverrides((prev) => ({ ...prev, [key]: next }));
    const b = baseline[key];
    if (!b) return;
    // autosave (debounce) para posts que já existem
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      updatePlanningFn({
        data: {
          id: b.id,
          type: next.type === "" ? undefined : next.type,
          planning_title: next.title,
          caption: next.caption,
          briefing: next.briefing,
          script: next.script,
          internal_status: next.internal_status,
          scheduled_at: scheduledISO(key, next.time),
        },
      })
        .then(() => onCreated())
        .catch(() => toast.error("Não foi possível salvar."));
    }, 800);
  }

  async function saveRow(key: string) {
    const row = rowFor(key);
    if (!row.title.trim() || row.type === "") {
      toast.error("Preencha o título e o tipo de conteúdo.");
      return;
    }
    clearTimeout(timers.current[key]);
    setRowSaving((p) => ({ ...p, [key]: true }));
    try {
      const b = baseline[key];
      if (b) {
        await updatePlanningFn({
          data: {
            id: b.id,
            type: row.type as "static" | "carousel" | "video",
            planning_title: row.title.trim(),
            caption: row.caption,
            briefing: row.briefing,
            script: row.script,
            internal_status: row.internal_status,
            scheduled_at: scheduledISO(key, row.time),
          },
        });
      } else {
        await createPostFn({
          data: {
            client_id: clientId,
            type: row.type as "static" | "carousel" | "video",
            caption: row.caption,
            planning_title: row.title.trim(),
            briefing: row.briefing,
            script: row.script,
            internal_status: row.internal_status,
            scheduled_at: scheduledISO(key, row.time),
            media: [],
            status: "planning",
          },
        });
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
      toast.success("Salvo — já aparece no calendário do cliente.");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setRowSaving((p) => ({ ...p, [key]: false }));
    }
  }

  const pendingCreates = useMemo(() => {
    const creates: { key: string; row: Row }[] = [];
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      if (baseline[key]) continue;
      const r = rowFor(key);
      if (!r.title.trim() || r.type === "") continue;
      creates.push({ key, row: r });
    }
    return creates;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, overrides, baseline]);

  async function handleGenerate() {
    if (pendingCreates.length === 0) {
      toast.error("Nada novo para criar.");
      return;
    }
    setSaving(true);
    try {
      for (const { key, row } of pendingCreates) {
        await createPostFn({
          data: {
            client_id: clientId,
            type: row.type as "static" | "carousel" | "video",
            caption: row.caption,
            planning_title: row.title.trim(),
            briefing: row.briefing,
            script: row.script,
            internal_status: row.internal_status,
            scheduled_at: scheduledISO(key, row.time),
            media: [],
            status: "planning",
          },
        });
      }
      toast.success(`${pendingCreates.length} item(ns) criado(s).`);
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
              const weekend = [0, 6].includes(day.getDay());
              const open = !!expanded[key];
              return (
                <li key={key} className={weekend ? "bg-muted/40" : ""}>
                  <div className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-start">
                    <div className="flex w-full min-w-0 shrink-0 flex-col gap-1 sm:w-20">
                      <div className="flex items-center gap-1.5 leading-none">
                        <span className="font-display text-lg font-bold">
                          {format(day, "dd")}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {format(day, "EEE", { locale: ptBR })}
                        </span>
                      </div>
                      {linked && (
                        <span className="w-fit max-w-full truncate rounded-full bg-brand-purple-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-purple">
                          {linked.status === "planning"
                            ? "Plano"
                            : linked.status === "ready_for_review"
                              ? "Produção"
                              : linked.status === "approved"
                                ? "Aprovado"
                                : linked.status === "rejected"
                                  ? "Ajustes"
                                  : "Aprovação"}
                        </span>
                      )}
                    </div>
                    <input
                      value={row.title}
                      onChange={(e) => setRow(key, { title: e.target.value })}
                      placeholder="Título do conteúdo"
                      className={`w-full min-w-0 flex-1 rounded-md border bg-background px-3 py-1.5 text-sm ${
                        linked ? "border-brand-purple/40" : "border-input"
                      }`}
                    />

                    <input
                      type="time"
                      value={row.time}
                      onChange={(e) => setRow(key, { time: e.target.value })}
                      aria-label="Horário de publicação"
                      className="w-full shrink-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm sm:w-20"
                    />
                    <div className="flex shrink-0 flex-wrap gap-1">
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
                      <button
                        type="button"
                        onClick={() => saveRow(key)}
                        disabled={!!rowSaving[key]}
                        aria-label="Salvar"
                        className="inline-flex items-center rounded-full bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {rowSaving[key] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((p) => ({ ...p, [key]: !p[key] }))
                        }
                        aria-expanded={open}
                        aria-label="Detalhes do conteúdo"
                        className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
                        />
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="space-y-3 border-t border-border/60 bg-background/40 p-3">
                      {!linked && (
                        <p className="rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
                          Preencha título e tipo e clique em “Salvar” para publicar
                          este item no calendário do cliente.
                        </p>
                      )}
                      <Field
                        label="Briefing"
                        placeholder="Objetivo do post, contexto, gancho/ângulo da ideia"
                        value={row.briefing}
                        onChange={(v) => setRow(key, { briefing: v })}
                      />
                      <Field
                        label="Roteiro / Estrutura"
                        placeholder={scriptPlaceholder(row.type)}
                        value={row.script}
                        onChange={(v) => setRow(key, { script: v })}
                      />
                      <Field
                        label="Legenda"
                        placeholder="Rascunho ou versão final da legenda"
                        value={row.caption}
                        onChange={(v) => setRow(key, { caption: v })}
                      />
                      <div>
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Status interno
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {INTERNAL.map((s) => (
                            <button
                              key={s.v}
                              type="button"
                              onClick={() =>
                                setRow(key, { internal_status: s.v })
                              }
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                                row.internal_status === s.v
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {s.l}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3">
            <p className="text-xs text-muted-foreground">
              {pendingCreates.length === 0
                ? "Alterações salvas automaticamente"
                : `${pendingCreates.length} novo(s) para criar`}
            </p>
            <button
              onClick={handleGenerate}
              disabled={saving || pendingCreates.length === 0}
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

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <RichTextArea
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
      />
    </label>
  );
}
