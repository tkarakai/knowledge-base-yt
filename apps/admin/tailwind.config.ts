import type { Config } from "tailwindcss";
import designSystemConfig from "@repo/design-system/tailwind.config";

const config: Config = {
  presets: [designSystemConfig],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/design-system/src/**/*.{ts,tsx}",
  ],
};

export default config;
