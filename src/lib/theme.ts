import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";
const KEY = "tizims-theme";

export function readTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
}

/** Light/Dark rejim — standart: dark (PaceUI uslubi). */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readTheme);
  useEffect(() => {
    applyTheme(mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* private mode */
    }
  }, [mode]);
  const toggle = useCallback(() => setMode((m) => (m === "dark" ? "light" : "dark")), []);
  return { mode, setMode, toggle };
}
