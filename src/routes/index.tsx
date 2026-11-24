import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, HeartPulse, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { kirishKlinikalari, klinikaXodimlari, xodimKirish } from "@/lib/xodimlar.functions";
import { supabase } from "@/integrations/supabase/client";
import loginHero from "@/assets/login-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Soliha Shifoxonasi - Klinika boshqaruv tizimi" },
      {
        name: "description",
        content:
          "Soliha Shifoxonasi - ko'p klinikali tibbiy boshqaruv tizimi: bemorlar, palatalar, shifokorlar va to'lovlar bir joyda.",
      },
      { property: "og:title", content: "Soliha Shifoxonasi - Klinika boshqaruv tizimi" },
      {
        property: "og:description",
        content: "Klinikangiz uchun zamonaviy boshqaruv tizimi. Tizimga kiring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

const ROLLAR = ["Admin", "Doktor", "Qabul", "Kassa", "Rahbar"];

type XodimQisqa = { id: string; fullName: string; roles: string[]; isActive?: boolean };

const ROL_NOMI: Record<string, string> = {
  admin: "Administrator",
  doktor: "Shifokor",
  qabul: "Qabul",
  kassa: "Kassa",
  rahbar: "Rahbar",
};

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [parol, setParol] = useState("");
  const [korsat, setKorsat] = useState(false);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [tiklash, setTiklash] = useState(false);

  const [rejim, setRejim] = useState<"xodim" | "admin">("xodim");
  const [klinikalar, setKlinikalar] = useState<KlinikaQisqa[]>([]);
  const [clinicId, setClinicId] = useState("");
  const [xodimlar, setXodimlar] = useState<XodimQisqa[]>([]);
  const [xodimId, setXodimId] = useState("");
  const [xodimParol, setXodimParol] = useState("");
  const [royxatYuklanmoqda, setRoyxatYuklanmoqda] = useState(true);
  const klinikalarniOl = useServerFn(kirishKlinikalari);
  const xodimlarniOl = useServerFn(klinikaXodimlari);
  const xodimKirishFn = useServerFn(xodimKirish);

  useEffect(() => {
    let bekor = false;
    (async () => {
      try {
        const royxat = (await klinikalarniOl()) as KlinikaQisqa[];
        if (bekor) return;
        setKlinikalar(royxat);
        if (royxat.length === 1 && royxat[0]) setClinicId(royxat[0].id);
      } catch {
        if (!bekor) toast.error("Klinikalar ro'yxati yuklanmadi");
      } finally {
        if (!bekor) setRoyxatYuklanmoqda(false);
      }
    })();
    return () => {
      bekor = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setXodimId("");
    if (!clinicId) {
      setXodimlar([]);
      return;
    }
    let bekor = false;
    (async () => {
      try {
        const royxat = (await xodimlarniOl({ data: { clinicId } })) as XodimQisqa[];
        if (!bekor) setXodimlar(royxat.filter((x) => x.isActive !== false));
      } catch {
        if (!bekor) toast.error("Xodimlar ro'yxati yuklanmadi");
      }
    })();
    return () => {
      bekor = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  async function xodimSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clinicId || !xodimId) {
      toast.error("Ismingizni tanlang");
      return;
    }
    setYuklanmoqda(true);
    try {
      const natija = await xodimKirishFn({ data: { clinicId, xodimId, parol: xodimParol } });
      if (!natija.ok) throw new Error(natija.message);
      const { error } = await supabase.auth.setSession(natija.session);
      if (error) throw new Error("Sessiyani ochib bo'lmadi");
      toast.success("Xush kelibsiz!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error("Kirish amalga oshmadi", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setYuklanmoqda(false);
    }
  }

  async function parolniTiklash() {
    if (!email.trim()) {
      toast.error("Elektron pochtangizni kiriting");
      return;
    }
    setTiklash(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error("Tiklash xati yuborilmadi. Qayta urinib ko'ring.");
        return;
      }
      toast.success("Hisob mavjud bo'lsa, parolni tiklash xati yuboriladi. Pochtangizni tekshiring.");
    } catch {
      toast.error("Aloqa uzildi. Qayta urinib ko'ring.");
    } finally {
      setTiklash(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setYuklanmoqda(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: parol });
    setYuklanmoqda(false);
    if (error) {
      toast.error("Kirish amalga oshmadi", { description: "Email yoki parol noto'g'ri." });
      return;
    }
    toast.success("Xush kelibsiz!");
    navigate({ to: "/dashboard" });
  }

  return (
    <main className="flex min-h-screen bg-background">
      {/* Chap taraf - bezak */}
      <section className="relative hidden w-1/2 overflow-hidden lg:block">
        <img
          src={loginHero}
          alt="Tibbiyot mavzusidagi bezak tasviri"
          width={1024}
          height={1536}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 brand-gradient opacity-70" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3 text-primary-foreground">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-foreground/15 backdrop-blur-sm">
              <HeartPulse className="size-6" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Soliha Shifoxonasi</span>
          </div>

          <div className="max-w-md text-primary-foreground">
            <h2 className="text-4xl font-semibold leading-tight tracking-tight">
              Klinikangizni bitta oynadan boshqaring
            </h2>
            <p className="mt-4 text-base text-primary-foreground/80">
              Bemorlar, palatalar, shifokorlar va to'lovlar - har bir klinika uchun alohida va
              xavfsiz muhitda.
            </p>
            <div className="mt-8 flex items-center gap-2 text-sm text-primary-foreground/80">
              <ShieldCheck className="size-4" />
              Ma'lumotlar himoyalangan va klinikalar bo'yicha ajratilgan
            </div>
          </div>
        </div>
      </section>

      {/* O'ng taraf - forma */}
      <section className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="flex size-11 items-center justify-center rounded-2xl brand-gradient text-primary-foreground">
              <HeartPulse className="size-6" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Soliha Shifoxonasi</span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Tizimga kirish</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hisobingizga kiring va klinikangiz ish jarayonini davom ettiring.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
            {(
              [
                ["xodim", "Xodim"],
                ["admin", "Administrator"],
              ] as const
            ).map(([qiymat, nom]) => (
              <button
                key={qiymat}
                type="button"
                onClick={() => setRejim(qiymat)}
                className={cn(
                  "rounded-lg py-2 text-sm font-medium transition-colors",
                  rejim === qiymat
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {nom}
              </button>
            ))}
          </div>

          {rejim === "xodim" && (
            <form onSubmit={xodimSubmit} className="mt-6 space-y-5">
              {klinikalar.length > 1 && (
                <div className="space-y-2">
                  <Label>Klinika</Label>
                  <Select value={clinicId} onValueChange={setClinicId}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Klinikani tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {klinikalar.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Ismingiz</Label>
                <Select value={xodimId} onValueChange={setXodimId} disabled={!clinicId}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue
                      placeholder={
                        royxatYuklanmoqda
                          ? "Yuklanmoqda..."
                          : clinicId
                            ? "Ro'yxatdan ismingizni tanlang"
                            : "Avval klinikani tanlang"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {xodimlar.map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.fullName} ({x.roles.map((r) => ROL_NOMI[r] ?? r).join(", ")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {clinicId && !royxatYuklanmoqda && xodimlar.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Xodimlar topilmadi. Administrator sifatida kiring.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="xodim-parol">Parol</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="xodim-parol"
                    type={korsat ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={xodimParol}
                    onChange={(e) => setXodimParol(e.target.value)}
                    className="h-12 rounded-xl pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setKorsat((v) => !v)}
                    aria-label={korsat ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {korsat ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={yuklanmoqda || !xodimId}
                className="h-12 w-full rounded-xl brand-gradient text-base font-medium shadow-soft transition-shadow hover:shadow-lift"
              >
                {yuklanmoqda ? <Loader2 className="size-4 animate-spin" /> : "Kirish"}
              </Button>
            </form>
          )}

          {rejim === "admin" && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Elektron pochta</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="ism@klinika.uz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parol">Parol</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="parol"
                  type={korsat ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="--------"
                  value={parol}
                  onChange={(e) => setParol(e.target.value)}
                  className="h-12 rounded-xl pl-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setKorsat((v) => !v)}
                  aria-label={korsat ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {korsat ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="link"
                disabled={tiklash}
                className="h-auto p-0 text-sm font-medium"
                onClick={parolniTiklash}
              >
                Parolni unutdingizmi?
              </Button>
            </div>

            <Button
              type="submit"
              disabled={yuklanmoqda}
              className="h-12 w-full rounded-xl brand-gradient text-base font-medium shadow-soft transition-shadow hover:shadow-lift"
            >
              {yuklanmoqda ? <Loader2 className="size-4 animate-spin" /> : "Kirish"}
            </Button>
          </form>
          )}

          <div className="mt-10">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tizim rollari
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ROLLAR.map((rol) => (
                <span
                  key={rol}
                  className="rounded-full border border-border bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
                >
                  {rol}
                </span>
              ))}
            </div>
          </div>

          <p className="mt-10 text-xs text-muted-foreground">
            Hisobingiz yo'qmi? Klinikangiz administratoriga murojaat qiling.
          </p>
        </div>
      </section>
    </main>
  );
}
