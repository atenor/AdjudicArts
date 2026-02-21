'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './homepage.module.css';


// ─── Cormorant Garamond is loaded via next/font in layout or globals.
// Add to your app/marketing/layout.tsx or app/layout.tsx:
//   import { Cormorant_Garamond } from 'next/font/google'
//   const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300','600','700'], style: ['normal','italic'] })
// Then add className={cormorant.variable} to <html> and use var(--font-cormorant) in CSS.
// Inter is typically loaded globally already.

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const TYPEWRITER_LINES = [
  'for competitions.',
  'for auditions.',
  'for juries.',
  'for scholarships.',
  'for festivals.',
  'for any adjudication.',
];
const TERMINAL_LINE = 'for any adjudication.';
const RESTART_DELAY_MS = 10_000;

const LOGO_ORGS = [
  'NATS', 'MTNA', 'YPSCA', 'Winston Found.', 'Orpheus Society',
  'Civic Arts', 'Aria Institute', 'NEC', 'Interlochen', 'Bel Canto', 'ACDA', 'Juilliard',
];

const DISCIPLINES = [
  'Voice Competition', 'Dance Audition', 'Film Jury', 'Scholarship Panel', 'Multi-Disciplinary',
];

const TOUR_TABS = [
  { key: 'dashboard', label: 'Admin Dashboard', url: 'adjudicarts.app/dashboard' },
  { key: 'scoring',   label: 'Judge Scoring',   url: 'adjudicarts.app/dashboard/scoring/0047' },
  { key: 'results',   label: 'Results & Rankings', url: 'adjudicarts.app/dashboard/events/1/results' },
];

// ─── SVG AVATAR (reused throughout) ─────────────────────────────────────────
function AvatarSvg({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 22 22" width={size} height={size}>
      <circle cx="11" cy="11" r="11" fill="#ede6f7"/>
      <circle cx="11" cy="8" r="4" fill="#6B4BAA"/>
      <ellipse cx="11" cy="18" rx="7" ry="4" fill="#6B4BAA"/>
    </svg>
  );
}

// ─── SCORE DOTS ──────────────────────────────────────────────────────────────
function ScoreDots({ filled, accent, total = 10 }: { filled: number; accent: number; total?: number }) {
  return (
    <div className={styles.sdots}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`${styles.sd} ${
            i < filled ? styles.sdF : i === accent ? styles.sdA : styles.sdE
          }`}
        />
      ))}
    </div>
  );
}

// ─── SCORE CHIPS ─────────────────────────────────────────────────────────────
function ScoreChips({ selected, total = 10 }: { selected: number; total?: number }) {
  return (
    <div className={styles.ccChips}>
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const cls = n < selected ? styles.ccF : n === selected ? styles.ccS : styles.ccE;
        return <div key={n} className={`${styles.cc} ${cls}`}>{n}</div>;
      })}
    </div>
  );
}

// ─── TOUR SCREENS ────────────────────────────────────────────────────────────

