import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sxema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  adminEmail: z.string().trim().email().max(120),
  adminParol: z.string().min(8).max(72),
  adminFullName: z.string().trim().max(100).optional(),
});

export type YangiKlinikaKirish = z.infer<typeof sxema>;

/**
 * Super-admin yangi klinika yaratadi va shu klinikaning birinchi admin
 * foydalanuvchisini (auth user + profiles.clinic_id + user_roles.role='admin')
 * avtomatik ochadi.
 */
export const klinikaVaAdminYarat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: YangiKlinikaKirish) => sxema.parse(input))
  .handler(async ({ data, context }) => {
    // 1. Faqat super_admin
    const { data: superAdmin, error: rolXato } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (rolXato) throw new Error("Rolni tekshirib bo'lmadi");
    if (!superAdmin) throw new Error("Ruxsat yo'q: faqat super administrator");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2. Klinika
    const { data: klinika, error: klinikaXato } = await supabaseAdmin
      .from("clinics")
      .insert({
        name: data.name,
        address: data.address ?? null,
        phone: data.phone ?? null,
      })
      .select("id, name")
      .single();
    if (klinikaXato || !klinika) throw new Error(klinikaXato?.message ?? "Klinika yaratilmadi");

    // 3. Auth foydalanuvchi
    const { data: yaratilgan, error: userXato } = await supabaseAdmin.auth.admin.createUser({
      email: data.adminEmail,
      password: data.adminParol,
      email_confirm: true,
      user_metadata: { full_name: data.adminFullName ?? data.adminEmail },
    });

    if (userXato || !yaratilgan?.user) {
      await supabaseAdmin.from("clinics").delete().eq("id", klinika.id);
      throw new Error(userXato?.message ?? "Foydalanuvchi yaratilmadi");
    }

    const userId = yaratilgan.user.id;

    try {
      // 4. Profil — trigger profilni ochgan bo'lishi mumkin, shuning uchun upsert
      const { error: profilXato } = await supabaseAdmin.from("profiles").upsert(
        {
          id: userId,
          clinic_id: klinika.id,
          email: data.adminEmail,
          full_name: data.adminFullName ?? data.adminEmail,
        },
        { onConflict: "id" },
      );
      if (profilXato) throw new Error(profilXato.message);

      // 5. Klinika darajasidagi admin roli
      const { error: rolYozishXato } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, clinic_id: klinika.id, role: "admin" });
      if (rolYozishXato) throw new Error(rolYozishXato.message);
    } catch (e) {
      // Orqaga qaytarish
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await supabaseAdmin.from("clinics").delete().eq("id", klinika.id);
      throw e instanceof Error ? e : new Error("Admin biriktirishda xatolik");
    }

    return {
      clinicId: klinika.id,
      clinicName: klinika.name,
      adminUserId: userId,
      adminEmail: data.adminEmail,
    };
  });
