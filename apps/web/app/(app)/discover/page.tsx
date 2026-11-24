'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, DiscoveryCandidate } from '../../../lib/api';
import {
  CheckIcon,
  PinIcon,
  XIcon,
  HeartIcon,
  MoreVerticalIcon,
  ShieldIcon,
  FlagIcon,
  LockIcon,
  SparklesIcon,
  CompassIcon,
} from '../../../components/icons';

export default function DiscoverPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState<Record<string, boolean>>({});

  // Safety & Action Modals
  const [safetyMenuOpen, setSafetyMenuOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate content or messages');
  const [reportNotes, setReportNotes] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Match celebration modal
  const [matchModal, setMatchModal] = useState<{
    isOpen: boolean;
    candidate?: DiscoveryCandidate;
    matchId?: string;
  }>({ isOpen: false });

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

  // Keyboard navigation for calm, intentional browsing
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (matchModal.isOpen || blockModalOpen || reportModalOpen) return;
      if (e.key === 'ArrowLeft') handlePass();
      if (e.key === 'ArrowRight') handleLike();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, candidates, matchModal.isOpen, blockModalOpen, reportModalOpen]);

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

  const confirmBlock = async () => {
    if (!currentCandidate) return;
    await api.blockUser(currentCandidate.profileId, 'User requested block from discovery');
    setBlockModalOpen(false);
    setSafetyMenuOpen(false);
    setFeedbackMessage(`Blocked ${currentCandidate.displayName}. Mutual visibility has been severed immediately.`);
    setTimeout(() => {
      setFeedbackMessage(null);
      setCurrentIndex((prev) => prev + 1);
    }, 2000);
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCandidate) return;
    const fullReason = `${reportReason}${reportNotes ? `: ${reportNotes}` : ''}`;
    await api.reportUser(currentCandidate.profileId, fullReason);
    setReportModalOpen(false);
    setSafetyMenuOpen(false);
    setReportNotes('');
    setFeedbackMessage(`Report submitted confidentially. Thank you for protecting the community.`);
    setTimeout(() => {
      setFeedbackMessage(null);
      setCurrentIndex((prev) => prev + 1);
    }, 2000);
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

  const primaryPhoto = currentCandidate?.photos?.[0]?.photoUrl;
  const hasValidPhoto = primaryPhoto && !imageError[currentCandidate?.profileId || ''];

  if (loading) {
    return (
      <div style={{ maxWidth: '580px', margin: '64px auto', padding: '0 20px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', backgroundColor: 'var(--color-brand-primary-subtle)', marginBottom: '16px' }}>
          <CompassIcon size={32} color="var(--color-brand-primary)" />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
          Connecting with IITM BS Cohorts
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          Loading your daily batch of verified student profiles...
        </p>
      </div>
    );
  }

  return (
    <div className="mobile-app-layout" style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 16px 40px 16px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 600, margin: 0 }}>
            Discover
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
            Verified IIT Madras non-campus BS learners
          </p>
        </div>

        <Link
          href="/eligibility"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-pill)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
          }}
        >
          <ShieldIcon size={14} color="var(--color-text-secondary)" />
          <span>Eligibility</span>
        </Link>
      </div>

      {feedbackMessage && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-brand-primary)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-brand-primary)',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '16px',
            textAlign: 'center',
            animation: 'fadeIn 150ms ease-out',
          }}
        >
          {feedbackMessage}
        </div>
      )}

      {/* Main Candidate Card Deck */}
      {currentCandidate ? (
        <div className="card-editorial" style={{ position: 'relative' }}>
          {/* Photo / Portrait Stage */}
          <div
            style={{
              height: '440px',
              position: 'relative',
              backgroundColor: currentCandidate.avatarColor || '#3B232B',
              overflow: 'hidden',
            }}
          >
            {hasValidPhoto ? (
              <img
                src={primaryPhoto}
                alt={currentCandidate.displayName}
                onError={() => setImageError((prev) => ({ ...prev, [currentCandidate.profileId]: true }))}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(145deg, ${currentCandidate.avatarColor || '#7A3045'} 0%, #211D1C 100%)`,
                  color: '#FFFFFF',
                }}
              >
                <div
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: '44px',
                    fontWeight: 600,
                    marginBottom: '12px',
                    border: '2px solid rgba(255, 255, 255, 0.25)',
                  }}
                >
                  {currentCandidate.displayName.charAt(0)}
                </div>
                <span style={{ fontSize: '12px', opacity: 0.8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  IITM Verified Learner
                </span>
              </div>
            )}

            {/* Gradient Scrim for Text Legibility */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(23, 20, 19, 0.92) 0%, rgba(23, 20, 19, 0.4) 45%, rgba(0, 0, 0, 0) 75%)',
                pointerEvents: 'none',
              }}
            />

            {/* Top Bar: Safety Options Menu Trigger */}
            <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
              <button
                onClick={() => setSafetyMenuOpen(!safetyMenuOpen)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(23, 20, 19, 0.45)',
                  backdropFilter: 'blur(8px)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  transition: 'background-color var(--duration-fast)',
                }}
                aria-label="Safety menu"
              >
                <MoreVerticalIcon size={18} color="#FFFFFF" />
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
                    onClick={() => {
                      setSafetyMenuOpen(false);
                      setReportModalOpen(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '13px',
                      color: 'var(--color-text-primary)',
                      borderBottom: '1px solid var(--color-border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <FlagIcon size={15} color="var(--color-text-secondary)" />
                    <span>Report Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      setSafetyMenuOpen(false);
                      setBlockModalOpen(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '13px',
                      color: 'var(--color-status-danger)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <ShieldIcon size={15} color="var(--color-status-danger)" />
                    <span>Block User</span>
                  </button>
                </div>
              )}
            </div>

            {/* Candidate Identity Overlay */}
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', zIndex: 5, color: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span className="badge-verified">
                  <CheckIcon size={12} color="var(--color-brand-primary)" />
                  <span>Verified</span>
                </span>
                {currentCandidate.locationCity && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(8px)',
                      color: '#FFFFFF',
                    }}
                  >
                    <PinIcon size={12} color="#FFFFFF" />
                    <span>{currentCandidate.locationCity}</span>
                  </span>
                )}
              </div>

              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '32px',
                  fontWeight: 600,
                  margin: '0 0 4px 0',
                  color: '#FFFFFF',
                  letterSpacing: '-0.02em',
                }}
              >
                {currentCandidate.displayName}, {currentCandidate.age}
              </h2>

              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
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

            {/* Academic & Personal Interests */}
            {currentCandidate.interests && currentCandidate.interests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                {currentCandidate.interests.map((interest, i) => (
                  <span key={i} className="badge-tag">
                    {interest}
                  </span>
                ))}
              </div>
            )}

            {/* Prompt Cards (Document 04 §4.2) */}
            {currentCandidate.promptAnswers && currentCandidate.promptAnswers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {currentCandidate.promptAnswers.map((pa) => (
                  <div
                    key={pa.id}
                    className="card-subtle"
                    style={{ borderLeft: '3px solid var(--color-accent-warm)' }}
                  >
                    <p
                      style={{
                        margin: '0 0 6px 0',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--color-accent-warm)',
                      }}
                    >
                      {pa.promptText}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-display)',
                        fontSize: '18px',
                        lineHeight: '26px',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      "{pa.answerText}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tactile Action Bar: Pass (✕) & Like (♥) */}
          <div
            style={{
              padding: '16px 24px 28px 24px',
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
              className="btn btn-secondary btn-round"
              style={{
                width: '64px',
                height: '64px',
                border: '1.5px solid var(--color-border-default)',
                color: 'var(--color-text-secondary)',
                boxShadow: '0 2px 8px rgba(37, 33, 31, 0.05)',
              }}
              aria-label="Pass candidate"
              title="Pass (Left Arrow)"
            >
              <XIcon size={26} color="var(--color-text-secondary)" strokeWidth={2} />
            </button>

            {/* Like Button */}
            <button
              onClick={handleLike}
              className="btn btn-primary btn-round"
              style={{
                width: '72px',
                height: '72px',
                boxShadow: '0 6px 22px rgba(122, 48, 69, 0.35)',
              }}
              aria-label="Like profile"
              title="Like (Right Arrow)"
            >
              <HeartIcon size={32} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
            </button>
          </div>
        </div>
      ) : (
        /* Empty Candidate State */
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
              marginBottom: '20px',
            }}
          >
            <CompassIcon size={32} color="var(--color-brand-primary)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 600, margin: '0 0 10px 0' }}>
            You're All Caught Up
          </h2>
          <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)', maxWidth: '400px', margin: '0 auto 24px auto' }}>
            You have reviewed all available profiles in your daily batch. SayMyName maintains a calm, bounded rhythm—new verified learners join daily.
          </p>
          <button
            onClick={() => setCurrentIndex(0)}
            className="btn btn-primary"
          >
            Review Cohort Again
          </button>
        </div>
      )}

      {/* Invariant Trust Callout */}
      <div className="callout-trust" style={{ marginTop: '24px' }}>
        <LockIcon size={18} color="var(--color-brand-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong>SayMyName Invariant</strong>: Private communication is strictly bilateral between verified matches. No stranger DMs or unsolicited calls are ever permitted.
        </span>
      </div>

      {/* Safety Report Modal */}
      {reportModalOpen && currentCandidate && (
        <div className="dialog-backdrop" onClick={() => setReportModalOpen(false)}>
          <div className="dialog-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
              Report {currentCandidate.displayName}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              Your report is strictly confidential. Safety operators review every student report under Document 07 protocols.
            </p>

            <form onSubmit={submitReport}>
              <div style={{ marginBottom: '16px' }}>
                <label className="label-editorial">Reason for Report</label>
                {[
                  'Inappropriate content or messages',
                  'Impersonation or false student identity',
                  'Commercial solicitation or spam',
                  'Under-18 or non-IITM qualifier',
                ].map((reason) => (
                  <label
                    key={reason}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: reportReason === reason ? 'var(--color-brand-primary-subtle)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '13px',
                      marginBottom: '4px',
                    }}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      checked={reportReason === reason}
                      onChange={() => setReportReason(reason)}
                      style={{ accentColor: 'var(--color-brand-primary)' }}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label className="label-editorial">Additional Details (Optional)</label>
                <textarea
                  className="input-editorial"
                  rows={3}
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Provide context for our moderation team..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Submit Confidential Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Block Modal */}
      {blockModalOpen && currentCandidate && (
        <div className="dialog-backdrop" onClick={() => setBlockModalOpen(false)}>
          <div className="dialog-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, color: 'var(--color-status-danger)', marginBottom: '8px' }}>
              Block {currentCandidate.displayName}?
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              Under Document 04 §11, blocking is immediate and universal on the server. They will not be notified, and all mutual visibility will be permanently severed.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setBlockModalOpen(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBlock}
                className="btn btn-danger"
              >
                Confirm Universal Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mutual Match Celebration Dialog */}
      {matchModal.isOpen && matchModal.candidate && (
        <div className="dialog-backdrop">
          <div className="dialog-sheet" style={{ textAlign: 'center', maxWidth: '420px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-brand-primary-subtle)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <SparklesIcon size={32} color="var(--color-brand-primary)" />
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 600,
                color: 'var(--color-brand-primary)',
                marginBottom: '8px',
              }}
            >
              It's a Mutual Match!
            </h2>
            <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              Both you and <strong style={{ color: 'var(--color-text-primary)' }}>{matchModal.candidate.displayName}</strong> liked each other. Private messaging is now active.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '12px 14px',
                backgroundColor: 'var(--color-surface-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
                marginBottom: '24px',
                textAlign: 'left',
              }}
            >
              <LockIcon size={15} color="var(--color-brand-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>SayMyName Invariant</strong>: Private communication is strictly bilateral between verified matches. No stranger DMs or unsolicited calls are ever permitted.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  setMatchModal({ isOpen: false });
                  router.push(`/chats?matchId=${matchModal.matchId || 'match-001'}`);
                }}
                className="btn btn-primary"
                style={{ width: '100%', padding: '13px' }}
              >
                Send Message Now
              </button>
              <button
                onClick={() => {
                  setMatchModal({ isOpen: false });
                  setCurrentIndex((prev) => prev + 1);
                }}
                className="btn btn-ghost"
                style={{ width: '100%' }}
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
