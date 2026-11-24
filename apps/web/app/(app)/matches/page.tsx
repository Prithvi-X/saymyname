'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, MatchProfile } from '../../../lib/api';
import {
  ChatIcon,
  XIcon,
  CheckIcon,
  HandshakeIcon,
} from '../../../components/icons';

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [unmatchModal, setUnmatchModal] = useState<{
    isOpen: boolean;
    matchId?: string;
    candidateName?: string;
  }>({ isOpen: false });

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
        return 'IITM BS Track';
    }
  };

  return (
    <div className="container-standard" style={{ paddingTop: '32px', paddingBottom: '64px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="index-stamp">Bilateral Matches</span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>•</span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {matches.length} active
          </span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 600, margin: '0 0 6px 0' }}>
          Mutual Matches
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Verified scholars where both of you expressed mutual interest. Private conversation is unlocked.
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>
          Loading your matches...
        </p>
      ) : matches.length === 0 ? (
        <div className="card-surface" style={{ padding: '64px 28px', textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-surface-subtle)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '18px',
            }}
          >
            <HandshakeIcon size={28} color="var(--color-brand-primary)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 600, margin: '0 0 8px 0' }}>
            No Matches Yet
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', maxWidth: '400px', margin: '0 auto 24px auto', lineHeight: '22px' }}>
            When someone you liked also likes your profile back, they will appear here and private 1-on-1 messaging will unlock.
          </p>
          <Link href="/discover" className="btn btn-primary">
            Explore Discovery
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {matches.map((m) => {
            const photo = m.candidate.photos?.[0]?.photoUrl;
            return (
              <div
                key={m.id}
                className="card-surface"
                style={{
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '20px',
                  flexWrap: 'wrap',
                }}
              >
                {/* Partner Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '260px' }}>
                  {photo ? (
                    <img
                      src={photo}
                      alt={m.candidate.displayName}
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                        border: '1.5px solid var(--color-border-default)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        backgroundColor: m.candidate.avatarColor || '#6E2638',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
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
                      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                        {m.candidate.displayName}, {m.candidate.age}
                      </h2>
                      <span className="badge-verified">
                        <CheckIcon size={10} color="var(--color-brand-primary)" />
                        <span>Verified</span>
                      </span>
                    </div>

                    <p style={{ margin: '0 0 4px 0', fontSize: '12.5px', color: 'var(--color-accent-warm)', fontWeight: 600 }}>
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
                      {m.lastMessage || 'Mutual match active • Ready for conversation'}
                    </p>
                  </div>
                </div>

                {/* Actions: Direct Chat & Safe Unmatch */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <Link
                    href={`/chats?matchId=${m.id}`}
                    className="btn btn-primary"
                    style={{ padding: '9px 18px', fontSize: '13px' }}
                  >
                    <ChatIcon size={14} color="#FFFFFF" />
                    <span>Open Chat</span>
                  </Link>

                  <button
                    onClick={() =>
                      setUnmatchModal({
                        isOpen: true,
                        matchId: m.id,
                        candidateName: m.candidate.displayName,
                      })
                    }
                    className="btn btn-secondary btn-round"
                    style={{ width: '38px', height: '38px' }}
                    title="End Match"
                    aria-label={`End match with ${m.candidate.displayName}`}
                  >
                    <XIcon size={16} color="var(--color-text-secondary)" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-App Unmatch Confirmation Modal */}
      {unmatchModal.isOpen && (
        <div className="dialog-overlay" onClick={() => setUnmatchModal({ isOpen: false })}>
          <div className="dialog-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, color: 'var(--color-status-danger)', marginBottom: '8px' }}>
              End Match with {unmatchModal.candidateName}?
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              Ending this match will permanently remove your conversation history. In accordance with Document 01 §3.6, mutual communication will be severed immediately and safely on the server.
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
