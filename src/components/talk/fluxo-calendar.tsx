import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  addBusinessDays,
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getDeliverySlotsByToken } from "@/lib/client-portal.functions";
import { cn } from "@/lib/utils";

type Slot = {
  id?: string;
  slot_date: string;
  slot_index: number;
  client: string;
  title: string;
  folder_link: string;
  done: boolean;
};

const SLOTS_PER_DAY = 5;
const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");

function emptySlot(date: string, index: number): Slot {
  return { slot_date: date, slot_index: index, client: "", title: "", folder_link: "", done: false };
}

export function FluxoCalendar({ readOnly = false }: { readOnly?: boolean }) {
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [slotsByDate, setSlotsByDate] = useState<Record<string, Slot[]>>({});
  const [loading, setLoading] = useState(false);
  const dayRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const key = fmtDate(selectedDay);
    const btn = dayRefs.current[key];
    if (btn) btn.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [selectedDay]);

  const monthStart = useMemo(() => startOfMonth(cursor), [cursor]);
  const monthEnd = useMemo(() => endOfMonth(cursor), [cursor]);

  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let d = new Date(monthStart); d <= monthEnd; d = addDays(d, 1)) arr.push(new Date(d));
    return arr;
  }, [monthStart, monthEnd]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("delivery_slots" as any)
        .select("*")
        .gte("slot_date", fmtDate(monthStart))
        .lte("slot_date", fmtDate(monthEnd));
      if (cancelled) return;
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      const grouped: Record<string, Slot[]> = {};
      for (const d of days) {
        const key = fmtDate(d);
        grouped[key] = Array.from({ length: SLOTS_PER_DAY }, (_, i) => emptySlot(key, i));
      }
      for (const row of (data as any[]) ?? []) {
        const key = row.slot_date as string;
        if (!grouped[key]) continue;
        grouped[key][row.slot_index] = row as Slot;
      }
      setSlotsByDate(grouped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart.getTime(), monthEnd.getTime()]);

  useEffect(() => {
    if (selectedDay < monthStart || selectedDay > monthEnd) setSelectedDay(monthStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart.getTime(), monthEnd.getTime()]);

  const selectedKey = fmtDate(selectedDay);
  const selectedSlots =
    slotsByDate[selectedKey] ??
    Array.from({ length: SLOTS_PER_DAY }, (_, i) => emptySlot(selectedKey, i));

  const { done, pending, total } = useMemo(() => {
    let d = 0, p = 0, t = 0;
    for (const key of Object.keys(slotsByDate)) {
      for (const s of slotsByDate[key]) {
        const filled = s.client.trim() || s.title.trim() || s.folder_link.trim();
        if (filled || s.done) {
          t++;
          if (s.done) d++; else p++;
        }
      }
    }
    return { done: d, pending: p, total: t };
  }, [slotsByDate]);

  const dayHasData = useCallback(
    (date: Date) => {
      const key = fmtDate(date);
      const slots = slotsByDate[key];
      if (!slots) return false;
      return slots.some((s) => s.client.trim() || s.title.trim() || s.folder_link.trim() || s.done);
    },
    [slotsByDate],
  );

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const upsertSlot = useCallback(async (slot: Slot) => {
    const { data, error } = await supabase
      .from("delivery_slots" as any)
      .upsert(
        {
          id: slot.id,
          slot_date: slot.slot_date,
          slot_index: slot.slot_index,
          client: slot.client,
          title: slot.title,
          folder_link: slot.folder_link,
          done: slot.done,
        },
        { onConflict: "slot_date,slot_index" },
      )
      .select()
      .single();
    if (error) {
      console.error("Save failed", error);
      return;
    }
    setSlotsByDate((prev) => {
      const next = { ...prev };
      const arr = next[slot.slot_date] ? [...next[slot.slot_date]] : [];
      const current = arr[slot.slot_index];
      arr[slot.slot_index] = current?.id ? current : { ...(current ?? slot), id: (data as any).id };
      next[slot.slot_date] = arr;
      return next;
    });
  }, []);

  const updateSlot = (index: number, patch: Partial<Slot>, immediate = false) => {
    if (readOnly) return;
    setSlotsByDate((prev) => {
      const next = { ...prev };
      const arr = next[selectedKey]
        ? [...next[selectedKey]]
        : Array.from({ length: SLOTS_PER_DAY }, (_, i) => emptySlot(selectedKey, i));
      const merged = { ...arr[index], ...patch };
      arr[index] = merged;
      next[selectedKey] = arr;
      return next;
    });

    const timerKey = `${selectedKey}-${index}`;
    if (saveTimers.current[timerKey]) clearTimeout(saveTimers.current[timerKey]);
    const run = () => {
      setSlotsByDate((prev) => {
        const current = prev[selectedKey]?.[index];
        if (current) void upsertSlot(current);
        return prev;
      });
    };
    if (immediate) run();
    else saveTimers.current[timerKey] = setTimeout(run, 500);
  };

  const monthLabel = format(cursor, "MMMM yyyy", { locale: ptBR });

  return (
    <div className="flex flex-col rounded-3xl border border-border bg-card overflow-hidden">
      <header className="bg-foreground text-background">
        <div className="px-5 py-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs tracking-wider opacity-70">Edição</p>
              <h1 className="text-xl font-semibold mt-0.5">Calendário de entregas</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCursor((c) => addMonths(c, -1))}
                className="h-9 w-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 transition"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="px-4 py-1.5 rounded-full bg-white/10 capitalize text-sm font-medium min-w-[160px] text-center">
                {monthLabel}
              </div>
              <button
                onClick={() => setCursor((c) => addMonths(c, 1))}
                className="h-9 w-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 transition"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 -mx-1 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {days.map((d) => {
              const active = isSameDay(d, selectedDay);
              const has = dayHasData(d);
              return (
                <button
                  key={d.toISOString()}
                  ref={(el) => { dayRefs.current[fmtDate(d)] = el; }}
                  onClick={() => setSelectedDay(d)}
                  className={cn(
                    "relative shrink-0 h-10 w-10 rounded-xl text-sm font-medium transition",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-white/10 text-background hover:bg-white/20",
                  )}
                >
                  {format(d, "d")}
                  {has && (
                    <span
                      className={cn(
                        "absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full",
                        active ? "bg-foreground" : "bg-background",
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="p-5">
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold capitalize">
            {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h2>
          <span className="text-xs text-muted-foreground mt-1 block">
            Prazo automático: D+2 úteis ({format(addBusinessDays(selectedDay, 2), "dd/MM")})
          </span>
        </div>

        <div className="space-y-3">
          {selectedSlots.map((slot, i) => {
            const deadline = format(addBusinessDays(new Date(selectedDay), 2), "dd/MM");
            return (
              <div
                key={i}
                className={cn(
                  "rounded-2xl border bg-background p-4 transition-colors",
                  slot.done && "bg-emerald-50 border-emerald-300",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-1 gap-1">
                    <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                    <button
                      onClick={() => updateSlot(i, { done: !slot.done }, true)}
                      disabled={readOnly}
                      aria-label={slot.done ? "Marcar como pendente" : "Marcar como concluída"}
                      className={cn(
                        "h-8 w-8 rounded-full grid place-items-center border-2 transition",
                        slot.done
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-input bg-background hover:border-foreground",
                        readOnly && "cursor-not-allowed opacity-70",
                      )}
                    >
                      {slot.done && <Check className="h-4 w-4" strokeWidth={3} />}
                    </button>
                  </div>

                  <div className="flex-1 grid gap-2 sm:grid-cols-2">
                    <input
                      value={slot.client}
                      readOnly={readOnly}
                      onChange={(e) => updateSlot(i, { client: e.target.value })}
                      placeholder="Cliente"
                      className="h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 read-only:bg-muted/40"
                    />
                    <input
                      value={slot.title}
                      readOnly={readOnly}
                      onChange={(e) => updateSlot(i, { title: e.target.value })}
                      placeholder="Título / descrição"
                      className="h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 read-only:bg-muted/40"
                    />
                    <div className="sm:col-span-2 flex gap-2">
                      <input
                        value={slot.folder_link}
                        readOnly={readOnly}
                        onChange={(e) => updateSlot(i, { folder_link: e.target.value })}
                        placeholder="Link da pasta"
                        className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 read-only:bg-muted/40"
                      />
                      <a
                        href={slot.folder_link || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => { if (!slot.folder_link) e.preventDefault(); }}
                        className={cn(
                          "h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium transition",
                          slot.folder_link
                            ? "bg-foreground text-background border-foreground hover:opacity-90"
                            : "bg-muted text-muted-foreground border-transparent cursor-not-allowed",
                        )}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Abrir
                      </a>
                    </div>
                  </div>

                  <div className="hidden sm:flex flex-col items-end pt-1 min-w-[70px]">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Prazo</span>
                    <span className="text-sm font-semibold">{deadline}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {loading && <p className="mt-4 text-xs text-muted-foreground">Carregando…</p>}
      </main>

      <footer className="border-t border-border bg-muted/30">
        <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5 text-sm">
            <Counter label="Concluídas" value={done} dotClass="bg-emerald-500" />
            <Counter label="Pendentes" value={pending} dotClass="bg-foreground" />
            <Counter label="Total no mês" value={total} dotClass="bg-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground capitalize">{monthLabel}</p>
        </div>
      </footer>
    </div>
  );
}

function Counter({ label, value, dotClass }: { label: string; value: number; dotClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", dotClass)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
