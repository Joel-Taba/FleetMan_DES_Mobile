import { Tabs } from "expo-router/js-tabs";

import { DRIVER_TABS, GlassTabBar } from "@/components/navigation/GlassTabBar";
import { useT } from "@/i18n";
import { colors } from "@/theme/tokens";

export default function TabsLayout() {
  const { t } = useT();
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bgBottom } }}
    >
      {DRIVER_TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: t(tab.label) }} />
      ))}
    </Tabs>
  );
}
