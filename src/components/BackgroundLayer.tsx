import { backdropKind, backdropLuminance, DEFAULT_GRADIENT, hexToRgb, type BgPattern, type ThemeSettings } from "../lib/theme.ts";

const PATTERNS: Record<Exclude<BgPattern, "none">, (scale: number) => React.CSSProperties> = {
  dots: (s) => ({
    backgroundImage: "radial-gradient(currentColor 1.2px, transparent 1.4px)",
    backgroundSize: `${18 * s}px ${18 * s}px`,
  }),
  grid: (s) => ({
    backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
    backgroundSize: `${28 * s}px ${28 * s}px`,
  }),
  lines: (s) => ({
    backgroundImage: "repeating-linear-gradient(-45deg, currentColor 0 1px, transparent 1px 12px)",
    backgroundSize: `${17 * s}px ${17 * s}px`,
  }),
};

/**
 * Paints the theme backdrop: base colour, then gradient or image (fit / focal
 * point / zoom / blur), then a tinted dim overlay and an optional pattern.
 * `scale` sizes blur and patterns with the canvas so exports match the preview.
 */
export default function BackgroundLayer({
  theme,
  scale = 1,
  transparentBase = false,
}: {
  theme: ThemeSettings;
  scale?: number;
  transparentBase?: boolean;
}) {
  const kind = backdropKind(theme);
  const fit = theme.bgFit ?? "cover";
  const x = theme.bgX ?? 50;
  const y = theme.bgY ?? 50;
  const zoom = theme.bgZoom ?? 1;
  const blur = (theme.bgBlur ?? 0) * scale;
  const dim = theme.backgroundDim ?? 0;
  const [r, g, b] = hexToRgb(theme.bgTint ?? "#000000") ?? [0, 0, 0];
  const grad = theme.bgGradient ?? DEFAULT_GRADIENT;
  const pattern = theme.bgPattern ?? "none";
  const scaled = fit === "cover" || fit === "contain";
  const blurPad = blur ? 1 + Math.min(0.25, blur / (160 * scale)) : 1;

  return (
    <div
      data-bg-layer
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ background: transparentBase ? "transparent" : theme.background }}
    >
      {kind === "gradient" && <div className="absolute inset-0" style={{ background: `linear-gradient(${grad.angle}deg, ${grad.from}, ${grad.to})` }} />}
      {kind === "image" && theme.backgroundImage && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            transform: scaled && (zoom !== 1 || blur) ? `scale(${zoom * blurPad})` : undefined,
            WebkitTransform: scaled && (zoom !== 1 || blur) ? `scale(${zoom * blurPad})` : undefined,
            transformOrigin: `${x}% ${y}%`,
            WebkitTransformOrigin: `${x}% ${y}%`,
            filter: blur ? `blur(${blur}px)` : undefined,
            WebkitFilter: blur ? `blur(${blur}px)` : undefined,
          }}
        >
          {fit === "tile" ? (
            <div
              className="size-full"
              style={{
                backgroundImage: `url("${theme.backgroundImage}")`,
                backgroundRepeat: "repeat",
                backgroundPosition: `${x}% ${y}%`,
                backgroundSize: `${320 * zoom * scale}px auto`,
              }}
            />
          ) : (
            <img
              src={theme.backgroundImage}
              alt=""
              aria-hidden
              crossOrigin="anonymous"
              loading="eager"
              decoding="sync"
              className="absolute inset-0 size-full select-none"
              style={{
                objectFit: fit === "cover" ? "cover" : fit === "contain" ? "contain" : fit === "stretch" ? "fill" : "none",
                objectPosition: `${x}% ${y}%`,
              }}
            />
          )}
        </div>
      )}
      {dim > 0 && <div className="absolute inset-0" style={{ background: `rgba(${r},${g},${b},${dim})` }} />}
      {pattern !== "none" && (
        <div
          className="absolute inset-0"
          style={{ color: backdropLuminance(theme) < 0.34 ? "#ffffff" : "#000000", opacity: 0.1, ...PATTERNS[pattern](scale) }}
        />
      )}
    </div>
  );
}
