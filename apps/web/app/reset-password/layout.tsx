import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Choose a new password for your SayMyName account.',
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
