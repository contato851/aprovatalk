import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Plus, Power } from "lucide-react";
import { listClients, updateClient } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/clients/")({
  component: ClientsPage,
});

function ClientsPage() {
  const listFn = useServerFn(listClients);
  const q = useQuery({
    queryKey: ["clients"],
    queryFn: () => listFn({ data: undefined as any }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie sua carteira e envie posts para aprovação.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewPostDialog clients={q.data ?? []} />
          <NewClientDialog />
        </div>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (q.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum cliente ainda. Crie o primeiro.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(q.data ?? []).map((c: any) => (
            <ClientCard key={c.id} client={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCard({ client }: { client: any }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateClient);
  const toggle = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id: client.id,
          status: client.status === "active" ? "inactive" : "active",
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });

  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/c/${client.access_token}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Link
        to="/clients/$clientId"
        params={{ clientId: client.id }}
        className="flex items-center gap-3 group"
      >
        {client.avatar_signed_url ? (
          <img
            src={client.avatar_signed_url}
            alt=""
            className="h-12 w-12 rounded-full object-cover transition group-hover:ring-2 group-hover:ring-brand-orange/40"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-muted transition group-hover:ring-2 group-hover:ring-brand-orange/40" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display font-semibold group-hover:underline">
            {client.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            @{client.instagram_handle}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            client.status === "active"
              ? "bg-brand-chartreuse-soft text-emerald-700"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {client.status === "active" ? "Ativo" : "Inativo"}
        </span>
      </Link>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => {
            navigator.clipboard.writeText(link);
            toast.success("Link copiado!");
          }}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <Copy className="h-3 w-3" /> Copiar link
        </button>
        <button
          onClick={() => toggle.mutate()}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <Power className="h-3 w-3" />
          {client.status === "active" ? "Desativar" : "Ativar"}
        </button>
      </div>
    </div>
  );
}

function NewClientDialog() {
  const qc = useQueryClient();
  const createFn = useServerFn(createClientFn);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name || !handle) return toast.error("Preencha nome e @.");
    setSaving(true);
    try {
      let avatar_path: string | null = null;
      if (avatar) avatar_path = await uploadToBucket("avatars", avatar);
      await createFn({
        data: { name, instagram_handle: handle, avatar_path },
      });
      toast.success("Cliente criado!");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setName("");
      setHandle("");
      setAvatar(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>@ do Instagram</Label>
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="talk.consultoria"
            />
          </div>
          <div className="space-y-2">
            <Label>Avatar (opcional)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Criar cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewPostDialog({ clients }: { clients: any[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");

  const active = clients.filter((c) => c.status === "active");

  function go() {
    if (!clientId) return toast.error("Selecione um cliente.");
    setOpen(false);
    navigate({
      to: "/clients/$clientId",
      params: { clientId },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo post
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione um cliente…</option>
              {active.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (@{c.instagram_handle})
                </option>
              ))}
            </select>
            {active.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum cliente ativo. Cadastre um cliente primeiro.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={go} disabled={!clientId}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

