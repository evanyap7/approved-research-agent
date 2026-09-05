import { z } from "zod";

export const researchResultSchema = z.object({
  answer: z.string().min(1).describe("Comprehensive markdown synthesis of findings and engineering analysis"),

  findings: z
    .array(
      z.object({
        claim: z.string().min(1),
        sourceIds: z.array(z.string()).min(1),
        confidence: z.enum(["high", "medium", "low"]).optional().default("high"),
      })
    )
    .optional()
    .default([]),

  limitations: z.array(z.string()).optional().default([]),

  sourcesUsed: z.array(z.string()).optional().default([]),
});

export const claimVerificationSchema = z.object({
  claim: z.string().min(1),
  verdict: z.enum(["VERIFIED", "REFUTED", "UNVERIFIED"]),
  truthRating: z.number().min(0).max(100),
  reasoning: z.string().min(1),

  supportingEvidence: z
    .array(
      z.object({
        claim: z.string().min(1),
        sourceIds: z.array(z.string()).min(1),
        confidence: z.enum(["high", "medium", "low"]).optional().default("high"),
      })
    )
    .optional()
    .default([]),

  contradictingEvidence: z
    .array(
      z.object({
        claim: z.string().min(1),
        sourceIds: z.array(z.string()).min(1),
        confidence: z.enum(["high", "medium", "low"]).optional().default("high"),
      })
    )
    .optional()
    .default([]),

  limitations: z.array(z.string()).optional().default([]),
  sourcesUsed: z.array(z.string()).optional().default([]),
});

export type ResearchResult = z.infer<typeof researchResultSchema>;
export type ClaimVerificationResult = z.infer<typeof claimVerificationSchema>;