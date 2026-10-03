"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import styles from "./Hero.module.css";

/*
 * Home hero — golden-hour route map + black Sprinter.
 *
 * SEO notes: every message lives in real text (H1, intro, link anchors), the
 * graphics are inline SVG (no extra image weight, nothing blocks LCP), and the
 * SVGs carry <title>/<desc> so crawlers and screen readers get the context.
 */

type Trip = { from: string; to: string; label: string; detail: string; d: string };

// Paths are drawn in the map's 600x520 viewBox; Anaheim sits at (372, 268).
const TRIPS: Trip[] = [
  { from: "LAX", to: "ANA", label: "LAX", detail: "to your Anaheim hotel · door to door", d: "M142 246 Q 250 210 372 268" },
  { from: "ANA", to: "HWD", label: "Best of LA tour", detail: "Walk of Fame, Griffith, Beverly Hills", d: "M372 268 Q 290 150 182 128" },
  { from: "SNA", to: "ANA", label: "John Wayne", detail: "to Disneyland area · private SUV", d: "M410 378 Q 410 320 372 268" },
  { from: "ANA", to: "SMO", label: "Private LA tour", detail: "your stops, your pace", d: "M372 268 Q 230 260 104 196" },
  { from: "LGB", to: "ANA", label: "Long Beach", detail: "pickup · luggage room included", d: "M262 318 Q 320 312 372 268" },
  { from: "ONT", to: "ANA", label: "Ontario", detail: "to Anaheim · free child seats on request", d: "M500 168 Q 450 230 372 268" },
  { from: "BUR", to: "ANA", label: "Burbank", detail: "to Anaheim · meet at arrivals", d: "M214 72 Q 330 120 372 268" },
  { from: "SAN", to: "ANA", label: "San Diego", detail: "transfer · long-distance comfort", d: "M520 480 Q 470 360 372 268" },
];

const SERVICES = [
  { title: "Airport Transportation", sub: "LAX, SNA, Long Beach, Burbank, Ontario, San Diego", href: "/transportation/airport-transfer" },
  { title: "Disneyland & Hotel Transfers", sub: "Door to door across Anaheim and Greater LA", href: "/transportation/disneyland-transportation" },
  { title: "LA & Hollywood Tours", sub: "Full day with Anaheim hotel pickup", href: "/los-angeles-hollywood-tour-from-anaheim" },
  { title: "Universal Studios Transportation", sub: "Roundtrip from Anaheim", href: "/universal-studios-transportation-anaheim" },
];

const PERKS = [
  "Black sedans, SUVs & Sprinter vans",
  "Free child car seats · infant to booster",
  "Airport meet & greet available",
  "Licensed & insured local drivers",
];

const Arrow = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
    <path d="M2 8h11M9 4l4 4-4 4" />
  </svg>
);
const ArrowUpRight = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
    <path d="M4 12 12 4M6 4h6v6" />
  </svg>
);

