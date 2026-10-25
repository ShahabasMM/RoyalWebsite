import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { safeHref } from "./safeHref";
import { normaliseImageUrl } from "./imageUrl";

import {
  addOnCourses as fallbackAddOnCourses,
  APPROVAL_BADGE,
  APPROVAL_NOTE,
} from "@/content/addOnCourses";
import { faculty as fallbackFaculty, type FacultyMember } from "@/content/faculty";
import { programmes as fallbackProgrammes, type Programme } from "@/content/programmes";
import {
  isUsableHref,
  studentZoneMenu as fallbackStudentZoneMenu,
  type StudentZoneMenu,
} from "@/content/studentZoneMenu";
import { buildStudentZoneItems } from "./studentZoneMenuBuild";

import type { InnerPdf } from "@/components/InnerPage";

/** Shown when a calendar row has no preview image of its own. */
const FALLBACK_CALENDAR_IMAGE = "/images/academic-calendar-2026-27.jpg";

/* ==========================================================================
   Public website content, read from the CMS tables in Supabase.

   Every getter falls back to the site's own hardcoded content when Supabase
   is unreachable, unconfigured, or the table is still empty. That means the
   site renders exactly as it always has until someone runs
   supabase/website_cms.sql + website_cms_seed.sql, and a database outage can
   never take the public site down.
   ========================================================================== */

export type SiteProgramme = Programme;

export type SiteFacultyMember = FacultyMember;

export type SiteAddOnCourse = {
  code: string;
  title: string;
  duration: string;
  mode: string;
  approvalNote: string;
};

export type SiteDepartment = {
  name: string;
  hod: string | null;
};

export type SiteNewsItem = {
  title: string;
  category: string;
  date: string;
  image: string | null;
  text: string;
};

export type SiteNotice = {
  label: string;
  date: string;
};

export type SiteNews = {
  items: SiteNewsItem[];
  notices: SiteNotice[];
};

/** News the site shows before any CMS data exists, mirroring app/news/page.tsx. */
const fallbackNews: SiteNews = {
  items: [
    {
      title: "Annual Arts Fest 2026",
      category: "Campus Event",
      date: "12 March 2026",
      image:
        "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1000&q=85",
      text: "A week of stage events, group performances and inter-department competitions across the campus.",
    },
    {
      title: "Internal Examination Schedule",
      category: "Examination",
      date: "24 February 2026",
      image:
        "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85",
      text: "Class tests and internal assessments for the current term, with hall details published department-wise.",
    },
    {
      title: "Community Service Programme",
      category: "Outreach",
      date: "08 February 2026",
      image:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=85",
      text: "Students and faculty organised a tutoring and campus clean-up drive with the local community.",
    },
    {
      title: "New Academic Initiative",
      category: "Academics",
      date: "19 January 2026",
      image:
        "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1000&q=85",
      text: "Mentorship and remedial support introduced for every batch, embedded in the weekly timetable.",
    },
    {
      title: "Student Achievement",
      category: "Achievement",
      date: "15 January 2026",
      image:
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1000&q=85",
      text: "Students from the Commerce and Computer Applications departments topped the University examinations.",
    },
    {
      title: "Campus Development Update",
      category: "College Update",
      date: "06 January 2026",
      image:
        "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1000&q=85",
      text: "Laboratory upgrades and additional reading space completed ahead of the new academic year.",
    },
  ],
  notices: [
    { label: "Internal assessment schedule published", date: "24 Feb 2026" },
    { label: "Library extended hours during examinations", date: "20 Feb 2026" },
    { label: "Add-on certificate course registration open", date: "11 Feb 2026" },
    { label: "Sports meet trials for the annual meet", date: "04 Feb 2026" },
  ],
};

/** Department order the public faculty page groups by. */
const DEPARTMENT_ORDER = ["Commerce", "English", "Malayalam", "Arabic"];

let cached: SupabaseClient | null | undefined;

/**
 * The shared anon Supabase client for every public CMS read.
 *
 * Exported so the Student Zone content layer (lib/studentZoneContent.ts) reuses
 * one client, one no-store fetch policy and one null-means-unconfigured
 * contract, rather than each module building its own.
 */
