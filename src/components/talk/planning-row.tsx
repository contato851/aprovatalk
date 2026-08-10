import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { ChevronDown, Loader2, Save } from "lucide-react";
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

function scriptPlaceholder(type: PostType) {
  if (type === "video") return "Roteiro de fala e cenas";
  if (type === "carousel") return "O que entra em cada slide";
  if (type === "static") return "Estrutura da arte / elementos da imagem";
  return "Roteiro / estrutura do conteúdo";
}

export function statusLabel(status: string) {
  return status === "planning"
    ? "Plano"
    : status === "ready_for_review"
      ? "Produção"
      : status === "approved"
        ? "Aprovado"
        : status === "rejected"
          ? "Ajustes"
          : "Aprovação";
}

/**
 * Card de planejamento (mesmos campos da aba Planejamento),
 * para um cliente + uma data específicos.
 */
export function PlanningRow({
  clientId,
  dateKey,
  post,
  header,
  onSaved,
  defaultOpen = false,
}: {
  clientId: string;
  dateKey: string;
  post?: any | null;
  header: React.ReactNode;
  onSaved: () => void;
  defaultOpen?: boolean;
}) {
  const createPostFn = useServerFn(createPost);
  const updatePlanningFn = useServerFn(updatePlanningPost);
  const [open, setOpen] = useState(defaultOpen);
  const [saving, setSaving] = useState(false);
  const [override, setOverride] = useState<Row | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const baseline: Row = useMemo(() => {
    if (!post)
      return {
        title: "",
        type: "",
        time: "12:00",
        briefing: "",
        script: "",
        caption: "",
        internal_status: "draft",
      };
    const d = parseISO(post.scheduled_at);
    return {
      title: post.planning_title || post.caption || "",
      type: post.type,
      time: format(d, "HH:mm"),
      briefing: post.briefing ?? "",
      script: post.script ?? "",
      caption: post.caption ?? "",
      internal_status: (post.internal_status ?? "draft") as InternalStatus,
    };
  }, [post]);

  const row = override ?? baseline;

  function scheduledISO(time: string) {
    const [h, m] = (time || "12:00").split(":").map((n) => parseInt(n, 10));
    const d = parseISO(dateKey);
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      isNaN(h) ? 12 : h,
      isNaN(m) ? 0 : m,
      0,
    ).toISOString();
  }

  function setRow(patch: Partial<Row>) {
    const next = { ...row, ...patch };
    setOverride(next);
    if (!post) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      updatePlanningFn({
        data: {
          id: post.id,
          type: next.type === "" ? undefined : next.type,
          planning_title: next.title,
          caption: next.caption,
          briefing: next.briefing,
          script: next.script,
          internal_status: next.internal_status,
          scheduled_at: scheduledISO(next.time),
        },
      })
        .then(() => onSaved())
        .catch(() => toast.error("Não foi possível salvar."));
    }, 800);
  }

  async function save() {
    if (!row.title.trim() || row.type === "") {
      toast.error("Preencha o título e o tipo de conteúdo.");
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    try {
      if (post) {
        await updatePlanningFn({
          data: {
            id: post.id,
            type: row.type as "static" | "carousel" | "video",
            planning_title: row.title.trim(),
            caption: row.caption,
            briefing: row.briefing,
            script: row.script,
            internal_status: row.internal_status,
            scheduled_at: scheduledISO(row.time),
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
            scheduled_at: scheduledISO(row.time),
            media: [],
            status: "planning",
          },
        });
        setOverride(null);
      }
      toast.success("Salvo — já aparece no calendário do cliente.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-start">
        <div className="flex w-full min-w-0 shrink-0 flex-col gap-1 sm:w-40">
          {header}
        </div>
        <input
          value={row.title}
          onChange={(e) => setRow({ title: e.target.value })}
          placeholder="Título do conteúdo"
          className={`w-full min-w-0 flex-1 rounded-md border bg-background px-3 py-1.5 text-sm ${
            post ? "border-brand-purple/40" : "border-input"
          }`}
        />
        <input
          type="time"
          value={row.time}
          onChange={(e) => setRow({ time: e.target.value })}
          aria-label="Horário de publicação"
          className="w-full shrink-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm sm:w-20"
        />
        <div className="flex shrink-0 flex-wrap gap-1">
          {TYPES.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => setRow({ type: row.type === t.v ? "" : t.v })}
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
            onClick={save}
            disabled={saving}
            aria-label="Salvar"
            className="inline-flex items-center rounded-full bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
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
          {!post && (
            <p className="rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
              Preencha título e tipo e clique em “Salvar” para publicar este item
              no calendário do cliente.
            </p>
          )}
          <Field
            label="Briefing"
            placeholder="Objetivo do post, contexto, gancho/ângulo da ideia"
            value={row.briefing}
            onChange={(v) => setRow({ briefing: v })}
          />
          <Field
            label="Roteiro / Estrutura"
            placeholder={scriptPlaceholder(row.type)}
            value={row.script}
            onChange={(v) => setRow({ script: v })}
          />
          <Field
            label="Legenda"
            placeholder="Rascunho ou versão final da legenda"
            value={row.caption}
            onChange={(v) => setRow({ caption: v })}
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
                  onClick={() => setRow({ internal_status: s.v })}
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
