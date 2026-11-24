'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, MatchProfile, ChatMessage } from '../../../lib/api';

function ChatsContent() {
  const searchParams = useSearchParams();
  const matchIdParam = searchParams.get('matchId');

  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [activeMatch, setActiveMatch] = useState<MatchProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionModal, setActionModal] = useState<{ type: 'call' | 'game' | 'relationship'; isOpen: boolean } | null>(null);
  const [safetyFeedback, setSafetyFeedback] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const list = await api.getMatches();
        setMatches(list);

        if (list.length > 0) {
          const selected = matchIdParam ? list.find((m) => m.id === matchIdParam) || list[0] : list[0];
          setActiveMatch(selected);
          const msgs = await api.getMessages(selected.id);
          setMessages(msgs);
        }
      } catch (err) {
        console.error('Failed to load chats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [matchIdParam]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectConversation = async (match: MatchProfile) => {
    setActiveMatch(match);
    const msgs = await api.getMessages(match.id);
    setMessages(msgs);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeMatch || sending) return;

    const text = inputText;
    setInputText('');
    setSending(true);

    try {
      const sentMsg = await api.sendMessage(activeMatch.id, text);
      setMessages((prev) => [...prev, sentMsg]);

      // Poll for response after 2 seconds
      setTimeout(async () => {
        const refreshed = await api.getMessages(activeMatch.id);
        setMessages(refreshed);
      }, 1800);
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleBlock = async () => {
    if (!activeMatch) return;
    const confirm = window.confirm(`Universal Block: Block ${activeMatch.candidate.displayName}? Communication will end immediately.`);
    if (!confirm) return;

    await api.blockUser(activeMatch.candidate.profileId, 'User requested block');
    setSafetyFeedback(`Blocked ${activeMatch.candidate.displayName}. All mutual visibility has been permanently severed.`);
    setMatches((prev) => prev.filter((m) => m.id !== activeMatch.id));
    setActiveMatch(null);
  };

  const handleReport = async () => {
    if (!activeMatch) return;
    const reason = window.prompt('Report reason:');
    if (!reason) return;

    await api.reportUser(activeMatch.candidate.profileId, reason);
    setSafetyFeedback('Report submitted confidentially to safety team.');
    setTimeout(() => setSafetyFeedback(null), 3000);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading conversations...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '16px', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      {safetyFeedback && (
        <div
          style={{
            padding: '12px 16px',
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
        <div
          style={{
            margin: 'auto',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface)',
            padding: '48px 24px',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border-default)',
            maxWidth: '440px',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0' }}>
            No Active Conversations
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '22px', marginBottom: '24px' }}>
            In accordance with Document 01 §3.6, SayMyName does not support stranger DMs. Messaging unlocks strictly after mutual likes.
          </p>
          <Link
            href="/discover"
            style={{
              padding: '10px 24px',
              backgroundColor: 'var(--color-brand-primary)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-pill)',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Go to Discover
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flex: 1,
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border-default)',
            overflow: 'hidden',
            boxShadow: 'var(--elevation-2)',
          }}
        >
          {/* Left Sidebar: Conversations List */}
          <div
            style={{
              width: '280px',
              borderRight: '1px solid var(--color-border-default)',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--color-surface-subtle)',
            }}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border-default)' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Chats
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                Bilateral Mutual Matches Only
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {matches.map((m) => {
                const isSelected = activeMatch?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => selectConversation(m)}
                    style={{
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--color-surface)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--color-brand-primary)' : '3px solid transparent',
                      transition: 'background-color var(--duration-fast) var(--ease-out)',
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-pill)',
                        backgroundColor: m.candidate.avatarColor || '#2B4C7E',
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

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {m.candidate.displayName}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Today</span>
                      </div>
                      <p
                        style={{
                          margin: '2px 0 0 0',
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
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: activeMatch.candidate.avatarColor || '#2B4C7E',
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
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                      {activeMatch.candidate.displayName}, {activeMatch.candidate.age}
                    </h3>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-accent-warm)', fontWeight: 600 }}>
                      BS in {activeMatch.candidate.programmeFamily.replace('_', ' ')} • Verified
                    </p>
                  </div>
                </div>

                {/* Safety & Action Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setActionModal({ type: 'call', isOpen: true })}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--color-surface-subtle)',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    title="Invite to Audio/Video Call (Requires Acceptance)"
                  >
                    📞 Call
                  </button>

                  <button
                    onClick={() => setActionModal({ type: 'game', isOpen: true })}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--color-surface-subtle)',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    title="Invite to Word Game (Requires Acceptance)"
                  >
                    🎮 Game
                  </button>

                  <button
                    onClick={() => setActionModal({ type: 'relationship', isOpen: true })}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--color-brand-primary-subtle)',
                      border: '1px solid var(--color-brand-primary)',
                      color: 'var(--color-brand-primary)',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    title="Relationship Mode (Bilateral Activation)"
                  >
                    ❤️
                  </button>

                  <button
                    onClick={handleReport}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-secondary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                    title="Report Conversation"
                  >
                    🚩 Report
                  </button>

                  <button
                    onClick={handleBlock}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'var(--color-status-danger)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    title="Block User Immediately"
                  >
                    🚫 Block
                  </button>
                </div>
              </div>

              {/* Invariant Banner */}
              <div
                style={{
                  padding: '6px 16px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  borderBottom: '1px solid var(--color-border-default)',
                  fontSize: '11px',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'center',
                }}
              >
                🔒 End-to-End Encrypted • Private messages and calls are never used for advertising or model training (Doc 01 §3.7).
              </div>

              {/* Messages Container */}
              <div
                style={{
                  flex: 1,
                  padding: '20px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: '#FAF8F5',
                }}
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.isOwn ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '70%',
                        padding: '12px 16px',
                        borderRadius: msg.isOwn ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                        backgroundColor: msg.isOwn ? 'var(--color-brand-primary)' : 'var(--color-surface)',
                        color: msg.isOwn ? '#FFFFFF' : 'var(--color-text-primary)',
                        border: msg.isOwn ? 'none' : '1px solid var(--color-border-default)',
                        boxShadow: 'var(--elevation-1)',
                        fontSize: '14px',
                        lineHeight: '20px',
                      }}
                    >
                      {msg.text}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                      <span>{msg.createdAt}</span>
                      {msg.isOwn && <span>• {msg.deliveryState === 'read' ? '✓✓ Read' : '✓ Sent'}</span>}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <form
                onSubmit={handleSend}
                style={{
                  padding: '14px 20px',
                  borderTop: '1px solid var(--color-border-default)',
                  backgroundColor: 'var(--color-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value.slice(0, 1000))}
                    placeholder="Type a message (max 1,000 characters)..."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: 'var(--color-surface-subtle)',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                  {inputText.length > 800 && (
                    <span style={{ position: 'absolute', right: '14px', top: '13px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {1000 - inputText.length}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  style={{
                    padding: '12px 22px',
                    backgroundColor: inputText.trim() && !sending ? 'var(--color-brand-primary)' : 'var(--color-surface-subtle)',
                    color: inputText.trim() && !sending ? '#FFFFFF' : 'var(--color-text-secondary)',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: inputText.trim() && !sending ? 'pointer' : 'default',
                    transition: 'all var(--duration-fast) var(--ease-out)',
                  }}
                >
                  Send
                </button>
              </form>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
              Select a conversation to begin chatting
            </div>
          )}
        </div>
      )}

      {/* Bilateral Action Modal (Calls, Games, Relationship Mode) */}
      {actionModal?.isOpen && (
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
              maxWidth: '460px',
              width: '100%',
              padding: '32px 28px',
              boxShadow: 'var(--elevation-3)',
              border: '1px solid var(--color-border-default)',
              textAlign: 'center',
            }}
          >
            {actionModal.type === 'call' && (
              <>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>📞</div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0' }}>
                  Propose Private Call
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '22px', marginBottom: '16px' }}>
                  Per Document 01 §3.7, calls require explicit invitation and acceptance before connecting. Calls are WebRTC encrypted and <strong>never recorded by default</strong>.
                </p>
                <div style={{ padding: '12px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                  An invitation will be sent to {activeMatch?.candidate.displayName}. The call only starts if they accept.
                </div>
              </>
            )}

            {actionModal.type === 'game' && (
              <>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎮</div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0' }}>
                  Invite to Word Puzzle
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '22px', marginBottom: '16px' }}>
                  Play a cooperative 5-minute BS-themed vocabulary puzzle together. Games require bilateral acceptance (Document 01 §3.7).
                </p>
                <div style={{ padding: '12px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                  Invitation expires in 10 minutes if not accepted.
                </div>
              </>
            )}

            {actionModal.type === 'relationship' && (
              <>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>❤️</div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0' }}>
                  Propose Relationship Mode
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: '22px', marginBottom: '16px' }}>
                  Relationship Mode pauses discovery for both partners and creates a shared digital space.
                </p>
                <div style={{ padding: '12px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '24px', textAlign: 'left' }}>
                  🔒 <strong>Non-Negotiable Invariants (Doc 01 §3.8)</strong>:
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px' }}>
                    <li>Requires two independent affirmative actions.</li>
                    <li>Either partner can exit independently at any time.</li>
                    <li><strong>No partner surveillance or GPS tracking</strong> is permitted.</li>
                  </ul>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setActionModal(null);
                  alert('Invitation sent! Waiting for partner acceptance.');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'var(--color-brand-primary)',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Send Invitation
              </button>
              <button
                onClick={() => setActionModal(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  color: 'var(--color-text-secondary)',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--color-border-default)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
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
    <Suspense
      fallback={
        <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>Loading conversations...</p>
        </div>
      }
    >
      <ChatsContent />
    </Suspense>
  );
}
