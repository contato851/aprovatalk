import { Image, Images, Video } from "lucide-react";

export function PostMediaPlaceholder({
  type,
  status,
}: {
  type: "static" | "carousel" | "video" | string;
  status: string;
}) {
  const isPlanning = status === "planning";

  if (!isPlanning) {
    return (
      <div className="flex h-full w-full items-center justify-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        sem mídia
      </div>
    );
  }

  const Icon = type === "carousel" ? Images : type === "video" ? Video : Image;
  const label =
    type === "carousel"
      ? "Carrossel"
      : type === "video"
        ? "Reel"
        : "Estático";

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Icon className="h-10 w-10 opacity-60" />
      <span className="text-[10px] font-medium uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
