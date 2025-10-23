import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/main.tsx",
        "**/*.d.ts",
        "scripts/**",
        "../docs/**",
        "../dist/**"
      ],
      thresholds: {
        statements: 0.85,
        branches: 0.85,
        functions: 0.85,
        lines: 0.85
      }
    }
  }
});