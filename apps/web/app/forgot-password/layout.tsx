import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Password Recovery',
  description: 'Request a single-use password recovery link for your SayMyName account.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
