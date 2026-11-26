import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Create Account & Verification Onboarding',
  description:
    'Complete IIT Madras non-campus BS email confirmation, 18+ eligibility review, and guided profile setup.',
  alternates: { canonical: '/onboarding' },
  robots: { index: false, follow: true },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