export function getPublicClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    cached = null;
    return cached;
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Every CMS read must reach the database, never Next's fetch cache.
      //
      // Without this, `router.refresh()` re-renders the page but can be handed
      // the same cached Supabase response as before, so an admin edit appeared
      // to do nothing until the page's revalidate window expired. Caching is
      // handled deliberately instead: server renders are short-lived (see the
      // revalidate values in app/**), and the client refreshes on realtime.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });

  return cached;
}

/**
 * Returns published rows, or null only when the CMS cannot be reached at all
 * (no env configured, missing table, or a query error).
 *
 * A table that exists but has no published rows returns [], NOT null. That
 * distinction matters: treating "empty" as "not set up" would silently
 * resurrect the hardcoded content whenever an admin deliberately unpublishes
 * everything, so the CMS could never actually empty a section.
 */
async function publishedRows<T>(table: string): Promise<T[] | null> {
  const supabase = getPublicClient();

  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("is_published", true)
      .order("display_order", { ascending: true });

    if (error) return null;
    if (!Array.isArray(data)) return null;

    return data as T[];
  } catch {
    return null;
  }
}

async function orderedRows<T>(
  table: string,
  column: string,
  ascending = false,
  tiebreaker = "created_at",
) {
  const supabase = getPublicClient();

  if (!supabase) return null;

  try {
    let query = supabase
      .from(table)
      .select("*")
      .eq("is_published", true)
      .order(column, { ascending, nullsFirst: false });

    // Two items can share the same publish date, and without a second key the
    // order between them is arbitrary, so the top card could flip at random.
    if (tiebreaker && tiebreaker !== column) {
      query = query.order(tiebreaker, { ascending: false, nullsFirst: false });
    }

    const { data, error } = await query;

    if (error) return null;
    if (!Array.isArray(data)) return null;

    return data as T[];
  } catch {
    return null;
  }
}

