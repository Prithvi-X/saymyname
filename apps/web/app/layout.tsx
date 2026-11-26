import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import PublicFooter from '../components/PublicFooter';
import { AuthProvider } from '../lib/auth-context';
import { getConfiguredSupportEmail } from '../lib/public-config';

const instrumentSans = localFont({
  src: [
    {
      path: './fonts/instrument-sans-latin-normal.woff2',
      weight: '400 700',
      style: 'normal',
    },
    {
      path: './fonts/instrument-sans-latin-ext-normal.woff2',
      weight: '400 700',
      style: 'normal',
    },
    {
      path: './fonts/instrument-sans-latin-italic.woff2',
      weight: '400 700',
      style: 'italic',
    },
    {
      path: './fonts/instrument-sans-latin-ext-italic.woff2',
      weight: '400 700',
      style: 'italic',
    },
  ],
  variable: '--font-instrument-sans',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://saymyname.in'),
  title: {
    default: 'SayMyName.in — For verified IIT Madras non-campus BS students',
    template: '%s | SayMyName.in',
  },
  description:
    'An independent, dating-first platform for adult learners across distance. Built around mutual consent, intentional connection, and relationship continuity.',
  openGraph: {
    siteName: 'SayMyName.in',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={instrumentSans.variable}>
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
      </head>
      <body>
        <AuthProvider>
          <Navbar />
          <main className="app-main-content">
            {children}
          </main>
          <PublicFooter supportEmail={getConfiguredSupportEmail()} />
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
