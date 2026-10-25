# Student Zone CMS contract

Status: **proposal — nothing in this document has been applied to production.**
The public site works today with its own typed fallback content. This document
describes the database objects and RoyalAdmins integration that would let staff
manage the Student Zone from the Website module, and it is the reference the
website code comments point at.

## 1. What the website already does

The public site reads four things from Supabase, each with a hardcoded fallback:

| Concern | Website reader | Fallback | Table |
| --- | --- | --- | --- |
| Student Zone menu (seven links) | `getStudentZoneMenu()` in `lib/siteContent.ts` | `content/studentZoneMenu.ts` | `site_menu_items` |
| Prospectus / Magazine downloads | `getStudentResources(kind)` in `lib/siteContent.ts` | empty list | `site_student_resources` |
| Page body content (ordered sections) | `getStudentZonePage(slug)` in `lib/studentZoneContent.ts` | the site's typed content | `site_page_sections` |
| Page metadata (title, summary, updated) | `getStudentZonePageMeta(slug)` in `lib/studentZoneContent.ts` | the site's typed content | `site_pages` |
| Students' Union member profiles | `getStudentsUnionMembers()` in `lib/studentZoneContent.ts` | empty list (page shows its empty state) | `site_page_sections` |

The menu is a **flat list of ten items** — no groups, no descriptions. Each
item carries exactly the four fields the admin will manage:

- **title** (`label`)
- **route / URL** (`href` for internal, `external_url` for external)
- **display order** (`display_order`)
- **visibility** (`is_published`)

Behaviour that the schema must not break:

- **Missing table / query error → fallback.** Every reader returns its fallback
  when the table does not exist, the env is unset, or the query errors, so the
  header and landing page render exactly as today.
- **Empty table → fallback, not an empty menu.** The schema ships with no rows,
  so a `site_menu_items` table that has never been configured keeps the site's
  ten links (this is what stopped the header dropdown from rendering the
  moment the migration was applied). Once at least one row exists, staff are in
  full control: unpublished rows are filtered out, and switching every one off
  really does empty the menu.
- **Page sections: database rows override the fallback, an empty table does
  not.** `getStudentZonePage` renders whatever published sections exist for a
  page; when there are none it keeps the site0027s  typed copy. That way applying
  the migration cannot blank every page before staff have seeded anything.
  Document sub-lists (prospectus and magazine editions) still show a
  deliberate empty state when nothing is published.
- **Unusable rows are skipped.** A row with no label, or with neither a usable
  internal `href` nor a usable external `external_url`, is dropped rather than
  rendered as a dead link (`lib/studentZoneMenuBuild.ts`).
- **Only site-relative (`/…`) or `http(s)` destinations** are accepted
  (`isUsableHref` in `content/studentZoneMenu.ts`). A `javascript:` URL must
  never become an href.
- Public reads use the **publishable (anon) key** and only ever read
  `is_published = true` rows, ordered by `display_order`.

The site renders the list in the header's standard mega-menu layout (the same
two-column link list used by About and Academics) and as a three-column menu on
the `/student-zone` landing page. The layout is presentational only; it is not
stored in the database.

## 2. Table: `site_menu_items`

One row per menu link. The website filters by `menu_key = 'student_zone'`,
`is_published = true`, ordered by `display_order`.

```sql
create table if not exists public.site_menu_items (
  id            uuid primary key default gen_random_uuid(),
  menu_key      text not null default 'student_zone',
  label         text not null,              -- menu title
  href          text,                       -- internal route, starts with '/'
  external_url  text,                       -- absolute http(s) URL
  display_order int  not null default 0,    -- order in the list
  is_published  boolean not null default true, -- visibility switch
  requires_auth boolean not null default false, -- see §6, not yet read by the builder
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint site_menu_items_destination check (
    (href is not null and href <> '') or (external_url is not null and external_url <> '')
  )
);

create index if not exists site_menu_items_menu_idx
  on public.site_menu_items (menu_key, is_published, display_order);
```

