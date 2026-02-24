import OpenAI from "openai";
import type { AuditReport, PageType, ScrapedPage } from "./types";

const reportSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overall_score: { type: "number", minimum: 0, maximum: 100 },
    category_scores: {
      type: "object",
      additionalProperties: false,
      properties: {
        cro: { type: "number", minimum: 0, maximum: 100 },
        trust: { type: "number", minimum: 0, maximum: 100 },
        copy: { type: "number", minimum: 0, maximum: 100 },
        mobile_ux: { type: "number", minimum: 0, maximum: 100 },
        performance_basics: { type: "number", minimum: 0, maximum: 100 },
        seo_basics: { type: "number", minimum: 0, maximum: 100 },
      },
      required: [
        "cro",
        "trust",
        "copy",
        "mobile_ux",
        "performance_basics",
        "seo_basics",
      ],
    },
    top_fixes: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          why_it_matters: { type: "string" },
          how_to_fix: { type: "string" },
          estimated_effort: { type: "string", enum: ["S", "M", "L"] },
        },
        required: ["title", "why_it_matters", "how_to_fix", "estimated_effort"],
      },
    },
    findings: {
      type: "array",
      minItems: 8,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          category: {
            type: "string",
            enum: ["CRO", "Trust", "Copy", "Mobile UX", "Performance", "SEO"],
          },
          severity: { type: "string", enum: ["High", "Medium", "Low"] },
          impact: { type: "string", enum: ["High", "Medium", "Low"] },
          evidence: { type: "string" },
          recommendation: { type: "string" },
          estimated_effort: { type: "string", enum: ["S", "M", "L"] },
        },
        required: [
          "id",
          "title",
          "category",
          "severity",
          "impact",
          "evidence",
          "recommendation",
          "estimated_effort",
        ],
      },
    },
  },
  required: ["overall_score", "category_scores", "top_fixes", "findings"],
};

const createMockReport = (scraped: ScrapedPage): AuditReport => {
  const baseScore = scraped.trustSignals.reviews ? 78 : 64;
  return {
    overall_score: baseScore,
    category_scores: {
      cro: baseScore - 4,
      trust: baseScore - 2,
      copy: baseScore - 6,
      mobile_ux: baseScore - 8,
      performance_basics: baseScore - 10,
      seo_basics: baseScore - 5,
    },
    top_fixes: [
      {
        title: "Surface shipping and returns near the main CTA",
        why_it_matters:
          "Shoppers abandon when delivery and returns are unclear on the first screen.",
        how_to_fix:
          "Add a short line under the primary CTA with shipping ETA and free returns policy.",
        estimated_effort: "S",
      },
      {
        title: "Strengthen the hero headline with outcome-driven copy",
        why_it_matters:
          "Visitors need a clear value promise within the first 3 seconds.",
        how_to_fix:
          "Rewrite the headline to highlight the primary benefit and who it is for.",
        estimated_effort: "M",
      },
      {
        title: "Add visible trust signals above the fold",
        why_it_matters:
          "Trust cues increase conversion and reduce purchase anxiety.",
        how_to_fix:
          "Place review stars, guarantee badge, or security seals near the CTA.",
        estimated_effort: "S",
      },
    ],
    findings: [
      {
        id: "f1",
        title: "CTA lacks supporting urgency or proof",
        category: "CRO",
        severity: "High",
        impact: "High",
        evidence: "Primary CTA appears without supporting proof or scarcity cues.",
        recommendation:
          "Add microcopy like \"Ships in 24 hours\" or \"3,200+ sold\" next to the CTA.",
        estimated_effort: "S",
      },
      {
        id: "f2",
        title: "Shipping details are not visible above the fold",
        category: "Trust",
        severity: "High",
        impact: "High",
        evidence: "Shipping and returns information is not surfaced in the initial view.",
        recommendation:
          "Add a concise shipping + returns line beneath price or CTA.",
        estimated_effort: "S",
      },
      {
        id: "f3",
        title: "Headline lacks specificity",
        category: "Copy",
        severity: "Medium",
        impact: "Medium",
        evidence: "Hero headline does not describe the product outcome or target user.",
        recommendation:
          "Rewrite to include the primary benefit and audience (e.g., \"For busy parents...\").",
        estimated_effort: "M",
      },
      {
        id: "f4",
        title: "Review content not visible on first screen",
        category: "Trust",
        severity: "Medium",
        impact: "Medium",
        evidence: "Reviews are present but not surfaced near the main CTA.",
        recommendation:
          "Show star rating and review count near the product title or CTA.",
        estimated_effort: "S",
      },
      {
        id: "f5",
        title: "Mobile spacing could be tighter",
        category: "Mobile UX",
        severity: "Low",
        impact: "Medium",
        evidence: "Large spacing pushes CTA below the fold on mobile.",
        recommendation:
          "Reduce vertical gaps between hero elements on mobile viewports.",
        estimated_effort: "S",
      },
      {
        id: "f6",
        title: "Trust badges not near the payment section",
        category: "Trust",
        severity: "Low",
        impact: "Low",
        evidence: "Security badges are not visible near checkout or CTA.",
        recommendation:
          "Place payment trust badges adjacent to CTA or checkout button.",
        estimated_effort: "S",
      },
      {
        id: "f7",
        title: "Meta description missing persuasive copy",
        category: "SEO",
        severity: "Medium",
        impact: "Low",
        evidence: "Meta description is missing or generic.",
        recommendation:
          "Write a benefit-driven meta description with a clear call to action.",
        estimated_effort: "S",
      },
      {
        id: "f8",
        title: "Primary imagery lacks descriptive alt text",
        category: "Performance",
        severity: "Low",
        impact: "Low",
        evidence: "Some images are missing alt attributes.",
        recommendation:
          "Add descriptive alt text to key product images for accessibility and SEO.",
        estimated_effort: "S",
      },
    ],
  };
};

export const generateReport = async (
  scraped: ScrapedPage,
  pageType: PageType
): Promise<AuditReport> => {
  if (process.env.USE_MOCK_AI === "true" || !process.env.OPENAI_API_KEY) {
    return createMockReport(scraped);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a senior CRO strategist. Produce a strict JSON report with actionable fixes. Output only JSON.",
        },
        {
          role: "user",
          content: JSON.stringify({
            pageType,
            scraped,
            instructions:
              "Return 8-12 findings. Mention platform-specific hints if detectedPlatform is shopify or woocommerce.",
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "cro_audit_report",
          schema: reportSchema,
          strict: true,
        },
      },
    });

    const outputText = response.output_text;
    if (!outputText) {
      throw new Error("OpenAI response was empty.");
    }

    return JSON.parse(outputText) as AuditReport;
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status?: number }).status
        : undefined;
    const message =
      error instanceof Error ? error.message.toLowerCase() : "";

    if (
      status === 429 ||
      message.includes("quota") ||
      message.includes("rate limit") ||
      message.includes("insufficient")
    ) {
      return createMockReport(scraped);
    }

    throw error;
  }
};