function longDate(value: unknown): string {
  if (!value) return "";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function shortDate(value: unknown): string {
  if (!value) return "";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type SiteGalleryItem = {
  id: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  category: string;
  /** Optional. When set the hover panel becomes a link to this. */
  linkUrl: string | null;
  isInstagramSource: boolean;
  instagramEmbedUrl: string | null;
};

type GalleryRow = {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  image_alt: string | null;
  category: string | null;
  link_url: string | null;
};

function instagramEmbedUrl(value: string | null): string | null {
  const match = String(value ?? "").match(
    /^https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/i,
  );

  return match
    ? `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/embed/`
    : null;
}

/**
 * Photographs for /campus/gallery, in the order staff set in the admin.
 *
 * Returns [] when the CMS is unreachable or nothing is published, so the page
 * shows its own "being updated" message rather than an error or, worse, a
 * fallback of Instagram posts that are no longer wanted.
 */
export async function getGallery(): Promise<SiteGalleryItem[]> {
  const rows = await orderedRows<GalleryRow>("site_gallery", "display_order", true);

  if (!rows) return [];

  return rows
    // Instagram permalinks use Instagram's official embed; direct image URLs
    // continue to use a normal image element.
    .map((row) => {
      const instagram = instagramEmbedUrl(row.link_url) ?? instagramEmbedUrl(row.image);
      const isInstagramSource = Boolean(instagram);
      const image = instagram ? "" : normaliseImageUrl(row.image);

      return image || instagram ? { row, image, isInstagramSource, instagram } : null;
    })
    .filter((entry): entry is { row: GalleryRow; image: string; isInstagramSource: boolean; instagram: string | null } => entry !== null)
    .map(({ row, image, isInstagramSource, instagram }) => {
      const title = row.title.trim();

      return {
        id: row.id,
        title,
        description: row.description?.trim() ?? "",
        image,
        // Falls back to the title so every photo still has something to read
        // aloud, which a photo with no alt text does not.
        imageAlt: row.image_alt?.trim() || title,
        category: row.category?.trim() || "Gallery",
        // Only site-relative paths and http(s) links. A javascript: URL stored
        // in the CMS must never become a clickable href.
        // Instagram's own embed UI includes account/profile links, so an
        // Instagram destination remains stored but is not exposed as a tile link.
        linkUrl: isInstagramSource ? null : safeHref(row.link_url),
        isInstagramSource,
        instagramEmbedUrl: instagram,
      };
    });
}

/* ------------------------------------------------------------- getters */

type ProgrammeRow = {
  name: string;
  short_name: string | null;
  about: string | null;
  duration: string | null;
  scheme: string | null;
  department: string | null;
  image: string | null;
  level: string | null;
  slug: string | null;
};

export async function getProgrammes(): Promise<SiteProgramme[]> {
  const rows = await publishedRows<ProgrammeRow>("site_programmes");

  if (!rows) return fallbackProgrammes;

  return rows.map((row) => ({
    name: row.name,
    shortName: row.short_name || row.name,
    about: row.about ?? "",
    duration: row.duration ?? "",
    scheme: row.scheme ?? "FYUGP",
    department: row.department ?? "",
    image: normaliseImageUrl(row.image) ?? "",
    level: row.level ?? null,
    slug: row.slug ?? null,
  }));
}

export type SiteStat = {
  label: string;
  value: string;
  suffix: string;
  iconKey: string;
};

type StatRow = {
  label: string;
  value: string;
  suffix: string | null;
  icon_key: string | null;
};

/** What HomePage used to hardcode, used again if the CMS has nothing usable. */
const FALLBACK_STATS: SiteStat[] = [
  { label: "Academic programs", value: "12", suffix: "+", iconKey: "book" },
  { label: "Students learning together", value: "1,000", suffix: "+", iconKey: "users" },
  { label: "Faculty mentors", value: "50", suffix: "+", iconKey: "graduation" },
  { label: "Years of excellence", value: "20", suffix: "+", iconKey: "award" },
];

export async function getStats(): Promise<SiteStat[]> {
  const rows = await publishedRows<StatRow>("site_stat");

  if (!rows) return withVisitorsStat(FALLBACK_STATS);

  const stats = rows
    .filter((row) => row.label && row.value)
    .map((row) => ({
      label: row.label,
      value: row.value,
      suffix: row.suffix ?? "",
      iconKey: row.icon_key || "book",
    }));

  // A partly filled table should show what was entered, not stale filler.
  return withVisitorsStat(stats.length > 0 ? stats : FALLBACK_STATS);
}

/**
 * Swaps the "Faculty mentors" card for the live "Visitors" card.
 *
 * The visitor total is not CMS content, so it is not stored in site_stat; it
 * comes from this site's own counter (lib/visitors.ts) and is filled in on the
 * client by VisitorStat. The CMS row is only used to decide *where* the card
 * sits, which is what keeps the four-column stat bar intact. Matching the
 * label, with the faculty icon as a fallback, works whether the value came from
 * the CMS or the hardcoded defaults.
 */
function withVisitorsStat(stats: SiteStat[]): SiteStat[] {
  const facultyIndex = stats.findIndex(
    (stat) => /faculty/i.test(stat.label) || stat.iconKey === "graduation",
  );

  if (facultyIndex === -1) return stats;

  const visitors: SiteStat = {
    label: "Visitors",
    value: "",
    suffix: "",
    iconKey: "users",
  };

  return stats.map((stat, index) => (index === facultyIndex ? visitors : stat));
}

type DepartmentRow = {
  name: string;
  hod_name: string | null;
};

export async function getDepartments(): Promise<SiteDepartment[]> {
  const rows = await publishedRows<DepartmentRow>("site_departments");

  if (!rows) {
    return ["English", "Commerce", "Malayalam", "Arabic"].map((name) => ({
      name,
      hod: null,
    }));
  }

  return rows.map((row) => ({ name: row.name, hod: row.hod_name }));
}

type FacultyRow = {
  name: string;
  department: string | null;
  designation: string | null;
};

/** Faculty grouped the way the public page groups them. */
export async function getFacultyGroups() {
  const rows = await publishedRows<FacultyRow>("site_faculty");

  const members: SiteFacultyMember[] = rows
    ? rows.map((row) => ({
        name: row.name,
        department: row.department ?? "",
        role: row.designation ?? undefined,
      }))
    : fallbackFaculty;

  const seen: string[] = [];

  for (const member of members) {
    if (member.department && !seen.includes(member.department)) {
      seen.push(member.department);
    }
  }

  // Departments the site has always shown come first, in their original order,
  // then anything new an admin has added.
  const order = [
    ...DEPARTMENT_ORDER.filter((name) => seen.includes(name)),
    ...seen.filter((name) => !DEPARTMENT_ORDER.includes(name)),
  ];

  const groups = order
    .map((department) => ({
      key: department.toLowerCase(),
      label: department,
      members: members.filter((member) => member.department === department),
    }))
    .filter((group) => group.members.length > 0);

  const unassigned = members.filter((member) => !member.department);

  if (unassigned.length > 0) {
    groups.push({ key: "staff", label: "Staff", members: unassigned });
  }

  return {
    groups,
    total: members.length,
    namedDepartments: groups
      .filter((group) => group.key !== "staff")
      .map((group) => group.label),
    hodByDepartment: members.reduce<Record<string, string>>((acc, member) => {
      const isHead = member.role?.toLowerCase().includes("head of department");

      if (member.department && isHead && !acc[member.department]) {
        acc[member.department] = member.name;
      }

      return acc;
    }, {}),
  };
}

type AddOnRow = {
  code: string | null;
  name: string;
  duration: string | null;
  mode: string | null;
  approval_note: string | null;
};

export async function getAddOnCourses(): Promise<{
  courses: SiteAddOnCourse[];
  approvalNote: string;
  approvalBadge: string;
}> {
  const rows = await publishedRows<AddOnRow>("site_addon_courses");

  const courses: SiteAddOnCourse[] = rows
    ? rows.map((row) => ({
        code: row.code ?? "",
        title: row.name,
        duration: row.duration ?? "",
        mode: row.mode ?? "",
        approvalNote: row.approval_note || APPROVAL_NOTE,
      }))
    : fallbackAddOnCourses.map((course) => ({
        code: course.code,
        title: course.title,
        duration: course.duration,
        mode: course.mode,
        approvalNote: APPROVAL_NOTE,
      }));

  return { courses, approvalNote: APPROVAL_NOTE, approvalBadge: APPROVAL_BADGE };
}

type CalendarRow = {
  title: string;
  academic_year: string | null;
  description: string | null;
  pdf_url: string | null;
  image_url: string | null;
};

/**
 * Calendar PDFs shown on /academics/academic-calendar, newest year first by
 * display order. Rows without a PDF are skipped, since every card links out.
 * Returns [] when the CMS has nothing, so the page can keep its own defaults.
 */
export async function getAcademicCalendar(): Promise<InnerPdf[]> {
  const rows = await orderedRows<CalendarRow>(
    "site_academic_calendar",
    "display_order",
    true,
  );

  if (!rows) return [];

  return rows
    .filter((row): row is CalendarRow & { pdf_url: string } => Boolean(row.pdf_url))
    .map((row) => ({
      label: row.academic_year || "Calendar",
      title: row.title,
      text: row.description || undefined,
      url: row.pdf_url,
      image: normaliseImageUrl(row.image_url) || FALLBACK_CALENDAR_IMAGE,
      imageAlt: `First page of the ${row.title}`,
      meta: "PDF",
    }));
}

type NewsRow = {
  title: string;
  category: string | null;
  summary: string | null;
  body: string | null;
  image: string | null;
  published_at: string | null;
};

export async function getNews(): Promise<SiteNews> {
  const rows = await orderedRows<NewsRow>("site_news", "published_at");

  if (!rows) return fallbackNews;

  const notices: SiteNotice[] = [];
  const items: SiteNewsItem[] = [];

  for (const row of rows) {
    const date = longDate(row.published_at);

    if (row.category === "Notice") {
      notices.push({ label: row.title, date: shortDate(row.published_at) });
    } else {
      items.push({
        title: row.title,
        category: row.category || "General",
        date,
        // Rewrites pasted Drive share links into a loadable image URL.
        image: normaliseImageUrl(row.image),
        text: row.summary || row.body || "",
      });
    }
  }

  // rows is non-null here, so the CMS answered: show exactly what is
  // published, even if that is only notices and no stories.
  return { items, notices };
}

export type SiteFlashNotice = {
  message: string;
  /** Optional. When set the notice becomes a link. */
  linkUrl: string | null;
};

type FlashNewsRow = {
  message: string;
  link_url: string | null;
};

/**
 * Notices for the scrolling flash bar above the header.
 *
 * Returns [] when the CMS is healthy but nothing is published, so the bar is
 * simply not rendered. A missing table also yields [], because an absent
 * flash-news table should never show a broken bar.
 */
export async function getFlashNews(): Promise<SiteFlashNotice[]> {
  const rows = await orderedRows<FlashNewsRow>(
    "site_flash_news",
    "display_order",
    true,
  );

  if (!rows) return [];

  return rows
    .filter((row) => typeof row.message === "string" && row.message.trim() !== "")
    .map((row) => ({
      message: row.message.trim(),
      // Only allow site-relative paths and http(s) links. A javascript: URL
      // stored in the CMS must never become a clickable href.
      linkUrl: safeHref(row.link_url),
    }));
}

export type SiteWelcomePopup = {
  /**
   * Identifies one popup. The browser remembers the id it closed, which is how
   * the popup stays a once-only welcome: editing the popup keeps the same id and
   * does not interrupt anyone who already dismissed it, while replacing it with
   * a new popup produces a new id and greets every visitor again.
   */
  id: string;
  eyebrow: string | null;
  title: string;
  description: string | null;
  image: string | null;
  imageAlt: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
  /**
   * True means "first visit only", so a refresh will not bring the popup back.
   * False means it appears on every visit and every refresh.
   */
  showOnce: boolean;
};

type WelcomePopupRow = {
  id: string;
  eyebrow: string | null;
  title: string;
  description: string | null;
  image: string | null;
  image_alt: string | null;
  button_label: string | null;
  button_url: string | null;
  show_once: boolean | null;
};

function optionalText(value: string | null): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * The popup shown to first-time visitors on the home page.
 *
 * Returns null whenever there is nothing worth showing, which covers all three
 * cases with one safe default: no popup configured, the popup still switched
 * off in the admin, and the table or the database being unreachable. A welcome
 * popup that cannot be read must leave the home page alone, never trap somebody
 * on a page behind a broken dialog.
 */
export async function getWelcomePopup(): Promise<SiteWelcomePopup | null> {
  const supabase = getPublicClient();

  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("site_welcome_popup")
      /*
     * "*" rather than a column list, deliberately.
     *
     * A named column that the database does not have yet fails the whole query
     * with 42703, which this getter then swallows into null - a popup that never
     * appears and never says why. Reading every column instead means a column
     * added after this code shipped is simply absent from the row, and the
     * `showOnce` fallback below handles it.
     */
    .select("*")
      .eq("is_published", true)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      // Silent null is right in production: a popup that cannot be read must
      // never take the home page down. But during development it is the reason
      // a popup "does not appear", with nothing on screen to say so.
      if (process.env.NODE_ENV !== "production" && error) {
        console.warn("[welcome-popup] not shown:", error.message);
      }

      return null;
    }

    const title = optionalText(data.title);

    // A popup with no title is a draft that somebody switched on early. Showing
    // an untitled dialog over the home page would be worse than showing nothing.
    if (!title) return null;

    const buttonUrl = safeHref(data.button_url);
    // A label pointing nowhere would trap the visitor in a dialog they can only
    // escape by finding the X, so the button only exists when both halves are set.
    const buttonLabel = buttonUrl ? optionalText(data.button_label) : null;

    return {
      id: data.id,
      eyebrow: optionalText(data.eyebrow),
      title,
      description: optionalText(data.description),
      image: normaliseImageUrl(data.image),
      imageAlt: optionalText(data.image_alt),
      buttonLabel,
      buttonUrl: buttonLabel ? buttonUrl : null,
      // The column arrived after this getter was first written, so treat a null
      // as "show every time" rather than quietly reverting to once-only.
      showOnce: Boolean(data.show_once),
    };
  } catch {
    return null;
  }
}


