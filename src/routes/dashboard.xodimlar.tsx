import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, Plus, Search, ShieldAlert } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IsmAvatar,
  KorinishTugmalari,
  SaralashTugmasi,
  type Saralash,
  saralash,
  useKorinish,
} from "@/components/royxat-asboblar";
import { HisobAmallari } from "@/components/hisob-amallari";
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

type Xodim = { id: string; fullName: string; roles: string[]; isActive?: boolean };

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
  const superAdmin = (profil?.rollar ?? []).some((r) => r === "super_admin");
  const yaratish = useServerFn(xodimYarat);
  const royxatniOl = useServerFn(klinikaXodimlari);

  const [ochiq, setOchiq] = useState(false);
  const [forma, setForma] = useState<Forma>(bosh);
  const [xatolar, setXatolar] = useState<Record<string, string>>({});
  const [qidiruv, setQidiruv] = useState("");
  const [korinish, setKorinish] = useKorinish("xodimlar");
  const [tartib, setTartib] = useState<Saralash>("az");

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

  const royxat = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    const hammasi = xodimlar.data ?? [];
    const topilgan = q
      ? hammasi.filter(
          (x) =>
            x.fullName.toLowerCase().includes(q) ||
            x.roles.some((r) => (ROL_NOMI[r] ?? r).toLowerCase().includes(q)),
        )
      : hammasi;
    return saralash(topilgan, tartib, (x) => x.fullName);
  }, [xodimlar.data, qidiruv, tartib]);

  const yangila = () => qc.invalidateQueries({ queryKey: ["xodimlar"] });

  // Boshqa administratorni faqat bosh admin o'zgartira oladi
  const tegsaBoladi = (x: Xodim) => superAdmin || !x.roles.includes("admin");

  function amallar(x: Xodim) {
    if (!tegsaBoladi(x)) return null;
    return (
      <HisobAmallari
        hisob={{ userId: x.id, fullName: x.fullName, roles: x.roles, faol: x.isActive !== false }}
        tahrir={!x.roles.includes("admin")}
        ozim={x.id === session?.user.id}
        onOzgardi={yangila}
      />
    );
  }

  function holatBelgisi(x: Xodim) {
    return x.isActive === false ? (
      <Badge variant="destructive" className="rounded-lg">
        Faol emas
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1 rounded-lg">
        <KeyRound className="size-3" /> Login bor
      </Badge>
    );
  }

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qidiruv}
            onChange={(e) => setQidiruv(e.target.value)}
            placeholder="Ism yoki rol bo'yicha qidirish"
            className="rounded-xl pl-9"
          />
        </div>
        <SaralashTugmasi qiymat={tartib} onChange={setTartib} />
        <KorinishTugmalari qiymat={korinish} onChange={setKorinish} />
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
      ) : korinish === "plitka" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {royxat.map((x) => (
            <Card
              key={x.id}
              className={cn(
                "rounded-2xl border-border/70 shadow-sm",
                x.isActive === false && "opacity-60",
              )}
            >
              <CardContent className="flex items-center gap-3 p-5">
                <IsmAvatar ism={x.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight">{x.fullName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {x.roles.map((r) => (
                      <Badge key={r} variant="secondary" className="rounded-lg">
                        {ROL_NOMI[r] ?? r}
                      </Badge>
                    ))}
                    {holatBelgisi(x)}
                  </div>
                </div>
                {amallar(x)}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Xodim</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Kirish</TableHead>
                <TableHead className="text-right">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {royxat.map((x) => (
                <TableRow key={x.id} className={cn(x.isActive === false && "opacity-60")}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <IsmAvatar ism={x.fullName} className="size-9 text-xs" />
                      <span className="font-medium">{x.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {x.roles.map((r) => (
                        <Badge key={r} variant="secondary" className="rounded-lg">
                          {ROL_NOMI[r] ?? r}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{holatBelgisi(x)}</TableCell>
                  <TableCell className="text-right">{amallar(x)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
