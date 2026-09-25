import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, Plus, Printer, Search, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfil, useSession } from "@/hooks/useAuth";
import { useRuxsat } from "@/hooks/useRuxsat";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/tolovlar")({
  head: () => ({
    meta: [
      { title: "To'lovlar - Soliha Shifoxonasi" },
      { name: "description", content: "Bemorlardan qabul qilingan to'lovlar va kassa yozuvlari." },
      { property: "og:title", content: "To'lovlar - Soliha Shifoxonasi" },
      { property: "og:description", content: "Kassa tushumini kuzatib boring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TolovlarSahifa,
});

type Tolov = {
  id: string;
  amount: number;
  method: "naqd" | "karta" | "otkazma";
  purpose: string | null;
  paid_at: string;
  patient_id: string | null;
  patients: {
    full_name: string;
    room_id: string | null;
    rooms: { number: string } | null;
    doctors: { full_name: string } | null;
  } | null;
};

type Bemor = {
  id: string;
  full_name: string;
  room_id: string | null;
  rooms: { number: string; price_per_day: number } | null;
};

const formaSxema = z.object({
  patient_id: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().positive("Summa musbat bo'lishi kerak"),
  method: z.enum(["naqd", "karta", "otkazma"]),
  purpose: z.string().trim().max(200).optional().or(z.literal("")),
});

type Forma = { patient_id: string; amount: string; method: "naqd" | "karta" | "otkazma"; purpose: string };

const bosh: Forma = { patient_id: "", amount: "", method: "naqd", purpose: "" };

function XatoMatni({ xabar }: { xabar?: string | undefined }) {
  if (!xabar) return null;
  return <p className="text-xs font-medium text-destructive">{xabar}</p>;
}

const USUL_LABEL: Record<Tolov["method"], string> = {
  naqd: "Naqd",
  karta: "Karta",
  otkazma: "O'tkazma",
};

function pul(n: number) {
  return n.toLocaleString("uz-UZ") + " so'm";
}

function sanaVaqt(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" });
}

function usulBadge(m: Tolov["method"]) {
  const variant = m === "naqd" ? "default" : m === "karta" ? "secondary" : "outline";
  return (
    <Badge variant={variant as "default" | "secondary" | "outline"} className="rounded-lg">
      {USUL_LABEL[m]}
    </Badge>
  );
}

function kavsCiz(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function kvitansiyaChopEt(t: Tolov, klinikaNomi: string, kassir: string | null) {
  const oyna = window.open("", "_blank", "width=420,height=600");
  if (!oyna) return;
  const bemorIsmi = kavsCiz(t.patients?.full_name ?? "-");
  const izoh = t.purpose ? kavsCiz(t.purpose) : "";
  const palata = t.patients?.rooms?.number ? kavsCiz(t.patients.rooms.number) : "";
  const shifokor = t.patients?.doctors?.full_name ? kavsCiz(t.patients.doctors.full_name) : "";
  const kvitRaqami = t.id.slice(0, 8).toUpperCase();
  const html = `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8" />
<title>Kvitansiya</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sana { color: #666; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  td { padding: 6px 0; font-size: 14px; }
  td:first-child { color: #666; }
  td:last-child { text-align: right; font-weight: 500; }
  .summa { font-size: 22px; font-weight: 700; text-align: center; padding: 16px 0; border-top: 1px dashed #999; border-bottom: 1px dashed #999; margin: 16px 0; }
  .footer { text-align: center; color: #999; font-size: 11px; margin-top: 24px; }
  .chop-tugma { display: block; width: 100%; margin-top: 16px; padding: 10px; border: none; border-radius: 8px; background: #111; color: #fff; font-size: 14px; cursor: pointer; }
  @media print { .chop-tugma { display: none; } }
</style>
</head>
<body>
  <h1>${kavsCiz(klinikaNomi)}</h1>
  <div class="sana">Kvitansiya No ${kvitRaqami} | ${sanaVaqt(t.paid_at)}</div>
  <table>
    <tr><td>Bemor</td><td>${bemorIsmi}</td></tr>
    ${palata ? `<tr><td>Palata</td><td>${palata}</td></tr>` : ""}
    ${shifokor ? `<tr><td>Shifokor</td><td>${shifokor}</td></tr>` : ""}
    <tr><td>To'lov turi</td><td>${USUL_LABEL[t.method]}</td></tr>
    ${izoh ? `<tr><td>Izoh</td><td>${izoh}</td></tr>` : ""}
    ${kassir ? `<tr><td>Qabul qildi</td><td>${kavsCiz(kassir)}</td></tr>` : ""}
  </table>
  <div class="summa">${pul(Number(t.amount))}</div>
  <div class="footer">Ushbu hujjat to'lov tasdig'i sifatida chop etildi</div>
  <button class="chop-tugma" onclick="window.print()">Chop etish</button>
</body>
</html>`;
  oyna.document.write(html);
  oyna.document.close();
}

function TolovlarSahifa() {
  const qc = useQueryClient();
  const { session } = useSession();
  const { data: profil } = useProfil(session?.user.id);
  const clinicId = profil?.clinicId ?? null;
  const { faqatKorish } = useRuxsat(profil?.rollar ?? []);

  const [qidiruv, setQidiruv] = useState("");
  const [filtr, setFiltr] = useState<"bugun" | "hafta" | "barchasi">("bugun");
  const [ochiq, setOchiq] = useState(false);
  const [forma, setForma] = useState<Forma>(bosh);
  const [ochirish, setOchirish] = useState<Tolov | null>(null);
  const [xatolar, setXatolar] = useState<Record<string, string>>({});

  const bemorlar = useQuery({
    queryKey: ["bemorlar-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name, room_id, rooms ( number, price_per_day )")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Bemor[];
    },
  });

  const tolovlar = useQuery({
    queryKey: ["tolovlar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, amount, method, purpose, paid_at, patient_id, patients ( full_name, room_id, rooms ( number ), doctors ( full_name ) )",
        )
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Tolov[];
    },
  });

  const saqlash = useMutation({
    mutationFn: async (v: Forma) => {
      const parsed = formaSxema.parse(v);
      if (!clinicId) throw new Error("Klinika aniqlanmadi");
      const { error } = await supabase.from("payments").insert({
        clinic_id: clinicId,
        patient_id: parsed.patient_id || null,
        amount: parsed.amount,
        method: parsed.method,
        purpose: parsed.purpose || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("To'lov qabul qilindi");
      setOchiq(false);
      setForma(bosh);
      setXatolar({});
      qc.invalidateQueries({ queryKey: ["tolovlar"] });
      qc.invalidateQueries({ queryKey: ["dashboard-statistika"] });
    },
    onError: (e: unknown) => {
      if (e instanceof z.ZodError) {
        const yangiXatolar: Record<string, string> = {};
        for (const issue of e.issues) {
          const maydon = String(issue.path[0]);
          if (!yangiXatolar[maydon]) yangiXatolar[maydon] = issue.message;
        }
        setXatolar(yangiXatolar);
        toast.error("Iltimos, formadagi xatolarni to'g'rilang");
        return;
      }
      toast.error((e as Error).message ?? "Xatolik yuz berdi");
    },
  });

  const ochirishMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("To'lov o'chirildi");
      setOchirish(null);
      qc.invalidateQueries({ queryKey: ["tolovlar"] });
      qc.invalidateQueries({ queryKey: ["dashboard-statistika"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const royxat = useMemo(() => {
    const hammasi = tolovlar.data ?? [];
    const now = new Date();
    const bugunBoshi = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const haftaBoshi = new Date(bugunBoshi);
    haftaBoshi.setDate(haftaBoshi.getDate() - ((haftaBoshi.getDay() + 6) % 7));

    let filtrlangan = hammasi;
    if (filtr === "bugun") {
      filtrlangan = hammasi.filter((t) => new Date(t.paid_at) >= bugunBoshi);
    } else if (filtr === "hafta") {
      filtrlangan = hammasi.filter((t) => new Date(t.paid_at) >= haftaBoshi);
    }

    const q = qidiruv.trim().toLowerCase();
    if (!q) return filtrlangan;
    return filtrlangan.filter(
      (t) =>
        (t.patients?.full_name ?? "").toLowerCase().includes(q) ||
        (t.purpose ?? "").toLowerCase().includes(q),
    );
  }, [tolovlar.data, qidiruv, filtr]);

  const jami = useMemo(() => royxat.reduce((s, t) => s + Number(t.amount), 0), [royxat]);
  const soni = royxat.length;
  const orta = soni ? Math.round(jami / soni) : 0;

  function yangiOch() {
    setForma(bosh);
    setXatolar({});
    setOchiq(true);
  }

  function maydonXato(nomi: string) {
    return xatolar[nomi];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">To'lovlar</h1>
          <p className="text-sm text-muted-foreground">
            Bemorlardan qabul qilingan to'lovlar va kassa yozuvlari.
          </p>
        </div>
        {!faqatKorish && (
          <Button className="rounded-xl" onClick={yangiOch}>
            <Plus className="size-4" /> To'lov qabul
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl brand-gradient">
              <Wallet className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Jami tushum</p>
              <p className="text-lg font-semibold">{pul(jami)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <CreditCard className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">To'lovlar soni</p>
              <p className="text-lg font-semibold">{soni}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="flex items-center gap-3 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <Wallet className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">O'rtacha to'lov</p>
              <p className="text-lg font-semibold">{pul(orta)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qidiruv}
            onChange={(e) => setQidiruv(e.target.value)}
            placeholder="Bemor ismi yoki izoh bo'yicha qidirish"
            className="rounded-xl pl-9"
          />
        </div>
        <div className="flex overflow-hidden rounded-xl border border-border">
          {(["bugun", "hafta", "barchasi"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltr(f)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filtr === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f === "bugun" ? "Bugun" : f === "hafta" ? "Bu hafta" : "Barchasi"}
            </button>
          ))}
        </div>
      </div>

      {tolovlar.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : royxat.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Bu davrda to'lov yo'q.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bemor</TableHead>
                <TableHead>Summa</TableHead>
                <TableHead>Usul</TableHead>
                <TableHead>Izoh</TableHead>
                <TableHead>Sana</TableHead>
                <TableHead className="text-right">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {royxat.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.patients?.full_name ?? "-"}</TableCell>
                  <TableCell className="font-medium text-primary">{pul(Number(t.amount))}</TableCell>
                  <TableCell>{usulBadge(t.method)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {t.purpose ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{sanaVaqt(t.paid_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-lg"
                        aria-label="Kvitansiya chop etish"
                        onClick={() =>
                          kvitansiyaChopEt(t, profil?.clinicName ?? "Klinika", profil?.fullName ?? null)
                        }
                      >
                        <Printer className="size-4" />
                      </Button>
                      {!faqatKorish && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-lg text-destructive"
                          aria-label="O'chirish"
                          onClick={() => setOchirish(t)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={ochiq} onOpenChange={setOchiq}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>To'lov qabul qilish</DialogTitle>
            <DialogDescription>To'lov ma'lumotlarini to'ldiring.</DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              saqlash.mutate(forma);
            }}
          >
            <div className="space-y-2">
              <Label>Bemor</Label>
              <Select
                value={forma.patient_id}
                onValueChange={(v) => setForma({ ...forma, patient_id: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Tanlang (ixtiyoriy)" />
                </SelectTrigger>
                <SelectContent>
                  {(bemorlar.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="t-summa">Summa (so'm)</Label>
              {(() => {
                const tanlanganBemor = (bemorlar.data ?? []).find((b) => b.id === forma.patient_id);
                return tanlanganBemor?.rooms ? (
                  <button
                    type="button"
                    className="block text-xs text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setForma({ ...forma, amount: String(tanlanganBemor.rooms!.price_per_day) })
                    }
                  >
                    Palata {tanlanganBemor.rooms.number} narxi: {pul(tanlanganBemor.rooms.price_per_day)} so'm/kun (bosing)
                  </button>
                ) : null;
              })()}
              <Input
                id="t-summa"
                type="number"
                required
                min={1}
                className={cn(
                  "rounded-xl",
                  maydonXato("amount") && "border-destructive focus-visible:ring-destructive",
                )}
                placeholder="150000"
                value={forma.amount}
                onChange={(e) => {
                  setForma({ ...forma, amount: e.target.value });
                  if (xatolar["amount"]) setXatolar({ ...xatolar, amount: "" });
                }}
              />
              <XatoMatni xabar={maydonXato("amount")} />
            </div>

            <div className="space-y-2">
              <Label>To'lov usuli</Label>
              <Select
                value={forma.method}
                onValueChange={(v) => setForma({ ...forma, method: v as Forma["method"] })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="naqd">Naqd</SelectItem>
                  <SelectItem value="karta">Karta</SelectItem>
                  <SelectItem value="otkazma">O'tkazma</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="t-izoh">Izoh (ixtiyoriy)</Label>
              <Input
                id="t-izoh"
                maxLength={200}
                className="rounded-xl"
                placeholder="Masalan: konsultatsiya, dori, protsedura..."
                value={forma.purpose}
                onChange={(e) => setForma({ ...forma, purpose: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setOchiq(false);
                  setXatolar({});
                }}
              >
                Bekor qilish
              </Button>
              <Button type="submit" className="rounded-xl" disabled={saqlash.isPending}>
                {saqlash.isPending && <Loader2 className="size-4 animate-spin" />}
                Qabul qilish
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!ochirish} onOpenChange={(o) => !o && setOchirish(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>To'lovni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              {ochirish && pul(Number(ochirish.amount))} to'lov butunlay o'chiriladi. Bu amalni ortga
              qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => ochirish && ochirishMut.mutate(ochirish.id)}
            >
              {ochirishMut.isPending && <Loader2 className="size-4 animate-spin" />}
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
