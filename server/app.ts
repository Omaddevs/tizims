/** Express ilovasi (testlar uchun alohida — tinglashni index.ts boshlaydi). */
import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PLATFORM, listDocs } from "./db";
import { loadSession, requirePasswordChanged } from "./auth";
import { ownerRouter } from "./routes/owner";
import { semesterRouter } from "./routes/semester";
import { contentRouter } from "./routes/content";
import { chatRouter } from "./routes/chat";
import { HttpError, errorHandler, h } from "./http";
import { authRouter } from "./routes/auth";
import { orgRouter, upcoming } from "./routes/org";
import { eduRouter } from "./routes/edu";
import { platformRouter } from "./routes/platform";
import { INCIDENTS, SERVICES, UPTIME_30D, type Maintenance } from "../src/data/platform";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // Talabalar importi katta bo'lishi mumkin (5000 qatorgacha) — faqat shu manzil uchun kattaroq limit
  const smallJson = express.json({ limit: "200kb" });
  const bigJson = express.json({ limit: "3mb" });
  app.use((req, res, next) => (req.path === "/api/edu/students/import" ? bigJson : smallJson)(req, res, next));

  // CSRF himoyasi: o'zgartiruvchi so'rovlarda maxsus sarlavha majburiy. Boshqa saytdan bunday sarlavha
  // CORS ruxsatisiz yuborib bo'lmaydi (CORS yoqilmagan), cookie esa SameSite=Lax.
  app.use("/api", (req: Request, _res: Response, next: NextFunction) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.headers["x-requested-with"] !== "tizims") {
      return next(new HttpError(403, "CSRF", "So'rov rad etildi."));
    }
    next();
  });

  app.use(loadSession);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Ommaviy holat sahifasi va login ogohlantirishi uchun (kirish shart emas)
  app.get(
    "/api/public/status",
    h((_req, res) => {
      res.json({
        services: SERVICES.map((s) => ({ name: s.name, status: s.status })),
        incidents: INCIDENTS.filter((i) => i.status !== "resolved").map((i) => ({ id: i.id, title: i.title, status: i.status, started: i.started, impact: i.impact })),
        uptime: UPTIME_30D,
        maintenance: upcoming(listDocs<Maintenance>(PLATFORM, "maintenance")) ?? null,
      });
    }),
  );

  app.use("/api/auth", authRouter);
  app.use(["/api/org", "/api/edu", "/api/platform"], requirePasswordChanged);
  app.use("/api/org", orgRouter);
  app.use("/api/org", ownerRouter);
  app.use("/api/edu", semesterRouter);
  app.use("/api/edu", chatRouter);
  app.use("/api/edu", contentRouter);
  app.use("/api/edu", eduRouter);
  app.use("/api/platform", platformRouter);

  app.use("/api", (_req, _res, next) => next(new HttpError(404, "NOT_FOUND", "API manzili topilmadi.")));

  // Production: tayyor frontendni (dist/) shu serverdan berish
  const dist = resolve(process.cwd(), "dist");
  if (process.env.NODE_ENV === "production" && existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(resolve(dist, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
