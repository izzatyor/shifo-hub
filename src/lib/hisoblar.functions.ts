import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

import { adminKlinikasi } from "./xodimlar.schemas";

type Kontekst = { supabase: SupabaseClient<Database>; userId: string };

const XODIM_ROLLARI = ["kassa", "rahbar", "qabul"] as const;

/** Chaqiruvchi shu klinikaning admini (yoki super_admin) ekanini tekshiradi. */
async function adminniTekshir(context: Kontekst) {
  const [profil, rollar] = await Promise.all([
    context.supabase.from("profiles").select("clinic_id").eq("id", context.userId).maybeSingle(),
    context.supabase.from("user_roles").select("role, clinic_id").eq("user_id", context.userId),
  ]);
  if (profil.error || rollar.error) throw new Error("Ruxsatni tekshirib bo'lmadi");
  const clinicId = adminKlinikasi(rollar.data ?? [], profil.data?.clinic_id ?? null);
  const superAdmin = (rollar.data ?? []).some((r) => r.role === "super_admin");
  return { clinicId, superAdmin };
}

/** Nishon hisob shu klinikada ekanini va tegilishi mumkinligini tekshiradi. */
async function nishonniTekshir(
  supabaseAdmin: SupabaseClient<Database>,
  clinicId: string,
  userId: string,
  superAdmin: boolean,
) {
  const { data: profil } = await supabaseAdmin
    .from("profiles")
    .select("id, clinic_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profil || profil.clinic_id !== clinicId) throw new Error("Xodim topilmadi");
  const { data: rollar } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const nomlar = (rollar ?? []).map((r) => r.role as string);
  if (nomlar.includes("super_admin")) throw new Error("Bu hisobni o'zgartirib bo'lmadi");
  if (nomlar.includes("admin") && !superAdmin) throw new Error("Administrator hisobini faqat bosh admin o'zgartiradi");
  return nomlar;
}

const tahrirSxema = z
  .object({
    xodimId: z.string().uuid(),
    fullName: z.string().trim().min(2).max(100),
    role: z.enum(XODIM_ROLLARI).optional(),
  })
  .strict();

/**
 * Admin xodim yoki shifokor ismini o'zgartiradi. role berilsa (faqat kassa/rahbar/qabul
 * xodimlari uchun) rol ham almashadi. Shifokor ismi o'zgarganda login ro'yxati mos bo'lishi
 * uchun Shifokorlar sahifasi ham shu funksiyani (role siz) chaqiradi.
 */
export const xodimniTahrirla = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof tahrirSxema>) => tahrirSxema.parse(input))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { clinicId, superAdmin } = await adminniTekshir(context as Kontekst);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nomlar = await nishonniTekshir(supabaseAdmin, clinicId, data.xodimId, superAdmin);

    let eskiRol: string | null = null;
    if (data.role) {
      if (nomlar.length !== 1 || !XODIM_ROLLARI.some((r) => r === nomlar[0])) {
        throw new Error("Rolni faqat kassa, rahbar va qabul xodimlarida o'zgartirish mumkin");
      }
      eskiRol = nomlar[0] ?? null;
    }

    const { error: ismXato } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName })
      .eq("id", data.xodimId);
    if (ismXato) throw new Error("Ism saqlanmadi");
    await supabaseAdmin.auth.admin.updateUserById(data.xodimId, {
      user_metadata: { full_name: data.fullName },
    });

    if (data.role && eskiRol && data.role !== eskiRol) {
      const { error: yangiXato } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.xodimId, clinic_id: clinicId, role: data.role });
      if (yangiXato) throw new Error("Rol almashmadi");
      const { error: eskiXato } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.xodimId)
        .eq("clinic_id", clinicId)
        .eq("role", eskiRol as "kassa" | "rahbar" | "qabul");
      if (eskiXato) {
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", data.xodimId)
          .eq("clinic_id", clinicId)
          .eq("role", data.role);
        throw new Error("Rol almashmadi");
      }
    }
    return { ok: true as const };
  });

const parolSxema = z
  .object({
    userId: z.string().uuid(),
    yangiParol: z.string().min(8).max(72),
  })
  .strict();

/** Admin xodim yoki shifokorga yangi parol belgilaydi. */
export const parolniTikla = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof parolSxema>) => parolSxema.parse(input))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { clinicId, superAdmin } = await adminniTekshir(context as Kontekst);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await nishonniTekshir(supabaseAdmin, clinicId, data.userId, superAdmin);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.yangiParol,
    });
    if (error) throw new Error("Parol o'zgarmadi. Parol kamida 8 belgi bo'lsin.");
    return { ok: true as const };
  });

const holatSxema = z
  .object({
    userId: z.string().uuid(),
    faol: z.boolean(),
  })
  .strict();

/** Admin hisobni faolsizlantiradi yoki qayta faollashtiradi (o'chirmasdan). */
export const faolHolatniOzgartir = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof holatSxema>) => holatSxema.parse(input))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { clinicId, superAdmin } = await adminniTekshir(context as Kontekst);
    if (data.userId === (context as Kontekst).userId) throw new Error("O'zingizni faolsizlantira olmaysiz");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await nishonniTekshir(supabaseAdmin, clinicId, data.userId, superAdmin);

    const { error: profilXato } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.faol })
      .eq("id", data.userId);
    if (profilXato) throw new Error("Holat saqlanmadi");
    await supabaseAdmin.from("doctors").update({ is_active: data.faol }).eq("user_id", data.userId);
    const { error: banXato } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.faol ? "none" : "876000h",
    });
    if (banXato) {
      await supabaseAdmin.from("profiles").update({ is_active: !data.faol }).eq("id", data.userId);
      throw new Error("Holat o'zgarmadi");
    }
    return { ok: true as const };
  });