Column-to-code mapping (`StudentZoneMenuItemRow`):

| Column | Used as |
| --- | --- |
| `label` | menu title (rows without it are skipped) |
| `href` | internal destination (wins if it starts with `/`) |
| `external_url` | external destination, `http(s)` only |
| `display_order` | ordering of the list, ascending |
| `is_published` | visibility; `false` hides the row from the public site |

`menu_key` exists so the same table can later hold other menus; only
`student_zone` is read today.

## 3. Table: `site_student_resources`

Downloadable documents shown on `/student-zone/prospectus` and
`/student-zone/college-magazine`. The website
filters by `kind` (one of `prospectus`, `magazine`),
`is_published = true`, ordered by `display_order`.

```sql
create table if not exists public.site_student_resources (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,              -- 'prospectus' | 'magazine'
  title         text not null,
  description   text,
  label         text,                       -- small badge, e.g. 'College', 'Semester 3'
  url           text not null,              -- site-relative path or absolute http(s) URL
  image         text,                       -- optional cover / preview
  year          text,                       -- optional edition year
  display_order int  not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists site_student_resources_kind_idx
  on public.site_student_resources (kind, is_published, display_order);
```

Rows without a `title` or a usable `url` are skipped. `url` starting with `/` is
treated as internal; anything else must be `http(s)` and opens in a new tab.
`image` and `year` are only meaningful for `magazine` editions (cover and year on
the card); the other two kinds simply leave them empty.

### 3a. Prospectus page: two admin-bound cards

`/student-zone/prospectus` renders exactly two cards — **College Prospectus**
and **University Prospectus** — and nothing else. Their destinations come from
`kind = 'prospectus'` rows via `getProspectusCards()` in
`lib/studentZoneContent.ts`, which binds rows to cards by name:

- a row whose **title or badge** contains "college" (case-insensitive) fills
  the College card;
- one containing "university" fills the University card;
- a row naming **both** words or **neither** is never guessed onto a card
  (e.g. a generic "Prospectus" row binds nothing);
- the first matching row by `display_order` wins, and one row can only ever
  fill one card.

Card headings and descriptions are fixed page copy, not database fields — the
row's own title and badge are only read for binding. With no bound published
row, the card still renders with its button disabled and a "Currently
unavailable" note: no URL is ever invented, borrowed from the other card, or
hardcoded. The `magazine` page is unaffected — it keeps
listing every published row of their kind.

## 3b. Table: `site_page_sections`

Ordered body content for a Student Zone page, keyed to a page by `page_path`
(the route, e.g. `/student-zone/nss`). Read by `getStudentZonePage` in
`lib/studentZoneContent.ts`, which falls back to the site's typed copy when a
page has no published rows.

A section is deliberately generic rather than typed per page:

| Column | Meaning |
| --- | --- |
| `heading` | section heading (may be empty) |
| `body` | one or more paragraphs, separated by blank lines |
| `items` | a jsonb list; each entry is a plain string (a bullet) or `{"title": "...", "text": "..."}` (a titled point card) |
| `image` / `image_alt` | optional image |
| `link_url` / `link_label` | optional destination, site-relative or http(s) |

```sql
create table if not exists public.site_page_sections (
  id            uuid primary key default gen_random_uuid(),
  page_path     text not null,                    -- '/student-zone/nss'
  heading       text,
  body          text,
  items         jsonb not null default '[]'::jsonb,
  image         text,
  image_alt     text,
  link_url      text,
  link_label    text,
  display_order int  not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists site_page_sections_page_idx
  on public.site_page_sections (page_path, is_published, display_order);
```

`page_path` is a plain text column rather than a foreign key to `site_pages`, so
a page can be given body content without waiting on the page registry. Keep it
identical to the route (including the `/student-zone/` prefix) or the reader will
not match.

