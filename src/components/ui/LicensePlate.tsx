import { Text, View } from "react-native";

import { colors, monoFont, themedStyles } from "@/theme/tokens";

/** Yellow licence plate (FleetMan brand element, same look as the web front). */
export function LicensePlate({ plate, size = "sm" }: { plate: string; size?: "sm" | "md" }) {
  const md = size === "md";
  return (
    <View style={[styles.plate, md ? styles.plateMd : styles.plateSm]}>
      <Text style={[styles.text, { fontSize: md ? 19 : 13, letterSpacing: md ? 2 : 1.2 }]} numberOfLines={1}>
        {plate?.trim() || "-"}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  plate: {
    alignSelf: "flex-start",
    backgroundColor: colors.plateYellow,
    borderColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  plateSm: { borderWidth: 1.5, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  plateMd: { borderWidth: 2, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 4 },
  text: { fontFamily: monoFont, fontWeight: "700", color: "#111" },
}));
