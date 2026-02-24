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
  title: "AI Ecommerce Conversion Doctor",
  description:
    "Find hidden conversion leaks in your store with an AI-powered CRO audit.",
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
