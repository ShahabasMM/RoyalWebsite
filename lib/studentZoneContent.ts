import { cache } from "react";

import type { InnerPageData } from "@/components/InnerPage";
import { clubsHeroLead } from "@/content/clubs";
import { galleryHeroLead } from "@/content/gallery";
import { library } from "@/content/library";
import { campusPages } from "@/content/campusPages";
import { studentZonePages } from "@/content/studentZonePages";

import { normaliseImageUrl } from "./imageUrl";
import { safeHref } from "./safeHref";
import {
  getPublicClient,
  getStudentResources,
  type StudentResource,
} from "./siteContent";

/* ==========================================================================
   Student Zone content, read from the CMS tables in Supabase.

   This is the data-access layer for the eleven Student Zone pages. It reuses
   the `site_pages` page registry for page metadata and adds two content tables,
   `site_page_sections` and `site_student_resources`, proposed for review in
   supabase/student_zone_cms.sql. Nothing here writes to the database.

   It follows the same contract as the rest of lib/siteContent.ts:

     - The database wins whenever it has published content for a page.
     - When the CMS is unconfigured, a table is missing, or the page has no
       published rows, the loader falls back to the site's own verified typed
       content so no Student Zone page can ever go blank.
     - Document lists (Prospectus, Magazine) never invent a
       download: with nothing published the page renders a deliberate empty
       state instead.

   The rule is deliberately "DB rows override the fallback, an empty table
   does not": treating a table-exists-but-empty result as authoritative would
   blank every page the moment the migration is applied, before staff have
   seeded anything. Empty sub-lists still surface the empty state, which is
   where the visible "nothing published yet" message belongs.
   ========================================================================== */

export type StudentZoneSectionItem = {
  title: string;
  text: string;
};

export type StudentZoneSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  /** Plain bullet list items. */
  list: string[];
  /** Titled point cards (title + text). */
  cards: StudentZoneSectionItem[];
  image: string | null;
  imageAlt: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
};

export type StudentZonePageMeta = {
  title: string;
  summary: string | null;
  updatedAt: string | null;
};

export type StudentZonePageContent = {
  slug: string;
  /** Route, e.g. `/student-zone/nss`. */
  path: string;
  title: string;
  lead: string;
  sections: StudentZoneSection[];
  updatedAt: string | null;
  /** Where the rendered content came from — useful while seeding the CMS. */
  source: "database" | "fallback";
};

/** The nine menu items, in menu order. */
export const STUDENT_ZONE_PAGE_SLUGS = [
  "student-clubs",
  "prospectus",
  "nss",
  "students-union",
  "college-magazine",
  "campus-culture-gallery",
  "library",
] as const;

/**
 * Slugs that have their own route directory under app/student-zone. The
 * dynamic `[slug]` route must skip these in `generateStaticParams`, otherwise
 * Next would be asked to build the same URL twice.
 */
export const EXPLICIT_STUDENT_ZONE_SLUGS = [
  "students-union",
  "college-magazine",
  "prospectus",
  "nss",
  "library",
  "student-clubs",
  "campus-culture-gallery",
] as const;

export const studentZonePath = (slug: string) => `/student-zone/${slug}`;

function emptySection(partial: Partial<StudentZoneSection>): StudentZoneSection {
  return {
    id: partial.id ?? `s-${Math.random().toString(36).slice(2, 9)}`,
    heading: partial.heading ?? "",
    paragraphs: partial.paragraphs ?? [],
    list: partial.list ?? [],
    cards: partial.cards ?? [],
    image: partial.image ?? null,
    imageAlt: partial.imageAlt ?? null,
    linkUrl: partial.linkUrl ?? null,
    linkLabel: partial.linkLabel ?? null,
  };
}

/**
 * Converts the rich typed inner-page content the site already ships into the
 * simple ordered sections the Student Zone layout renders. Only text that
 * already exists is carried across — the intro sentence, the points and the
 * highlights — so the fallback is the same content in a plainer layout, never
 * new copy.
 */
