import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useProfil, useSession } from "@/hooks/useAuth";
import { useRuxsat } from "@/hooks/useRuxsat";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/palatalar")({
  head: () => ({
    meta: [
      { title: "Palatalar вЂ” Soliha Shifoxonasi" },
      { name: "description", content: "Palatalar holati, joylar soni va kunlik narxi." },
      { property: "og:title", content: "Palatalar вЂ” Soliha Shifoxonasi" },
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

const XONA_TURLARI = ["Oddiy", "Lyuks", "Pul-lyuks", "Boshqa"];

const HOLAT_LABEL: Record<Palata["status"], string> = {
  bosh: "Bo'sh",
  band: "Band",
  tamirda: "Ta'mirda",
};

function turRangi(tur: string | null) {
  if (tur === "Lyuks") return "bg-primary/10 text-primary border-primary/20";
  if (tur === "Pul-lyuks") return "bg-accent/10 text-accent-foreground border-accent/30";
  return "bg-muted text-muted-foreground border-border";
}

function pul(v: number) {
  return new Intl.NumberFormat("uz-UZ").format(v);
}

const formaSxema = z.object({
  number: z.string().trim().min(1, "Xona raqami kiritilishi shart").max(10, "Xona raqami juda uzun"),
  room_type: z.string().trim().min(1, "Xona turi tanlanishi shart"),
  bed_count: z.coerce.number().int("Butun son bo'lishi kerak").positive("Sig'imi kamida 1 bo'lishi kerak"),
  price_per_day: z.coerce.number().positive("Narx musbat bo'lishi kerak"),
  status: z.enum(["bosh", "band", "tamirda"], { message: "Holat tanlanishi shart" }),
});

type Forma = {
  number: string;
  room_type: string;
  bed_count: string;
  price_per_day: string;
  status: Palata["status"];
};

const bosh: Forma = { number: "", room_type: "Oddiy", bed_count: "1", price_per_day: "", status: "bosh" };

function XatoMatni({ xabar }: { xabar?: string | undefined }) {
  if (!xabar) return null;
  return <p className="text-xs font-medium text-destructive">{xabar}</p>;
}

function PalatalarSahifa() {
  const qc = useQueryClient();
  const { session } = useSession();
  const { data: profil } = useProfil(session?.user.id);
  const clinicId = profil?.clinicId ?? null;
  const { faqatKorish } = useRuxsat(profil?.rollar ?? []);

  const [ochiq, setOchiq] = useState(false);
  const [forma, setForma] = useState<Forma>(bosh);
  const [tahrirId, setTahrirId] = useState<string | null>(null);
  const [ochirish, setOchirish] = useState<(Palata & { band: number }) | null>(null);
  const [xatolar, setXatolar] = useState<Record<string, string>>({});

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

  const saqlash = useMutation({
    mutationFn: async (v: Forma) => {
      const parsed = formaSxema.parse(v);
      if (!clinicId) throw new Error("Klinika aniqlanmadi");
      const yozuv = {
        clinic_id: clinicId,
        number: parsed.number,
        room_type: parsed.room_type,
        bed_count: parsed.bed_count,
        price_per_day: parsed.price_per_day,
        status: parsed.status,
      };
      if (tahrirId) {
        const { error } = await supabase.from("rooms").update(yozuv).eq("id", tahrirId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rooms").insert(yozuv);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(tahrirId ? "Palata yangilandi" : "Yangi palata qo'shildi");
      setOchiq(false);
      setForma(bosh);
      setTahrirId(null);
      setXatolar({});
      qc.invalidateQueries({ queryKey: ["palatalar"] });
      qc.invalidateQueries({ queryKey: ["palatalar-select"] });
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
      const msg = (e as Error).message ?? "Xatolik yuz berdi";
      toast.error(
        msg.includes("duplicate") || msg.includes("unique")
          ? "Bu raqamli xona allaqachon mavjud"
          : msg,
      );
    },
  });

  const ochirishMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Palata o'chirildi");
      setOchirish(null);
      qc.invalidateQueries({ queryKey: ["palatalar"] });
      qc.invalidateQueries({ queryKey: ["palatalar-select"] });
      qc.invalidateQueries({ queryKey: ["dashboard-statistika"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("foreign key")
          ? "Bu palatada bemorlar joylashtirilgan вЂ” avval ularni ko'chiring"
          : e.message,
      ),
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

  function maydonXato(nomi: string) {
    return xatolar[nomi];
  }

  function yangiOch() {
    setTahrirId(null);
    setForma(bosh);
    setXatolar({});
    setOchiq(true);
  }

  function tahrirOch(r: Palata) {
    setTahrirId(r.id);
    setForma({
      number: r.number,
      room_type: r.room_type ?? "Oddiy",
      bed_count: String(r.bed_count),
      price_per_day: String(r.price_per_day),
      status: r.status,
    });
    setXatolar({});
    setOchiq(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Palatalar</h1>
          <p className="text-sm text-muted-foreground">
            Jami {jami.length} palata В· {jamiBand}/{jamiOrin} o'rin band
          </p>
        </div>
        {!faqatKorish && (
          <Button className="rounded-xl" onClick={yangiOch}>
            <Plus className="size-4" /> Yangi palata
          </Button>
        )}
      </div>

      {palatalar.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : jami.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Palatalar topilmadi. "Yangi palata" tugmasi orqali qo'shing.
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
                const boshOrin = r.bed_count - r.band;
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
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge variant="outline" className={`rounded-lg ${turRangi(r.room_type)}`}>
                            {r.room_type ?? "Oddiy"}
                          </Badge>
                          {!faqatKorish && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="rounded-lg"
                                aria-label="Tahrirlash"
                                onClick={() => tahrirOch(r)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="rounded-lg text-destructive"
                                aria-label="O'chirish"
                                onClick={() => setOchirish(r)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BedDouble className="size-4" />
                        <span>Sig'imi: {r.bed_count} o'rin</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Band: {r.band}</span>
                        <span className="text-muted-foreground">Bo'sh: {boshOrin}</span>
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
                        {HOLAT_LABEL[r.status]}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))
      )}

      <Dialog open={ochiq} onOpenChange={setOchiq}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tahrirId ? "Palatani tahrirlash" : "Yangi palata"}</DialogTitle>
            <DialogDescription>Palata ma'lumotlarini to'ldiring.</DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              saqlash.mutate(forma);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="p-raqam">Xona raqami</Label>
              <Input
                id="p-raqam"
                required
                maxLength={10}
                className={cn(
                  "rounded-xl",
                  maydonXato("number") && "border-destructive focus-visible:ring-destructive",
                )}
                placeholder="masalan: 205"
                value={forma.number}
                onChange={(e) => {
                  setForma({ ...forma, number: e.target.value });
                  if (xatolar["number"]) setXatolar({ ...xatolar, number: "" });
                }}
              />
              <XatoMatni xabar={maydonXato("number")} />
            </div>

            <div className="space-y-2">
              <Label>Xona turi</Label>
              <Select
                value={forma.room_type}
                onValueChange={(v) => {
                  setForma({ ...forma, room_type: v });
                  if (xatolar["room_type"]) setXatolar({ ...xatolar, room_type: "" });
                }}
              >
                <SelectTrigger
                  className={cn("rounded-xl", maydonXato("room_type") && "border-destructive")}
                >
                  <SelectValue placeholder="Tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {XONA_TURLARI.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <XatoMatni xabar={maydonXato("room_type")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p-sigim">Sig'imi (o'rin)</Label>
                <Input
                  id="p-sigim"
                  type="number"
                  required
                  min={1}
                  className={cn(
                    "rounded-xl",
                    maydonXato("bed_count") && "border-destructive focus-visible:ring-destructive",
                  )}
                  value={forma.bed_count}
                  onChange={(e) => {
                    setForma({ ...forma, bed_count: e.target.value });
                    if (xatolar["bed_count"]) setXatolar({ ...xatolar, bed_count: "" });
                  }}
                />
                <XatoMatni xabar={maydonXato("bed_count")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-narx">Narxi (so'm/kun)</Label>
                <Input
                  id="p-narx"
                  type="number"
                  required
                  min={1}
                  className={cn(
                    "rounded-xl",
                    maydonXato("price_per_day") && "border-destructive focus-visible:ring-destructive",
                  )}
                  placeholder="500000"
                  value={forma.price_per_day}
                  onChange={(e) => {
                    setForma({ ...forma, price_per_day: e.target.value });
                    if (xatolar["price_per_day"]) setXatolar({ ...xatolar, price_per_day: "" });
                  }}
                />
                <XatoMatni xabar={maydonXato("price_per_day")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Holat</Label>
              <Select
                value={forma.status}
                onValueChange={(v) => setForma({ ...forma, status: v as Palata["status"] })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bosh">Bo'sh</SelectItem>
                  <SelectItem value="band">Band</SelectItem>
                  <SelectItem value="tamirda">Ta'mirda</SelectItem>
                </SelectContent>
              </Select>
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
                Saqlash
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!ochirish} onOpenChange={(o) => !o && setOchirish(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Palatani o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              {ochirish?.number}-xona butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.
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
