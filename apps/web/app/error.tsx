'use client';

import React, { useEffect } from 'react';
import { Button } from '../components/ui/Button';

export default function ErrorBoundary({
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

  useEffect(() => {
    // If it's a chunk mismatch, attempt one automatic reload
    if (isChunkError && typeof window !== 'undefined') {
      const storageKey = 'smn_chunk_error_auto_reload';
      if (!sessionStorage.getItem(storageKey)) {
        sessionStorage.setItem(storageKey, 'true');
        window.location.reload();
      }
    }
  }, [isChunkError]);

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('smn_chunk_error_auto_reload');
      window.location.reload();
    }
  };

  const handleReturnHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          backgroundColor: 'var(--smn-surface, #14171C)',
          border: '1px solid var(--smn-border, rgba(255, 255, 255, 0.08))',
          borderRadius: '16px',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: isChunkError
              ? 'rgba(133, 128, 196, 0.15)'
              : 'rgba(235, 87, 87, 0.15)',
            border: `1px solid ${
              isChunkError ? 'var(--smn-accent-iris, #8580C4)' : 'rgba(235, 87, 87, 0.3)'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
            color: isChunkError ? 'var(--smn-accent-iris, #8580C4)' : '#EB5757',
            fontSize: '1.25rem',
          }}
        >
          {isChunkError ? '⟳' : '⚠'}
        </div>

        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--smn-text-primary, #F0F1EE)',
            marginBottom: '0.75rem',
            letterSpacing: '-0.01em',
          }}
        >
          {isChunkError ? 'Application Updated' : 'Something unexpected occurred'}
        </h2>

        <p
          style={{
            fontSize: '0.9rem',
            color: 'var(--smn-text-secondary, #9DA3A0)',
            lineHeight: 1.5,
            marginBottom: '2rem',
          }}
        >
          {isChunkError
            ? 'A new version of SayMyName was deployed. Your browser has cached an earlier component manifest. Please reload to sync the latest version.'
            : error.message || 'An unexpected client error occurred while rendering this page.'}
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <Button
            variant="primary"
            onClick={handleReload}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Reload Page
          </Button>

          {!isChunkError && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button
                variant="secondary"
                onClick={() => reset()}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Try Again
              </Button>
              <Button
                variant="ghost"
                onClick={handleReturnHome}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Return Home
              </Button>
            </div>
          )}
        </div>

        {process.env.NODE_ENV !== 'production' && error.digest && (
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--smn-border, rgba(255, 255, 255, 0.08))',
              fontSize: '0.75rem',
              color: 'var(--smn-text-muted, #565D59)',
            }}
          >
            Digest: {error.digest}
          </div>
        )}
      </div>
    </div>
  );
}
