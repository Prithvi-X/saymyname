'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  HeartIcon,
  XIcon,
  CheckIcon,
  SparklesIcon,
  LockIcon,
} from '../../components/icons';

interface PendingLike {
  id: string;
  profileId: string;
  candidateName: string;
  age: number;
  programme: string;
  term: string;
  likedAt: string;
  photoUrl: string;
  promptText: string;
  promptAnswer: string;
}

export default function LikesPage() {
  const router = useRouter();

  const [likes, setLikes] = useState<PendingLike[]>([
    {
      id: 'like-preview-1',
      profileId: 'cand-003',
      candidateName: 'Sneha',
      age: 20,
      programme: 'BS in Aeronautics & Space Tech',
      term: 'Foundation Level • Term 2',
      likedAt: '2 hours ago',
      photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
      promptText: 'Best way to spend a Saturday...',
      promptAnswer: 'Tracing constellations away from city light pollution and talking about where we want to be in five years.',
    },
  ]);

  const [matchModal, setMatchModal] = useState<{
    isOpen: boolean;
    candidateName?: string;
  }>({ isOpen: false });

  const handleLikeBack = (like: PendingLike) => {
    setMatchModal({
      isOpen: true,
      candidateName: like.candidateName,
    });
    setLikes((prev) => prev.filter((l) => l.id !== like.id));
  };

  const handlePassLike = (likeId: string) => {
    setLikes((prev) => prev.filter((l) => l.id !== likeId));
  };

  return (
    <div className="container-standard" style={{ paddingTop: '32px', paddingBottom: '64px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="index-stamp">Inbound Interest</span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>•</span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            {likes.length} pending
          </span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 600, margin: '0 0 6px 0' }}>
          Likes Received
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Verified BS peers who appreciated your profile. Liking them back creates an active mutual match and unlocks private messaging.
        </p>
      </div>

      {likes.length === 0 ? (
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
            <HeartIcon size={28} color="var(--color-brand-primary)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 600, margin: '0 0 8px 0' }}>
            No Pending Likes
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', maxWidth: '400px', margin: '0 auto 24px auto', lineHeight: '22px' }}>
            When a verified peer expresses interest in your profile, they will appear here. In the meantime, explore your daily discovery batch.
          </p>
          <Link href="/discover" className="btn btn-primary">
            Explore Discovery
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {likes.map((l) => (
            <div key={l.id} className="card-surface" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <img
                    src={l.photoUrl}
                    alt={l.candidateName}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1.5px solid var(--color-border-default)',
                    }}
                  />

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, margin: 0 }}>
                        {l.candidateName}, {l.age}
                      </h2>
                      <span className="badge-verified">
                        <CheckIcon size={10} color="var(--color-brand-primary)" />
                        <span>Verified</span>
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--color-accent-warm)', fontWeight: 600 }}>
                      {l.programme} • {l.term}
                    </p>
                  </div>
                </div>

                <span className="index-stamp" style={{ alignSelf: 'center' }}>
                  Received {l.likedAt}
                </span>
              </div>

              {/* What they liked: Conversation Prompt */}
              <div className="quote-card" style={{ marginBottom: '20px' }}>
                <span className="index-stamp" style={{ color: 'var(--color-accent-warm)', display: 'block', marginBottom: '4px' }}>
                  Liked Your Prompt: {l.promptText}
                </span>
                <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '16px', lineHeight: '24px', color: 'var(--color-text-primary)' }}>
                  "{l.promptAnswer}"
                </p>
              </div>

              {/* Understandable Action Bar: Like Back (triggers mutual match) or Pass */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '16px' }}>
                <button
                  onClick={() => handlePassLike(l.id)}
                  className="btn btn-secondary"
                  style={{ padding: '8px 18px', fontSize: '13px' }}
                >
                  <XIcon size={14} color="var(--color-text-secondary)" />
                  <span>Pass</span>
                </button>

                <button
                  onClick={() => handleLikeBack(l)}
                  className="btn btn-primary"
                  style={{ padding: '8px 22px', fontSize: '13px' }}
                >
                  <HeartIcon size={15} color="#FFFFFF" fill="#FFFFFF" />
                  <span>Like Back to Match</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mutual Match Celebration Dialog */}
      {matchModal.isOpen && (
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
              Both you and <strong style={{ color: 'var(--color-text-primary)' }}>{matchModal.candidateName}</strong> liked each other. Private bilateral conversation is now unlocked.
            </p>

            <div className="banner-trust" style={{ marginBottom: '24px', textAlign: 'left' }}>
              <LockIcon size={16} color="var(--color-brand-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>SayMyName Invariant</strong>: Private communication is strictly bilateral between verified matches. No stranger DMs or unsolicited calls are ever permitted.
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  setMatchModal({ isOpen: false });
                  router.push('/chats');
                }}
                className="btn btn-primary"
                style={{ width: '100%', padding: '13px' }}
              >
                Go to Messages
              </button>
              <button
                onClick={() => setMatchModal({ isOpen: false })}
                className="btn btn-ghost"
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
