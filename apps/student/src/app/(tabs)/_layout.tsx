import { Tabs } from "expo-router";
import { t, useTheme } from "@sms/app-core";

export default function TabsLayout() {
  const th = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: th.accent, tabBarInactiveTintColor: th.muted, tabBarStyle: { backgroundColor: th.surface, borderTopColor: th.line }, tabBarIconStyle: { display: "none" }, tabBarLabelStyle: { fontSize: 15, marginBottom: 12 } }}>
      <Tabs.Screen name="index" options={{ title: t("home") }} />
      <Tabs.Screen name="profile" options={{ title: t("profile") }} />
    </Tabs>
  );
}
