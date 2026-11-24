'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

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
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px 80px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--color-text-primary)' }}>
          My Profile & Settings
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Manage your verified student profile and dating preferences
        </p>
      </div>

      {saveFeedback && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-status-success)',
            color: 'var(--color-status-success)',
            borderRadius: 'var(--radius-md)',
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          {saveFeedback}
        </div>
      )}

      {/* Verified Student Identity Card */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
          padding: '24px',
          boxShadow: 'var(--elevation-1)',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--color-brand-primary)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 700,
            }}
          >
            {displayName.charAt(0)}
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0' }}>
              {displayName}, 22
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '2px 8px',
                  backgroundColor: 'var(--color-brand-primary-subtle)',
                  color: 'var(--color-brand-primary)',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                ✓ Verified
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  color: 'var(--color-accent-warm)',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                ✓ BS Data Science Enrolled
              </span>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border-default)',
            padding: '24px',
            boxShadow: 'var(--elevation-1)',
          }}
        >
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>
            Edit Profile Details
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-subtle)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              About Me (Bio)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 500))}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
                backgroundColor: 'var(--color-surface-subtle)',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', textAlign: 'right' }}>
              {500 - bio.length} characters remaining
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              Interests & Academic Passions (Select up to 5)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {availableInterests.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <button
                    type="button"
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-pill)',
                      border: isSelected ? '1px solid var(--color-brand-primary)' : '1px solid var(--color-border-default)',
                      backgroundColor: isSelected ? 'var(--color-brand-primary-subtle)' : 'var(--color-surface-subtle)',
                      color: isSelected ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {interest} {isSelected ? '✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button
              type="submit"
              style={{
                padding: '10px 24px',
                backgroundColor: 'var(--color-brand-primary)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Save Profile Changes
            </button>
          </div>
        </div>
      </form>

      {/* Safety & Discovery Settings */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border-default)',
          padding: '24px',
          boxShadow: 'var(--elevation-1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, margin: 0 }}>
          Privacy & Account Controls
        </h3>

        {/* Pause Discovery Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 2px 0' }}>Pause Discovery</h4>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Temporarily hide your profile from new candidate cards. Existing matches remain active.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDiscoveryPaused(!isDiscoveryPaused)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              border: isDiscoveryPaused ? '1px solid var(--color-status-success)' : '1px solid var(--color-border-default)',
              backgroundColor: isDiscoveryPaused ? 'var(--color-surface-subtle)' : 'var(--color-surface-subtle)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isDiscoveryPaused ? '✓ Paused' : 'Active'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border-default)', paddingTop: '14px', display: 'flex', gap: '12px' }}>
          <Link
            href="/safety"
            style={{
              flex: 1,
              padding: '10px',
              textAlign: 'center',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              textDecoration: 'none',
            }}
          >
            🛡️ Safety Commitments
          </Link>

          <button
            onClick={handleLogout}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-status-danger)',
              cursor: 'pointer',
            }}
          >
            🚪 Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
