import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export type NotificationPrefs = {
  assignments: boolean;
  tripReminders: boolean;
  documents: boolean;
  incidents: boolean;
  sound: boolean;
};

const DEFAULTS: NotificationPrefs = {
  assignments: true,
  tripReminders: true,
  documents: true,
  incidents: true,
  sound: true,
};

/** Notification preferences of the driver, stored on the device only. */
export function useNotificationPrefs(userId: string | undefined) {
  const key = `fm:prefs:notifications:${userId ?? "anon"}`;
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (active && raw) setPrefs({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<NotificationPrefs>) });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [key]);

  const toggle = useCallback(
    (name: keyof NotificationPrefs, value: boolean) => {
      setPrefs((current) => {
        const next = { ...current, [name]: value };
        AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => undefined);
        return next;
      });
    },
    [key]
  );

  return { prefs, toggle };
}
