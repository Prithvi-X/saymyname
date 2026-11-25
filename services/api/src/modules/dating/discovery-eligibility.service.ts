import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { ProgrammeFamily } from '@saymyname/contracts';
import { calculateAgeYears, isPrivateIdentifierLike } from '@saymyname/validation';
import { resolveDiscoveryCursorSecret } from './discovery-cursor';

const APPROVED_PROGRAMME_LIST = Object.values(ProgrammeFamily) as string[];
const APPROVED_PROGRAMME_SET = new Set<string>(APPROVED_PROGRAMME_LIST);
const MIN_DISCOVERY_AGE = 18;
const MAX_DISCOVERY_AGE = 65;

export interface NormalizedDiscoveryPreferences {
  minAge: number;
  maxAge: number;
  allowedProgrammes: string[];
  showInDiscovery: boolean;
}

export interface RequesterEligibilityCheck {
  eligible: boolean;
  reason?: 'account_inactive' | 'unverified' | 'under_age' | 'profile_incomplete' | 'paused';
}

@Injectable()
export class DiscoveryEligibilityService {
  resolveVerifiedAge(account: any, referenceDate: Date = new Date()): number | null {
    const rawDob = account?.eligibility?.dateOfBirth ?? account?.dateOfBirth ?? null;
    if (!rawDob) return null;
    const normalizedDob =
      typeof rawDob === 'string' && rawDob.includes('T') ? new Date(rawDob) : rawDob;
    return calculateAgeYears(normalizedDob, referenceDate);
  }

  isApprovedAdultAccount(account: any, referenceDate: Date = new Date()): boolean {
    if (!account || account.deletedAt || account.accountStatus !== 'active') {
      return false;
    }

    const elig = account.eligibility;
    if (!elig) return false;

    if (
      elig.ageStatus !== 'approved' ||
      elig.studentStatus !== 'approved' ||
      elig.discoveryEligible !== true
    ) {
      return false;
    }

    if (elig.validUntil && new Date(elig.validUntil).getTime() <= referenceDate.getTime()) {
      return false;
    }

    const verifiedProgramme = elig.programmeFamily;
    if (verifiedProgramme && !APPROVED_PROGRAMME_SET.has(verifiedProgramme)) {
      return false;
    }

    const age = this.resolveVerifiedAge(account, referenceDate);
    if (age === null || age < MIN_DISCOVERY_AGE) {
      return false;
    }

    return true;
  }

  hasApprovedReadyPhoto(profile: any): boolean {
    const photos = Array.isArray(profile?.photos) ? profile.photos : [];
    return photos.some(
      (p: any) => !p.deletedAt && p.moderationStatus === 'approved',
    );
  }

  isCompletedPublishedProfile(profile: any): boolean {
    if (!profile) return false;
    if (!profile.displayName || !profile.displayName.trim() || isPrivateIdentifierLike(profile.displayName)) {
      return false;
    }
    if (!APPROVED_PROGRAMME_SET.has(profile.programmeFamily)) {
      return false;
    }
    if (!profile.consentAcceptedAt) {
      return false;
    }
    return this.hasApprovedReadyPhoto(profile);
  }

  evaluateRequesterAccess(account: any, profile: any, referenceDate: Date = new Date()): RequesterEligibilityCheck {
    if (!account || account.deletedAt || account.accountStatus !== 'active') {
      return { eligible: false, reason: 'account_inactive' };
    }
    if (!account.eligibility || account.eligibility.ageStatus !== 'approved' || account.eligibility.studentStatus !== 'approved' || account.eligibility.discoveryEligible !== true) {
      return { eligible: false, reason: 'unverified' };
    }
    if (account.eligibility.validUntil && new Date(account.eligibility.validUntil).getTime() <= referenceDate.getTime()) {
      return { eligible: false, reason: 'unverified' };
    }
    const age = this.resolveVerifiedAge(account, referenceDate);
    if (age === null || age < MIN_DISCOVERY_AGE) {
      return { eligible: false, reason: 'under_age' };
    }

    if (!this.isCompletedPublishedProfile(profile)) {
      return { eligible: false, reason: 'profile_incomplete' };
    }

    const isPaused =
      Boolean(profile.isPaused) ||
      profile.profileStatus === 'paused' ||
      profile.preferences?.showInDiscovery === false;

    if (profile.profileStatus === 'draft' && !profile.publishedAt) {
      return { eligible: false, reason: 'profile_incomplete' };
    }

    if (isPaused) {
      if (profile.publishedAt) {
        return { eligible: false, reason: 'paused' };
      }
      return { eligible: false, reason: 'profile_incomplete' };
    }

    if (!profile.isPublished || profile.profileStatus !== 'live') {
      return { eligible: false, reason: 'profile_incomplete' };
    }

    return { eligible: true };
  }

