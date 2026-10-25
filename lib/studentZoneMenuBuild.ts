import {
  isUsableHref,
  type StudentZoneItem,
} from "@/content/studentZoneMenu";

/**
 * One row of `site_menu_items`.
 *
 * Shared by the server loader (lib/siteContent.ts) and the browser realtime
 * layer (lib/liveData.ts) so both build the menu from the database the same
 * way. See docs/student-zone-cms-contract.md for the table definition.
 */
export type StudentZoneMenuItemRow = {
  id?: string;
  menu_key?: string | null;
  label?: string | null;
  href?: string | null;
  external_url?: string | null;
  display_order?: number | null;
  is_published?: boolean | null;
};

/**
 * Turns database rows into the flat menu the header and landing page render.
 *
 * A row keeps its order via `display_order`. A row with no label, or with
 * neither a usable internal `href` nor a usable external `external_url`, is
 * skipped rather than rendered as a dead link.
 */
export function buildStudentZoneItems(
  rows: StudentZoneMenuItemRow[],
): StudentZoneItem[] {
  return rows
    .map((row, index): StudentZoneItem | null => {
      const label = row.label?.trim();

      if (!label) return null;

      // An internal route wins; otherwise an external URL. A row with neither is
      // an unfinished draft and is skipped.
      const internal =
        typeof row.href === "string" &&
        isUsableHref(row.href) &&
        row.href.trim().startsWith("/")
          ? row.href.trim()
          : null;
      const external =
        typeof row.external_url === "string" &&
        isUsableHref(row.external_url) &&
        !row.external_url.trim().startsWith("/")
          ? row.external_url.trim()
          : null;

      const href = internal ?? external;

      if (!href) return null;

      return {
        label,
        href,
        order: typeof row.display_order === "number" ? row.display_order : index,
        visible: row.is_published !== false,
        external: Boolean(external),
      };
    })
    .filter((item): item is StudentZoneItem => item !== null)
    .sort((a, b) => a.order - b.order);
}