function sectionsFromInnerPage(page: InnerPageData): StudentZoneSection[] {
  const sections: StudentZoneSection[] = [];

  if (page.heading || page.lead) {
    sections.push(
      emptySection({
        heading: page.heading ?? page.title,
        paragraphs: page.lead ? [page.lead] : [],
      }),
    );
  }

  if (page.points?.length) {
    sections.push(
      emptySection({
        heading: page.kicker || "Overview",
        cards: page.points.map((point) => ({ title: point.title, text: point.text })),
      }),
    );
  }

  if (page.highlights?.items.length) {
    sections.push(
      emptySection({
        heading: page.highlights.title,
        paragraphs: page.highlights.text ? [page.highlights.text] : [],
        cards: page.highlights.items.map((item) => ({
          title: item.title,
          text: item.text,
        })),
      }),
    );
  }

  return sections;
}

function innerPageFallback(page: InnerPageData): Pick<
  StudentZonePageContent,
  "title" | "lead" | "sections"
> {
  return {
    title: page.title,
    lead: page.heroLead,
    sections: sectionsFromInnerPage(page),
  };
}

/** The site's own verified content, used whenever the CMS has nothing. */
const FALLBACKS: Record<
  string,
  Pick<StudentZonePageContent, "title" | "lead" | "sections">
> = {
  "students-union": innerPageFallback(studentZonePages["students-union"]),
  "college-magazine": innerPageFallback(studentZonePages["college-magazine"]),
  nss: innerPageFallback(campusPages.nss),

  prospectus: {
    title: "Prospectus",
    lead: "Explore our college and university prospectuses.",
    sections: [
      emptySection({
        heading: "The prospectus, when you need it.",
        paragraphs: [
          "The prospectus sets out the programmes, eligibility, admission procedure and campus facilities in full. The latest college and University of Calicut prospectuses are published here as they are issued. For the programmes currently offered, see the programmes page.",
        ],
      }),
    ],
  },

  "file-your-grievance": {
    title: "File Your Grievance",
    lead: "Raise a concern with the college. Your message goes directly to the office.",
    sections: [
      emptySection({
        heading: "We would rather hear about it early.",
        paragraphs: [
          "If something is affecting your studies or your time on campus — an academic issue, an examination concern, a fee matter, a safety issue or anything else — tell the college. Submit the form and the office will take it up through the appropriate channel. For urgent or personal matters, you can also contact the office directly.",
        ],
        cards: [
          {
            title: "Confidential",
            text: "Your grievance is seen by the college office handling student welfare, not published anywhere.",
          },
          {
            title: "Recorded",
            text: "Every submission is stored with the college's enquiries, so it can be tracked and answered.",
          },
          {
            title: "Actioned",
            text: "Serious concerns are routed to the relevant cell — academic, anti-harassment or welfare.",
          },
        ],
      }),
    ],
  },

  // Specialised designs. Only the title and lead are exposed to the loader;
  // the pages keep rendering their own layouts.
  "student-clubs": { title: "Student Clubs", lead: clubsHeroLead, sections: [] },
  "campus-culture-gallery": {
    title: "Campus Culture & Gallery",
    lead: galleryHeroLead,
    sections: [],
  },
  library: { title: "Library", lead: library.heroLead, sections: [] },
};

function humanize(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type PageRow = {
  title: string | null;
  summary: string | null;
  updated_at: string | null;
};

/**
 * Page metadata from the `site_pages` registry.
 *
 * `site_pages` uses a text `status` column (the rows the site ships read
 * "Published"), not the boolean `is_published` column the other CMS tables
 * use, so it is read here rather than through the shared helper. Returns null
 * when there is no published row or the table cannot be read.
 */
export const getStudentZonePageMeta = cache(
  async (slug: string): Promise<StudentZonePageMeta | null> => {
    const supabase = getPublicClient();

    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from("site_pages")
        .select("title, summary, updated_at")
        .eq("path", studentZonePath(slug))
        .ilike("status", "published")
        .maybeSingle();

      if (error || !data) return null;

      const row = data as PageRow;

      return {
        title: row.title?.trim() || humanize(slug),
        summary: row.summary?.trim() || null,
        updatedAt: row.updated_at ?? null,
      };
    } catch {
      return null;
    }
  },
);

