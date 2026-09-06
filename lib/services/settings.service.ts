import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

let tableEnsured = false;
async function ensureSettingsTable() {
  if (tableEnsured || !db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "key" varchar(80) PRIMARY KEY NOT NULL,
        "value" text NOT NULL,
        "description" text,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    tableEnsured = true;
  } catch (err) {
    console.error("[ensureSettingsTable error]", err);
  }
}

export async function getSystemSetting(key: string): Promise<string | null> {
  await ensureSettingsTable();
  if (!db) return null;
  try {
    const [row] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);
    return row?.value || null;
  } catch {
    return null;
  }
}

export async function setSystemSetting(
  key: string,
  value: string,
  description?: string,
): Promise<{ ok: boolean; error?: string }> {
  await ensureSettingsTable();
  if (!db) return { ok: false, error: "Database not connected" };
  try {
    await db
      .insert(systemSettings)
      .values({
        key,
        value,
        description: description || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value,
          description: description || null,
          updatedAt: new Date(),
        },
      });
    return { ok: true };
  } catch (err) {
    console.error("[setSystemSetting error]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getGeminiConfig(clientProvidedKey?: string, clientProvidedModel?: string) {
  const dbKey = await getSystemSetting("gemini_api_key");
  const dbModel = await getSystemSetting("gemini_model");

  const apiKey = (
    clientProvidedKey ||
    dbKey ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim();

  const model = (
    clientProvidedModel ||
    dbModel ||
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash"
  ).trim();

  const isConfigured = Boolean(
    apiKey && !/^(replace|your[-_]?key|test)/i.test(apiKey),
  );

  const maskedKey = isConfigured
    ? `${apiKey.slice(0, 7)}••••••••${apiKey.slice(-4)}`
    : null;

  return {
    apiKey,
    maskedKey,
    model,
    isConfigured,
    source: clientProvidedKey
      ? "client"
      : dbKey
        ? "database"
        : process.env.GEMINI_API_KEY
          ? "environment"
          : "none",
  };
}

export async function testGeminiConnection(apiKey: string, model = "gemini-2.5-flash") {
  const key = apiKey.trim();
  if (!key) return { ok: false, error: "API key is required" };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: "Respond with the single word: OK" }],
          },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const message =
        errJson?.error?.message ||
        `Gemini API returned status ${res.status}`;
      return { ok: false, error: message };
    }

    const json = await res.json().catch(() => null);
    const replyText =
      json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "OK";

    return {
      ok: true,
      model,
      sampleResponse: replyText,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Connection timed out or failed",
    };
  }
}

export async function getOpenRouterConfig(clientProvidedKey?: string, clientProvidedModel?: string) {
  const dbKey = await getSystemSetting("openrouter_api_key");
  const dbModel = await getSystemSetting("openrouter_model");

  const apiKey = (
    clientProvidedKey ||
    dbKey ||
    process.env.OPENROUTER_API_KEY ||
    ""
  ).trim();

  const model = (
    clientProvidedModel ||
    dbModel ||
    process.env.OPENROUTER_MODEL ||
    "google/gemma-4-31b-it:free"
  ).trim();

  const isConfigured = Boolean(
    apiKey && !/^(replace|your[-_]?key|test)/i.test(apiKey),
  );

  const maskedKey = isConfigured
    ? `${apiKey.slice(0, 9)}••••••••${apiKey.slice(-4)}`
    : null;

  return {
    apiKey,
    maskedKey,
    model,
    isConfigured,
    source: clientProvidedKey
      ? "client"
      : dbKey
        ? "database"
        : process.env.OPENROUTER_API_KEY
          ? "environment"
          : "none",
  };
}

export async function testOpenRouterConnection(apiKey: string, model = "google/gemma-4-31b-it:free") {
  const key = apiKey.trim();
  if (!key) return { ok: false, error: "OpenRouter API key is required" };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://mhop-erp.local",
        "X-Title": "MH OP Operations Copilot",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Respond with the single word: OK" }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const message =
        errJson?.error?.message ||
        `OpenRouter returned status ${res.status}`;
      return { ok: false, error: message };
    }

    const json = await res.json().catch(() => null);
    const replyText =
      json?.choices?.[0]?.message?.content?.trim() || "OK";

    return {
      ok: true,
      model,
      sampleResponse: replyText,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Connection timed out or failed",
    };
  }
}

