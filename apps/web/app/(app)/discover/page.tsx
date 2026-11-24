'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, DiscoveryCandidate } from '../../../lib/api';

export default function DiscoverPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchModal, setMatchModal] = useState<{ isOpen: boolean; candidate?: DiscoveryCandidate; matchId?: string }>({
    isOpen: false,
  });
  const [safetyMenuOpen, setSafetyMenuOpen] = useState(false);
  const [blockReportFeedback, setBlockReportFeedback] = useState<string | null>(null);

  useEffect(() => {
    async function loadCandidates() {
      try {
        const list = await api.getCandidates();
        setCandidates(list);
      } catch (err) {
        console.error('Failed to load candidates:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCandidates();
  }, []);

  const currentCandidate = candidates[currentIndex];

  const handlePass = async () => {
    if (!currentCandidate) return;
    await api.passCandidate(currentCandidate.profileId);
    setCurrentIndex((prev) => prev + 1);
    setSafetyMenuOpen(false);
  };

  const handleLike = async () => {
    if (!currentCandidate) return;
    const res = await api.likeCandidate(currentCandidate.profileId);
    if (res.isMutualMatch) {
      setMatchModal({
        isOpen: true,
        candidate: currentCandidate,
        matchId: res.matchId,
      });
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
    setSafetyMenuOpen(false);
  };

  const handleBlock = async () => {
    if (!currentCandidate) return;
    const confirmBlock = window.confirm(
      `Block ${currentCandidate.displayName}? They will never see your profile, and all interactions will be severed immediately.`
    );
    if (!confirmBlock) return;

    await api.blockUser(currentCandidate.profileId, 'User requested block from discovery');
    setBlockReportFeedback(`Blocked ${currentCandidate.displayName}. You will never see each other again.`);
    setTimeout(() => {
      setBlockReportFeedback(null);
      setCurrentIndex((prev) => prev + 1);
      setSafetyMenuOpen(false);
    }, 1800);
  };

  const handleReport = async () => {
    if (!currentCandidate) return;
    const reason = window.prompt('Please specify the reason for reporting this profile (e.g. harassment, impersonation, commercial spam):');
    if (!reason) return;

    await api.reportUser(currentCandidate.profileId, reason);
    setBlockReportFeedback(`Report submitted confidentially. Thank you for keeping SayMyName safe.`);
    setTimeout(() => {
      setBlockReportFeedback(null);
      setCurrentIndex((prev) => prev + 1);
      setSafetyMenuOpen(false);
    }, 1800);
  };

  const getProgrammeTitle = (family: string) => {
    switch (family) {
      case 'data_science_applications':
        return 'BS in Data Science & Applications';
      case 'electronic_systems':
        return 'BS in Electronic Systems';
      case 'aeronautics_space':
        return 'BS in Aeronautics & Space Tech';
      case 'management_data_science':
        return 'BS in Management & Data Science';
      default:
        return 'Approved IITM BS Cohort';
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '580px', margin: '40px auto', padding: '0 16px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>Loading verified peer queue...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '580px', margin: '0 auto', padding: '24px 16px 80px 16px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            Discover
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
            Verified IIT Madras non-campus BS learners
          </p>
        </div>

        <Link
          href="/eligibility"
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-pill)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            textDecoration: 'none',
          }}
        >
          🎓 Eligibility Guide
        </Link>
      </div>

      {blockReportFeedback && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-brand-primary)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-brand-primary)',
            fontSize: '14px',
            marginBottom: '16px',
            textAlign: 'center',
            fontWeight: 500,
          }}
        >
          {blockReportFeedback}
        </div>
      )}

      {/* Main Candidate Card Deck */}
      {currentCandidate ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border-default)',
            overflow: 'hidden',
            boxShadow: 'var(--elevation-2)',
            position: 'relative',
          }}
        >
          {/* Photo / Avatar Canvas */}
          <div
            style={{
              height: '380px',
              backgroundColor: currentCandidate.avatarColor || '#2B4C7E',
              background: `linear-gradient(145deg, ${currentCandidate.avatarColor || '#2B4C7E'} 0%, #1A1A24 100%)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: '24px',
              color: '#FFFFFF',
              position: 'relative',
            }}
          >
            {/* Safety Options Menu Trigger */}
            <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
              <button
                onClick={() => setSafetyMenuOpen(!safetyMenuOpen)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                }}
                aria-label="Safety menu"
              >
                ⋮
              </button>

              {safetyMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '44px',
                    right: 0,
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--elevation-3)',
                    width: '180px',
                    zIndex: 20,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={handleReport}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      fontSize: '13px',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--color-border-default)',
                    }}
                  >
                    🚩 Report Profile
                  </button>
                  <button
                    onClick={handleBlock}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      fontSize: '13px',
                      color: 'var(--color-status-danger)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    🚫 Block User
                  </button>
                </div>
              )}
            </div>

            {/* Candidate Identity Overlay */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.22)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  ✓ Verified
                </span>
                {currentCandidate.locationCity && (
                  <span style={{ fontSize: '12px', opacity: 0.85 }}>📍 {currentCandidate.locationCity}</span>
                )}
              </div>

              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', fontWeight: 700, margin: '0 0 4px 0', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                {currentCandidate.displayName}, {currentCandidate.age}
              </h2>

              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, opacity: 0.9 }}>
                {getProgrammeTitle(currentCandidate.programmeFamily)} {currentCandidate.currentTerm ? `• ${currentCandidate.currentTerm}` : ''}
              </p>
            </div>
          </div>

          {/* Profile Details & Editorial Prompts */}
          <div style={{ padding: '24px' }}>
            {/* Bio */}
            {currentCandidate.bio && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ margin: 0, fontSize: '15px', lineHeight: '24px', color: 'var(--color-text-primary)' }}>
                  {currentCandidate.bio}
                </p>
              </div>
            )}

            {/* Interest Tags */}
            {currentCandidate.interests && currentCandidate.interests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                {currentCandidate.interests.map((interest, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '5px 12px',
                      backgroundColor: 'var(--color-surface-subtle)',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}

            {/* Prompt Cards (Document 04 §4.2) */}
            {currentCandidate.promptAnswers && currentCandidate.promptAnswers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {currentCandidate.promptAnswers.map((pa) => (
                  <div
                    key={pa.id}
                    style={{
                      padding: '16px 20px',
                      backgroundColor: 'var(--color-surface-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border-default)',
                    }}
                  >
                    <p
                      style={{
                        margin: '0 0 8px 0',
                        fontSize: '12px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--color-accent-warm)',
                      }}
                    >
                      {pa.promptText}
                    </p>
                    <p style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '17px', lineHeight: '24px', color: 'var(--color-text-primary)' }}>
                      "{pa.answerText}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Bar: Pass (✕) & Like (♥) */}
          <div
            style={{
              padding: '16px 24px 24px 24px',
              borderTop: '1px solid var(--color-border-default)',
              backgroundColor: 'var(--color-surface)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '40px',
            }}
          >
            {/* Pass Button */}
            <button
              onClick={handlePass}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--color-surface)',
                border: '2px solid var(--color-border-default)',
                color: 'var(--color-text-secondary)',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--elevation-1)',
                transition: 'all var(--duration-fast) var(--ease-out)',
              }}
              aria-label="Pass candidate"
              title="Pass"
            >
              ✕
            </button>

            {/* Like Button */}
            <button
              onClick={handleLike}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--color-brand-primary)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'var(--elevation-2)',
                transition: 'all var(--duration-fast) var(--ease-out)',
              }}
              aria-label="Like profile"
              title="Like"
            >
              ♥
            </button>
          </div>
        </div>
      ) : (
        /* Empty Candidate State */
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
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>☕</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, margin: '0 0 12px 0' }}>
            You're All Caught Up
          </h2>
          <p style={{ fontSize: '15px', lineHeight: '24px', color: 'var(--color-text-secondary)', maxWidth: '420px', margin: '0 auto 24px auto' }}>
            You have reviewed all available candidates in your current batch. SayMyName maintains a calm, bounded discovery rhythm—new verified IITM non-campus BS learners join daily.
          </p>
          <button
            onClick={() => setCurrentIndex(0)}
            style={{
              padding: '10px 24px',
              backgroundColor: 'var(--color-brand-primary)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Review Queue Again
          </button>
        </div>
      )}

      {/* Mutual Match Celebration Modal (Document 04 §5.3) */}
      {matchModal.isOpen && matchModal.candidate && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(26, 20, 18, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: '440px',
              width: '100%',
              padding: '36px 28px',
              textAlign: 'center',
              boxShadow: 'var(--elevation-3)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '8px' }}>✨</div>
            <h2
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '28px',
                fontWeight: 700,
                margin: '0 0 8px 0',
                color: 'var(--color-brand-primary)',
              }}
            >
              It's a Mutual Match!
            </h2>
            <p style={{ fontSize: '15px', lineHeight: '22px', color: 'var(--color-text-secondary)', margin: '0 0 24px 0' }}>
              Both you and <strong style={{ color: 'var(--color-text-primary)' }}>{matchModal.candidate.displayName}</strong> liked each other. Private messaging is now active!
            </p>

            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--color-surface-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
                marginBottom: '28px',
                textAlign: 'left',
              }}
            >
              🔒 <strong>SayMyName Invariant</strong>: Private communication is strictly bilateral between verified matches. No stranger DMs or unsolicited calls are ever permitted.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  setMatchModal({ isOpen: false });
                  router.push(`/chats?matchId=${matchModal.matchId || 'match-001'}`);
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: 'var(--color-brand-primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Send Message Now
              </button>
              <button
                onClick={() => {
                  setMatchModal({ isOpen: false });
                  setCurrentIndex((prev) => prev + 1);
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-secondary)',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Keep Exploring
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
