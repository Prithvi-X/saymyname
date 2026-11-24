'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import {
  CheckIcon,
  ShieldIcon,
  LockIcon,
  InfoIcon,
  PinIcon,
  UserIcon,
} from '../../../components/icons';

const PROGRAMME_OPTIONS = [
  { value: 'data_science_applications', label: 'BS in Data Science and Applications' },
  { value: 'electronic_systems', label: 'BS in Electronic Systems' },
  { value: 'aeronautics_space', label: 'BS in Aeronautics and Space Technology' },
  { value: 'management_data_science', label: 'BS in Management and Data Science' },
];

const AVAILABLE_INTERESTS = [
  '☕ Filter Coffee',
  '🎬 World Cinema',
  '🧩 Word Games',
  '📊 Machine Learning',
  '⚡ Embedded Systems',
  '📚 Speculative Fiction',
  '🏸 Badminton',
  '🚀 Orbital Mechanics',
  '♟️ Chess',
  '🍵 Earl Grey',
  '🎧 Synthwave & Lo-Fi',
  '🌱 Urban Gardening',
  '🚲 Night Cycling',
  '✍️ Creative Writing',
];

export default function ProfilePage() {
  const router = useRouter();

  // Tab State: 'public' | 'private'
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');

  // Public Profile State
  const [displayName, setDisplayName] = useState('Arun Kumar');
  const [age] = useState(22); // Verified at onboarding
  const [programmeFamily, setProgrammeFamily] = useState('data_science_applications');
  const [currentTerm, setCurrentTerm] = useState('Diploma Level • Term 5');
  const [locationCity, setLocationCity] = useState('Bengaluru, Karnataka');
  const [bio, setBio] = useState('BS Data Science student exploring deep learning, collaborative word games, and quiet filter coffee conversations.');
  const [photoUrl, setPhotoUrl] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    '☕ Filter Coffee',
    '🎬 World Cinema',
    '🧩 Word Games',
    '📊 Machine Learning',
  ]);
  const [promptQuestion, setPromptQuestion] = useState('My ideal offline conversation is over...');
  const [promptAnswer, setPromptAnswer] = useState('South Indian filter coffee at 7 AM discussing whether transformers actually understand semantics.');

  // Private Settings State
  const [isDiscoveryPaused, setIsDiscoveryPaused] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

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
    setSaveFeedback('Public profile successfully updated.');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleLogout = () => {
    api.clearToken();
    router.push('/');
  };

  const selectedProgrammeLabel =
    PROGRAMME_OPTIONS.find((p) => p.value === programmeFamily)?.label || 'BS in Data Science and Applications';

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '28px 16px 64px 16px' }}>
      {/* Editorial Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="index-stamp" style={{ color: 'var(--color-brand-primary)' }}>
            STUDENT PROFILE • PHASE 1
          </span>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '32px',
            fontWeight: 600,
            margin: '0 0 6px 0',
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          Profile & Account Settings
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0, maxWidth: '640px' }}>
          Manage your verified presence seen by peers in daily discovery, and review your confidential student verification vault.
        </p>
      </div>

      {/* Segmented Tab Bar */}
      <div
        role="tablist"
        aria-label="Profile Sections"
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid var(--color-border-default)',
          marginBottom: '28px',
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === 'public'}
          onClick={() => setActiveTab('public')}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: activeTab === 'public' ? 600 : 500,
            color: activeTab === 'public' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'public' ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
            marginBottom: '-1px',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'color var(--duration-fast)',
          }}
        >
          <UserIcon size={16} color={activeTab === 'public' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)'} />
          <span>Public Profile & Discovery Card</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'private'}
          onClick={() => setActiveTab('private')}
          style={{
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: activeTab === 'private' ? 600 : 500,
            color: activeTab === 'private' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
            borderBottom: activeTab === 'private' ? '2px solid var(--color-brand-primary)' : '2px solid transparent',
            marginBottom: '-1px',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'color var(--duration-fast)',
          }}
        >
          <LockIcon size={16} color={activeTab === 'private' ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)'} />
          <span>Confidential Verification & Privacy</span>
        </button>
      </div>

      {saveFeedback && (
        <div
          role="status"
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-status-success)',
            color: 'var(--color-status-success)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '24px',
            textAlign: 'center',
            boxShadow: 'var(--elevation-1)',
            animation: 'fadeIn 140ms ease-out',
          }}
        >
          ✓ {saveFeedback}
        </div>
      )}

      {/* TAB 1: PUBLIC PROFILE & DISCOVERY CARD */}
      {activeTab === 'public' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
            gap: '32px',
            alignItems: 'start',
          }}
          className="desktop-split-grid"
        >
          {/* Left Column: Profile Form */}
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Basic Info Card */}
            <div className="card-surface" style={{ padding: '28px' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '20px',
                  fontWeight: 600,
                  margin: '0 0 20px 0',
                  color: 'var(--color-text-primary)',
                }}
              >
                Essential Profile Details
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className="label-editorial" htmlFor="displayName">
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input-editorial"
                    required
                  />
                </div>

                <div>
                  <label className="label-editorial" htmlFor="verifiedAge">
                    Age (Verified)
                  </label>
                  <input
                    id="verifiedAge"
                    type="text"
                    value={`${age} years`}
                    disabled
                    className="input-editorial"
                    style={{ backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text-secondary)', cursor: 'not-allowed' }}
                    title="Age is verified upon registration and cannot be modified."
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="label-editorial" htmlFor="programmeFamily">
                  Academic Programme Track
                </label>
                <select
                  id="programmeFamily"
                  value={programmeFamily}
                  onChange={(e) => setProgrammeFamily(e.target.value)}
                  className="input-editorial"
                  style={{ cursor: 'pointer' }}
                >
                  {PROGRAMME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className="label-editorial" htmlFor="currentTerm">
                    Academic Level / Term
                  </label>
                  <input
                    id="currentTerm"
                    type="text"
                    value={currentTerm}
                    onChange={(e) => setCurrentTerm(e.target.value)}
                    placeholder="e.g. Foundation Level, Term 4"
                    className="input-editorial"
                  />
                </div>

                <div>
                  <label className="label-editorial" htmlFor="locationCity">
                    Location (City / State)
                  </label>
                  <input
                    id="locationCity"
                    type="text"
                    value={locationCity}
                    onChange={(e) => setLocationCity(e.target.value)}
                    placeholder="e.g. Bengaluru, Karnataka"
                    className="input-editorial"
                  />
                </div>
              </div>

              <div>
                <label className="label-editorial" htmlFor="portraitUrl">
                  Primary Portrait Photo (URL)
                </label>
                <input
                  id="portraitUrl"
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="input-editorial"
                />
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>
                  Natural, respectful portraits representing yourself work best. Avoid group photos or cartoon avatars.
                </span>
              </div>
            </div>

            {/* Bio & Passions Card */}
            <div className="card-surface" style={{ padding: '28px' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '20px',
                  fontWeight: 600,
                  margin: '0 0 20px 0',
                  color: 'var(--color-text-primary)',
                }}
              >
                Bio & Intellectual Passions
              </h2>

              <div style={{ marginBottom: '20px' }}>
                <label className="label-editorial" htmlFor="bioText">
                  Personal Bio (Max 500 characters)
                </label>
                <textarea
                  id="bioText"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 500))}
                  rows={3}
                  className="input-editorial"
                  style={{ resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Share your intellectual rhythm, remote study habits, or offline interests.
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                    {500 - bio.length} chars left
                  </span>
                </div>
              </div>

              <div>
                <label className="label-editorial">
                  Interests & Academic Passions (Select up to 5 • {selectedInterests.length}/5 selected)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {AVAILABLE_INTERESTS.map((interest) => {
                    const isSelected = selectedInterests.includes(interest);
                    return (
                      <button
                        type="button"
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className="badge-tag"
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-pill)',
                          border: isSelected
                            ? '1.5px solid var(--color-brand-primary)'
                            : '1px solid var(--color-border-default)',
                          backgroundColor: isSelected
                            ? 'var(--color-brand-primary-subtle)'
                            : 'var(--color-surface)',
                          color: isSelected
                            ? 'var(--color-brand-primary)'
                            : 'var(--color-text-secondary)',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          transition: 'all var(--duration-fast) var(--ease-editorial)',
                        }}
                      >
                        {interest} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Conversation Prompt Card */}
            <div className="card-surface" style={{ padding: '28px' }}>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '20px',
                  fontWeight: 600,
                  margin: '0 0 20px 0',
                  color: 'var(--color-text-primary)',
                }}
              >
                Conversation Starter Prompt
              </h2>

              <div style={{ marginBottom: '16px' }}>
                <label className="label-editorial" htmlFor="promptQuestion">
                  Prompt Question
                </label>
                <select
                  id="promptQuestion"
                  value={promptQuestion}
                  onChange={(e) => setPromptQuestion(e.target.value)}
                  className="input-editorial"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="My ideal offline conversation is over...">My ideal offline conversation is over...</option>
                  <option value="A technical subject I could discuss endlessly is...">A technical subject I could discuss endlessly is...</option>
                  <option value="My favourite remote study spot or ritual is...">My favourite remote study spot or ritual is...</option>
                  <option value="A non-academic obsession of mine is...">A non-academic obsession of mine is...</option>
                </select>
              </div>

              <div>
                <label className="label-editorial" htmlFor="promptAnswer">
                  Your Thoughtful Answer
                </label>
                <textarea
                  id="promptAnswer"
                  value={promptAnswer}
                  onChange={(e) => setPromptAnswer(e.target.value.slice(0, 240))}
                  rows={2}
                  className="input-editorial"
                  placeholder="Give prospective matches something meaningful to connect on..."
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: '14px 28px',
                fontSize: '15px',
                alignSelf: 'flex-start',
              }}
            >
              Save Profile Changes
            </button>
          </form>

          {/* Right Column: Live Discovery Card Preview */}
          <div style={{ position: 'sticky', top: '88px' }}>
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="index-stamp" style={{ color: 'var(--color-text-muted)' }}>
                LIVE PREVIEW • HOW PEERS SEE YOU
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-brand-primary)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckIcon size={12} color="var(--color-brand-primary)" />
                Verified View
              </span>
            </div>

            {/* Candidate Card Mirror */}
            <div className="card-surface" style={{ overflow: 'hidden', boxShadow: 'var(--elevation-2)' }}>
              {/* Photo Stage */}
              <div
                style={{
                  height: '380px',
                  position: 'relative',
                  backgroundColor: '#2C2624',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={photoUrl}
                  alt={displayName}
                  onError={(e) => {
                    // Fallback to stylized monogram if invalid photo URL
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />

                {/* Scrim */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to top, rgba(20, 18, 17, 0.92) 0%, rgba(20, 18, 17, 0.35) 45%, rgba(0, 0, 0, 0) 75%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Badge Overlay */}
                <div style={{ position: 'absolute', bottom: '18px', left: '20px', right: '20px', color: '#FFFFFF' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="badge-verified">
                      <CheckIcon size={12} color="var(--color-brand-primary)" />
                      <span>Verified</span>
                    </span>

                    {locationCity && (
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
                        <span>{locationCity}</span>
                      </span>
                    )}
                  </div>

                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '28px',
                      fontWeight: 600,
                      margin: '0 0 2px 0',
                      color: '#FFFFFF',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {displayName}, {age}
                  </h3>

                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
                    {selectedProgrammeLabel} {currentTerm ? `• ${currentTerm}` : ''}
                  </p>
                </div>
              </div>

              {/* Bio & Details Section */}
              <div style={{ padding: '20px 22px' }}>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: '22px',
                    color: 'var(--color-text-primary)',
                    margin: '0 0 16px 0',
                  }}
                >
                  {bio}
                </p>

                {/* Interest Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '18px' }}>
                  {selectedInterests.map((interest) => (
                    <span
                      key={interest}
                      className="badge-interest"
                      style={{ fontSize: '11.5px', padding: '4px 10px' }}
                    >
                      {interest}
                    </span>
                  ))}
                </div>

                {/* Prompt Quote Card */}
                {promptAnswer && (
                  <div className="quote-card">
                    <span className="quote-label">{promptQuestion}</span>
                    <p className="quote-text">{promptAnswer}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Privacy Clarification Note */}
            <div
              style={{
                marginTop: '14px',
                padding: '12px 14px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              <InfoIcon size={16} color="var(--color-accent-warm)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: '17px' }}>
                <strong>Strict Privacy Guarantee:</strong> Your institutional email, student roll number, and exact date of birth are never rendered to prospective matches.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONFIDENTIAL VERIFICATION & PRIVACY */}
      {activeTab === 'private' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '720px' }}>
          {/* Institutional Verification Card */}
          <div className="card-surface" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-brand-primary-subtle)',
                  color: 'var(--color-brand-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldIcon size={22} color="var(--color-brand-primary)" />
              </div>

              <div>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '22px',
                    fontWeight: 600,
                    margin: '0 0 2px 0',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Student Verification Vault
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  Cryptographically secured enrolment records under Document 01 §3.5
                </p>
              </div>
            </div>

            {/* Data Invariants List */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                backgroundColor: 'var(--color-surface-subtle)',
                padding: '20px 24px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-subtle)',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Enrolment Status:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-status-success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <CheckIcon size={13} color="var(--color-status-success)" />
                  Active BS Student
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Programme Family:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {selectedProgrammeLabel}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Masked Institutional Email:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                  21f*****01@ds.study.iitm.ac.in
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Masked Student Roll No:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                  21F*****01
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Adult Age Eligibility:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-status-success)' }}>
                  18+ Verified (DPDP Compliant)
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: '18px' }}>
              <strong>Institutional Boundary Notice:</strong> SayMyName is an independent platform for verified learners and is not owned, operated, or endorsed by IIT Madras. Your academic records are verified solely to preserve a safe, adult, peer-exclusive community.
            </p>
          </div>

          {/* Discovery Controls Card */}
          <div className="card-surface" style={{ padding: '32px' }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                fontWeight: 600,
                margin: '0 0 16px 0',
                color: 'var(--color-text-primary)',
              }}
            >
              Discovery & Cadence Controls
            </h2>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '20px',
                borderBottom: '1px solid var(--color-border-subtle)',
              }}
            >
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--color-text-primary)' }}>
                  Pause Discovery
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', maxWidth: '440px', lineHeight: '18px' }}>
                  Take a calm pause from new daily candidate batches. Existing mutual matches, conversations, and calls remain intact.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsDiscoveryPaused(!isDiscoveryPaused)}
                className={isDiscoveryPaused ? 'btn btn-subtle' : 'btn btn-secondary'}
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                {isDiscoveryPaused ? '✓ Discovery Paused' : 'Active in Discovery'}
              </button>
            </div>

            {/* Invariant Highlights */}
            <div style={{ paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}>•</span>
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: '18px' }}>
                  <strong>Bilateral Consent:</strong> A Like is never permission to message. Private messaging unlocks only upon mutual match.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}>•</span>
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: '18px' }}>
                  <strong>Zero Surveillance:</strong> Relationship Mode requires mutual activation, allows unilateral exit at any time, and never tracks live GPS locations.
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--color-brand-primary)', fontWeight: 600 }}>•</span>
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: '18px' }}>
                  <strong>Private Correspondence:</strong> Audio calls are unrecorded by default. Private messages are never indexed for third-party advertising or public AI model training.
                </span>
              </div>
            </div>
          </div>

          {/* Account Actions & Logout */}
          <div className="card-surface" style={{ padding: '28px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Link
              href="/safety"
              className="btn btn-secondary"
              style={{ flex: 1, padding: '12px 20px', fontSize: '13.5px', justifyContent: 'center' }}
            >
              <ShieldIcon size={16} color="var(--color-brand-primary)" />
              <span>Safety Commitments</span>
            </Link>

            <button
              onClick={handleLogout}
              className="btn btn-danger"
              style={{ flex: 1, padding: '12px 20px', fontSize: '13.5px', justifyContent: 'center' }}
            >
              Log Out of Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
