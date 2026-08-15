import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "./supabase";

/**
 * Uploads a local file URI or data: URL to the public app-images bucket and
 * returns its public URL. Existing http(s) URLs pass through untouched.
 * Storing URLs (not base64) keeps row payloads small — embedding images in
 * table rows made list fetches balloon to 100MB+ and crash the app.
 */
export async function uploadImageIfNeeded(uri: string | null, prefix: string): Promise<string | null> {
  if (!uri || uri.startsWith("http")) return uri;
  let base64: string;
  let contentType = "image/jpeg";
  if (uri.startsWith("data:")) {
    const m = uri.match(/^data:([^;]+);base64,(.*)$/s);
    if (!m) return uri;
    contentType = m[1];
    base64 = m[2];
  } else {
    base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  }
  const ext = contentType.split("/")[1]?.split("+")[0] || "jpg";
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("app-images").upload(path, decode(base64), { contentType });
  if (error) throw error;
  return supabase.storage.from("app-images").getPublicUrl(path).data.publicUrl;
}
