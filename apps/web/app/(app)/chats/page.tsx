'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, MatchProfile, ChatMessage } from '../../../lib/api';
import {
  PhoneIcon,
  GameIcon,
  HeartHandshakeIcon,
  FlagIcon,
  ShieldIcon,
  SendIcon,
  MicIcon,
  CheckIcon,
  LockIcon,
} from '../../../components/icons';

function ChatsContent() {
  const searchParams = useSearchParams();
  const preselectMatchId = searchParams.get('matchId');

  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [activeMatch, setActiveMatch] = useState<MatchProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [safetyFeedback, setSafetyFeedback] = useState<string | null>(null);

  // Together Space Modals
  const [actionModal, setActionModal] = useState<{
    type: 'call' | 'game' | 'relationship' | 'block' | 'report' | null;
    isOpen: boolean;
  }>({ type: null, isOpen: false });

  // Call state
  const [callStatus, setCallStatus] = useState<string | null>(null);

  // Game state
  const [gameSelection, setGameSelection] = useState<'word_scramble' | 'iitm_trivia'>('word_scramble');
  const [gameActive, setGameActive] = useState(false);
  const [gameScore, setGameScore] = useState(0);

  // Safety state
  const [reportReason, setReportReason] = useState('Inappropriate content or messages');
  const [reportNotes, setReportNotes] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadMatches() {
      try {
        const list = await api.getMatches();
        setMatches(list);
        if (list.length > 0) {
          const matched = preselectMatchId
            ? list.find((m) => m.id === preselectMatchId) || list[0]
            : list[0];
          setActiveMatch(matched);
        }
      } catch (err) {
        console.error('Failed to load matches:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMatches();
  }, [preselectMatchId]);

  useEffect(() => {
    if (!activeMatch) return;
    async function loadMessages() {
      try {
        const history = await api.getMessages(activeMatch!.id);
        setMessages(history);
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    }
    loadMessages();
  }, [activeMatch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectConversation = (match: MatchProfile) => {
    setActiveMatch(match);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatch || !text.trim() || sending) return;

    const trimmed = text.trim();
    if (trimmed.length > 1000) {
      alert('Message exceeds 1,000 character limit (Document 04 §6.1).');
      return;
    }

    setSending(true);
    try {
      const sent = await api.sendMessage(activeMatch.id, trimmed);
      setMessages((prev) => [...prev, sent]);
      setText('');

      // Auto-reply for realistic interactive simulation
      setTimeout(() => {
        const replies = [
          'That sounds really thoughtful! How did your BS term quiz go today?',
          'Completely agree. Filter coffee and distributed systems are the best combination.',
          'Haha yes! We should definitely play a round of Word Scramble next.',
        ];
        const replyText = replies[Math.floor(Math.random() * replies.length)];
        const partnerReply: ChatMessage = {
          id: `msg-${Date.now()}`,
          conversationId: activeMatch.id,
          senderId: activeMatch.candidate.profileId,
          senderName: activeMatch.candidate.displayName,
          text: replyText,
          createdAt: new Date().toISOString(),
          isOwn: false,
          deliveryState: 'delivered',
        };
        setMessages((prev) => [...prev, partnerReply]);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const confirmBlock = async () => {
    if (!activeMatch) return;
    await api.blockUser(activeMatch.candidate.profileId, 'User requested block');
    setActionModal({ type: null, isOpen: false });
    setSafetyFeedback(`Blocked ${activeMatch.candidate.displayName}. Mutual visibility has been permanently severed.`);
    setMatches((prev) => prev.filter((m) => m.id !== activeMatch.id));
    setActiveMatch(null);
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatch) return;
    const fullReason = `${reportReason}${reportNotes ? `: ${reportNotes}` : ''}`;
    await api.reportUser(activeMatch.candidate.profileId, fullReason);
    setActionModal({ type: null, isOpen: false });
    setReportNotes('');
    setSafetyFeedback('Report submitted confidentially to safety team.');
    setTimeout(() => setSafetyFeedback(null), 3000);
  };

  const handleStartCall = () => {
    setCallStatus('Connecting via LiveKit WebRTC...');
    setTimeout(() => {
      setCallStatus('In Call (Encrypted 1:1 Audio) • No Default Recording Active');
    }, 1200);
  };

  const handleEndCall = () => {
    setCallStatus(null);
    setActionModal({ type: null, isOpen: false });
    setSafetyFeedback('Call ended safely. Duration: 01:24.');
    setTimeout(() => setSafetyFeedback(null), 3000);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '48px auto', padding: '0 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Loading conversations...</p>
      </div>
    );
  }

  return (
    <div className="mobile-app-layout" style={{ maxWidth: '980px', margin: '0 auto', padding: '16px', height: 'calc(100vh - 84px)', display: 'flex', flexDirection: 'column' }}>
      {safetyFeedback && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-brand-primary)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-brand-primary)',
            fontSize: '13px',
            marginBottom: '12px',
            textAlign: 'center',
            fontWeight: 500,
          }}
        >
          {safetyFeedback}
        </div>
      )}

      {matches.length === 0 ? (
        <div className="card-editorial" style={{ padding: '56px 24px', textAlign: 'center', margin: 'auto' }}>
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
            <LockIcon size={28} color="var(--color-brand-primary)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
            No Active Conversations
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '22px', maxWidth: '400px', margin: '0 auto 24px auto' }}>
            In accordance with Document 01 §3.6, SayMyName does not support stranger DMs. Messaging unlocks strictly after mutual likes.
          </p>
          <Link href="/discover" className="btn btn-primary">
            Explore Discover
          </Link>
        </div>
      ) : (
        <div
          className="card-editorial"
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {/* Left Sidebar: Conversations List */}
          <div
            style={{
              width: '300px',
              borderRight: '1px solid var(--color-border-default)',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--color-surface-subtle)',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-default)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, margin: 0 }}>
                Chats
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                Bilateral Mutual Matches Only
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {matches.map((m) => {
                const isSelected = activeMatch?.id === m.id;
                const photo = m.candidate.photos?.[0]?.photoUrl;
                return (
                  <div
                    key={m.id}
                    onClick={() => selectConversation(m)}
                    style={{
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--color-surface)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--color-brand-primary)' : '3px solid transparent',
                      transition: 'background-color var(--duration-fast)',
                    }}
                  >
                    {photo ? (
                      <img
                        src={photo}
                        alt={m.candidate.displayName}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          backgroundColor: m.candidate.avatarColor || '#7A3045',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '16px',
                          flexShrink: 0,
                        }}
                      >
                        {m.candidate.displayName.charAt(0)}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {m.candidate.displayName}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                          {m.matchedAt}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '12px',
                          color: 'var(--color-text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.lastMessage || 'Active mutual match'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Active Thread */}
          {activeMatch ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-surface)' }}>
              {/* Chat Header */}
              <div
                style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--color-border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--color-surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {activeMatch.candidate.photos?.[0]?.photoUrl ? (
                    <img
                      src={activeMatch.candidate.photos[0].photoUrl}
                      alt={activeMatch.candidate.displayName}
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: activeMatch.candidate.avatarColor || '#7A3045',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '16px',
                      }}
                    >
                      {activeMatch.candidate.displayName.charAt(0)}
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                        {activeMatch.candidate.displayName}, {activeMatch.candidate.age}
                      </h3>
                      <span className="badge-verified" style={{ fontSize: '10px', padding: '2px 8px' }}>
                        <CheckIcon size={10} color="var(--color-brand-primary)" />
                        <span>Verified</span>
                      </span>
                    </div>
                    <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: 'var(--color-accent-warm)', fontWeight: 600 }}>
                      BS in {activeMatch.candidate.programmeFamily.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>

                {/* Together Space & Safety Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setActionModal({ type: 'call', isOpen: true })}
                    className="btn btn-secondary btn-round"
                    title="Audio/Video Call (Requires Acceptance)"
                  >
                    <PhoneIcon size={16} color="var(--color-brand-primary)" />
                  </button>

                  <button
                    onClick={() => setActionModal({ type: 'game', isOpen: true })}
                    className="btn btn-secondary btn-round"
                    title="Interactive Mini-Game (Word Scramble)"
                  >
                    <GameIcon size={16} color="var(--color-accent-warm)" />
                  </button>

                  <button
                    onClick={() => setActionModal({ type: 'relationship', isOpen: true })}
                    className="btn btn-subtle btn-round"
                    title="Relationship Mode (Dual Opt-in)"
                  >
                    <HeartHandshakeIcon size={16} color="var(--color-brand-primary)" />
                  </button>

                  <button
                    onClick={() => setActionModal({ type: 'report', isOpen: true })}
                    className="btn btn-ghost"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                    title="Report"
                  >
                    <FlagIcon size={15} color="var(--color-text-secondary)" />
                  </button>

                  <button
                    onClick={() => setActionModal({ type: 'block', isOpen: true })}
                    className="btn btn-ghost"
                    style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--color-status-danger)' }}
                    title="Block"
                  >
                    <ShieldIcon size={15} color="var(--color-status-danger)" />
                  </button>
                </div>
              </div>

              {/* Invariant Banner */}
              <div
                style={{
                  padding: '6px 18px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  borderBottom: '1px solid var(--color-border-default)',
                  fontSize: '11px',
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <LockIcon size={12} color="var(--color-brand-primary)" />
                <span>
                  Bilateral Mutual Match • Private communication is never recorded or used for model training (Doc 01 §3.7).
                </span>
              </div>

              {/* Messages Thread */}
              <div
                style={{
                  flex: 1,
                  padding: '20px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: 'var(--color-canvas)',
                }}
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.isOwn ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: m.isOwn ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 16px',
                        borderRadius: m.isOwn ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                        backgroundColor: m.isOwn ? 'var(--color-brand-primary)' : 'var(--color-surface)',
                        color: m.isOwn ? '#FFFFFF' : 'var(--color-text-primary)',
                        fontSize: '14px',
                        lineHeight: '20px',
                        border: m.isOwn ? 'none' : '1px solid var(--color-border-default)',
                        boxShadow: '0 1px 3px rgba(37, 33, 31, 0.04)',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.text}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                      <span>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {m.isOwn && (
                        <span>
                          {m.deliveryState === 'read' ? '✓✓' : m.deliveryState === 'delivered' ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={handleSend}
                style={{
                  padding: '14px 18px',
                  borderTop: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost btn-round"
                  title="Voice Note (Max 60 seconds)"
                  onClick={() => alert('Voice note presigning ready: 60s limit with audio/webm recording.')}
                >
                  <MicIcon size={18} color="var(--color-text-secondary)" />
                </button>

                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`Message ${activeMatch.candidate.displayName}...`}
                    maxLength={1000}
                    className="input-editorial"
                    style={{ paddingRight: '64px' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '10px',
                      color: text.length > 900 ? 'var(--color-status-danger)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {text.length}/1000
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="btn btn-primary btn-round"
                  title="Send Message"
                >
                  <SendIcon size={16} color="#FFFFFF" />
                </button>
              </form>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--color-text-secondary)' }}>Select a conversation to start chatting.</p>
            </div>
          )}
        </div>
      )}

      {/* CALL MODAL (LiveKit WebRTC) */}
      {actionModal.type === 'call' && activeMatch && (
        <div className="dialog-backdrop" onClick={() => setActionModal({ type: null, isOpen: false })}>
          <div className="dialog-sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
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
              <PhoneIcon size={28} color="var(--color-brand-primary)" />
            </div>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
              Call with {activeMatch.candidate.displayName}
            </h3>

            <p style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              In accordance with Document 01 §3.7, calls require explicit invitation and acceptance before connecting.
            </p>

            <div className="callout-trust" style={{ marginBottom: '24px', textAlign: 'left' }}>
              <LockIcon size={16} color="var(--color-brand-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>No Default Recording</strong>: Voice/video calls are end-to-end WebRTC sessions and never recorded without separate affirmative consent.
              </span>
            </div>

            {callStatus ? (
              <div style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-brand-primary)', marginBottom: '12px' }}>
                  {callStatus}
                </p>
                <button onClick={handleEndCall} className="btn btn-danger" style={{ width: '100%' }}>
                  Hang Up Call
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActionModal({ type: null, isOpen: false })}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartCall}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Invite to Call
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MINI-GAMES MODAL */}
      {actionModal.type === 'game' && activeMatch && (
        <div className="dialog-backdrop" onClick={() => setActionModal({ type: null, isOpen: false })}>
          <div className="dialog-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
              Interactive Mini-Games
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              Low-pressure cooperative and turn-based games for IITM BS students across distance.
            </p>

            {!gameActive ? (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                  <div
                    onClick={() => setGameSelection('word_scramble')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-lg)',
                      border: gameSelection === 'word_scramble' ? '2px solid var(--color-brand-primary)' : '1px solid var(--color-border-default)',
                      backgroundColor: gameSelection === 'word_scramble' ? 'var(--color-brand-primary-subtle)' : 'var(--color-surface)',
                      cursor: 'pointer',
                    }}
                  >
                    <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 2px 0' }}>🧩 Word Scramble</h4>
                    <p style={{ fontSize: '12px', margin: 0, color: 'var(--color-text-secondary)' }}>
                      Unscramble campus and computer science terms together.
                    </p>
                  </div>

                  <div
                    onClick={() => setGameSelection('iitm_trivia')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-lg)',
                      border: gameSelection === 'iitm_trivia' ? '2px solid var(--color-brand-primary)' : '1px solid var(--color-border-default)',
                      backgroundColor: gameSelection === 'iitm_trivia' ? 'var(--color-brand-primary-subtle)' : 'var(--color-surface)',
                      cursor: 'pointer',
                    }}
                  >
                    <h4 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 2px 0' }}>🏛️ IITM BS Trivia</h4>
                    <p style={{ fontSize: '12px', margin: 0, color: 'var(--color-text-secondary)' }}>
                      Fun facts about the BS curriculum, hostel culture, and Chennai history.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setActionModal({ type: null, isOpen: false })} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button onClick={() => setGameActive(true)} className="btn btn-primary">
                    Start {gameSelection === 'word_scramble' ? 'Word Scramble' : 'Trivia'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-accent-warm)', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Turn 1 • Unscramble the Word • Team Score: {gameScore}
                </p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', letterSpacing: '6px', margin: '16px 0', color: 'var(--color-brand-primary)' }}>
                  A G R D N T E I
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                  Hint: Core optimization method in machine learning.
                </p>

                <div style={{ display: 'flex', gap: '8px', maxWidth: '300px', margin: '0 auto 20px auto' }}>
                  <button
                    onClick={() => {
                      setGameScore((prev) => prev + 10);
                      alert('Correct! Answer was GRADIENT. +10 Team Points!');
                      setGameActive(false);
                      setActionModal({ type: null, isOpen: false });
                    }}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    Solve: GRADIENT
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RELATIONSHIP MODE MODAL */}
      {actionModal.type === 'relationship' && activeMatch && (
        <div className="dialog-backdrop" onClick={() => setActionModal({ type: null, isOpen: false })}>
          <div className="dialog-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
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
                <HeartHandshakeIcon size={32} color="var(--color-brand-primary)" />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
                Relationship Mode
              </h3>
              <p style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--color-text-secondary)' }}>
                Document 01 §3.8: Built for couples who wish to transition from discovery to an intentional shared space.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div className="card-subtle">
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>🤝 Dual Affirmative Consent</h4>
                <p style={{ fontSize: '12px', margin: 0, color: 'var(--color-text-secondary)' }}>
                  Requires two independent actions. Discovery is automatically paused for both partners.
                </p>
              </div>

              <div className="card-subtle">
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>🕊️ Independent Unilateral Exit</h4>
                <p style={{ fontSize: '12px', margin: 0, color: 'var(--color-text-secondary)' }}>
                  Either partner may leave at any time without permission or lock-in. No coercive retention.
                </p>
              </div>

              <div className="card-subtle">
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>🛡️ Zero Surveillance Guarantee</h4>
                <p style={{ fontSize: '12px', margin: 0, color: 'var(--color-text-secondary)' }}>
                  SayMyName strictly prohibits partner GPS location tracking, ambient recording, or monitoring tools.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setActionModal({ type: null, isOpen: false })} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  setActionModal({ type: null, isOpen: false });
                  setSafetyFeedback('Relationship Mode proposal sent to partner. Dual opt-in active.');
                  setTimeout(() => setSafetyFeedback(null), 3000);
                }}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Propose Dual Opt-In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT MODAL */}
      {actionModal.type === 'report' && activeMatch && (
        <div className="dialog-backdrop" onClick={() => setActionModal({ type: null, isOpen: false })}>
          <div className="dialog-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
              Report Conversation
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              Confidential report reviewed by student safety operators under Document 07.
            </p>

            <form onSubmit={submitReport}>
              <div style={{ marginBottom: '16px' }}>
                <label className="label-editorial">Reason</label>
                {[
                  'Inappropriate content or messages',
                  'Impersonation or false student identity',
                  'Commercial solicitation or spam',
                  'Boundary violation or harassment',
                ].map((reason) => (
                  <label
                    key={reason}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
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

              <div style={{ marginBottom: '20px' }}>
                <label className="label-editorial">Details (Optional)</label>
                <textarea
                  className="input-editorial"
                  rows={3}
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Additional context..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setActionModal({ type: null, isOpen: false })} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BLOCK MODAL */}
      {actionModal.type === 'block' && activeMatch && (
        <div className="dialog-backdrop" onClick={() => setActionModal({ type: null, isOpen: false })}>
          <div className="dialog-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, color: 'var(--color-status-danger)', marginBottom: '8px' }}>
              Block {activeMatch.candidate.displayName}?
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              Universal immediate server-side block. All communication will cease, and you will never see each other on SayMyName.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setActionModal({ type: null, isOpen: false })} className="btn btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={confirmBlock} className="btn btn-danger">
                Confirm Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatsPage() {
  return (
    <React.Suspense fallback={<div style={{ textAlign: 'center', padding: '40px' }}>Loading conversation...</div>}>
      <ChatsContent />
    </React.Suspense>
  );
}
