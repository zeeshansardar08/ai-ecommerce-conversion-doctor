import OpenAI from "openai";
import type { AuditReport, PageType, ScrapedPage } from "./types";

/* ────────────────────────── JSON Schema ────────────────────────── */

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
          where_to_fix: { type: "string" },
          estimated_effort: { type: "string", enum: ["S", "M", "L"] },
        },
        required: [
          "title",
          "why_it_matters",
          "how_to_fix",
          "where_to_fix",
          "estimated_effort",
        ],
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
          confidence: { type: "string", enum: ["High", "Medium", "Low"] },
          evidence: { type: "string" },
          where_to_fix: { type: "string" },
          what_to_change: { type: "string" },
          recommendation: { type: "string" },
          estimated_effort: { type: "string", enum: ["S", "M", "L"] },
        },
        required: [
          "id",
          "title",
          "category",
          "severity",
          "impact",
          "confidence",
          "evidence",
          "where_to_fix",
          "what_to_change",
          "recommendation",
          "estimated_effort",
        ],
      },
    },
  },
  required: ["overall_score", "category_scores", "top_fixes", "findings"],
};

/* ────────────────────────── validation ────────────────────────── */

const validateReportShape = (data: unknown): data is AuditReport => {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.overall_score !== "number") return false;
  if (!obj.category_scores || typeof obj.category_scores !== "object") return false;
  if (!Array.isArray(obj.top_fixes) || obj.top_fixes.length < 1) return false;
  if (!Array.isArray(obj.findings) || obj.findings.length < 1) return false;

  // Validate each top_fix
  for (const fix of obj.top_fixes) {
    if (!fix || typeof fix !== "object") return false;
    if (!fix.title || !fix.how_to_fix || !fix.where_to_fix) return false;
  }

  // Validate each finding
  for (const f of obj.findings) {
    if (!f || typeof f !== "object") return false;
    if (!f.id || !f.title || !f.category || !f.evidence) return false;
  }
  return true;
};

/* ────────────────────────── mock report ────────────────────────── */

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
        where_to_fix: "Below the primary Add to Cart / Buy Now button",
        estimated_effort: "S",
      },
      {
        title: "Strengthen the hero headline with outcome-driven copy",
        why_it_matters:
          "Visitors need a clear value promise within the first 3 seconds.",
        how_to_fix:
          "Rewrite the headline to highlight the primary benefit and who it is for.",
        where_to_fix: "Hero section headline",
        estimated_effort: "M",
      },
      {
        title: "Add visible trust signals above the fold",
        why_it_matters:
          "Trust cues increase conversion and reduce purchase anxiety.",
        how_to_fix:
          "Place review stars, guarantee badge, or security seals near the CTA.",
        where_to_fix: "Above the fold, near the primary CTA",
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
        confidence: "Medium",
        evidence: "Primary CTA appears without supporting proof or scarcity cues.",
        where_to_fix: "Next to the primary CTA button",
        what_to_change:
          "Add microcopy like \"Ships in 24 hours\" or \"3,200+ sold\" adjacent to the button.",
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
        confidence: "Medium",
        evidence: "Shipping and returns information is not surfaced in the initial view.",
        where_to_fix: "Beneath price or CTA",
        what_to_change:
          "Insert a concise shipping + returns line (e.g. \"Free shipping · Easy 30-day returns\").",
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
        confidence: "Medium",
        evidence: "Hero headline does not describe the product outcome or target user.",
        where_to_fix: "Hero section",
        what_to_change:
          "Rewrite to include the primary benefit and audience (e.g., \"For busy parents...\").",
        recommendation:
          "Rewrite to include the primary benefit and audience.",
        estimated_effort: "M",
      },
      {
        id: "f4",
        title: "Review content not visible on first screen",
        category: "Trust",
        severity: "Medium",
        impact: "Medium",
        confidence: "Medium",
        evidence: "Reviews are present but not surfaced near the main CTA.",
        where_to_fix: "Near the product title or CTA",
        what_to_change:
          "Show star rating and review count inline with the product title.",
        recommendation:
          "Show star rating and review count near the product title or CTA.",
        estimated_effort: "S",
      },
      {
        id: "f5",
        title: "Mobile spacing pushes CTA below the fold",
        category: "Mobile UX",
        severity: "Low",
        impact: "Medium",
        confidence: "Low",
        evidence: "Large spacing pushes CTA below the fold on mobile.",
        where_to_fix: "Hero section on mobile viewports",
        what_to_change:
          "Reduce vertical gaps between hero elements on screens < 768px.",
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
        confidence: "Low",
        evidence: "Security badges are not visible near checkout or CTA.",
        where_to_fix: "Adjacent to CTA or checkout button",
        what_to_change:
          "Place payment trust badges (Visa/MC/PayPal icons, SSL badge) next to the main action button.",
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
        confidence: "High",
        evidence: "Meta description is missing or generic.",
        where_to_fix: "HTML <head> meta description tag",
        what_to_change:
          "Write a benefit-driven meta description (< 155 chars) with a clear call to action.",
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
        confidence: "High",
        evidence: "Some images are missing alt attributes.",
        where_to_fix: "Product image <img> tags",
        what_to_change:
          "Add descriptive alt text to key product images for accessibility and SEO.",
        recommendation:
          "Add descriptive alt text to key product images for accessibility and SEO.",
        estimated_effort: "S",
      },
    ],
  };
};

/* ────────────────────────── prompt building ────────────────────────── */

