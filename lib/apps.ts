/** Public metadata verified from the deployed Royal Students PWA manifest. */
export type CollegeApp = {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  appUrl: string;
  platforms: readonly ("android" | "iphone")[];
};

export const publicCollegeApps: readonly CollegeApp[] = [
  {
    id: "royal-students",
    name: "Royal Students",
    description:
      "The official student app for Royal College of Arts and Science, Thrithala.",
    iconUrl: "/student-app/icons/Icon-512.png",
    appUrl: "/student-app/",
    platforms: ["android", "iphone"],
  },
];
