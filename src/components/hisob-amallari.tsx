import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, MoreHorizontal, Pencil, Power } from "lucide-react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { faolHolatniOzgartir, parolniTikla, xodimniTahrirla } from "@/lib/hisoblar.functions";

export type HisobXodim = { userId: string; fullName: string; roles: string[]; faol: boolean };

const XODIM_ROLLARI = ["kassa", "qabul", "rahbar"] as const;
const ROL_NOMI: Record<string, string> = { kassa: "Kassa", qabul: "Qabul", rahbar: "Rahbar" };

type Props = {
  hisob: HisobXodim;
  /** Ism (va xodim bo'lsa rol) tahrirlash menyusi. Shifokorda o'z tahrir oynasi bor, u yerda false */
  tahrir?: boolean;
  /** O'z hisobini faolsizlantirib bo'lmaydi */
  ozim?: boolean;
  onOzgardi: () => void;
};

export function HisobAmallari({ hisob, tahrir = true, ozim = false, onOzgardi }: Props) {
  const [oyna, setOyna] = useState<"tahrir" | "parol" | "holat" | null>(null);
  const [ism, setIsm] = useState(hisob.fullName);
  const [rol, setRol] = useState(hisob.roles[0] ?? "");
  const [parol, setParol] = useState("");
  const [xato, setXato] = useState("");

  const tahrirFn = useServerFn(xodimniTahrirla);
  const parolFn = useServerFn(parolniTikla);
  const holatFn = useServerFn(faolHolatniOzgartir);

  const rolOzgaradi = hisob.roles.length === 1 && XODIM_ROLLARI.some((r) => r === hisob.roles[0]);

  function yop() {
    setOyna(null);
    setXato("");
    setParol("");
  }

  function ochish(nomi: "tahrir" | "parol" | "holat") {
    setIsm(hisob.fullName);
    setRol(hisob.roles[0] ?? "");
    setParol("");
    setXato("");
    setOyna(nomi);
  }

  const tahrirlash = useMutation({
    mutationFn: async () => {
      const toza = ism.trim();
      if (toza.length < 2) throw new Error("Ism-familiya kamida 2 ta belgi bo'lsin");
      const yangiRol = rolOzgaradi ? XODIM_ROLLARI.find((r) => r === rol) : undefined;
      await tahrirFn({
        data: yangiRol
          ? { xodimId: hisob.userId, fullName: toza, role: yangiRol }
          : { xodimId: hisob.userId, fullName: toza },
      });
    },
    onSuccess: () => {
      toast.success("O'zgarishlar saqlandi");
      yop();
      onOzgardi();
    },
    onError: (e: unknown) => setXato((e as Error).message ?? "Xatolik yuz berdi"),
  });

  const parolTiklash = useMutation({
    mutationFn: async () => {
      if (parol.length < 8) throw new Error("Parol kamida 8 ta belgi bo'lsin");
      await parolFn({ data: { userId: hisob.userId, yangiParol: parol } });
    },
    onSuccess: () => {
      toast.success("Yangi parol belgilandi");
      yop();
    },
    onError: (e: unknown) => setXato((e as Error).message ?? "Xatolik yuz berdi"),
  });

  const holatniOzgartir = useMutation({
    mutationFn: async () => {
      await holatFn({ data: { userId: hisob.userId, faol: !hisob.faol } });
    },
    onSuccess: () => {
      toast.success(hisob.faol ? "Hisob faolsizlantirildi" : "Hisob faollashtirildi");
      yop();
      onOzgardi();
    },
    onError: (e: unknown) => {
      toast.error((e as Error).message ?? "Xatolik yuz berdi");
      yop();
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 rounded-lg"
            aria-label="Amallar"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {tahrir && (
            <DropdownMenuItem onSelect={() => ochish("tahrir")}>
              <Pencil className="mr-2 size-4" /> Tahrirlash
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => ochish("parol")}>
            <KeyRound className="mr-2 size-4" /> Parolni tiklash
          </DropdownMenuItem>
          {!ozim && (
            <DropdownMenuItem onSelect={() => ochish("holat")}>
              <Power className="mr-2 size-4" />
              {hisob.faol ? "Faolsizlantirish" : "Faollashtirish"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={oyna === "tahrir"} onOpenChange={(v) => !v && yop()}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Xodimni tahrirlash</DialogTitle>
            <DialogDescription>
              Ism o'zgarsa, kirish ro'yxati va kvitansiyalarda yangi ism chiqadi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hisob-ism">Ism-familiya</Label>
              <Input
                id="hisob-ism"
                value={ism}
                onChange={(e) => setIsm(e.target.value)}
                className="rounded-xl"
              />
            </div>
            {rolOzgaradi && (
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={rol} onValueChange={setRol}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {XODIM_ROLLARI.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROL_NOMI[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {xato && <p className="text-xs font-medium text-destructive">{xato}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={yop}>
              Bekor qilish
            </Button>
            <Button
              className="rounded-xl"
              disabled={tahrirlash.isPending}
              onClick={() => tahrirlash.mutate()}
            >
              {tahrirlash.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={oyna === "parol"} onOpenChange={(v) => !v && yop()}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Parolni tiklash</DialogTitle>
            <DialogDescription>
              {hisob.fullName} uchun yangi parol belgilang va unga o'zingiz yetkazing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="hisob-parol">Yangi parol</Label>
            <Input
              id="hisob-parol"
              type="text"
              autoComplete="off"
              value={parol}
              onChange={(e) => setParol(e.target.value)}
              placeholder="Kamida 8 ta belgi"
              className="rounded-xl"
            />
            {xato && <p className="text-xs font-medium text-destructive">{xato}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={yop}>
              Bekor qilish
            </Button>
            <Button
              className="rounded-xl"
              disabled={parolTiklash.isPending}
              onClick={() => parolTiklash.mutate()}
            >
              {parolTiklash.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Parolni o'zgartirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={oyna === "holat"} onOpenChange={(v) => !v && yop()}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hisob.faol ? "Hisobni faolsizlantirasizmi?" : "Hisobni faollashtirasizmi?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {hisob.faol
                ? `${hisob.fullName} tizimga kira olmaydi va kirish ro'yxatidan yo'qoladi. Ma'lumotlari saqlanadi, istalgan vaqt qayta faollashtirish mumkin.`
                : `${hisob.fullName} yana tizimga kira oladi.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={(e) => {
                e.preventDefault();
                holatniOzgartir.mutate();
              }}
            >
              {holatniOzgartir.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {hisob.faol ? "Faolsizlantirish" : "Faollashtirish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
