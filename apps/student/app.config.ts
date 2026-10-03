import type { ExpoConfig } from "expo/config";

// White-label builds set SCHOOL_SLUG (and name/ids) at build time; the shared app leaves it empty and asks for a school code.
const config: ExpoConfig = {
  name: process.env.APP_NAME ?? "School Student",
  slug: "sms-student",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "smsstudent",
  userInterfaceStyle: "automatic",
  ios: { bundleIdentifier: process.env.IOS_BUNDLE_ID ?? "com.example.sms.student", supportsTablet: true },
  android: {
    package: process.env.ANDROID_PACKAGE ?? "com.example.sms.student",
    adaptiveIcon: { backgroundColor: "#E6F4FE", foregroundImage: "./assets/images/android-icon-foreground.png", backgroundImage: "./assets/images/android-icon-background.png", monochromeImage: "./assets/images/android-icon-monochrome.png" },
  },
  plugins: ["expo-router", "expo-secure-store", "expo-notifications", ["expo-splash-screen", { backgroundColor: "#208AEF", image: "./assets/images/splash-icon.png", imageWidth: 76 }]],
  experiments: { typedRoutes: true },
  extra: { schoolSlug: process.env.SCHOOL_SLUG ?? "", apiUrl: process.env.API_URL, eas: { projectId: process.env.EAS_PROJECT_ID } },
};
export default config;
