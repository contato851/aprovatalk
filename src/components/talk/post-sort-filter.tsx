import { useMemo, useState } from "react";

export type SortOrder = "desc" | "asc";
export type TypeFilter = "" | "static" | "carousel" | "video";

/** Ordena por data agendada e filtra por tipo de post. */
export function usePostSortFilter<T extends { type: string; scheduled_at: string }>(
  posts: T[],
) {
  const [order, setOrder] = useState<SortOrder>("asc");
  const [type, setType] = useState<TypeFilter>("");

  const result = useMemo(() => {
    const list = type ? posts.filter((p) => p.type === type) : [...posts];
    list.sort((a, b) => {
      const da = new Date(a.scheduled_at).getTime();
      const db = new Date(b.scheduled_at).getTime();
      return order === "desc" ? db - da : da - db;
    });
    return list;
  }, [posts, order, type]);

  return { order, setOrder, type, setType, result };
}

export function PostSortFilterBar({
  order,
  setOrder,
  type,
  setType,
  className = "",
}: {
  order: SortOrder;
  setOrder: (v: SortOrder) => void;
  type: TypeFilter;
  setType: (v: TypeFilter) => void;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 sm:flex-row sm:items-center ${className}`}
    >
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="uppercase tracking-wide">Ordem</span>
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value as SortOrder)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground sm:w-auto"
        >
          <option value="desc">Mais recente → mais antigo</option>
          <option value="asc">Mais antigo → mais recente</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="uppercase tracking-wide">Tipo</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TypeFilter)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground sm:w-auto"
        >
          <option value="">Todos os tipos</option>
          <option value="static">Estático</option>
          <option value="carousel">Carrossel</option>
          <option value="video">Reels</option>
        </select>
      </label>
    </div>
  );
}
