/**
 * SayMyName Profile Validation (Document 04, Section 4)
 */

export interface ProfileInput {
  displayName: string;
  bio?: string;
  programmeCode: string;
  pathwayCode?: string;
  relationshipIntention?: string;
  interests?: string[];
  prompts?: Array<{ promptId: string; answer: string }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateProfile(input: ProfileInput): ValidationResult {
  const errors: Record<string, string> = {};

  // Display name: 1-50 characters, not purely whitespace
  if (!input.displayName || input.displayName.trim().length === 0) {
    errors.displayName = 'Display name is required.';
  } else if (input.displayName.trim().length > 50) {
    errors.displayName = 'Display name cannot exceed 50 characters.';
  }

  // Bio: max 500 characters
  if (input.bio && input.bio.length > 500) {
    errors.bio = 'Bio cannot exceed 500 characters.';
  }

  // Interests: max 10
  if (input.interests && input.interests.length > 10) {
    errors.interests = 'Maximum of 10 interests allowed.';
  }

  // Prompts: max 3 prompts, max 250 chars per answer
  if (input.prompts) {
    if (input.prompts.length > 3) {
      errors.prompts = 'Maximum of 3 prompts allowed.';
    }
    input.prompts.forEach((p, idx) => {
      if (p.answer && p.answer.length > 250) {
        errors[`prompt_${idx}`] = 'Prompt answer cannot exceed 250 characters.';
      }
    });
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
