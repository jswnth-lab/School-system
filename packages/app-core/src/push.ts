import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { api } from "./api";
import type { AppKind } from "./config";

/** Ask permission, get an Expo push token and register it with the school. Returns the token, or null if push isn't available. */
export async function registerForPush(school: string, app: AppKind): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // simulators have no push
    // Expo Go (Android) throws as soon as expo-notifications is imported, so load it lazily and only in real builds.
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
    const Notifications = await import("expo-notifications");
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return null; // set by `eas init`; push stays off until then
    if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "School updates", importance: Notifications.AndroidImportance.DEFAULT });
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api(`/${school}/devices`, { body: { token, platform: Platform.OS === "ios" ? "ios" : "android", app } });
    return token;
  } catch {
    return null; // push is best effort; never block sign-in
  }
}

export const unregisterPush = (school: string, token: string) => api(`/${school}/devices`, { method: "DELETE", body: { token } }).catch(() => {});
