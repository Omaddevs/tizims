// @ts-nocheck — oldingi landing navbar (TopBar + LandingNavbar), o'zgarishsiz ko'chirilgan
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlignLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  Facebook,
  Headphones,
  Instagram,
  Linkedin,
  LogIn,
  Phone,
  Send,
  Volume2,
  X,
  Youtube,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Logo } from "./Logo";

const NAV_ITEMS = [
    {
      label: "Imkoniyatlar",
      href: "#imkoniyatlar",
      children: [
        { label: "Tashkilot boshqaruvi", href: "#imkoniyatlar", hint: "Filial, fakultet, kafedra, bo'limlar" },
        { label: "Akademik boshqaruv", href: "#imkoniyatlar", hint: "Guruh, fan, semestr, o'quv reja" },
        { label: "Davomat va Smart jadval", href: "#imkoniyatlar", hint: "Darslar, xonalar, yuklama" },
        { label: "Baholash va imtihonlar", href: "#imkoniyatlar", hint: "Test, baho, akademik natijalar" },
        { label: "LMS va e-kutubxona", href: "#imkoniyatlar", hint: "Materiallar, topshiriqlar, online ta'lim" },
        { label: "AI analitika", href: "#imkoniyatlar", hint: "Tahlil va boshqaruv qarorlari" },
      ],
    },
    {
      label: "Rollar",
      href: "#rollar",
      children: [
        { label: "Rahbariyat", href: "#rollar" },
        { label: "O'qituvchi", href: "#rollar" },
        { label: "O'quvchi", href: "#rollar" },
        { label: "Ota-ona", href: "#rollar" },
      ],
    },
    {
      label: "Qanday ishlaydi",
      href: "#jarayon",
      children: [
        { label: "Tashkilot yaratish", href: "#jarayon" },
        { label: "Rollar va vakolatlar", href: "#jarayon" },
        { label: "Ta'lim jarayoni", href: "#jarayon" },
        { label: "Tahlil va nazorat", href: "#jarayon" },
      ],
    },
    {
      label: "Statistika",
      href: "#statistika",
    },
    {
      label: "Aloqa",
      href: "#aloqa",
    },
  ],
  LANGUAGES = [
    {
      code: "uz",
      label: "O'zbekcha",
    },
    {
      code: "uz-cyrl",
      label: "Ўзбекча",
    },
    {
      code: "ru",
      label: "Русский",
    },
    {
      code: "en",
      label: "English",
    },
  ],
  SOCIALS = [
    {
      icon: Facebook,
      label: "Facebook",
      href: "#",
    },
    {
      icon: Send,
      label: "Telegram",
      href: "#",
    },
    {
      icon: Youtube,
      label: "YouTube",
      href: "#",
    },
    {
      icon: Linkedin,
      label: "LinkedIn",
      href: "#",
    },
    {
      icon: Instagram,
      label: "Instagram",
      href: "#",
    },
  ],
  PHONE = "+998 87 735 36 36";
