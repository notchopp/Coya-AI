import { getSupabaseClient } from "@/lib/supabase";

export type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface OnboardingStatus {
  completed: boolean;
  currentStep: OnboardingStep;
  businessId: string;
}

/**
 * Check onboarding status for a business
 */
export async function checkOnboardingStatus(businessId: string): Promise<OnboardingStatus> {
  const supabase = getSupabaseClient();
  
  const result = await supabase
    .from("businesses")
    .select("onboarding_completed_at, onboarding_step")
    .eq("id", businessId)
    .single();

  const data = result.data as {
    onboarding_completed_at: string | null;
    onboarding_step: number | null;
  } | null;
  const error = result.error;

  if (error || !data) {
    return {
      completed: false,
      currentStep: 0,
      businessId,
    };
  }

  const completed = data.onboarding_completed_at !== null;
  const currentStep = (data.onboarding_step || 0) as OnboardingStep;

  return {
    completed,
    currentStep,
    businessId,
  };
}

/**
 * Update onboarding step
 */
export async function updateOnboardingStep(
  businessId: string,
  step: OnboardingStep
): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from("businesses")
    .update({ onboarding_step: step } as any)
    .eq("id", businessId);

  return !error;
}

/**
 * Mark onboarding as completed
 */
export async function completeOnboarding(businessId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from("businesses")
    .update({
      onboarding_completed_at: new Date().toISOString(),
      onboarding_step: 7,
      is_active: true,
    } as any)
    .eq("id", businessId);

  return !error;
}

/**
 * Get route for onboarding step
 */
export function getStepRoute(step: OnboardingStep): string {
  switch (step) {
    case 0:
    case 1:
      return "/onboarding/business-setup";
    case 2:
      return "/onboarding/mode-selection";
    case 3:
      return "/onboarding/business-config";
    case 4:
      return "/onboarding/test-call";
    case 5:
      return "/onboarding/tutorial";
    case 6:
      return "/onboarding/go-live";
    case 7:
      return "/"; // Completed
    default:
      return "/onboarding/business-setup";
  }
}

/**
 * Get next step route
 */
export function getNextStepRoute(currentStep: OnboardingStep): string {
  const nextStep = Math.min(currentStep + 1, 7) as OnboardingStep;
  return getStepRoute(nextStep);
}

