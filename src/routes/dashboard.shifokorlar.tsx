import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Phone, Plus, Search, Stethoscope, Trash2, Users } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/shifokorlar")({
  head: () => ({
    meta: [
      { title: "Shifokorlar — Soliha Shifoxonasi" },
      { name: "description", content: "Klinika shifokorlari, mutaxassisligi va faol bemorlari." },
      { property: "og:title", content: "Shifokorlar — Soliha Shifoxonasi" },
      { property: "og:description", content: "Shifokorlar ro'yxatini boshqaring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShifokorlarSahifa,
});

type Shifokor = {
  id: string;
  full_name: string;
  specialty: string | null;
  phone: string | null;
  cabinet: string | null;
  is_active: boolean;
};

const MUTAXASSISLIKLAR = [
  "Terapevt",
  "Xirurg",
  "Kardiolog",
  "Nevrolog",
  "Ortoped",
  "Ginekolog",
  "Pediatr",
  "Urolog",
  "Boshqa",
];

const formaSxema = z.object({
  full_name: z.string().trim().min(2, "Ism kamida 2 ta belgidan iborat bo'lsin").max(100),
  specialty: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

type Forma = { full_name: string; specialty: string; phone: string };

const bosh: Forma = { full_name: "", specialty: "", phone: "" };

function ShifokorlarSahifa() {
  const qc = useQueryClient();
  const { session } = useSession();
  const { data: profil } = useProfil(session?.user.id);
  const clinicId = profil?.clinicId ?? null;

  const [qidiruv, setQidiruv] = useState("");
  const [ochiq, setOchiq] = useState(false);
  const [forma, setForma] = useState<Forma>(bosh);
  const [tahrirId, setTahrirId] = useState<string | null>(null);
  const [ochirish, setOchirish] = useState<Shifokor | null>(null);

  const shifokorlar = useQuery({
    queryKey: ["shifokorlar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, full_name, specialty, phone, cabinet, is_active")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Shifokor[];
    },
  });

  const faolBemorlar = useQuery({
    queryKey: ["shifokor-bemor-soni"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("doctor_id")
        .in("status", ["yotoqda", "ambulator"]);
      if (error) throw error;
      const soni = new Map<string, number>();
      for (const p of data ?? []) {
        if (!p.doctor_id) continue;
        soni.set(p.doctor_id, (soni.get(p.doctor_id) ?? 0) + 1);
      }
      return soni;
    },
  });

  const saqlash = useMutation({
    mutationFn: async (v: Forma) => {
      const parsed = formaSxema.parse(v);
      if (!clinicId) throw new Error("Klinika aniqlanmadi");
      const yozuv = {
        clinic_id: clinicId,
        full_name: parsed.full_name,
        specialty: parsed.specialty || null,
        phone: parsed.phone || null,
      };
      if (tahrirId) {
        const { error } = await supabase.from("doctors").update(yozuv).eq("id", tahrirId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("doctors").insert(yozuv);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(tahrirId ? "Shifokor yangilandi" : "Yangi shifokor qo'shildi");
      setOchiq(false);
      setForma(bosh);
      setTahrirId(null);
      qc.invalidateQueries({ queryKey: ["shifokorlar"] });
      qc.invalidateQueries({ queryKey: ["shifokorlar-select"] });
      qc.invalidateQueries({ queryKey: ["dashboard-statistika"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message;
      toast.error(msg ?? "Xatolik yuz berdi");
    },
  });

  const ochirishMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("doctors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shifokor o'chirildi");
      setOchirish(null);
      qc.invalidateQueries({ queryKey: ["shifokorlar"] });
      qc.invalidateQueries({ queryKey: ["shifokorlar-select"] });
      qc.invalidateQueries({ queryKey: ["dashboard-statistika"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("foreign key")
          ? "Bu shifokorga bemorlar biriktirilgan — avval ularni boshqa shifokorga o'tkazing"
          : e.message,
      ),
  });

  const royxat = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    const hammasi = shifokorlar.data ?? [];
    if (!q) return hammasi;
    return hammasi.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.specialty ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q),
    );
  }, [shifokorlar.data, qidiruv]);

  function yangiOch() {
    setTahrirId(null);
    setForma(bosh);
    setOchiq(true);
  }

  function tahrirOch(s: Shifokor) {
    setTahrirId(s.id);
    setForma({ full_name: s.full_name, specialty: s.specialty ?? "", phone: s.phone ?? "" });
    setOchiq(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shifokorlar</h1>
          <p className="text-sm text-muted-foreground">
            Klinika shifokorlari, mutaxassisliklari va faol bemorlari.
          </p>
        </div>
        <Button className="rounded-xl" onClick={yangiOch}>
          <Plus className="size-4" /> Yangi shifokor
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
          placeholder="Ism, mutaxassislik yoki telefon bo'yicha qidirish"
          className="rounded-xl pl-9"
        />
      </div>

      {shifokorlar.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : royxat.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Shifokorlar topilmadi. "Yangi shifokor" tugmasi orqali qo'shing.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {royxat.map((s) => {
            const bemorSoni = faolBemorlar.data?.get(s.id) ?? 0;
            return (
              <Card key={s.id} className="rounded-2xl border-border/70 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl brand-gradient">
                        <Stethoscope className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">{s.full_name}</p>
                        <Badge variant="secondary" className="mt-1 rounded-lg">
                          {s.specialty ?? "Boshqa"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-lg"
                        aria-label="Tahrirlash"
                        onClick={() => tahrirOch(s)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-lg text-destructive"
                        aria-label="O'chirish"
                        onClick={() => setOchirish(s)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="size-3.5" />
                      {s.phone ?? "—"}
                    </span>
                    <span className="flex items-center gap-2 font-medium">
                      <Users className="size-3.5 text-muted-foreground" />
                      {bemorSoni} bemor
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={ochiq} onOpenChange={setOchiq}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tahrirId ? "Shifokorni tahrirlash" : "Yangi shifokor"}</DialogTitle>
            <DialogDescription>Shifokor ma'lumotlarini to'ldiring.</DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              saqlash.mutate(forma);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="s-ism">Ism familiya</Label>
              <Input
                id="s-ism"
                required
                maxLength={100}
                className="rounded-xl"
                value={forma.full_name}
                onChange={(e) => setForma({ ...forma, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Mutaxassislik</Label>
              <Select
                value={forma.specialty}
                onValueChange={(v) => setForma({ ...forma, specialty: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {MUTAXASSISLIKLAR.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="s-tel">Telefon</Label>
              <Input
                id="s-tel"
                maxLength={30}
                className="rounded-xl"
                placeholder="+998 90 000 00 00"
                value={forma.phone}
                onChange={(e) => setForma({ ...forma, phone: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setOchiq(false)}
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
            <AlertDialogTitle>Shifokorni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>
              {ochirish?.full_name} butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.
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
