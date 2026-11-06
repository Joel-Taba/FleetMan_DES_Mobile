import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Tokens live in the device keychain / keystore (expo-secure-store). SecureStore does
// not exist on web: the web build (smoke tests, demos) falls back to AsyncStorage.
const useSecureStore = Platform.OS === "ios" || Platform.OS === "android";

export async function secureGet(key: string): Promise<string | null> {
  try {
    return useSecureStore ? await SecureStore.getItemAsync(key) : await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (useSecureStore) await SecureStore.setItemAsync(key, value);
    else await AsyncStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the session stays in memory only */
  }
}

export async function secureDelete(key: string): Promise<void> {
  try {
    if (useSecureStore) await SecureStore.deleteItemAsync(key);
    else await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
