import type { ComponentType } from "react";

import BorderRadiusShowcase from "./border-radius";
import ColorsShowcase from "./colors";
import GlowsShowcase from "./glows";
import IconsShowcase from "./icons";
import ShadowsShowcase from "./shadows";
import SpacingShowcase from "./spacing";
import TypographyShowcase from "./typography";

export const foundationShowcaseMap: Record<string, ComponentType> = {
  "border-radius": BorderRadiusShowcase,
  colors: ColorsShowcase,
  glows: GlowsShowcase,
  icons: IconsShowcase,
  shadows: ShadowsShowcase,
  spacing: SpacingShowcase,
  typography: TypographyShowcase,
};
