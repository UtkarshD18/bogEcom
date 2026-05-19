// Lightweight SEO helper for client-side components
let cached = null;
let pending = null;

const normalizeApiBase = (value) =>
  String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/, "");

export async function fetchSeoSettings() {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    try {
      const apiBase = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);
      const resp = await fetch(`${apiBase}/api/settings/public`, {
        cache: "no-store",
      });
      if (!resp.ok) return null;
      const json = await resp.json();
      cached = json?.data?.seoSettings || null;
      return cached;
    } catch (error) {
      // swallow errors and return null
      return null;
    } finally {
      pending = null;
    }
  })();

  return pending;
}

export function resolveAltText(target, seoSettings) {
  if (!seoSettings || !Array.isArray(seoSettings.imageAltTexts)) return null;
  const t = String(target || "").toLowerCase();
  // Prefer exact match
  for (const rule of seoSettings.imageAltTexts) {
    if (!rule || !rule.target) continue;
    const ruleTarget = String(rule.target || "").toLowerCase();
    if (!ruleTarget) continue;
    if (ruleTarget === t) return rule.altText || null;
  }
  // Fallback: substring match
  for (const rule of seoSettings.imageAltTexts) {
    if (!rule || !rule.target) continue;
    const ruleTarget = String(rule.target || "").toLowerCase();
    if (!ruleTarget) continue;
    if (t.includes(ruleTarget) || ruleTarget.includes(t)) return rule.altText || null;
  }
  return null;
}

export default { fetchSeoSettings, resolveAltText };
