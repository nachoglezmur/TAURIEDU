import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/vite-env.d.ts",
          "src/main.tsx",
          "src/test/**",
          "src/__tests__/**",
        ],
      },
    },
  })
);
