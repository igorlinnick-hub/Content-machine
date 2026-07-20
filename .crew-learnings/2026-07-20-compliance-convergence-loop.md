# Compliance gate needs a convergence loop, not a single fix pass

**Date:** 2026-07-20
**Context:** Scripts kept reaching the doctor with "Reword required" / "Review
needed" banners even though a rewrite pass existed.

## The pattern

An LLM compliance gate is non-deterministic: after the rewriter patches the
flagged excerpts, a fresh grade can flag NEW excerpts (missed last round, or
introduced by the rewrite). A single gate → rewrite → regrade pass therefore
ships content with leftover findings.

Fix shape (`lib/agents/compliance-loop.ts`):

1. **Converge**: loop gate → rewrite → regrade until PASS, max N=3 rounds;
   only accept a rewrite whose regrade is not worse (rank PASS < REVIEW <
   REWORD < REMOVE).
2. **Resolve, don't patch**: teach the rewriter class-level strategies —
   unattributed stat → qualitative hedge, FDA date → drop the year, dosage →
   "typically", currency claim → remove time anchor. Otherwise the same rule
   re-fires on the reworded text.
3. **Compliant by construction**: mirror those same rules in the Writer's
   system prompt so round 0 usually passes (each avoided round ≈ one Haiku +
   one gate call).
4. **Every entry point**: audit ALL generation paths — the refine route had
   no gate at all, which is where the dirty versions came from.

Findings are resolved, never hidden — the final verdict shown is always a
real grade from the last gate run.
