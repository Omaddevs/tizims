import { useEffect, useState } from "react";

/** CSS media query holatini kuzatadi (SSR yo'q — darhol window'dan o'qiydi). */
export function useMediaQuery(query: string) {
  const get = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/** lg (1024px) dan kichik ekranlar — mobil "app" ko'rinishi. */
export function useIsMobile() {
  return !useMediaQuery("(min-width: 1024px)");
}
