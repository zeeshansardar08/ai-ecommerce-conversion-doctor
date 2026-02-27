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

const SITE_URL = "https://crosignal.com";
const SITE_NAME = "CROSignal";
const DEFAULT_DESCRIPTION =
  "Find hidden conversion leaks in your Shopify or WooCommerce store with an AI-powered CRO audit. Free, instant, actionable.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CROSignal — AI Conversion Audits for Ecommerce",
    template: "%s | CROSignal",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "CRO audit",
    "conversion rate optimization",
    "ecommerce audit",
    "Shopify CRO",
    "WooCommerce CRO",
    "AI conversion audit",
    "ecommerce conversion",
    "CROSignal",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "CROSignal — AI Conversion Audits for Ecommerce",
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "CROSignal — AI Conversion Audits for Ecommerce",
    description: DEFAULT_DESCRIPTION,
    creator: "@crosignal",
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
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
