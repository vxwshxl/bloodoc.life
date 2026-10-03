import "server-only";

/**
 * Camp titles into Assamese and Hindi.
 *
 * Sarvam's translation endpoint, on the same `SARVAM_API_KEY` the assistant
 * uses, because it is the provider already in this stack and its
 * `sarvam-translate` model covers Assamese, which most general-purpose
 * translators do not.
 *
 * Used so that renaming a camp in English renames it in the other two
 * languages as well. Before this, the translated titles were typed once and
 * then kept rotating on the camp page under a name the camp no longer had.
 *
 * Never throws. A translation that did not happen returns null and the caller
 * keeps whatever it had; the camp still saves.
 */

export type TitleLanguage = "as" | "hi";

const TARGET: Record<TitleLanguage, string> = { as: "as-IN", hi: "hi-IN" };

function config() {
  const apiKey = process.env.SARVAM_API_KEY?.trim() ?? "";
  // The chat endpoint is configured as ".../v1"; translation lives at the
  // root of the same host.
  let origin = "https://api.sarvam.ai";
  try {
    origin = new URL(process.env.SARVAM_BASE_URL?.trim() || origin).origin;
  } catch {
    /* keep the default */
  }
  return { apiKey, url: `${origin}/translate` };
}

export function translatorConfigured(): boolean {
  return config().apiKey.length > 0;
}

export async function translateTitle(text: string, lang: TitleLanguage): Promise<string | null> {
  const c = config();
  const input = text.trim();
  if (!c.apiKey || !input) return null;
  try {
    const res = await fetch(c.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": c.apiKey,
      },
      body: JSON.stringify({
        input,
        source_language_code: "en-IN",
        target_language_code: TARGET[lang],
        model: "sarvam-translate:v1",
      }),
      // A camp save waits on this; a slow provider must not hang the form.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[translate]", lang, res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const data = (await res.json().catch(() => null)) as { translated_text?: string } | null;
    const out = data?.translated_text?.trim();
    return out ? out.slice(0, 160) : null;
  } catch (e) {
    console.error("[translate]", lang, e);
    return null;
  }
}

/** Both languages at once. Either may be null on its own. */
export async function translateCampTitle(text: string): Promise<Record<TitleLanguage, string | null>> {
  const [as, hi] = await Promise.all([translateTitle(text, "as"), translateTitle(text, "hi")]);
  return { as, hi };
}
