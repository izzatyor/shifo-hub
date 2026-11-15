import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const cleanStaffVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userIds: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { data: permitted } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!permitted) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const id of data.userIds) {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(id);
      if (!user.user?.email?.startsWith("staff-verification-") || !user.user.email.endsWith("@example.test")) throw new Error("Not a verification account");
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) throw new Error("Cleanup failed");
    }
    return { cleaned: data.userIds.length };
  });