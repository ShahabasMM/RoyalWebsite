import type { Metadata } from "next";
import { Fragment } from "react";
import PageHero from "@/components/PageHero";
import { img } from "@/content/innerPageData";
import { getFacultyGroups } from "@/lib/siteContent";

import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Faculty",
  description:
    "Meet the faculty at Royal College of Arts & Science, Thrithala, organised by department, with the heads of department for Computer Applications, Commerce, English, Malayalam and Arabic.",
  path: "/academics/faculty",
});

// Rendered on every request rather than from the static cache.
//
// This page reads the CMS, and a 300s revalidate window meant an admin edit
// could sit invisible for up to five minutes even after router.refresh(): Next
// answered from the static shell. force-dynamic makes the server ask Supabase
// each time, which is what makes realtime updates actually appear.
export const dynamic = "force-dynamic";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default async function Faculty() {
  const { groups, total, namedDepartments } = await getFacultyGroups();

  return (
    <>
      <PageHero
        title="Faculty"
        crumb="Academics / Faculty"
        image={img("photo-1524178232363-1fb2b075b655")}
        lead="Meet the faculty who teach across the college."
      />

      <main className="content ip">
        <section className="ip-section">
          <div className="container ip-narrow">
            <div className="section-kicker">Teaching staff</div>
            <h2 className="ip-title">The people who teach at Royal College.</h2>
            <p className="muted ip-lead">
              {total} members of the teaching staff, across {namedDepartments.join(", ")}.
            </p>
          </div>
        </section>

        <section className="ip-section">
          <div className="container">
            {groups.length === 0 ? (
              <p className="muted">No faculty profiles have been published yet.</p>
            ) : (
            <div className="ip-fac-groups">
              {groups.map((group) => (
                <Fragment key={group.key}>
                  <div className="ip-fac-head" data-dept={group.key}>
                    <span className="ip-fac-dot" aria-hidden="true" />
                    <h2>{group.label}</h2>
                    <span className="ip-fac-count">{group.members.length}</span>
                  </div>
                  {group.members.map((member) => (
                    <article
                      className="ip-fac-card"
                      data-dept={group.key}
                      data-hod={member.role ? "true" : undefined}
                      key={`${group.key}-${member.name}`}
                    >
                      <span className="ip-fac-avatar">
                        {member.image ? (
                          // Signed ERP profile-photo URLs are short-lived and generated server-side.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.image} alt={`${member.name} profile`} loading="lazy" />
                        ) : (
                          <span aria-hidden="true">{initials(member.name)}</span>
                        )}
                      </span>
                      <div className="ip-fac-info">
                        <h3>{member.name}</h3>
                        {member.role || member.department ? (
                          <p className="ip-fac-meta">
                            {member.role ? (
                              <span className="ip-fac-hod">{member.role}</span>
                            ) : null}
                            {member.role && member.department ? " · " : null}
                            {member.department}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </Fragment>
              ))}
            </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
