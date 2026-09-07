import { createFileRoute } from "@tanstack/react-router";

import { BolimPlaceholder } from "@/components/bolim-placeholder";

export const Route = createFileRoute("/dashboard/palatalar")({
  head: () => ({
    meta: [
      { title: "Palatalar — Soliha Shifoxonasi" },
      { name: "description", content: "Palatalar holati, joylar soni va kunlik narxi." },
      { property: "og:title", content: "Palatalar — Soliha Shifoxonasi" },
      { property: "og:description", content: "Bo'sh va band palatalarni boshqaring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <BolimPlaceholder
      sarlavha="Palatalar"
      matn="Palatalar ro'yxati, band va bo'sh joylar shu yerda ko'rinadi."
    />
  ),
});
