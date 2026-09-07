import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, Stethoscope, Users, Wallet } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Bosh sahifa — Soliha Shifoxonasi" },
      {
        name: "description",
        content: "Klinika statistikasi: bemorlar, shifokorlar, bugungi tushum va bo'sh palatalar.",
      },
      { property: "og:title", content: "Bosh sahifa — Soliha Shifoxonasi" },
      { property: "og:description", content: "Klinikangiz bugungi ko'rsatkichlari bir joyda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardHome,
});

function bugunBoshi() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function useStatistika() {
  return useQuery({
    queryKey: ["dashboard-statistika"],
    queryFn: async () => {
      const [bemorlar, shifokorlar, palatalar, tolovlar] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase
          .from("doctors")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("rooms")
          .select("id", { count: "exact", head: true })
          .eq("status", "bosh"),
        supabase.from("payments").select("amount").gte("paid_at", bugunBoshi()),
      ]);

      const tushum = (tolovlar.data ?? []).reduce(
        (s, t) => s + Number((t as { amount: number | string }).amount ?? 0),
        0,
      );

      return {
        bemorlar: bemorlar.count ?? 0,
        shifokorlar: shifokorlar.count ?? 0,
        boshPalatalar: palatalar.count ?? 0,
        tushum,
      };
    },
  });
}

const somFormat = new Intl.NumberFormat("uz-UZ");

function StatKarta({
  sarlavha,
  qiymat,
  izoh,
  Icon,
  yuklanmoqda,
}: {
  sarlavha: string;
  qiymat: string;
  izoh: string;
  Icon: typeof Users;
  yuklanmoqda: boolean;
}) {
  return (
    <Card className="rounded-2xl border-border shadow-soft transition-shadow hover:shadow-lift">
      <CardContent className="flex items-start gap-4 p-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{sarlavha}</p>
          {yuklanmoqda ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-1 text-3xl font-semibold tracking-tight">{qiymat}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{izoh}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardHome() {
  const { data, isLoading } = useStatistika();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bosh sahifa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Klinikangizning bugungi asosiy ko'rsatkichlari.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatKarta
          sarlavha="Jami bemorlar"
          qiymat={somFormat.format(data?.bemorlar ?? 0)}
          izoh="Ro'yxatdagi barcha bemorlar"
          Icon={Users}
          yuklanmoqda={isLoading}
        />
        <StatKarta
          sarlavha="Faol shifokorlar"
          qiymat={somFormat.format(data?.shifokorlar ?? 0)}
          izoh="Hozirda ishlayotgan shifokorlar"
          Icon={Stethoscope}
          yuklanmoqda={isLoading}
        />
        <StatKarta
          sarlavha="Bugungi tushum"
          qiymat={`${somFormat.format(data?.tushum ?? 0)} so'm`}
          izoh="Bugun qabul qilingan to'lovlar"
          Icon={Wallet}
          yuklanmoqda={isLoading}
        />
        <StatKarta
          sarlavha="Bo'sh palatalar"
          qiymat={somFormat.format(data?.boshPalatalar ?? 0)}
          izoh="Bemor joylashtirish mumkin"
          Icon={BedDouble}
          yuklanmoqda={isLoading}
        />
      </div>

      <Card className="rounded-2xl border-dashed border-border">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Bemorlar, palatalar, shifokorlar va to'lovlar bo'limlari keyingi bosqichda to'ldiriladi.
        </CardContent>
      </Card>
    </div>
  );
}
