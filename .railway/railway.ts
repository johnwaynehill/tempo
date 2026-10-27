// Tempo's Railway project, as Infrastructure as Code. Replaces the per-service
// railway.json files, which Railway stops reading on 2026-12-01.
//
// Railway doesn't read this file on deploy: changes take effect only through
// `railway config plan` (preview) and `railway config apply`. This file describes
// the whole project, so a resource left out of it is planned for deletion.
// `preserve()` keeps a variable's current value on Railway, out of the repo.
// The web app, API and MCP server use Railway's default restart policy (restart on
// failure, up to 10 times). Railway stores the default as unset, so declaring it
// here would show as a change in every plan.
// See .railway/README.md and Docs/ProjectReference.md.

import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

const REPO = "johnwaynehill/tempo";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "us-west2" });
  Postgres.networking = { privateNetworkEndpoint: "postgres", tcpProxies: { "5432": {} } };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-west2", sizeMB: 5000 });

  // Web app: Vite build served by `serve` (Dockerfile at the repo root).
  const tempo = service("tempo", {
    source: github(REPO, { checkSuites: false }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    replicas: { "us-west2": 1 },
    domains: [{ domain: "tempo.designbyjohnwayne.com", port: 3000 }],
    env: { VITE_ANTHROPIC_PROXY_URL: preserve(), VITE_FIREBASE_API_KEY: preserve(), VITE_FIREBASE_APP_ID: preserve(), VITE_FIREBASE_AUTH_DOMAIN: preserve(), VITE_FIREBASE_MESSAGING_SENDER_ID: preserve(), VITE_FIREBASE_PROJECT_ID: preserve(), VITE_FIREBASE_STORAGE_BUCKET: preserve() },
  });

  const tempoApi = service("tempo-api", {
    source: github(REPO, { checkSuites: false, rootDirectory: "/api" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "api/Dockerfile" },
    replicas: { "us-west2": 1 },
    env: { ANTHROPIC_API_KEY: preserve(), APNS_KEY: preserve(), APNS_KEY_ID: preserve(), APNS_TEAM_ID: preserve(), APP_URL: preserve(), AUTOPLAN_SECRET: preserve(), DATABASE_URL: preserve(), FIREBASE_PROJECT_ID: preserve(), FIREBASE_SA_CLIENT_EMAIL: preserve(), FIREBASE_SA_PRIVATE_KEY: preserve(), GOOGLE_CLIENT_ID: preserve(), GOOGLE_CLIENT_SECRET: preserve(), GOOGLE_OAUTH_REDIRECT_URI: preserve(), GOOGLE_SYNC_SECRET: preserve(), PORT: preserve(), TOKEN_ENCRYPTION_KEY: preserve() },
  });

  // Remote MCP server. Rebuilds only when something under mcp/ changes.
  const tempoMcp = service("tempo-mcp", {
    source: github(REPO, { checkSuites: false, rootDirectory: "/mcp" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "mcp/Dockerfile", watchPatterns: ["/mcp/**"] },
    replicas: { "us-west2": 1 },
    env: { PORT: preserve(), PUBLIC_URL: preserve(), TEMPO_API_KEY: preserve(), TEMPO_API_URL: preserve(), TZ: preserve() },
  });

  // Crons: a curl container that POSTs to the API and exits. Times are UTC.
  // A cron runs with the variables from its last deploy: redeploy after changing one.
  const gcalSyncCron = service("gcal-sync-cron", {
    source: github(REPO, { checkSuites: false, rootDirectory: "/" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "api/cron-gcal-sync/Dockerfile" },
    deploy: { cronSchedule: "0 13,1 * * *", restartPolicyType: "NEVER" },
    replicas: { "us-west2": 1 },
    env: { API_URL: preserve(), GOOGLE_SYNC_SECRET: preserve() },
  });

  // Not linked to the repo: deployed with `railway up` from api/cron-autoplan/,
  // so its Dockerfile is at the root of that upload.
  const autoplanCron = service("autoplan-cron", {
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    deploy: { cronSchedule: "30 13 * * *", restartPolicyType: "NEVER" },
    replicas: { "us-west2": 1 },
    env: { API_URL: preserve(), AUTOPLAN_SECRET: preserve() },
  });

  return project("Tempo", {
    resources: [Postgres, postgresVolume, tempo, tempoApi, tempoMcp, gcalSyncCron, autoplanCron],
  });
});
