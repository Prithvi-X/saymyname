import type { Metadata } from 'next';
import './globals.css';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Navbar />
        <main style={{ minHeight: 'calc(100vh - 140px)', paddingBottom: '70px' }}>
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
