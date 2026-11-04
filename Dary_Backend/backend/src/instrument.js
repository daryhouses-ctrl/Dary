import "dotenv/config";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const integrations = [Sentry.expressIntegration(), nodeProfilingIntegration()];

if (typeof Sentry.prismaIntegration === "function") {
  integrations.push(Sentry.prismaIntegration());
}

if (typeof Sentry.postgresIntegration === "function") {
  integrations.push(Sentry.postgresIntegration());
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations,

  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 1.0),

  profileSessionSampleRate: 1.0,
  profileLifecycle: "trace",

  environment: process.env.NODE_ENV || "development",
});

export default Sentry;
