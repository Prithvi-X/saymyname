import React from 'react';
import { LandingHero } from './LandingHero';
import { AcrossCitiesSection } from './AcrossCitiesSection';
import { ProductPreview } from './ProductPreview';
import { HowItWorksSection } from './HowItWorksSection';
import { ProgrammeSection } from './ProgrammeSection';
import { TrustSection } from './TrustSection';
import { ShareSection } from './ShareSection';
import type { HeroCompositionMode, HeroHeadlineCandidateId } from './landing-types';

export interface LandingPageProps {
  candidateId?: HeroHeadlineCandidateId;
  compositionMode?: HeroCompositionMode;
}

/**
 * Eight-Band Editorial Romance Experience (Document 10 + Phase 3 integration).
 * Gated behind LANDING_PAGE_EDITORIAL_ENABLED === 'true'.
 * Band 8 (Footer) is rendered by PublicFooter in RootLayout.
 */
export function LandingPage({
  candidateId = 'A',
  compositionMode = '3d-led',
}: LandingPageProps) {
  return (
    <div className="font-ui text-chalk bg-void">
      <LandingHero candidateId={candidateId} compositionMode={compositionMode} />
      <AcrossCitiesSection />
      <ProductPreview />
      <HowItWorksSection />
      <ProgrammeSection />
      <TrustSection />
      <ShareSection />
    </div>
  );
}
