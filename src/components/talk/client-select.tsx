import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type ClientOption = { id: string; name: string };

let cache: ClientOption[] | null = null;
const listeners = new Set<(c: ClientOption[]) => void>();

async function loadClients() {
  const { data, error } = await supabase
    .from("clients")
    .select("id,name")
    .order("name", { ascending: true });
  if (error) {
    console.error("Falha ao carregar clientes", error);
    return;
  }
  cache = (data ?? []) as ClientOption[];
  listeners.forEach((l) => l(cache!));
}

export function useClientOptions() {
  const [clients, setClients] = useState<ClientOption[]>(cache ?? []);
  useEffect(() => {
    listeners.add(setClients);
    if (cache) setClients(cache);
    else void loadClients();
    return () => {
      listeners.delete(setClients);
    };
  }, []);
  return clients;
}

/** Lista suspensa de clientes que trabalha com o nome do cliente (texto). */
export function ClientSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder = "Cliente",
}: {
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const clients = useClientOptions();
  const known = clients.some((c) => c.name === value);

  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 px-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:bg-muted/40",
        className,
      )}
    >
      <option value="">{placeholder}</option>
      {!known && value && <option value={value}>{value}</option>}
      {clients.map((c) => (
        <option key={c.id} value={c.name}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
