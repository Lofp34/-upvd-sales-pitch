export async function readResponsePayload<T extends Record<string, unknown>>(
  response: Response,
) {
  const raw = await response.text();

  if (!raw.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}