### Heading-keyed conventions

Some designed sections read specific rows by heading instead of rendering every
section generically:

| Page | Heading | Convention |
| --- | --- | --- |
| `/student-zone/nss` | `Programme Officer` / `Student Leader` | First `body` paragraph is the person's name; further paragraphs become the subtitle; optional `image` is their photo. Read by `components/NssLeadership.tsx`. While unpublished, the page shows an honest "To be announced" card — names are never invented. |

## 3c. Students' Union members (`site_page_sections`)

`/student-zone/students-union` renders a "Meet Our Union" roster from the
sections table — **no new table or API is needed**. A published row whose
`heading` contains "Meet Our Union" (or "Union Members", case-insensitive)
carries the roster in its `items` JSON array:

```json
[
  { "name": "Aisha Rahman", "role": "Chairperson",
    "image": "/uploads/union/aisha.jpg", "image_alt": "Aisha Rahman",
    "course": "B.A. English", "year": "2025-26" },
  { "name": "V. K. Nandu", "role": "Cultural Secretary" }
]
```

- `name` and `role` are required; an entry missing either is skipped.
- `image`, `image_alt`, `course` (`department` also accepted) and `year`
  (`academic_year` also accepted) are optional. Without an image the card
  shows the member's initials — never a stock photograph.
- Entries whose role begins with Chairperson / President / Vice President /
  General Secretary / Secretary / Treasurer are promoted to the featured
  leadership row; everyone else lands in the standard grid.
- With no published member rows the section renders its empty state. Student
  profiles are never invented or seeded as examples.

Example (SQL editor):

```sql
insert into public.site_page_sections
  (page_path, heading, items, is_published, display_order)
values
  ('/student-zone/students-union', 'Meet Our Union',
   '[{"name":"…","role":"Chairperson"},{"name":"…","role":"Member"}]'::jsonb,
   true, 10);
```

## 4. Row Level Security

Follows the pattern used by the other `site_*` tables: public read of published
rows only; writes restricted to authenticated administrators.

```sql
alter table public.site_menu_items        enable row level security;
alter table public.site_student_resources enable row level security;
alter table public.site_page_sections     enable row level security;

-- Public (anon + authenticated) may read published rows.
create policy site_menu_items_public_read on public.site_menu_items
  for select using (is_published = true);

create policy site_student_resources_public_read on public.site_student_resources
  for select using (is_published = true);

create policy site_page_sections_public_read on public.site_page_sections
  for select using (is_published = true);

-- Administrators (authenticated) may manage everything.
create policy site_menu_items_admin_all on public.site_menu_items
  for all to authenticated using (true) with check (true);

create policy site_student_resources_admin_all on public.site_student_resources
  for all to authenticated using (true) with check (true);

create policy site_page_sections_admin_all on public.site_page_sections
  for all to authenticated using (true) with check (true);
```

> If the ERP already scopes admin writes by a role/JWT claim rather than by
> "authenticated", use that predicate instead of `using (true)` here. Keep the
> public-read policies exactly as above.

## 5. Realtime

The website's browser layer (`lib/liveData.ts`, `components/SiteLiveProvider.tsx`)
subscribes to a fixed set of tables. `site_menu_items` is already in both (as
`MENU_KEY` and in `CHROME_TABLES`), so a published menu edit already reaches open
tabs. The two content tables are not subscribed yet, and the ERP's realtime union
covers neither:

- Website: add `site_page_sections` and `site_student_resources` to
  `CHROME_TABLES` in `components/SiteLiveProvider.tsx` and to `PAGE_STAMP_KEYS`
  in `lib/liveData.ts` (they are page content, not chrome).
- RoyalAdmins: add `"site_menu_items"`, `"site_student_resources"` and
  `"site_page_sections"` to the table union in `lib/realtime.ts`.

```sql
alter publication supabase_realtime add table public.site_menu_items;
alter publication supabase_realtime add table public.site_student_resources;
alter publication supabase_realtime add table public.site_page_sections;
```

