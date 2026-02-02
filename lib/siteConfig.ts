const DEFAULT_SITE_URL = "https://averyos.com";

const normalizeSiteUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_SITE_URL;
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

export const getSiteUrl = (): string => {
  const envValue =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL;
  return normalizeSiteUrl(envValue);
};
