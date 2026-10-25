# Section (secondary) navigation

The contextual navigation for every main section page. On desktop it is a
sticky left sidebar beside the page content; on tablet and mobile it stays above
the content as the original horizontal bar. Home, News and Contact belong to no
section, so they render no secondary navigation at all.

## Where it lives

| Concern | File |
| --- | --- |
| Section + item configuration | `content/sectionNav.ts` |
| The menu itself | `components/SectionSubnav.tsx` |
| Route-aware sidebar frame | `components/SectionShell.tsx` |
| Mount point (once, site-wide) | `app/layout.tsx`, right after `<FlashNewsTicker />` |
| Styles | `app/globals.css`, block headed "Section secondary navigation" |

A page does **not** opt in or wire anything up. `SectionShell` is a client
component rendered once from the root layout; it reads the current route with
`usePathname()` and decides which section (if any) to show. Inside a section it
wraps `SectionSubnav` in a sticky `<aside>` and the page in a `.section-shell-main`
column. Outside every section it returns the children untouched.

## Layout

- **Desktop (≥ 1100px, matching the site breakpoint):** the shell is the
  viewport width minus 40px (20px gutters each side). The banner spans the full
  shell width in its own grid row above a second row containing a
  `clamp(248px, 20vw, 280px)` left sidebar and the page content. The banner's
  inner copy is inset by the sidebar column so its title and breadcrumb stay on
  the same left edge as the content below. The sidebar card is `position:
  sticky` with `top: 100px` (82px sticky header plus 18px breathing room), and
  scrolls internally when its menu is taller than the viewport. It stays inside
  the shell, so it never overlaps the footer.
- **Tablet / mobile (< 1100px):** the shell is a plain block. The menu keeps its
  existing position directly above the content (the stacked navy bar below
  900px), and all existing sidebar styles are scoped to the desktop media query.
- **Excluded routes:** home, `/news` and `/contact` (plus `/privacy`, `/terms`,
  `/programs/*`, `/apps` and the student app) match no section, so they render
  exactly as before.

## How a section is chosen

Each `SectionNav` has a `match` prefix. `findSection(pathname)` returns the
section whose prefix the route is inside (longest prefix wins when they could
overlap). Routes outside every section — home, `/news`, `/contact`, `/privacy`,
`/terms`, `/programs/*` — render nothing, which is why the bar never appears
where it does not belong.

The active pill is chosen by `findActiveItem(section, pathname)`: the most
specific item whose route is an ancestor of the current path, so nested routes
light up their parent. On the section overview itself (e.g. `/academics`) no
item matches and the section name on the left is highlighted instead.

## Adding or changing entries

Edit `content/sectionNav.ts`: add to a section's `items` (label, href, optional
`order` is implicit in array order), or add a whole section object. Every route
must exist under `app/` — the config deliberately contains no placeholder or
`href="#"` links. To add a new main section, give it an `id` (matching the future
CMS `menu_key`), a `label`, the `href` of its overview page, its `match` prefix,
and its `items`.

## Future CMS integration (RoyalAdmins ERP Website module)

The configuration is intentionally local and typed today, so the bar can never
break when the database is unavailable. It is designed to move to the CMS later
without touching the component:

- A section maps to a `menu_key` (the `id` above). The website would read
  `site_menu_items` where `menu_key = <id>` and `is_published = true`, ordered by
  `display_order`, exactly as the header's Student Zone menu already does
  (`lib/studentZoneMenuBuild.ts`, `lib/siteContent.ts`). Those rows would replace
  the section's `items`; the `SectionSubnav` component would not change.
- The planned schema (label, href, external_url, display_order, is_published)
  and its RLS/realtime/seed are described in
  [`student-zone-cms-contract.md`](./student-zone-cms-contract.md). That contract
  already covers the four fields an administrator would manage — title, route,
  order and visibility — so the same table serves every section.
- `findSection` falls back to this local config, so a missing table, an unset
  environment or an empty menu degrades to the current static bar.

No database is created or modified by the website; this document is the
integration point only.
