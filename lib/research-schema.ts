import { z } from "zod";

export const researchResultSchema = z.object({
  answer: z
    .string()
    .describe("Comprehensive markdown synthesis of findings and engineering analysis"),

  findings: z.array(
    z.object({
      claim: z.string(),
      sourceIds: z.array(z.string()),
      confidence: z.enum(["high", "medium", "low"]),
    })
  ),

  limitations: z.array(z.string()),

  sourcesUsed: z.array(z.string()),
});

export const claimVerificationSchema = z.object({
  claim: z.string(),
  verdict: z.enum(["VERIFIED", "REFUTED", "UNVERIFIED"]),
  truthRating: z.number().min(0).max(100),
  reasoning: z.string(),

  supportingEvidence: z.array(
    z.object({
      claim: z.string(),
      sourceIds: z.array(z.string()),
      confidence: z.enum(["high", "medium", "low"]),
    })
  ),

  contradictingEvidence: z.array(
    z.object({
      claim: z.string(),
      sourceIds: z.array(z.string()),
      confidence: z.enum(["high", "medium", "low"]),
    })
  ),

  limitations: z.array(z.string()),
  sourcesUsed: z.array(z.string()),
});

export type ResearchResult = z.infer<typeof researchResultSchema>;
export type ClaimVerificationResult = z.infer<typeof claimVerificationSchema>;