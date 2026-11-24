import type { Metadata } from 'next';
import './globals.css';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import { AuthProvider } from '../lib/auth-context';

export const metadata: Metadata = {
  title: 'SayMyName.in — For verified IIT Madras non-campus BS students',
  description: 'An independent, dating-first platform for adult learners across distance. Built around mutual consent, intentional connection, and relationship continuity.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                if (e.filename && (e.filename.includes('share-modal.js') || e.filename.includes('vce'))) {
                  e.stopImmediatePropagation();
                  e.preventDefault();
                }
              });
            `,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <Navbar />
          <main className="app-main-content">
            {children}
          </main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
