import type { GenerateContentResponse } from "@google/genai";

export function isLangfuseEnabled(): boolean {
  return Boolean(
    process.env.LANGFUSE_SECRET_KEY?.trim() &&
      process.env.LANGFUSE_PUBLIC_KEY?.trim()
  );
}

type GeminiCallOpts = {
  /** e.g. strict_pool, strict_pool_repair, soft_chat */
  observationName: string;
  model: string;
  temperature: number;
  contentsTurns: number;
  systemPromptChars: number;
  run: () => Promise<GenerateContentResponse>;
};

/**
 * Wraps a Gemini generateContent call in a Langfuse trace + generation (tokens, model).
 * No-op when Langfuse env vars are unset.
 */
export async function traceGeminiGenerateContent(
  opts: GeminiCallOpts
): Promise<GenerateContentResponse> {
  if (!isLangfuseEnabled()) {
    return opts.run();
  }

  const { startActiveObservation, startObservation } = await import(
    "@langfuse/tracing"
  );

  return startActiveObservation(
    `carvemusic/${opts.observationName}`,
    async (span) => {
      span.update({
        input: {
          model: opts.model,
          temperature: opts.temperature,
          contentsTurns: opts.contentsTurns,
          systemPromptChars: opts.systemPromptChars,
        },
      });

      const gen = startObservation(
        "google-generateContent",
        {
          model: opts.model,
          modelParameters: { temperature: opts.temperature },
          input: {
            contentsTurns: opts.contentsTurns,
            systemPromptChars: opts.systemPromptChars,
          },
        },
        { asType: "generation" }
      );

      try {
        const response = await opts.run();
        const u = response.usageMetadata;
        gen.update({
          output: { responseChars: (response.text || "").length },
          usageDetails:
            u &&
            (u.promptTokenCount != null ||
              u.candidatesTokenCount != null ||
              u.totalTokenCount != null)
              ? {
                  promptTokens: u.promptTokenCount ?? 0,
                  completionTokens: u.candidatesTokenCount ?? 0,
                  totalTokens: u.totalTokenCount ?? 0,
                  ...(u.thoughtsTokenCount != null
                    ? { thoughtsTokens: u.thoughtsTokenCount }
                    : {}),
                }
              : undefined,
        });
        gen.end();
        span.update({ output: { ok: true } });
        return response;
      } catch (err) {
        gen.update({
          output: { error: err instanceof Error ? err.message : String(err) },
        });
        gen.end();
        throw err;
      }
    }
  );
}