export type SiteSettings = {
  /** Master switch for every apply / apply-now button on the public site. */
  applyEnabled: boolean;
};

const SETTINGS_ID = "00000000-0000-0000-0000-0000000000ff";

/**
 * Site-wide switches managed from the admin "Apply now" toggle.
 *
 * Defaults to enabled. If the table is missing or unreachable we must not
 * silently strip every apply button off a live admissions site, so the safe
 * failure here is "on" rather than "off".
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const supabase = getPublicClient();

  if (!supabase) return { applyEnabled: true };

  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("apply_enabled")
      .eq("id", SETTINGS_ID)
      .maybeSingle();

    if (error || !data) return { applyEnabled: true };

    return { applyEnabled: Boolean(data.apply_enabled) };
  } catch {
    return { applyEnabled: true };
  }
}

/* ==========================================================================
   Student Zone navigation (CMS-managed)

   The menu lives in `site_menu_items`, one row per link. Until the table is
   created and seeded, `getStudentZoneMenu` returns the typed fallback in
   content/studentZoneMenu.ts, so the public header never depends on the CMS
   being set up. A table with no rows at all is also "not configured" and keeps
   the fallback — that is the state the schema ships in, and blanking the
   header dropdown because a migration ran would be a regression. Once rows
   exist, staff are in full control: unpublished rows are filtered out, so
   switching every item off really does empty the menu.

   The full schema, RLS policies and the RoyalAdmins integration are described
   in docs/student-zone-cms-contract.md. No production schema is created here.
   ========================================================================== */

