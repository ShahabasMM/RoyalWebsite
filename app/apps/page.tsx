import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight, Smartphone } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { publicCollegeApps, type CollegeApp } from "@/lib/apps";
import { InstallButton } from "./InstallButton";
import styles from "./apps.module.css";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Royal College Apps",
    description:
      "Official apps from Royal College of Arts & Science, Thrithala.",
    path: "/apps",
  }),
  manifest: "/student-app/manifest.json",
};

const platforms = [
  { id: "android", title: "Android", note: "Android phones and tablets" },
  { id: "iphone", title: "iPhone & iPad", note: "Install with Safari" },
] as const;

function AppCard({ app, platform }: { app: CollegeApp; platform: "android" | "iphone" }) {
  return (
    <article className={styles.appCard}>
      <Image
        className={styles.appIcon}
        src={app.iconUrl}
        alt={`${app.name} app icon`}
        width={64}
        height={64}
        unoptimized
      />
      <div className={styles.appInfo}>
        <h3>{app.name}</h3>
        <p>{app.description}</p>
        <span className={styles.appMeta}>{platform === "android" ? "Android · Web app" : "iPhone & iPad · Web app"}</span>
      </div>
      <div className={styles.actions}>
        <InstallButton platform={platform} />
        <a className={styles.openLink} href={app.appUrl} aria-label={`Open ${app.name}`}>
          Open <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

export default function AppsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.intro}>
          <div className={styles.kicker}>Official applications</div>
          <h1>Royal College Apps</h1>
        </header>

        <div className={styles.platformGrid}>
          {platforms.map((platform) => {
            const apps = publicCollegeApps.filter((app) => app.platforms.includes(platform.id));
            return (
              <section className={styles.platformPanel} key={platform.id} aria-labelledby={`${platform.id}-heading`}>
                <div className={styles.platformHeader}>
                  <span className={styles.platformIcon} aria-hidden="true"><Smartphone size={19} /></span>
                  <div>
                    <h2 id={`${platform.id}-heading`}>{platform.title}</h2>
                    <p>{platform.note}</p>
                  </div>
                </div>
                {apps.length ? (
                  <div className={styles.appList}>
                    {apps.map((app) => <AppCard key={`${app.id}-${platform.id}`} app={app} platform={platform.id} />)}
                  </div>
                ) : (
                  <p className={styles.emptyState}>No apps are available for this platform right now.</p>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
