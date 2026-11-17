# TIZIMS.AI — The Operating System for Education

Ta'lim tashkilotlari uchun multi-tenant boshqaruv platformasi.

- **Frontend:** React + Vite + TypeScript + Tailwind (`src/`)
- **Backend:** Node.js + Express 5 + TypeScript, SQLite (`node:sqlite`) (`server/`)

Talab: **Node.js 22.13+** (tavsiya: 24 — `node:sqlite` bayroqsiz ishlashi uchun). Alohida ma'lumotlar bazasi o'rnatish shart emas.

## Ishga tushirish

```bash
npm install
npm run dev:full      # API (2012) + frontend (2011) birga
```

Yoki ikki terminalda:

```bash
npm run server        # API: http://localhost:2012 (o'zgarishda qayta yuklanadi)
npm run dev           # Frontend: http://localhost:2011 (/api → 2012 ga proksi)
```

Birinchi ishga tushishda baza (`server/data/tizims.db`) demo ma'lumotlar bilan avtomatik to'ldiriladi.

| Buyruq | Vazifasi |
|---|---|
| `npm run db:reset` | Bazani o'chirib, demo ma'lumotlar bilan qayta yaratish |
| `npm test` | Barcha testlar (frontend qoidalari + API integratsiya testlari) |
| `npm run typecheck` | Frontend va server tiplarini tekshirish |
| `npm run build && npm start` | Production: server `dist/` ni ham beradi (`SESSION_SECRET` majburiy) |

### Muhit o'zgaruvchilari

| O'zgaruvchi | Standart | Izoh |
|---|---|---|
| `PORT` | `2012` | API porti |
| `DB_PATH` | `server/data/tizims.db` | SQLite fayli (`:memory:` — testlar uchun) |
| `SESSION_SECRET` | dev'da avtomatik yaratiladi | Production'da **majburiy**, kamida 32 belgi |
| `NODE_ENV` | — | `production` — Secure cookie va `dist/` ni berish |

## 1-bosqich: Admin, Nazoratchi, Talaba

| Rol | Kirish | Asosiy imkoniyatlar |
|---|---|---|
| **Admin** (tashkilot egasi) | owner@tizims.ai / owner123 | Foydalanuvchilar va rollar, talabalar (Excel import), fanlar va o'qituvchi biriktirish, jadval, semestrni yopish, e'lon/blog/test, obuna, audit |
| **Nazoratchi** | advisor@tizims.ai / advisor123 | Xonalar monitoringi (jonli: qayerda dars, qaysi guruh/o'qituvchi, qaysi xona bo'sh), barcha guruhlar uchun davomat va baho, murojaatlar, jadval, testlar, e'lon va bloglar |
| **Talaba** | student@tizims.ai / student123 | Dars jadvali, fanlar va mas'ul o'qituvchilar, baholar, haqiqiy davomat, topshiriqlar, onlayn testlar, elektron kutubxona, e'lonlar, bloglar, shikoyatlar, yordam, sozlamalar |

