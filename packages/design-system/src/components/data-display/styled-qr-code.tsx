"use client";

import * as React from "react";
import QRCode from "qrcode";

import { cn } from "../../lib/utils";

type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
type ModuleStyle = "dots" | "squares" | "rounded";

interface StyledQrCodeProps {
  /** The data to encode in the QR code */
  value: string;
  /** Size in pixels (default: 200) */
  size?: number;
  /** Optional icon to display in the center of the QR code */
  icon?: React.ReactNode;
  /** Icon area size in pixels (auto-calculated if omitted) */
  iconSize?: number;
  /** Foreground color for modules and finder patterns (default: "#18181b") */
  fgColor?: string;
  /** Background color (default: "white") */
  bgColor?: string;
  /**
   * Error correction level (default: "M", or "H" when icon is present).
   * Higher levels allow more of the QR code to be damaged/obscured while
   * remaining scannable, but produce denser codes.
   * - L: ~7% recovery
   * - M: ~15% recovery
   * - Q: ~25% recovery
   * - H: ~30% recovery
   */
  errorCorrection?: ErrorCorrectionLevel;
  /**
   * Module rendering style (default: "dots").
   * - "dots": circular modules for a modern look
   * - "squares": classic square modules
   * - "rounded": rounded square modules
   */
  moduleStyle?: ModuleStyle;
  /** Scale of individual modules relative to cell size, 0.1–1.0 (default: 0.76 for dots, 1.0 for squares, 0.9 for rounded) */
  moduleScale?: number;
  /** Corner radius of the outer background rect in pixels (default: 8) */
  borderRadius?: number;
  /** Width of the quiet zone in modules (default: 2) */
  quietZone?: number;
  /** Additional CSS class names */
  className?: string;
}

function StyledQrCode({
  value,
  size = 200,
  icon,
  iconSize: iconSizeProp,
  fgColor = "#18181b",
  bgColor = "white",
  errorCorrection,
  moduleStyle = "dots",
  moduleScale,
  borderRadius = 8,
  quietZone = 2,
  className,
}: StyledQrCodeProps) {
  const [qrData, setQrData] = React.useState<{
    data: number[];
    moduleCount: number;
  } | null>(null);

  const hasIcon = !!icon;
  const ecLevel = errorCorrection ?? (hasIcon ? "H" : "M");

  React.useEffect(() => {
    try {
      const qr = QRCode.create(value, {
        errorCorrectionLevel: ecLevel,
      });
      const mc = qr.modules.size;
      const arr: number[] = [];
      for (let i = 0; i < mc * mc; i++) {
        arr.push(qr.modules.data[i] ? 1 : 0);
      }
      setQrData({ data: arr, moduleCount: mc });
    } catch {
      setQrData(null);
    }
  }, [value, ecLevel]);

  if (!qrData) return null;

  const { data, moduleCount } = qrData;
  const totalModules = moduleCount + quietZone * 2;
  const cellSize = size / totalModules;

  // Resolve module scale based on style
  const defaultScale =
    moduleStyle === "dots" ? 0.76 : moduleStyle === "rounded" ? 0.9 : 1.0;
  const scale = Math.max(0.1, Math.min(1.0, moduleScale ?? defaultScale));

  // Icon exclusion zone (~12% of modules, ensure odd for centering)
  const iconSpan = hasIcon ? (Math.ceil(moduleCount * 0.12) | 1) : 0;
  const iconStart = Math.floor((moduleCount - iconSpan) / 2);
  const iconEnd = iconStart + iconSpan;
  const iconDisplaySize =
    iconSizeProp ?? Math.round(iconSpan * cellSize * 0.82);

  const isFinderModule = (r: number, c: number) =>
    (r < 7 && c < 7) ||
    (r < 7 && c >= moduleCount - 7) ||
    (r >= moduleCount - 7 && c < 7);

  const isIconZone = (r: number, c: number) =>
    hasIcon &&
    r >= iconStart &&
    r < iconEnd &&
    c >= iconStart &&
    c < iconEnd;

  // Data modules (skip finder patterns and icon zone)
  const modules: React.JSX.Element[] = [];
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (isFinderModule(r, c) || isIconZone(r, c)) continue;
      if (!data[r * moduleCount + c]) continue;

      const cx = (c + quietZone + 0.5) * cellSize;
      const cy = (r + quietZone + 0.5) * cellSize;

      if (moduleStyle === "dots") {
        modules.push(
          <circle
            key={`${r}-${c}`}
            cx={cx}
            cy={cy}
            r={(cellSize * scale) / 2}
            fill={fgColor}
          />,
        );
      } else {
        const modSize = cellSize * scale;
        const rx = moduleStyle === "rounded" ? modSize * 0.25 : 0;
        modules.push(
          <rect
            key={`${r}-${c}`}
            x={cx - modSize / 2}
            y={cy - modSize / 2}
            width={modSize}
            height={modSize}
            rx={rx}
            fill={fgColor}
          />,
        );
      }
    }
  }

  // Finder patterns as rounded rectangles
  const fpOrigins = [
    [0, 0],
    [0, moduleCount - 7],
    [moduleCount - 7, 0],
  ] as const;

  const fpCornerRadius = cellSize * 1.0;
  const finderPatterns = fpOrigins.map(([fr, fc], i) => {
    const x = (fc + quietZone) * cellSize;
    const y = (fr + quietZone) * cellSize;
    return (
      <g key={`fp-${i}`}>
        <rect
          x={x}
          y={y}
          width={7 * cellSize}
          height={7 * cellSize}
          rx={fpCornerRadius}
          fill={fgColor}
        />
        <rect
          x={x + cellSize}
          y={y + cellSize}
          width={5 * cellSize}
          height={5 * cellSize}
          rx={fpCornerRadius * 0.7}
          fill={bgColor}
        />
        <rect
          x={x + 2 * cellSize}
          y={y + 2 * cellSize}
          width={3 * cellSize}
          height={3 * cellSize}
          rx={fpCornerRadius * 0.4}
          fill={fgColor}
        />
      </g>
    );
  });

  return (
    <div
      className={cn("relative inline-flex", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="QR Code"
      >
        <rect
          width={size}
          height={size}
          fill={bgColor}
          rx={borderRadius}
        />
        {finderPatterns}
        {modules}
      </svg>
      {icon ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex items-center justify-center rounded-[20%]"
            style={{
              width: iconDisplaySize + 8,
              height: iconDisplaySize + 8,
              backgroundColor: bgColor,
            }}
          >
            <div style={{ width: iconDisplaySize, height: iconDisplaySize }}>
              {icon}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export {
  StyledQrCode,
  type StyledQrCodeProps,
  type ErrorCorrectionLevel,
  type ModuleStyle,
};