type SectionRow = {
  id: string;
  heading: string | null;
  body: string | null;
  items: unknown;
  image: string | null;
  image_alt: string | null;
  link_url: string | null;
  link_label: string | null;
};

function rowToSection(row: SectionRow): StudentZoneSection | null {
  const heading = row.heading?.trim() ?? "";
  const paragraphs = (row.body ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const list: string[] = [];
  const cards: StudentZoneSectionItem[] = [];

  if (Array.isArray(row.items)) {
    for (const entry of row.items) {
      if (typeof entry === "string") {
        const text = entry.trim();
        if (text) list.push(text);
      } else if (entry && typeof entry === "object") {
        const card = entry as { title?: unknown; text?: unknown };
        const title = typeof card.title === "string" ? card.title.trim() : "";
        const text = typeof card.text === "string" ? card.text.trim() : "";

        if (title) cards.push({ title, text });
      }
    }
  }

  const image = normaliseImageUrl(row.image);
  const linkUrl = safeHref(row.link_url);
  const linkLabel = linkUrl ? row.link_label?.trim() || "Learn more" : null;

  if (
    !heading &&
    paragraphs.length === 0 &&
    list.length === 0 &&
    cards.length === 0 &&
    !image &&
    !linkUrl
  ) {
    return null;
  }

  return emptySection({
    id: row.id,
    heading,
    paragraphs,
    list,
    cards,
    image,
    imageAlt: row.image_alt?.trim() || null,
    linkUrl,
    linkLabel,
  });
}

/**
 * Ordered published sections for a page, keyed by route.
 *
 * Returns null when the table cannot be read (missing table, no env, query
 * error) so the caller falls back; returns [] when the table answered but the
 * page has no published sections.
 */
async function getStudentZoneSections(
  slug: string,
): Promise<StudentZoneSection[] | null> {
  const supabase = getPublicClient();

  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("site_page_sections")
      .select("*")
      .eq("page_path", studentZonePath(slug))
      .eq("is_published", true)
      .order("display_order", { ascending: true });

    if (error || !Array.isArray(data)) return null;

    return (data as SectionRow[])
      .map(rowToSection)
      .filter((section): section is StudentZoneSection => section !== null);
  } catch {
    return null;
  }
}

/**
 * Everything a Student Zone page renders: page metadata, ordered sections and
 * the source they came from. Database first, verified typed fallback second.
 */
export const getStudentZonePage = cache(
  async (slug: string): Promise<StudentZonePageContent> => {
    const [meta, dbSections] = await Promise.all([
      getStudentZonePageMeta(slug),
      getStudentZoneSections(slug),
    ]);

    const fallback = FALLBACKS[slug];
    const hasDbSections = Array.isArray(dbSections) && dbSections.length > 0;
    const pageSections = hasDbSections ? dbSections : fallback?.sections ?? [];

    return {
      slug,
      path: studentZonePath(slug),
      title: meta?.title?.trim() || fallback?.title || humanize(slug),
      lead: meta?.summary?.trim() || fallback?.lead || "",
      // The union roster has its own card board; do not also render the
      // storage row as a generic content section beneath it.
      sections:
        slug === "students-union"
          ? pageSections.filter((section) => !/(meet our union|union members)/i.test(section.heading))
          : pageSections,
      updatedAt: meta?.updatedAt ?? null,
      source: hasDbSections ? "database" : "fallback",
    };
  },
);

/* --------------------------------------------------------------------------
   NSS media — the site_media_items rows behind the NSS board and reels.
   See supabase/nss_media.sql (mirrored in the ERP's supabase/proposed/).
   -------------------------------------------------------------------------- */

