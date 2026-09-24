import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, TrendingUp, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/hisobot")({
  head: () => ({
    meta: [
      { title: "Hisobot - Soliha Shifoxonasi" },
      {
        name: "description",
        content: "Klinikaning kunlik tushum statistikasi va to'lov usullari bo'yicha tahlil.",
      },
      { property: "og:title", content: "Hisobot - Soliha Shifoxonasi" },
      { property: "og:description", content: "Oxirgi 7 kunlik tushum dinamikasi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HisobotSahifa,
});

type TolovQator = { amount: number | string; method: "naqd" | "karta" | "otkazma"; paid_at: string };

const USUL_LABEL: Record<TolovQator["method"], string> = {
  naqd: "Naqd",
  karta: "Karta",
  otkazma: "O'tkazma",
};

const somFormat = new Intl.NumberFormat("uz-UZ");

function pul(n: number) {
  return `${somFormat.format(n)} so'm`;
}

function bugunBoshi() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function oxirgi7Kun() {
  const bosh = bugunBoshi();
  bosh.setDate(bosh.getDate() - 6);
  return bosh;
}

function kunKalit(d: Date) {
  return d.toISOString().slice(0, 10);
}

const KUN_QISQA = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

function useHisobot() {
  return useQuery({
    queryKey: ["hisobot-tolovlar"],
    queryFn: async () => {
      const boshlanish = oxirgi7Kun();
      const { data, error } = await supabase
        .from("payments")
        .select("amount, method, paid_at")
        .gte("paid_at", boshlanish.toISOString())
        .order("paid_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TolovQator[];
    },
  });
}

function HisobotSahifa() {
  const { data, isLoading } = useHisobot();

  const bugun = useMemo(() => {
    const boshi = bugunBoshi();
    return (data ?? []).filter((t) => new Date(t.paid_at) >= boshi);
  }, [data]);

  const jamiTushum = useMemo(
    () => bugun.reduce((s, t) => s + Number(t.amount), 0),
    [bugun],
  );
  const tolovlarSoni = bugun.length;
  const ortachaTolov = tolovlarSoni ? Math.round(jamiTushum / tolovlarSoni) : 0;

  const kunlikGrafik = useMemo(() => {
    const boshlanish = oxirgi7Kun();
    const kunlar: { sana: Date; kalit: string; label: string; summa: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(boshlanish);
      d.setDate(d.getDate() + i);
      kunlar.push({
        sana: d,
        kalit: kunKalit(d),
        label: KUN_QISQA[d.getDay()] ?? "",
        summa: 0,
      });
    }
    const xarita = new Map(kunlar.map((k) => [k.kalit, k]));
    for (const t of data ?? []) {
      const kalit = new Date(t.paid_at).toISOString().slice(0, 10);
      const kun = xarita.get(kalit);
      if (kun) kun.summa += Number(t.amount);
    }
    return kunlar;
  }, [data]);

  const usulBoyicha = useMemo(() => {
    const xarita = new Map<TolovQator["method"], { soni: number; summa: number }>([
      ["naqd", { soni: 0, summa: 0 }],
      ["karta", { soni: 0, summa: 0 }],
      ["otkazma", { soni: 0, summa: 0 }],
    ]);
    for (const t of bugun) {
      const joriy = xarita.get(t.method);
      if (joriy) {
        joriy.soni += 1;
        joriy.summa += Number(t.amount);
      }
    }
    return Array.from(xarita.entries()).filter(([, v]) => v.soni > 0);
  }, [bugun]);

  const bugungiSana = new Date().toLocaleDateString("uz-UZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kunlik hisobot</h1>
        <p className="mt-1 text-sm text-muted-foreground">{bugungiSana}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-border shadow-soft">
          <CardContent className="flex items-center gap-4 p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl brand-gradient">
              <Wallet className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Jami tushum</p>
              {isLoading ? (
                <Skeleton className="mt-2 h-8 w-28" />
              ) : (
                <p className="mt-1 text-2xl font-semibold tracking-tight">{pul(jamiTushum)}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border shadow-soft">
          <CardContent className="flex items-center gap-4 p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <CreditCard className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">To'lovlar soni</p>
              {isLoading ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <p className="mt-1 text-2xl font-semibold tracking-tight">{tolovlarSoni}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border shadow-soft">
          <CardContent className="flex items-center gap-4 p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <TrendingUp className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">O'rtacha to'lov</p>
              {isLoading ? (
                <Skeleton className="mt-2 h-8 w-28" />
              ) : (
                <p className="mt-1 text-2xl font-semibold tracking-tight">{pul(ortachaTolov)}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base font-medium">Oxirgi 7 kunlik tushum</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kunlikGrafik} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    className="text-xs fill-muted-foreground"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(v) => somFormat.format(v)}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--accent)" }}
                    formatter={(value: number) => [pul(value), "Tushum"]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                    }}
                  />
                  <Bar dataKey="summa" radius={[8, 8, 0, 0]} fill="var(--primary)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base font-medium">Bugungi to'lov usullari</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : usulBoyicha.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Bugun hali to'lov yo'q.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To'lov usuli</TableHead>
                  <TableHead>Soni</TableHead>
                  <TableHead className="text-right">Jami summa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usulBoyicha.map(([usul, v]) => (
                  <TableRow key={usul}>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-lg">
                        {USUL_LABEL[usul]}
                      </Badge>
                    </TableCell>
                    <TableCell>{v.soni}</TableCell>
                    <TableCell className="text-right font-medium">{pul(v.summa)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
