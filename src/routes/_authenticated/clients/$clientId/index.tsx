import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClient, listPosts, updateClient } from "@/lib/admin.functions";
import { uploadToBucket } from "@/lib/upload";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Camera, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRef, useState } from "react";



export const Route = createFileRoute("/_authenticated/clients/$clientId/")({
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const getClientFn = useServerFn(getClient);
  const listPostsFn = useServerFn(listPosts);

  const clientQ = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientFn({ data: { id: clientId } }),
  });
  const postsQ = useQuery({
    queryKey: ["posts", { clientId }],
    queryFn: () => listPostsFn({ data: { clientId } }),
  });

  if (!clientQ.data) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const c = clientQ.data as any;


  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <AvatarUpload client={c} />
        <div>
          <h1 className="font-display text-3xl font-bold">{c.name}</h1>
          <p className="text-sm text-muted-foreground">@{c.instagram_handle}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => {
              const link = `${typeof window !== "undefined" ? window.location.origin : ""}/c/${c.access_token}`;
              navigator.clipboard.writeText(link);
              toast.success("Link copiado!");
            }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Copy className="h-4 w-4" /> Copiar link do cliente
          </button>
          <Link
            to="/clients/$clientId/new"
            params={{ clientId }}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Novo post
          </Link>
        </div>

      </div>


      <div>
        <h2 className="font-display text-lg font-semibold">Posts</h2>
        {postsQ.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : (postsQ.data ?? []).length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhum post ainda. Crie o primeiro.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(postsQ.data as any[]).map((p) => {
              const thumb =
                p.cover_signed_url ??
                (p.media?.[0]?.kind === "image" ? p.media[0].signed_url : null);
              return (
                <Link
                  key={p.id}
                  to="/posts/$postId/edit"
                  params={{ postId: p.id }}
                  className="group overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-lg"
                >
                  <div className="relative aspect-[3/4] bg-muted">
                    {p.midia_arquivada ? (
                      <div className="flex h-full w-full items-center justify-center bg-muted/60">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Mídia arquivada
                        </p>
                      </div>
                    ) : (
                      thumb && (
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      )
                    )}
                    <span
                      className={`absolute left-2 top-2 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                        p.type === "static"
                          ? "bg-brand-orange text-white"
                          : p.type === "carousel"
                            ? "bg-brand-purple text-white"
                            : "bg-brand-chartreuse text-emerald-950"
                      }`}
                    >
                      {p.type === "static" ? "Estático" : p.type === "carousel" ? "Carrossel" : "Reel"}
                    </span>
                    <span
                      className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        p.status === "approved"
                          ? "border-brand-chartreuse/30 bg-brand-chartreuse-soft text-emerald-700"
                          : p.status === "rejected"
                            ? "border-brand-purple/30 bg-brand-purple-soft text-brand-purple"
                            : "border-brand-orange/30 bg-brand-orange-soft text-brand-orange"
                      }`}
                    >
                      {p.status === "approved"
                        ? "Aprovado"
                        : p.status === "rejected"
                          ? "Reprovado"
                          : "Pendente"}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {format(parseISO(p.scheduled_at), "dd/MM 'às' HH'h'", { locale: ptBR })}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm">{p.caption || "—"}</p>
                    {p.status === "rejected" && p.client_comment && (
                      <p className="mt-2 rounded-md bg-brand-purple-soft p-2 text-xs text-brand-purple">
                        💬 {p.client_comment}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AvatarUpload({ client }: { client: any }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateClient);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const avatar_path = await uploadToBucket("avatars", file);
      await updateFn({
        data: {
          id: client.id,
          avatar_path,
        },
      });
      toast.success("Foto atualizada!");
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setUploading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className="group relative h-16 w-16 rounded-full disabled:opacity-60"
      title="Trocar foto"
    >
      {client.avatar_signed_url ? (
        <img
          src={client.avatar_signed_url}
          alt=""
          className="h-16 w-16 rounded-full object-cover group-hover:opacity-70"
        />
      ) : (
        <div className="h-16 w-16 rounded-full bg-muted group-hover:bg-muted/70" />
      )}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 text-[10px] font-medium text-background opacity-0 transition group-hover:opacity-100">
        Trocar
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm">
        <Camera className="h-3 w-3" />
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </button>
  );
}
