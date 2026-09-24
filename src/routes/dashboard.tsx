import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useProfil, useSession } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Boshqaruv paneli - Soliha Shifoxonasi" },
      {
        name: "description",
        content: "Klinika boshqaruv paneli: bemorlar, palatalar, shifokorlar va to'lovlar.",
      },
      { property: "og:title", content: "Boshqaruv paneli - Soliha Shifoxonasi" },
      {
        property: "og:description",
        content: "Klinikangiz ish jarayonini bitta oynadan kuzating.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const navigate = useNavigate();
  const { session, tayyor } = useSession();
  const { data: profil } = useProfil(session?.user.id);

  useEffect(() => {
    if (tayyor && !session) navigate({ to: "/" });
  }, [tayyor, session, navigate]);

  if (!tayyor || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  async function chiqish() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar
          rollar={profil?.rollar ?? []}
          fullName={profil?.fullName ?? null}
          email={session.user.email ?? null}
          onChiqish={chiqish}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur">
            <SidebarTrigger className="rounded-xl" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                {profil?.clinicName ?? "Klinika tanlanmagan"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {profil?.fullName ?? session.user.email}
              </p>
            </div>
          </header>

          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
