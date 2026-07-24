import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, GripVertical, Link2, FolderInput, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createPost,
  updatePost,
  releasePostForApproval,
  listAvailableSlots,
} from "@/lib/admin.functions";
import { listDriveFolder, importDriveFiles } from "@/lib/drive.functions";
import { uploadToBucket } from "@/lib/upload";
import { resizeImageToExact } from "@/lib/image-resize";
import { format, parseISO } from "date-fns";

import { ptBR } from "date-fns/locale";

type PostType = "static" | "carousel" | "video";
type PostStatus = "planning" | "pending" | "ready_for_review";
type LinkKind = "none" | "design" | "delivery";

type MediaSlot = {
  id: string;
  file?: File;
  path?: string;
  previewUrl: string;
  kind: "image" | "video";
};

type Props =
  | {
      mode: "create";
      clientId: string;
      initialStatus?: PostStatus;
      onSaved: (status: PostStatus) => void;
    }
  | {
      mode: "edit";
      postId: string;
      initial: any;
      onSaved: (status: PostStatus) => void;
    };

export function PostForm(props: Props) {
  const qc = useQueryClient();
  const createFn = useServerFn(createPost);
  const updateFn = useServerFn(updatePost);
  const releaseFn = useServerFn(releasePostForApproval);
  const listSlotsFn = useServerFn(listAvailableSlots);

  const initial = props.mode === "edit" ? props.initial : null;
  const currentStatus: PostStatus =
    props.mode === "edit"
      ? (initial?.status === "planning"
          ? "planning"
          : initial?.status === "ready_for_review"
            ? "ready_for_review"
            : "pending")
      : (props.initialStatus ?? "pending");
  const isDraft = currentStatus === "planning" || currentStatus === "ready_for_review";
  const isPlanning = isDraft; // manter compatibilidade com o resto do arquivo

  const [type, setType] = useState<PostType>(initial?.type ?? "static");
  const [caption, setCaption] = useState<string>(initial?.caption ?? "");
  const [scheduled, setScheduled] = useState<string>(
    initial?.scheduled_at
      ? toLocalInputValue(initial.scheduled_at)
      : defaultScheduled(),
  );
  const [media, setMedia] = useState<MediaSlot[]>(
    initial?.media?.map((m: any) => ({
      id: m.id,
      path: m.url,
      previewUrl: m.signed_url,
      kind: m.kind,
    })) ?? [],
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(
    initial?.cover_url ?? null,
  );
  const [coverPreview, setCoverPreview] = useState<string | null>(
    initial?.cover_signed_url ?? null,
  );
  const [saving, setSaving] = useState(false);

  // ---- Vínculo com entrega (Design/Edição) ----
  const initialLinkKind: LinkKind = initial?.linked_design_slot_id
    ? "design"
    : initial?.linked_delivery_slot_id
      ? "delivery"
      : "none";
  const [linkKind, setLinkKind] = useState<LinkKind>(initialLinkKind);
  const [linkedSlotId, setLinkedSlotId] = useState<string | null>(
    initial?.linked_design_slot_id ?? initial?.linked_delivery_slot_id ?? null,
  );
  const [slotOptions, setSlotOptions] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (!isDraft || linkKind === "none") {
      setSlotOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSlots(true);
      try {
        const res = await listSlotsFn({
          data: {
            slotType: linkKind,
            includeId: linkedSlotId ?? null,
          },
        });
        if (!cancelled) setSlotOptions(res ?? []);
      } catch (e) {
        if (!cancelled) setSlotOptions([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKind, isDraft]);

  const sensors = useSensors(useSensor(PointerSensor));

  function onFilesChosen(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).map<MediaSlot>((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      kind: file.type.startsWith("video/") ? "video" : "image",
    }));
    if (type === "static") setMedia(arr.slice(0, 1));
    else if (type === "video") setMedia(arr.slice(0, 1));
    else setMedia((prev) => [...prev, ...arr]);
  }

  function removeMedia(id: string) {
    setMedia((m) => m.filter((x) => x.id !== id));
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    setMedia((items) => {
      const oldIndex = items.findIndex((i) => i.id === e.active.id);
      const newIndex = items.findIndex((i) => i.id === e.over!.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  function onCoverChosen(file: File | null) {
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
    if (!file) setCoverPath(null);
  }

  async function submit() {
    if (!isPlanning) {
      if (media.length === 0) return toast.error("Envie ao menos uma mídia.");
      if (type === "video" && media[0].kind !== "video")
        return toast.error("Selecione um vídeo (MP4/MOV).");
      if (type !== "video" && media.some((m) => m.kind !== "image"))
        return toast.error("Envie apenas imagens (JPG/PNG).");
      if (type === "video" && !coverFile && !coverPath)
        return toast.error("Vídeo requer uma capa.");
    } else {
      // Em planejamento só validamos consistência do que foi enviado.
      if (type === "video" && media.length > 0 && media[0].kind !== "video")
        return toast.error("Selecione um vídeo (MP4/MOV).");
      if (type !== "video" && media.some((m) => m.kind !== "image"))
        return toast.error("Envie apenas imagens (JPG/PNG).");
    }

    setSaving(true);
    try {
      const uploaded = await Promise.all(
        media.map(async (m) => {
          if (m.path) return { path: m.path, kind: m.kind };
          let fileToUpload = m.file!;
          if (m.kind === "image" && (type === "static" || type === "carousel")) {
            fileToUpload = await resizeImageToExact(fileToUpload, 1080, 1440);
          }
          const p = await uploadToBucket("post-media", fileToUpload);
          return { path: p, kind: m.kind };
        }),
      );

      let finalCoverPath: string | null = coverPath;
      if (coverFile) finalCoverPath = await uploadToBucket("post-covers", coverFile);

      const linkPayload = isDraft
        ? {
            linked_design_slot_id:
              linkKind === "design" ? linkedSlotId : null,
            linked_delivery_slot_id:
              linkKind === "delivery" ? linkedSlotId : null,
          }
        : {};

      const payload = {
        type,
        caption,
        scheduled_at: new Date(scheduled).toISOString(),
        cover_path: finalCoverPath,
        media: uploaded,
        ...linkPayload,
      };

      if (props.mode === "create") {
        await createFn({
          data: {
            ...payload,
            client_id: props.clientId,
            status: currentStatus === "ready_for_review" ? "planning" : currentStatus,
          },
        });
        toast.success(isPlanning ? "Rascunho salvo!" : "Post criado!");
      } else {
        await updateFn({ data: { ...payload, id: props.postId } });
        toast.success(
          isPlanning ? "Rascunho atualizado." : "Post atualizado. Voltou para pendente.",
        );
      }
      qc.invalidateQueries();
      props.onSaved(currentStatus);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function release() {
    if (props.mode !== "edit") return;
    setSaving(true);
    try {
      const res = await releaseFn({ data: { id: props.postId } });
      if (!res.ok) {
        toast.error(`Faltam: ${res.missing.join(", ")}.`);
        return;
      }
      toast.success("Post liberado para aprovação do cliente.");
      qc.invalidateQueries();
      props.onSaved("pending");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Type selector */}
      <div>
        <Label>Tipo</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(
            [
              { v: "static", l: "Estático" },
              { v: "carousel", l: "Carrossel" },
              { v: "video", l: "Reels" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => {
                setType(opt.v);
                setMedia([]);
              }}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                type === opt.v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent"
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Media upload */}
      <div>
        <Label>
          {type === "static"
            ? "Imagem (JPG/PNG)"
            : type === "carousel"
              ? "Imagens do carrossel (arraste para reordenar)"
              : "Vídeo (MP4/MOV)"}
        </Label>
        <Input
          type="file"
          className="mt-2"
          accept={type === "video" ? "video/mp4,video/quicktime" : "image/jpeg,image/png"}
          multiple={type === "carousel"}
          onChange={(e) => onFilesChosen(e.target.files)}
        />
        {media.length > 0 && (
          <div className="mt-4">
            {type === "carousel" ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={media.map((m) => m.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex flex-wrap gap-3">
                    {media.map((m) => (
                      <SortableMedia key={m.id} slot={m} onRemove={() => removeMedia(m.id)} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="flex gap-3">
                {media.map((m) => (
                  <div
                    key={m.id}
                    className="relative overflow-hidden rounded-xl border border-border"
                  >
                    {m.kind === "image" ? (
                      <img
                        src={m.previewUrl}
                        alt=""
                        className="h-40 w-40 object-cover"
                      />
                    ) : (
                      <video
                        src={m.previewUrl}
                        className="h-40 w-40 object-cover"
                        controls
                      />
                    )}
                    <button
                      onClick={() => removeMedia(m.id)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cover - apenas para vídeo */}
      {type === "video" && (
      <div>
        <Label>Capa (obrigatória)</Label>
        <Input
          type="file"
          className="mt-2"
          accept="image/jpeg,image/png"
          onChange={(e) => onCoverChosen(e.target.files?.[0] ?? null)}
        />
        {coverPreview && (
          <img
            src={coverPreview}
            alt=""
            className="mt-3 h-40 w-40 rounded-xl border border-border object-cover"
          />
        )}
      </div>
      )}

      {/* Caption */}
      <div>
        <Label>Legenda</Label>
        <Textarea
          className="mt-2 min-h-[140px]"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Escreva a legenda com quebras de linha e emojis…"
        />
      </div>

      {/* Vínculo com entrega — só para rascunhos */}
      {isDraft && (
        <div className="rounded-2xl border border-dashed border-brand-purple/40 bg-brand-purple-soft/40 p-4">
          <Label className="flex items-center gap-2 text-brand-purple">
            <Link2 className="h-4 w-4" /> Vincular a uma entrega
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Quando o designer/editor marcar a entrega como concluída, este post sobe automaticamente para <strong>Pronto para revisão</strong>.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                { v: "none", l: "Nenhuma" },
                { v: "design", l: "🎨 Design" },
                { v: "delivery", l: "🎬 Edição" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => {
                  setLinkKind(opt.v);
                  if (opt.v === "none") setLinkedSlotId(null);
                  else if (opt.v !== initialLinkKind) setLinkedSlotId(null);
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  linkKind === opt.v
                    ? "border-brand-purple bg-brand-purple text-white"
                    : "border-border bg-card hover:bg-accent"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
          {linkKind !== "none" && (
            <div className="mt-3">
              <select
                value={linkedSlotId ?? ""}
                onChange={(e) => setLinkedSlotId(e.target.value || null)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">
                  {loadingSlots ? "Carregando…" : "Selecione uma entrega…"}
                </option>
                {slotOptions.map((s: any) => {
                  const label = `${format(parseISO(s.slot_date), "dd/MM (EEE)", { locale: ptBR })} · #${s.slot_index + 1} — ${s.title || s.client || "(sem título)"}${s.done ? " ✓" : ""}`;
                  return (
                    <option key={s.id} value={s.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
              {!loadingSlots && slotOptions.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Nenhuma entrega disponível. Crie um slot na aba {linkKind === "design" ? "Design" : "Edição"} primeiro.
                </p>
              )}
            </div>
          )}
        </div>
      )}


      {/* Scheduled */}
      <div>
        <Label>Data e hora programadas</Label>
        <Input
          type="datetime-local"
          className="mt-2 w-full md:w-64"
          value={scheduled}
          onChange={(e) => setScheduled(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-3 pt-4">
        {props.mode === "edit" && isPlanning && (
          <Button
            variant="outline"
            onClick={release}
            disabled={saving}
            className="border-brand-chartreuse/50 text-emerald-800 hover:bg-brand-chartreuse-soft"
          >
            Liberar para aprovação
          </Button>
        )}
        <Button onClick={submit} disabled={saving}>
          {saving
            ? "Salvando…"
            : isPlanning
              ? props.mode === "create"
                ? "Salvar rascunho"
                : "Salvar rascunho"
              : props.mode === "create"
                ? "Criar post"
                : "Salvar e reenviar"}
        </Button>
      </div>
    </div>
  );
}

function SortableMedia({
  slot,
  onRemove,
}: {
  slot: MediaSlot;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slot.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="relative overflow-hidden rounded-xl border border-border bg-card"
    >
      <img src={slot.previewUrl} alt="" className="h-32 w-32 object-cover" />
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 rounded bg-black/60 p-1 text-white"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <button
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function defaultScheduled() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return toLocalInputValue(d.toISOString());
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
