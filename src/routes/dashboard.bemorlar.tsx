import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import { CalendarIcon, Eye, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { useProfil, useSession } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/bemorlar")({
  head: () => ({
    meta: [
      { title: "Bemorlar вЂ” Soliha Shifoxonasi" },
      { name: "description", content: "Klinika bemorlari ro'yxati, qidiruv va yangi bemor qo'shish." },
      { property: "og:title", content: "Bemorlar вЂ” Soliha Shifoxonasi" },
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
  passport: string | null;
  workplace: string | null;
  benefit: string | null;
  room_id: string | null;
  doctor_id: string | null;
  rooms: { number: string } | null;
  doctors: { full_name: string } | null;
};

/* ===================== TELEFON: +998 XX XXX XX XX ===================== */
const TEL_PREFIX = "+998 ";

/** Foydalanuvchi kiritgan ixtiyoriy matndan faqat 9 ta raqamni ("998" dan keyingisini) chiqarib oladi. */
function telefonRaqamlari(qiymat: string) {
  let raqamlar = qiymat.replace(/\D/g, "");
  if (raqamlar.startsWith("998")) raqamlar = raqamlar.slice(3);
  return raqamlar.slice(0, 9);
}

/** 9 ta xom raqamni "+998 90 123 45 67" ko'rinishida formatlaydi. */
function telefonFormat(raqamlar: string) {
  const kod = raqamlar.slice(0, 2);
  const uch = raqamlar.slice(2, 5);
  const ikki1 = raqamlar.slice(5, 7);
  const ikki2 = raqamlar.slice(7, 9);
  let natija = TEL_PREFIX;
  if (kod) natija += kod;
  if (uch) natija += " " + uch;
  if (ikki1) natija += " " + ikki1;
  if (ikki2) natija += " " + ikki2;
  return natija;
}

function telefonDbGa(qiymat: string) {
  const raqamlar = telefonRaqamlari(qiymat);
  return raqamlar ? `+998${raqamlar}` : "";
}

function telefonKorsatish(dbQiymat: string | null) {
  if (!dbQiymat) return "";
  return telefonFormat(telefonRaqamlari(dbQiymat));
}

const TELEFON_TOLIQ_UZUNLIK = TEL_PREFIX.length + 9 + 3; // "+998 " + 9 raqam + 3 bo'shliq

/* ===================== SANA: kun.oy.yil <-> yyyy-MM-dd ===================== */
function sanaKursatish(isoOrNull: string) {
  if (!isoOrNull) return undefined;
  const d = parse(isoOrNull, "yyyy-MM-dd", new Date());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const formaSxema = z.object({
  full_name: z.string().trim().min(2, "Ism kamida 2 ta belgidan iborat bo'lsin").max(100),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || telefonRaqamlari(v).length === 9, {
      message: "Telefon raqami to'liq kiritilishi kerak",
    }),
  birth_date: z.string().trim().max(20).optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  room_id: z.string().optional().or(z.literal("")),
  doctor_id: z.string().optional().or(z.literal("")),
  status: z.enum(["yotoqda", "ambulator"]),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  passport: z.string().trim().max(20).optional().or(z.literal("")),
  workplace: z.string().trim().max(150).optional().or(z.literal("")),
  benefit: z.string().optional().or(z.literal("")),
});

type Forma = {
  full_name: string;
  phone: string;
  birth_date: string;
  gender: string;
  room_id: string;
  doctor_id: string;
  status: "yotoqda" | "ambulator";
  address: string;
  passport: string;
  workplace: string;
  benefit: string;
};

const bosh: Forma = {
  full_name: "",
  phone: "",
  birth_date: "",
  gender: "",
  room_id: "",
  doctor_id: "",
  status: "ambulator",
  address: "",
  passport: "",
  workplace: "",
  benefit: "Pulli",
};

function sana(v: string | null) {
  if (!v) return "вЂ”";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "вЂ”" : d.toLocaleDateString("uz-UZ");
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
  const [sanaOchiq, setSanaOchiq] = useState(false);

  const bemorlar = useQuery({
    queryKey: ["bemorlar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select(
          "id, full_name, phone, birth_date, gender, status, diagnosis, address, passport, workplace, benefit, room_id, doctor_id, rooms(number), doctors(full_name)",
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
        phone: telefonDbGa(parsed.phone ?? "") || null,
        birth_date: parsed.birth_date || null,
        gender: parsed.gender || null,
        room_id: parsed.room_id || null,
        doctor_id: parsed.doctor_id || null,
        status: parsed.status,
        address: parsed.address || null,
        passport: parsed.passport || null,
        workplace: parsed.workplace || null,
        benefit: parsed.benefit || "Pulli",
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
      phone: telefonKorsatish(b.phone),
      birth_date: b.birth_date ?? "",
      gender: b.gender ?? "",
      room_id: b.room_id ?? "",
      doctor_id: b.doctor_id ?? "",
      status: b.status === "chiqarilgan" ? "ambulator" : b.status,
      address: b.address ?? "",
      passport: b.passport ?? "",
      workplace: b.workplace ?? "",
      benefit: b.benefit ?? "Pulli",
    });
    setOchiq(true);
  }

  function telefonOzgardi(e: ChangeEvent<HTMLInputElement>) {
    const raqamlar = telefonRaqamlari(e.target.value);
    setForma({ ...forma, phone: raqamlar ? telefonFormat(raqamlar) : "" });
  }

  function telefonFokusda() {
    if (!forma.phone) setForma({ ...forma, phone: TEL_PREFIX });
  }

  function telefonKlaviatura(e: KeyboardEvent<HTMLInputElement>) {
    // Prefiks o'chirilib ketmasin: kursor prefiks ichida bo'lsa Backspace/Delete e'tiborsiz qoldiriladi
    const input = e.currentTarget;
    if (
      (e.key === "Backspace" || e.key === "Delete") &&
      input.selectionStart !== null &&
      input.selectionStart <= TEL_PREFIX.length &&
      input.selectionEnd !== null &&
      input.selectionEnd <= TEL_PREFIX.length
    ) {
      e.preventDefault();
    }
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
                      <TableCell className="font-mono text-sm">
                        {telefonKorsatish(b.phone) || "вЂ”"}
                      </TableCell>
                      <TableCell>{sana(b.birth_date)}</TableCell>
                      <TableCell>{b.gender ?? "вЂ”"}</TableCell>
                      <TableCell>{b.rooms?.number ?? "вЂ”"}</TableCell>
                      <TableCell>{b.doctors?.full_name ?? "вЂ”"}</TableCell>
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
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
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
                placeholder="Alimov Vali Aliyevich"
                className="rounded-xl"
                value={forma.full_name}
                onChange={(e) => setForma({ ...forma, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tel">Telefon</Label>
              <Input
                id="tel"
                inputMode="numeric"
                maxLength={TELEFON_TOLIQ_UZUNLIK}
                className="rounded-xl font-mono"
                placeholder="+998 90 123 45 67"
                value={forma.phone}
                onFocus={telefonFokusda}
                onChange={telefonOzgardi}
                onKeyDown={telefonKlaviatura}
              />
            </div>

            <div className="space-y-2">
              <Label>Tug'ilgan sana</Label>
              <Popover open={sanaOchiq} onOpenChange={setSanaOchiq}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start rounded-xl font-normal",
                      !forma.birth_date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {forma.birth_date
                      ? format(sanaKursatish(forma.birth_date) ?? new Date(), "dd.MM.yyyy")
                      : "Sanani tanlang"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    captionLayout="dropdown"
                    startMonth={new Date(1930, 0)}
                    endMonth={new Date()}
                    selected={sanaKursatish(forma.birth_date)}
                    onSelect={(d) => {
                      setForma({ ...forma, birth_date: d ? format(d, "yyyy-MM-dd") : "" });
                      setSanaOchiq(false);
                    }}
                    disabled={{ after: new Date() }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
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
                      {p.number} В· {p.room_type ?? "Oddiy"} ({p.bed_count} o'rin)
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

            <div className="space-y-2">
              <Label>Imtiyoz turi</Label>
              <Select
                value={forma.benefit}
                onValueChange={(v) => setForma({ ...forma, benefit: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pulli">Pulli</SelectItem>
                  <SelectItem value="Nogironlik">Nogironlik</SelectItem>
                  <SelectItem value="Faxriy">Faxriy</SelectItem>
                  <SelectItem value="Boshqa">Boshqa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="passport">Pasport raqami</Label>
              <Input
                id="passport"
                maxLength={20}
                className="rounded-xl"
                placeholder="AB1234567"
                value={forma.passport}
                onChange={(e) => setForma({ ...forma, passport: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ishjoyi">Ish joyi</Label>
              <Input
                id="ishjoyi"
                maxLength={150}
                className="rounded-xl"
                value={forma.workplace}
                onChange={(e) => setForma({ ...forma, workplace: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="manzil">Uy manzili</Label>
              <Input
                id="manzil"
                maxLength={200}
                className="rounded-xl"
                value={forma.address}
                onChange={(e) => setForma({ ...forma, address: e.target.value })}
              />
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
            <dd className="font-mono">{telefonKorsatish(korish?.phone ?? null) || "вЂ”"}</dd>
            <dt className="text-muted-foreground">Tug'ilgan sana</dt>
            <dd>{sana(korish?.birth_date ?? null)}</dd>
            <dt className="text-muted-foreground">Jinsi</dt>
            <dd>{korish?.gender ?? "вЂ”"}</dd>
            <dt className="text-muted-foreground">Palata</dt>
            <dd>{korish?.rooms?.number ?? "вЂ”"}</dd>
            <dt className="text-muted-foreground">Shifokor</dt>
            <dd>{korish?.doctors?.full_name ?? "вЂ”"}</dd>
            <dt className="text-muted-foreground">Pasport</dt>
            <dd>{korish?.passport ?? "вЂ”"}</dd>
            <dt className="text-muted-foreground">Ish joyi</dt>
            <dd>{korish?.workplace ?? "вЂ”"}</dd>
            <dt className="text-muted-foreground">Imtiyoz</dt>
            <dd>{korish?.benefit ?? "вЂ”"}</dd>
            <dt className="text-muted-foreground">Manzil</dt>
            <dd className="col-span-1">{korish?.address ?? "вЂ”"}</dd>
            <dt className="text-muted-foreground">Tashxis</dt>
            <dd>{korish?.diagnosis ?? "вЂ”"}</dd>
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
