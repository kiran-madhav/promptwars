import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VERIFAI — Media Verification Platform",
  description:
    "Before you trust it. Before you share it. AI-assisted analysis to help detect and understand potentially synthetic or manipulated media.",
  keywords: ["media verification", "deepfake detection", "AI image analysis", "misinformation"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
