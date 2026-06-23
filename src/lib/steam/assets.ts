export const STEAM_HEADER_IMAGE_WIDTH = 460;
export const STEAM_HEADER_IMAGE_HEIGHT = 215;

export function getSteamHeaderImageUrl(steamAppId: number | null | undefined) {
  if (!isValidSteamAppId(steamAppId)) return null;
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/header.jpg`;
}

export function getSteamStoreUrl(steamAppId: number | null | undefined) {
  if (!isValidSteamAppId(steamAppId)) return null;
  return `https://store.steampowered.com/app/${steamAppId}/`;
}

export function getSteamInstallUrl(steamAppId: number | null | undefined) {
  if (!isValidSteamAppId(steamAppId)) return null;
  return `steam://install/${steamAppId}`;
}

export function getSteamLaunchUrl(steamAppId: number | null | undefined) {
  if (!isValidSteamAppId(steamAppId)) return null;
  return `steam://run/${steamAppId}`;
}

export function getSteamIdentityLabel(steamAppId: number | null | undefined) {
  return isValidSteamAppId(steamAppId) ? `Steam App ${steamAppId}` : "Manual / unmatched";
}

function isValidSteamAppId(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
