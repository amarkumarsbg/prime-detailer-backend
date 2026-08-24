/** Allowed profile avatar types (must match multer filter + `persistAvatarFile`). */
export const AVATAR_EXT_FOR_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function avatarExtensionForMime(mime: string): string {
  return AVATAR_EXT_FOR_MIME[mime.toLowerCase()] ?? ".jpg";
}

export function isAllowedAvatarMime(mime: string): boolean {
  return Boolean(AVATAR_EXT_FOR_MIME[mime.toLowerCase()]);
}