  isCandidateDiscoverable(profile: any, referenceDate: Date = new Date()): boolean {
    if (!profile) return false;
    if (!profile.isPublished || profile.isPaused || profile.profileStatus !== 'live') {
      return false;
    }
    if (profile.preferences && profile.preferences.showInDiscovery === false) {
      return false;
    }
    if (!this.isApprovedAdultAccount(profile.account, referenceDate)) {
      return false;
    }
    return this.isCompletedPublishedProfile(profile);
  }

  normalizePreferences(rawPrefs: any): NormalizedDiscoveryPreferences {
    let minAge = typeof rawPrefs?.minAge === 'number' ? rawPrefs.minAge : MIN_DISCOVERY_AGE;
    let maxAge = typeof rawPrefs?.maxAge === 'number' ? rawPrefs.maxAge : MAX_DISCOVERY_AGE;

    minAge = Math.max(MIN_DISCOVERY_AGE, Math.min(MAX_DISCOVERY_AGE, Math.floor(minAge)));
    maxAge = Math.max(minAge, Math.min(MAX_DISCOVERY_AGE, Math.floor(maxAge)));

    const rawProgrammes = Array.isArray(rawPrefs?.allowedProgrammes)
      ? rawPrefs.allowedProgrammes.filter((p: string) => APPROVED_PROGRAMME_SET.has(p))
      : [];

    const allowedProgrammes =
      rawProgrammes.length > 0 ? Array.from(new Set<string>(rawProgrammes)) : [...APPROVED_PROGRAMME_LIST];

    return {
      minAge,
      maxAge,
      allowedProgrammes,
      showInDiscovery: rawPrefs?.showInDiscovery !== false,
    };
  }

  /**
   * Evaluates strictly bidirectional age and 4-programme compatibility.
   * maxDistanceKm is intentionally dormant and never evaluated.
   */
  evaluateReciprocalCompatibility(
    viewerAccount: any,
    viewerProfile: any,
    candidateProfile: any,
    referenceDate: Date = new Date(),
  ): boolean {
    const viewerAge = this.resolveVerifiedAge(viewerAccount, referenceDate);
    const candidateAge = this.resolveVerifiedAge(candidateProfile?.account, referenceDate);

    if (
      viewerAge === null ||
      viewerAge < MIN_DISCOVERY_AGE ||
      candidateAge === null ||
      candidateAge < MIN_DISCOVERY_AGE
    ) {
      return false;
    }

    const viewerPrefs = this.normalizePreferences(viewerProfile?.preferences);
    const candidatePrefs = this.normalizePreferences(candidateProfile?.preferences);

    if (!viewerPrefs.showInDiscovery || !candidatePrefs.showInDiscovery) {
      return false;
    }

    // 1. Forward check: candidate fits viewer's saved age & programme bounds
    if (candidateAge < viewerPrefs.minAge || candidateAge > viewerPrefs.maxAge) {
      return false;
    }

    const candidateProgramme =
      candidateProfile?.account?.eligibility?.programmeFamily || candidateProfile?.programmeFamily;
    if (!candidateProgramme || !viewerPrefs.allowedProgrammes.includes(candidateProgramme)) {
      return false;
    }

    // 2. Reverse check: viewer fits candidate's saved age & programme bounds
    if (viewerAge < candidatePrefs.minAge || viewerAge > candidatePrefs.maxAge) {
      return false;
    }

    const viewerProgramme =
      viewerAccount?.eligibility?.programmeFamily || viewerProfile?.programmeFamily;
    if (!viewerProgramme || !candidatePrefs.allowedProgrammes.includes(viewerProgramme)) {
      return false;
    }

    return true;
  }

  computeDailySortKey(
    viewerAccountId: string,
    candidateProfileId: string,
    daySalt: string,
    sharedInterestsCount: number,
  ): string {
    const boundedShared = Math.max(0, Math.min(10, sharedInterestsCount));
    const sharedBucket = String(99 - boundedShared).padStart(2, '0');
    const dailyHmac = crypto
      .createHmac('sha256', resolveDiscoveryCursorSecret())
      .update(`${daySalt}:${viewerAccountId}:${candidateProfileId}`)
      .digest('hex')
      .slice(0, 16);

    return `${sharedBucket}:${dailyHmac}`;
  }

  sanitizeDisplayName(name?: string | null): string {
    if (!name || !name.trim() || isPrivateIdentifierLike(name)) {
      return 'Verified Peer';
    }
    return name.trim();
  }
}
