import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/bemorlar")({
  head: () => ({
    meta: [
      { title: "Bemorlar — Soliha Shifoxonasi" },
      { name: "description", content: "Klinika bemorlari ro'yxati, qidiruv va yangi bemor qo'shish." },
      { property: "og:title", content: "Bemorlar — Soliha Shifoxonasi" },
      { property: "og:description", content: "Bemorlarni qidiring, qo'shing va kuzating." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BemorlarSahifa,
});

type Bemor = {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  gender: string | null;
  status: "yotoqda" | "ambulator" | "chiqarilgan";
  diagnosis: string | null;
  address: string | null;
  room_id: string | null;
  doctor_id: string | null;
  rooms: { number: string } | null;
  doctors: { full_name: string } | null;
};

const formaSxema = z.object({
  full_name: z.string().trim().min(2, "Ism kamida 2 ta belgidan iborat bo'lsin").max(100),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  birth_date: z.string().trim().max(20).optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  room_id: z.string().optional().or(z.literal("")),
  doctor_id: z.string().optional().or(z.literal("")),
  status: z.enum(["yotoqda", "ambulator"]),
});

type Forma = {
  full_name: string;
  phone: string;
  birth_date: string;
  gender: string;
  room_id: string;
  doctor_id: string;
  status: "yotoqda" | "ambulator";
};

const bosh: Forma = {
  full_name: "",
  phone: "",
  birth_date: "",
  gender: "",
  room_id: "",
  doctor_id: "",
  status: "ambulator",
};

function sana(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("uz-UZ");
}

function holatBadge(s: Bemor["status"]) {
  if (s === "yotoqda") return <Badge className="rounded-lg">Yotibdi</Badge>;
  if (s === "chiqarilgan")
    return (
      <Badge variant="secondary" className="rounded-lg">
        Chiqib ketdi
      </Badge>
    );
  return (
    <Badge variant="outline" className="rounded-lg">
      Ambulator
    </Badge>
  );
}

function BemorlarSahifa() {
  const qc = useQueryClient();
  const { session } = useSession();
  const { data: profil } = useProfil(session?.user.id);
  const clinicId = profil?.clinicId ?? null;

  const [qidiruv, setQidiruv] = useState("");
  const [ochiq, setOchiq] = useState(false);
  const [forma, setForma] = useState<Forma>(bosh);
  const [tahrirId, setTahrirId] = useState<string | null>(null);
  const [korish, setKorish] = useState<Bemor | null>(null);
  const [ochirish, setOchirish] = useState<Bemor | null>(null);

  const bemorlar = useQuery({
    queryKey: ["bemorlar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select(
          "id, full_name, phone, birth_date, gender, status, diagnosis, address, room_id, doctor_id, rooms(number), doctors(full_name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Bemor[];
    },
  });

  const palatalar = useQuery({
    queryKey: ["palatalar-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, number, room_type, bed_count")
        .order("number");
      if (error) throw error;
      return data ?? [];
    },
  });


  const shifokorlar = useQuery({
    queryKey: ["shifokorlar-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saqlash = useMutation({
    mutationFn: async (v: Forma) => {
      const parsed = formaSxema.parse(v);
      if (!clinicId) throw new Error("Klinika aniqlanmadi");
      const yozuv = {
        clinic_id: clinicId,
        full_name: parsed.full_name,
        phone: parsed.phone || null,
        birth_date: parsed.birth_date || null,
        gender: parsed.gender || null,
        room_id: parsed.room_id || null,
        doctor_id: parsed.doctor_id || null,
        status: parsed.status,
        admitted_at: parsed.status === "yotoqda" ? new Date().toISOString() : null,
      };
      if (tahrirId) {
        const { error } = await supabase.from("patients").update(yozuv).eq("id", tahrirId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("patients").insert(yozuv);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(tahrirId ? "Bemor yangilandi" : "Yangi bemor qo'shildi");
      setOchiq(false);
      setForma(bosh);
      setTahrirId(null);
      qc.invalidateQueries({ queryKey: ["bemorlar"] });
      qc.invalidateQueries({ queryKey: ["palatalar"] });
      qc.invalidateQueries({ queryKey: ["dashboard-statistika"] });

    },
    onError: (e: unknown) => {
      const msg = e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message;
      toast.error(msg ?? "Xatolik yuz berdi");
    },
  });

  const ochirishMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bemor o'chirildi");
      setOchirish(null);
      qc.invalidateQueries({ queryKey: ["bemorlar"] });
      qc.invalidateQueries({ queryKey: ["palatalar"] });
      qc.invalidateQueries({ queryKey: ["dashboard-statistika"] });

    },
    onError: (e: Error) => toast.error(e.message),
  });

  const royxat = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    const hammasi = bemorlar.data ?? [];
    if (!q) return hammasi;
    return hammasi.filter(
      (b) =>
        b.full_name.toLowerCase().includes(q) || (b.phone ?? "").toLowerCase().includes(q),
    );
  }, [bemorlar.data, qidiruv]);

  function yangiOch() {
    setTahrirId(null);
    setForma(bosh);
    setOchiq(true);
  }

  function tahrirOch(b: Bemor) {
    setTahrirId(b.id);
    setForma({
      full_name: b.full_name,
      phone: b.phone ?? "",
      birth_date: b.birth_date ?? "",
      gender: b.gender ?? "",
      room_id: b.room_id ?? "",
      doctor_id: b.doctor_id ?? "",
      status: b.status === "chiqarilgan" ? "ambulator" : b.status,
    });
    setOchiq(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bemorlar</h1>
          <p className="text-sm text-muted-foreground">
            Klinika bemorlari ro'yxati, qidiruv va boshqaruv.
          </p>
        </div>
        <Button className="rounded-xl" onClick={yangiOch}>
          <Plus className="size-4" /> Yangi bemor
        </Button>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={qidiruv}
              onChange={(e) => setQidiruv(e.target.value)}
              placeholder="Ism yoki telefon bo'yicha qidirish"
              className="rounded-xl pl-9"
            />
          </div>

          {bemorlar.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : royxat.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Bemorlar topilmadi. "Yangi bemor" tugmasi orqali qo'shing.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ism</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Tug'ilgan sana</TableHead>
                    <TableHead>Jinsi</TableHead>
                    <TableHead>Palata</TableHead>
                    <TableHead>Shifokor</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="text-right">Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {royxat.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.full_name}</TableCell>
                      <TableCell>{b.phone ?? "—"}</TableCell>
                      <TableCell>{sana(b.birth_date)}</TableCell>
                      <TableCell>{b.gender ?? "—"}</TableCell>
                      <TableCell>{b.rooms?.number ?? "—"}</TableCell>
                      <TableCell>{b.doctors?.full_name ?? "—"}</TableCell>
                      <TableCell>{holatBadge(b.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-lg"
                            aria-label="Ko'rish"
                            onClick={() => setKorish(b)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-lg"
                            aria-label="Tahrirlash"
                            onClick={() => tahrirOch(b)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-lg text-destructive"
                            aria-label="O'chirish"
                            onClick={() => setOchirish(b)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={ochiq} onOpenChange={setOchiq}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tahrirId ? "Bemorni tahrirlash" : "Yangi bemor"}</DialogTitle>
            <DialogDescription>Bemor ma'lumotlarini to'ldiring.</DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saqlash.mutate(forma);
            }}
          >
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="ism">Ism familiya</Label>
              <Input
                id="ism"
                required
                maxLength={100}
                className="rounded-xl"
                value={forma.full_name}
                onChange={(e) => setForma({ ...forma, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tel">Telefon</Label>
              <Input
                id="tel"
                maxLength={30}
                className="rounded-xl"
                placeholder="+998 90 000 00 00"
                value={forma.phone}
                onChange={(e) => setForma({ ...forma, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tsana">Tug'ilgan sana</Label>
              <Input
                id="tsana"
                type="date"
                className="rounded-xl"
                value={forma.birth_date}
                onChange={(e) => setForma({ ...forma, birth_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Jinsi</Label>
              <Select
                value={forma.gender}
                onValueChange={(v) => setForma({ ...forma, gender: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Erkak">Erkak</SelectItem>
                  <SelectItem value="Ayol">Ayol</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Xizmat turi</Label>
              <Select
                value={forma.status}
                onValueChange={(v) => setForma({ ...forma, status: v as Forma["status"] })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yotoqda">Statsionar</SelectItem>
                  <SelectItem value="ambulator">Ambulator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Palata</Label>
              <Select
                value={forma.room_id}
                onValueChange={(v) => setForma({ ...forma, room_id: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue
                    placeholder={
                      (palatalar.data ?? []).length ? "Tanlang" : "Palatalar mavjud emas"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(palatalar.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.number} · {p.room_type ?? "Oddiy"} ({p.bed_count} o'rin)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Shifokor</Label>
              <Select
                value={forma.doctor_id}
                onValueChange={(v) => setForma({ ...forma, doctor_id: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue
                    placeholder={
                      (shifokorlar.data ?? []).length ? "Tanlang" : "Shifokorlar mavjud emas"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(shifokorlar.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="sm:col-span-2">
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

      <Dialog open={!!korish} onOpenChange={(o) => !o && setKorish(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{korish?.full_name}</DialogTitle>
            <DialogDescription>Bemor ma'lumotlari</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted-foreground">Telefon</dt>
            <dd>{korish?.phone ?? "—"}</dd>
            <dt className="text-muted-foreground">Tug'ilgan sana</dt>
            <dd>{sana(korish?.birth_date ?? null)}</dd>
            <dt className="text-muted-foreground">Jinsi</dt>
            <dd>{korish?.gender ?? "—"}</dd>
            <dt className="text-muted-foreground">Palata</dt>
            <dd>{korish?.rooms?.number ?? "—"}</dd>
            <dt className="text-muted-foreground">Shifokor</dt>
            <dd>{korish?.doctors?.full_name ?? "—"}</dd>
            <dt className="text-muted-foreground">Tashxis</dt>
            <dd>{korish?.diagnosis ?? "—"}</dd>
            <dt className="text-muted-foreground">Holat</dt>
            <dd>{korish ? holatBadge(korish.status) : null}</dd>
          </dl>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!ochirish} onOpenChange={(o) => !o && setOchirish(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Bemorni o'chirasizmi?</AlertDialogTitle>
            <AlertDialogDescription>
              {ochirish?.full_name} ma'lumotlari butunlay o'chiriladi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={() => ochirish && ochirishMut.mutate(ochirish.id)}
            >
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