export type NssMediaRow = {
  id: string;
  kind: "photo" | "reel";
  title: string | null;
  /** Direct image URL (photos) or the watch link (reels). */
  url: string | null;
  /** Instagram shortcode; the official embed preview is built from it. */
  embedCode: string | null;
  displayOrder: number;
};

/** Pulls the shortcode out of an Instagram post/reel address, if there is one. */
export function instagramShortcode(url: unknown): string | null {
  const match = String(url ?? "").match(
    /(?:www\.)?instagr(?:\.am|am\.com)\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/,
  );
  return match ? match[1] : null;
}

/**
 * Published media for the NSS page, split by kind. Returns empty arrays when
 * the table is missing or still empty, so the page falls back to its gallery
 * photographs and typed Instagram sources exactly as before.
 */
export const getNssMedia = cache(async (): Promise<{
  photos: NssMediaRow[];
  reels: NssMediaRow[];
}> => {
  const supabase = getPublicClient();

  if (!supabase) return { photos: [], reels: [] };

  try {
    const { data, error } = await supabase
      .from("site_media_items")
      .select("*")
      .eq("page_path", "/student-zone/nss")
      .eq("is_published", true)
      .order("display_order", { ascending: true });

    if (error || !Array.isArray(data)) return { photos: [], reels: [] };

    const rows: NssMediaRow[] = data.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      kind: row.kind === "reel" ? "reel" : "photo",
      title: typeof row.title === "string" ? row.title : null,
      url: typeof row.url === "string" ? row.url : null,
      embedCode: typeof row.embed_code === "string" ? row.embed_code : null,
      displayOrder: Number(row.display_order ?? 0),
    }));

    return {
      photos: rows.filter((row) => row.kind === "photo"),
      reels: rows.filter((row) => row.kind === "reel"),
    };
  } catch {
    return { photos: [], reels: [] };
  }
});

/* --------------------------------------------------------------------------
   Prospectus cards — the two admin-bound destinations shown on
   /student-zone/prospectus.

   Binding convention (documented in docs/student-zone-cms-contract.md §3):
   a published `site_student_resources` row with kind = 'prospectus' fills the
   College card when its title or badge contains "college", and the University
   card when it contains "university" (case-insensitive). A row naming both
   words, or neither, is never guessed onto a card. The first matching row by
   display_order wins; one row can only ever fill one card. Without a bound
   row the card stays rendered but its button is disabled — a destination is
   never invented or borrowed from the other card.
   -------------------------------------------------------------------------- */

export type ProspectusSlot = "college" | "university";

export type ProspectusCard = {
  slot: ProspectusSlot;
  /** Card heading. Fixed by the page design, not by the database row. */
  title: string;
  /** One-line description. Fixed by the page design. */
  description: string;
  /** Admin-configured destination, or null when no row is bound. */
  url: string | null;
  /** True when url leaves the website, so it opens in a new tab. */
  external: boolean;
};

const PROSPECTUS_CARD_COPY: Record<
  ProspectusSlot,
  Pick<ProspectusCard, "title" | "description">
> = {
  college: {
    title: "College Prospectus",
    description: "Explore our college, courses, facilities and campus.",
  },
  university: {
    title: "University Prospectus",
    description: "Explore university programmes and academic information.",
  },
};

export const getProspectusCards = cache(
  async (): Promise<ProspectusCard[]> => {
    const resources = await getStudentResources("prospectus");

    const bound: Record<ProspectusSlot, StudentResource | null> = {
      college: null,
      university: null,
    };

    for (const row of resources) {
      const haystack = `${row.title} ${row.label}`.toLowerCase();
      const namesCollege = haystack.includes("college");
      const namesUniversity = haystack.includes("university");

      // Both words, or neither: the row cannot be bound without guessing.
      if (namesCollege === namesUniversity) continue;

      const slot: ProspectusSlot = namesCollege ? "college" : "university";
      if (bound[slot]) continue;

      bound[slot] = row;
    }

    return (["college", "university"] as const).map((slot) => ({
      slot,
      ...PROSPECTUS_CARD_COPY[slot],
      url: bound[slot]?.url ?? null,
      external: bound[slot]?.external ?? false,
    }));
  },
);

