import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { colors } from "@/theme/tokens";

/** Fond (clair ou sombre selon le thème) : dégradé bleuté très doux et deux halos discrets (commun à tous les écrans). */
export function ScreenBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[colors.bgTop, colors.bgMid, colors.bgBottom]}
        locations={[0, 0.38, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 200">
        <Defs>
          <RadialGradient id="blobA" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.haloA} stopOpacity="0.35" />
            <Stop offset="1" stopColor={colors.haloC} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="blobB" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.haloB} stopOpacity="0.35" />
            <Stop offset="1" stopColor={colors.haloB} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="blobC" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.haloC} stopOpacity="0.5" />
            <Stop offset="1" stopColor={colors.haloC} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="85" cy="12" r="45" fill="url(#blobA)" />
        <Circle cx="5" cy="70" r="40" fill="url(#blobB)" />
        <Circle cx="95" cy="140" r="38" fill="url(#blobC)" />
        <Circle cx="20" cy="190" r="42" fill="url(#blobB)" />
      </Svg>
    </View>
  );
}
