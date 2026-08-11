import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  addAdjustmentPointByToken,
  approvePostByToken,
  createAdjustmentFrameUploadUrl,
  deleteAdjustmentPointByToken,
  getClientPortal,
  rejectPostByToken,
} from "@/lib/client-portal.functions";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Check, MessageSquarePlus, Trash2 } from "lucide-react";
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
import { usePostSortFilter } from "@/components/talk/post-sort-filter";
import { PlanningCalendarReadOnly } from "@/components/talk/planning-calendar-readonly";


export const Route = createFileRoute("/c/$token")({
  component: ClientFeed,
});

type Tab = "pending" | "calendar" | "approved" | "rejected";

function ClientFeed() {
  const { token } = Route.useParams();
  const getPortalFn = useServerFn(getClientPortal);
  const [tab, setTab] = useState<Tab>("pending");


  const q = useQuery({
    queryKey: ["client-portal", token],
    queryFn: () => getPortalFn({ data: { token } }),
    retry: false,
  });

  const allPosts = (q.data?.posts ?? []) as any[];
  const sf = usePostSortFilter(allPosts.filter((p: any) => p.status === tab));


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

  const { client } = q.data;
  const filtered = sf.result;

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

        <div className="mx-auto flex max-w-md gap-1 px-5 pb-3 overflow-x-auto">
          {(
            [
              { v: "calendar", l: "Calendário" },
              { v: "pending", l: "Pendentes" },
              { v: "rejected", l: "Em ajustes" },
              { v: "approved", l: "Aprovados" },

            ] as { v: Tab; l: string }[]
          ).map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
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
        {tab === "calendar" ? (
          <PlanningCalendarReadOnly posts={allPosts} />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <TalkStar className="mx-auto h-8 w-8 text-brand-chartreuse" />
            <p className="mt-3 text-sm text-muted-foreground">
              {tab === "pending"
                ? "Nada pendente por aqui."
                : tab === "approved"
                  ? "Você ainda não aprovou nenhum post."
                  : "Nenhum post em ajustes."}
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


function typeLabel(t: string) {
  return t === "static" ? "Estático" : t === "carousel" ? "Carrossel" : "Reels";
}

function typeBadgeClass(t: string) {
  return t === "static"
    ? "bg-brand-orange text-white"
    : t === "carousel"
      ? "bg-brand-purple text-white"
      : "bg-brand-chartreuse text-emerald-950";
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
  const queryClient = useQueryClient();
  const approveFn = useServerFn(approvePostByToken);
  const rejectFn = useServerFn(rejectPostByToken);
  const addPointFn = useServerFn(addAdjustmentPointByToken);
  const deletePointFn = useServerFn(deleteAdjustmentPointByToken);
  const createUploadFn = useServerFn(createAdjustmentFrameUploadUrl);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [pointDraft, setPointDraft] = useState<
    | {
        time_seconds: number;
        note: string;
        frame_data_url: string;
        frame_blob: Blob;
      }
    | null
  >(null);

  const points: any[] = post.adjustment_points ?? [];
  const isVideo = post.type === "video";

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["client-portal", token] });
  }

  // Atualiza apenas os pontos de ajuste deste post no cache, sem refazer o
  // fetch do portal (o refetch gera novas signed URLs e reinicia o vídeo).
  function updatePointsLocally(
    updater: (points: any[]) => any[],
  ) {
    queryClient.setQueryData(["client-portal", token], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        posts: old.posts.map((p: any) =>
          p.id === post.id
            ? { ...p, adjustment_points: updater(p.adjustment_points ?? []) }
            : p,
        ),
      };
    });
  }

  async function approve() {
    setBusy(true);
    try {
      const res = await approveFn({ data: { token, postId: post.id } });
      const dt = parseISO(res.scheduled_at);
      toast.success(
        `Aprovado! Este post será publicado em ${format(dt, "dd/MM 'às' HH'h'", { locale: ptBR })}.`,
        { duration: 6000 },
      );
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!comment.trim() && points.length === 0) {
      return toast.error("Deixe um comentário ou marque um ponto de ajuste.");
    }
    setBusy(true);
    try {
      await rejectFn({ data: { token, postId: post.id, comment } });
      toast.success("Pedido de ajustes enviado à Talk.");
      setComment("");
      setRejectOpen(false);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }


  async function captureFrame() {
    const v = videoRef.current;
    if (!v) return;
    if (!v.videoWidth || !v.videoHeight) {
      return toast.error("Aguarde o vídeo carregar antes de marcar.");
    }
    try {
      v.pause();
    } catch {}
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    } catch {
      return toast.error("Não foi possível capturar o frame.");
    }
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
    );
    if (!blob) return toast.error("Falha ao gerar imagem do frame.");
    const frame_data_url = canvas.toDataURL("image/jpeg", 0.85);
    setPointDraft({
      time_seconds: v.currentTime,
      note: "",
      frame_data_url,
      frame_blob: blob,
    });
  }

  async function savePoint() {
    if (!pointDraft) return;
    if (!pointDraft.note.trim()) return toast.error("Escreva o que precisa ajustar.");
    setBusy(true);
    try {
      const up = await createUploadFn({ data: { token, postId: post.id } });
      const putRes = await fetch(up.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: pointDraft.frame_blob,
      });
      if (!putRes.ok) throw new Error("Falha ao enviar frame.");
      const saved = await addPointFn({
        data: {
          token,
          postId: post.id,
          time_seconds: pointDraft.time_seconds,
          note: pointDraft.note,
          frame_path: up.path,
        },
      });
      toast.success("Ponto de ajuste salvo.");
      setPointDraft(null);
      updatePointsLocally((pts) =>
        [...pts, saved].sort(
          (a, b) => Number(a.time_seconds) - Number(b.time_seconds),
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar ponto.");
    } finally {
      setBusy(false);
    }
  }

  async function removePoint(pointId: string) {
    if (!confirm("Remover este ponto de ajuste?")) return;
    setBusy(true);
    try {
      await deletePointFn({ data: { token, pointId } });
      updatePointsLocally((pts) => pts.filter((p) => p.id !== pointId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  function seekTo(t: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    v.pause();
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
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

      {post.midia_arquivada ? (
        <ArchivedPlaceholder />
      ) : (
        <MediaViewer post={post} videoRef={videoRef} />
      )}

      {isVideo && !post.midia_arquivada && !readOnly && (
        <div className="border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={captureFrame}
            disabled={busy}
            className="w-full gap-2 border-brand-orange/40 text-brand-orange hover:bg-brand-orange-soft"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Marcar ponto de ajuste
          </Button>
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            Pause o vídeo no instante desejado e toque para capturar o frame e escrever a observação.
          </p>
        </div>
      )}

      {isVideo && points.length > 0 && (
        <section className="border-t border-border px-4 py-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pontos de ajuste ({points.length})
          </div>
          <ul className="space-y-3">
            {points.map((pt) => (
              <li
                key={pt.id}
                className="flex gap-3 rounded-lg border border-border bg-background/60 p-2"
              >
                {pt.frame_signed_url ? (
                  <button
                    type="button"
                    onClick={() => seekTo(Number(pt.time_seconds))}
                    className="block h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted"
                    title="Ir para este instante"
                  >
                    <img
                      src={pt.frame_signed_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-md bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => seekTo(Number(pt.time_seconds))}
                    className="text-[11px] font-semibold text-brand-orange hover:underline"
                  >
                    {formatMMSS(Number(pt.time_seconds))}
                  </button>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-foreground/90">
                    {pt.note}
                  </p>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removePoint(pt.id)}
                    className="self-start rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label="Remover ponto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-4 border-t border-border p-4">
        {post.cover_signed_url && !post.midia_arquivada && (
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
            <p className="mt-1 whitespace-pre-line text-sm text-brand-purple">
              {post.client_comment}
            </p>
          </section>
        )}
      </div>

      {!readOnly && (
        <div className="space-y-1.5 border-t border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={approve}
              disabled={busy || points.length > 0}
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
              <MessageSquarePlus className="h-4 w-4" /> Enviar para ajustes
            </Button>
          </div>
          {points.length > 0 && (
            <p className="text-[11px] leading-snug text-brand-purple">
              Você marcou {points.length} ponto{points.length > 1 ? "s" : ""} de
              ajuste. Toque em <strong>Enviar para ajustes</strong> para que a
              Talk receba seu pedido — enquanto não enviar, a equipe não é
              avisada.
            </p>
          )}

        </div>
      )}

      {/* Diálogo de captura de frame */}
      <Dialog open={!!pointDraft} onOpenChange={(o) => !o && setPointDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Ponto de ajuste{" "}
              {pointDraft && (
                <span className="text-sm font-normal text-muted-foreground">
                  · {formatMMSS(pointDraft.time_seconds)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {pointDraft && (
            <div className="space-y-3">
              <img
                src={pointDraft.frame_data_url}
                alt=""
                className="w-full rounded-md border border-border"
              />
              <Textarea
                value={pointDraft.note}
                onChange={(e) =>
                  setPointDraft({ ...pointDraft, note: e.target.value })
                }
                placeholder="O que precisa ser ajustado neste instante?"
                className="min-h-[100px]"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPointDraft(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              onClick={savePoint}
              disabled={busy}
              className="bg-brand-orange text-white hover:bg-brand-orange/90"
            >
              Salvar ponto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de envio para ajustes */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar para ajustes</DialogTitle>
          </DialogHeader>
          {points.length > 0 && (
            <div className="rounded-lg bg-brand-orange-soft p-3 text-xs text-brand-orange">
              Os {points.length} ponto{points.length > 1 ? "s" : ""} de ajuste marcado{points.length > 1 ? "s" : ""} serão enviados junto com este pedido.
            </div>
          )}
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              points.length > 0
                ? "Comentário geral (opcional)"
                : "O que precisa ser ajustado?"
            }
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
              {busy ? "Enviando…" : "Enviar para ajustes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function formatMMSS(total: number) {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function ArchivedPlaceholder() {
  return (
    <div className="flex aspect-[3/4] flex-col items-center justify-center bg-muted/60 text-muted-foreground">
      <p className="text-xs font-medium uppercase tracking-wider">Mídia arquivada</p>
    </div>
  );
}

function MediaViewer({
  post,
  videoRef,
}: {
  post: any;
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
}) {
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
      <div className="relative aspect-[9/16] bg-black">
        {v?.signed_url && (
          <video
            ref={(el) => {
              if (videoRef) videoRef.current = el;
            }}
            src={v.signed_url}
            poster={post.cover_signed_url ?? undefined}
            controls
            crossOrigin="anonymous"
            playsInline
            className="h-full w-full object-contain"
          />
        )}
      </div>
    );
  }

  if (post.type === "static") {
    const m = items[0];
    return (
      <div className="aspect-[3/4] bg-muted">
        {m?.signed_url && (
          <img src={m.signed_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {items.map((m, i) => (
            <div key={i} className="min-w-0 flex-[0_0_100%]">
              <div className="aspect-[3/4] bg-muted">
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