## 6. Authentication contract (`requires_auth`)

Some Student Zone destinations could need a signed-in student. This deployment
has no student authentication yet, so the fallback menu contains **no** private
links.

Current state:

- The `requires_auth` column is reserved in the DDL above, but the row builder
  (`lib/studentZoneMenuBuild.ts`) does **not** read it yet, and the menu item type
  has no such field.

To make it live, add the column (already in the DDL) and map it in
`buildStudentZoneItems`. The rule for the ERP and the website is:

- A `requires_auth` item must point at a route that performs a real server-side
  session check and redirects unauthenticated visitors to sign-in. Never rely on
  the flag alone to protect data.
- Private data (attendance, results, fee status) is never placed on public,
  indexed pages. `app/student-zone/[slug]` pages are informational only.

## 7. Seed

The SQL below reproduces the current fallback menu so the database and the code
agree on day one. `display_order` follows the order in
`content/studentZoneMenu.ts`. It is also included, commented, at the end of
`supabase/student_zone_cms.sql`.

```sql
insert into public.site_menu_items
  (menu_key, label, href, external_url, display_order, is_published)
values
  ('student_zone','Student Clubs','/student-zone/student-clubs',null,1,true),
  ('student_zone','Prospectus','/student-zone/prospectus',null,2,true),
  ('student_zone','NSS','/student-zone/nss',null,3,true),
  ('student_zone','Students'' Union','/student-zone/students-union',null,4,true),
  ('student_zone','College Magazine','/student-zone/college-magazine',null,5,true),
  ('student_zone','Campus Culture & Gallery','/student-zone/campus-culture-gallery',null,6,true),
  ('student_zone','Library','/student-zone/library',null,8,true);
```

No seed is provided for `site_student_resources` or `site_page_sections`: there
are no verified prospectus or magazine documents to publish, and
no body copy that is not already typed in the site. Inventing either is exactly
what this project avoids. The pages keep their typed content until staff publish
real rows, and the document lists show a deliberate empty state until real
documents exist.

## 8. RoyalAdmins (ERP) integration

The Website module renders one admin entity per `entityConfig` entry
(`components/website/entityConfig.ts`). There is no navigation entity today, so
managing the Student Zone menu means adding one config object (and, optionally, a
second for resources). This is a **proposal** for the ERP repo, not a change
made here.

Permission: reuse the existing `website.pages` permission (navigation is page
structure, and the permission already exists in `lib/permissions.ts` and the
seed `supabase/permissions_catalog_website.sql`). No new permission is required.

Proposed `entityConfig` entry for the menu (shape mirrors the existing `news`
entity):

