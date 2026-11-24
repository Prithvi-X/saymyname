'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    error?.message?.includes('Loading chunk') ||
    error?.message?.includes('ChunkLoadError');

  const handleAction = () => {
    if (isChunkError) {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } else {
      reset();
    }
  };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          backgroundColor: '#0B0D10',
          color: '#F0F1EE',
          fontFamily: "'Instrument Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '1.5rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: '#14171C',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(133, 128, 196, 0.15)',
              border: '1px solid #8580C4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              color: '#8580C4',
              fontSize: '1.2rem',
            }}
          >
            ⟳
          </div>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              margin: '0 0 0.75rem 0',
              color: '#F0F1EE',
            }}
          >
            {isChunkError ? 'Application Updated' : 'System Notice'}
          </h2>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#9DA3A0',
              lineHeight: 1.5,
              margin: '0 0 2rem 0',
            }}
          >
            {isChunkError
              ? 'A fresh version of SayMyName has been deployed. Please reload the page to load the latest components.'
              : 'The application encountered an unexpected error. Please reload to restore connection.'}
          </p>
          <button
            onClick={handleAction}
            style={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#8580C4',
              color: '#0B0D10',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      </body>
    </html>
  );
}
