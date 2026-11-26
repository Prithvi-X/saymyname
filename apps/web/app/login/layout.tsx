import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Member Sign In',
  description: 'Sign in with your approved IIT Madras BS study email and password.',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
