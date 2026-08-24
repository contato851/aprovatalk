import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** E-mail do usuário logado (minúsculo). "" enquanto carrega ou se não autenticado. */
export function useUserEmail(): string {
  const [email, setEmail] = useState("");
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail((data.user?.email ?? "").toLowerCase());
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return email;
}

const startsWithAny = (email: string, prefixes: string[]) =>
  prefixes.some((p) => email.startsWith(p));

/** Bia, Diandra e Johnny (conta admin principal inclusa). */
export function isPlanningEditor(email: string) {
  return startsWithAny(email, ["bia@", "diandra@", "johnny@", "talkautenticidade@"]);
}

/** Erik só visualiza roteiros já vinculados. */
export function canViewScripts(email: string) {
  return isPlanningEditor(email) || startsWithAny(email, ["erik@"]);
}

/** Robson não edita textos (briefing/copy) nem campos de conteúdo. */
export function canEditContentText(email: string) {
  return !startsWithAny(email, ["robson@"]);
}
