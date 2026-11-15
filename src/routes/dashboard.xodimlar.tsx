import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, ShieldAlert, UserCog } from "lucide-react";
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
import { klinikaXodimlari, xodimYarat } from "@/lib/xodimlar.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/xodimlar")({
  head: () => ({
    meta: [
      { title: "Xodimlar - Soliha Shifoxonasi" },
      { name: "description", content: "Klinika xodimlari va ularning kirish hisoblari." },
      { property: "og:title", content: "Xodimlar - Soliha Shifoxonasi" },
      { property: "og:description", content: "Kassa, qabul va rahbar xodimlarini qo'shing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XodimlarSahifa,
});

type Xodim = { id: string; fullName: string; roles: string[] };

const ROL_NOMI: Record<string, string> = {
  admin: "Administrator",
  doktor: "Shifokor",
  qabul: "Qabul",
  kassa: "Kassa",
  rahbar: "Rahbar",
};

const YANGI_ROLLAR = ["kassa", "qabul", "rahbar"] as const;

const formaSxema = z.object({
  fullName: z.string().trim().min(2, "Ism-familiya kamida 2 ta belgi bo'lsin").max(100),
  email: z.string().trim().min(1, "Email kiritilishi shart").email("Email noto'g'ri formatda"),
  parol: z.string().min(8, "Parol kamida 8 ta belgi bo'lsin").max(72),
  role: z.enum(YANGI_ROLLAR, { message: "Rol tanlanishi shart" }),
});

type Forma = { fullName: string; email: string; parol: string; role: string };
const bosh: Forma = { fullName: "", email: "", parol: "", role: "" };

function XatoMatni({ xabar }: { xabar?: string | undefined }) {
  if (!xabar) return null;
  return <p className="text-xs font-medium text-destructive">{xabar}</p>;
}

function XodimlarSahifa() {
  const qc = useQueryClient();
  const { session } = useSession();
  const { data: profil, isLoading: profilYuklanmoqda } = useProfil(session?.user.id);
  const clinicId = profil?.clinicId ?? null;
  const admin = (profil?.rollar ?? []).some((r) => r === "admin" || r === "super_admin");
  const yaratish = useServerFn(xodimYarat);
  const royxatniOl = useServerFn(klinikaXodimlari);

  const [ochiq, setOchiq] = useState(false);
  const [forma, setForma] = useState<Forma>(bosh);
  const [xatolar, setXatolar] = useState<Record<string, string>>({});

  const xodimlar = useQuery({
    queryKey: ["xodimlar", clinicId],
    enabled: admin && !!clinicId,
    queryFn: async () => (await royxatniOl({ data: { clinicId: clinicId! } })) as Xodim[],
  });

  const saqlash = useMutation({
    mutationFn: async (v: Forma) => {
      const parsed = formaSxema.parse(v);
      await yaratish({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Yangi xodim yaratildi");
      setOchiq(false);
      setForma(bosh);
      setXatolar({});
      qc.invalidateQueries({ queryKey: ["xodimlar"] });
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

  function xato(nomi: string) {
    return xatolar[nomi];
  }

  function ozgardi(nomi: keyof Forma, qiymat: string) {
    setForma({ ...forma, [nomi]: qiymat });
    if (xatolar[nomi]) setXatolar({ ...xatolar, [nomi]: "" });
  }

  if (profilYuklanmoqda) return <Skeleton className="h-40 w-full rounded-2xl" />;

  if (!admin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Bu bo'limga faqat administrator kira oladi.</p>
      </div>
    );
  }

  const royxat = xodimlar.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Xodimlar</h1>
          <p className="text-sm text-muted-foreground">
            Kirish hisobi bor xodimlar. Shifokorlar uchun login Shifokorlar bo'limida yaratiladi.
          </p>
        </div>
        <Button
          className="rounded-xl"
          onClick={() => {
            setForma(bosh);
            setXatolar({});
            setOchiq(true);
          }}
        >
          <Plus className="size-4" /> Yangi xodim
        </Button>
      </div>

      {xodimlar.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : royxat.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Xodimlar topilmadi. "Yangi xodim" tugmasi orqali qo'shing.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {royxat.map((x) => (
            <Card key={x.id} className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="flex items-center gap-3 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserCog className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium leading-tight">{x.fullName}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {x.roles.map((r) => (
                      <Badge key={r} variant="secondary" className="rounded-lg">
                        {ROL_NOMI[r] ?? r}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={ochiq} onOpenChange={setOchiq}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Yangi xodim</DialogTitle>
            <DialogDescription>
              Xodim ism va parol bilan kiradi. Email faqat tizim ichida kerak bo'ladi.
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
              <Label htmlFor="x-ism">Ism-familiya</Label>
              <Input
                id="x-ism"
                required
                maxLength={100}
                className={cn("rounded-xl", xato("fullName") && "border-destructive")}
                value={forma.fullName}
                onChange={(e) => ozgardi("fullName", e.target.value)}
              />
              <XatoMatni xabar={xato("fullName")} />
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={forma.role} onValueChange={(v) => ozgardi("role", v)}>
                <SelectTrigger className={cn("rounded-xl", xato("role") && "border-destructive")}>
                  <SelectValue placeholder="Rolni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {YANGI_ROLLAR.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROL_NOMI[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <XatoMatni xabar={xato("role")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="x-email">Email</Label>
              <Input
                id="x-email"
                type="email"
                required
                autoComplete="off"
                className={cn("rounded-xl", xato("email") && "border-destructive")}
                placeholder="kassir@klinika.uz"
                value={forma.email}
                onChange={(e) => ozgardi("email", e.target.value)}
              />
              <XatoMatni xabar={xato("email")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="x-parol">Parol</Label>
              <Input
                id="x-parol"
                type="text"
                required
                minLength={8}
                autoComplete="off"
                className={cn("rounded-xl font-mono", xato("parol") && "border-destructive")}
                placeholder="Kamida 8 ta belgi"
                value={forma.parol}
                onChange={(e) => ozgardi("parol", e.target.value)}
              />
              <XatoMatni xabar={xato("parol")} />
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
