import { createFileRoute } from "@tanstack/react-router";
import { type ChangeEvent, type KeyboardEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Loader2, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { klinikaVaAdminYarat } from "@/lib/klinikalar.functions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfil, useSession } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/klinikalar")({
  head: () => ({
    meta: [
      { title: "Klinikalar вЂ” Soliha Shifoxonasi" },
      { name: "description", content: "Tizimdagi barcha klinikalarni boshqarish." },
      { property: "og:title", content: "Klinikalar вЂ” Soliha Shifoxonasi" },
      { property: "og:description", content: "Yangi klinika qo'shing va mavjudlarini ko'ring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KlinikalarSahifa,
});

type Klinika = { id: string; name: string; created_at: string };

/* ===================== TELEFON: +998 XX XXX XX XX ===================== */
const TEL_PREFIX = "+998 ";

function telefonRaqamlari(qiymat: string) {
  let raqamlar = qiymat.replace(/\D/g, "");
  if (raqamlar.startsWith("998")) raqamlar = raqamlar.slice(3);
  return raqamlar.slice(0, 9);
}

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

const formaSxema = z.object({
  name: z.string().trim().min(2, "Klinika nomi kamida 2 ta belgidan iborat bo'lishi kerak").max(100),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => telefonRaqamlari(v ?? "").length === 0 || telefonRaqamlari(v ?? "").length === 9, {
      message: "Telefon raqami to'liq kiritilishi kerak (9 ta raqam)",
    }),
  adminFullName: z.string().trim().min(2, "Admin ism-familiyasi kiritilishi shart").max(100),
  adminEmail: z.string().trim().min(1, "Email kiritilishi shart").email("Email noto'g'ri formatda"),
  adminParol: z.string().min(8, "Parol kamida 8 ta belgidan iborat bo'lishi kerak").max(72),
});

type Forma = {
  name: string;
  address: string;
  phone: string;
  adminFullName: string;
  adminEmail: string;
  adminParol: string;
};

const bosh: Forma = {
  name: "",
  address: "",
  phone: "",
  adminFullName: "",
  adminEmail: "",
  adminParol: "",
};

function XatoMatni({ xabar }: { xabar?: string | undefined }) {
  if (!xabar) return null;
  return <p className="text-xs font-medium text-destructive">{xabar}</p>;
}

function KlinikalarSahifa() {
  const qc = useQueryClient();
  const { session } = useSession();
  const { data: profil, isLoading: profilYuklanmoqda } = useProfil(session?.user.id);
  const superAdmin = (profil?.rollar ?? []).includes("super_admin");
  const yarat = useServerFn(klinikaVaAdminYarat);

  const [ochiq, setOchiq] = useState(false);
  const [forma, setForma] = useState<Forma>(bosh);
  const [xatolar, setXatolar] = useState<Record<string, string>>({});

  const klinikalar = useQuery({
    queryKey: ["klinikalar"],
    enabled: superAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select("id, name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Klinika[];
    },
  });

  const saqlash = useMutation({
    mutationFn: async (v: Forma) => {
      const parsed = formaSxema.parse(v);
      await yarat({
        data: {
          name: parsed.name,
          address: parsed.address || undefined,
          phone: telefonDbGa(parsed.phone ?? "") || undefined,
          adminEmail: parsed.adminEmail,
          adminParol: parsed.adminParol,
          adminFullName: parsed.adminFullName,
        },
      });
    },
    onSuccess: () => {
      toast.success("Yangi klinika va admin yaratildi");
      setOchiq(false);
      setForma(bosh);
      setXatolar({});
      qc.invalidateQueries({ queryKey: ["klinikalar"] });
    },
    onError: (e: unknown) => {
      if (e instanceof z.ZodError) {
        const yangiXatolar: Record<string, string> = {};
        for (const issue of e.issues) yangiXatolar[String(issue.path[0])] = issue.message;
        setXatolar(yangiXatolar);
        toast.error("Iltimos, formadagi xatolarni to'g'rilang");
        return;
      }
      toast.error((e as Error).message ?? "Xatolik yuz berdi");
    },
  });

  function maydonXato(nomi: string) {
    return xatolar[nomi];
  }

  function yangiOch() {
    setForma(bosh);
    setXatolar({});
    setOchiq(true);
  }

  function maydonOzgardi(nomi: keyof Forma) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setForma({ ...forma, [nomi]: e.target.value });
      if (xatolar[nomi]) setXatolar({ ...xatolar, [nomi]: "" });
    };
  }

  function telefonOzgardi(e: ChangeEvent<HTMLInputElement>) {
    const raqamlar = telefonRaqamlari(e.target.value);
    setForma({ ...forma, phone: raqamlar ? telefonFormat(raqamlar) : "" });
    if (xatolar["phone"]) setXatolar({ ...xatolar, phone: "" });
  }

  function telefonFokusda() {
    if (!forma.phone) setForma({ ...forma, phone: TEL_PREFIX });
  }

  function telefonKlaviatura(e: KeyboardEvent<HTMLInputElement>) {
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

  if (profilYuklanmoqda) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  if (!superAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Bu bo'limga faqat super administrator kira oladi.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Klinikalar</h1>
          <p className="text-sm text-muted-foreground">
            Jami {klinikalar.data?.length ?? 0} ta klinika ro'yxatdan o'tgan.
          </p>
        </div>
        <Button className="rounded-xl" onClick={yangiOch}>
          <Plus className="size-4" /> Yangi klinika
        </Button>
      </div>

      {klinikalar.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : (klinikalar.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Hali klinikalar qo'shilmagan. "Yangi klinika" tugmasi orqali qo'shing.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(klinikalar.data ?? []).map((k) => (
            <Card key={k.id} className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="flex items-center gap-3 p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(k.created_at).toLocaleDateString("uz-UZ")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={ochiq} onOpenChange={setOchiq}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Yangi klinika</DialogTitle>
            <DialogDescription>
              Klinika va uning birinchi admin foydalanuvchisi bir vaqtda yaratiladi.
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              saqlash.mutate(forma);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="k-nom">Klinika nomi</Label>
              <Input
                id="k-nom"
                required
                maxLength={100}
                className={cn(
                  "rounded-xl",
                  maydonXato("name") && "border-destructive focus-visible:ring-destructive",
                )}
                placeholder="masalan: Shifo Med"
                value={forma.name}
                onChange={maydonOzgardi("name")}
              />
              <XatoMatni xabar={maydonXato("name")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="k-manzil">Manzil (ixtiyoriy)</Label>
                <Input
                  id="k-manzil"
                  maxLength={200}
                  className="rounded-xl"
                  value={forma.address}
                  onChange={maydonOzgardi("address")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-tel">Telefon (ixtiyoriy)</Label>
                <Input
                  id="k-tel"
                  maxLength={TEL_PREFIX.length + 11}
                  className={cn(
                    "rounded-xl font-mono",
                    maydonXato("phone") && "border-destructive focus-visible:ring-destructive",
                  )}
                  placeholder="+998 90 000 00 00"
                  value={forma.phone}
                  onFocus={telefonFokusda}
                  onChange={telefonOzgardi}
                  onKeyDown={telefonKlaviatura}
                />
                <XatoMatni xabar={maydonXato("phone")} />
              </div>
            </div>

            <div className="h-px bg-border" />
            <p className="text-sm font-medium">Birinchi admin</p>

            <div className="space-y-2">
              <Label htmlFor="k-admin-ism">Admin ism-familiyasi</Label>
              <Input
                id="k-admin-ism"
                required
                maxLength={100}
                className={cn(
                  "rounded-xl",
                  maydonXato("adminFullName") && "border-destructive focus-visible:ring-destructive",
                )}
                value={forma.adminFullName}
                onChange={maydonOzgardi("adminFullName")}
              />
              <XatoMatni xabar={maydonXato("adminFullName")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="k-admin-email">Admin email</Label>
              <Input
                id="k-admin-email"
                type="email"
                required
                className={cn(
                  "rounded-xl",
                  maydonXato("adminEmail") && "border-destructive focus-visible:ring-destructive",
                )}
                placeholder="admin@klinika.uz"
                value={forma.adminEmail}
                onChange={maydonOzgardi("adminEmail")}
              />
              <XatoMatni xabar={maydonXato("adminEmail")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="k-admin-parol">Vaqtinchalik parol</Label>
              <Input
                id="k-admin-parol"
                type="text"
                required
                minLength={8}
                className={cn(
                  "rounded-xl font-mono",
                  maydonXato("adminParol") && "border-destructive focus-visible:ring-destructive",
                )}
                placeholder="Kamida 8 ta belgi"
                value={forma.adminParol}
                onChange={maydonOzgardi("adminParol")}
              />
              <XatoMatni xabar={maydonXato("adminParol")} />
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
                Yaratish
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
