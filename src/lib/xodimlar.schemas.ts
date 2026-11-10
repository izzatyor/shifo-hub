import { z } from "zod";

export const xodimSxema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(120),
  parol: z.string().min(8).max(72),
  role: z.enum(["kassa", "rahbar", "qabul"]),
}).strict();
export type XodimYaratKirish = z.infer<typeof xodimSxema>;
export const klinikaSxema = z.object({ clinicId: z.string().uuid() }).strict();
export const kirishSxema = z.object({
  clinicId: z.string().uuid(),
  xodimId: z.string().uuid(),
  parol: z.string().min(1).max(72),
}).strict();

export function adminKlinikasi(roles: { role: string; clinic_id: string | null }[], profileClinic: string | null) {
  if (!roles.some(row => row.role === "admin" || row.role === "super_admin")) {
    throw new Error("Ruxsat yo‘q: faqat administrator");
  }
  // Profile clinic alone is not authoritative: users can edit their profile.
  if (!profileClinic || !roles.some(row =>
    (row.role === "admin" || row.role === "super_admin") && row.clinic_id === profileClinic)) {
    throw new Error("Administrator klinikasi aniqlanmadi");
  }
  return profileClinic;
}