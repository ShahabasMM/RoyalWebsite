import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ExternalLink, FileText, Inbox } from "lucide-react";

import { breadcrumbJsonLd } from "@/lib/seo";
import type { StudentResource } from "@/lib/siteContent";
import type { StudentZonePageContent } from "@/lib/studentZoneContent";

export type StudentZoneLink = {
  label: string;
  href: string;
  description?: string;
};

const CHECK = "✓";

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Shared, deliberately minimal layout for the non-specialised Student Zone
 * pages (Prospectus, NSS, Students' Union, College Magazine).
 *
 * It renders only what the data layer hands it: a breadcrumb and title, the
 * page's ordered sections, an optional document list and optional helpful
 * links. No hero, no oversized cards. Student Clubs, Campus Culture & Gallery
 * and Library keep their own, richer designs.
 *
 * Document lists show a deliberate empty state rather than invented downloads,
 * which is the only place a page can legitimately appear "empty" — the page
 * copy itself always has a verified fallback behind it.
 */
export default function StudentZonePage({
  content,
  resources,
  resourcesTitle = "Downloads",
  emptyTitle = "Nothing published yet",
  emptyText = "This page will fill in once the college publishes its content.",
  links = [],
  linksTitle = "Helpful links",
  children,
}: {
  content: StudentZonePageContent;
  /** Documents for this page. Omitted entirely on pages with no downloads. */
  resources?: StudentResource[];
  resourcesTitle?: string;
  emptyTitle?: string;
  emptyText?: string;
  links?: StudentZoneLink[];
  linksTitle?: string;
  /** Extra markup (e.g. the grievance form) rendered after the sections. */
  children?: ReactNode;
}) {
  const schema = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Student Zone", path: "/student-zone" },
    { name: content.title, path: "" },
  ]);

  const updated = content.updatedAt ? formatDate(content.updatedAt) : "";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <main className="content ip szp">
        <section className="ip-section">
          <div className="container ip-narrow">
            <nav className="szp-crumbs" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span aria-hidden="true">/</span>
              <Link href="/student-zone">Student Zone</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{content.title}</span>
            </nav>

            <h1 className="szp-title">{content.title}</h1>

            {content.lead ? <p className="muted ip-lead">{content.lead}</p> : null}
          </div>
        </section>

        {content.sections.length > 0 ? (
          <section className="ip-section">
            <div className="container ip-narrow">
              <div className="ip-sections">
                {content.sections.map((section) => (
                  <section className="ip-block" key={section.id}>
                    {section.heading ? (
                      <h2 className="ip-block-title">{section.heading}</h2>
                    ) : null}

                    {section.paragraphs.map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}

                    {section.list.length > 0 ? (
                      <ul className="ip-block-list">
                        {section.list.map((item, index) => (
                          <li key={index}>
                            <span className="ip-block-mark" aria-hidden="true">
                              {CHECK}
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {section.cards.length > 0 ? (
                      <ul className="ip-points">
                        {section.cards.map((card) => (
                          <li className="ip-point" key={card.title}>
                            <span className="ip-point-mark" aria-hidden="true">
                              {CHECK}
                            </span>
                            <div>
                              <strong>{card.title}</strong>
                              {card.text ? <p>{card.text}</p> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {section.image ? (
                      <figure className="szp-media">
                        {/* Plain <img>, matching MediaGallery: CMS images are
                            already rewritten to loadable URLs by the loader and
                            cannot depend on a next/image remote allow-list. */}
                        <img src={section.image} alt={section.imageAlt ?? ""} loading="lazy" />
                      </figure>
                    ) : null}

                    {section.linkUrl ? (
                      <a
                        className="szp-link"
                        href={section.linkUrl}
                        {...(section.linkUrl.startsWith("/")
                          ? {}
                          : { target: "_blank", rel: "noopener noreferrer" })}
                      >
                        {section.linkLabel}
                        <ArrowRight size={14} strokeWidth={2.3} aria-hidden="true" />
                      </a>
                    ) : null}
                  </section>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {children}

        {resources ? (
          <section className="ip-section">
            <div className="container">
              <div className="ip-head">
                <h2 className="ip-title">{resourcesTitle}</h2>
              </div>

              {resources.length > 0 ? (
                <div className="sz-resource-grid">
                  {resources.map((resource) => (
                    <a
                      className="sz-resource"
                      key={resource.id}
                      href={resource.url}
                      {...(resource.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      <span className="sz-resource-media" aria-hidden="true">
                        {resource.image ? (
                          <img src={resource.image} alt="" loading="lazy" />
                        ) : (
                          <FileText size={22} strokeWidth={2} />
                        )}
                      </span>
                      <span className="sz-resource-body">
                        <span className="sz-resource-label">
                          {resource.year || resource.label}
                        </span>
                        <span className="sz-resource-title">{resource.title}</span>
                        {resource.description ? (
                          <span className="sz-resource-text">{resource.description}</span>
                        ) : null}
                        <span className="sz-resource-cta">
                          {resource.external ? "Open document" : "Download"}
                          {resource.external ? (
                            <ExternalLink size={14} strokeWidth={2.3} aria-hidden="true" />
                          ) : (
                            <ArrowRight size={14} strokeWidth={2.3} aria-hidden="true" />
                          )}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="sz-empty" role="status">
                  <div className="sz-empty-icon" aria-hidden="true">
                    <Inbox size={20} strokeWidth={2} />
                  </div>
                  <h2>{emptyTitle}</h2>
                  <p className="muted">{emptyText}</p>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {links.length > 0 ? (
          <section className="ip-section">
            <div className="container">
              <div className="ip-head">
                <h2 className="ip-title">{linksTitle}</h2>
              </div>
              <div className="sz-grid">
                {links.map((link) => (
                  <a className="sz-card" key={link.href} href={link.href}>
                    <span className="sz-card-body">
                      <span className="sz-card-title">{link.label}</span>
                      {link.description ? (
                        <span className="sz-card-text">{link.description}</span>
                      ) : null}
                    </span>
                    <span className="sz-card-go" aria-hidden="true">
                      <ArrowRight size={16} strokeWidth={2.2} />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {updated ? (
          <section className="ip-section">
            <div className="container ip-narrow">
              <p className="szp-meta muted">Last updated {updated}</p>
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
