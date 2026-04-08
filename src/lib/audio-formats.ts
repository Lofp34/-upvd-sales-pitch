const MIME_TYPE_ALIASES = new Map<string, string>([
  ["audio/x-m4a", "audio/m4a"],
  ["video/mp4", "audio/mp4"],
  ["video/webm", "audio/webm"],
]);

const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/mp3",
  "audio/mpeg",
  "audio/mp4",
  "audio/mpga",
  "audio/m4a",
  "audio/wav",
  "audio/webm",
]);

const AUDIO_EXTENSIONS_BY_TYPE = new Map<string, string>([
  ["audio/mp3", "mp3"],
  ["audio/mpeg", "mp3"],
  ["audio/mp4", "mp4"],
  ["audio/mpga", "mpga"],
  ["audio/m4a", "m4a"],
  ["audio/wav", "wav"],
  ["audio/webm", "webm"],
]);

export function normalizeAudioMimeType(type?: string | null) {
  const rawType = type?.split(";")[0]?.trim().toLowerCase() ?? "";

  if (!rawType) {
    return "";
  }

  return MIME_TYPE_ALIASES.get(rawType) ?? rawType;
}

export function isSupportedAudioMimeType(type?: string | null) {
  return SUPPORTED_AUDIO_TYPES.has(normalizeAudioMimeType(type));
}

export function getAudioFileExtension(type?: string | null) {
  const normalizedType = normalizeAudioMimeType(type);

  return AUDIO_EXTENSIONS_BY_TYPE.get(normalizedType) ?? null;
}
