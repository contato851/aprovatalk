import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  approvePostByToken,
  getClientPortal,
  rejectPostByToken,
} from "@/lib/client-portal.functions";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TalkStar } from "@/components/talk/star";

export const Route = createFileRoute("/c/$token")({
  component: ClientFeed,
});

type Tab = "pending" | "approved" | "rejected";

function ClientFeed() {
  const { token } = Route.useParams();
  const getPortalFn = useServerFn(getClientPortal);
  const [tab, setTab] = useState<Tab>("pending");

  const q = useQuery({
    queryKey: ["client-portal", token],
    queryFn: () => getPortalFn({ data: { token } }),
    retry: false,
  });

  if (q.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </main>
    );
  }
  if (q.error || !q.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <TalkStar className="mx-auto h-10 w-10 text-brand-orange" />
          <h1 className="mt-4 font-display text-2xl font-bold">Link inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Peça um novo link para a equipe da Talk.
          </p>
        </div>
      </main>
    );
  }

  const { client, posts } = q.data;
  const filtered = posts.filter((p: any) => p.status === tab);

  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-4">
          <div className="relative">
            {client.avatar_signed_url ? (
              <img
                src={client.avatar_signed_url}
                alt=""
                className="h-11 w-11 rounded-full object-cover ring-2 ring-brand-orange/40 ring-offset-2 ring-offset-background"
              />
            ) : (
              <div className="h-11 w-11 rounded-full bg-muted" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-display font-semibold leading-none">
                @{client.instagram_handle}
              </p>
              <TalkStar className="h-3 w-3 text-brand-orange" />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{client.name}</p>
          </div>
        </div>

        <div className="mx-auto flex max-w-md gap-1 px-5 pb-3">
          {(
            [
              { v: "pending", l: "Pendentes" },
              { v: "approved", l: "Aprovados" },
              { v: "rejected", l: "Reprovados" },
            ] as { v: Tab; l: string }[]
          ).map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                tab === t.v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-8 px-4 py-6">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <TalkStar className="mx-auto h-8 w-8 text-brand-chartreuse" />
            <p className="mt-3 text-sm text-muted-foreground">
              {tab === "pending"
                ? "Nada pendente por aqui."
                : tab === "approved"
                  ? "Você ainda não aprovou nenhum post."
                  : "Nenhum post reprovado."}
            </p>
          </div>
        ) : (
          filtered.map((p: any) => (
            <FeedCard key={p.id} post={p} client={client} token={token} readOnly={tab !== "pending"} />
          ))
        )}
      </div>
    </main>
  );
}

function FeedCard({
  post,
  client,
  token,
  readOnly,
}: {
  post: any;
  client: any;
  token: string;
  readOnly: boolean;
}) {
  const approveFn = useServerFn(approvePostByToken);
  const rejectFn = useServerFn(rejectPostByToken);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    try {
      const res = await approveFn({ data: { token, postId: post.id } });
      const dt = parseISO(res.scheduled_at);
      toast.success(
        `Aprovado! Este post será publicado em ${format(dt, "dd/MM 'às' HH'h'", { locale: ptBR })}.`,
        { duration: 6000 },
      );
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!comment.trim()) return toast.error("Deixe seu comentário.");
    setBusy(true);
    try {
      await rejectFn({ data: { token, postId: post.id, comment } });
      toast.success("Reprovação enviada à Talk.");
      setRejectOpen(false);
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Instagram-style header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        {client.avatar_signed_url ? (
          <img
            src={client.avatar_signed_url}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-muted" />
        )}
        <div className="text-sm font-semibold">@{client.instagram_handle}</div>
        <div className="ml-auto text-[11px] text-muted-foreground">
          {format(parseISO(post.scheduled_at), "dd 'de' MMM · HH'h'mm", {
            locale: ptBR,
          })}
        </div>
      </div>

      {/* Media */}
      <MediaViewer post={post} />

      {/* Sections: cover + caption */}
      <div className="space-y-4 border-t border-border p-4">
        {post.cover_signed_url && (
          <section>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Capa do post
            </div>
            <img
              src={post.cover_signed_url}
              alt="Capa"
              className="w-full max-w-[180px] rounded-lg border border-border"
            />
          </section>
        )}
        <section>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Legenda
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {post.caption || <span className="text-muted-foreground">—</span>}
          </p>
        </section>

        {post.status === "rejected" && post.client_comment && (
          <section className="rounded-lg bg-brand-purple-soft p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-purple">
              Seu comentário
            </div>
            <p className="mt-1 text-sm text-brand-purple">{post.client_comment}</p>
          </section>
        )}
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
          <Button
            onClick={approve}
            disabled={busy}
            className="gap-1.5 bg-brand-chartreuse text-emerald-950 hover:bg-brand-chartreuse/90"
          >
            <Check className="h-4 w-4" /> Aprovar
          </Button>
          <Button
            variant="outline"
            onClick={() => setRejectOpen(true)}
            disabled={busy}
            className="gap-1.5 border-brand-purple/40 text-brand-purple hover:bg-brand-purple-soft"
          >
            <X className="h-4 w-4" /> Reprovar
          </Button>
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deixe seu comentário</DialogTitle>
          </DialogHeader>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="O que precisa ser ajustado?"
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={reject}
              disabled={busy}
              className="bg-brand-purple text-white hover:bg-brand-purple/90"
            >
              Enviar reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function MediaViewer({ post }: { post: any }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: false });
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setIdx(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  const items: { signed_url: string; kind: "image" | "video" }[] = post.media ?? [];

  if (post.type === "video") {
    const v = items[0];
    return (
      <div className="relative aspect-square bg-black">
        {v?.signed_url && (
          <video
            src={v.signed_url}
            poster={post.cover_signed_url ?? undefined}
            controls
            className="h-full w-full object-contain"
          />
        )}
      </div>
    );
  }

  if (post.type === "static") {
    const m = items[0];
    return (
      <div className="aspect-square bg-muted">
        {m?.signed_url && (
          <img src={m.signed_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
    );
  }

  // carousel
  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {items.map((m, i) => (
            <div key={i} className="min-w-0 flex-[0_0_100%]">
              <div className="aspect-square bg-muted">
                {m.signed_url && (
                  <img
                    src={m.signed_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {items.length > 1 && (
        <>
          <button
            onClick={() => embla?.scrollPrev()}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => embla?.scrollNext()}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {items.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === idx ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