function TourDashboard() {
  const rows = [
    { name: 'E. Vasquez', disc: 'Soprano', chapter: 'Northeast', pillClass: styles.tpP, pillText: 'In Review' },
    { name: 'M. Chen',    disc: 'Tenor',   chapter: 'Pacific',   pillClass: styles.tpG, pillText: 'Approved' },
    { name: 'S. Ramirez', disc: 'Mezzo',   chapter: 'Southeast', pillClass: styles.tpD, pillText: 'Submitted' },
  ];
  return (
    <>
      <div className={styles.tnav}>
        <div className={`${styles.tnavLogo} cormorant`}>Adjudic<span>arts</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>A. Reeves</span>
          <div className={styles.tbadgeAdmin}>Admin</div>
        </div>
      </div>
      <div className={styles.dbBody}>
        <div className={styles.dbSb}>
          {['Dashboard','Events','Applications','Results'].map((item, i) => (
            <div key={item} className={`${styles.sbItem} ${i === 0 ? styles.sbItemOn : ''}`}>{item}</div>
          ))}
        </div>
        <div className={styles.dbMain}>
          <div className={styles.dbTitle}>Dashboard</div>
          <div className={styles.dbStats}>
            {[['71','Applications'],['2','Events'],['8','Judges'],['43','Scored']].map(([n,l]) => (
              <div key={l} className={styles.dbStat}>
                <div className={styles.dsn}>{n}</div>
                <div className={styles.dsl}>{l}</div>
              </div>
            ))}
          </div>
          <div className={styles.dbTl}>Recent Applications</div>
          <table className={styles.dbTbl}>
            <thead>
              <tr><th>Applicant</th><th>Discipline</th><th>Chapter</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.name}>
                  <td>
                    <div className={styles.tn}>
                      <div className={styles.avs}><AvatarSvg /></div>
                      <span style={{ color: '#1e1538', fontWeight: 600 }}>{r.name}</span>
                    </div>
                  </td>
                  <td>{r.disc}</td>
                  <td>{r.chapter}</td>
                  <td><span className={`${styles.tpill} ${r.pillClass}`}>{r.pillText}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function TourScoring() {
  const criteria = [
    { name: 'Vocal Technique', sel: 9 },
    { name: 'Tone Quality',    sel: 10 },
    { name: 'Musicality',      sel: 8 },
    { name: 'Interpretation',  sel: 9 },
  ];
  return (
    <>
      <div className={styles.tnav}>
        <div className={`${styles.tnavLogo} cormorant`}>Adjudic<span>arts</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>M. Thornton</span>
          <div className={styles.tbadgeJudge}>National Judge</div>
        </div>
      </div>
      <div className={styles.scGrid}>
        <div className={styles.scL}>
          <div className={styles.scApp}>
            <div className={styles.scAv}>
              <svg viewBox="0 0 40 40" width="40" height="40">
                <circle cx="20" cy="20" r="20" fill="#ede6f7"/>
                <circle cx="20" cy="15" r="7" fill="#6B4BAA"/>
                <ellipse cx="20" cy="31" rx="12" ry="7" fill="#6B4BAA"/>
              </svg>
            </div>
            <div>
              <div className={styles.scName}>Elena Vasquez</div>
              <div className={styles.scMeta}>Soprano · Northeast · #0047</div>
            </div>
          </div>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8a7fa8', marginBottom: 7 }}>
            Rubric Scores (0–10)
          </div>
          {criteria.map(c => (
            <div key={c.name} className={styles.scCrit}>
              <span className={styles.ccN}>{c.name}</span>
              <ScoreChips selected={c.sel} />
            </div>
          ))}
          <div className={styles.scCm}>
            <div className={styles.scCl}>Judge&apos;s Comment</div>
            <div className={styles.scCb}>
              &ldquo;Exceptional breath support and register control. The Puccini showed real stylistic depth and remarkable stage maturity.&rdquo;
            </div>
          </div>
          <div className={styles.scTot}>
            <span className={styles.scTl}>Running Total</span>
            <span className={styles.scTv}>87 / 100</span>
          </div>
          <button className={styles.scBtn}>Save &amp; Next →</button>
        </div>
        <div className={styles.scR}>
          <div className={styles.scVl}>Now Performing</div>
          <div className={styles.scVt}>
            <div className={styles.scVp}>▶</div>
          </div>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#1e1538', marginBottom: 2 }}>Nel Silenzio</div>
          <div style={{ fontSize: '0.65rem', color: '#8a7fa8', marginBottom: 12 }}>Puccini</div>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8a7fa8', marginBottom: 6 }}>Also Performing</div>
          <div style={{ fontSize: '0.72rem', color: '#4a3d6b', lineHeight: 2.1 }}>
            Va! Laisse Couler...<br/>
            <span style={{ color: '#8a7fa8', fontSize: '0.62rem' }}>Massenet</span><br/>
            Lullaby<br/>
            <span style={{ color: '#8a7fa8', fontSize: '0.62rem' }}>Menotti</span>
          </div>
        </div>
      </div>
    </>
  );
}

function TourResults() {
  const rows = [
    { rank: '#1', rankClass: styles.rk1, name: 'E. Vasquez', disc: 'Soprano', score: 94.0, pct: 94, pillClass: styles.tpG, pillText: 'Approved' },
    { rank: '#2', rankClass: styles.rk2, name: 'M. Chen',    disc: 'Tenor',   score: 89.3, pct: 89, pillClass: styles.tpP, pillText: 'Review' },
    { rank: '#3', rankClass: styles.rk3, name: 'S. Ramirez', disc: 'Mezzo',   score: 85.7, pct: 85, pillClass: styles.tpP, pillText: 'Review' },
    { rank: '#4', rankClass: styles.rk4, name: 'J. Whitfield',disc:'Baritone',score: 80.5, pct: 80, pillClass: styles.tpD, pillText: 'Pending' },
  ];
  return (
    <>
      <div className={styles.tnav}>
        <div className={`${styles.tnavLogo} cormorant`}>Adjudic<span>arts</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>A. Reeves</span>
          <div className={styles.tbadgeAdmin}>Admin</div>
        </div>
      </div>
      <div className={styles.rsBody}>
        <div className={styles.rsHdr}>
          <div className={styles.rsTitle}>National Round — Rankings</div>
          <button className={styles.rsExp}>↓ Export CSV</button>
        </div>
        <table className={styles.rsTbl}>
          <thead>
            <tr><th>Rank</th><th>Applicant</th><th>Discipline</th><th>Score</th><th>Panel</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name}>
                <td><span className={`${styles.rk} ${r.rankClass}`}>{r.rank}</span></td>
                <td>
                  <div className={styles.tn}>
                    <div className={styles.avs}><AvatarSvg /></div>
                    <span style={{ color: '#1e1538', fontWeight: 600 }}>{r.name}</span>
                  </div>
                </td>
                <td>{r.disc}</td>
                <td>
                  <div className={styles.bw}>
                    <div className={styles.bar}>
                      <div className={styles.barF} style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className={styles.sct}>{r.score.toFixed(1)}</span>
                  </div>
                </td>
                <td style={{ color: '#8a7fa8' }}>3</td>
                <td><span className={`${styles.tpill} ${r.pillClass}`}>{r.pillText}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── PRICING CARD ─────────────────────────────────────────────────────────────
interface PricingCardProps {
  tier: string;
  name: string;
  price: string;
  desc: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
  featured?: boolean;
  badge?: string;
}
function PricingCard({ tier, name, price, desc, features, ctaText, ctaHref, featured, badge }: PricingCardProps) {
  return (
    <div className={`${styles.pc} ${featured ? styles.pcFeat : ''}`}>
      <div className={`${styles.pcHead} ${featured ? styles.pcHeadFeat : ''}`}>
        {badge && <div className={styles.pcBadge}>{badge}</div>}
        <div className={`${styles.pcTier} ${featured ? styles.pcTierFeat : ''}`}>{tier}</div>
        <div className={`${styles.pcName} ${featured ? styles.pcNameFeat : ''}`}>{name}</div>
        <div className={styles.pcPrice}>
          <span className={`${styles.pcDollar} ${featured ? styles.pcDollarFeat : ''}`}>$</span>
          <span className={`${styles.pcAmt} ${featured ? styles.pcAmtFeat : ''}`}>{price}</span>
          <span className={`${styles.pcPer} ${featured ? styles.pcPerFeat : ''}`}>/mo</span>
        </div>
        <p className={`${styles.pcDesc} ${featured ? styles.pcDescFeat : ''}`}>{desc}</p>
      </div>
      <div className={styles.pcFeats}>
        {features.map(f => (
          <div key={f} className={styles.pcFeat2}>
            <span className={`${styles.pcCk} ${featured ? styles.pcCkFeat : ''}`}>✓</span> {f}
          </div>
        ))}
      </div>
      <Link href={ctaHref} className={`${styles.pcCta} ${featured ? styles.pcCtaFilled : styles.pcCtaOutline}`}>
        {ctaText}
      </Link>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function MarketingHomepage() {
  const [annVisible, setAnnVisible] = useState(true);
  const [activeDiscipline, setActiveDiscipline] = useState(0);
  const [activeTourTab, setActiveTourTab] = useState(0);
  const [typewriterText, setTypewriterText] = useState('We\'ll handle the rest.');
  const [showCursor, setShowCursor] = useState(true);


  // Typewriter effect
  useEffect(() => {
    let lineIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    let restartTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const runSequence = () => {
      lineIndex = 0;
      charIndex = 0;
      deleting = false;
      setShowCursor(true);
      tick();
    };

    const tick = () => {
      if (cancelled) return;
      const line = TYPEWRITER_LINES[lineIndex];
      const isLastLine = line === TERMINAL_LINE;

      if (!deleting) {
        charIndex++;
        setTypewriterText(line.substring(0, charIndex));

        if (charIndex === line.length) {
          if (isLastLine) {
            // Terminal line reached — stop cursor, hold, then restart after 10s
            setShowCursor(false);
            restartTimer = setTimeout(() => {
              if (!cancelled) {
                setTypewriterText('');
                runSequence();
              }
            }, RESTART_DELAY_MS);
            return;
          }
          deleting = true;
          timer = setTimeout(tick, 2000);
          return;
        }
        timer = setTimeout(tick, 55);
      } else {
        charIndex--;
        setTypewriterText(line.substring(0, charIndex));
        if (charIndex === 0) {
          deleting = false;
          lineIndex++;
          timer = setTimeout(tick, 300);
          return;
        }
        timer = setTimeout(tick, 28);
      }
    };

    const startTimer = setTimeout(runSequence, 1600);
    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      clearTimeout(timer);
      clearTimeout(restartTimer);
    };
  }, []);

  // Scroll fade-in
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add(styles.fadeUpVisible);
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(`.${styles.fadeUp}`).forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const dupes = [...LOGO_ORGS, ...LOGO_ORGS]; // duplicate for seamless marquee

  return (
    <div className={styles.pageRoot} style={{ background: '#ede6f7', minHeight: '100vh' }}>

      {/* ── ANNOUNCE BAR ── */}
      {annVisible && (
        <div className={styles.ann}>
          <span>AdjudicArts now supports voice, dance, film, and multi-disciplinary competitions.</span>
          <Link href="#how-it-works">See what&apos;s new →</Link>
          <button className={styles.annX} onClick={() => setAnnVisible(false)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLogo}>
          <svg width="26" height="33" viewBox="0 0 68 88" fill="none">
            <defs>
              <radialGradient id="lg" cx="50%" cy="0%" r="90%">
                <stop offset="0%" stopColor="#462B7C" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#462B7C" stopOpacity="0"/>
              </radialGradient>
            </defs>
            <rect x="27" y="4" width="14" height="7" rx="2" fill="#C9A84C"/>
            <circle cx="34" cy="7.5" r="2.4" fill="#a07820"/>
            <path d="M 34 11 L 7 66 L 61 66 Z" fill="url(#lg)"/>
            <line x1="34" y1="11" x2="7" y2="66" stroke="#F5F0FC" strokeWidth="1.1" opacity="0.7"/>
            <line x1="34" y1="11" x2="61" y2="66" stroke="#F5F0FC" strokeWidth="1.1" opacity="0.7"/>
            <line x1="3" y1="76" x2="65" y2="76" stroke="#F5F0FC" strokeWidth="2.5" strokeLinecap="round"/>
            <ellipse cx="34" cy="68" rx="22" ry="3.5" fill="#F5F0FC" opacity="0.35"/>
          </svg>
          <div className={`${styles.navWordmark} cormorant`}>
            <span className={styles.adjudic}>Adjudic</span>
            <span className={styles.arts}>arts</span>
          </div>
        </Link>
        <ul className={styles.navLinks}>
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#product">Product</a></li>
          <li><a href="#pricing">Pricing</a></li>
        </ul>
        <div className={styles.navRight}>
          <Link href="/dashboard/login" className={styles.navSignIn}>Sign In</Link>
          <Link href="#pricing" className={styles.navCta}>Request a Pilot</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={`${styles.heroRing} ${styles.ring1}`} />
        <div className={`${styles.heroRing} ${styles.ring2}`} />
        <div className={`${styles.heroRing} ${styles.ring3}`} />
        <div className={styles.heroGrain} />

        <div className={styles.heroInner}>
          <div className={`${styles.trust} ${styles.fadeUp}`}>
            <span className={styles.trustDot} />
            <span style={{ fontWeight: 600, color: '#1e1538' }}>Purpose-built for adjudication</span>
            <span className={styles.trustSep} />
            <span className={styles.trustStar}>★★★★★</span>
            <span>4.9 from beta organizations</span>
          </div>

          <h1 className={`${styles.heroH1} ${styles.fadeUp}`}>
            Be judgy,<br />
            <span className={styles.heroLine2}>
              {typewriterText}
              {showCursor && <span className={styles.cursor} />}
            </span>
          </h1>

          <p className={`${styles.heroP} ${styles.fadeUp}`}>
            <strong>Adjudication software for competitions, juries, and scholarship panels.</strong><br />
            Replace spreadsheets, paper scoresheets, and email chaos with one platform — built for any discipline.
          </p>

          <div className={`${styles.heroBtns} ${styles.fadeUp}`}>
            <Link href="#pricing" className={styles.btnPrimary}>
              Request a Pilot <span>→</span>
            </Link>
            <a href="#product" className={styles.btnSecondary}>
              <span className={styles.playRing}>▶</span>
              See it in action
            </a>
          </div>
        </div>

        {/* ── FLOATING CARDS ── */}
        <div className={`${styles.heroVis} ${styles.fadeUp}`}>
          <svg className={styles.connSvg} viewBox="0 0 1000 310" fill="none">
            <path d="M 200 65 C 340 65 420 155 500 155" stroke="#462B7C" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.18"/>
            <path d="M 800 75 C 660 75 580 155 500 155" stroke="#462B7C" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.18"/>
            <path d="M 215 265 C 370 265 445 155 500 155" stroke="#C9A84C" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.15"/>
            <path d="M 785 272 C 640 272 560 155 500 155" stroke="#C9A84C" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.15"/>
            <circle cx="500" cy="155" r="5" fill="#462B7C" opacity="0.3"/>
            <circle cx="500" cy="155" r="11" fill="#462B7C" opacity="0.06"/>
          </svg>

          {/* Hub */}
          <div className={styles.hub}>
            <div className={styles.hubSq}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" rx="1.5" fill="rgba(255,255,255,0.9)"/>
                <rect x="9" y="2" width="5" height="5" rx="1.5" fill="rgba(255,255,255,0.55)"/>
                <rect x="2" y="9" width="5" height="5" rx="1.5" fill="rgba(255,255,255,0.55)"/>
                <rect x="9" y="9" width="5" height="5" rx="1.5" fill="rgba(255,255,255,0.9)"/>
              </svg>
            </div>
            AdjudicArts Platform
          </div>

          {/* Card 1: Intake */}
          <div className={`${styles.fc} ${styles.fc1}`}>
            <div className={styles.fcEy}>Application Received</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
              <div className={styles.av}><AvatarSvg size={24} /></div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e1538' }}>E. Vasquez</div>
                <div style={{ fontSize: '0.6rem', color: '#8a7fa8' }}>Soprano · Northeast</div>
              </div>
            </div>
            <span className={styles.pillOk}>✓ Submitted</span>
          </div>

          {/* Card 2: Scoring */}
          <div className={`${styles.fc} ${styles.fc2}`}>
            <div className={styles.fcEy}>Judge Scoring</div>
            {[
              { label: 'Technique', filled: 8, accent: 8 },
              { label: 'Musicality', filled: 9, accent: 9 },
              { label: 'Presence',  filled: 7, accent: 7 },
            ].map(r => (
              <div key={r.label} className={styles.srow}>
                <div className={styles.sl}>{r.label}</div>
                <ScoreDots filled={r.filled} accent={r.accent} />
              </div>
            ))}
            <div style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: 800, color: '#462B7C', marginTop: 6 }}>87 / 100</div>
          </div>

          {/* Card 3: Rankings */}
          <div className={`${styles.fc} ${styles.fc3}`}>
            <div className={styles.fcEy}>Live Rankings</div>
            {[
              { n: '#1', cls: styles.rn1, name: 'E. Vasquez', score: '94.0' },
              { n: '#2', cls: styles.rn2, name: 'M. Chen',    score: '89.3' },
              { n: '#3', cls: styles.rn3, name: 'S. Ramirez', score: '85.7' },
            ].map(r => (
              <div key={r.n} className={styles.rrow}>
                <div className={`${styles.rn} ${r.cls}`}>{r.n}</div>
                <div className={styles.rnm}>{r.name}</div>
                <div className={styles.rsc}>{r.score}</div>
              </div>
            ))}
          </div>

          {/* Card 4: Progress */}
          <div className={`${styles.fc} ${styles.fc4}`} style={{ textAlign: 'center', padding: '14px 18px' }}>
            <div className={styles.statBig}>18<span style={{ fontSize: '1rem', color: '#8a7fa8', fontWeight: 400 }}>/26</span></div>
            <div className={styles.statLbl}>Applications Scored</div>
            <div className={styles.prog}><div className={styles.progF} style={{ width: '69%' }} /></div>
          </div>
        </div>
      </section>

      {/* ── LOGO BAND ── */}
      <div className={styles.logoBand}>
        <div className={styles.logoLbl}>Trusted by arts organizations</div>
        <div className={styles.logoTrackWrap}>
          <div className={styles.logoTrack}>
            {dupes.map((org, i) => (
              <div key={`${org}-${i}`} className={styles.logoItem}>{org}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CLARITY ── */}
      <div className={`${styles.sec} ${styles.bgWhite}`} style={{ textAlign: 'center', paddingTop: 80, paddingBottom: 80 }}>
        <h2 className={`${styles.sectionH2} ${styles.fadeUp}`} style={{ maxWidth: '100%', textAlign: 'center', margin: '0 auto 16px' }}>
          Built for <em>any competition.</em><br />Designed to replace the spreadsheet.
        </h2>
        <p className={styles.fadeUp} style={{ fontSize: '0.97rem', color: '#4a3d6b', maxWidth: 480, margin: '0 auto', lineHeight: 1.78 }}>
          Whether you&apos;re running a voice scholarship, a dance jury, a film competition, or a multi-disciplinary panel
          — AdjudicArts handles intake, scoring, and results in one place.
        </p>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section className={`${styles.sec} ${styles.bgCream}`} id="how-it-works" style={{ borderTop: '1px solid rgba(70,43,124,0.1)' }}>
        <div className={styles.secMax}>
          <p className={`${styles.eyebrow} ${styles.fadeUp}`}>How it works</p>
          <h2 className={`${styles.sectionH2} ${styles.fadeUp}`}><em>Every step</em> of the process,<br />in one platform.</h2>
          <p className={`${styles.sectionP} ${styles.fadeUp}`}>Configure it for your discipline — your criteria, your rounds, your workflow.</p>

          <div className={`${styles.dpills} ${styles.fadeUp}`}>
            {DISCIPLINES.map((d, i) => (
              <button
                key={d}
                className={`${styles.dp} ${activeDiscipline === i ? styles.dpOn : ''}`}
                onClick={() => setActiveDiscipline(i)}
              >
                {d}
              </button>
            ))}
          </div>

          <div className={styles.steps}>
            {[
              {
                n: '01', title: 'Applicant Intake',
                desc: 'A public form collects all submissions in one place. Applicants submit bios, repertoire, videos, and supporting materials — no email required.',
                chips: ['Public URL', 'Video Links', 'Auto-email'],
              },
              {
                n: '02', title: 'Judge Assignment',
                desc: 'Assign panel members to specific rounds instantly. Judges see only their assigned applicants. Track scoring progress in real time.',
                chips: ['Role-Based', 'Multi-Round', 'Live Progress'],
              },
              {
                n: '03', title: 'Structured Scoring',
                desc: 'Your rubric, your criteria — fully configurable. Judges score from any device with per-criterion comments. Autosaves continuously.',
                chips: ['Custom Rubric', 'Comments', 'Any Device'],
              },
              {
                n: '04', title: 'Results & Rankings',
                desc: 'Automatic rankings from all panel scores. Tie detection built in. One-click round advancement. Export to CSV with notifications at every stage.',
                chips: ['Auto-Rankings', 'CSV Export', 'Notifications'],
              },
            ].map(s => (
              <div key={s.n} className={`${styles.step} ${styles.fadeUp}`}>
                <span className={`${styles.stepN} cormorant`}>{s.n}</span>
                <div className={styles.stepTitle}>{s.title}</div>
                <p className={styles.stepDesc}>{s.desc}</p>
                <div className={styles.stepChips}>
                  {s.chips.map(c => <span key={c} className={styles.stepChip}>{c}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT TOUR ── */}
      <section className={`${styles.sec} ${styles.bgWhite}`} id="product" style={{ borderTop: '1px solid rgba(70,43,124,0.1)' }}>
        <div className={styles.secMax}>
          <p className={`${styles.eyebrow} ${styles.fadeUp}`}>The product</p>
          <h2 className={`${styles.sectionH2} ${styles.fadeUp}`}>See exactly what<br />you&apos;re <em>getting.</em></h2>

          <div className={styles.ttabs}>
            {TOUR_TABS.map((t, i) => (
              <button
                key={t.key}
                className={`${styles.tt} ${activeTourTab === i ? styles.ttOn : ''}`}
                onClick={() => setActiveTourTab(i)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className={styles.tourWin}>
            <div className={styles.tbar}>
              <div className={`${styles.tdot} ${styles.tdot1}`} />
              <div className={`${styles.tdot} ${styles.tdot2}`} />
              <div className={`${styles.tdot} ${styles.tdot3}`} />
              <div className={styles.turl}>{TOUR_TABS[activeTourTab].url}</div>
            </div>
            {activeTourTab === 0 && <TourDashboard />}
            {activeTourTab === 1 && <TourScoring />}
            {activeTourTab === 2 && <TourResults />}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section className={`${styles.sec} ${styles.bgCream}`} style={{ borderTop: '1px solid rgba(70,43,124,0.1)' }}>
        <div className={styles.secMax}>
          <p className={`${styles.eyebrow} ${styles.fadeUp}`} style={{ textAlign: 'center', marginBottom: 30 }}>
            What organizers say
          </p>
          <div className={`${styles.testCard} ${styles.fadeUp}`}>
            <div className={styles.testImg}>
              <div className={styles.testImgIn}>
                <svg viewBox="0 0 165 205" fill="none" width="165" height="205">
                  <rect width="165" height="205" fill="#ede6f7"/>
                  <circle cx="82" cy="75" r="36" fill="#c4b4e0"/>
                  <circle cx="82" cy="68" r="26" fill="#6B4BAA" opacity="0.7"/>
                  <ellipse cx="82" cy="175" rx="58" ry="40" fill="#6B4BAA" opacity="0.5"/>
                </svg>
              </div>
            </div>
            <div className={styles.testBody}>
              <div className={`${styles.testOrg} cormorant`}>Winston Foundation</div>
              <div className={styles.testQ}>
                We went from three weeks of spreadsheet chaos to having everything — applications, scores, and results — in one place. Our judges couldn&apos;t believe how easy it was.
              </div>
              <div className={styles.testName}>Dr. Margaret Holloway</div>
              <div className={styles.testRole}>Competition Chair, Shirley Rabb Winston Scholarship</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className={`${styles.sec} ${styles.bgWhite}`} id="pricing" style={{ borderTop: '1px solid rgba(70,43,124,0.1)' }}>
        <div className={styles.secMax}>
          <p className={`${styles.eyebrow} ${styles.fadeUp}`}>Pricing</p>
          <h2 className={`${styles.sectionH2} ${styles.fadeUp}`}>Built for organizations.<br /><em>Priced for organizations.</em></h2>
          <p className={`${styles.sectionP} ${styles.fadeUp}`}>No per-applicant fees. No hidden costs. One flat rate per competition season.</p>
          <div className={styles.pricingGrid}>
            <PricingCard
              tier="Starter" name="Chapter" price="49"
              desc="For smaller organizations running a single annual competition."
              features={['1 active event','Up to 75 applicants','Up to 5 judges','Custom scoring rubric','Email notifications','CSV export']}
              ctaText="Get Started" ctaHref="#"
            />
            <PricingCard
              tier="Professional" name="Regional" price="99"
              desc="For regional organizations managing multiple rounds with larger panels."
              features={['3 concurrent events','Up to 200 applicants','Unlimited judges','Multi-round management','Video integration','CSV import','Priority support']}
              ctaText="Start Free Trial" ctaHref="#"
              featured badge="Most Popular"
            />
            <PricingCard
              tier="Enterprise" name="National" price="249"
              desc="For national organizations across multiple chapters and disciplines."
              features={['Unlimited events','Unlimited applicants','Multi-org management','Custom rubric per event','White-label option','Dedicated onboarding']}
              ctaText="Contact Us" ctaHref="#"
            />
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section className={styles.ctaBand}>
        <div className={styles.ctaInner}>
          <p className={styles.eyebrow} style={{ textAlign: 'center', color: 'rgba(201,168,76,0.8)', marginBottom: 12 }}>
            Ready when you are
          </p>
          <h2 className={styles.ctaH2}>Your next competition<br />starts <em>here.</em></h2>
          <p className={styles.ctaP}>Set up in an afternoon. Running by tomorrow. Your panel will thank you.</p>
          <div className={styles.ctaBtns}>
            <Link href="#" className={styles.btnCtaWhite}>Request a Pilot →</Link>
            <Link href="/dashboard/login" className={styles.btnCtaGhost}>Sign In</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={`${styles.footerLogo} cormorant`}>Adjudic<span>arts</span></div>
        <div className={styles.footerCopy}>© 2026 AdjudicArts. Built for the adjudication world.</div>
        <div className={styles.footerLinks}>
          <Link href="#">Privacy</Link>
          <Link href="#">Terms</Link>
          <Link href="#">Support</Link>
          <Link href="/dashboard/login">Sign In</Link>
        </div>
      </footer>

    </div>
  );
}
