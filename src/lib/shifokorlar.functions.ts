import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sxema = z.object({
  /** Mavjud shifokor qatori id'si; bo'sh bo'lsa yangi shifokor yaratiladi */
  doctorId: z.string().uuid().optional(),
  fullName: z.string().trim().min(2).max(100),
  specialty: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(30).optional(),
  cabinet: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(120),
  parol: z.string().min(8).max(72),
});

export type ShifokorLoginKirish = z.infer<typeof sxema>;

/**
 * Klinika admini (yoki super_admin) shifokorga login yaratadi:
 * auth user + profiles.clinic_id + user_roles.role='doktor' + doctors.user_id.
 */
export const shifokorLoginYarat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ShifokorLoginKirish) => sxema.parse(input))
  .handler(async ({ data, context }) => {
    // 1. Chaqiruvchi klinika admini bo'lishi shart
    const { data: profil, error: profilXato } = await context.supabase
      .from("profiles")
      .select("clinic_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (profilXato) throw new Error("Profilni o'qib bo'lmadi");

    const { data: superAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!superAdmin && !admin) throw new Error("Ruxsat yo'q: faqat administrator");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2. Shifokor qatori
    let doctorId = data.doctorId ?? null;
    let clinicId = profil?.clinic_id ?? null;

    if (doctorId) {
      const { data: mavjud, error } = await supabaseAdmin
        .from("doctors")
        .select("id, clinic_id, user_id")
        .eq("id", doctorId)
        .maybeSingle();
      if (error || !mavjud) throw new Error("Shifokor topilmadi");
      if (!superAdmin && mavjud.clinic_id !== clinicId) throw new Error("Ruxsat yo'q");
      if (mavjud.user_id) throw new Error("Bu shifokorga login allaqachon biriktirilgan");
      clinicId = mavjud.clinic_id;
    } else {
      if (!clinicId) throw new Error("Klinika aniqlanmadi");
      const { data: yangi, error } = await supabaseAdmin
        .from("doctors")
        .insert({
          clinic_id: clinicId,
          full_name: data.fullName,
          specialty: data.specialty ?? null,
          phone: data.phone ?? null,
          cabinet: data.cabinet ?? null,
        })
        .select("id")
        .single();
      if (error || !yangi) throw new Error(error?.message ?? "Shifokor yaratilmadi");
      doctorId = yangi.id;
    }

    // 3. Auth foydalanuvchi
    const { data: yaratilgan, error: userXato } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.parol,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (userXato || !yaratilgan?.user) {
      if (!data.doctorId && doctorId) await supabaseAdmin.from("doctors").delete().eq("id", doctorId);
      throw new Error(userXato?.message ?? "Foydalanuvchi yaratilmadi");
    }

    const userId = yaratilgan.user.id;

    try {
      const { error: profilYozXato } = await supabaseAdmin.from("profiles").upsert(
        { id: userId, clinic_id: clinicId, email: data.email, full_name: data.fullName },
        { onConflict: "id" },
      );
      if (profilYozXato) throw new Error(profilYozXato.message);

      const { error: rolXato } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, clinic_id: clinicId, role: "doktor" });
      if (rolXato) throw new Error(rolXato.message);

      const { error: bogXato } = await supabaseAdmin
        .from("doctors")
        .update({ user_id: userId })
        .eq("id", doctorId);
      if (bogXato) throw new Error(bogXato.message);
    } catch (e) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      if (!data.doctorId && doctorId) await supabaseAdmin.from("doctors").delete().eq("id", doctorId);
      throw e instanceof Error ? e : new Error("Login biriktirishda xatolik");
    }

    return { doctorId, userId, email: data.email };
  });
