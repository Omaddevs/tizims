import { cn } from "../lib/utils";

const MARK_RATIO = 538 / 512; // tizims-mark.png (kenglik / balandlik)
const LOGO_RATIO = 1340 / 400; // tizims-logo.png

/**
 * tizims logotipi. Light rejimda to'q, dark rejimda (`html.dark`) oq variant ko'rsatiladi.
 * T harfi shaffof kesilgan — har qanday fonda to'g'ri ko'rinadi.
 */
export function Logo({
  className,
  compact = false,
  inverted = false,
  size = 26,
}: {
  className?: string;
  /** true — faqat belgi (T), false — to'liq logo (belgi + "tizims") */
  compact?: boolean;
  /** har doim to'q fonda turadigan joylar uchun — doim oq variant */
  inverted?: boolean;
  size?: number;
}) {
  const height = Math.round(size * 1.2);
  const width = Math.round(height * (compact ? MARK_RATIO : LOGO_RATIO));
  const base = compact ? "/brand/tizims-mark" : "/brand/tizims-logo";
  const img = (src: string, cls: string) => (
    <img
      src={src}
      alt="tizims"
      width={width}
      height={height}
      draggable={false}
      className={cn("select-none object-contain", cls)}
      style={{ width, height }}
    />
  );

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      {inverted ? (
        img(`${base}-white.png`, "block")
      ) : (
        <>
          {img(`${base}.png`, "ts-logo-light block")}
          {img(`${base}-white.png`, "ts-logo-dark")}
        </>
      )}
    </span>
  );
}
