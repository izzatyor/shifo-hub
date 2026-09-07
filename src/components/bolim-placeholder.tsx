import { Card, CardContent } from "@/components/ui/card";

export function BolimPlaceholder({ sarlavha, matn }: { sarlavha: string; matn: string }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{sarlavha}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{matn}</p>
      </div>
      <Card className="rounded-2xl border-dashed border-border">
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Bu bo'lim keyingi bosqichda to'ldiriladi.
        </CardContent>
      </Card>
    </div>
  );
}