/* --------------------------------------------------------------------------
   Students' Union members — the profiles on /student-zone/students-union.

   No new table is needed: a published `site_page_sections` row whose heading
   contains "Meet Our Union" (or "Union Members") carries the roster in its
   `items` JSON array. Each entry is an object:

     { "name": "…", "role": "…", "image": "…", "image_alt": "…",
       "course": "…", "year": "…" }

   Only `name` and `role` are required; `image`, `image_alt`, `course` and
   `year` are optional. Entries missing name or role are skipped rather than
   rendered blank, and a page with no such rows renders the section's empty
   state — a student is never invented. See docs/student-zone-cms-contract.md
   §3c.
   -------------------------------------------------------------------------- */

export type UnionMember = {
  id: string;
  name: string;
  role: string;
  /** Loadable image URL, or null when the card shows the member's initials. */
  image: string | null;
  imageAlt: string | null;
  course: string | null;
  year: string | null;
};

const UNION_MEMBER_HEADING = /(meet our union|union members)/i;

/** Clearly labelled preview records for local development only. */
const SAMPLE_UNION_MEMBERS: UnionMember[] = [
  {
    id: "sample-union-chairperson",
    name: "Sample Union President",
    role: "Chairperson",
    image: null,
    imageAlt: null,
    course: null,
    year: null,
  },
  {
    id: "sample-union-cultural-secretary",
    name: "Sample Cultural Secretary",
    role: "Cultural Secretary",
    image: null,
    imageAlt: null,
    course: null,
    year: null,
  },
];

function emptyUnionMemberPreview(): UnionMember[] {
  return process.env.NODE_ENV === "production" ? [] : SAMPLE_UNION_MEMBERS;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function rowToUnionMember(entry: unknown, index: number): UnionMember | null {
  if (!entry || typeof entry !== "object") return null;

  const row = entry as Record<string, unknown>;
  const name = firstString(row.name, row.title);
  const role = firstString(row.role, row.designation);

  if (!name || !role) return null;

  const rawImage = firstString(row.image, row.photo, row.url);

  return {
    id: `${name}-${index}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
    name,
    role,
    image: rawImage ? normaliseImageUrl(rawImage) : null,
    imageAlt: firstString(row.image_alt, row.alt),
    course: firstString(row.course, row.department),
    year: firstString(row.year, row.academic_year),
  };
}

/**
 * Published union member profiles, in CMS order. Returns an empty list when
 * the table is missing, unreadable, or no row has been published — the page
 * then shows its empty state instead of fabricated profiles.
 */
export const getStudentsUnionMembers = cache(
  async (): Promise<UnionMember[]> => {
    const supabase = getPublicClient();

    if (!supabase) return emptyUnionMemberPreview();

    try {
      const { data, error } = await supabase
        .from("site_page_sections")
        .select("heading, items")
        .eq("page_path", studentZonePath("students-union"))
        .eq("is_published", true)
        .order("display_order", { ascending: true });

      if (error || !Array.isArray(data)) return emptyUnionMemberPreview();

      const members: UnionMember[] = [];

      for (const row of data as { heading: string | null; items: unknown }[]) {
        const heading = row.heading ?? "";

        if (!UNION_MEMBER_HEADING.test(heading)) continue;

        let itemsArr: unknown[] = [];
        if (Array.isArray(row.items)) {
          itemsArr = row.items;
        } else if (typeof row.items === "string") {
          try {
            const parsed = JSON.parse(row.items);
            if (Array.isArray(parsed)) itemsArr = parsed;
          } catch {
            itemsArr = [];
          }
        }

        if (itemsArr.length === 0) continue;

        for (const [index, entry] of itemsArr.entries()) {
          const member = rowToUnionMember(entry, index);

          if (member) members.push(member);
        }
      }

      return members.length > 0 ? members : emptyUnionMemberPreview();
    } catch {
      return emptyUnionMemberPreview();
    }
  },
);
