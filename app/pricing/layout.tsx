import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Free AI CRO Audits & Pro Plans",
  description:
    "Run free AI conversion audits for your ecommerce store. Pro and Agency plans coming soon with multi-page audits and team dashboards.",
  openGraph: {
    title: "CROSignal Pricing — Free AI CRO Audits & Pro Plans",
    description:
      "Run free AI conversion audits for your ecommerce store. Pro and Agency plans coming soon with multi-page audits and team dashboards.",
    url: "https://crosignal.com/pricing",
  },
  twitter: {
    title: "CROSignal Pricing — Free AI CRO Audits & Pro Plans",
    description:
      "Run free AI conversion audits for your ecommerce store. Pro plans coming soon.",
  },
  alternates: {
    canonical: "https://crosignal.com/pricing",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
