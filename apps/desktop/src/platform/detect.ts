export type DesktopPlatform = "windows" | "macos" | "linux";

export function detectDesktopPlatform(): DesktopPlatform {
  const signature = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (signature.includes("windows") || signature.includes("win32")) {
    return "windows";
  }
  if (signature.includes("macintosh") || signature.includes("macintel")) {
    return "macos";
  }
  return "linux";
}

export function applyDesktopPlatform(): DesktopPlatform {
  const platform = detectDesktopPlatform();
  document.documentElement.dataset.platform = platform;
  return platform;
}
