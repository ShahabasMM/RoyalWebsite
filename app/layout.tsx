import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FlashNewsTicker from "@/components/FlashNewsTicker";
import SectionShell from "@/components/SectionShell";
import { SiteLiveProvider } from "@/components/SiteLiveProvider";
import VisitorProvider from "@/components/VisitorProvider";
import { getFlashNews, getProgrammes, getSiteSettings, getStudentZoneMenu } from "@/lib/siteContent";
import {
  DEFAULT_DESCRIPTION,
  OG_IMAGE_ALT,
  OG_IMAGE_PATH,
  SCHOOL_LEGAL,
  SCHOOL_NAME,
  SITE_URL,
  TITLE_SUFFIX,
  organizationJsonLd,
  webSiteJsonLd,
} from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  // Without a base, Next drops every relative URL it is given — which silently
  // removes canonicals, OG image URLs and sitemap entries.
  metadataBase: new URL(SITE_URL),

  // `default` is the homepage and opts out of the template; every other page
  // sets a bare title and gets " | Royal College of Arts & Science, Thrithala".
  title: {
    default: `${SCHOOL_NAME}, Thrithala | Kerala`,
    template: `%s | ${TITLE_SUFFIX}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SCHOOL_NAME,
  authors: [{ name: SCHOOL_NAME, url: SITE_URL }],
  creator: SCHOOL_NAME,
  publisher: SCHOOL_NAME,
  category: "Education",
  keywords: [
    "Royal College Thrithala",
    "Royal College of Arts and Science Thrithala",
    "Royal College Thrithala Palakkad",
    "arts and science college in Thrithala",
    "degree college in Thrithala",
    "college in Thrithala Palakkad",
    "University of Calicut affiliated colleges",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: SCHOOL_LEGAL,
    title: `${SCHOOL_NAME}, Thrithala | Kerala`,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: OG_IMAGE_PATH, alt: OG_IMAGE_ALT, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SCHOOL_NAME}, Thrithala | Kerala`,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "64x64", type: "image/png" },
      { url: "/college-mark.png", sizes: "160x153", type: "image/png" },
    ],
    apple: [{ url: "/icon.png", sizes: "64x64", type: "image/png" }],
  },
  formatDetection: {
    telephone: true,
    address: true,
    email: true,
  },
};

// Rendered on every request rather than from the static cache.
//
// This page reads the CMS, and a 300s revalidate window meant an admin edit
// could sit invisible for up to five minutes even after router.refresh(): Next
// answered from the static shell. force-dynamic makes the server ask Supabase
// each time, which is what makes actual realtime updates appear.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [{ applyEnabled }, flashNews, programmes, studentZoneMenu] = await Promise.all([
    getSiteSettings(),
    getFlashNews(),
    getProgrammes(),
    getStudentZoneMenu(),
  ]);

  // The footer lists programmes by name, so a programme added in the admin
  // appears there without a code change.
  const programs = programmes.slice(0, 6).map((programme) => ({
    name: programme.name,
    shortName: programme.shortName || programme.name,
    slug: programme.slug ?? null,
  }));

  return (
    <html lang="en-IN">
      <body>
        {/* Site-wide structured data. EducationalOrganization first, because
            WebSite references it via publisher @id. Values are verified from
            content/contactDetails.ts and the About pages — see lib/seo.ts for
            what was deliberately left out and why. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd()) }}
        />

        {/* SSR baseline below; SiteLiveProvider keeps it in step with the CMS. */}
        <SiteLiveProvider
          applyEnabled={applyEnabled}
          flashNews={flashNews}
          programs={programs}
          studentZoneMenu={studentZoneMenu}
        >
          <VisitorProvider>
            <Header />

            <FlashNewsTicker />

            <SectionShell>{children}</SectionShell>

            <Footer />
          </VisitorProvider>
        </SiteLiveProvider>
      </body>
    </html>
  );
}