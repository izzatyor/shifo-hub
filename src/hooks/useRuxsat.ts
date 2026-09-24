import type { Rol } from "./useAuth";

/**
 * Rol asosida sahifa ichidagi huquqlarni aniqlaydi.
 * - yuqori: super_admin yoki admin - hech qanday cheklov yo'q
 * - faqatKorish: rahbar (admin/super_admin bo'lmasa) - hech narsani qo'sha/tahrirlay/o'chira olmaydi
 * - bemorlarFaqatKorish: rahbar YOKI kassa - Bemorlar sahifasida faqat ko'radi (to'lov uchun tanlash uchun)
 */
export function useRuxsat(rollar: Rol[]) {
  const yuqori = rollar.some((r) => r === "super_admin" || r === "admin");
  const faqatKorish = !yuqori && rollar.includes("rahbar");
  const bemorlarFaqatKorish = !yuqori && (rollar.includes("rahbar") || rollar.includes("kassa"));
  return { yuqori, faqatKorish, bemorlarFaqatKorish };
}
