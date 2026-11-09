import type { Metadata } from "next";
import { notFound } from "next/navigation";
import InnerPage, { type InnerPageData } from "@/components/InnerPage";
import { aboutPages } from "@/content/aboutPages";
import { breadcrumbJsonLd, descriptionFrom, pageMetadata } from "@/lib/seo";
import { getLeadershipMessage } from "@/lib/siteContent";

export const dynamic = "force-dynamic";

type PageParams = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return Object.keys(aboutPages).map((slug) => ({ slug }));
}

/**
 * Each About page derives its metadata from the content entry itself, so a new
 * slug is covered the moment it is added to content/aboutPages.ts. heroLead is
 * already written as a one-line summary of the page, which is exactly what a
 * meta description should be.
 */
export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const page = aboutPages[slug];

  if (!page) {
    return { title: "Page not found" };
  }

  return pageMetadata({
    title: page.title,
    description: descriptionFrom(page.heroLead),
    path: `/about/${slug}`,
  });
}

export default async function AboutDestination({ params }: PageParams) {
  const { slug } = await params;
  const page = aboutPages[slug];

  if (!page) {
    notFound();
  }

  const message = await getLeadershipMessage(slug);
  const pageData = message ? { ...page, body: message } : page;

  return <InnerPage data={pageData} crumbs={[{ name: "About", path: "/about/about-college" }]} />;
}
