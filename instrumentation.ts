/**
 * Next.js instrumentation hook: starts OpenTelemetry export to Langfuse when keys are set.
 * @see https://langfuse.com/docs/observability/sdk/typescript/guide
 *
 * Env: LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY, optional LANGFUSE_BASE_URL
 * (e.g. https://cloud.langfuse.com or https://us.cloud.langfuse.com)
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const langfuseEnabled = Boolean(
  process.env.LANGFUSE_SECRET_KEY?.trim() &&
    process.env.LANGFUSE_PUBLIC_KEY?.trim()
);

export const langfuseSpanProcessor = langfuseEnabled
  ? new LangfuseSpanProcessor({
      exportMode: "immediate",
    })
  : null;

let sdkStarted = false;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!langfuseSpanProcessor || sdkStarted) return;
  const sdk = new NodeSDK({
    spanProcessors: [langfuseSpanProcessor],
  });
  sdk.start();
  sdkStarted = true;
}
