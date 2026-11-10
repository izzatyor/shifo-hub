import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminKlinikasi, kirishSxema, klinikaSxema, xodimSxema, type XodimYaratKirish } from "./xodimlar.schemas";

const publicRoles = ["admin", "doktor", "qabul", "kassa", "rahbar"] as const;

export const xodimYarat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: XodimYaratKirish) => xodimSxema.parse(input))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "no-store");
    const [profile, roles] = await Promise.all([
      context.supabase.from("profiles").select("clinic_id").eq("id", context.userId).maybeSingle(),
      context.supabase.from("user_roles").select("role, clinic_id").eq("user_id", context.userId),
    ]);
    if (profile.error || roles.error) throw new Error("Ruxsatni tekshirib bo‘lmadi");
    const clinicId = adminKlinikasi(roles.data ?? [], profile.data?.clinic_id ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { xodimniYarat } = await import("./xodimlar.server");
    return xodimniYarat(supabaseAdmin, clinicId, data);
  });

/** Deliberately public: clinic IDs/names only, never full clinic rows. */
export const kirishKlinikalari = createServerFn({ method: "GET" })
  .handler(async () => {
    setResponseHeader("Cache-Control", "no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("clinics").select("id, name").order("name").limit(500);
    if (error) throw new Error("Klinikalar yuklanmadi");
    return data ?? [];
  });

/** Deliberately public staff directory: names and roles are publicly visible. */
export const klinikaXodimlari = createServerFn({ method: "GET" })
  .inputValidator((input: { clinicId: string }) => klinikaSxema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin.from("user_roles")
      .select("user_id, role").eq("clinic_id", data.clinicId).limit(1000);
    if (error) throw new Error("Xodimlar yuklanmadi");
    const hidden = new Set((roles ?? []).filter(row => row.role === "super_admin").map(row => row.user_id));
    const eligible = (roles ?? []).filter(row => publicRoles.some(role => role === row.role) && !hidden.has(row.user_id));
    if (!eligible.length) return [];
    const { data: profiles, error: profileError } = await supabaseAdmin.from("profiles")
      .select("id, full_name").eq("clinic_id", data.clinicId).in("id", eligible.map(row => row.user_id)).order("full_name");
    if (profileError) throw new Error("Xodimlar yuklanmadi");
    return (profiles ?? []).map(profile => ({
      id: profile.id, fullName: profile.full_name,
      roles: eligible.filter(row => row.user_id === profile.id).map(row => row.role),
    }));
  });

export const xodimKirish = createServerFn({ method: "POST" })
  .inputValidator((input: { clinicId: string; xodimId: string; parol: string }) => kirishSxema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "no-store");
    const failure = () => ({ ok: false as const, message: "Kirish amalga oshmadi yoki urinishlar chegarasiga yetildi. Keyinroq urinib ko‘ring." });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin.from("profiles")
      .select("id").eq("id", data.xodimId).eq("clinic_id", data.clinicId).maybeSingle();
    if (error) return failure();
    if (!profile) return failure();
    const { data: roles, error: rolesError } = await supabaseAdmin.from("user_roles")
      .select("role, clinic_id").eq("user_id", profile.id);
    if (rolesError || roles?.some(row => row.role === "super_admin") || !roles?.some(row =>
      row.clinic_id === data.clinicId && publicRoles.some(role => role === row.role))) return failure();
    // Atomic, durable reservation BEFORE checking credentials. Success also counts.
    const { data: allowed, error: limitError } = await supabaseAdmin.rpc("consume_staff_login_attempt", { p_user_id: profile.id });
    if (limitError || !allowed) return failure();
    // Resolve the canonical Auth email, never the user-editable profile email.
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (userError || !authUser.user?.email) return failure();
    const { kirishClient } = await import("./xodimlar.server");
    const { data: signedIn, error: loginError } = await kirishClient().auth.signInWithPassword({
      email: authUser.user.email, password: data.parol,
    });
    if (loginError || !signedIn.session || signedIn.user?.id !== profile.id) return failure();
    // Tokens go only to the successful caller; no email/user metadata in this DTO.
    return { ok: true as const, session: {
      access_token: signedIn.session.access_token,
      refresh_token: signedIn.session.refresh_token,
    } };
  });