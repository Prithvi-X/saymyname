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
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
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

  // Reset photo index when candidate changes
  useEffect(() => {
    setActivePhotoIndex(0);
  }, [currentIndex]);

  const currentCandidate = candidates[currentIndex];

  // Accessible keyboard shortcuts (Left Arrow = Pass, Right Arrow = Like, Esc = Close)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (matchModal.isOpen || blockModalOpen || reportModalOpen) {
        if (e.key === 'Escape') {
          setBlockModalOpen(false);
          setReportModalOpen(false);
          setSafetyMenuOpen(false);
        }
        return;
      }
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
        return 'Approved IITM BS Track';
    }
  };

  const photos = currentCandidate?.photos || [];
  const primaryPhoto = photos[activePhotoIndex]?.photoUrl || photos[0]?.photoUrl;
  const hasValidPhoto = primaryPhoto && !imageError[`${currentCandidate?.profileId}-${activePhotoIndex}`];

  if (loading) {
    return (
      <div className="container-narrow" style={{ paddingTop: '80px', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            padding: '16px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-brand-primary-subtle)',
            marginBottom: '16px',
          }}
        >
          <CompassIcon size={32} color="var(--color-brand-primary)" />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
          Connecting with Verified BS Peers
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          Loading your daily batch of verified student profiles...
        </p>
      </div>
    );
  }

  return (
    <div className="container-wide" style={{ paddingTop: '32px', paddingBottom: '64px' }}>
      {/* Editorial Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="index-stamp">Discovery Feed</span>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>•</span>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Daily Curated Cohort</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 600, margin: 0 }}>
            Discover
          </h1>
        </div>

        <Link
          href="/safety"
          className="btn btn-secondary"
          style={{ padding: '7px 16px', fontSize: '12.5px' }}
        >
          <ShieldIcon size={14} color="var(--color-text-secondary)" />
          <span>Safety Commitments</span>
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
            marginBottom: '20px',
            textAlign: 'center',
            animation: 'fadeIn 140ms ease-out',
          }}
        >
          {feedbackMessage}
        </div>
      )}

      {/* Responsive Split Grid: Primary Card + Desktop Context Rail */}
      <div className="desktop-split-grid">
        {/* Main Focus Column */}
        <div>
          {currentCandidate ? (
            <div className="card-surface" style={{ position: 'relative' }}>
              {/* Photo Stage with 4:5 Aspect Ratio */}
              <div
                style={{
                  height: '460px',
                  position: 'relative',
                  backgroundColor: currentCandidate.avatarColor || '#2C2624',
                  overflow: 'hidden',
                }}
              >
                {hasValidPhoto ? (
                  <img
                    src={primaryPhoto}
                    alt={currentCandidate.displayName}
                    onError={() =>
                      setImageError((prev) => ({
                        ...prev,
                        [`${currentCandidate.profileId}-${activePhotoIndex}`]: true,
                      }))
                    }
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
                      background: `linear-gradient(145deg, ${currentCandidate.avatarColor || '#6E2638'} 0%, #1E1A18 100%)`,
                      color: '#FFFFFF',
                    }}
                  >
                    <div
                      style={{
                        width: '96px',
                        height: '96px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-display)',
                        fontSize: '44px',
                        fontWeight: 600,
                        marginBottom: '12px',
                        border: '2px solid rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      {currentCandidate.displayName.charAt(0)}
                    </div>
                    <span className="index-stamp" style={{ color: 'rgba(255, 255, 255, 0.75)' }}>
                      Verified BS Scholar
                    </span>
                  </div>
                )}

                {/* Subtle Gradient Scrim for Legibility */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to top, rgba(20, 18, 17, 0.92) 0%, rgba(20, 18, 17, 0.38) 45%, rgba(0, 0, 0, 0) 75%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Top Overlay: Demo Data Stamp & Safety Trigger */}
                <div
                  style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    right: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 10,
                  }}
                >
                  <span
                    className="index-stamp"
                    style={{
                      padding: '4px 10px',
                      backgroundColor: 'rgba(20, 18, 17, 0.55)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: 'var(--radius-pill)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                  >
                    Verified Student Profile
                  </span>

                  <button
                    onClick={() => setSafetyMenuOpen(!safetyMenuOpen)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(20, 18, 17, 0.5)',
                      backdropFilter: 'blur(8px)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      cursor: 'pointer',
                    }}
                    aria-label="Profile safety options"
                  >
                    <MoreVerticalIcon size={18} color="#FFFFFF" />
                  </button>
                </div>

                {/* Safety Dropdown Menu */}
                {safetyMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '58px',
                      right: '16px',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--elevation-3)',
                      width: '180px',
                      zIndex: 30,
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
                        borderBottom: '1px solid var(--color-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <FlagIcon size={14} color="var(--color-text-secondary)" />
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
                      <ShieldIcon size={14} color="var(--color-status-danger)" />
                      <span>Block User</span>
                    </button>
                  </div>
                )}

                {/* Candidate Identity Overlay on Photo */}
                <div style={{ position: 'absolute', bottom: '20px', left: '24px', right: '24px', zIndex: 5, color: '#FFFFFF' }}>
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
                          fontSize: '11px',
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor: 'rgba(255, 255, 255, 0.18)',
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
                      fontSize: '34px',
                      fontWeight: 600,
                      margin: '0 0 4px 0',
                      color: '#FFFFFF',
                      letterSpacing: '-0.025em',
                    }}
                  >
                    {currentCandidate.displayName}, {currentCandidate.age}
                  </h2>

                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
                    {getProgrammeTitle(currentCandidate.programmeFamily)}{' '}
                    {currentCandidate.currentTerm ? `• ${currentCandidate.currentTerm}` : ''}
                  </p>
                </div>
              </div>

              {/* Profile Details, Bio & Interview Prompts */}
              <div style={{ padding: '28px' }}>
                {/* Personal Description / Bio */}
                {currentCandidate.bio && (
                  <div style={{ marginBottom: '24px' }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '15px',
                        lineHeight: '26px',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {currentCandidate.bio}
                    </p>
                  </div>
                )}

                {/* Academic & Personal Interests */}
                {currentCandidate.interests && currentCandidate.interests.length > 0 && (
                  <div style={{ marginBottom: '28px' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '8px' }}>
                      Interests & Passions
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {currentCandidate.interests.map((interest, i) => (
                        <span key={i} className="badge-interest">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interview Conversation Prompts (Document 04 §4.2) */}
                {currentCandidate.promptAnswers && currentCandidate.promptAnswers.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '10px' }}>
                      Conversation Prompts
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {currentCandidate.promptAnswers.map((pa) => (
                        <div key={pa.id} className="quote-card">
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
                  </div>
                )}
              </div>

              {/* Tactile Discovery Action Bar */}
              <div
                style={{
                  padding: '20px 28px 32px 28px',
                  borderTop: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-surface)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '44px',
                }}
              >
                {/* Tactile Pass Button */}
                <button
                  onClick={handlePass}
                  className="btn-pass"
                  aria-label="Pass candidate (Left Arrow)"
                  title="Pass (Left Arrow)"
                >
                  <XIcon size={26} color="var(--color-text-secondary)" strokeWidth={2} />
                </button>

                {/* Tactile Like Button */}
                <button
                  onClick={handleLike}
                  className="btn-like"
                  aria-label="Like profile (Right Arrow)"
                  title="Like (Right Arrow)"
                >
                  <HeartIcon size={32} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                </button>
              </div>
            </div>
          ) : (
            /* Intentional Empty / Caught Up State */
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
                  marginBottom: '20px',
                }}
              >
                <CompassIcon size={32} color="var(--color-brand-primary)" />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 600, margin: '0 0 10px 0' }}>
                You're All Caught Up
              </h2>
              <p style={{ fontSize: '14.5px', lineHeight: '24px', color: 'var(--color-text-secondary)', maxWidth: '420px', margin: '0 auto 28px auto' }}>
                You have reviewed your curated batch for today. SayMyName maintains a calm, bounded rhythm—new verified adult learners join daily.
              </p>
              <button onClick={() => setCurrentIndex(0)} className="btn btn-primary">
                Review Batch Again
              </button>
            </div>
          )}
        </div>

        {/* Secondary Contextual Rail (Desktop Only) */}
        <aside className="context-side-rail" aria-label="Discovery Context">
          {/* Daily Cadence Card */}
          <div className="card-surface" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span className="index-stamp">Daily Cadence</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-brand-primary)' }}>
                {currentCandidate ? `${currentIndex + 1} of ${candidates.length}` : 'Completed'}
              </span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, margin: '0 0 6px 0' }}>
              Bounded Exploration
            </h3>
            <p style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--color-text-secondary)', margin: 0 }}>
              SayMyName rejects infinite, addictive swiping. Each cohort batch is curated to support intentional, considered connection.
            </p>
          </div>

          {/* Mutual Consent Invariant Card */}
          <div className="card-surface" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <LockIcon size={16} color="var(--color-brand-primary)" />
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 600, margin: 0 }}>
                Mutual Consent Rule
              </h3>
            </div>
            <p style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Liking a profile is an expression of interest. Private chat unlocks strictly after a reciprocal mutual match. Unsolicited stranger DMs are impossible.
            </p>
          </div>

          {/* Keyboard Legend Card */}
          <div className="card-subtle" style={{ padding: '16px 20px' }}>
            <span className="index-stamp" style={{ display: 'block', marginBottom: '8px' }}>
              Keyboard Shortcuts
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pass Candidate:</span>
                <kbd style={{ padding: '1px 6px', background: 'var(--color-surface)', border: '1px solid var(--color-border-default)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>←</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Like Candidate:</span>
                <kbd style={{ padding: '1px 6px', background: 'var(--color-surface)', border: '1px solid var(--color-border-default)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>→</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Dismiss Dialog:</span>
                <kbd style={{ padding: '1px 6px', background: 'var(--color-surface)', border: '1px solid var(--color-border-default)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>Esc</kbd>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* In-App Confidential Safety Report Modal */}
      {reportModalOpen && currentCandidate && (
        <div className="dialog-overlay" onClick={() => setReportModalOpen(false)}>
          <div className="dialog-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
              Report {currentCandidate.displayName}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              Your report is strictly confidential. Safety operators review every student report under Document 07 safety protocols.
            </p>

            <form onSubmit={submitReport}>
              <div style={{ marginBottom: '16px' }}>
                <span className="index-stamp" style={{ display: 'block', marginBottom: '6px' }}>Reason for Report</span>
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
                <span className="index-stamp" style={{ display: 'block', marginBottom: '6px' }}>Additional Context (Optional)</span>
                <textarea
                  className="input-field"
                  rows={3}
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Provide context for our review team..."
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

      {/* In-App Universal Block Modal */}
      {blockModalOpen && currentCandidate && (
        <div className="dialog-overlay" onClick={() => setBlockModalOpen(false)}>
          <div className="dialog-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, color: 'var(--color-status-danger)', marginBottom: '8px' }}>
              Block {currentCandidate.displayName}?
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              Blocking is immediate and universal on the server. They will never see your profile, and all mutual visibility will be permanently severed.
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

      {/* Refined Mutual Match Celebration Dialog */}
      {matchModal.isOpen && matchModal.candidate && (
        <div className="dialog-overlay">
          <div className="dialog-modal" style={{ textAlign: 'center', maxWidth: '420px' }}>
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
              It's a Mutual Match
            </h2>
            <p style={{ fontSize: '14.5px', lineHeight: '22px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              Both you and <strong style={{ color: 'var(--color-text-primary)' }}>{matchModal.candidate.displayName}</strong> liked each other. Private bilateral conversation is now active.
            </p>

            <div
              className="banner-trust"
              style={{ marginBottom: '24px', textAlign: 'left' }}
            >
              <LockIcon size={16} color="var(--color-brand-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
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
                Start Conversation
              </button>
              <button
                onClick={() => {
                  setMatchModal({ isOpen: false });
                  setCurrentIndex((prev) => prev + 1);
                }}
                className="btn btn-ghost"
                style={{ width: '100%' }}
              >
                Continue Exploring
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
