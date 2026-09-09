import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BedDouble } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/palatalar")({
  head: () => ({
    meta: [
      { title: "Palatalar — Soliha Shifoxonasi" },
      { name: "description", content: "Palatalar holati, joylar soni va kunlik narxi." },
      { property: "og:title", content: "Palatalar — Soliha Shifoxonasi" },
      { property: "og:description", content: "Bo'sh va band palatalarni boshqaring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PalatalarSahifa,
});

type Palata = {
  id: string;
  number: string;
  room_type: string | null;
  bed_count: number;
  price_per_day: number;
  status: "bosh" | "band" | "tamirda";
};

function turRangi(tur: string | null) {
  if (tur === "Lyuks") return "bg-primary/10 text-primary border-primary/20";
  if (tur === "Pul-lyuks") return "bg-accent/10 text-accent-foreground border-accent/30";
  return "bg-muted text-muted-foreground border-border";
}

function pul(v: number) {
  return new Intl.NumberFormat("uz-UZ").format(v);
}

function PalatalarSahifa() {
  const palatalar = useQuery({
    queryKey: ["palatalar"],
    queryFn: async () => {
      const [rooms, band] = await Promise.all([
        supabase
          .from("rooms")
          .select("id, number, room_type, bed_count, price_per_day, status")
          .order("number"),
        supabase.from("patients").select("room_id").eq("status", "yotoqda"),
      ]);
      if (rooms.error) throw rooms.error;
      if (band.error) throw band.error;

      const sanoq = new Map<string, number>();
      for (const p of band.data ?? []) {
        if (p.room_id) sanoq.set(p.room_id, (sanoq.get(p.room_id) ?? 0) + 1);
      }
      return ((rooms.data ?? []) as Palata[]).map((r) => ({
        ...r,
        band: sanoq.get(r.id) ?? 0,
      }));
    },
  });

  const qavatlar = useMemo(() => {
    const guruh = new Map<number, (Palata & { band: number })[]>();
    for (const r of palatalar.data ?? []) {
      const q = Number(r.number.slice(0, 1)) || 1;
      guruh.set(q, [...(guruh.get(q) ?? []), r]);
    }
    return [...guruh.entries()].sort((a, b) => a[0] - b[0]);
  }, [palatalar.data]);

  const jami = palatalar.data ?? [];
  const jamiOrin = jami.reduce((s, r) => s + r.bed_count, 0);
  const jamiBand = jami.reduce((s, r) => s + r.band, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Palatalar</h1>
          <p className="text-sm text-muted-foreground">
            Jami {jami.length} palata · {jamiBand}/{jamiOrin} o'rin band
          </p>
        </div>
      </div>

      {palatalar.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : jami.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Palatalar topilmadi.
        </div>
      ) : (
        qavatlar.map(([qavat, xonalar]) => (
          <section key={qavat} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{qavat}-qavat</h2>
              <Badge variant="secondary" className="rounded-lg">
                {xonalar.length} xona
              </Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {xonalar.map((r) => {
                const bosh = r.bed_count - r.band;
                return (
                  <Card
                    key={r.id}
                    className="rounded-2xl border-border/70 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xl font-semibold tracking-tight">{r.number}</p>
                          <p className="text-xs text-muted-foreground">
                            {pul(r.price_per_day)} so'm / kun
                          </p>
                        </div>
                        <Badge variant="outline" className={`rounded-lg ${turRangi(r.room_type)}`}>
                          {r.room_type ?? "Oddiy"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BedDouble className="size-4" />
                        <span>Sig'imi: {r.bed_count} o'rin</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Band: {r.band}</span>
                        <span className="text-muted-foreground">Bo'sh: {bosh}</span>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(r.band / r.bed_count) * 100}%` }}
                        />
                      </div>

                      <Badge
                        variant={r.status === "bosh" ? "outline" : "default"}
                        className="rounded-lg"
                      >
                        {r.status === "bosh" ? "Bo'sh" : r.status === "band" ? "Band" : "Ta'mirda"}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
