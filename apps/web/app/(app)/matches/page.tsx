'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, MatchProfile } from '../../../lib/api';
import {
  ChatIcon,
  XIcon,
  CheckIcon,
  LockIcon,
  HandshakeIcon,
} from '../../../components/icons';

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [unmatchModal, setUnmatchModal] = useState<{ isOpen: boolean; matchId?: string; name?: string }>({
    isOpen: false,
  });

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

  const confirmUnmatch = async () => {
    if (!unmatchModal.matchId) return;
    await api.blockUser(unmatchModal.matchId, 'Unmatched by user');
    setMatches((prev) => prev.filter((m) => m.id !== unmatchModal.matchId));
    setUnmatchModal({ isOpen: false });
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
    <div className="mobile-app-layout" style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px 48px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 600, margin: '0 0 4px 0' }}>
          Mutual Matches
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Verified learners where both of you expressed mutual interest
        </p>
      </div>

      {/* Product Invariant Callout (Document 01 §3.6) */}
      <div className="callout-trust" style={{ marginBottom: '24px' }}>
        <LockIcon size={18} color="var(--color-brand-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong>SayMyName Invariant</strong>: A Like is not permission to message. Private messaging requires an active mutual match and no block/restriction.
        </span>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>
          Loading your matches...
        </p>
      ) : matches.length === 0 ? (
        <div className="card-editorial" style={{ padding: '56px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface-subtle)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <HandshakeIcon size={28} color="var(--color-brand-primary)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600, margin: '0 0 8px 0' }}>
            No Matches Yet
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', maxWidth: '380px', margin: '0 auto 24px auto', lineHeight: '22px' }}>
            When someone you liked also likes your profile, they will appear here and private bilateral messaging will unlock.
          </p>
          <Link href="/discover" className="btn btn-primary">
            Explore Discover
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {matches.map((m) => {
            const photo = m.candidate.photos?.[0]?.photoUrl;
            return (
              <div
                key={m.id}
                className="card-editorial"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                {/* Partner Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                  {photo ? (
                    <img
                      src={photo}
                      alt={m.candidate.displayName}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                        border: '1.5px solid var(--color-border-default)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: m.candidate.avatarColor || '#7A3045',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {m.candidate.displayName.charAt(0)}
                    </div>
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                        {m.candidate.displayName}, {m.candidate.age}
                      </h2>
                      <span className="badge-verified" style={{ fontSize: '10px', padding: '2px 8px' }}>
                        <CheckIcon size={10} color="var(--color-brand-primary)" />
                        <span>Verified</span>
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
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    <ChatIcon size={14} color="#FFFFFF" />
                    <span>Message</span>
                  </Link>

                  <button
                    onClick={() => setUnmatchModal({ isOpen: true, matchId: m.id, name: m.candidate.displayName })}
                    className="btn btn-secondary btn-round"
                    style={{ width: '36px', height: '36px' }}
                    title="Unmatch / Remove"
                  >
                    <XIcon size={16} color="var(--color-text-secondary)" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unmatch Confirmation Modal */}
      {unmatchModal.isOpen && (
        <div className="dialog-backdrop" onClick={() => setUnmatchModal({ isOpen: false })}>
          <div className="dialog-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, color: 'var(--color-status-danger)', marginBottom: '8px' }}>
              End Match with {unmatchModal.name}?
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              Ending this match will permanently remove your conversation history. In accordance with Document 01 §3.6, mutual communication will be severed immediately.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setUnmatchModal({ isOpen: false })}
                className="btn btn-secondary"
              >
                Keep Match
              </button>
              <button
                type="button"
                onClick={confirmUnmatch}
                className="btn btn-danger"
              >
                Confirm End Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
