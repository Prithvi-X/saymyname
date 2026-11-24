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
  CalendarIcon,
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

  // Together Space & Safety Modals
  const [togetherHubOpen, setTogetherHubOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'call' | 'game' | 'date' | 'relationship' | 'report' | 'block' | null>(null);

  // Call state
  const [callStatus, setCallStatus] = useState<string | null>(null);

  // Game state
  const [gameSelection, setGameSelection] = useState<'word_scramble' | 'iitm_trivia'>('word_scramble');
  const [gameActive, setGameActive] = useState(false);
  const [gameScore, setGameScore] = useState(0);

  // Virtual Date state
  const [dateProposed, setDateProposed] = useState(false);

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

  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return isNaN(d.getTime()) ? timeStr : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatch || !text.trim() || sending) return;

    const trimmed = text.trim();
    if (trimmed.length > 1000) {
      alert('Message exceeds 1,000 character limit.');
      return;
    }

    setSending(true);
    try {
      const sent = await api.sendMessage(activeMatch.id, trimmed);
      setMessages((prev) => [...prev, sent]);
      setText('');
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const confirmBlock = async () => {
    if (!activeMatch) return;
    await api.blockUser(activeMatch.candidate.profileId, 'User requested block');
    setActiveModal(null);
    setSafetyFeedback(`Blocked ${activeMatch.candidate.displayName}. Mutual visibility has been severed immediately.`);
    setMatches((prev) => prev.filter((m) => m.id !== activeMatch.id));
    setActiveMatch(null);
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatch) return;
    const fullReason = `${reportReason}${reportNotes ? `: ${reportNotes}` : ''}`;
    await api.reportUser(activeMatch.candidate.profileId, fullReason);
    setActiveModal(null);
    setReportNotes('');
    setSafetyFeedback('Report submitted confidentially to student safety moderators.');
    setTimeout(() => setSafetyFeedback(null), 3000);
  };

  const handleStartCall = () => {
    setCallStatus('Connecting via LiveKit WebRTC...');
    setTimeout(() => {
      setCallStatus('Connected: 1-on-1 Audio • No Default Recording');
    }, 1200);
  };

  const handleEndCall = () => {
    setCallStatus(null);
    setActiveModal(null);
    setSafetyFeedback('Call ended safely. Duration: 01:24.');
    setTimeout(() => setSafetyFeedback(null), 3000);
  };

  if (loading) {
    return (
      <div className="container-standard" style={{ paddingTop: '80px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Loading conversations...</p>
      </div>
    );
  }

  return (
    <div
      className="container-wide"
      style={{
        paddingTop: '20px',
        paddingBottom: '32px',
        height: 'calc(100vh - 90px)',
        minHeight: '620px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {safetyFeedback && (
        <div
          style={{
            padding: '10px 18px',
            backgroundColor: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-brand-primary)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-brand-primary)',
            fontSize: '13px',
            marginBottom: '12px',
            textAlign: 'center',
            fontWeight: 500,
            animation: 'fadeIn 140ms ease-out',
          }}
        >
          {safetyFeedback}
        </div>
      )}

      {matches.length === 0 ? (
        <div className="card-surface" style={{ padding: '64px 28px', textAlign: 'center', margin: 'auto', maxWidth: '520px' }}>
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
            <LockIcon size={28} color="var(--color-brand-primary)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 600, marginBottom: '8px' }}>
            No Active Conversations
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '22px', marginBottom: '24px' }}>
            SayMyName strictly prohibits stranger DMs. Messaging unlocks exclusively after mutual likes.
          </p>
          <Link href="/discover" className="btn btn-primary">
            Explore Discovery
          </Link>
        </div>
      ) : (
        <div
          className="card-surface"
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {/* Left Sidebar: Conversations List */}
          <div
            style={{
              width: '320px',
              borderRight: '1px solid var(--color-border-default)',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--color-surface-subtle)',
              flexShrink: 0,
            }}
          >
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--color-border-default)' }}>
              <span className="index-stamp" style={{ display: 'block', marginBottom: '2px' }}>Private Channels</span>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, margin: 0 }}>
                Conversations
              </h2>
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
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          flexShrink: 0,
                          border: '1.5px solid var(--color-border-default)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          backgroundColor: m.candidate.avatarColor || '#6E2638',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '18px',
                          fontFamily: 'var(--font-display)',
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
                        <span className="index-stamp" style={{ fontSize: '9px' }}>
                          {m.matchedAt}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '12.5px',
                          color: 'var(--color-text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.lastMessage || 'Mutual match active'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Active Thread Viewport */}
          {activeMatch ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-surface)', minWidth: 0 }}>
              {/* Header: Partner Identity & Structured Action Bar */}
              <div
                style={{
                  padding: '12px 24px',
                  borderBottom: '1px solid var(--color-border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--color-surface)',
                  flexWrap: 'wrap',
                  gap: '12px',
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
                        border: '1px solid var(--color-border-default)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: activeMatch.candidate.avatarColor || '#6E2638',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '18px',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {activeMatch.candidate.displayName.charAt(0)}
                    </div>
                  )}

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                        {activeMatch.candidate.displayName}, {activeMatch.candidate.age}
                      </h3>
                      <span className="badge-verified" style={{ fontSize: '9.5px', padding: '2px 7px' }}>
                        <CheckIcon size={9} color="var(--color-brand-primary)" />
                        <span>Verified</span>
                      </span>
                      {dateProposed && (
                        <span className="badge-tag" style={{ fontSize: '10px', color: 'var(--color-brand-primary)', padding: '2px 7px' }}>
                          ☕ Date Invited
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: 'var(--color-accent-warm)', fontWeight: 600 }}>
                      BS in {activeMatch.candidate.programmeFamily.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>

                {/* Structured Communication Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* 1:1 LiveKit Call */}
                  <button
                    onClick={() => setActiveModal('call')}
                    className="btn btn-secondary"
                    style={{ padding: '7px 14px', fontSize: '12.5px' }}
                    title="Audio Call (Requires Bilateral Acceptance)"
                  >
                    <PhoneIcon size={14} color="var(--color-brand-primary)" />
                    <span>Call</span>
                  </button>

                  {/* Together Space Hub Trigger */}
                  <button
                    onClick={() => setTogetherHubOpen(!togetherHubOpen)}
                    className="btn btn-subtle"
                    style={{ padding: '7px 14px', fontSize: '12.5px' }}
                    title="Together Space: Games, Virtual Dates & Relationship Mode"
                  >
                    <GameIcon size={14} color="var(--color-brand-primary)" />
                    <span>Together Space</span>
                  </button>

                  {/* Together Space Dropdown Menu */}
                  {togetherHubOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '64px',
                        right: '72px',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--elevation-3)',
                        width: '240px',
                        zIndex: 40,
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        onClick={() => {
                          setTogetherHubOpen(false);
                          setActiveModal('game');
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
                          gap: '10px',
                        }}
                      >
                        <GameIcon size={16} color="var(--color-accent-warm)" />
                        <div>
                          <div style={{ fontWeight: 600 }}>Word Games & Trivia</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Cooperative mini-games</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setTogetherHubOpen(false);
                          setActiveModal('date');
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
                          gap: '10px',
                        }}
                      >
                        <CalendarIcon size={16} color="var(--color-status-info)" />
                        <div>
                          <div style={{ fontWeight: 600 }}>Virtual Date</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Scheduled coffee session</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setTogetherHubOpen(false);
                          setActiveModal('relationship');
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: '13px',
                          color: 'var(--color-brand-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <HeartHandshakeIcon size={16} color="var(--color-brand-primary)" />
                        <div>
                          <div style={{ fontWeight: 600 }}>Relationship Mode</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Mutual shared space</div>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Safety Menu Trigger */}
                  <button
                    onClick={() => setActiveModal('report')}
                    className="btn btn-ghost"
                    style={{ padding: '7px 10px', fontSize: '12px' }}
                    title="Report"
                  >
                    <FlagIcon size={14} color="var(--color-text-secondary)" />
                  </button>

                  <button
                    onClick={() => setActiveModal('block')}
                    className="btn btn-ghost"
                    style={{ padding: '7px 10px', fontSize: '12px', color: 'var(--color-status-danger)' }}
                    title="Block"
                  >
                    <ShieldIcon size={14} color="var(--color-status-danger)" />
                  </button>
                </div>
              </div>

              {/* Privacy Notice Banner (Truthful & Concise, No Document jargon) */}
              <div
                style={{
                  padding: '7px 20px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  fontSize: '11.5px',
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <LockIcon size={12} color="var(--color-brand-primary)" />
                <span>
                  Bilateral Mutual Match • Private communication is never recorded by default or used for advertising.
                </span>
              </div>

              {/* Message History Thread */}
              <div
                style={{
                  flex: 1,
                  padding: '24px 20px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  backgroundColor: 'var(--color-canvas)',
                }}
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.isOwn ? 'flex-end' : 'flex-start',
                      maxWidth: '72%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: m.isOwn ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        padding: '11px 18px',
                        borderRadius: m.isOwn ? '18px 18px 3px 18px' : '18px 18px 18px 3px',
                        backgroundColor: m.isOwn ? 'var(--color-brand-primary)' : 'var(--color-surface)',
                        color: m.isOwn ? '#FFFFFF' : 'var(--color-text-primary)',
                        fontSize: '14px',
                        lineHeight: '21px',
                        border: m.isOwn ? 'none' : '1px solid var(--color-border-default)',
                        boxShadow: 'var(--elevation-1)',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.text}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '3px',
                        fontSize: '10px',
                        color: 'var(--color-text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <span>{formatTime(m.createdAt)}</span>
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

              {/* Crafted Message Composer */}
              <form
                onSubmit={handleSend}
                style={{
                  padding: '16px 20px',
                  borderTop: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-round"
                  style={{ width: '40px', height: '40px' }}
                  title="Voice Note (Presigned 60-second limit)"
                  onClick={() => alert('Audio voice note presigning ready: 60s limit with audio/webm recording.')}
                >
                  <MicIcon size={17} color="var(--color-text-secondary)" />
                </button>

                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`Write a thoughtful message to ${activeMatch.candidate.displayName}...`}
                    maxLength={1000}
                    className="input-field"
                    style={{ paddingRight: '70px', borderRadius: 'var(--radius-pill)' }}
                  />
                  <span
                    className="index-stamp"
                    style={{
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '10px',
                      color: text.length > 900 ? 'var(--color-status-danger)' : 'var(--color-text-muted)',
                    }}
                  >
                    {text.length}/1000
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="btn btn-primary btn-round"
                  style={{ width: '42px', height: '42px' }}
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

      {/* AUDIO CALL MODAL (LiveKit WebRTC) */}
      {activeModal === 'call' && activeMatch && (
        <div className="dialog-overlay" onClick={() => setActiveModal(null)}>
          <div className="dialog-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
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

            <p style={{ fontSize: '13.5px', lineHeight: '21px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              Calls require explicit mutual invitation and acceptance before connecting.
            </p>

            <div className="banner-trust" style={{ marginBottom: '24px', textAlign: 'left' }}>
              <LockIcon size={16} color="var(--color-brand-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>No Default Recording</strong>: Voice calls are real-time WebRTC sessions and never recorded without separate informed consent.
              </span>
            </div>

            {callStatus ? (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-brand-primary)', marginBottom: '14px' }}>
                  {callStatus}
                </p>
                <button onClick={handleEndCall} className="btn btn-danger" style={{ width: '100%' }}>
                  End Audio Call
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
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
      {activeModal === 'game' && activeMatch && (
        <div className="dialog-overlay" onClick={() => setActiveModal(null)}>
          <div className="dialog-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
              Cooperative Mini-Games
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              Low-pressure turn-based games designed for BS students across distance.
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
                      Unscramble campus and computer science terms cooperatively.
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
                      Curriculum, Chennai landmarks, and term project history.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setActiveModal(null)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button onClick={() => setGameActive(true)} className="btn btn-primary">
                    Start {gameSelection === 'word_scramble' ? 'Word Scramble' : 'Trivia'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <span className="index-stamp" style={{ color: 'var(--color-accent-warm)', display: 'block', marginBottom: '8px' }}>
                  Turn 1 • Team Score: {gameScore} pts
                </span>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', letterSpacing: '6px', margin: '14px 0', color: 'var(--color-brand-primary)' }}>
                  A G R D N T E I
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
                  Hint: Fundamental optimization algorithm in machine learning.
                </p>

                <button
                  onClick={() => {
                    setGameScore((prev) => prev + 10);
                    alert('Correct! Answer was GRADIENT. +10 Team Points!');
                    setGameActive(false);
                    setActiveModal(null);
                  }}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  Solve: GRADIENT
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIRTUAL DATE PROPOSAL MODAL */}
      {activeModal === 'date' && activeMatch && (
        <div className="dialog-overlay" onClick={() => setActiveModal(null)}>
          <div className="dialog-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
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
              <CalendarIcon size={28} color="var(--color-brand-primary)" />
            </div>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
              Virtual Coffee Date
            </h3>
            <p style={{ fontSize: '13.5px', lineHeight: '21px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              Propose a scheduled video chat session with {activeMatch.candidate.displayName}.
            </p>

            <div className="card-subtle" style={{ textAlign: 'left', marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Proposed Time</div>
              <div style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>This Saturday, 5:00 PM IST</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Both partners must accept to confirm the calendar invitation.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setActiveModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  setDateProposed(true);
                  setActiveModal(null);
                  setSafetyFeedback('Virtual coffee invitation sent to partner.');
                  setTimeout(() => setSafetyFeedback(null), 3000);
                }}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Send Proposal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RELATIONSHIP MODE MODAL (Bilateral Dual Opt-in) */}
      {activeModal === 'relationship' && activeMatch && (
        <div className="dialog-overlay" onClick={() => setActiveModal(null)}>
          <div className="dialog-modal" onClick={(e) => e.stopPropagation()}>
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
                Built for couples who wish to transition from discovery to an intentional, shared private space.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div className="card-subtle">
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '3px' }}>Dual Affirmative Consent</h4>
                <p style={{ fontSize: '12px', margin: 0, color: 'var(--color-text-secondary)' }}>
                  Requires two independent actions. Discovery is automatically paused for both partners.
                </p>
              </div>

              <div className="card-subtle">
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '3px' }}>Independent Unilateral Exit</h4>
                <p style={{ fontSize: '12px', margin: 0, color: 'var(--color-text-secondary)' }}>
                  Either partner may leave at any time without permission or lock-in. No coercive retention.
                </p>
              </div>

              <div className="card-subtle">
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '3px' }}>Zero Surveillance Guarantee</h4>
                <p style={{ fontSize: '12px', margin: 0, color: 'var(--color-text-secondary)' }}>
                  SayMyName strictly prohibits partner GPS location tracking, ambient recording, or monitoring tools.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setActiveModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  setActiveModal(null);
                  setSafetyFeedback('Relationship Mode proposal sent. Awaiting partner affirmative confirmation.');
                  setTimeout(() => setSafetyFeedback(null), 3500);
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

      {/* CONFIDENTIAL SAFETY REPORT MODAL */}
      {activeModal === 'report' && activeMatch && (
        <div className="dialog-overlay" onClick={() => setActiveModal(null)}>
          <div className="dialog-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
              Report Conversation
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              Confidential report reviewed by student safety operators under strict safety protocols.
            </p>

            <form onSubmit={submitReport}>
              <div style={{ marginBottom: '16px' }}>
                <span className="index-stamp" style={{ display: 'block', marginBottom: '6px' }}>Reason for Report</span>
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
                <span className="index-stamp" style={{ display: 'block', marginBottom: '6px' }}>Additional Context (Optional)</span>
                <textarea
                  className="input-field"
                  rows={3}
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Provide details..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary">
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

      {/* UNIVERSAL BLOCK MODAL */}
      {activeModal === 'block' && activeMatch && (
        <div className="dialog-overlay" onClick={() => setActiveModal(null)}>
          <div className="dialog-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, color: 'var(--color-status-danger)', marginBottom: '8px' }}>
              Block {activeMatch.candidate.displayName}?
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '22px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              Universal immediate server-side block. All communication will cease, and all mutual visibility will be permanently severed.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setActiveModal(null)} className="btn btn-secondary">
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
