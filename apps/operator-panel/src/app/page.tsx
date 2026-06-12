"use client";
// Operator console landing page — a dark, cinematic marketing entry for Max Music
// School's operator (superadmin) console. Steel-blue (#5B8DEF) design language with
// motion throughout: drifting glow orbs, animated wordmark, a framed product preview,
// CountUp metrics, a marquee of institutions, a bento feature grid, and a 3-step flow.
// Self-contained dark theme (independent of the app's light/dark) for a cohesive look.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Eye,
  GraduationCap,
  History,
  KeyRound,
  Layers,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { BlurFade, BorderBeam, CountUp, Marquee, SpotlightCard } from "@maxmusic/ui";

const BRAND = "#5B8DEF";

const INSTITUTIONS = [
  "ABC Music School", "Sitar House Delhi", "Tabla Academy Punjab", "Sargam Vocals",
  "Riyaaz Piano Studio", "Naad Flute Academy", "Melody Makers", "Swar Sadhana",
  "Taal Tarang", "Sangeet Niketan",
];

const FEATURES = [
  { icon: Building2, title: "Institution lifecycle", desc: "Provision, suspend, reactivate or terminate a fully-branded mini school in seconds — slug, branding and billing in one flow." },
  { icon: Eye, title: "God-mode oversight", desc: "Step into any institution's admin or teacher panel with an audited, short-lived impersonation token. See exactly what they see." },
  { icon: GraduationCap, title: "Cross-institution students", desc: "The only place every student across every school appears together — tagged by institution, teacher and fee, fully filterable." },
  { icon: Wallet, title: "Payments & rent", desc: "Track per-student fees and per-institution rent, reconcile the Razorpay feed, and watch the money flow across the platform." },
  { icon: History, title: "Immutable audit trail", desc: "Every create, update and impersonation writes one immutable log entry — powering the changes history and per-student activity." },
  { icon: KeyRound, title: "One-credential PBAC", desc: "Grant or revoke admin access with a single click. No new accounts, no re-provisioning — the same login unlocks the right panels." },
];

const STEPS = [
  { n: 1, title: "Provision the institution", desc: "Name it, pick managed or autonomous, set branding & rent. A branded mini-school is live on its own slug." },
  { n: 2, title: "Grant access", desc: "Flip the owner-teacher's panel access. The same email + password now opens the admin panel — no new credentials." },
  { n: 3, title: "Oversee in god-mode", desc: "Watch students, payments and activity flow in. Impersonate, edit or audit anything — all from one console." },
];

/* Drifting steel-blue glow orbs behind the hero. */
function Orbs() {
  const orbs = [
    { x: "12%", y: "18%", s: 520, d: 16, o: 0.18 },
    { x: "72%", y: "8%", s: 420, d: 20, o: 0.14 },
    { x: "60%", y: "62%", s: 600, d: 24, o: 0.1 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: o.x, top: o.y, width: o.s, height: o.s,
            background: `radial-gradient(circle, ${BRAND}${Math.round(o.o * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
          animate={{ x: [0, 30, -20, 0], y: [0, -25, 15, 0], scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: o.d, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/* Floating institution chips that orbit the hero. */
function FloatingChip({ label, className, delay }: { label: string; className: string; delay: number }) {
  return (
    <motion.div
      className={`absolute hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md lg:block ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: [0, -10, 0] }}
      transition={{ opacity: { delay, duration: 0.6 }, y: { delay, duration: 5, repeat: Infinity, ease: "easeInOut" } }}
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: BRAND }} />
      {label}
    </motion.div>
  );
}

