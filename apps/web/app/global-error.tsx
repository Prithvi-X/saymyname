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
            maxWidth: '520px',
            width: '100%',
            backgroundColor: '#12161B',
            border: '1px solid #343D48',
            borderRadius: '12px',
            padding: '2rem',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              paddingBottom: '1.25rem',
              borderBottom: '1px solid #343D48',
              marginBottom: '1.25rem',
            }}
          >
            <svg
              width="66"
              height="48"
              viewBox="0 0 128 96"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 10C12 7.79086 13.7909 6 16 6H52V28H34V68H52V90H16C13.7909 90 12 88.2091 12 86V10Z"
                fill="#1A2027"
                stroke="#465261"
                strokeWidth="1.5"
              />
              <rect x="34" y="34" width="6" height="28" rx="1" fill="#8580C4" fillOpacity="0.45" />
              <rect x="59" y="43" width="10" height="10" rx="2" fill="#E18A62" />
              <path
                d="M116 10C116 7.79086 114.209 6 112 6H76V28H94V68H76V90H112C114.209 90 116 88.2091 116 86V10Z"
                fill="#1A2027"
                stroke="#465261"
                strokeWidth="1.5"
              />
              <rect x="88" y="34" width="6" height="28" rx="1" fill="#8580C4" fillOpacity="0.45" />
            </svg>
            <div>
              <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 500, color: '#8580C4' }}>
                {isChunkError ? 'Deployment update detected' : 'System notice'}
              </p>
              <h1
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 600,
                  margin: '0.2rem 0 0 0',
                  color: '#F0F1EE',
                }}
              >
                {isChunkError ? 'Application Updated' : 'Temporary application interruption'}
              </h1>
            </div>
          </div>

          <p
            style={{
              fontSize: '0.9375rem',
              color: '#B6BDC4',
              lineHeight: 1.55,
              margin: '0 0 1.5rem 0',
            }}
          >
            {isChunkError
              ? 'A newer release of SayMyName has been deployed. Reload the page to load the latest version.'
              : 'The application encountered an unexpected error. Reload to restore your session view.'}
          </p>

          <button
            type="button"
            onClick={handleAction}
            style={{
              height: '48px',
              padding: '0 1.5rem',
              backgroundColor: '#8580C4',
              color: '#0B0D10',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9375rem',
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
