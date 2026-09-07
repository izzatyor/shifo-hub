import { createFileRoute } from "@tanstack/react-router";

import { BolimPlaceholder } from "@/components/bolim-placeholder";

export const Route = createFileRoute("/dashboard/bemorlar")({
  head: () => ({
    meta: [
      { title: "Bemorlar — Soliha Shifoxonasi" },
      { name: "description", content: "Klinika bemorlari ro'yxati va ularning holati." },
      { property: "og:title", content: "Bemorlar — Soliha Shifoxonasi" },
      { property: "og:description", content: "Bemorlarni qidiring, qo'shing va kuzating." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <BolimPlaceholder
      sarlavha="Bemorlar"
      matn="Bemorlar ro'yxati, qidiruv va yangi bemor qo'shish shu yerda bo'ladi."
    />
  ),
});
