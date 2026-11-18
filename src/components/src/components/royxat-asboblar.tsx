import { useEffect, useState } from "react";
import { ArrowDownAZ, ArrowUpZA, CalendarClock, LayoutGrid, Rows3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Korinish = "plitka" | "jadval";
export type Saralash = "sana" | "az" | "za";

export function boshHarflar(ism: string) {
  const sozlar = ism.trim().split(/\s+/).filter(Boolean);
  return ((sozlar[0]?.[0] ?? "") + (sozlar[1]?.[0] ?? "")).toUpperCase();
}

export function IsmAvatar({ ism, className }: { ism: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl brand-gradient text-sm font-semibold",
        className,
      )}
    >
      {boshHarflar(ism)}
    </span>
  );
}

// Tanlangan ko'rinishni (plitka/jadval) brauzerda eslab qoladi
export function useKorinish(kalit: string) {
  const [korinish, setKorinish] = useState<Korinish>("plitka");

  useEffect(() => {
    try {
      const v = window.localStorage.getItem("korinish:" + kalit);
      if (v === "plitka" || v === "jadval") setKorinish(v);
    } catch {
      /* brauzer xotirasi yopiq bo'lsa e'tiborsiz */
    }
  }, [kalit]);

  function ozgartir(v: Korinish) {
    setKorinish(v);
    try {
      window.localStorage.setItem("korinish:" + kalit, v);
    } catch {
      /* e'tiborsiz */
    }
  }

  return [korinish, ozgartir] as const;
}

export function KorinishTugmalari({
  qiymat,
  onChange,
}: {
  qiymat: Korinish;
  onChange: (v: Korinish) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border p-1">
      <Button
        type="button"
        size="icon"
        variant={qiymat === "plitka" ? "secondary" : "ghost"}
        className="size-8 rounded-lg"
        aria-label="Plitka ko'rinishi"
        title="Plitka ko'rinishi"
        onClick={() => onChange("plitka")}
      >
        <LayoutGrid className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={qiymat === "jadval" ? "secondary" : "ghost"}
        className="size-8 rounded-lg"
        aria-label="Jadval ko'rinishi"
        title="Jadval ko'rinishi"
        onClick={() => onChange("jadval")}
      >
        <Rows3 className="size-4" />
      </Button>
    </div>
  );
}

const SARALASH_KEYINGI: Record<Saralash, Saralash> = { sana: "az", az: "za", za: "sana" };
const SARALASH_NOMI: Record<Saralash, string> = {
  sana: "Qo'shilgan sana bo'yicha",
  az: "Alifbo bo'yicha (A-Z)",
  za: "Alifbo bo'yicha (Z-A)",
};

// Bitta tugma: bosilgan sari sana -> A-Z -> Z-A -> sana
export function SaralashTugmasi({
  qiymat,
  onChange,
}: {
  qiymat: Saralash;
  onChange: (v: Saralash) => void;
}) {
  const Ikonka = qiymat === "az" ? ArrowDownAZ : qiymat === "za" ? ArrowUpZA : CalendarClock;
  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 gap-2 rounded-xl"
      aria-label={SARALASH_NOMI[qiymat]}
      title={SARALASH_NOMI[qiymat]}
      onClick={() => onChange(SARALASH_KEYINGI[qiymat])}
    >
      <Ikonka className="size-4" />
      <span className="hidden text-sm sm:inline">{SARALASH_NOMI[qiymat]}</span>
    </Button>
  );
}

// "sana" rejimida ro'yxat serverdan kelgan tartibda qoladi
export function saralash<T>(royxat: T[], rejim: Saralash, ism: (x: T) => string): T[] {
  if (rejim === "sana") return royxat;
  const nusxa = [...royxat].sort((a, b) => ism(a).localeCompare(ism(b), "uz"));
  return rejim === "za" ? nusxa.reverse() : nusxa;
}
