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
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Auto-reload on stale deployment chunk mismatches
              function handleChunkError(err) {
                var msg = (err && (err.message || (err.reason && err.reason.message))) || '';
                var name = (err && (err.name || (err.reason && err.reason.name))) || '';
                if (name === 'ChunkLoadError' || msg.indexOf('Loading chunk') !== -1 || msg.indexOf('ChunkLoadError') !== -1) {
                  var storageKey = 'smn_chunk_retry_' + window.location.pathname;
                  var retries = parseInt(sessionStorage.getItem(storageKey) || '0', 10);
                  if (retries < 2) {
                    sessionStorage.setItem(storageKey, String(retries + 1));
                    window.location.reload();
                  }
                }
              }
              window.addEventListener('error', function(e) {
                handleChunkError(e);
                // Suppress foreign browser extensions injecting faulty code
                if (e.filename && (e.filename.indexOf('share-modal') !== -1 || e.filename.indexOf('vce') !== -1)) {
                  e.stopImmediatePropagation();
                  e.preventDefault();
                }
              });
              window.addEventListener('unhandledrejection', function(e) {
                handleChunkError(e);
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
