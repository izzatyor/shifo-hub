import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HeartPulse, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Parolni tiklash — Soliha Shifoxonasi" },
    { name: "description", content: "Soliha Shifoxonasi hisobingiz uchun yangi parol belgilang." },
    { property: "og:title", content: "Parolni tiklash — Soliha Shifoxonasi" },
    { property: "og:description", content: "Hisob parolini xavfsiz yangilash." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const recovery = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setChecking(false);
      }
    });
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (recovery && sessionData.session) setReady(true);
      setChecking(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || saving) return;
    if (password !== confirmation) {
      setError("Parollar bir xil emas.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("Parol yangilanmadi. Kuchliroq parol kiriting yoki yangi tiklash xatini so‘rang.");
        return;
      }
      setDone(true);
      setPassword("");
      setConfirmation("");
      await supabase.auth.signOut();
    } catch {
      setError("Aloqa uzildi. Qayta urinib ko‘ring.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
    <div className="w-full max-w-md space-y-6">
      <div className="flex items-center gap-3 text-primary"><HeartPulse className="size-8" /><span className="text-lg font-semibold">Soliha Shifoxonasi</span></div>
      <h1 className="text-3xl font-semibold">Yangi parol</h1>
      {checking ? <Loader2 aria-label="Tekshirilmoqda" className="size-6 animate-spin text-primary" /> : done ? <>
        <p role="status">Parolingiz yangilandi.</p><Button asChild className="w-full rounded-xl"><Link to="/">Tizimga kirish</Link></Button>
      </> : !ready ? <>
        <p role="alert" className="text-muted-foreground">Tiklash havolasi yaroqsiz yoki muddati tugagan. Yangi tiklash xatini so‘rang.</p>
        <Button asChild variant="outline"><Link to="/">Kirish sahifasi</Link></Button>
      </> : <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2"><Label htmlFor="new-password">Yangi parol</Label><Input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} className="h-12 rounded-xl" /></div>
        <div className="space-y-2"><Label htmlFor="confirm-password">Parolni takrorlang</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="h-12 rounded-xl" /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving} className="h-12 w-full rounded-xl">{saving && <Loader2 className="size-4 animate-spin" />}Parolni saqlash</Button>
      </form>}
    </div>
  </main>;
}