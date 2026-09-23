import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

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
      { title: "Klinikalar — Soliha Shifoxonasi" },
      { name: "description", content: "Tizimdagi barcha klinikalarni boshqarish." },
      { property: "og:title", content: "Klinikalar — Soliha Shifoxonasi" },
      { property: "og:description", content: "Yangi klinika qo'shing va mavjudlarini ko'ring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KlinikalarSahifa,
});

type Klinika = { id: string; name: string; created_at: string };

const formaSxema = z.object({
  name: z.string().trim().min(2, "Klinika nomi kamida 2 ta belgidan iborat bo'lishi kerak").max(100),
});

type Forma = { name: string };
const bosh: Forma = { name: "" };

function XatoMatni({ xabar }: { xabar?: string | undefined }) {
  if (!xabar) return null;
  return <p className="text-xs font-medium text-destructive">{xabar}</p>;
}

function KlinikalarSahifa() {
  const qc = useQueryClient();
  const { session } = useSession();
  const { data: profil, isLoading: profilYuklanmoqda } = useProfil(session?.user.id);
  const superAdmin = (profil?.rollar ?? []).includes("super_admin");

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
      const { error } = await supabase.from("clinics").insert({ name: parsed.name });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Yangi klinika qo'shildi");
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
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Yangi klinika</DialogTitle>
            <DialogDescription>
              Klinika nomini kiriting. Admin foydalanuvchini biriktirish Supabase (Lovable) orqali
              amalga oshiriladi.
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
                onChange={(e) => {
                  setForma({ name: e.target.value });
                  if (xatolar["name"]) setXatolar({ ...xatolar, name: "" });
                }}
              />
              <XatoMatni xabar={maydonXato("name")} />
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
    </div>
  );
}
