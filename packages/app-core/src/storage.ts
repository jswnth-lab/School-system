import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KV } from "./queue-core";

// The session token is a credential: keychain/keystore. Everything else is plain app storage.
export const secure = {
  get: (k: string) => SecureStore.getItemAsync(k).catch(() => null),
  set: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  del: (k: string) => SecureStore.deleteItemAsync(k).catch(() => {}),
};
export const kv: KV = { get: (k) => AsyncStorage.getItem(k), set: (k, v) => AsyncStorage.setItem(k, v) };
export const kvDel = (k: string) => AsyncStorage.removeItem(k).catch(() => {});
