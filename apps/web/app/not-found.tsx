import React from 'react';
import Link from 'next/link';

export default function NotFound() {
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
          maxWidth: '440px',
          width: '100%',
          backgroundColor: 'var(--smn-surface, #14171C)',
          border: '1px solid var(--smn-border, rgba(255, 255, 255, 0.08))',
          borderRadius: '16px',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            color: 'var(--smn-accent-iris, #8580C4)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: '0.75rem',
          }}
        >
          404 — Not Found
        </span>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--smn-text-primary, #F0F1EE)',
            margin: '0 0 0.75rem 0',
          }}
        >
          Page does not exist
        </h2>
        <p
          style={{
            fontSize: '0.9rem',
            color: 'var(--smn-text-secondary, #9DA3A0)',
            lineHeight: 1.5,
            margin: '0 0 2rem 0',
          }}
        >
          The requested page could not be found or has been moved to another location.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            width: '100%',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--smn-accent-iris, #8580C4)',
            color: '#0B0D10',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.9rem',
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
