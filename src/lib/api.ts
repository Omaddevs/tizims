/** TIZIMS API mijozi — sessiya httpOnly cookie orqali, o'zgartiruvchi so'rovlarda CSRF sarlavhasi. */
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
/** Sessiya tugaganda (401) AppContext foydalanuvchini chiqarib yuboradi. */
export function onUnauthorized(fn: Listener) {
  unauthorizedListeners.add(fn);
  return () => {
    unauthorizedListeners.delete(fn);
  };
}

export async function api<T>(path: string, init: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? (init.body !== undefined ? "POST" : "GET");
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(method !== "GET" ? { "Content-Type": "application/json", "X-Requested-With": "tizims" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : method !== "GET" ? "{}" : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Server bilan aloqa yo'q. API server ishga tushirilganini tekshiring (npm run server).");
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    if (res.status === 401 && !path.startsWith("/auth/login")) unauthorizedListeners.forEach((fn) => fn());
    throw new ApiError(res.status, err?.code ?? "HTTP_ERROR", err?.message ?? (res.status === 502 || res.status === 504 ? "API server ishlamayapti (npm run server)." : `Xato: ${res.status}`));
  }
  return data as T;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Noma'lum xato");

/**
 * GET so'rov uchun hook. `path` null bo'lsa so'rov yuborilmaydi.
 * `setData` — mutatsiyadan keyin javobni lokal holatga qo'yish uchun (qayta yuklashsiz).
 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(path);
      if (my === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (my === seq.current) setError(errorText(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
