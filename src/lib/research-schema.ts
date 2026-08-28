import { z } from "zod";

export const researchResultSchema = z.object({
  answer: z.string().min(1).max(2_500),

  findings: z
    .array(
      z.object({
        claim: z.string().min(1).max(500),
        sourceIds: z.array(z.string()).min(1),
        confidence: z.enum(["high", "medium", "low"]),
      })
    )
    .min(0)
    .max(8),

  limitations: z.array(z.string().max(300)).max(5),

  sourcesUsed: z.array(z.string()).min(0).max(10),
});

export const claimVerificationSchema = z.object({
  claim: z.string().min(1).max(500),
  verdict: z.enum(["VERIFIED", "REFUTED", "UNVERIFIED"]),
  truthRating: z.number().min(0).max(100),
  reasoning: z.string().min(1).max(2_000),

  supportingEvidence: z.array(
    z.object({
      claim: z.string().min(1).max(500),
      sourceIds: z.array(z.string()).min(1),
    })
  ),

  contradictingEvidence: z.array(
    z.object({
      claim: z.string().min(1).max(500),
      sourceIds: z.array(z.string()).min(1),
    })
  ),

  limitations: z.array(z.string().max(300)).max(5),
  sourcesUsed: z.array(z.string()).min(0).max(10),
});

export type ResearchResult = z.infer<typeof researchResultSchema>;
export type ClaimVerificationResult = z.infer<typeof claimVerificationSchema>;