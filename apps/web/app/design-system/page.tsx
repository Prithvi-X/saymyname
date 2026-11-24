'use client';

import React, { useState } from 'react';
import { Logo, Wordmark, Symbol } from '../../components/brand';
import {
  Button,
  Input,
  Badge,
  Avatar,
  Dialog,
  Tabs,
  EmptyState,
  Skeleton,
  Divider,
} from '../../components/ui';

export default function DesignSystemPage() {
  const [selectedConcept, setSelectedConcept] = useState<'A' | 'B' | 'C'>('A');
  const [activeTab, setActiveTab] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testInputValue, setTestInputValue] = useState('26f1001842@ds.study.iitm.ac.in');

  const colorTokens = [
    { name: 'Void', token: '--smn-stage', hex: '#0B0D10', role: 'Primary page stage', contrast: 'Stage Background' },
    { name: 'Coal', token: '--smn-surface-base', hex: '#12161B', role: 'Main reading & app surface', contrast: 'Surface 1' },
    { name: 'Iron', token: '--smn-surface-raised', hex: '#1A2027', role: 'Raised panels & cards', contrast: 'Surface 2' },
    { name: 'Slate', token: '--smn-surface-active', hex: '#252D37', role: 'Selected & interactive groups', contrast: 'Surface 3' },
    { name: 'Edge', token: '--smn-border-subtle', hex: '#343D48', role: 'Structural borders & dividers', contrast: 'Border' },
    { name: 'Chalk', token: '--smn-text-primary', hex: '#F0F1EE', role: 'Primary text', contrast: '17.16:1 on Void' },
    { name: 'Silver', token: '--smn-text-secondary', hex: '#B6BDC4', role: 'Secondary body text', contrast: '10.25:1 on Void' },
    { name: 'Ash', token: '--smn-text-tertiary', hex: '#8B949E', role: 'Tertiary metadata & hints', contrast: '6.33:1 on Void' },
    { name: 'Iris', token: '--smn-accent-iris', hex: '#8580C4', role: 'Primary brand signal & CTA', contrast: '5.09:1 on Coal' },
    { name: 'Ember', token: '--smn-accent-ember', hex: '#E18A62', role: 'Secondary warmth accent', contrast: '6.93:1 on Coal' },
    { name: 'Success', token: '--smn-success', hex: '#77C5A1', role: 'Verified & success states', contrast: '6.12:1 on Coal' },
    { name: 'Warning', token: '--smn-warning', hex: '#E6BC69', role: 'Verification pending & alerts', contrast: '8.45:1 on Coal' },
    { name: 'Danger', token: '--smn-danger', hex: '#F07878', role: 'Critical & destructive actions', contrast: '5.38:1 on Coal' },
  ];

  const typographyRoles = [
    { role: 'Display / Hero', size: '68px / 0.98', weight: '700 Bold', sample: 'Two identities. One moment of recognition.' },
    { role: 'Page Heading', size: '42px / 1.05', weight: '650 SemiBold', sample: 'Independent Dating for IITM BS' },
    { role: 'Section Heading', size: '28px / 1.12', weight: '600 SemiBold', sample: 'Foundational Design System' },
    { role: 'Card Title', size: '24px / 1.15', weight: '600 SemiBold', sample: 'Ananya Sharma, 21' },
    { role: 'Body Text', size: '16px / 1.50', weight: '400 Regular', sample: 'SayMyName connects verified adult learners in approved IIT Madras BS programme families.' },
    { role: 'Secondary Text', size: '14px / 1.45', weight: '450 Medium', sample: 'Data Science & Applications • Term 4 • Bangalore' },
    { role: 'Metadata & Tags', size: '12px / 1.35', weight: '500 Medium', sample: 'STUDENT IDENTITY VERIFIED • ENCRYPTED SESSION' },
  ];

  return (
    <div className="min-h-screen bg-stage text-chalk py-12 px-6 sm:px-10 lg:px-16 font-ui">
      <div className="max-w-6xl mx-auto flex flex-col gap-16">
        {/* ==========================================================================
            Header & Introduction
           ========================================================================== */}
        <header className="border-b border-edge pb-10 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <Logo size="lg" symbolConcept={selectedConcept} />
            <div className="flex items-center gap-3">
              <Badge variant="verified">Document 10 Approved</Badge>
              <Badge variant="programme">Phase 1 Foundation</Badge>
            </div>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-chalk mt-4">
            THE INTERVAL
          </h1>
          <p className="text-lg text-silver max-w-2xl leading-relaxed">
            A dark cinematic system built from sculptural form, precise geometry and controlled digital transformation. Companion specification to Document 03.
          </p>
        </header>

        {/* ==========================================================================
            Section 1: Vector Brand Asset System (Document 10 §06)
           ========================================================================== */}
        <section className="flex flex-col gap-6">
          <div className="flex items-baseline justify-between border-b border-edge pb-3">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-chalk">
              01 / Brand Asset System: The Interval
            </h2>
            <span className="text-xs text-ash font-mono uppercase">Vector SVG Architecture</span>
          </div>

          <p className="text-sm text-silver max-w-3xl">
            Derived from the central thesis: <em>&ldquo;Two identities. One moment of recognition.&rdquo;</em> A mark made from two distinct solid forms facing across a calibrated gap. Recognisable in flat colour without relying on glow, blur or gradients.
          </p>

          {/* Symbol Concepts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Concept A */}
            <div
              onClick={() => setSelectedConcept('A')}
              className={`p-6 rounded-[12px] border cursor-pointer transition-all duration-120 flex flex-col items-center gap-4 text-center ${
                selectedConcept === 'A'
                  ? 'bg-iron border-iris ring-1 ring-iris shadow-lg'
                  : 'bg-coal border-edge hover:border-[#4B5665]'
              }`}
            >
              <Symbol concept="A" size={64} />
              <div>
                <h3 className="text-base font-semibold text-chalk">Concept A: Paired Masses</h3>
                <p className="text-xs text-ash mt-1">Two independent solid masses facing across a central negative interval.</p>
              </div>
              <Badge variant={selectedConcept === 'A' ? 'accent' : 'neutral'} size="sm">
                {selectedConcept === 'A' ? 'Active Concept' : 'Select'}
              </Badge>
            </div>

            {/* Concept B */}
            <div
              onClick={() => setSelectedConcept('B')}
              className={`p-6 rounded-[12px] border cursor-pointer transition-all duration-120 flex flex-col items-center gap-4 text-center ${
                selectedConcept === 'B'
                  ? 'bg-iron border-iris ring-1 ring-iris shadow-lg'
                  : 'bg-coal border-edge hover:border-[#4B5665]'
              }`}
            >
              <Symbol concept="B" size={64} />
              <div>
                <h3 className="text-base font-semibold text-chalk">Concept B: Subtractive Cut</h3>
                <p className="text-xs text-ash mt-1">Monolithic architectural form cleaved cleanly by an angled precision cut.</p>
              </div>
              <Badge variant={selectedConcept === 'B' ? 'accent' : 'neutral'} size="sm">
                {selectedConcept === 'B' ? 'Active Concept' : 'Select'}
              </Badge>
            </div>

            {/* Concept C */}
            <div
              onClick={() => setSelectedConcept('C')}
              className={`p-6 rounded-[12px] border cursor-pointer transition-all duration-120 flex flex-col items-center gap-4 text-center ${
                selectedConcept === 'C'
                  ? 'bg-iron border-iris ring-1 ring-iris shadow-lg'
                  : 'bg-coal border-edge hover:border-[#4B5665]'
              }`}
            >
              <Symbol concept="C" size={64} />
              <div>
                <h3 className="text-base font-semibold text-chalk">Concept C: Facet Convergence</h3>
                <p className="text-xs text-ash mt-1">Four calibrated geometric facets converging into an architectural aperture.</p>
              </div>
              <Badge variant={selectedConcept === 'C' ? 'accent' : 'neutral'} size="sm">
                {selectedConcept === 'C' ? 'Active Concept' : 'Select'}
              </Badge>
            </div>
          </div>

          {/* Wordmark Variants */}
          <div className="p-6 bg-coal border border-edge rounded-[12px] flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-silver uppercase tracking-wider">Wordmark Executions</h3>
            <div className="flex flex-wrap items-center gap-8 py-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs text-ash">Primary Wordmark (Grotesk with signature cut on N & M)</span>
                <Wordmark size="xl" />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-ash">Compact Variant</span>
                <Wordmark size="xl" variant="compact" />
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================================================
            Section 2: Color System - Mineral Night (Document 10 §07)
           ========================================================================== */}
        <section className="flex flex-col gap-6">
          <div className="flex items-baseline justify-between border-b border-edge pb-3">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-chalk">
              02 / Colour System: Mineral Night
            </h2>
            <span className="text-xs text-ash font-mono uppercase">WCAG 2.2 AA Contrast Verified</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {colorTokens.map((c) => (
              <div key={c.name} className="p-3 bg-coal border border-edge rounded-[8px] flex flex-col gap-2.5">
                <div
                  className="w-full h-14 rounded-[4px] border border-edge/60 flex items-center justify-center font-mono text-xs font-semibold"
                  style={{
                    backgroundColor: c.hex,
                    color: ['Void', 'Coal', 'Iron', 'Slate', 'Edge'].includes(c.name) ? '#F0F1EE' : '#0B0D10',
                  }}
                >
                  {c.hex}
                </div>
                <div>
                  <div className="text-xs font-semibold text-chalk">{c.name}</div>
                  <div className="text-[11px] text-ash font-mono">{c.token}</div>
                  <div className="text-[10px] text-silver/80 mt-1">{c.role}</div>
                  <div className="text-[10px] text-iris/90 font-medium mt-0.5">{c.contrast}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ==========================================================================
            Section 3: Typography Scale (Document 10 §09)
           ========================================================================== */}
        <section className="flex flex-col gap-6">
          <div className="flex items-baseline justify-between border-b border-edge pb-3">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-chalk">
              03 / Typography: Instrument Sans Neo-Grotesk
            </h2>
            <span className="text-xs text-ash font-mono uppercase">Weights 400..700 Variable</span>
          </div>

          <div className="divide-y divide-edge/60 bg-coal border border-edge rounded-[12px]">
            {typographyRoles.map((t) => (
              <div key={t.role} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="w-48 shrink-0">
                  <div className="text-xs font-semibold text-chalk">{t.role}</div>
                  <div className="text-[11px] text-ash font-mono">{t.size} • {t.weight}</div>
                </div>
                <div className="text-silver text-sm sm:text-base flex-1 font-medium">
                  {t.sample}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ==========================================================================
            Section 4: Geometry & Component Rules (Document 10 §11)
           ========================================================================== */}
        <section className="flex flex-col gap-6">
          <div className="flex items-baseline justify-between border-b border-edge pb-3">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-chalk">
              04 / Geometry & Shape Vocabulary
            </h2>
            <span className="text-xs text-danger font-mono uppercase">999px Pills Prohibited</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-coal border border-edge rounded-none flex flex-col gap-2">
              <span className="text-xs font-mono text-ash">radius-none (0px)</span>
              <span className="text-sm font-semibold text-chalk">Image Frames</span>
              <span className="text-xs text-silver">Architectural panels, hard-edged cuts</span>
            </div>
            <div className="p-4 bg-coal border border-edge rounded-[4px] flex flex-col gap-2">
              <span className="text-xs font-mono text-ash">radius-tight (4px)</span>
              <span className="text-sm font-semibold text-chalk">Inputs & Badges</span>
              <span className="text-xs text-silver">Form fields, chips, compact tags</span>
            </div>
            <div className="p-4 bg-coal border border-edge rounded-[8px] flex flex-col gap-2">
              <span className="text-xs font-mono text-ash">radius-control (8px)</span>
              <span className="text-sm font-semibold text-chalk">Buttons & Controls</span>
              <span className="text-xs text-silver">Actions, select menus, avatars</span>
            </div>
            <div className="p-4 bg-coal border border-edge rounded-[12px] flex flex-col gap-2">
              <span className="text-xs font-mono text-ash">radius-panel (12px)</span>
              <span className="text-sm font-semibold text-chalk">Surfaces & Cards</span>
              <span className="text-xs text-silver">Modals, content cards, sidebars</span>
            </div>
            <div className="p-4 bg-coal border border-edge rounded-[16px] flex flex-col gap-2">
              <span className="text-xs font-mono text-ash">radius-feature (16px)</span>
              <span className="text-sm font-semibold text-chalk">Immersive Views</span>
              <span className="text-xs text-silver">Rare media viewports, call stages</span>
            </div>
          </div>
        </section>

        {/* ==========================================================================
            Section 5: Foundational Reusable UI Components
           ========================================================================== */}
        <section className="flex flex-col gap-8">
          <div className="flex items-baseline justify-between border-b border-edge pb-3">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-chalk">
              05 / Foundational Component Library
            </h2>
            <span className="text-xs text-ash font-mono uppercase">Reusable & Accessible</span>
          </div>

          {/* Buttons Showcase */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-silver uppercase tracking-wider">Button Variants & Sizes</h3>
            <div className="p-6 bg-coal border border-edge rounded-[12px] flex flex-wrap items-center gap-4">
              <Button variant="primary" size="md">Primary Action</Button>
              <Button variant="secondary" size="md">Secondary Action</Button>
              <Button variant="ghost" size="md">Ghost Control</Button>
              <Button variant="warm" size="md">Warm Accent</Button>
              <Button variant="destructive" size="md">Destructive</Button>
              <Button variant="primary" size="md" isLoading>Processing</Button>
              <Button variant="primary" size="sm">Compact (36px)</Button>
              <Button variant="primary" size="lg">Large (52px)</Button>
            </div>
          </div>

          {/* Badges & Status Indicators (Highlighting Verified Rule) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-silver uppercase tracking-wider">Badges & Architectural Labels</h3>
              <span className="text-xs text-success font-medium">Explicit Rule: &ldquo;Verified&rdquo; only (no &ldquo;18+ Student&rdquo;)</span>
            </div>
            <div className="p-6 bg-coal border border-edge rounded-[12px] flex flex-wrap items-center gap-3">
              <Badge variant="verified">Verified</Badge>
              <Badge variant="programme">Data Science & Applications</Badge>
              <Badge variant="programme">Electronic Systems</Badge>
              <Badge variant="accent">Term 4 Active</Badge>
              <Badge variant="warning">Verification In Progress</Badge>
              <Badge variant="danger">Match Restricted</Badge>
              <Badge variant="neutral">Private Vault</Badge>
            </div>
          </div>

          {/* Form Controls Showcase */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-silver uppercase tracking-wider">Form Controls & Fields</h3>
            <div className="p-6 bg-coal border border-edge rounded-[12px] grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Official Student Institutional Email"
                value={testInputValue}
                onChange={(e) => setTestInputValue(e.target.value)}
                helperText="Must be an active @*.study.iitm.ac.in address."
              />
              <Input
                label="Sample Field with Error State"
                value="invalid_user@external.com"
                error="Only approved IIT Madras BS programme domains are permitted."
                readOnly
              />
            </div>
          </div>

          {/* Avatars & Skeletons */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-silver uppercase tracking-wider">Avatars, Profile Frames & Skeletons</h3>
            <div className="p-6 bg-coal border border-edge rounded-[12px] flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <Avatar size="sm" name="Ananya Sharma" verified />
                <Avatar size="md" name="Devansh Patel" verified />
                <Avatar size="lg" name="Pooja Rao" verified />
                <Avatar size="xl" name="Vikram Nair" verified />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton width={80} height={18} rounded="tight" />
                <Skeleton width={140} height={40} rounded="control" />
                <Skeleton width={60} height={60} rounded="panel" />
              </div>
            </div>
          </div>

          {/* Tabs & Dialog Trigger */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-silver uppercase tracking-wider">Tabs & Modal Dialog</h3>
            <div className="p-6 bg-coal border border-edge rounded-[12px] flex flex-col gap-6">
              <Tabs
                activeTab={activeTab}
                onChange={setActiveTab}
                tabs={[
                  { id: 'all', label: 'All Matches', badge: 3 },
                  { id: 'recent', label: 'Recent Conversations', badge: 1 },
                  { id: 'archived', label: 'Archived' },
                ]}
              />

              <div className="flex items-center justify-between">
                <span className="text-sm text-silver">Click to test accessible dialog modal behavior:</span>
                <Button variant="secondary" size="sm" onClick={() => setIsDialogOpen(true)}>
                  Open Preview Dialog
                </Button>
              </div>
            </div>
          </div>

          {/* Empty State */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-silver uppercase tracking-wider">Quiet Empty State</h3>
            <EmptyState
              title="No Pending Conversations"
              description="When two verified members mutually express interest, private conversation opens here. A Like is never permission to message without a mutual match."
              actionLabel="Explore Discover Feed"
              onAction={() => alert('Synthetic preview action triggered.')}
            />
          </div>

          <Divider label="End of Design System Foundation" />
        </section>

        {/* Modal Dialog Instance */}
        <Dialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          title="Mutual Recognition Protocol"
          description="Document 10 architectural modal surface in Mineral Night Coal/Iron."
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => setIsDialogOpen(false)}>
                Confirm Action
              </Button>
            </>
          }
        >
          <p className="text-sm text-silver leading-relaxed">
            In SayMyName, interaction is governed by mutual consent. A visitor never receives dating data, and a member’s institutional credentials and roll numbers are protected behind server-authoritative ownership.
          </p>
        </Dialog>
      </div>
    </div>
  );
}
