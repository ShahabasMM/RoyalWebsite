"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import SectionSubnav from "@/components/SectionSubnav";
import { findSection } from "@/content/sectionNav";

/**
 * Route-aware frame for the secondary navigation.
 *
 * Sections that own a submenu (About, Academics, Student Zone, Admissions,
 * Campus) display the page banner full-width, then the menu in a sticky left
 * sidebar beside the content on desktop. On smaller screens the menu keeps its
 * place above the content. Routes outside every section — home, news, contact
 * and the standalone legal / programme / app routes — are returned untouched,
 * so their layout never changes.
 *
 * The decision lives here rather than in per-section layouts so a new section
 * added to `content/sectionNav.ts` automatically gets the sidebar.
 */
export default function SectionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const section = findSection(pathname);

  if (!section) return <>{children}</>;

  return (
    <div className="section-shell">
      <div className="section-shell-inner">
        <aside className="section-sidebar">
          <SectionSubnav />
        </aside>
        <div className="section-shell-main">{children}</div>
      </div>
    </div>
  );
}
