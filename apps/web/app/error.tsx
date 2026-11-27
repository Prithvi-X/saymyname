'use client';

import React, { useEffect } from 'react';
import { ThresholdMark } from '../components/brand';
import { Button } from '../components/ui';

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
    <section
      aria-labelledby="error-boundary-heading"
      className="container-app py-14 sm:py-24 font-ui"
    >
      <div className="max-w-2xl mx-auto rounded-[12px] border border-edge bg-coal p-7 sm:p-10 flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-edge pb-5">
          <div className="flex items-center gap-4">
            <ThresholdMark variant={isChunkError ? 'aligned' : 'separated'} size="sm" />
            <div>
              <p className="text-[13px] font-medium text-iris">
                {isChunkError ? 'Deployment update detected' : 'Temporary view interruption'}
              </p>
              <h1
                id="error-boundary-heading"
                className="text-xl sm:text-2xl font-semibold text-chalk tracking-tight mt-0.5"
              >
                {isChunkError ? 'Application Updated' : 'Unable to render this view'}
              </h1>
            </div>
          </div>
        </div>

        <p className="text-sm sm:text-base text-silver leading-relaxed">
          {isChunkError
            ? 'A newer release of SayMyName is live. Reload the page to synchronize the latest application bundle.'
            : error.message || 'An unexpected client error interrupted rendering on this route.'}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" onClick={handleReload}>
            Reload Page
          </Button>

          {!isChunkError && (
            <>
              <Button variant="secondary" size="lg" onClick={() => reset()}>
                Try Again
              </Button>
              <Button variant="ghost" size="lg" onClick={handleReturnHome}>
                Return Home
              </Button>
            </>
          )}
        </div>

        {process.env.NODE_ENV !== 'production' && error.digest && (
          <div className="pt-4 border-t border-edge text-xs text-silver/80">
            Diagnostic reference: {error.digest}
          </div>
        )}
      </div>
    </section>
  );
}