type MenuItemRow = {
  id: string;
  menu_key: string | null;
  label: string | null;
  href: string | null;
  external_url: string | null;
  display_order: number | null;
  is_published: boolean | null;
};

/** The menu key this site reads from `site_menu_items`. */
export const STUDENT_ZONE_MENU_KEY = "student_zone";

/**
 * The Student Zone menu, from the CMS when available and the typed fallback
 * otherwise.
 *
 * Returns the fallback for every "not configured" case: no env, missing table,
 * query error, and — importantly — a table with no rows at all for this menu.
 * An empty table is exactly what the schema ships with, so treating it as
 * "show nothing" would blank the header dropdown the moment the migration is
 * applied and before staff have entered anything.
 *
 * Once rows exist, staff stay in full control: unpublished rows are filtered
 * out, so switching every item off really does empty the menu.
 */
export async function getStudentZoneMenu(): Promise<StudentZoneMenu> {
  const supabase = getPublicClient();

  if (!supabase) return fallbackStudentZoneMenu;

  try {
    // Deliberately unfiltered: the row count tells us whether the CMS has
    // ever been configured for this menu, which the published-only query
    // cannot (an all-unpublished menu and an empty table look identical).
    const { data, error } = await supabase
      .from("site_menu_items")
      .select("*")
      .eq("menu_key", STUDENT_ZONE_MENU_KEY)
      .order("display_order", { ascending: true });

    if (error) return fallbackStudentZoneMenu;
    if (!Array.isArray(data)) return fallbackStudentZoneMenu;

    // Nothing has ever been configured: keep the site's own links rather than
    // emptying the navigation.
    if (data.length === 0) return fallbackStudentZoneMenu;

    const items = buildStudentZoneItems(
      (data as MenuItemRow[]).filter((row) => row.is_published !== false),
    );

    return { ...fallbackStudentZoneMenu, items };
  } catch {
    return fallbackStudentZoneMenu;
  }
}

