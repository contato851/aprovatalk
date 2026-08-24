import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useClientOptions } from "@/components/talk/client-select";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/roteiros")({
  head: () => ({
    meta: [
      { title: "Roteiros — Talk" },
      {
        name: "description",
        content:
          "Construção e visualização de roteiros profissionais por cliente: cena, trilha, lettering e observações.",
      },
      { property: "og:title", content: "Roteiros — Talk" },
      {
        property: "og:description",
        content: "Roteiros profissionais por cliente na plataforma da Talk.",
      },
    ],
  }),
  component: RoteirosPage,
});

type Script = {
  id: string;
  client_id: string;
  title: string;
  script_date: string | null;
  notes: string;
  post_id?: string | null;
};

type PlanningPost = {
  id: string;
  planning_title: string | null;
  caption: string | null;
  type: string;
  scheduled_at: string;
  script: string | null;
};

type Scene = {
  id?: string;
  script_id?: string;
  position: number;
  scene: string;
  soundtrack: string;
  lettering: string;
  notes: string;
};

function emptyScene(position: number): Scene {
  return { position, scene: "", soundtrack: "", lettering: "", notes: "" };
}

function composeScript(scenes: Scene[], notes: string) {
  const body = scenes
    .filter((s) => s.scene || s.soundtrack || s.lettering || s.notes)
    .map((s, i) => {
      const lines = [`**Cena ${i + 1}**`];
      if (s.scene) lines.push(s.scene);
      if (s.soundtrack) lines.push(`Trilha: ${s.soundtrack}`);
      if (s.lettering) lines.push(`Lettering: ${s.lettering}`);
      if (s.notes) lines.push(`Obs: ${s.notes}`);
      return lines.join("\n");
    })
    .join("\n\n");
  return notes.trim() ? `${body}\n\n**Observações**\n${notes.trim()}` : body;
}