function useClickOutside(e) {
  const t = useRef(null);
  return (
    useEffect(() => {
      function a(n) {
        t.current && !t.current.contains(n.target) && e();
      }
      return (document.addEventListener("mousedown", a), () => document.removeEventListener("mousedown", a));
    }, [e]),
    t
  );
}
export function TopBar({ lowVision: a, onLowVision: n }) {
  var g;
  const [l, o] = useState("uz"),
    [c, d] = useState(false),
    [h, m] = useState(false),
    p = useClickOutside(() => d(false));
  function x() {
    var k, _;
    if (!("speechSynthesis" in window)) return;
    const j = window.speechSynthesis;
    if (h) {
      (j.cancel(), m(false));
      return;
    }
    const b =
      ((k = window.getSelection()) == null ? undefined : k.toString().trim()) ||
      ((_ = document.querySelector("main h1")) == null ? undefined : _.textContent) ||
      "";
    if (!b) return;
    const w = new SpeechSynthesisUtterance(b);
    ((w.lang = "uz-UZ"), (w.onend = () => m(false)), m(true), j.speak(w));
  }
  return (
    <div className="landing-container flex h-[76px] items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        <a href="#top" aria-label="tizims.uz">
          <Logo size={26} />
        </a>
      </div>
      <div className="flex items-center">
        <a
          href={`tel:${PHONE.replace(/\s/g, "")}`}
          className="hidden items-center gap-2 pr-6 text-[15px] text-slate-700 transition hover:text-brand-600 lg:flex"
        >
          <Phone className="h-[18px] w-[18px] text-neutral-950" />
          {PHONE}
        </a>
        <div className="hidden items-center gap-1 border-l border-slate-200 px-4 sm:flex">
          <AudienceTab label="Ko'zi ojizlar uchun versiya" active={a} onClick={n}>
            <Eye className="h-[18px] w-[18px]" />
          </AudienceTab>
          <AudienceTab label="Matnni ovozda o'qish" active={h} onClick={x}>
            <Volume2 className="h-[18px] w-[18px]" />
          </AudienceTab>
        </div>
        <div className="hidden items-center gap-1 border-l border-slate-200 px-4 xl:flex">
          {SOCIALS.map((j) => (
            <a
              href={j.href}
              aria-label={j.label}
              title={j.label}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand-600"
              key={j.label}
            >
              <j.icon className="h-[17px] w-[17px]" />
            </a>
          ))}
        </div>
        <div ref={p} className="relative pl-2">
          <button
            onClick={() => d((j) => !j)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-[15px] font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            {(g = LANGUAGES.find((j) => j.code === l)) == null ? undefined : g.label}
            <ChevronDown className={cn("h-4 w-4 text-neutral-950 transition", c && "rotate-180")} />
          </button>
          {c && (
            <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-slate-100 bg-white p-1.5 shadow-nav">
              {LANGUAGES.map((j) => (
                <button
                  onClick={() => {
                    (o(j.code), d(false));
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  key={j.code}
                >
                  {j.label}
                  {l === j.code && <Check className="h-4 w-4 text-neutral-950" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export function LandingNavbar() {
  const [n, l] = useState(false),
    [o, c] = useState(null),
    [x, g] = useState(false),
    j = useClickOutside(() => c(null));
  (useEffect(() => {
    const b = () => g(window.scrollY > 80);
    return (
      b(),
      window.addEventListener("scroll", b, {
        passive: true,
      }),
      () => window.removeEventListener("scroll", b)
    );
  }, []),
    useEffect(() => {
      if (!n) return;
      const b = (w) => {
        w.key === "Escape" && l(false);
      };
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", b);
      return () => {
        window.removeEventListener("keydown", b);
        document.body.style.overflow = prev;
      };
    }, [n]));
  return (
    <>
      <div className={cn("sticky top-0 z-40 pb-3 transition-colors", x && "bg-white/80 pt-3 backdrop-blur")}>
        <div className="landing-container">
          <div
            ref={j}
            className="relative flex h-16 items-stretch rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.06)]"
          >
            <button
              onClick={() => (c(null), l((b) => !b))}
              aria-label={n ? "Menyuni yopish" : "Menyu"}
              aria-expanded={n}
              aria-controls="landing-mega-menu"
              className={cn(
                "flex w-16 shrink-0 items-center justify-center rounded-l-2xl border-r transition-colors duration-300",
                n
                  ? "border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800"
                  : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
              )}
            >
              <span className="relative h-6 w-6">
                <AlignLeft
                  className={cn(
                    "absolute inset-0 h-6 w-6 transition duration-300 ease-out motion-reduce:transition-none",
                    n ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100",
                  )}
                />
                <X
                  className={cn(
                    "absolute inset-0 h-6 w-6 transition duration-300 ease-out motion-reduce:transition-none",
                    n ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0",
                  )}
                />
              </span>
            </button>
            <nav className="hidden flex-1 items-center gap-1 px-4 lg:flex">
              {NAV_ITEMS.map((b) =>
                b.children ? (
                  <div className="relative" onMouseEnter={() => c(b.label)} onMouseLeave={() => c(null)} key={b.label}>
                    <button
                      onClick={() => c((w) => (w === b.label ? null : b.label))}
                      className={cn(
                        "flex items-center gap-1 rounded-lg px-3 py-2 text-[16px] font-semibold text-slate-900 transition hover:text-brand-600",
                        o === b.label && "text-brand-600",
                      )}
                    >
                      {b.label}
                      <ChevronDown className={cn("h-4 w-4 transition", o === b.label && "rotate-180")} />
                    </button>
                    {o === b.label && (
                      <div className="absolute left-0 top-full z-50 pt-3">
                        <div className="w-72 rounded-2xl border border-slate-100 bg-white p-2 shadow-nav">
                          {b.children.map((w) => (
                            <a
                              href={w.href}
                              onClick={() => c(null)}
                              className="block rounded-xl px-3 py-2.5 transition hover:bg-brand-50"
                              key={w.label}
                            >
                              <div className="text-sm font-semibold text-slate-800">{w.label}</div>
                              {w.hint && <div className="mt-0.5 text-xs text-slate-500">{w.hint}</div>}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <a
                    href={b.href}
                    className="rounded-lg px-3 py-2 text-[16px] font-semibold text-slate-900 transition hover:text-brand-600"
                    key={b.label}
                  >
                    {b.label}
                  </a>
                ),
              )}
            </nav>
            <div className="flex-1 lg:hidden" />
            <div className="flex items-center gap-2 border-l border-slate-200 pl-2 pr-2">
              <Link
                to="/login"
                className="flex h-11 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-[15px] font-semibold text-white shadow-lg shadow-neutral-950/25 transition hover:bg-neutral-800"
              >
                <LogIn className="h-4 w-4" />
                Kirish
              </Link>
            </div>
          </div>
        </div>
        <div className="landing-container">
          <div className="relative">
            <div
              id="landing-mega-menu"
              aria-hidden={!n}
              className={cn(
                "absolute inset-x-0 top-3 z-50 origin-top overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_32px_80px_-20px_rgba(10,10,10,0.25)] transition-[opacity,transform,visibility] duration-300 ease-out motion-reduce:transition-none",
                n ? "visible translate-y-0 scale-100 opacity-100" : "pointer-events-none invisible -translate-y-3 scale-[0.98] opacity-0",
              )}
            >
              <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto p-6 sm:p-10">
                <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                  {MENU_GROUPS.map((b, i) => (
                    <div
                      key={b.title}
                      style={{ transitionDelay: n ? `${80 + i * 60}ms` : "0ms" }}
                      className={cn(
                        "transition duration-500 ease-out motion-reduce:transition-none",
                        n ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                      )}
                    >
                      <a
                        href={b.href}
                        tabIndex={n ? undefined : -1}
                        onClick={() => l(false)}
                        className="text-lg font-semibold tracking-tight text-neutral-950"
                      >
                        {b.title}
                      </a>
                      <ul className="mt-4 space-y-2.5">
                        {b.links.map((w) => (
                          <li key={w.label}>
                            <a
                              href={w.href}
                              tabIndex={n ? undefined : -1}
                              onClick={() => l(false)}
                              className="group inline-flex items-center gap-1.5 text-[15px] text-neutral-500 transition-colors hover:text-neutral-950"
                            >
                              {w.label}
                              <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div
                  style={{ transitionDelay: n ? "320ms" : "0ms" }}
                  className={cn(
                    "mt-10 grid gap-3 transition duration-500 ease-out motion-reduce:transition-none sm:grid-cols-3",
                    n ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                  )}
                >
                  <MenuCard
                    to="/login"
                    dark
                    icon={Phone}
                    title="Demo so'rash"
                    text="Platformani jamoamiz bilan birga ko'rib chiqing"
                    cta="So'rov yuborish"
                    tabIndex={n ? undefined : -1}
                    onClick={() => l(false)}
                  />
                  <MenuCard
                    to="/login"
                    icon={LogIn}
                    title="Kirish"
                    text="Hisobingizga kiring va ishni davom ettiring"
                    cta="Tizimga kirish"
                    tabIndex={n ? undefined : -1}
                    onClick={() => l(false)}
                  />
                  <MenuCard
                    href={`tel:${PHONE.replace(/\s/g, "")}`}
                    icon={Headphones}
                    title="Bog'lanish"
                    text={PHONE}
                    cta="Qo'ng'iroq qilish"
                    tabIndex={n ? undefined : -1}
                    onClick={() => l(false)}
                  />
                </div>

                <div className="mt-6 flex items-center justify-between gap-4 border-t border-neutral-100 pt-5">
                  <span className="text-sm text-neutral-500">Ijtimoiy tarmoqlar</span>
                  <div className="flex gap-1.5">
                    {SOCIALS.map((b) => (
                      <a
                        href={b.href}
                        aria-label={b.label}
                        tabIndex={n ? undefined : -1}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 transition hover:bg-neutral-950 hover:text-white"
                        key={b.label}
                      >
                        <b.icon className="h-4 w-4" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        aria-hidden
        onClick={() => l(false)}
        className={cn(
          "fixed inset-0 z-30 bg-neutral-950/30 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none",
          n ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
    </>
  );
}
const MENU_GROUPS = [
  ...NAV_ITEMS.filter((i) => i.children).map((i) => ({ title: i.label, href: i.href, links: i.children })),
  {
    title: "Ko'proq",
    href: "#statistika",
    links: [
      { label: "Statistika", href: "#statistika" },
      { label: "Savollar", href: "#savollar" },
      { label: "Aloqa", href: "#aloqa" },
    ],
  },
];
function MenuCard({ to, href, dark, icon: Icon, title, text, cta, tabIndex, onClick }) {
  const cls = cn(
    "group relative flex items-start justify-between gap-4 overflow-hidden rounded-2xl p-6 transition duration-300 hover:-translate-y-0.5",
    dark ? "bg-neutral-950 text-white hover:bg-neutral-900" : "bg-neutral-100 text-neutral-950 hover:bg-neutral-200/70",
  );
  const body = (
    <>
      <div>
        <div className="text-lg font-semibold tracking-tight">{title}</div>
        <p className={cn("mt-1 text-sm", dark ? "text-white/60" : "text-neutral-500")}>{text}</p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
          {cta}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
      <span
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition duration-300 group-hover:rotate-6",
          dark ? "bg-white/10 text-white" : "bg-white text-neutral-950 shadow-sm",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
    </>
  );
  return to ? (
    <Link to={to} tabIndex={tabIndex} onClick={onClick} className={cls}>
      {body}
    </Link>
  ) : (
    <a href={href} tabIndex={tabIndex} onClick={onClick} className={cls}>
      {body}
    </a>
  );
}
function AudienceTab({ children: e, label: t, active: a, onClick: n }) {
  return (
    <button
      onClick={n}
      aria-label={t}
      aria-pressed={a}
      title={t}
      className={cn(
        "rounded-lg p-2 transition",
        a ? "bg-brand-50 text-brand-600" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
      )}
    >
      {e}
    </button>
  );
}
