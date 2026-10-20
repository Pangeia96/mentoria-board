// Testes de ponta a ponta numa CÓPIA ISOLADA do sistema (não mexe nos quadros do dia a dia):
//   web       http://localhost:3100  (build de produção)
//   realtime  ws://localhost:1334
//   dados     .data-test/ (apagado a cada execução)
// Sempre em modo dev: as variáveis do Supabase são forçadas a vazio, então nunca tocam o projeto real.
import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const DATA = resolve(root, ".data-test");

const WEB_PORT = 3100;
const RT_PORT = 1334;
const secrets = {
  REALTIME_SECRET: "e2e-only-realtime-secret-0123456789abcdef",
  SESSION_SECRET: "e2e-only-session-secret-0123456789abcdef",
};
const noSupabase = { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "", SUPABASE_URL: "" };

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts", // limpa .data-test UMA vez (o config é recarregado em cada worker)
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // um servidor compartilhado; specs independentes mas em série
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "e2e/report", open: "never" }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
  webServer: [
    {
      command: "node src/server.mjs",
      cwd: resolve(root, "realtime"),
      url: `http://localhost:${RT_PORT}`,
      reuseExistingServer: !!process.env.PW_REUSE, // PW_REUSE=1: usa servidores já ligados (depuração)
      timeout: 30_000,
      env: { ...noSupabase, ...secrets, PORT: String(RT_PORT), DOCS_DIR: resolve(DATA, "docs"), RECHECK_MS: "5000" },
    },
    {
      command: `${process.env.PW_NO_BUILD ? "" : "npm run build && "}npx next start -p ${WEB_PORT}`, // PW_NO_BUILD=1 reaproveita o último build
      cwd: resolve(root, "web"),
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: !!process.env.PW_REUSE, // PW_REUSE=1: usa servidores já ligados (depuração)
      timeout: 300_000,
      env: {
        ...noSupabase,
        ...secrets,
        APP_URL: `http://localhost:${WEB_PORT}`,
        NEXT_PUBLIC_REALTIME_URL: `ws://localhost:${RT_PORT}`,
        REALTIME_HTTP_URL: `http://localhost:${RT_PORT}`,
        DEV_DB_FILE: resolve(DATA, "dev-db.json"),
      },
    },
  ],
});
