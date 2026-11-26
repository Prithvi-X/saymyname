'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GameCatalogItemDto,
  GameSessionDto,
  GameSessionStatus,
  RelationshipJournalDto,
  RelationshipMilestoneDto,
  RelationshipStatusDto,
  VirtualDateDto,
  VirtualDateStatus,
} from '@saymyname/contracts';
import { api } from '../lib/api';
import { Badge, Button, Dialog, Input } from './ui';
import { CalendarIcon, CheckIcon, GameIcon, HeartHandshakeIcon, LockIcon } from './icons';

function isClosedMatchError(err: any): boolean {
  return err?.status === 403 || err?.status === 404;
}

const VIRTUAL_ACTIVITY_OPTIONS = [
  { value: 'coffee_chat', label: 'Virtual Coffee Chat' },
  { value: 'study_session', label: 'Study Session' },
  { value: 'game_night', label: 'Cooperative Game Night' },
  { value: 'music_share', label: 'Shared Playlist Session' },
  { value: 'campus_walk', label: 'Campus Story Catch-Up' },
] as const;

export function TogetherGamesModal({
  isOpen,
  onClose,
  conversationId,
  partnerName,
  selfAccountId,
  refreshTick,
  onSummaryChange,
  onMatchEnded,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  partnerName: string;
  selfAccountId: string | null;
  refreshTick: number;
  onSummaryChange?: (sessions: GameSessionDto[]) => void;
  onMatchEnded?: () => void;
}) {
  const [catalog, setCatalog] = useState<GameCatalogItemDto[]>([]);
  const [sessions, setSessions] = useState<GameSessionDto[]>([]);
  const [selectedKey, setSelectedKey] = useState<'word_scramble' | 'iitm_trivia' | 'twenty_questions'>(
    'word_scramble',
  );
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [wordGuess, setWordGuess] = useState('');
  const [promptAnswerText, setPromptAnswerText] = useState('');

  const catalogRef = useRef<GameCatalogItemDto[]>([]);
  const onSummaryChangeRef = useRef(onSummaryChange);
  const onMatchEndedRef = useRef(onMatchEnded);
  onSummaryChangeRef.current = onSummaryChange;
  onMatchEndedRef.current = onMatchEnded;

  const loadData = useCallback(
    async (silent = false) => {
      if (!conversationId) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [cat, list] = await Promise.all([
          catalogRef.current.length > 0 ? Promise.resolve(catalogRef.current) : api.getGameCatalog(),
          api.listGameSessions(conversationId),
        ]);
        catalogRef.current = cat;
        setCatalog(cat);
        setSessions(list);
        onSummaryChangeRef.current?.(list);
      } catch (err: any) {
        if (isClosedMatchError(err)) {
          onMatchEndedRef.current?.();
          return;
        }
        setError(err?.message || 'Could not load cooperative games right now.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [conversationId],
  );

  useEffect(() => {
    if (isOpen) {
      void loadData(false);
    }
  }, [isOpen, loadData]);

  useEffect(() => {
    if (isOpen && refreshTick > 0) {
      void loadData(true);
    }
  }, [isOpen, refreshTick, loadData]);

  const currentSession = useMemo(() => {
    return (
      sessions.find(
        (s) =>
          s.sessionStatus === GameSessionStatus.ACTIVE ||
          s.sessionStatus === GameSessionStatus.INVITED,
      ) || sessions[0] || null
    );
  }, [sessions]);

  const isInvitedOrActive =
    currentSession &&
    (currentSession.sessionStatus === GameSessionStatus.INVITED ||
      currentSession.sessionStatus === GameSessionStatus.ACTIVE);

  const inviterId =
    currentSession?.invitedByAccountId ||
    currentSession?.members?.find((m) => m.role === 'inviter')?.accountId ||
    null;
  const iSentInvite = Boolean(selfAccountId && inviterId === selfAccountId);

  const handleInvite = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await api.inviteGame({ conversationId, gameKey: selectedKey });
      setSessions((prev) => {
        const next = [created, ...prev.filter((s) => s.id !== created.id)];
        onSummaryChange?.(next);
        return next;
      });
      setNotice(`Game invitation sent to ${partnerName}. Waiting for their acceptance.`);
    } catch (err: any) {
      if (isClosedMatchError(err)) {
        onMatchEnded?.();
        return;
      }
      setError(err?.message || 'Unable to send game invitation.');
    } finally {
      setBusy(false);
    }
  };

  const handleRespond = async (action: 'accept' | 'decline') => {
    if (!currentSession || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.respondGame(currentSession.id, action);
      setSessions((prev) => {
        const next = prev.map((s) => (s.id === updated.id ? updated : s));
        onSummaryChange?.(next);
        return next;
      });
    } catch (err: any) {
      if (isClosedMatchError(err)) {
        onMatchEnded?.();
        return;
      }
      setError(err?.message || 'Could not update game invitation.');
    } finally {
      setBusy(false);
    }
  };

  const handleEndSession = async () => {
    if (!currentSession || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.endGameSession(currentSession.id);
      setSessions((prev) => {
        const next = prev.map((s) => (s.id === updated.id ? updated : s));
        onSummaryChange?.(next);
        return next;
      });
      setNotice('Game session closed.');
    } catch (err: any) {
      setError(err?.message || 'Could not close game session.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitMove = async (moveType: string, moveData: Record<string, any>) => {
    if (!currentSession || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.submitGameMove(currentSession.id, { moveType, moveData });
      setWordGuess('');
      setPromptAnswerText('');
      setSessions((prev) => {
        const next = prev.map((s) => (s.id === updated.id ? updated : s));
        onSummaryChange?.(next);
        return next;
      });
    } catch (err: any) {
      if (isClosedMatchError(err)) {
        onMatchEnded?.();
        return;
      }
      setError(err?.message || 'Move could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  const renderScoreboard = (session: GameSessionDto) => {
    const members = session.members || [];
    const selfScore = members.find((m) => m.accountId === selfAccountId)?.score ?? 0;
    const partnerScore = members.find((m) => m.accountId !== selfAccountId)?.score ?? 0;
    return (
      <div className="grid grid-cols-2 gap-2.5">
        <div className="p-3 rounded-[8px] bg-stage border border-edge flex items-center justify-between">
          <span className="text-xs text-silver">You</span>
          <span className="text-sm font-semibold font-mono text-iris">{selfScore} pts</span>
        </div>
        <div className="p-3 rounded-[8px] bg-stage border border-edge flex items-center justify-between">
          <span className="text-xs text-silver truncate">{partnerName}</span>
          <span className="text-sm font-semibold font-mono text-terracotta">{partnerScore} pts</span>
        </div>
      </div>
    );
  };

  const renderActiveGameplay = (session: GameSessionDto) => {
    const state = (session.currentState || {}) as Record<string, any>;

    if (session.gameKey === 'word_scramble') {
      const wordNumber = Number(state.wordIndex || 0) + 1;
      const totalWords = Number(state.totalWords || 4);
      return (
        <div className="flex flex-col gap-4">
          {renderScoreboard(session)}
          <div className="p-4 rounded-[10px] bg-iron border border-edge text-center">
            <span className="text-[11px] uppercase tracking-[0.12em] text-iris font-semibold">
              Word {wordNumber} of {totalWords}
            </span>
            <div className="mt-2 text-2xl font-mono font-bold tracking-[0.22em] text-chalk">
              {String(state.scrambled || '')}
            </div>
            {state.hint && <p className="text-xs text-silver mt-2">Hint: {String(state.hint)}</p>}
            {state.lastAttempt === 'incorrect' && (
              <p className="text-xs text-warning mt-2">Not quite — try another combination.</p>
            )}
            {state.lastCorrectGuess && (
              <p className="text-xs text-success mt-2">Solved previous word: {String(state.lastCorrectGuess)}</p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmitMove('guess_word', { guess: wordGuess });
            }}
            className="flex gap-2"
          >
            <Input
              value={wordGuess}
              onChange={(e) => setWordGuess(e.target.value)}
              placeholder="Type unscrambled word..."
              maxLength={40}
            />
            <Button type="submit" variant="primary" disabled={busy || !wordGuess.trim()}>
              Submit
            </Button>
          </form>
        </div>
      );
    }

    if (session.gameKey === 'iitm_trivia') {
      const qIndex = Number(state.questionIndex || 0) + 1;
      const totalQ = Number(state.totalQuestions || 3);
      const options: string[] = Array.isArray(state.options) ? state.options : [];
      return (
        <div className="flex flex-col gap-4">
          {renderScoreboard(session)}
          <div className="p-4 rounded-[10px] bg-iron border border-edge">
            <span className="text-[11px] uppercase tracking-[0.12em] text-iris font-semibold">
              Question {qIndex} of {totalQ}
            </span>
            <p className="text-sm font-medium text-chalk mt-2">{String(state.question || '')}</p>
            {typeof state.lastQuestionCorrect === 'boolean' && (
              <p
                className={`text-xs mt-2 ${
                  state.lastQuestionCorrect ? 'text-success' : 'text-warning'
                }`}
              >
                {state.lastQuestionCorrect ? 'Previous answer was right (+10 pts)!' : 'Previous round missed — next question active.'}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                disabled={busy}
                onClick={() => void handleSubmitMove('submit_trivia', { selectedOption: idx })}
                className="w-full text-left px-4 py-2.5 rounded-[8px] bg-stage border border-edge hover:border-iris text-xs font-medium text-chalk transition-colors"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    const promptIndex = Number(state.promptIndex || 0) + 1;
    const totalPrompts = Number(state.totalPrompts || 6);
    const responses: Array<{ accountId: string; answer: string }> = Array.isArray(state.responses)
      ? state.responses
      : [];
    const myResponse = responses.find((r) => r.accountId === selfAccountId);

    return (
      <div className="flex flex-col gap-4">
        {renderScoreboard(session)}
        <div className="p-4 rounded-[10px] bg-iron border border-edge">
          <span className="text-[11px] uppercase tracking-[0.12em] text-iris font-semibold">
            Prompt {promptIndex} of {totalPrompts}
          </span>
          <p className="text-sm font-medium text-chalk mt-2">{String(state.prompt || '')}</p>
          <p className="text-[11px] text-ash mt-2">
            {responses.length === 0
              ? 'Both partners submit their answer to unlock the next round (+10 pts each).'
              : myResponse
                ? 'Your reflection is saved — waiting for partner to answer to advance.'
                : `${partnerName} already answered! Submit yours to reveal and advance.`}
          </p>
        </div>

        {Array.isArray(state.lastCompletedResponses) && state.lastCompletedResponses.length > 0 && (
          <div className="p-3 rounded-[8px] bg-stage border border-edge/80 space-y-1.5 text-xs">
            <div className="text-[11px] font-semibold text-success">Last Completed Round:</div>
            <div className="text-silver italic">{String(state.lastCompletedPrompt || '')}</div>
            {state.lastCompletedResponses.map((r: any, i: number) => (
              <div key={i} className="text-chalk">
                <strong>{r.accountId === selfAccountId ? 'You' : partnerName}:</strong> {r.answer}
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmitMove('answer_prompt', { answer: promptAnswerText });
          }}
          className="flex flex-col gap-2"
        >
          <textarea
            rows={2}
            maxLength={240}
            value={promptAnswerText}
            onChange={(e) => setPromptAnswerText(e.target.value)}
            placeholder={myResponse ? 'Update your reflection...' : 'Share your thoughtful answer...'}
            className="w-full p-3 rounded-[8px] bg-stage border border-edge text-xs text-chalk focus:border-iris outline-none resize-none"
          />
          <Button type="submit" variant="primary" size="sm" disabled={busy || !promptAnswerText.trim()}>
            {myResponse ? 'Update Answer' : 'Submit Answer'}
          </Button>
        </form>
      </div>
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Cooperative Mini-Games"
      description={`Mutual turn-based play with ${partnerName}. Both partners must agree before a session starts.`}
      maxWidth="md"
      footer={
        currentSession?.sessionStatus === GameSessionStatus.ACTIVE ? (
          <div className="flex w-full justify-between gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={handleEndSession}>
              End Game
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Keep Playing Later
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4" data-testid="together-games-modal">
        {error && (
          <div className="p-3 rounded-[8px] bg-[#2E1417] border border-danger/40 text-xs text-danger">
            {error}
          </div>
        )}
        {notice && (
          <div className="p-3 rounded-[8px] bg-iron border border-success/40 text-xs text-success">
            {notice}
          </div>
        )}

        {loading ? (
          <p className="text-xs text-silver py-4 text-center">Loading interactive games...</p>
        ) : currentSession?.sessionStatus === GameSessionStatus.INVITED ? (
          <div className="p-5 rounded-[10px] bg-iron border border-edge flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-chalk font-semibold text-sm">
                <GameIcon size={16} color="#E18A62" />
                <span>{currentSession.title}</span>
              </div>
              <Badge variant="programme" size="sm">
                Pending Acceptance
              </Badge>
            </div>
            {iSentInvite ? (
              <>
                <p className="text-xs text-silver">
                  Waiting for {partnerName} to explicitly accept your game invitation.
                </p>
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleRespond('decline')}
                  >
                    Withdraw Invite
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-silver">
                  {partnerName} invited you to play <strong>{currentSession.title}</strong>.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleRespond('decline')}
                  >
                    Decline
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleRespond('accept')}
                    data-testid="accept-game-invite-btn"
                  >
                    Accept &amp; Play
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : currentSession?.sessionStatus === GameSessionStatus.ACTIVE ? (
          renderActiveGameplay(currentSession)
        ) : (
          <div className="flex flex-col gap-3">
            {currentSession?.sessionStatus === GameSessionStatus.COMPLETED && (
              <div className="p-3.5 rounded-[8px] bg-stage border border-success/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-success">
                    Completed: {currentSession.title}
                  </span>
                  <span className="text-silver">
                    {currentSession.winnerAccountId === selfAccountId
                      ? 'You led in points!'
                      : `${partnerName} led in points!`}
                  </span>
                </div>
                {renderScoreboard(currentSession)}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {(catalog.length > 0
                ? catalog
                : [
                    { gameKey: 'word_scramble', title: 'Word Scramble', description: 'Unscramble campus and BS terms together.' },
                    { gameKey: 'iitm_trivia', title: 'IITM BS Trivia', description: 'IITM BS & Chennai trivia challenge.' },
                    { gameKey: 'twenty_questions', title: '20 Questions Icebreaker', description: 'Thoughtful cooperative prompts.' },
                  ]
              ).map((item) => {
                const key = item.gameKey as 'word_scramble' | 'iitm_trivia' | 'twenty_questions';
                const active = selectedKey === key;
                return (
                  <button
                    key={item.gameKey}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    className={`text-left p-3.5 rounded-[8px] border transition-colors ${
                      active
                        ? 'border-iris bg-iris/[0.12]'
                        : 'border-edge bg-iron hover:border-[#465261]'
                    }`}
                  >
                    <div className="text-sm font-semibold text-chalk">{item.title}</div>
                    <div className="text-xs text-silver mt-0.5">{item.description}</div>
                  </button>
                );
              })}
            </div>

            <div className="pt-1 flex justify-end">
              <Button
                variant="primary"
                disabled={busy || Boolean(isInvitedOrActive)}
                isLoading={busy}
                onClick={handleInvite}
                data-testid="send-game-invite-btn"
              >
                Send Game Invitation
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

export function TogetherVirtualDateModal({
  isOpen,
  onClose,
  conversationId,
  partnerName,
  selfAccountId,
  refreshTick,
  onSummaryChange,
  onMatchEnded,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  partnerName: string;
  selfAccountId: string | null;
  refreshTick: number;
  onSummaryChange?: (dates: VirtualDateDto[]) => void;
  onMatchEnded?: () => void;
}) {
  const [dates, setDates] = useState<VirtualDateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const defaultLocalDateTime = useMemo(() => {
    const dt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    dt.setMinutes(0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:00`;
  }, []);

  const [activityType, setActivityType] = useState<
    'coffee_chat' | 'study_session' | 'game_night' | 'music_share' | 'campus_walk'
  >('coffee_chat');
  const [scheduledForLocal, setScheduledForLocal] = useState(defaultLocalDateTime);
  const [timezone] = useState<string>(
    () => (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kolkata') || 'Asia/Kolkata',
  );
  const [proposalNotes, setProposalNotes] = useState('');
  const onSummaryChangeRef = useRef(onSummaryChange);
  const onMatchEndedRef = useRef(onMatchEnded);
  onSummaryChangeRef.current = onSummaryChange;
  onMatchEndedRef.current = onMatchEnded;

  const loadDates = useCallback(
    async (silent = false) => {
      if (!conversationId) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const list = await api.listVirtualDates(conversationId);
        setDates(list);
        onSummaryChangeRef.current?.(list);
      } catch (err: any) {
        if (isClosedMatchError(err)) {
          onMatchEndedRef.current?.();
          return;
        }
        setError(err?.message || 'Could not load virtual dates.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [conversationId],
  );

  useEffect(() => {
    if (isOpen) {
      void loadDates(false);
    }
  }, [isOpen, loadDates]);

  useEffect(() => {
    if (isOpen && refreshTick > 0) {
      void loadDates(true);
    }
  }, [isOpen, refreshTick, loadDates]);

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const parsed = new Date(scheduledForLocal);
    if (Number.isNaN(parsed.getTime())) {
      setError('Pick a valid future date and time.');
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await api.proposeVirtualDate({
        conversationId,
        scheduledFor: parsed.toISOString(),
        timezone: timezone.trim() || 'Asia/Kolkata',
        activityType,
        proposalNotes: proposalNotes.trim() || undefined,
      });
      setDates((prev) => {
        const next = [created, ...prev];
        onSummaryChange?.(next);
        return next;
      });
      setProposalNotes('');
      setNotice(`Virtual date proposal sent to ${partnerName}. Waiting for their confirmation.`);
    } catch (err: any) {
      if (isClosedMatchError(err)) {
        onMatchEnded?.();
        return;
      }
      setError(err?.message || 'Unable to propose virtual date.');
    } finally {
      setBusy(false);
    }
  };

  const handleRespond = async (dateId: string, action: 'accept' | 'cancel') => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.respondVirtualDate(dateId, action);
      setDates((prev) => {
        const next = prev.map((d) => (d.id === updated.id ? updated : d));
        onSummaryChange?.(next);
        return next;
      });
      setNotice(action === 'accept' ? 'Virtual date confirmed by both partners!' : 'Virtual date cancelled.');
    } catch (err: any) {
      if (isClosedMatchError(err)) {
        onMatchEnded?.();
        return;
      }
      setError(err?.message || 'Could not update virtual date.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Virtual Dates"
      description={`Propose and mutually confirm a low-pressure virtual session with ${partnerName}.`}
      maxWidth="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-5" data-testid="together-dates-modal">
        {error && (
          <div className="p-3 rounded-[8px] bg-[#2E1417] border border-danger/40 text-xs text-danger">
            {error}
          </div>
        )}
        {notice && (
          <div className="p-3 rounded-[8px] bg-iron border border-success/40 text-xs text-success">
            {notice}
          </div>
        )}

        <form onSubmit={handlePropose} className="p-4 rounded-[10px] bg-iron border border-edge flex flex-col gap-3">
          <div className="text-xs font-semibold text-chalk flex items-center gap-2">
            <CalendarIcon size={15} color="#8580C4" />
            <span>Propose New Session</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.1em] text-ash mb-1 font-semibold">
                Activity
              </label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as any)}
                className="w-full h-10 px-3 rounded-[8px] bg-stage border border-edge text-xs text-chalk outline-none focus:border-iris"
              >
                {VIRTUAL_ACTIVITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.1em] text-ash mb-1 font-semibold">
                Date &amp; Time ({timezone})
              </label>
              <input
                type="datetime-local"
                value={scheduledForLocal}
                onChange={(e) => setScheduledForLocal(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-[8px] bg-stage border border-edge text-xs text-chalk outline-none focus:border-iris"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.1em] text-ash mb-1 font-semibold">
              Optional Note
            </label>
            <Input
              value={proposalNotes}
              onChange={(e) => setProposalNotes(e.target.value)}
              placeholder="e.g. Quick filter coffee & catching up before quiz week..."
              maxLength={400}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" disabled={busy} isLoading={busy} data-testid="propose-date-btn">
              Send Date Proposal
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-2.5 max-h-[260px] overflow-y-auto">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ash font-semibold">
            Scheduled &amp; Pending Proposals
          </div>
          {loading ? (
            <p className="text-xs text-silver">Loading virtual dates...</p>
          ) : dates.length === 0 ? (
            <p className="text-xs text-silver">No virtual dates proposed in this chat yet.</p>
          ) : (
            dates.map((d) => {
              const iProposed = Boolean(selfAccountId && d.proposedById === selfAccountId);
              const activityLabel =
                VIRTUAL_ACTIVITY_OPTIONS.find((a) => a.value === d.activityType)?.label ||
                d.activityType;
              const formattedDate = new Date(d.scheduledFor).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              });
              return (
                <div key={d.id} className="p-3.5 rounded-[8px] bg-stage border border-edge flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-chalk">{activityLabel}</span>
                    <Badge
                      variant={
                        d.status === VirtualDateStatus.ACCEPTED
                          ? 'verified'
                          : d.status === VirtualDateStatus.CANCELLED
                            ? 'neutral'
                            : 'programme'
                      }
                      size="sm"
                    >
                      {d.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-silver">
                    {formattedDate} ({d.timezone}) · {iProposed ? 'Proposed by you' : `Proposed by ${partnerName}`}
                  </div>
                  {d.proposalNotes && <p className="text-xs text-ash italic">{d.proposalNotes}</p>}
                  {(d.status === VirtualDateStatus.PROPOSED || d.status === VirtualDateStatus.ACCEPTED) && (
                    <div className="flex justify-end gap-2 pt-1">
                      {d.status === VirtualDateStatus.PROPOSED && !iProposed && (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleRespond(d.id, 'accept')}
                          data-testid={`accept-date-${d.id}`}
                        >
                          Accept Date
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleRespond(d.id, 'cancel')}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function TogetherRelationshipModal({
  isOpen,
  onClose,
  matchId,
  partnerName,
  selfAccountId,
  refreshTick,
  onStatusChange,
  onMatchEnded,
}: {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  partnerName: string;
  selfAccountId: string | null;
  refreshTick: number;
  onStatusChange?: (status: RelationshipStatusDto | null) => void;
  onMatchEnded?: () => void;
}) {
  const [status, setStatus] = useState<RelationshipStatusDto | null>(null);
  const [milestones, setMilestones] = useState<RelationshipMilestoneDto[]>([]);
  const [journals, setJournals] = useState<RelationshipJournalDto[]>([]);
  const [activeSection, setActiveSection] = useState<'milestones' | 'journal'>('milestones');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDesc, setMilestoneDesc] = useState('');
  const [journalText, setJournalText] = useState('');
  const [confirmExit, setConfirmExit] = useState(false);
  const onStatusChangeRef = useRef(onStatusChange);
  const onMatchEndedRef = useRef(onMatchEnded);
  onStatusChangeRef.current = onStatusChange;
  onMatchEndedRef.current = onMatchEnded;

  const loadRelationship = useCallback(
    async (silent = false) => {
      if (!matchId) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const st = await api.getRelationshipStatus(matchId);
        setStatus(st);
        onStatusChangeRef.current?.(st);
        if (st.isActive) {
          const [mList, jList] = await Promise.all([
            api.listRelationshipMilestones(matchId),
            api.listRelationshipJournal(matchId),
          ]);
          setMilestones(mList);
          setJournals(jList);
        } else {
          setMilestones([]);
          setJournals([]);
        }
      } catch (err: any) {
        if (isClosedMatchError(err)) {
          onMatchEndedRef.current?.();
          return;
        }
        setError(err?.message || 'Could not load Relationship Mode state.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [matchId],
  );

  useEffect(() => {
    if (isOpen) {
      setConfirmExit(false);
      void loadRelationship(false);
    }
  }, [isOpen, loadRelationship]);

  useEffect(() => {
    if (isOpen && refreshTick > 0) {
      void loadRelationship(true);
    }
  }, [isOpen, refreshTick, loadRelationship]);

  const handlePropose = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.proposeRelationship(matchId);
      setNotice(
        res.bilateralActivated
          ? 'Relationship Mode is now mutually active!'
          : res.message || `Proposal sent to ${partnerName}. Waiting for their independent affirmation.`,
      );
      await loadRelationship(true);
    } catch (err: any) {
      if (isClosedMatchError(err)) {
        onMatchEnded?.();
        return;
      }
      setError(err?.message || 'Unable to propose Relationship Mode.');
    } finally {
      setBusy(false);
    }
  };

  const handleRespond = async (action: 'accept' | 'decline') => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.respondRelationship(matchId, action);
      setNotice(
        res.bilateralActivated
          ? 'Relationship Mode activated mutually!'
          : 'Relationship Mode proposal closed.',
      );
      await loadRelationship(true);
    } catch (err: any) {
      if (isClosedMatchError(err)) {
        onMatchEnded?.();
        return;
      }
      setError(err?.message || 'Could not update Relationship Mode proposal.');
    } finally {
      setBusy(false);
    }
  };

  const handleLeaveIndependently = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.leaveRelationship(matchId);
      setConfirmExit(false);
      setNotice(res.message);
      await loadRelationship(true);
    } catch (err: any) {
      setError(err?.message || 'Unable to leave Relationship Mode.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createRelationshipMilestone(matchId, {
        title: milestoneTitle.trim(),
        milestoneDate: new Date().toISOString().split('T')[0],
        description: milestoneDesc.trim() || undefined,
      });
      setMilestones((prev) => [...prev, created]);
      setMilestoneTitle('');
      setMilestoneDesc('');
    } catch (err: any) {
      setError(err?.message || 'Could not save milestone.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalText.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api.createRelationshipJournal(matchId, {
        entryText: journalText.trim(),
        entryDate: new Date().toISOString().split('T')[0],
      });
      setJournals((prev) => [...prev, created]);
      setJournalText('');
    } catch (err: any) {
      setError(err?.message || 'Could not save reflection.');
    } finally {
      setBusy(false);
    }
  };

  const proposedByMe = Boolean(
    status?.proposalStatus === 'proposed' && selfAccountId && status.proposedById === selfAccountId,
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Relationship Mode"
      description="Opt-in mutual space requiring two independent affirmative actions, with unilateral independent exit anytime."
      maxWidth="md"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-4" data-testid="together-relationship-modal">
        {error && (
          <div className="p-3 rounded-[8px] bg-[#2E1417] border border-danger/40 text-xs text-danger">
            {error}
          </div>
        )}
        {notice && (
          <div className="p-3 rounded-[8px] bg-iron border border-success/40 text-xs text-success">
            {notice}
          </div>
        )}

        <div className="p-3.5 rounded-[8px] bg-iron border border-edge flex items-start gap-2.5 text-xs text-silver">
          <LockIcon size={15} color="#8580C4" className="shrink-0 mt-0.5" />
          <span>
            Zero GPS tracking, zero activity surveillance, and either partner can exit independently without permission.
          </span>
        </div>

        {loading || !status ? (
          <p className="text-xs text-silver py-4 text-center">Loading Relationship Mode...</p>
        ) : status.isActive && status.space ? (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-[10px] bg-stage border border-iris/50 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-chalk">
                  <HeartHandshakeIcon size={16} color="#8580C4" />
                  <span>Active with {partnerName}</span>
                </div>
                <p className="text-xs text-ash mt-0.5">
                  Day {status.space.activeDays} · Activated{' '}
                  {new Date(status.space.activatedAt).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="verified" size="sm">
                Mutual Opt-In
              </Badge>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveSection('milestones')}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold border transition-colors ${
                  activeSection === 'milestones'
                    ? 'bg-iris/[0.14] border-iris text-chalk'
                    : 'bg-stage border-edge text-silver'
                }`}
              >
                Milestones ({milestones.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('journal')}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold border transition-colors ${
                  activeSection === 'journal'
                    ? 'bg-iris/[0.14] border-iris text-chalk'
                    : 'bg-stage border-edge text-silver'
                }`}
              >
                Shared Journal ({journals.length})
              </button>
            </div>

            {activeSection === 'milestones' ? (
              <div className="flex flex-col gap-3">
                <div className="max-h-[180px] overflow-y-auto space-y-2">
                  {milestones.map((m) => (
                    <div key={m.id} className="p-3 rounded-[8px] bg-stage border border-edge text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-chalk">{m.title}</strong>
                        <span className="text-[11px] font-mono text-ash">{m.milestoneDate}</span>
                      </div>
                      {m.description && <p className="text-silver mt-1">{m.description}</p>}
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddMilestone} className="flex flex-col gap-2 pt-2 border-t border-edge">
                  <Input
                    value={milestoneTitle}
                    onChange={(e) => setMilestoneTitle(e.target.value)}
                    placeholder="Add shared milestone title..."
                    maxLength={120}
                  />
                  <Input
                    value={milestoneDesc}
                    onChange={(e) => setMilestoneDesc(e.target.value)}
                    placeholder="Short memory or note (optional)..."
                    maxLength={500}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" size="sm" disabled={busy || !milestoneTitle.trim()}>
                      Save Milestone
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="max-h-[180px] overflow-y-auto space-y-2">
                  {journals.length === 0 ? (
                    <p className="text-xs text-silver">No shared journal reflections yet.</p>
                  ) : (
                    journals.map((j) => (
                      <div key={j.id} className="p-3 rounded-[8px] bg-stage border border-edge text-xs">
                        <div className="flex items-center justify-between text-[11px] text-ash mb-1">
                          <span>{j.createdById === selfAccountId ? 'You' : partnerName}</span>
                          <span className="font-mono">{j.entryDate}</span>
                        </div>
                        <p className="text-chalk whitespace-pre-wrap">{j.entryText}</p>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleAddJournal} className="flex flex-col gap-2 pt-2 border-t border-edge">
                  <textarea
                    rows={2}
                    maxLength={1500}
                    value={journalText}
                    onChange={(e) => setJournalText(e.target.value)}
                    placeholder="Write a reflection visible only to you and your partner..."
                    className="w-full p-3 rounded-[8px] bg-stage border border-edge text-xs text-chalk focus:border-iris outline-none resize-none"
                  />
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" size="sm" disabled={busy || !journalText.trim()}>
                      Save Reflection
                    </Button>
                  </div>
                </form>
              </div>
            )}

            <div className="pt-3 border-t border-edge">
              {!confirmExit ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmExit(true)}
                  data-testid="relationship-leave-btn"
                >
                  Exit Relationship Mode Independently
                </Button>
              ) : (
                <div className="p-3.5 rounded-[8px] bg-[#2E1417] border border-danger/40 flex flex-col gap-2.5 text-xs">
                  <p className="text-chalk">
                    Deactivate Relationship Mode now? Your active conversation and match stay intact unless you separately unmatch, and no partner approval is required.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setConfirmExit(false)}>
                      Keep Active
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={handleLeaveIndependently}
                      data-testid="confirm-relationship-leave-btn"
                    >
                      Confirm Independent Exit
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : status.proposalStatus === 'proposed' ? (
          <div className="p-5 rounded-[10px] bg-iron border border-edge flex flex-col gap-3">
            {proposedByMe ? (
              <>
                <div className="text-sm font-semibold text-chalk">
                  Proposal Sent to {partnerName}
                </div>
                <p className="text-xs text-silver">
                  Relationship Mode requires two independent affirmative actions. Waiting for {partnerName} to confirm.
                </p>
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleRespond('decline')}
                  >
                    Withdraw Proposal
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-chalk">
                  {partnerName} proposed Relationship Mode
                </div>
                <p className="text-xs text-silver">
                  Confirming activates your shared Milestones and Journal space. You may still exit independently at any time.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleRespond('decline')}
                  >
                    Decline
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleRespond('accept')}
                    data-testid="accept-relationship-btn"
                  >
                    <CheckIcon size={14} /> Accept &amp; Activate
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="p-5 rounded-[10px] bg-iron border border-edge flex flex-col gap-4">
            <div className="text-sm font-semibold text-chalk">
              Enter Relationship Mode Together
            </div>
            <p className="text-xs text-silver leading-relaxed">
              Send a gentle, opt-in invitation to {partnerName}. Nothing changes until both of you independently choose to activate.
            </p>
            <div className="flex justify-end">
              <Button
                variant="primary"
                disabled={busy}
                isLoading={busy}
                onClick={handlePropose}
                data-testid="propose-relationship-btn"
              >
                Propose Relationship Mode
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
