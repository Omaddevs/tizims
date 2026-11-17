/** `npm run db:reset` — bazani o'chirib, demo ma'lumotlar bilan qayta to'ldiradi. */
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.DB_PATH ?? resolve(process.cwd(), "server/data/tizims.db");
for (const f of [base, `${base}-wal`, `${base}-shm`]) rmSync(f, { force: true });

const { seedIfEmpty } = await import("./seed");
seedIfEmpty();
console.log("✓ Baza qayta yaratildi:", base);