/* ─── Animated route map ─────────────────────────────────────────────── */
function RouteMap() {
  const reduced = useReducedMotion();
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const carRef = useRef<SVGCircleElement>(null);
  const [tripIdx, setTripIdx] = useState(0);
  const [swapping, setSwapping] = useState(false);

  useEffect(() => {
    const paths = pathRefs.current.filter(Boolean) as SVGPathElement[];
    const lens = paths.map((p) => p.getTotalLength());
    paths.forEach((p, i) => {
      p.style.strokeDasharray = `${lens[i]}`;
      p.style.strokeDashoffset = reduced ? "0" : `${lens[i]}`;
      p.style.opacity = reduced ? "0.55" : "0";
    });
    if (reduced) return;

    const DUR = 3600;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let idx = 0;
    let start: number | null = null;
    let raf = 0;
    let swapTimer: ReturnType<typeof setTimeout> | undefined;
    paths[0].style.opacity = "1";

    const frame = (ts: number) => {
      if (start === null) start = ts;
      let t = (ts - start) / DUR;
      if (t >= 1) {
        const prev = paths[idx];
        prev.style.transition = "opacity 1.2s";
        prev.style.opacity = "0.28";
        idx = (idx + 1) % paths.length;
        start = ts;
        t = 0;
        const cur = paths[idx];
        cur.style.transition = "none";
        cur.style.strokeDashoffset = `${lens[idx]}`;
        cur.style.opacity = "1";
        setSwapping(true);
        const next = idx;
        swapTimer = setTimeout(() => {
          setTripIdx(next);
          setSwapping(false);
        }, 300);
      }
      const e = ease(Math.min(t * 1.15, 1));
      const p = paths[idx];
      p.style.strokeDashoffset = `${lens[idx] * (1 - e)}`;
      const pt = p.getPointAtLength(lens[idx] * e);
      const car = carRef.current;
      if (car) {
        car.setAttribute("cx", `${pt.x}`);
        car.setAttribute("cy", `${pt.y}`);
        car.style.opacity = `${t < 0.9 ? 1 : (1 - t) * 10}`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      if (swapTimer) clearTimeout(swapTimer);
    };
  }, [reduced]);

  const trip = TRIPS[tripIdx];

  return (
    <div className={`${styles.mapWrap} ${styles.rise} ${styles.d4}`}>
      <svg className={styles.map} viewBox="0 0 600 520" role="img" aria-labelledby="tnt-map-title tnt-map-desc">
        <title id="tnt-map-title">TNT Tours service area map: Anaheim, Los Angeles and Southern California airports</title>
        <desc id="tnt-map-desc">
          Private transportation routes from LAX, John Wayne (SNA), Long Beach (LGB), Burbank (BUR), Ontario (ONT) and San
          Diego (SAN) airports to Anaheim and the Disneyland Resort, plus guided tours from Anaheim to Hollywood and Santa Monica.
        </desc>
        <defs>
          <linearGradient id="tnt-ocean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FAF8F4" stopOpacity="0" />
            <stop offset=".6" stopColor="#FAF8F4" stopOpacity=".07" />
            <stop offset="1" stopColor="#FAF8F4" stopOpacity="0" />
          </linearGradient>
          {/* Fades the ocean out toward the map's left edge so it never reads as a box */}
          <linearGradient id="tnt-ocean-x" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".22" stopColor="#fff" />
          </linearGradient>
          <mask id="tnt-ocean-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="520">
            <rect width="600" height="520" fill="url(#tnt-ocean-x)" />
          </mask>
          <linearGradient id="tnt-route" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="600" y2="520">
            <stop offset="0" stopColor="#C9A96E" />
            <stop offset="1" stopColor="#E07A4A" />
          </linearGradient>
          <filter id="tnt-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="tnt-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="rgba(250,248,244,.09)" />
          </pattern>
        </defs>

        <rect x="0" y="0" width="600" height="520" fill="url(#tnt-dots)" />
        <path
          fill="url(#tnt-ocean)"
          mask="url(#tnt-ocean-fade)"
          d="M0 120 C40 140 70 160 92 178 C108 205 112 238 128 262 C160 300 205 322 252 346 C300 372 330 396 380 428 C430 458 480 480 540 520 L0 520 Z"
        />
        <path
          className={styles.coast}
          d="M0 120 C40 140 70 160 92 178 C108 205 112 238 128 262 C160 300 205 322 252 346 C300 372 330 396 380 428 C430 458 480 480 540 520"
        />
        <text x="24" y="335" className={styles.ocean}>PACIFIC OCEAN</text>

        <g>
          {TRIPS.map((t, i) => (
            <g key={t.d}>
              <path d={t.d} className={styles.routeBase} />
              <path
                d={t.d}
                className={styles.route}
                ref={(el) => {
                  pathRefs.current[i] = el;
                }}
              />
            </g>
          ))}
        </g>

        <g className={styles.node}>
          <circle cx="104" cy="196" r="3" /><text x="40" y="182">SANTA MONICA</text>
          <circle cx="182" cy="128" r="3" /><text x="150" y="116">HOLLYWOOD</text>
          <circle cx="214" cy="72" r="3.5" /><text className={styles.code} x="202" y="70" textAnchor="end">BUR</text><text className={styles.sub} x="202" y="84" textAnchor="end">Burbank</text>
          <circle cx="142" cy="246" r="3.5" /><text className={styles.code} x="70" y="252">LAX</text>
          <circle cx="262" cy="318" r="3.5" /><text className={styles.code} x="214" y="306">LGB</text>
          <circle cx="500" cy="168" r="3.5" /><text className={styles.code} x="512" y="166">ONT</text><text className={styles.sub} x="512" y="180">Ontario</text>
          <circle cx="410" cy="378" r="3.5" /><text className={styles.code} x="422" y="382">SNA</text><text className={styles.sub} x="422" y="396">John Wayne</text>
          <circle cx="520" cy="480" r="3.5" /><text className={styles.code} x="476" y="470">SAN</text><text className={styles.sub} x="532" y="484">San Diego ↓</text>
        </g>

        <g className={styles.node}>
          <circle className={styles.ring} cx="372" cy="268" r="10" />
          <circle className={`${styles.ring} ${styles.ringTwo}`} cx="372" cy="268" r="10" />
          <circle cx="372" cy="268" r="6" fill="#C9A96E" />
          <circle cx="372" cy="268" r="2.2" fill="#0C0B0A" />
          <text className={styles.homeLabel} x="390" y="262">Anaheim</text>
          <text x="390" y="280">DISNEYLAND RESORT</text>
        </g>

        <circle ref={carRef} r="4" className={styles.car} style={{ opacity: 0 }} />
      </svg>

      <div className={styles.ticket} aria-hidden="true">
        <div className={styles.ticketRow}>
          <span>Private ride</span>
          <span className={styles.live}>
            <i />
            On route
          </span>
        </div>
        <div className={`${styles.tripBody} ${swapping ? styles.swap : ""}`}>
          <div className={styles.trip}>
            <span>{trip.from}</span>
            <span className={styles.tripArrow} />
            <span>{trip.to}</span>
          </div>
          <div className={styles.meta}>
            <b>{trip.label}</b> {trip.detail}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Black Sprinter on the road ─────────────────────────────────────── */
function SprinterStage() {
  return (
    <div className={styles.stage}>
      <div className={styles.palms} aria-hidden="true" />
      <div className={styles.road} aria-hidden="true" />
      <div className={styles.rig}>
        <svg className={styles.van} viewBox="0 0 900 250" role="img" aria-labelledby="tnt-van-title tnt-van-desc">
          <title id="tnt-van-title">Black Sprinter van for Anaheim airport transportation and LA tours</title>
          <desc id="tnt-van-desc">
            A private black Mercedes Sprinter-style van with tinted windows and ambient lighting, used by TNT Tours for airport
            transfers, Disneyland transportation and group tours.
          </desc>
          <defs>
            <linearGradient id="tnt-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a342c" />
              <stop offset=".18" stopColor="#1c1917" />
              <stop offset=".55" stopColor="#0c0b0a" />
              <stop offset="1" stopColor="#14110e" />
            </linearGradient>
            <linearGradient id="tnt-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#3b352d" />
              <stop offset=".5" stopColor="#100e0c" />
              <stop offset="1" stopColor="#3a2a20" />
            </linearGradient>
            <linearGradient id="tnt-beam" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#FAF8F4" stopOpacity=".55" />
              <stop offset="1" stopColor="#FAF8F4" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="tnt-glint" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset=".5" stopColor="#E8D5B0" stopOpacity=".35" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="tnt-rim" cx=".4" cy=".35" r=".7">
              <stop offset="0" stopColor="#a39c8f" />
              <stop offset=".6" stopColor="#4a443b" />
              <stop offset="1" stopColor="#1c1917" />
            </radialGradient>
            <filter id="tnt-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
            <clipPath id="tnt-body-clip">
              <path
                id="tnt-body-shape"
                d="M36 186 L36 62 Q36 36 62 34 L548 30 Q574 30 588 46 L640 104 Q652 116 676 122 L718 134 Q738 140 739 162 L740 188 Q740 198 730 198 L632 198 A44 44 0 1 0 548 198 L202 198 A44 44 0 1 0 118 198 L46 198 Q36 198 36 188 Z"
              />
            </clipPath>
          </defs>

          <path className={styles.beam} d="M734 150 L900 112 L900 214 Z" fill="url(#tnt-beam)" filter="url(#tnt-soft)" />
          <ellipse cx="390" cy="218" rx="370" ry="10" fill="#000" opacity=".55" filter="url(#tnt-soft)" />

          <g className={styles.chassis}>
            <use href="#tnt-body-shape" fill="url(#tnt-body)" />
            <g clipPath="url(#tnt-body-clip)">
              <rect x="36" y="112" width="700" height="1.5" fill="#FAF8F4" opacity=".14" />
              <rect x="36" y="176" width="700" height="1" fill="#C9A96E" opacity=".25" />
              <rect x="36" y="150" width="700" height="48" fill="#E07A4A" opacity=".06" />
              <rect className={styles.glint} x="-160" y="20" width="140" height="190" fill="url(#tnt-glint)" />
            </g>
            <rect x="92" y="52" width="96" height="48" rx="7" fill="url(#tnt-glass)" />
            <rect x="196" y="52" width="96" height="48" rx="7" fill="url(#tnt-glass)" />
            <rect x="300" y="52" width="96" height="48" rx="7" fill="url(#tnt-glass)" />
            <rect x="404" y="52" width="104" height="48" rx="7" fill="url(#tnt-glass)" />
            <path d="M518 52 L566 52 Q578 52 586 62 L620 102 L518 102 Z" fill="url(#tnt-glass)" />
            <path d="M98 56 L140 56 L112 96 L98 96 Z" fill="#fff" opacity=".05" />
            <path d="M306 56 L348 56 L320 96 L306 96 Z" fill="#fff" opacity=".05" />
            <line className={styles.led} x1="96" y1="99" x2="506" y2="99" stroke="#C9A96E" strokeWidth="2" strokeLinecap="round" />
            <path d="M398 108 L398 196" stroke="#000" strokeOpacity=".6" strokeWidth="1.4" />
            <path d="M512 108 L512 196" stroke="#000" strokeOpacity=".5" strokeWidth="1.2" />
            <rect x="380" y="122" width="12" height="3" rx="1.5" fill="#6b645a" />
            <rect x="524" y="122" width="12" height="3" rx="1.5" fill="#6b645a" />
            <path d="M604 78 L620 76 Q626 76 626 82 L626 90 L606 92 Z" fill="#0c0b0a" stroke="#3a342c" />
            <text x="196" y="158" className={styles.livery}>TNT</text>
            <text x="252" y="156" className={styles.liverySmall}>TOURS &amp; TRANSPORTATION</text>
            <path d="M706 136 L734 146 L733 156 L708 152 Z" fill="#fff7ea" />
            <path d="M706 136 L734 146 L733 156 L708 152 Z" fill="#FAF8F4" filter="url(#tnt-soft)" opacity=".9" />
            <rect x="36" y="118" width="6" height="34" rx="2" fill="#E07A4A" />
            <rect x="30" y="116" width="14" height="38" rx="4" fill="#E07A4A" opacity=".45" filter="url(#tnt-soft)" />
            <rect x="722" y="164" width="16" height="16" rx="3" fill="#070605" stroke="#3a342c" />
            <rect x="690" y="188" width="50" height="8" rx="3" fill="#070605" />
          </g>

          {[160, 590].map((x) => (
            <g key={x} transform={`translate(${x} 182)`}>
              <circle r="34" fill="#070605" />
              <circle r="33" fill="none" stroke="#252019" strokeWidth="2" />
              <g className={styles.spin}>
                <circle r="20" fill="url(#tnt-rim)" />
                <g stroke="#100e0c" strokeWidth="3.2" strokeLinecap="round">
                  <path d="M0 -6 L0 -18" />
                  <path d="M5.7 -1.9 L17.1 -5.6" />
                  <path d="M3.5 4.9 L10.6 14.6" />
                  <path d="M-3.5 4.9 L-10.6 14.6" />
                  <path d="M-5.7 -1.9 L-17.1 -5.6" />
                </g>
                <circle r="5" fill="#1c1917" stroke="#a39c8f" strokeWidth="1" />
              </g>
            </g>
          ))}
        </svg>
      </div>

      <ul className={styles.perks} aria-label="Why ride with TNT">
        {PERKS.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────────── */
export default function Hero() {
  return (
    <section id="home" className={styles.hero} aria-label="TNT Tours private transportation and LA tours from Anaheim">
      <div className={styles.grain} aria-hidden="true" />

      <div className={styles.grid}>
        <div className={styles.copy}>
          <p className={`${styles.eyebrow} ${styles.rise} ${styles.d1}`}>
            <i aria-hidden="true" />
            Anaheim · Los Angeles · Orange County
          </p>
          <h1 className={`${styles.h1} ${styles.rise} ${styles.d2}`}>
            Private Transportation &amp; LA Tours <em>from Anaheim</em>
          </h1>
          <p className={`${styles.lede} ${styles.rise} ${styles.d3}`}>
            Anaheim airport transportation from LAX, SNA and Long Beach, Disneyland and hotel transfers,{" "}
            <Link href="/transportation/hourly-charter">hourly charters</Link>, and guided Los Angeles &amp; Hollywood tours or a{" "}
            <Link href="/private-los-angeles-tour">private LA tour</Link>. Black sedans, SUVs and Sprinter vans, door to door, with{" "}
            <strong>free child car seats</strong> on request.
          </p>
          <div className={`${styles.ctas} ${styles.rise} ${styles.d4}`}>
            <Link href="/transportation/book" className={`${styles.btn} ${styles.primary}`}>
              Book Transportation
              <Arrow />
            </Link>
            <Link href="#tours" className={`${styles.btn} ${styles.ghost}`}>
              Explore LA Tours
            </Link>
          </div>
          <dl className={`${styles.proof} ${styles.rise} ${styles.d5}`}>
            <div>
              <dt>Google</dt>
              <dd>
                5.0<span className={styles.star} aria-hidden="true">★</span>
              </dd>
            </div>
            <div>
              <dt>TripAdvisor</dt>
              <dd>
                5.0<span className={styles.star} aria-hidden="true">★</span>
              </dd>
            </div>
            <div>
              <dt>Happy guests</dt>
              <dd>500+</dd>
            </div>
            <div>
              <dt>Airports served</dt>
              <dd>6</dd>
            </div>
          </dl>
        </div>

        <RouteMap />
      </div>

      <SprinterStage />

      <nav className={`${styles.services} ${styles.rise} ${styles.d6}`} aria-label="Popular services">
        {SERVICES.map((s) => (
          <Link key={s.href} href={s.href} className={styles.svc}>
            <span>
              <span className={styles.svcTitle}>{s.title}</span>
              <span className={styles.svcSub}>{s.sub}</span>
            </span>
            <ArrowUpRight />
          </Link>
        ))}
      </nav>
    </section>
  );
}