function RoteirosPage() {
  const clients = useClientOptions();
  const [clientId, setClientId] = useState("");
  const [scripts, setScripts] = useState<Script[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [current, setCurrent] = useState<Script | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [saving, setSaving] = useState(false);
  const [planningPosts, setPlanningPosts] = useState<PlanningPost[]>([]);
  const [pullId, setPullId] = useState("");

  useEffect(() => {
    if (!clientId && clients.length) setClientId(clients[0].id);
  }, [clients, clientId]);

  const loadScripts = useCallback(async (cid: string) => {
    const { data, error } = await supabase
      .from("scripts" as any)
      .select("*")
      .eq("client_id", cid)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    const rows = (data ?? []) as unknown as Script[];
    setScripts(rows);
    setCurrentId(rows[0]?.id ?? null);
  }, []);

  const loadPlanning = useCallback(async (cid: string) => {
    const { data, error } = await supabase
      .from("posts")
      .select("id, planning_title, caption, type, scheduled_at, script")
      .eq("client_id", cid)
      .in("status", ["planning", "ready_for_review", "pending"])
      .order("scheduled_at", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    setPlanningPosts((data ?? []) as unknown as PlanningPost[]);
  }, []);

  useEffect(() => {
    if (clientId) {
      void loadScripts(clientId);
      void loadPlanning(clientId);
    } else {
      setScripts([]);
      setPlanningPosts([]);
      setCurrentId(null);
    }
  }, [clientId, loadScripts, loadPlanning]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentId) {
        setCurrent(null);
        setScenes([]);
        return;
      }
      const script = scripts.find((s) => s.id === currentId) ?? null;
      setCurrent(script);
      const { data, error } = await supabase
        .from("script_scenes" as any)
        .select("*")
        .eq("script_id", currentId)
        .order("position", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error(error);
        return;
      }
      const rows = (data ?? []) as unknown as Scene[];
      setScenes(rows.length ? rows : [emptyScene(0), emptyScene(1), emptyScene(2)]);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentId, scripts]);

  async function handleNewScript() {
    if (!clientId) return;
    const { data, error } = await supabase
      .from("scripts" as any)
      .insert({ client_id: clientId, title: "Novo roteiro" })
      .select("*")
      .single();
    if (error) {
      toast.error("Não foi possível criar o roteiro.");
      return;
    }
    const row = data as unknown as Script;
    setScripts((p) => [row, ...p]);
    setCurrentId(row.id);
  }

  async function handlePullFromPlanning(postId: string) {
    const post = planningPosts.find((p) => p.id === postId);
    if (!post || !clientId) return;
    const existing = scripts.find((s) => s.post_id === postId);
    if (existing) {
      setCurrentId(existing.id);
      setPullId("");
      toast.info("Este conteúdo já tem um roteiro — abri para você.");
      return;
    }
    const { data, error } = await supabase
      .from("scripts" as any)
      .insert({
        client_id: clientId,
        post_id: postId,
        title: post.planning_title || post.caption || "Roteiro",
        script_date: post.scheduled_at ? post.scheduled_at.slice(0, 10) : null,
      })
      .select("*")
      .single();
    if (error) {
      console.error(error);
      toast.error("Não foi possível puxar o conteúdo.");
      return;
    }
    const row = data as unknown as Script;
    if (post.script?.trim()) {
      await supabase.from("script_scenes" as any).insert({
        script_id: row.id,
        position: 0,
        scene: post.script,
      });
    }
    setScripts((p) => [row, ...p]);
    setCurrentId(row.id);
    setPullId("");
    toast.success("Conteúdo do planejamento carregado.");
  }

  async function handleDeleteScript() {
    if (!current) return;
    if (!confirm("Excluir este roteiro?")) return;
    await supabase.from("scripts" as any).delete().eq("id", current.id);
    setScripts((p) => p.filter((s) => s.id !== current.id));
    setCurrentId(null);
    toast.success("Roteiro excluído.");
  }

  function updateScene(index: number, patch: Partial<Scene>) {
    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function removeScene(index: number) {
    const scene = scenes[index];
    if (scene.id) await supabase.from("script_scenes" as any).delete().eq("id", scene.id);
    setScenes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!current) return;
    setSaving(true);
    try {
      const { error: sErr } = await supabase
        .from("scripts" as any)
        .update({
          title: current.title,
          script_date: current.script_date || null,
          notes: current.notes ?? "",
        })
        .eq("id", current.id);
      if (sErr) throw sErr;

      const payload = scenes.map((s, i) => ({
        ...(s.id ? { id: s.id } : {}),
        script_id: current.id,
        position: i,
        scene: s.scene,
        soundtrack: s.soundtrack,
        lettering: s.lettering,
        notes: s.notes,
      }));
      const { data, error } = await supabase
        .from("script_scenes" as any)
        .upsert(payload)
        .select("*");
      if (error) throw error;
      setScenes(((data ?? []) as unknown as Scene[]).sort((a, b) => a.position - b.position));
      setScripts((p) => p.map((s) => (s.id === current.id ? current : s)));

      if (current.post_id) {
        const { error: pErr } = await supabase
          .from("posts")
          .update({
            script: composeScript(scenes, current.notes ?? ""),
            planning_title: current.title,
          })
          .eq("id", current.post_id);
        if (pErr) console.error(pErr);
        else void loadPlanning(current.client_id);
      }
      toast.success(
        current.post_id
          ? "Roteiro salvo e atualizado no planejamento."
          : "Roteiro salvo.",
      );
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar o roteiro.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Roteiros</h1>
        <p className="text-sm text-muted-foreground">
          Cena, trilha, lettering e observações — organizados por cliente.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          aria-label="Cliente"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className={inputCls + " sm:max-w-xs"}
        >
          <option value="">Selecione um cliente…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Roteiro"
          value={currentId ?? ""}
          onChange={(e) => setCurrentId(e.target.value || null)}
          className={inputCls + " sm:max-w-sm"}
        >
          <option value="">
            {scripts.length ? "Selecione um roteiro…" : "Nenhum roteiro"}
          </option>
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title || "Sem título"}
            </option>
          ))}
        </select>
        <button
          onClick={handleNewScript}
          disabled={!clientId}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Novo roteiro
        </button>
      </div>

      <select
        aria-label="Puxar conteúdo do planejamento"
        value={pullId}
        onChange={(e) => {
          setPullId(e.target.value);
          if (e.target.value) void handlePullFromPlanning(e.target.value);
        }}
        disabled={!clientId}
        className={inputCls + " sm:max-w-md"}
      >
        <option value="">Puxar conteúdo do planejamento…</option>
        {planningPosts.map((p) => (
          <option key={p.id} value={p.id}>
            {p.scheduled_at.slice(8, 10)}/{p.scheduled_at.slice(5, 7)} —{" "}
            {p.planning_title || p.caption || "Sem título"}
            {scripts.some((s) => s.post_id === p.id) ? " (com roteiro)" : ""}
          </option>
        ))}
      </select>


      {!current ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Selecione ou crie um roteiro para começar.
        </p>
      ) : (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={current.title}
              onChange={(e) => setCurrent({ ...current, title: e.target.value })}
              placeholder="Título do material"
              className={inputCls}
            />
            <input
              type="date"
              value={current.script_date ?? ""}
              onChange={(e) => setCurrent({ ...current, script_date: e.target.value })}
              aria-label="Data"
              className={inputCls}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 pb-2">#</th>
                  <th className="pb-2 pr-2">Cena</th>
                  <th className="pb-2 pr-2">Trilha</th>
                  <th className="pb-2 pr-2">Lettering</th>
                  <th className="pb-2 pr-2">Observações</th>
                  <th className="w-10 pb-2" />
                </tr>
              </thead>
              <tbody>
                {scenes.map((s, i) => (
                  <tr key={s.id ?? `new-${i}`} className="align-top">
                    <td className="py-1 pr-2 text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </td>
                    {(
                      [
                        ["scene", "Descrição da cena"],
                        ["soundtrack", "Trilha / áudio"],
                        ["lettering", "Texto na tela"],
                        ["notes", "Observações"],
                      ] as const
                    ).map(([field, ph]) => (
                      <td key={field} className="py-1 pr-2">
                        <textarea
                          rows={3}
                          value={(s as any)[field] ?? ""}
                          onChange={(e) => updateScene(i, { [field]: e.target.value } as any)}
                          placeholder={ph}
                          className={inputCls + " resize-y"}
                        />
                      </td>
                    ))}
                    <td className="py-1">
                      <button
                        onClick={() => removeScene(i)}
                        aria-label="Remover cena"
                        className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <textarea
            rows={3}
            value={current.notes ?? ""}
            onChange={(e) => setCurrent({ ...current, notes: e.target.value })}
            placeholder="Observações gerais do roteiro"
            className={inputCls}
          />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setScenes((p) => [...p, emptyScene(p.length)])}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Plus className="h-4 w-4" /> Adicionar cena
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar roteiro"}
            </button>
            <button
              onClick={handleDeleteScript}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-destructive hover:bg-accent"
            >
              <Trash2 className="h-4 w-4" /> Excluir roteiro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