Boshqa rollar (rektor, dekan, o'qituvchi, ota-ona) tizimda tayyor — kerak bo'lganda "Foydalanuvchilar" bo'limida shu rol bilan akkaunt ochish kifoya.

## Demo kirish

| Rol | Email | Parol | Nima qila oladi |
|---|---|---|---|
| Super Admin (platforma) | superadmin@tizims.ai | super123 | Faqat platforma: tashkilotlar, obunalar, yordam, monitoring, e'lonlar, audit. Tashkilot ichki ma'lumotlarini ko'rmaydi |
| Tashkilot egasi | owner@tizims.ai | owner123 | Barcha ta'lim modullari, rollar, audit, yordam rejimi va ma'lumot so'rovlarini tasdiqlash |
| Rektor | rector@iau.uz | rector123 | Barcha ta'lim modullari, audit, yordam rejimini tasdiqlash |
| Dekan | dean@iau.uz | dean123 | Faqat o'z fakulteti (AT) |
| Maslahatchi | advisor@tizims.ai | advisor123 | Dars jadvali va xonalar (boshqaradi), boshqalar — ko'rish |
| O'qituvchi | teacher@tizims.ai | teacher123 | O'z fanlari: davomat, baholar, LMS |
| Talaba | student@tizims.ai | student123 | O'z kabineti |
| Ota-ona | parent@tizims.ai | parent123 | Farzandi kabineti |
| IAU + ABC Shop egasi | omadbek@tizims.uz | demo123 | Ikki tashkilot o'rtasida almashish |
| ABC Shop · Menejer | shop@abc.uz | shop123 | |
| MedFarm · Menejer | farm@medfarm.uz | farm123 | |

## Tashkilot egasi imkoniyatlari

| Bo'lim | Nima qiladi |
|---|---|
| **Talabalarni import qilish** (`/people` → Excel'dan yuklash) | .xlsx yoki .csv (5000 qatorgacha): ustunlar avtomatik aniqlanadi, server har bir qatorni tekshiradi (guruh, telefon, ta'lim shakli, takrorlar), faqat to'g'ri qatorlar bitta tranzaksiyada saqlanadi; xatolar ro'yxati yuklab olinadi |
| **Semestrni yopish** (`/academic` → Semestr, ega/rektor) | Oldindan ko'rish (har talaba semestr GPA, qarz, yakuniy bahosi yo'q fanlar) → semestr nomini yozib tasdiqlash → bitta tranzaksiyada: natijalar arxivi, umumiy GPA/kredit/qarz, bahorda kurs ko'chirish va bitiruvchilar, jurnallar tozalanadi, keyingi semestr ochiladi, talabalarga xabar |
| **Dars jadvali** (`/timetable`) | Dars qo'shish/tahrirlash/o'chirish (arxiv); xona, o'qituvchi va guruh to'qnashuvi serverda rad etiladi; o'qituvchi fandan olinadi; o'qituvchi va talabalarga xabar |
| **Fanlar** (`/academic` → Fanlar) | Fan yaratish, o'qituvchi biriktirish/almashtirish (darslar va davomat huquqi ham ko'chadi), guruhlar. Faqat tizim akkaunti bor o'qituvchiga |
| **Foydalanuvchilar** (`/members`) | Akkaunt ochish (vaqtinchalik parol bir marta ko'rsatiladi), rol berish, talaba/ota-onani talaba yozuviga bog'lash, kirishni to'xtatish/tiklash, parolni tiklash |
| **Rollar va vakolatlar** (`/roles`) | Har bir rol ruxsatlari — **serverda majburiy**: masalan o'qituvchidan "Baho qo'yish" olinsa, baho saqlash rad etiladi. Ega roli qulflangan |
| **Tashkilot** (`/organization`) | Profil (nomi, aloqa, rang), yordam rejimi va ma'lumot so'rovlarini tasdiqlash, eksport/o'chirish so'rovi |
| **Obuna va to'lovlar** (`/billing`) | Tarif, oylik to'lov, hisob-fakturalar, tarifni o'zgartirish so'rovi |
| **TIZIMS yordami** (`/support`) | Texnik so'rov yuborish va javoblarni ko'rish (rektor ham) |

Himoya: ega o'zini o'zgartira olmaydi, oxirgi faol egani olib bo'lmaydi, boshqa tashkilotga ham a'zo akkaunt parolini tiklay olmaydi; vaqtinchalik parol bilan kirgan foydalanuvchi parolni almashtirmaguncha hech qanday ma'lumot ko'rmaydi. Har bir amal audit logga yoziladi.

## Arxitektura

```
src/core/features.ts   ← modullar va rollar matritsasi (manage / view / own)  ┐
src/core/catalog.ts    ← ruxsatlar, rol yo'llari                              ├ server va frontend uchun umumiy
src/core/access.ts     ← ko'rinish qoidalari (vazifa, bildirishnoma)          ┘
server/auth.ts         ← scrypt parollar, imzolangan sessiya cookie, login cheklovi, rol/modul tekshiruvi
server/routes/auth.ts      /api/auth/*      login, me, switch, logout
server/routes/org.ts       /api/org/*       vazifalar, bildirishnomalar, audit, sozlamalar, banner, yordam rejimi tasdig'i
server/routes/owner.ts     /api/org/*       a'zolar, tashkilot profili, obuna, TIZIMS yordami, ma'lumot so'rovlari
server/routes/edu.ts       /api/edu/*       ta'lim modullari (rol doirasi serverda)
server/routes/platform.ts  /api/platform/*  super admin (faqat platforma darajasi)
server/app.ts              /api/public/status — ommaviy holat sahifasi
```

### Xavfsizlik

- Parollar `scrypt` (tasodifiy salt) bilan saqlanadi; login 5 noto'g'ri urinishdan so'ng 15 daqiqaga bloklanadi.
- Sessiya — HMAC-imzolangan token, `httpOnly` + `SameSite=Lax` cookie, 8 soat. Har so'rovda foydalanuvchi, a'zolik va tashkilot holati bazadan qayta tekshiriladi — tashkilot to'xtatilsa yoki a'zolik bekor qilinsa, sessiya darhol yaroqsiz.
- CSRF: o'zgartiruvchi so'rovlarda `X-Requested-With: tizims` sarlavhasi majburiy (CORS yoqilmagan).
- Tashkilot ID hech qachon so'rov tanasidan olinmaydi — faqat sessiyadan.
- Rol doirasi serverda: o'qituvchi → o'z fanlari/guruhlari, talaba/ota-ona → bog'langan talaba, dekan → o'z fakulteti; anonim murojaat muallifi yashiriladi.
- Super admin tashkilot ichki ma'lumotlarini (baho, xabar, murojaat, tashkilot audit) ko'rmaydi. Texnik yordam uchun **Yordam rejimi**: tashkilot egasi tasdiqlaydi, vaqt bilan cheklangan, ikki tomon auditiga yoziladi.
- Har bir platforma harakati platforma auditiga, tashkilot ichidagi muhim o'zgarishlar tashkilot auditiga yoziladi.

## Hozircha demo / keyingi bosqich

- **Ma'lumotnoma ma'lumotlari** (xonalar, imtihonlar, kutubxona, monitoring ko'rsatkichlari) `src/data/*.ts` dan olinadi — CRUD hali yo'q. Fanlar bazada (birinchi ishga tushishda fayldan ko'chiriladi).
- **Tashqi kanallar** (email, Telegram, SMS) ulanmagan — bildirishnomalar faqat ilova ichida.
- **Platforma jamoasi rollari** (yordam xodimi, moliyachi...) ro'yxat sifatida saqlanadi, lekin alohida login va cheklov hali yo'q — platformada bitta super admin akkaunti.
- **Xavfsizlik siyosatlari** (2FA, IP cheklov) sozlamasi saqlanadi, login jarayonida majburiy qo'llash hali ulanmagan.
- **Yordam rejimida** tashkilot ichini faqat-o'qish rejimida ko'rish interfeysi hali yo'q (ruxsat jarayoni tayyor).
- PostgreSQL'ga o'tish: `server/db.ts` ni almashtirish kifoya; maqsadli sxema — `src/core/schema/001_tizims_core.sql`.