const SYSTEM_PROMPT = `You are a senior CRO (Conversion Rate Optimization) strategist specializing in ecommerce stores.

RULES:
- Use ONLY evidence from the provided scraped_json. Do NOT fabricate data.
- If a signal is missing or uncertain, explicitly state "Data not available" or "Could not confirm" in the evidence field.
- Each finding MUST include:
  1. "evidence": A SHORT quote or paraphrase from the scraped text that supports the finding.
  2. "where_to_fix": Specific page location (e.g., "hero section", "below Add to Cart", "product gallery", "cart drawer", "footer", "near price").
  3. "what_to_change": Exact, concrete action (not vague advice).
- top_fixes must be 3 DISTINCT fixes that do NOT overlap with each other.
- Category scores must ALIGN with findings severity — if you report multiple High-severity CRO issues, the CRO score should be low.
- Set "confidence" per finding: High = clearly visible in data, Medium = inferred from patterns, Low = educated guess.
- Mention platform-specific tips if detectedPlatform is "shopify" or "woocommerce".
- Output ONLY valid JSON matching the schema. No markdown, no explanation, no wrapping.`;

const buildUserPrompt = (scraped: ScrapedPage, pageType: PageType): string => {
  // Build a trimmed version of scraped data to control token size
  const trimmed = {
    pageType,
    url: scraped.finalUrl,
    platform: scraped.detectedPlatform,
    title: scraped.title,
    metaDescription: scraped.metaDescription,
    ogTitle: scraped.ogTitle,
    ogDescription: scraped.ogDescription,
    canonicalUrl: scraped.canonicalUrl,
    viewportMeta: scraped.viewportMetaPresent,
    h1: scraped.h1.slice(0, 5),
    h2: scraped.h2.slice(0, 8),
    primaryCtaText: scraped.primaryCtaText,
    addToCartPresent: scraped.addToCartPresent,
    pricePresent: scraped.pricePresent,
    priceSample: scraped.priceSample,
    currencyDetected: scraped.currencyDetected,
    ctas: scraped.ctas.slice(0, 10),
    priceTexts: scraped.priceTexts.slice(0, 10),
    shippingReturnsMentions: scraped.shippingReturnsMentions,
    shippingReturnsTextSample: scraped.shippingReturnsTextSample,
    trustSignals: scraped.trustSignals,
    reviewsCountHint: scraped.reviewsCountHint,
    imagesCount: scraped.imagesCount,
    missingAltCount: scraped.missingAltCount,
    scriptsCount: scraped.scriptsCount,
    stylesCount: scraped.stylesCount,
    wordCountEstimate: scraped.wordCountEstimate,
    internalLinksCount: scraped.internalLinksCount,
    externalLinksCount: scraped.externalLinksCount,
    aboveFoldTextSample: scraped.aboveFoldTextSample.slice(0, 1500),
    mainTextSample: scraped.mainTextSample.slice(0, 8000),
  };

  return JSON.stringify({
    scraped: trimmed,
    instructions:
      "Return 8–12 findings. Each evidence field should quote or paraphrase a short snippet from mainTextSample or aboveFoldTextSample. where_to_fix must specify the page area (hero, near price, near Add to Cart, product gallery, footer, etc.). what_to_change must describe the exact change. Ensure top_fixes are 3 distinct non-overlapping recommendations. Scores should be consistent with findings severity.",
  });
};

/* ────────────────────────── repair prompt ────────────────────────── */

const REPAIR_SYSTEM_PROMPT = `The previous response was invalid JSON. Repair the JSON below so it matches the required schema exactly. Output ONLY the corrected JSON, no explanation.`;

/* ────────────────────────── main function ────────────────────────── */

export const generateReport = async (
  scraped: ScrapedPage,
  pageType: PageType,
  options?: { useLiveAudit?: boolean }
): Promise<{ report: AuditReport; usedMock: boolean }> => {
  const useLiveAudit = options?.useLiveAudit ?? true;
  if (
    !useLiveAudit ||
    process.env.USE_MOCK_AI === "true" ||
    !process.env.OPENAI_API_KEY
  ) {
    return { report: createMockReport(scraped), usedMock: true };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const callOpenAI = async (
    systemContent: string,
    userContent: string
  ): Promise<string | null> => {
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
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
    return response.output_text || null;
  };

  try {
    const userPrompt = buildUserPrompt(scraped, pageType);

    // First attempt
    let outputText = await callOpenAI(SYSTEM_PROMPT, userPrompt);

    if (outputText) {
      try {
        const parsed = JSON.parse(outputText);
        if (validateReportShape(parsed)) {
          return { report: parsed as AuditReport, usedMock: false };
        }
      } catch {
        // JSON parse failed – try repair
      }

      // Retry with repair prompt
      console.warn("[openai] First response invalid, attempting repair...");
      const repairOutput = await callOpenAI(
        REPAIR_SYSTEM_PROMPT,
        `Invalid JSON to repair:\n${outputText.slice(0, 6000)}`
      );

      if (repairOutput) {
        try {
          const repaired = JSON.parse(repairOutput);
          if (validateReportShape(repaired)) {
            return { report: repaired as AuditReport, usedMock: false };
          }
        } catch {
          // repair also failed
        }
      }
    }

    // Both attempts failed – fall back to mock
    console.warn("[openai] Both attempts failed, falling back to mock report.");
    return { report: createMockReport(scraped), usedMock: true };
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
      return { report: createMockReport(scraped), usedMock: true };
    }

    throw error;
  }
};
