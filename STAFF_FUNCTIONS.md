# Frontend ulash namunalar

UI o‘zgartirilmagan. Barcha `useServerFn` chaqiruvlarini React component yoki custom hook ichida yozing. Parametrlar `{ data: ... }` bilan uzatiladi. Parol va sessiya tokenlarini logga yozmang.

## 1. Shifokor login

```tsx
import { useServerFn } from "@tanstack/react-start";
import { shifokorLoginYarat } from "@/lib/shifokorlar.functions";

// Component/custom hook ichida:
const doktorYarat = useServerFn(shifokorLoginYarat);

// (a) Mavjud shifokorga login biriktirish
const mavjudNatija = await doktorYarat({ data: {
  doctorId: tanlanganShifokor.id,
  fullName: tanlanganShifokor.full_name,
  email: forma.email,
  parol: forma.parol,
} });

// (b) Yangi shifokor va login birga yaratish
const yangiNatija = await doktorYarat({ data: {
  fullName: forma.fullName,
  specialty: forma.specialty,
  phone: forma.phone,
  cabinet: forma.cabinet,
  email: forma.email,
  parol: forma.parol,
} });
```

Majburiy: `fullName`, `email`, `parol` (8–72 belgi). Ixtiyoriy: `doctorId`, `specialty`, `phone`, `cabinet`. `doctorId` bo‘lsa, boshqa shifokor maydonlari mavjud qatorni tahrirlamaydi; `fullName` yangi profilga yoziladi. Natija: `{ doctorId, userId, email }`. Login allaqachon biriktirilgan bo‘lsa, xato. Mavjud funksiya admin/super-admin uchun; super-admin mavjud shifokorni boshqa klinikadan ham tanlashi mumkin. Yangi shifokor esa profil klinikasida yaratiladi.

## 2. Xodim yaratish

```tsx
import { useServerFn } from "@tanstack/react-start";
import { xodimYarat } from "@/lib/xodimlar.functions";

const yarat = useServerFn(xodimYarat);
const natija = await yarat({ data: {
  fullName: forma.fullName,
  email: forma.email,
  parol: forma.parol,
  role: "kassa", // "kassa" | "rahbar" | "qabul"
} });
```

Natija: `{ userId, clinicId, fullName, role }`. `clinicId` yubormang: server uni chaqiruvchining profil va himoyalangan rol yozuvlaridan aniqlaydi. Admin ham, super-admin ham faqat o‘z klinikasiga xodim qo‘shadi. Rol/profil yozish bitta tranzaksiyada; xatoda yangi Auth hisob o‘chiriladi. Tashqi Auth va DB amallari mutlaq yagona tranzaksiya emas: tozalash xato bersa, funksiya bu haqda alohida xabar beradi.

## 3. Klinika → xodim → parol

```tsx
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  kirishKlinikalari,
  klinikaXodimlari,
  xodimKirish,
} from "@/lib/xodimlar.functions";

const klinikalarniOl = useServerFn(kirishKlinikalari);
const xodimlarniOl = useServerFn(klinikaXodimlari);
const kirish = useServerFn(xodimKirish);
const navigate = useNavigate();

const klinikalar = await klinikalarniOl(); // [{ id, name }]
const xodimlar = await xodimlarniOl({ data: {
  clinicId: tanlanganKlinikaId,
} }); // [{ id, fullName, roles }], fullName nullable

const natija = await kirish({ data: {
  clinicId: tanlanganKlinikaId,
  xodimId: tanlanganXodimId,
  parol: kiritilganParol,
} });

if (!natija.ok) {
  throw new Error(natija.message);
}
const { error } = await supabase.auth.setSession(natija.session);
if (error) throw new Error("Sessiya o‘rnatilmadi");
await navigate({ to: "/dashboard" });
```

Ochiq ro‘yxatlar email, telefon va bemor ma’lumotlarini bermaydi. Ism, rol va klinikaga mansublik ataylab ochiq: internetdagi boshqa odam ham ro‘yxatni ko‘rishi mumkin. Super-admin ro‘yxatda ko‘rinmaydi va ushbu kirish usulidan foydalana olmaydi; eski email/parol kirishi saqlangan. Sessiya natijasida faqat tokenlar beriladi, lekin odatiy Auth sessiyasi va JWT tarkibida foydalanuvchining emaili bo‘lishi mumkin — bu muvaffaqiyatli kirgan foydalanuvchining o‘z sessiyasidir.

Har xodim uchun 15 daqiqalik oynada 5 ta parol tekshiruvi; oltinchisi bloklanadi. Muvaffaqiyatli kirish ham sanaladi. Hisoblagich DBda atomik, parallel urinishlar chetlab o‘tolmaydi; xizmat xatosida kirishga ruxsat berilmaydi. Bu maxsus himoya, umumiy IP/bot/DDoS himoyasi emas; hujumchi ma’lum xodim uchun urinishlarni sarflab vaqtincha bloklashi mumkin. Eski email/parol kirishiga bu maxsus hisoblagich tatbiq etilmaydi.

Maxfiylik muhim bo‘lsa, email bilan kirish yaxshiroq: xodimlar ro‘yxati va mansubligi ochiq bo‘lmaydi. Hozir so‘ralgan ism tanlash usuli implementatsiya qilingan.

## Tekshirish

- `bun test tests/xodimlar.test.ts`: 12 test — parol uzunligi, ruxsatli rollar, admin scope va xatoda tozalash.
- `src/lib/xodimlar.integration.sql`: rollback-only DB sinov — 5/15 daqiqa qoidasi va service-only RPC ruxsatlari.
- Jonli RPC sinov: kassa/rahbar/qabul yaratish, ochiq ro‘yxatdan qayta o‘qish, sessiyani o‘rnatish, profilni shu sessiya bilan o‘qish, non-admin yaratishini rad etish, noto‘g‘ri klinika va noto‘g‘ri parolni rad etish, oltinchi urinishni bloklash. Sinov hisoblari tozalangan.