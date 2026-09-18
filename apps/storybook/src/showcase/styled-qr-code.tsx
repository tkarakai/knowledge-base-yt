"use client";

import * as React from "react";
import { StyledQrCode } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

const SAMPLE_URL = "https://example.com";
const SAMPLE_TOTP =
  "otpauth://totp/MyApp:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=MyApp";
const SAMPLE_WIFI = "WIFI:T:WPA;S:MyNetwork;P:password123;;";

function SproutIcon() {
  return <img src="/icon.svg" alt="" className="h-full w-full" />;
}

export default function StyledQrCodeShowcase() {
  return (
    <>
      <DemoSection
        title="Module Styles"
        description="Three rendering styles: dots (default), rounded squares, and classic squares."
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="space-y-2 text-center">
            <StyledQrCode value={SAMPLE_URL} size={160} moduleStyle="dots" />
            <p className="text-xs text-muted-foreground">Dots</p>
          </div>
          <div className="space-y-2 text-center">
            <StyledQrCode
              value={SAMPLE_URL}
              size={160}
              moduleStyle="rounded"
            />
            <p className="text-xs text-muted-foreground">Rounded</p>
          </div>
          <div className="space-y-2 text-center">
            <StyledQrCode
              value={SAMPLE_URL}
              size={160}
              moduleStyle="squares"
            />
            <p className="text-xs text-muted-foreground">Squares</p>
          </div>
        </div>
      </DemoSection>

      <DemoSection
        title="With Center Icon"
        description="Embed a logo or icon in the center. Error correction is automatically set to H (30%) when an icon is present."
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="space-y-2 text-center">
            <StyledQrCode
              value={SAMPLE_URL}
              size={180}
              moduleStyle="dots"
              icon={<SproutIcon />}
            />
            <p className="text-xs text-muted-foreground">Dots + icon</p>
          </div>
          <div className="space-y-2 text-center">
            <StyledQrCode
              value={SAMPLE_URL}
              size={180}
              moduleStyle="rounded"
              icon={<SproutIcon />}
            />
            <p className="text-xs text-muted-foreground">Rounded + icon</p>
          </div>
          <div className="space-y-2 text-center">
            <StyledQrCode
              value={SAMPLE_URL}
              size={180}
              moduleStyle="squares"
              icon={<SproutIcon />}
            />
            <p className="text-xs text-muted-foreground">Squares + icon</p>
          </div>
        </div>
      </DemoSection>

      <DemoSection
        title="Custom Colors"
        description="Use fgColor and bgColor to match your brand."
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="space-y-2 text-center">
            <StyledQrCode
              value={SAMPLE_URL}
              size={160}
              fgColor="#0f172a"
              bgColor="#f8fafc"
            />
            <p className="text-xs text-muted-foreground">Slate</p>
          </div>
          <div className="space-y-2 text-center">
            <StyledQrCode
              value={SAMPLE_URL}
              size={160}
              fgColor="#166534"
              bgColor="#f0fdf4"
            />
            <p className="text-xs text-muted-foreground">Green</p>
          </div>
          <div className="space-y-2 text-center">
            <StyledQrCode
              value={SAMPLE_URL}
              size={160}
              fgColor="#7c3aed"
              bgColor="#faf5ff"
            />
            <p className="text-xs text-muted-foreground">Purple</p>
          </div>
          <div className="space-y-2 text-center">
            <StyledQrCode
              value={SAMPLE_URL}
              size={160}
              fgColor="#e2e8f0"
              bgColor="#1e293b"
            />
            <p className="text-xs text-muted-foreground">Dark</p>
          </div>
        </div>
      </DemoSection>

      <DemoSection
        title="Error Correction Levels"
        description="Higher error correction makes the QR code denser but more resilient to damage."
      >
        <div className="flex flex-wrap items-start gap-6">
          {(["L", "M", "Q", "H"] as const).map((level) => (
            <div key={level} className="space-y-2 text-center">
              <StyledQrCode
                value={SAMPLE_URL}
                size={140}
                errorCorrection={level}
              />
              <p className="text-xs text-muted-foreground">
                {level} (
                {level === "L"
                  ? "7%"
                  : level === "M"
                    ? "15%"
                    : level === "Q"
                      ? "25%"
                      : "30%"}
                )
              </p>
            </div>
          ))}
        </div>
      </DemoSection>

      <DemoSection
        title="Module Scale"
        description="Control the size of individual modules relative to the cell. Smaller values create more spacing between modules."
      >
        <div className="flex flex-wrap items-start gap-6">
          {[0.4, 0.6, 0.76, 1.0].map((s) => (
            <div key={s} className="space-y-2 text-center">
              <StyledQrCode
                value={SAMPLE_URL}
                size={140}
                moduleStyle="dots"
                moduleScale={s}
              />
              <p className="text-xs text-muted-foreground">{s}</p>
            </div>
          ))}
        </div>
      </DemoSection>

      <DemoSection
        title="Sizes"
        description="The QR code scales cleanly to any size as it renders as SVG."
      >
        <div className="flex flex-wrap items-end gap-6">
          {[80, 120, 180, 260].map((s) => (
            <div key={s} className="space-y-2 text-center">
              <StyledQrCode value={SAMPLE_URL} size={s} />
              <p className="text-xs text-muted-foreground">{s}px</p>
            </div>
          ))}
        </div>
      </DemoSection>

      <DemoSection
        title="Real-World Data"
        description="QR codes with different types of data: URL, TOTP auth, and Wi-Fi credentials."
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="space-y-2 text-center">
            <StyledQrCode
              value={SAMPLE_URL}
              size={160}
              icon={<SproutIcon />}
            />
            <p className="text-xs text-muted-foreground">URL</p>
          </div>
          <div className="space-y-2 text-center">
            <StyledQrCode
              value={SAMPLE_TOTP}
              size={160}
              icon={<SproutIcon />}
            />
            <p className="text-xs text-muted-foreground">TOTP</p>
          </div>
          <div className="space-y-2 text-center">
            <StyledQrCode
              value={SAMPLE_WIFI}
              size={160}
              icon={<SproutIcon />}
            />
            <p className="text-xs text-muted-foreground">Wi-Fi</p>
          </div>
        </div>
      </DemoSection>

      <DemoSection
        title="Border Radius"
        description="Customize the outer border radius of the QR code."
      >
        <div className="flex flex-wrap items-start gap-6">
          {[0, 8, 16, 24].map((r) => (
            <div key={r} className="space-y-2 text-center">
              <StyledQrCode
                value={SAMPLE_URL}
                size={140}
                borderRadius={r}
              />
              <p className="text-xs text-muted-foreground">{r}px</p>
            </div>
          ))}
        </div>
      </DemoSection>
    </>
  );
}
