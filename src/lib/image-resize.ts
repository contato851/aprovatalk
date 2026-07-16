/**
 * Redimensiona uma imagem para exatamente targetW x targetH (cover crop centralizado).
 * Retorna um novo File JPEG. Se já estiver nas dimensões corretas, retorna o original.
 */
export async function resizeImageToExact(
  file: File,
  targetW: number,
  targetH: number,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  if (bitmap.width === targetW && bitmap.height === targetH) {
    bitmap.close?.();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }

  // cover crop centralizado
  const scale = Math.max(targetW / bitmap.width, targetH / bitmap.height);
  const drawW = bitmap.width * scale;
  const drawH = bitmap.height * scale;
  const dx = (targetW - drawW) / 2;
  const dy = (targetH - drawH) / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(bitmap, dx, dy, drawW, drawH);
  bitmap.close?.();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}