/* ==========================================================================
   Student Zone resources (Prospectus, Magazine)

   Downloadable documents staff publish for students. Same philosophy as the
   menu: read `site_student_resources` when it exists, otherwise return an empty
   list so the page shows a deliberate empty state. No document is invented.
   ========================================================================== */

export type StudentResource = {
  id: string;
  title: string;
  description: string;
  label: string;
  /** Internal route or absolute http(s) URL to the document or folder. */
  url: string;
  /** True for http(s) destinations, so the card can open a new tab. */
  external: boolean;
  /** Optional cover/preview image (used by magazine editions). */
  image: string | null;
  /** Optional edition year (used by magazine editions). */
  year: string | null;
};

export type StudentResourceKind = "prospectus" | "magazine";

type ResourceRow = {
  id: string;
  kind: string | null;
  title: string | null;
  description: string | null;
  label: string | null;
  url: string | null;
  image: string | null;
  year: string | null;
  display_order: number | null;
  is_published: boolean | null;
};

export async function getStudentResources(
  kind: StudentResourceKind,
): Promise<StudentResource[]> {
  const supabase = getPublicClient();

  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("site_student_resources")
      .select("*")
      .eq("kind", kind)
      .eq("is_published", true)
      .order("display_order", { ascending: true });

    if (error || !Array.isArray(data)) return [];

    return (data as ResourceRow[])
      .filter((row): row is ResourceRow & { title: string; url: string } =>
        Boolean(row.title?.trim()) && Boolean(isUsableHref(row.url)),
      )
      .map((row) => ({
        id: row.id,
        title: row.title.trim(),
        description: row.description?.trim() ?? "",
        label: row.label?.trim() || "Document",
        url: row.url.trim(),
        // safeHref / isUsableHref only allow site-relative paths and http(s)
        // links, so anything not starting with "/" is an external URL.
        external: !row.url.trim().startsWith("/"),
        image: normaliseImageUrl(row.image),
        year: row.year?.trim() || null,
      }));
  } catch {
    return [];
  }
}
