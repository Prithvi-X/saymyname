'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import {
  CheckIcon,
  ShieldIcon,
} from '../../../components/icons';

export default function ProfilePage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState('Arun Kumar');
  const [bio, setBio] = useState('BS Data Science student exploring deep learning, collaborative word games, and quiet filter coffee conversations.');
  const [isDiscoveryPaused, setIsDiscoveryPaused] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    '☕ Filter Coffee',
    '🎬 Cinema',
    '🧩 Word Games',
    '📊 ML Models',
  ]);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const availableInterests = [
    '☕ Filter Coffee',
    '🎬 Cinema',
    '🧩 Word Games',
    '📊 ML Models',
    '⚡ Microcontrollers',
    '📚 Speculative Sci-Fi',
    '🏸 Badminton',
    '🚀 Orbital Dynamics',
    '♟️ Chess',
    '🍵 Earl Grey',
  ];

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      if (selectedInterests.length < 5) {
        setSelectedInterests([...selectedInterests, interest]);
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveFeedback('Profile updated successfully.');
    setTimeout(() => setSaveFeedback(null), 2500);
  };

  const handleLogout = () => {
    api.clearToken();
    router.push('/');
  };

  return (
    <div className="mobile-app-layout" style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px 48px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 600, margin: '0 0 4px 0' }}>
          My Profile & Settings
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Manage your verified student profile and dating preferences
        </p>
      </div>

      {saveFeedback && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-status-success)',
            color: 'var(--color-status-success)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '20px',
            textAlign: 'center',
            animation: 'fadeIn 150ms ease-out',
          }}
        >
          {saveFeedback}
        </div>
      )}

      {/* Verified Student Identity Card */}
      <div className="card-editorial" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '20px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-brand-primary)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(122, 48, 69, 0.25)',
              flexShrink: 0,
            }}
          >
            {displayName.charAt(0)}
          </div>

          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 600, margin: '0 0 6px 0' }}>
              {displayName}, 22
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="badge-verified">
                <CheckIcon size={12} color="var(--color-brand-primary)" />
                <span>Verified</span>
              </span>
              <span
                className="badge-tag"
                style={{
                  color: 'var(--color-accent-warm)',
                  fontWeight: 600,
                  fontSize: '11px',
                }}
              >
                BS Data Science Enrolled
              </span>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Institutional Email:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>21f1000001@ds.study.iitm.ac.in</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Programme Family:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>BS in Data Science & Applications</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Student Roll No:</span>
            <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>21F1000001</span>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
        <div className="card-editorial" style={{ padding: '28px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, margin: '0 0 20px 0' }}>
            Edit Profile Details
          </h3>

          <div style={{ marginBottom: '20px' }}>
            <label className="label-editorial">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-editorial"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="label-editorial">About Me (Bio)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 500))}
              rows={3}
              className="input-editorial"
              style={{ resize: 'vertical' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', textAlign: 'right', marginTop: '4px' }}>
              {500 - bio.length} characters remaining
            </span>
          </div>

          <div>
            <label className="label-editorial">Interests & Academic Passions (Select up to 5)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {availableInterests.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <button
                    type="button"
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className="badge-tag"
                    style={{
                      border: isSelected ? '1.5px solid var(--color-brand-primary)' : '1px solid var(--color-border-default)',
                      backgroundColor: isSelected ? 'var(--color-brand-primary-subtle)' : 'var(--color-surface-subtle)',
                      color: isSelected ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                      fontWeight: isSelected ? 600 : 500,
                    }}
                  >
                    {interest} {isSelected && '✓'}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <button type="submit" className="btn btn-primary">
              Save Profile Changes
            </button>
          </div>
        </div>
      </form>

      {/* Safety & Discovery Settings */}
      <div className="card-editorial" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, margin: 0 }}>
          Privacy & Account Controls
        </h3>

        {/* Pause Discovery Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 2px 0' }}>Pause Discovery</h4>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', maxWidth: '420px', lineHeight: '18px' }}>
              Temporarily hide your profile from new candidate cards. Existing matches and chats remain active.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDiscoveryPaused(!isDiscoveryPaused)}
            className={isDiscoveryPaused ? 'btn btn-subtle' : 'btn btn-secondary'}
            style={{ padding: '6px 16px', fontSize: '12px' }}
          >
            {isDiscoveryPaused ? '✓ Paused' : 'Active'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: '18px', display: 'flex', gap: '12px' }}>
          <Link
            href="/safety"
            className="btn btn-secondary"
            style={{ flex: 1, padding: '10px 16px', fontSize: '13px' }}
          >
            <ShieldIcon size={15} color="var(--color-brand-primary)" />
            <span>Safety Commitments</span>
          </Link>

          <button
            onClick={handleLogout}
            className="btn btn-danger"
            style={{ flex: 1, padding: '10px 16px', fontSize: '13px' }}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
