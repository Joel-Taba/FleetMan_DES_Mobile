import { useMemo } from "react";
import { SvgXml } from "react-native-svg";

import { colors } from "@/theme/tokens";

import { LOGO_SVG } from "./logoSvg";

// Crops of the 1024 x 1024 source drawing: the truck alone, or truck + FLEETMAN wordmark.
const VIEWBOXES = {
  mark: { box: "315 431 431 192", ratio: 192 / 431 },
  full: { box: "144 431 735 285", ratio: 285 / 735 },
} as const;

type Props = {
  /** Width in dp (the height follows the logo's proportions). */
  size?: number;
  color?: string;
  variant?: keyof typeof VIEWBOXES;
};

/** FleetMan logo (vector, any color). */
export function Logo({ size = 64, color = colors.accent, variant = "mark" }: Props) {
  const { box, ratio } = VIEWBOXES[variant];
  const xml = useMemo(() => LOGO_SVG.replace("__FILL__", color).replace("__VIEWBOX__", box), [color, box]);
  return <SvgXml xml={xml} width={size} height={Math.round(size * ratio)} />;
}
