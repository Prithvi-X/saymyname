'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge, Button } from '../ui';
import {
  SAMPLE_CHAT_DATA,
  SAMPLE_DISCOVER_CARD,
  SAMPLE_MATCH_CARD,
} from './landing-content';
import type { ProductTabId } from './landing-types';

const PREVIEW_TABS: readonly { id: ProductTabId; label: string; stepCode: string }[] = [
  { id: 'discover', label: '01. Discover', stepCode: 'DISCOVER' },
  { id: 'match', label: '02. Mutual Match', stepCode: 'MATCH' },
  { id: 'chat', label: '03. Private 1:1 Chat', stepCode: 'PRIVATE CHAT' },
];

/**
 * Band 3: Interactive Product Preview ("Inside SayMyName").
 * Accessible ARIA tablist cycling static, illustrative Phase 1 views with zero private API calls.
 */
export function ProductPreview() {
  const [activeTab, setActiveTab] = useState<ProductTabId>('discover');
  const [interestSent, setInterestSent] = useState(false);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + delta + PREVIEW_TABS.length) % PREVIEW_TABS.length;
    setActiveTab(PREVIEW_TABS[nextIndex].id);
  };

  return (
    <section
      id="inside-saymyname"
      aria-labelledby="product-preview-heading"
      className="bg-void border-b border-edge/80 py-16 md:py-24"
    >
      <div className="container-wide flex flex-col gap-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col gap-3 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-iris">
              INSIDE SAYMYNAME
            </p>
            <h2
              id="product-preview-heading"
              className="text-2xl sm:text-[2rem] lg:text-[2.25rem] font-semibold leading-[1.15] tracking-[-0.025em] text-chalk"
            >
              Calm discovery, mutual match, and private conversation.
            </h2>
          </div>
          <p className="text-xs font-medium text-silver border border-edge bg-coal px-3 py-1.5 rounded-[4px] self-start md:self-auto">
            Sample product preview &middot; Illustrative layout
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Rail: Interactive Step Tabs */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div
              role="tablist"
              aria-label="Product experience preview tabs"
              className="flex flex-col gap-2.5"
            >
              {PREVIEW_TABS.map((tab, index) => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`preview-tab-${tab.id}`}
                    aria-selected={isSelected}
                    aria-controls={`preview-panel-${tab.id}`}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                    className={`w-full text-left px-4 py-4 rounded-[8px] border transition-colors min-h-[56px] ${
                      isSelected
                        ? 'bg-coal border-iris text-chalk'
                        : 'bg-coal/40 border-edge text-silver hover:border-[#4A5665] hover:text-chalk'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{tab.label}</span>
                      <span
                        className={`text-xs font-medium uppercase tracking-[0.1em] ${
                          isSelected ? 'text-iris' : 'text-ash'
                        }`}
                      >
                        {tab.stepCode}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-[8px] border border-edge bg-coal/60 p-4 text-xs text-silver leading-relaxed">
              Every step enforces Phase 1 server rules: 18+ and BS student verification before entering Discover, mutual Like before opening Chat, and zero unsolicited stranger DMs.
            </div>
          </div>

          {/* Right Panel: Illustrative Phase 1 Product Surface */}
          <div className="lg:col-span-7">
            <div
              role="tabpanel"
              id={`preview-panel-${activeTab}`}
              aria-labelledby={`preview-tab-${activeTab}`}
              className="rounded-[12px] border border-edge bg-coal p-5 sm:p-7 smn-surface-elevated"
            >
              {activeTab === 'discover' && (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-edge/70">
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="w-12 h-12 rounded-[8px] bg-iron border border-edge flex items-center justify-center text-sm font-semibold text-chalk"
                      >
                        {SAMPLE_DISCOVER_CARD.initials}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-chalk">
                          {SAMPLE_DISCOVER_CARD.name}, {SAMPLE_DISCOVER_CARD.age}
                        </p>
                        <p className="text-xs text-silver">
                          {SAMPLE_DISCOVER_CARD.track} &middot; {SAMPLE_DISCOVER_CARD.city}
                        </p>
                      </div>
                    </div>
                    <Badge variant="verified" size="sm">
                      Verified 18+ &amp; BS
                    </Badge>
                  </div>

                  <p className="text-sm sm:text-base text-chalk/90 leading-relaxed">
                    &ldquo;{SAMPLE_DISCOVER_CARD.bio}&rdquo;
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_DISCOVER_CARD.interests.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-[4px] border border-edge bg-iron text-xs text-silver"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-edge/70 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-silver" aria-live="polite">
                      {interestSent
                        ? 'Preview state: Like noted locally. Chat opens only on mutual match.'
                        : 'Sample card · Interactive preview does not send real requests'}
                    </span>
                    <div className="flex items-center gap-2.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setInterestSent(false)}
                      >
                        Pass
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setInterestSent(true)}
                      >
                        {interestSent ? 'Interest Sent' : 'Express Interest'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'match' && (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-edge/70">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-success">
                        Mutual Match Confirmed
                      </p>
                      <h3 className="text-xl font-semibold text-chalk mt-1">
                        {SAMPLE_MATCH_CARD.pairLabel}
                      </h3>
                    </div>
                    <Badge variant="verified" size="sm">
                      Mutual Consent
                    </Badge>
                  </div>

                  <div className="rounded-[8px] border border-edge bg-iron/70 p-4 flex flex-col gap-1.5">
                    <p className="text-sm font-medium text-chalk">
                      {SAMPLE_MATCH_CARD.trackSummary}
                    </p>
                    <p className="text-xs text-silver">{SAMPLE_MATCH_CARD.citiesSummary}</p>
                  </div>

                  <p className="text-sm text-silver leading-relaxed">
                    {SAMPLE_MATCH_CARD.consentNote}
                  </p>

                  <div className="pt-4 border-t border-edge/70 flex justify-end">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveTab('chat')}
                    >
                      Inspect Private Chat View &rarr;
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-edge/70">
                    <div>
                      <p className="text-base font-semibold text-chalk">
                        {SAMPLE_CHAT_DATA.peerName}
                      </p>
                      <p className="text-xs text-silver">{SAMPLE_CHAT_DATA.peerTrack}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-[4px] border border-edge bg-iron text-xs font-medium text-success">
                      {SAMPLE_CHAT_DATA.statusLabel}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {SAMPLE_CHAT_DATA.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`rounded-[8px] px-4 py-3 max-w-[85%] border ${
                          msg.sender === 'member'
                            ? 'self-end bg-iris-subtle border-iris/40 text-chalk'
                            : 'self-start bg-iron border-edge text-silver'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <span className="text-xs font-semibold text-chalk">{msg.author}</span>
                          <span className="text-xs text-ash">{msg.timestamp}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-chalk/90">{msg.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-edge/70 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-ash">{SAMPLE_CHAT_DATA.footerNote}</p>
                    <Link
                      href="/onboarding"
                      className="text-xs font-semibold text-iris hover:text-iris-hover transition-colors"
                    >
                      Create Account &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
