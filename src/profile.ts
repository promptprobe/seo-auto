import type { ContentProfile } from './types.js';

export const DEFAULT_CONTENT_PROFILE: ContentProfile = {
  name: 'default',
  titleMinChars: 20,
  titleMaxChars: 70,
  bodyMinChars: 1_200,
  minH2Count: 3,
  minFaqCount: 2,
  minInternalLinks: 1,
  minSources: 1,
  metaTitleMinChars: 20,
  metaTitleMaxChars: 70,
  metaDescriptionMinChars: 80,
  metaDescriptionMaxChars: 170,
  qualityThreshold: 85,
  faqHeading: 'Frequently asked questions',
  forbiddenPatterns: [],
  requiredPatterns: [],
};

export function defineContentProfile(
  overrides: Partial<ContentProfile> & Pick<ContentProfile, 'name'>,
): ContentProfile {
  return {
    ...DEFAULT_CONTENT_PROFILE,
    ...overrides,
    forbiddenPatterns: overrides.forbiddenPatterns ?? DEFAULT_CONTENT_PROFILE.forbiddenPatterns,
    requiredPatterns: overrides.requiredPatterns ?? DEFAULT_CONTENT_PROFILE.requiredPatterns,
  };
}