function GradientWord({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="bg-clip-text text-transparent"
      style={{ backgroundImage: `linear-gradient(100deg, #7BA3F3, ${BRAND} 45%, #4A7ADE)` }}
    >
      {children}
    </span>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -60]);
  const heroFade = useTransform(scrollYProgress, [0, 0.18], [1, 0]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#070b16] text-white antialiased">
      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? "border-b border-white/10 bg-[#070b16]/80 backdrop-blur-xl" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: BRAND, boxShadow: `0 0 20px ${BRAND}66` }}>
              <Layers className="h-4 w-4 text-white" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold">Max Music School</p>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Operator Console</p>
            </div>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-white/60 md:flex">
            <a href="#preview" className="transition-colors hover:text-white">Platform</a>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#how" className="transition-colors hover:text-white">How it works</a>
          </nav>
          <Link
            href="/login"
            className="group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition-all hover:shadow-lg"
            style={{ background: BRAND, boxShadow: `0 0 24px ${BRAND}44` }}
          >
            Enter Console
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
        <Orbs />
        {/* grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 35%, black 30%, transparent 75%)",
          }}
        />

        <FloatingChip label="Tabla Academy" className="left-[7%] top-[28%]" delay={0.8} />
        <FloatingChip label="Sitar House Delhi" className="right-[8%] top-[24%]" delay={1.1} />
        <FloatingChip label="Sargam Vocals" className="left-[12%] bottom-[20%]" delay={1.4} />
        <FloatingChip label="Riyaaz Piano" className="right-[11%] bottom-[24%]" delay={1.7} />

        <motion.div style={{ y: heroY, opacity: heroFade }} className="relative z-10 mx-auto max-w-4xl px-5 text-center">
          <BlurFade delay={0.05}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" style={{ color: BRAND }} />
              The console behind every white-label music school
            </span>
          </BlurFade>

          <BlurFade delay={0.15}>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Operate every <GradientWord>music school</GradientWord>
              <br className="hidden sm:block" /> from one console.
            </h1>
          </BlurFade>

          <BlurFade delay={0.25}>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/55 sm:text-lg">
              Students, teachers, batches, payments and a full audit trail across every institution —
              in one multi-tenant, god-mode view. Max Music School is the operator behind the curtain.
            </p>
          </BlurFade>

          <BlurFade delay={0.32}>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-medium text-white/40">
              {["Multi-tenant", "God-mode oversight", "One-credential PBAC", "Immutable audit"].map((t, i) => (
                <span key={t} className="flex items-center gap-3">
                  {i > 0 && <span className="h-1 w-1 rounded-full bg-white/20" />}
                  {t}
                </span>
              ))}
            </div>
          </BlurFade>

          <BlurFade delay={0.4}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                style={{ background: `linear-gradient(120deg, #7BA3F3, ${BRAND})`, boxShadow: `0 8px 30px ${BRAND}55` }}
              >
                Enter Console
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#preview"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white/80 backdrop-blur-md transition-colors hover:bg-white/[0.07]"
              >
                See the platform
                <ChevronDown className="h-4 w-4" />
              </a>
            </div>
          </BlurFade>
        </motion.div>

        {/* scroll cue */}
        <motion.a
          href="#preview"
          className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 text-white/40"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
        >
          <span className="flex h-8 w-5 items-start justify-center rounded-full border border-white/20 p-1">
            <motion.span className="h-1.5 w-1 rounded-full bg-white/50" animate={{ y: [0, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />
          </span>
          <span className="text-[10px] uppercase tracking-wider">Scroll</span>
        </motion.a>
      </section>

      {/* ── MARQUEE BAND ───────────────────────────────────────────────────── */}
      <section className="relative border-y border-white/5 py-8">
        <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Powering branded institutions across the platform
        </p>
        <Marquee pauseOnHover className="[--duration:32s]">
          {INSTITUTIONS.map((n) => (
            <span key={n} className="mx-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm text-white/55">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: BRAND }} />
              {n}
            </span>
          ))}
        </Marquee>
      </section>

      {/* ── PRODUCT PREVIEW ────────────────────────────────────────────────── */}
      <section id="preview" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 py-24 lg:px-8">
        <BlurFade inView>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">One pane of glass for the whole platform</h2>
            <p className="mt-3 text-white/50">The dashboard the superadmin opens every morning — every institution, every rupee, every change.</p>
          </div>
        </BlurFade>

        <BlurFade delay={0.1} inView>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-2xl">
            <BorderBeam size={120} duration={9} colorFrom="#7BA3F3" colorTo="#4A7ADE" />
            {/* browser chrome */}
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="mx-auto flex items-center gap-1.5 rounded-md bg-white/[0.05] px-3 py-1 text-[11px] text-white/40">
                <ShieldCheck className="h-3 w-3" style={{ color: BRAND }} /> operator.maxmusic.console
              </span>
            </div>
            {/* mock dashboard */}
            <div className="p-5 sm:p-7">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Institutions", to: 24, icon: Building2, prefix: "", suffix: "", sep: "" },
                  { label: "Students", to: 1840, icon: GraduationCap, prefix: "", suffix: "", sep: "," },
                  { label: "Teachers", to: 96, icon: Users, prefix: "", suffix: "", sep: "" },
                  { label: "Fees tracked", to: 48, icon: Wallet, prefix: "₹", suffix: "L", sep: "" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <s.icon className="h-4 w-4 text-white/30" />
                    <p className="mt-3 text-2xl font-bold tabular-nums" style={{ color: BRAND }}>
                      {s.prefix}
                      <CountUp to={s.to} separator={s.sep} />
                      {s.suffix}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* mock table */}
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  <span>Institution</span><span>Owner</span><span>Mode</span><span>Rent</span>
                </div>
                {[
                  ["ABC Music School", "Kritgun Singh", "Autonomous", "Paid"],
                  ["Sitar House Delhi", "Anjali Deshmukh", "Autonomous", "Overdue"],
                  ["Tabla Academy", "Vikram Joshi", "Managed", "—"],
                ].map((r, i) => (
                  <motion.div
                    key={r[0]}
                    initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] items-center gap-2 px-4 py-3 text-sm text-white/70"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold" style={{ background: `${BRAND}22`, color: BRAND }}>{r[0][0]}</span>
                      {r[0]}
                    </span>
                    <span className="text-white/45">{r[1]}</span>
                    <span className="text-white/45">{r[2]}</span>
                    <span className={r[3] === "Overdue" ? "text-amber-400" : "text-white/45"}>{r[3]}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </BlurFade>
      </section>

      {/* ── FEATURES (bento) ───────────────────────────────────────────────── */}
      <section id="features" className="relative mx-auto max-w-6xl scroll-mt-20 px-5 py-20 lg:px-8">
        <BlurFade inView>
          <h2 className="text-center text-4xl font-bold tracking-tight sm:text-5xl">
            <GradientWord>Everything the operator sees</GradientWord>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-white/50">
            Built multi-tenant from day one — pure operator, zero shadow on the institutions.
          </p>
        </BlurFade>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <BlurFade key={f.title} delay={i * 0.07} inView>
              <SpotlightCard className="group h-full rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/20">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105"
                  style={{ background: `${BRAND}1a`, color: BRAND, boxShadow: `0 0 0 1px ${BRAND}22 inset` }}
                >
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{f.desc}</p>
              </SpotlightCard>
            </BlurFade>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <section id="how" className="relative mx-auto max-w-5xl scroll-mt-20 px-5 py-20 lg:px-8">
        <BlurFade inView>
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: BRAND }}>The flow</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A branded school, live in three steps</h2>
          </div>
        </BlurFade>

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* connector line */}
          <div className="absolute left-0 right-0 top-6 hidden h-px md:block" style={{ background: `linear-gradient(90deg, transparent, ${BRAND}55, transparent)` }} />
          {STEPS.map((s, i) => (
            <BlurFade key={s.n} delay={i * 0.12} inView>
              <div className="relative text-center md:text-left">
                <span
                  className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white md:mx-0"
                  style={{ background: BRAND, boxShadow: `0 0 24px ${BRAND}55` }}
                >
                  {s.n}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{s.desc}</p>
              </div>
            </BlurFade>
          ))}
        </div>
      </section>

      {/* ── METRICS BAND ───────────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.015]">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-8 px-5 py-14 sm:grid-cols-4 lg:px-8">
          {[
            { to: 24, label: "Institutions", prefix: "", suffix: "+", sep: "" },
            { to: 1840, label: "Students", prefix: "", suffix: "+", sep: "," },
            { to: 100, label: "Audited writes", prefix: "", suffix: "%", sep: "" },
            { to: 5, label: "Min to launch a school", prefix: "<", suffix: "", sep: "" },
          ].map((m) => (
            <BlurFade key={m.label} inView>
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: BRAND }}>
                  {m.prefix}<CountUp to={m.to} separator={m.sep} />{m.suffix}
                </p>
                <p className="mt-1 text-xs text-white/45">{m.label}</p>
              </div>
            </BlurFade>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-5xl px-5 py-24 lg:px-8">
        <BlurFade inView>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 p-10 text-center sm:p-16"
            style={{ background: `radial-gradient(ellipse 80% 120% at 50% 0%, ${BRAND}22, transparent 70%)` }}>
            <BorderBeam size={90} duration={8} />
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Step into the console behind every school.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-white/55">
              Secure, 2FA-ready operator access. The whole platform, one login.
            </p>
            <Link
              href="/login"
              className="group mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{ background: `linear-gradient(120deg, #7BA3F3, ${BRAND})`, boxShadow: `0 8px 30px ${BRAND}55` }}
            >
              Enter Console
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </BlurFade>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-sm text-white/40 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: BRAND }}>
              <Layers className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="font-semibold text-white/70">Max Music School</span>
            <span className="text-white/30">· Operator Console</span>
          </div>
          <p className="text-xs">Private platform · Students never see this domain.</p>
        </div>
      </footer>
    </div>
  );
}
