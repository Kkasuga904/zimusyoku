import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/main.tsx",
        "src/modules/authStorage.ts",
        "src/modules/authClient.ts",
        "src/modules/summaryApi.ts",
        "src/modules/apiClient.ts",
        "src/modules/approvalsApi.ts",
        "src/modules/syncApi.ts",
        "src/modules/paymentsApi.ts",
        "src/pages/Home.tsx",
        "src/pages/Approvals.tsx",
        "src/pages/Jobs.tsx",
        "src/pages/JobDetail.tsx",
        "src/pages/Upload.tsx",
        "src/pages/Summary.tsx"
      ],
      thresholds: {
        lines: 85,
        functions: 80,
        branches: 80,
        statements: 85
      }
    }
  }
});