```ts
{
  id: "student_zone_menu",
  label: "Student Zone Menu",
  singular: "Menu item",
  table: "site_menu_items",
  icon: "menu",
  group: "Navigation",
  description: "Links shown in the Student Zone menu and on the landing page.",
  permission: "website.pages",
  publishField: "is_published",
  defaultLayout: "table",
  // All rows belong to the same menu; the list is scoped by menu_key.
  order: { column: "display_order", ascending: true },
  searchFields: ["label", "href"],
  fields: [
    { name: "label", label: "Title", type: "text", required: true },
    { name: "href", label: "Internal link", type: "text",
      help: "Site path, must start with /" },
    { name: "external_url", label: "External URL", type: "url",
      help: "Only if there is no internal link" },
    { name: "display_order", label: "Display order", type: "number", defaultValue: 0 },
    { name: "is_published", label: "Visible", type: "checkbox", defaultValue: true },
  ],
  columns: [
    { name: "label", label: "Title" },
    { name: "href", label: "Link" },
    { name: "order", label: "Order", kind: "order" },
    { name: "status", label: "Visible", kind: "status" },
  ],
},
{
  id: "student_resources",
  label: "Student Resources",
  singular: "Resource",
  table: "site_student_resources",
  icon: "file",
  group: "Student Zone",
  description: "Prospectus and magazine documents for students.",
  permission: "website.content",
  publishField: "is_published",
  defaultLayout: "table",
  order: { column: "display_order", ascending: true },
  searchFields: ["title", "kind", "label", "year"],
  fields: [
    { name: "kind", label: "Type", type: "select", required: true,
      options: ["prospectus", "magazine"] },
    { name: "title", label: "Title", type: "text", required: true },
    { name: "description", label: "Description", type: "textarea", rows: 3, full: true },
    { name: "label", label: "Badge", type: "text",
      help: "Shown on the card; ignored when Year is set" },
    { name: "url", label: "Document URL", type: "url", required: true },
    { name: "image", label: "Cover image", type: "url",
      help: "Magazine editions only" },
    { name: "year", label: "Edition year", type: "text",
      help: "Magazine editions only" },
    { name: "display_order", label: "Order", type: "number", defaultValue: 0 },
    { name: "is_published", label: "Visible", type: "checkbox", defaultValue: true },
  ],
  columns: [
    { name: "kind", label: "Type", kind: "code" },
    { name: "title", label: "Title" },
    { name: "year", label: "Year" },
    { name: "order", label: "Order", kind: "order" },
    { name: "status", label: "Visible", kind: "status" },
  ],
},
{
  id: "student_page_sections",
  label: "Student Zone Sections",
  singular: "Section",
  table: "site_page_sections",
  icon: "file",
  group: "Student Zone",
  description: "Ordered body content for a Student Zone page, scoped by its route.",
  permission: "website.content",
  publishField: "is_published",
  defaultLayout: "table",
  order: { column: "display_order", ascending: true },
  searchFields: ["page_path", "heading"],
  fields: [
    { name: "page_path", label: "Page route", type: "text", required: true,
      help: "e.g. /student-zone/nss" },
    { name: "heading", label: "Heading", type: "text" },
    { name: "body", label: "Body", type: "textarea", rows: 6, full: true,
      help: "One or more paragraphs, separated by blank lines" },
    { name: "items", label: "Items", type: "json", full: true,
      help: "List of strings (bullets) or {title, text} objects (cards)" },
    { name: "image", label: "Image", type: "url" },
    { name: "image_alt", label: "Image description", type: "text" },
    { name: "link_url", label: "Link", type: "url" },
    { name: "link_label", label: "Link label", type: "text" },
    { name: "display_order", label: "Order", type: "number", defaultValue: 0 },
    { name: "is_published", label: "Visible", type: "checkbox", defaultValue: true },
  ],
  columns: [
    { name: "page_path", label: "Page", kind: "code" },
    { name: "heading", label: "Heading" },
    { name: "order", label: "Order", kind: "order" },
    { name: "status", label: "Visible", kind: "status" },
  ],
},
```

Also required in the ERP:

1. Add the entity ids to whatever registry `components/Website.tsx` iterates.
2. Scope the menu entity's query to `menu_key = 'student_zone'` (the public site
   reads only that key).
3. Add `"site_menu_items"`, `"site_student_resources"` and `"site_page_sections"`
   to the `RealtimeTable` union in `lib/realtime.ts`.
4. Confirm the `website.pages` and `website.content` permissions are granted to
   the relevant roles; they are already seeded, so no new migration is needed
   for permissions.

## 9. Editorial conventions

- `is_published` is the only public-visibility switch; unpublished rows are
  invisible to the anon key by RLS and by the getter's filter.
- `display_order` is a plain integer; ties are broken by the order the rows come
  back, so keep values distinct (1–10 for the current ten items).
- Internal links are validated on the website (`isUsableHref`) but should also
  be validated in the admin form to catch typos before publish.
- Adding an item is a single row with the next `display_order`; the website needs
  no code change. Removing an item is switching `is_published` off or deleting
  the row.
