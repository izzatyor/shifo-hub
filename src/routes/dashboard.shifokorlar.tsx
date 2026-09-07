import { createFileRoute } from "@tanstack/react-router";

import { BolimPlaceholder } from "@/components/bolim-placeholder";

export const Route = createFileRoute("/dashboard/shifokorlar")({
  head: () => ({
    meta: [
      { title: "Shifokorlar — Soliha Shifoxonasi" },
      { name: "description", content: "Klinika shifokorlari, mutaxassisligi va kabinetlari." },
      { property: "og:title", content: "Shifokorlar — Soliha Shifoxonasi" },
      { property: "og:description", content: "Shifokorlar ro'yxatini boshqaring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <BolimPlaceholder
      sarlavha="Shifokorlar"
      matn="Shifokorlar ro'yxati, mutaxassislik va kabinet ma'lumotlari shu yerda bo'ladi."
    />
  ),
});
