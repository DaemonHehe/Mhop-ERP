"use server";

import { requireStaff } from "@/lib/auth/authorize";
import {
  askAdminCopilot,
  type CopilotMessage,
} from "@/lib/ai/admin-copilot";
import {
  getGeminiConfig,
  getOpenRouterConfig,
  setSystemSetting,
  testGeminiConnection,
  testOpenRouterConnection,
} from "@/lib/services/settings.service";
import { audit } from "@/lib/services/audit.service";
import { revalidatePath } from "next/cache";

export async function askAdminCopilotAction(input: {
  question: string;
  history?: CopilotMessage[];
  clientApiKey?: string;
  clientModel?: string;
  clientOpenRouterKey?: string;
  clientOpenRouterModel?: string;
}) {
  try {
    await requireStaff(["admin", "staff"]);

    const q = (input.question || "").trim();
    if (!q) {
      return { ok: false as const, error: "Question cannot be empty" };
    }

    const response = await askAdminCopilot({
      question: q,
      history: input.history,
      clientApiKey: input.clientApiKey,
      clientModel: input.clientModel,
      clientOpenRouterKey: input.clientOpenRouterKey,
      clientOpenRouterModel: input.clientOpenRouterModel,
    });

    return { ok: true as const, data: response };
  } catch (err) {
    console.error("[askAdminCopilotAction error]", err);
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to query AI copilot",
    };
  }
}

export async function getAiConfigAction() {
  try {
    await requireStaff(["admin", "staff"]);

    const [gemini, openrouter] = await Promise.all([
      getGeminiConfig(),
      getOpenRouterConfig(),
    ]);

    const isConfigured = gemini.isConfigured || openrouter.isConfigured;
    const activeProvider = gemini.isConfigured
      ? ("gemini" as const)
      : openrouter.isConfigured
        ? ("openrouter" as const)
        : ("pattern_fallback" as const);

    const activeModel = gemini.isConfigured
      ? gemini.model
      : openrouter.isConfigured
        ? openrouter.model
        : "internal-pattern-engine";

    return {
      ok: true as const,
      data: {
        isConfigured,
        activeProvider,
        activeModel,
        gemini: {
          isConfigured: gemini.isConfigured,
          maskedKey: gemini.maskedKey,
          model: gemini.model,
          source: gemini.source,
        },
        openrouter: {
          isConfigured: openrouter.isConfigured,
          maskedKey: openrouter.maskedKey,
          model: openrouter.model,
          source: openrouter.source,
        },
      },
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Unauthorized",
    };
  }
}

export async function saveAiKeyAction(input: {
  apiKey: string;
  model?: string;
}) {
  try {
    const staff = await requireStaff(["admin", "staff"]);

    const key = (input.apiKey || "").trim();
    const model = (input.model || "gemini-2.5-flash").trim();

    if (!key) {
      return { ok: false as const, error: "Gemini API key is required" };
    }

    // Test the key connection before persisting
    const test = await testGeminiConnection(key, model);
    if (!test.ok) {
      return {
        ok: false as const,
        error: `Key test failed: ${test.error || "Could not connect to Gemini API"}`,
      };
    }

    // Save to system settings table
    await setSystemSetting(
      "gemini_api_key",
      key,
      `Configured by ${staff.name} (${staff.email})`,
    );
    await setSystemSetting(
      "gemini_model",
      model,
      `Model preference configured by ${staff.name}`,
    );

    await audit(
      "settings.gemini",
      model,
      `Gemini AI key & model configured by ${staff.name}`,
    );

    const maskedKey = `${key.slice(0, 7)}••••••••${key.slice(-4)}`;

    revalidatePath("/dashboard");
    return {
      ok: true as const,
      data: {
        maskedKey,
        model,
      },
    };
  } catch (err) {
    console.error("[saveAiKeyAction error]", err);
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to save Gemini key",
    };
  }
}

export async function testAiKeyAction(input: {
  apiKey: string;
  model?: string;
}) {
  try {
    await requireStaff(["admin", "staff"]);

    const key = (input.apiKey || "").trim();
    const model = (input.model || "gemini-2.5-flash").trim();

    const result = await testGeminiConnection(key, model);
    return result;
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Unauthorized",
    };
  }
}

export async function saveOpenRouterKeyAction(input: {
  apiKey: string;
  model?: string;
}) {
  try {
    const staff = await requireStaff(["admin", "staff"]);

    const key = (input.apiKey || "").trim();
    const model = (input.model || "google/gemma-4-31b-it:free").trim();

    if (!key) {
      return { ok: false as const, error: "OpenRouter API key is required" };
    }

    const test = await testOpenRouterConnection(key, model);
    if (!test.ok) {
      return {
        ok: false as const,
        error: `Key test failed: ${test.error || "Could not connect to OpenRouter API"}`,
      };
    }

    await setSystemSetting(
      "openrouter_api_key",
      key,
      `Configured by ${staff.name} (${staff.email})`,
    );
    await setSystemSetting(
      "openrouter_model",
      model,
      `OpenRouter model configured by ${staff.name}`,
    );

    await audit(
      "settings.openrouter",
      model,
      `OpenRouter AI key & model configured by ${staff.name}`,
    );

    const maskedKey = `${key.slice(0, 9)}••••••••${key.slice(-4)}`;
    revalidatePath("/dashboard");

    return {
      ok: true as const,
      data: {
        maskedKey,
        model,
      },
    };
  } catch (err) {
    console.error("[saveOpenRouterKeyAction error]", err);
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Failed to save OpenRouter key",
    };
  }
}

export async function testOpenRouterKeyAction(input: {
  apiKey: string;
  model?: string;
}) {
  try {
    await requireStaff(["admin", "staff"]);
    const key = (input.apiKey || "").trim();
    const model = (input.model || "google/gemma-4-31b-it:free").trim();
    return await testOpenRouterConnection(key, model);
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Unauthorized",
    };
  }
}
