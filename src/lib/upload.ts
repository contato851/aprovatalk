import { supabase } from "@/integrations/supabase/client";
import { createUploadUrl } from "@/lib/admin.functions";

type Bucket = "avatars" | "post-media" | "post-covers";

/**
 * Faz upload de um arquivo via signed URL retornada pelo servidor.
 * Retorna o path (armazenado no banco) para uso posterior.
 */
export async function uploadToBucket(bucket: Bucket, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const { path, token } = await createUploadUrl({ data: { bucket, ext } });
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, file);
  if (error) throw error;
  return path;
}
