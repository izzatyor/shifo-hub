import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Rol = "super_admin" | "admin" | "doktor" | "qabul" | "kassa" | "rahbar";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [tayyor, setTayyor] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setTayyor(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setTayyor(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, tayyor };
}

export function useProfil(userId: string | undefined) {
  return useQuery({
    queryKey: ["profil", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profil, rollar] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, clinic_id, clinics(name)")
          .eq("id", userId!)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);

      return {
        fullName: (profil.data?.full_name as string | null) ?? null,
        clinicId: (profil.data?.clinic_id as string | null) ?? null,
        clinicName:
          ((profil.data as { clinics?: { name?: string } } | null)?.clinics?.name as
            | string
            | undefined) ?? null,
        rollar: (rollar.data ?? []).map((r) => r.role as Rol),
      };
    },
  });
}
