/** TIZIMS.AI API serveri. Dev: `npm run server` (2012-port), frontend Vite orqali /api ni shu yerga yo'naltiradi. */
import { createApp } from "./app";
import { ensureSubjects, seedIfEmpty } from "./seed";
import { cleanupOrphanFiles } from "./routes/chat";

const port = Number(process.env.PORT ?? 2012);

if (seedIfEmpty()) console.log("✓ Baza demo ma'lumotlar bilan to'ldirildi");
else if (ensureSubjects()) console.log("✓ Fanlar bazaga ko'chirildi");

// Yuborilmay qolgan chat fayllarini tozalash: ishga tushganda va har soatda
const cleaned = cleanupOrphanFiles();
if (cleaned) console.log(`✓ ${cleaned} ta tashlab ketilgan fayl o'chirildi`);
setInterval(() => cleanupOrphanFiles(), 60 * 60 * 1000).unref();

createApp().listen(port, () => {
  console.log(`TIZIMS API: http://localhost:${port}`);
});
