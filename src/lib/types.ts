export type PageType = "product" | "home" | "cart" | "other";

export type AuditStatus = "queued" | "running" | "done" | "failed";

export type ScrapedPage = {
  finalUrl: string;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  ctas: { text: string; href: string | null }[];
  priceTexts: string[];
  shippingReturnsMentions: {
    shipping: boolean;
    returns: boolean;
    warranty: boolean;
  };
  trustSignals: {
    reviews: boolean;
    ratings: boolean;
    badges: boolean;
    guarantee: boolean;
  };
  imagesCount: number;
  missingAltCount: number;
  scriptsCount: number;
  stylesCount: number;
  totalTextLength: number;
  mainTextSample: string;
  detectedPlatform: "shopify" | "woocommerce" | "unknown";
};

export type AuditReport = {
  overall_score: number;
  category_scores: {
    cro: number;
    trust: number;
    copy: number;
    mobile_ux: number;
    performance_basics: number;
    seo_basics: number;
  };
  top_fixes: {
    title: string;
    why_it_matters: string;
    how_to_fix: string;
    estimated_effort: "S" | "M" | "L";
  }[];
  findings: {
    id: string;
    title: string;
    category: "CRO" | "Trust" | "Copy" | "Mobile UX" | "Performance" | "SEO";
    severity: "High" | "Medium" | "Low";
    impact: "High" | "Medium" | "Low";
    evidence: string;
    recommendation: string;
    estimated_effort: "S" | "M" | "L";
  }[];
};
