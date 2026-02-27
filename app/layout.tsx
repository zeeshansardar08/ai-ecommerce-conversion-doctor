import type { Metadata } from "next";
import { Sora, Spectral } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "CROSignal — AI Conversion Audits for Ecommerce",
  description:
    "Find hidden conversion leaks in your Shopify or WooCommerce store with an AI-powered CRO audit. Free, instant, actionable.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sora.variable} ${spectral.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
