import { createFileRoute } from "@tanstack/react-router";

import { BolimPlaceholder } from "@/components/bolim-placeholder";

export const Route = createFileRoute("/dashboard/tolovlar")({
  head: () => ({
    meta: [
      { title: "To'lovlar — Soliha Shifoxonasi" },
      { name: "description", content: "Bemorlardan qabul qilingan to'lovlar va kassa yozuvlari." },
      { property: "og:title", content: "To'lovlar — Soliha Shifoxonasi" },
      { property: "og:description", content: "Kassa tushumini kuzatib boring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <BolimPlaceholder
      sarlavha="To'lovlar"
      matn="To'lovlar tarixi va yangi to'lov qabul qilish shu yerda bo'ladi."
    />
  ),
});
