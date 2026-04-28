// Strips markdown code fences and leading/trailing prose from GPT JSON responses
// so JSON.parse succeeds even when the model wraps output in ```json ... ```.
export function cleanJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  const obj = trimmed.match(/\{[\s\S]*\}/);
  if (obj) return obj[0];
  return trimmed;
}

// MEVE-201 — Friendly Korean error message mapping for OpenAI calls.
// Used by every GPT-4o Vision screen so the user sees consistent, actionable copy.
export function friendlyAIErrorMessage(error: unknown): string {
  if (!error) return '알 수 없는 오류가 발생했어요';
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error);
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name ?? '')
      : '';

  // AbortController.abort() throws AbortError → treat as timeout.
  if (name === 'AbortError' || message.includes('aborted')) {
    return 'AI 분석 시간이 초과됐어요. 다시 시도해주세요 ⏱️';
  }
  if (message.includes('network') || message.includes('Network') || message.includes('fetch')) {
    return '인터넷 연결을 확인해주세요 📶';
  }
  if (message.includes('timeout') || message.includes('504')) {
    return 'AI 분석 시간이 초과됐어요. 다시 시도해주세요 ⏱️';
  }
  if (message.includes('429') || message.toLowerCase().includes('rate')) {
    return '잠시 후 다시 시도해주세요 🙏';
  }
  if (message.includes('JSON') || message.toLowerCase().includes('parse')) {
    return 'AI 응답을 처리하는 중 오류가 생겼어요. 다시 시도해주세요';
  }
  return 'AI 분석 중 오류가 발생했어요. 다시 시도해주세요';
}

// MEVE-201 — Wrapped fetch with 30s timeout for OpenAI calls. Throws AbortError
// when the request exceeds the timeout, which friendlyAIErrorMessage maps to a
// user-facing "시간 초과" message.
export async function fetchOpenAIWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 30_000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
