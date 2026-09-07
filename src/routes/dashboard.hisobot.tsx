import { createFileRoute } from "@tanstack/react-router";

import { BolimPlaceholder } from "@/components/bolim-placeholder";

export const Route = createFileRoute("/dashboard/hisobot")({
  head: () => ({
    meta: [
      { title: "Hisobot — Soliha Shifoxonasi" },
      { name: "description", content: "Klinika bo'yicha moliyaviy va tibbiy hisobotlar." },
      { property: "og:title", content: "Hisobot — Soliha Shifoxonasi" },
      { property: "og:description", content: "Davr bo'yicha ko'rsatkichlarni tahlil qiling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <BolimPlaceholder
      sarlavha="Hisobot"
      matn="Davr bo'yicha tushum, bemorlar oqimi va boshqa hisobotlar shu yerda bo'ladi."
    />
  ),
});
