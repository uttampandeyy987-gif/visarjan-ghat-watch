import type { SiteAssessment } from "./screening";

/**
 * Rule-based planning prompts for the officer. They follow from the category,
 * never from the AI, and they are options for judgement, not instructions.
 */
export function suggestedSteps(a: SiteAssessment): string[] {
  const steps: string[] = [];
  switch (a.category) {
    case "high":
      steps.push("Consider this site first for pre-, during- and post-immersion DO and BOD sampling.");
      steps.push("Review readiness for oxygen-related measures (for example aeration) and cleaning before immersion.");
      break;
    case "elevated":
      steps.push("Include in the immersion sampling round, with attention to the specific exceedances listed above.");
      break;
    case "monitor":
      steps.push("Keep in routine monitoring. Past readings without failures are not evidence that the water is safe now.");
      break;
    case "insufficient":
      steps.push("Collect baseline readings before immersion. The record in this view is too thin to screen.");
      break;
  }
  if (a.missingEvents.length) steps.push(`Find out why no table was published for ${a.missingEvents.map((e) => `${e.festival} ${e.year}`).join(", ")}.`);
  if (a.matchConfidence === "medium") steps.push("Confirm which physical location(s) these readings describe before acting on them.");
  return steps;
}
