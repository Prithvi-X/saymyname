'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, MatchProfile } from '../../../lib/api';

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMatches() {
      try {
        const list = await api.getMatches();
        setMatches(list);
      } catch (err) {
        console.error('Failed to load matches:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMatches();
  }, []);

  const handleUnmatch = async (matchId: string, candidateName: string) => {
    const confirm = window.confirm(`End match with ${candidateName}? This will permanently remove your conversation.`);
    if (!confirm) return;
    await api.blockUser(matchId, 'Unmatched by user');
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
  };

  const getProgrammeTitle = (family: string) => {
    switch (family) {
      case 'data_science_applications':
        return 'Data Science & Applications';
      case 'electronic_systems':
        return 'Electronic Systems';
      case 'aeronautics_space':
        return 'Aeronautics & Space Tech';
      case 'management_data_science':
        return 'Management & Data Science';
      default:
        return 'IITM BS Cohort';
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px 80px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--color-text-primary)' }}>
          Mutual Matches
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Verified learners where both of you expressed mutual interest
        </p>
      </div>

      {/* Product Rule Callout (Document 01 §3.6) */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-surface-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-default)',
          fontSize: '13px',
          lineHeight: '18px',
          color: 'var(--color-text-secondary)',
          marginBottom: '24px',
        }}
      >
        🔒 <strong>Invariant</strong>: A Like is not permission to message. Private messaging requires an active mutual match and no block/restriction.
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>
          Loading your matches...
        </p>
      ) : matches.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border-default)',
            padding: '48px 24px',
            textAlign: 'center',
            boxShadow: 'var(--elevation-1)',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>💫</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0' }}>
            No Matches Yet
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', maxWidth: '380px', margin: '0 auto 20px auto', lineHeight: '22px' }}>
            When someone you liked also likes your profile, they will appear here and private messaging will unlock.
          </p>
          <Link
            href="/discover"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              backgroundColor: 'var(--color-brand-primary)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-pill)',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Explore Discover
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {matches.map((m) => (
            <div
              key={m.id}
              style={{
                padding: '16px 20px',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-default)',
                boxShadow: 'var(--elevation-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              {/* Partner Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: m.candidate.avatarColor || '#2B4C7E',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {m.candidate.displayName.charAt(0)}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                      {m.candidate.displayName}, {m.candidate.age}
                    </h2>
                    <span
                      style={{
                        padding: '2px 6px',
                        backgroundColor: 'var(--color-brand-primary-subtle)',
                        color: 'var(--color-brand-primary)',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      Verified
                    </span>
                  </div>

                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--color-accent-warm)', fontWeight: 600 }}>
                    BS in {getProgrammeTitle(m.candidate.programmeFamily)}
                  </p>

                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: 'var(--color-text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.lastMessage || 'Mutual match confirmed • Say hello'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <Link
                  href={`/chats?matchId=${m.id}`}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: 'var(--color-brand-primary)',
                    color: '#FFFFFF',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  💬 Message
                </Link>

                <button
                  onClick={() => handleUnmatch(m.id, m.candidate.displayName)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--color-surface-subtle)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-secondary)',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                  title="Unmatch / Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
