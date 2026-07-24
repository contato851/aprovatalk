import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

function gatewayHeaders() {
  const lovable = process.env.LOVABLE_API_KEY;
  const drive = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovable || !drive) {
    throw new Error("Google Drive não está conectado. Verifique os secrets do projeto.");
  }
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": drive,
  };
}

function extractDriveId(input: string): { kind: "folder" | "file"; id: string } | null {
  const url = input.trim();
  // Folder patterns
  const folder = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folder) return { kind: "folder", id: folder[1] };
  // File patterns
  const file = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (file) return { kind: "file", id: file[1] };
  const openId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openId) return { kind: "file", id: openId[1] };
  // Raw ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return { kind: "folder", id: url };
  return null;
}

function mediaKindFromMime(mime: string): "image" | "video" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return null;
}

/** Lista arquivos de uma pasta (ou um único arquivo) do Google Drive. */
export const listDriveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) =>
    z.object({ url: z.string().min(1) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const parsed = extractDriveId(data.url);
    if (!parsed) throw new Error("URL do Drive inválida.");

    const headers = gatewayHeaders();
    const fields = "id,name,mimeType,size,thumbnailLink,iconLink,modifiedTime";

    if (parsed.kind === "file") {
      const res = await fetch(
        `${GATEWAY}/files/${parsed.id}?fields=${fields}&supportsAllDrives=true`,
        { headers },
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Drive [${res.status}]: ${body}`);
      }
      const f = await res.json();
      return { folderId: null, files: [f] };
    }

    const q = encodeURIComponent(
      `'${parsed.id}' in parents and trashed = false`,
    );
    const url =
      `${GATEWAY}/files?q=${q}` +
      `&fields=${encodeURIComponent(`files(${fields})`)}` +
      `&pageSize=200&orderBy=name` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Drive [${res.status}]: ${body}`);
    }
    const json = await res.json();
    return { folderId: parsed.id, files: json.files ?? [] };
  });

/** Baixa arquivos do Drive e sobe no bucket informado. Retorna paths + kinds. */
export const importDriveFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    fileIds: string[];
    bucket: "post-media" | "post-covers";
  }) =>
    z
      .object({
        fileIds: z.array(z.string().min(1)).min(1).max(20),
        bucket: z.enum(["post-media", "post-covers"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const headers = gatewayHeaders();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const results: {
      id: string;
      name: string;
      path: string;
      kind: "image" | "video";
      mimeType: string;
      signed_url: string | null;
    }[] = [];


    for (const fileId of data.fileIds) {
      // metadata
      const metaRes = await fetch(
        `${GATEWAY}/files/${fileId}?fields=id,name,mimeType,size&supportsAllDrives=true`,
        { headers },
      );
      if (!metaRes.ok) {
        const body = await metaRes.text();
        throw new Error(`Drive meta [${metaRes.status}]: ${body}`);
      }
      const meta = await metaRes.json();
      const kind = mediaKindFromMime(meta.mimeType ?? "");
      if (!kind) {
        throw new Error(
          `Arquivo "${meta.name}" (${meta.mimeType}) não é imagem nem vídeo.`,
        );
      }

      // download bytes — streaming direto para o Storage p/ evitar estourar memória
      const dlRes = await fetch(
        `${GATEWAY}/files/${fileId}?alt=media&supportsAllDrives=true`,
        { headers },
      );
      if (!dlRes.ok) {
        const body = await dlRes.text();
        throw new Error(`Drive download [${dlRes.status}]: ${body}`);
      }
      if (!dlRes.body) throw new Error("Drive download sem body");

      const ext =
        (meta.name?.split(".").pop() || "").toLowerCase() ||
        (kind === "image" ? "jpg" : "mp4");
      const path = `${crypto.randomUUID()}.${ext}`;

      // Para imagens buffer é ok (pequenas). Para vídeos, stream direto.
      const payload: ArrayBuffer | ReadableStream<Uint8Array> =
        kind === "image" ? await dlRes.arrayBuffer() : dlRes.body;

      const { error: upErr } = await supabaseAdmin.storage
        .from(data.bucket)
        .upload(path, payload as any, {
          contentType: meta.mimeType,
          upsert: false,
          duplex: "half",
        } as any);
      if (upErr) throw upErr;

      const { data: signed } = await supabaseAdmin.storage
        .from(data.bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 30);

      results.push({
        id: meta.id,
        name: meta.name,
        path,
        kind,
        mimeType: meta.mimeType,
        signed_url: signed?.signedUrl ?? null,
      });

    }

    return results;
  });
