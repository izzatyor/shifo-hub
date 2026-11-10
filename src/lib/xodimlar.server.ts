import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { XodimYaratKirish } from "./xodimlar.schemas";

export function kirishClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Kirish xizmati sozlanmagan");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
}

export async function xodimniYarat(client: SupabaseClient<Database>, clinicId: string, data: XodimYaratKirish) {
  const { data: created, error } = await client.auth.admin.createUser({
    email: data.email, password: data.parol, email_confirm: true,
    user_metadata: { full_name: data.fullName },
  });
  if (error || !created.user) throw new Error("Xodim yaratilmadi. Email band yoki parol talabga mos emas.");
  const userId = created.user.id;
  try {
    const { error: finishError } = await client.rpc("finish_staff_creation", {
      p_user_id: userId, p_clinic_id: clinicId, p_full_name: data.fullName,
      p_email: data.email, p_role: data.role,
    });
    if (finishError) throw finishError;
  } catch {
    const { error: cleanupError } = await client.auth.admin.deleteUser(userId);
    if (cleanupError) throw new Error("Xodim yaratilmadi; qisman yaratilgan hisobni tozalash talab qilinadi.");
    throw new Error("Xodim yaratilmadi, o‘zgarishlar orqaga qaytarildi.");
  }
  return { userId, clinicId, fullName: data.fullName, role: data.role };
}