"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Check,
  Clock3,
  GraduationCap,
  Landmark,
  Quote,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import InstagramReels from "./InstagramReels";
import VisitorStat from "./VisitorStat";

export type HomeStat = {
  label: string;
  value: string;
  suffix: string;
  /** Icon name from the admin's list; falls back to the book icon. */
  iconKey: string;
};

/** Matches statIcons in the admin's entityConfig.ts. */
const STAT_ICONS: Record<string, LucideIcon> = {
  book: BookOpen,
  users: Users,
  graduation: GraduationCap,
  award: Award,
  campus: Landmark,
  library: BookOpen,
  activity: Sparkles,
  building: Building2,
};

export type HomeProgram = {
  title: string;
  fullTitle: string;
  description: string;
  duration: string;
  format: string;
  href: string;
  image: string;
};

export type HomeNewsItem = {
  category: string;
  date: string;
  title: string;
  description: string;
  image: string;
};

const image = (id: string, width = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;


export default function HomePage({
  news,
  programs = [],
  stats = [],
}: {
  news: HomeNewsItem[];
  programs?: HomeProgram[];
  stats?: HomeStat[];
}) {
  useEffect(() => {
    const revealItems = document.querySelectorAll<HTMLElement>(".reveal");
    const root = document.documentElement;
    root.classList.add("reveal-enabled");

    if (!("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return () => root.classList.remove("reveal-enabled");
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -48px", threshold: 0.12 },
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => {
      observer.disconnect();
      root.classList.remove("reveal-enabled");
    };
  }, []);

  return (
    <main>
      <section className="hero" aria-label="Royal College of Arts & Science">
        {/* Full-bleed campus photo behind the copy. Kept out of the
            screen-reader tree; the alt text is still the file's only
            description for image search. */}
        <div className="hero-bg" aria-hidden="true">
          <Image
            src="/images/spotlight.jpg"
            alt="Students on the Royal College of Arts & Science campus in Thrithala"
            fill
            priority
            sizes="100vw"
          />
        </div>
        <div className="hero-veil" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-grid-bg" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span>Admissions 2026–27 are now open</span>
              <ArrowUpRight size={15} strokeWidth={2.5} />
            </div>
            <h1 className="visually-hidden">
              Royal College of Arts &amp; Science
            </h1>
            <h2 className="hero-title">
              Knowledge for Today.
              <span>Skills for Tomorrow.</span>
            </h2>
            <p>
              Royal College of Arts &amp; Science brings together thoughtful
              teaching, a vibrant community and the confidence to build what comes next.
            </p>
            {/* No call to action in the hero by request: "Start your
                application" and "Talk to admissions" in the admissions panel
                are the only home page buttons, so the hero leads with copy
                and the proof line instead. */}
            <div className="hero-proof" />
          </div>
        </div>
      </section>

      <section className="stats-section" aria-label="Royal College at a glance">
        <div className="container">
          <div className="statbar">
            {stats.map((stat, index) => {
              // The visitor total is served by this site's counter, not the
              // CMS, so it renders its own card with its own loading state.
              if (stat.label.trim().toLowerCase() === "visitors") {
                return <VisitorStat key="visitors" index={index} />;
              }

              const Icon = STAT_ICONS[stat.iconKey] ?? BookOpen;

              return (
                <div
                    className={`stat reveal reveal-delay-${Math.min(index + 1, 4)}`}
                  key={stat.label}
                >
                  <span className="stat-icon">
                    <Icon size={18} />
                  </span>
                  <strong>
                    {stat.value}
                    {stat.suffix ? <span>{stat.suffix}</span> : null}
                  </strong>
                  <span className="stat-label">{stat.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section intro-section" id="about">
        <div className="container intro-grid">
          <div className="intro-copy reveal">
            <div className="section-kicker">01 / The Royal College experience</div>
            <h2>
              More than a college.
              <span>A community for what comes next.</span>
            </h2>
            <p className="muted">
              We believe education should open doors, broaden perspectives and give
              students the confidence to shape their own path. At Royal College, strong
              foundations meet a warm, ambitious community.
            </p>
            <div className="check-list">
              <div><Check size={16} /><span>Personal attention from experienced faculty</span></div>
              <div><Check size={16} /><span>Practical learning designed for tomorrow</span></div>
              <div><Check size={16} /><span>A values-led environment for every student</span></div>
            </div>
            <Link className="text-link" href="/about/about-college">
              Discover our story <ArrowRight size={17} />
            </Link>
          </div>
          <div className="intro-visual reveal reveal-delay-2">
            <div className="intro-image">
              <Image
                src="/images/graduation-caps.png"
                alt="Graduates joyfully tossing their caps into the air"
                fill
                sizes="(max-width: 900px) 100vw, 620px"
              />
            </div>
            <div className="intro-note">
              <Quote size={20} />
              <p>“The best education changes how you see the world.”</p>
              <span>Our founding belief</span>
            </div>
            <div className="intro-caption">
              <span className="caption-mark">RC</span>
              <span>Curiosity · Character · Community</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-soft programs-section" id="programs">
        <div className="container">
          <div className="section-head programs-head reveal">
            <div>
              <div className="section-kicker">02 / Academic programs</div>
              <h2>Choose a path that fits your future.</h2>
            </div>
            <div className="section-head-aside">
              <p>Thoughtful curricula, practical learning and support at every step.</p>
              <Link className="text-link" href="/academics">
                View all programs <ArrowRight size={17} />
              </Link>
            </div>
          </div>
          <div className="program-grid">
            {programs.length === 0 ? (
              <p className="muted">
                Programmes will appear here once they are published.
              </p>
            ) : null}
            {programs.map((program, index) => (
              <Link
                className={`program-card reveal reveal-delay-${index + 1}`}
                href={program.href}
                key={program.title}
              >
                <div className="program-image">
                  <img
                    src={program.image}
                    alt={program.fullTitle}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="program-index">0{index + 1}</span>
                  <span className="program-arrow"><ArrowUpRight size={18} /></span>
                </div>
                <div className="program-content">
                  <span className="card-eyebrow">Undergraduate program</span>
                  <h3>{program.title}</h3>
                  <p className="program-full-title">{program.fullTitle}</p>
                  <p>{program.description}</p>
                  <div className="program-meta">
                    <span><Clock3 size={14} />{program.duration}</span>
                    <span><BriefcaseBusiness size={14} />{program.format}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="admissions-section">
        <div className="container">
          <div className="admissions-panel reveal">
            <div className="admissions-media" aria-hidden="true">
              <Image
                src={image("photo-1523240795612-9a054b0db644", 1800)}
                alt="Undergraduate students at Royal College of Arts & Science, Thrithala"
                fill
                sizes="100vw"
              />
            </div>
            <div className="admissions-overlay" aria-hidden="true" />
            <div className="admissions-content">
              <div className="section-kicker section-kicker-light">Admissions 2026–27</div>
              <h2>Your next chapter starts here.</h2>
              <p>
                Take the first step toward a future with more possibility. Our admissions
                team is here to help you find the right program and make your application
                simple.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-light" href="/admissions">
                  Start your application <ArrowRight size={17} />
                </Link>
                <Link className="btn btn-ghost-light" href="/contact">
                  Talk to admissions <ArrowUpRight size={17} />
                </Link>
              </div>
            </div>
            <div className="admissions-status">
              <span>Applications open</span>
            </div>
            <div className="admissions-watermark">RC</div>
          </div>
        </div>
      </section>

      <InstagramReels />

      <section className="section news-section" id="news">
        <div className="container">
          <div className="section-head reveal">
            <div>
              <div className="section-kicker">04 / News &amp; announcements</div>
              <h2>What&apos;s happening at Royal.</h2>
            </div>
            <Link className="text-link" href="/news">
              Explore all news <ArrowRight size={17} />
            </Link>
          </div>
          <div className="news-grid home-news-grid">
            {news.map((item, index) => (
              <article className={`news-card reveal reveal-delay-${index + 1}`} key={item.title}>
                <Link href="/news" className="news-image" aria-label={`Read ${item.title}`}>
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                  <span className="news-image-arrow"><ArrowUpRight size={18} /></span>
                </Link>
                <div className="news-content">
                  <div className="news-meta">
                    <span>{item.category}</span>
                    <time>{item.date}</time>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <Link className="text-link" href="/news">
                    Read story <ArrowRight size={17} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta-section">
        <div className="container">
          <div className="final-cta reveal">
            <div className="final-cta-copy">
              <div className="section-kicker section-kicker-light">A future worth investing in</div>
              <h2>
                Make your next chapter
                <span>something remarkable.</span>
              </h2>
              <p>Bring your questions. We&apos;ll help you find your direction.</p>
            </div>
            {/* Same reason as the hero: the admissions panel owns these calls
                to action, so this closing section is copy only. */}
            <div className="final-cta-mark" aria-hidden="true">
              <span>RC</span>
              <span className="mark-line" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
