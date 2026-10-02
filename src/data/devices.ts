// Export device templates — exact physical pixel sizes and DPRs.

export type DeviceGroup = "iphone" | "ipad" | "android" | "androidTablet" | "pc" | "print" | "custom";

export interface DevicePreset {
  id: string;
  label: string;
  group: DeviceGroup;
  /** Output width in physical pixels (portrait base). */
  w: number;
  /** Output height in physical pixels. */
  h: number;
  dpr: number;
  /** Phones and tablets support a landscape toggle that swaps w/h. */
  canRotate?: boolean;
}

export const DEVICES: DevicePreset[] = [
  // iPhone
  { id: "iphone-se", label: "iPhone SE", group: "iphone", w: 750, h: 1334, dpr: 2, canRotate: true },
  { id: "iphone-13-14", label: "iPhone 13/14", group: "iphone", w: 1170, h: 2532, dpr: 3, canRotate: true },
  { id: "iphone-15-16", label: "iPhone 15/16", group: "iphone", w: 1179, h: 2556, dpr: 3, canRotate: true },
  { id: "iphone-16-pro", label: "iPhone 16 Pro", group: "iphone", w: 1206, h: 2622, dpr: 3, canRotate: true },
  { id: "iphone-plus-max", label: "iPhone Plus / 15 Pro Max", group: "iphone", w: 1290, h: 2796, dpr: 3, canRotate: true },
  { id: "iphone-16-pro-max", label: "iPhone 16 Pro Max", group: "iphone", w: 1320, h: 2868, dpr: 3, canRotate: true },
  // iPad
  { id: "ipad-mini-6", label: "iPad mini", group: "ipad", w: 1488, h: 2266, dpr: 2, canRotate: true },
  { id: "ipad-10", label: "iPad 10th / Air 11″", group: "ipad", w: 1640, h: 2360, dpr: 2, canRotate: true },
  { id: "ipad-pro-11", label: "iPad Pro 11″ (M4)", group: "ipad", w: 1668, h: 2420, dpr: 2, canRotate: true },
  { id: "ipad-pro-12-9", label: "iPad Pro 12.9″", group: "ipad", w: 2048, h: 2732, dpr: 2, canRotate: true },
  { id: "ipad-pro-13", label: "iPad Pro 13″ (M4)", group: "ipad", w: 2064, h: 2752, dpr: 2, canRotate: true },
  // Android phones
  { id: "android-fhd", label: "Android FHD+ 1080×2400", group: "android", w: 1080, h: 2400, dpr: 2.75, canRotate: true },
  { id: "galaxy-s24", label: "Galaxy S24 / S25", group: "android", w: 1080, h: 2340, dpr: 3, canRotate: true },
  { id: "galaxy-s24-ultra", label: "Galaxy S24 / S25 Ultra", group: "android", w: 1440, h: 3120, dpr: 3.5, canRotate: true },
  { id: "galaxy-a54", label: "Galaxy A-series", group: "android", w: 1080, h: 2340, dpr: 2.75, canRotate: true },
  { id: "pixel-8", label: "Pixel 8", group: "android", w: 1080, h: 2400, dpr: 2.6, canRotate: true },
  { id: "pixel-9", label: "Pixel 9", group: "android", w: 1080, h: 2424, dpr: 2.6, canRotate: true },
  { id: "pixel-9-pro-xl", label: "Pixel 9 Pro XL", group: "android", w: 1344, h: 2992, dpr: 3, canRotate: true },
  { id: "oneplus-12", label: "OnePlus 12", group: "android", w: 1440, h: 3168, dpr: 3.5, canRotate: true },
  { id: "xiaomi-fhd", label: "Xiaomi / Redmi / Poco", group: "android", w: 1080, h: 2400, dpr: 2.75, canRotate: true },
  { id: "android-hd", label: "Budget HD+ 720×1600", group: "android", w: 720, h: 1600, dpr: 2, canRotate: true },
  // Android tablets
  { id: "galaxy-tab-s9", label: "Galaxy Tab S9 / S10", group: "androidTablet", w: 1600, h: 2560, dpr: 2, canRotate: true },
  { id: "galaxy-tab-ultra", label: "Galaxy Tab S9 Ultra", group: "androidTablet", w: 1848, h: 2960, dpr: 2, canRotate: true },
  { id: "galaxy-tab-a9", label: "Galaxy Tab A9+", group: "androidTablet", w: 1200, h: 1920, dpr: 1.5, canRotate: true },
  { id: "pixel-tablet", label: "Pixel Tablet", group: "androidTablet", w: 1600, h: 2560, dpr: 2, canRotate: true },
  // PC / Mac (landscape)
  { id: "pc-hd", label: "PC 1366×768", group: "pc", w: 1366, h: 768, dpr: 1 },
  { id: "pc-fhd", label: "Full HD 1920×1080", group: "pc", w: 1920, h: 1080, dpr: 1 },
  { id: "pc-qhd", label: "QHD 2560×1440", group: "pc", w: 2560, h: 1440, dpr: 1 },
  { id: "pc-4k", label: "4K 3840×2160", group: "pc", w: 3840, h: 2160, dpr: 1 },
  { id: "pc-uw", label: "Ultrawide 3440×1440", group: "pc", w: 3440, h: 1440, dpr: 1 },
  { id: "mba-13", label: "MacBook Air 13″", group: "pc", w: 2560, h: 1664, dpr: 1 },
  { id: "mbp-14", label: "MacBook Pro 14″", group: "pc", w: 3024, h: 1964, dpr: 1 },
  // Print
  { id: "a4-portrait", label: "A4 portrait (300dpi)", group: "print", w: 2480, h: 3508, dpr: 1 },
];

export const DEVICE_GROUPS: { id: DeviceGroup; label: string }[] = [
  { id: "iphone", label: "iPhone" },
  { id: "ipad", label: "iPad" },
  { id: "android", label: "Android phones" },
  { id: "androidTablet", label: "Android tablets" },
  { id: "pc", label: "PC / Mac" },
  { id: "print", label: "Print" },
  { id: "custom", label: "Custom" },
];

export function deviceById(id: string): DevicePreset | undefined {
  return DEVICES.find((d) => d.id === id);
}

/** Resolves final output dimensions (applies the portrait/landscape swap). */
export function deviceSize(device: DevicePreset, landscape: boolean): { w: number; h: number } {
  if (landscape && device.canRotate) return { w: device.h, h: device.w };
  return { w: device.w, h: device.h };
}
