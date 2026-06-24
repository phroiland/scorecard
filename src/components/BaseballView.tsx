import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@stevederico/skateboard-ui/shadcn/ui/card';
import { Button } from '@stevederico/skateboard-ui/shadcn/ui/button';
import { Input } from '@stevederico/skateboard-ui/shadcn/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@stevederico/skateboard-ui/shadcn/ui/popover';
import { ChevronLeft, ChevronRight, RotateCcw } from '@stevederico/skateboard-ui/icons';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@stevederico/skateboard-ui/shadcn/ui/drawer';

/** A single player in a team's batting lineup. */
interface Player {
  /** Jersey number */
  num: string;
  /** Player name */
  name: string;
  /** Fielding position abbreviation */
  pos: string;
}

/** The four bases a runner can occupy/score. */
type Base = 'first' | 'second' | 'third' | 'home';

/** A single at-bat cell: result notation plus base advancement and out count. */
interface AtBat {
  /** Scoring notation (e.g. 'K', '1B', '6-3') */
  result: string;
  /** Runner reached first base */
  first: boolean;
  /** Runner reached second base */
  second: boolean;
  /** Runner reached third base */
  third: boolean;
  /** Runner scored (home) */
  home: boolean;
  /** Outs recorded on this at-bat (0, 1, or 2 for a double play) */
  out: number;
}

/** A team's full scorecard: name, 9-player lineup, and a 9x9 at-bat grid. */
interface Team {
  /** Team name */
  name: string;
  /** Batting lineup (9 players) */
  players: Player[];
  /** At-bats indexed by [playerIdx][inning] */
  atBats: AtBat[][];
}

// Brand palette
const NAVY   = '#1B2838';
const RED    = '#8B2500';
const GOLD   = '#C4A265';
const CREAM  = '#F5E6C8';
const PARCH  = 'rgba(245,230,200,0.18)';
const PARCH2 = 'rgba(245,230,200,0.35)';

const FONT_HEAD = "'Playfair Display', Georgia, 'Times New Roman', serif";
const FONT_MONO = "'Special Elite', 'Courier New', monospace";

const INITIAL_PLAYERS: Player[] = Array(9).fill(null).map(() => ({ num: '', name: '', pos: '' }));
const INITIAL_ATBAT: AtBat = { result: '', first: false, second: false, third: false, home: false, out: 0 };

/**
 * Creates a fresh team object with default players and at-bats.
 * @param name - Team name
 * @returns Team object
 */
const createTeam = (name: string): Team => ({
  name,
  players: INITIAL_PLAYERS.map(p => ({ ...p })),
  atBats: Array(9).fill(null).map(() => Array(9).fill(null).map(() => ({ ...INITIAL_ATBAT })))
});

/**
 * Baseball scorecard component for official scoring.
 * Supports two teams (away/home) with tab switching.
 * Features diamond-based at-bat boxes, player lineup tracking,
 * and standard baseball notation (K, BB, 6-3, F8, etc).
 *
 * @component
 * @returns Baseball scorecard view
 */
export default function BaseballView() {
  const [teams, setTeams] = useState<Team[]>([createTeam('AWAY'), createTeam('HOME')]);
  const [activeTeam, setActiveTeam] = useState(0);
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [mobilePlayerIdx, setMobilePlayerIdx] = useState(0);
  const [mobileInningIdx, setMobileInningIdx] = useState(0);
  const [mobileView, setMobileView] = useState<'card' | 'stats'>('card');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const players = teams[activeTeam].players;
  const atBats = teams[activeTeam].atBats;

  /**
   * Counts outs in a specific inning.
   * @param inning - Inning index
   * @returns Number of outs
   */
  const getInningOuts = (inning: number): number => {
    return atBats.reduce((sum, player) => sum + (player[inning].out || 0), 0);
  };

  /**
   * Gets the ordinal out number for a specific cell within its inning.
   * Counts outs from players above in the batting order.
   * @param playerIdx - Player index
   * @param inning - Inning index
   * @returns The out number (1, 2, or 3) for this cell
   */
  const getOutNumber = (playerIdx: number, inning: number): number => {
    let outsBeforeThis = 0;
    for (let i = 0; i < playerIdx; i++) {
      outsBeforeThis += atBats[i][inning].out || 0;
    }
    return outsBeforeThis + 1;
  };

  /**
   * Checks if a result is an out.
   * @param result - At-bat result
   * @returns True if result is an out
   */
  const isOutResult = (result: string): boolean => {
    return ['K', 'F', 'GO', 'PO'].some(r => result.includes(r)) ||
           result.includes('-') ||
           result === 'DP';
  };

  /**
   * Updates player info in the active team's lineup.
   * @param idx - Player index
   * @param field - Field to update
   * @param value - New value
   */
  const updatePlayer = (idx: number, field: keyof Player, value: string) => {
    const newTeams = [...teams];
    const newPlayers = [...newTeams[activeTeam].players];
    newPlayers[idx] = { ...newPlayers[idx], [field]: value };
    newTeams[activeTeam] = { ...newTeams[activeTeam], players: newPlayers };
    setTeams(newTeams);
  };

  /**
   * Updates at-bat result for a specific cell.
   * Enforces 3-out limit per inning.
   * @param playerIdx - Player index
   * @param inning - Inning index
   * @param result - At-bat result notation
   */
  const updateAtBat = (playerIdx: number, inning: number, result: string) => {
    const currentOuts = getInningOuts(inning);
    const currentCellIsOut = atBats[playerIdx][inning].out > 0;
    const newResultIsOut = isOutResult(result);
    const dpOuts = result === 'DP' ? 2 : (newResultIsOut ? 1 : 0);

    if (newResultIsOut && !currentCellIsOut && currentOuts + dpOuts > 3) {
      return;
    }

    const newTeams = [...teams];
    const newAtBats = [...newTeams[activeTeam].atBats];
    newAtBats[playerIdx] = [...newAtBats[playerIdx]];
    newAtBats[playerIdx][inning] = {
      ...newAtBats[playerIdx][inning],
      result,
      first: ['1B', '2B', '3B', 'HR', 'BB', 'HBP', 'E'].some(r => result.includes(r)),
      second: ['2B', '3B', 'HR'].some(r => result.includes(r)),
      third: ['3B', 'HR'].some(r => result.includes(r)),
      home: result.includes('HR'),
      out: dpOuts
    };
    newTeams[activeTeam] = { ...newTeams[activeTeam], atBats: newAtBats };
    setTeams(newTeams);
    setOpenPopover(null);
  };

  /**
   * Toggles base advancement for a runner on the active team.
   * @param playerIdx - Player index
   * @param inning - Inning index
   * @param base - Base to toggle
   */
  const toggleBase = (playerIdx: number, inning: number, base: Base) => {
    const newTeams = [...teams];
    const newAtBats = [...newTeams[activeTeam].atBats];
    newAtBats[playerIdx] = [...newAtBats[playerIdx]];
    newAtBats[playerIdx][inning] = {
      ...newAtBats[playerIdx][inning],
      [base]: !newAtBats[playerIdx][inning][base]
    };
    newTeams[activeTeam] = { ...newTeams[activeTeam], atBats: newAtBats };
    setTeams(newTeams);
  };

  /**
   * Resets both teams back to initial state.
   */
  const resetScorecard = () => {
    setTeams([createTeam('AWAY'), createTeam('HOME')]);
    setActiveTeam(0);
  };

  /**
   * Updates the active team's name.
   * @param idx - Team index (0=away, 1=home)
   * @param name - New team name
   */
  const updateTeamName = (idx: number, name: string) => {
    const newTeams = [...teams];
    newTeams[idx] = { ...newTeams[idx], name };
    setTeams(newTeams);
  };

  /**
   * Calculates runs scored in an inning.
   * @param inning - Inning index
   * @returns Runs scored
   */
  const getInningRuns = (inning: number): number => {
    return atBats.reduce((sum, player) => sum + (player[inning].home ? 1 : 0), 0);
  };

  /**
   * Calculates total hits.
   * @returns Total hits
   */
  const getTotalHits = (): number => {
    return atBats.flat().filter(ab =>
      ['1B', '2B', '3B', 'HR'].some(h => ab.result.includes(h))
    ).length;
  };

  const innings = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const quickResults = ['K', 'BB', '1B', '2B', '3B', 'HR', 'F7', 'F8', 'F9', '6-3', '4-3', '5-3', 'DP'];

  /**
   * Handles result selection on mobile — updates at-bat and closes drawer.
   * @param result - At-bat result notation
   */
  const handleMobileResult = (result: string) => {
    updateAtBat(mobilePlayerIdx, mobileInningIdx, result);
    setDrawerOpen(false);
  };

  const mobileAb = atBats[mobilePlayerIdx]?.[mobileInningIdx] || INITIAL_ATBAT;
  const mobileInningOuts = getInningOuts(mobileInningIdx);
  const mobileCellIsOut = mobileAb.out > 0;
  const mobileInningClosed = mobileInningOuts >= 3 && !mobileAb.result;

  return (
    <>
      {/* MOBILE LAYOUT */}
      <div className="flex flex-col flex-1 md:hidden overflow-hidden pb-20">
        {mobileView === 'card' ? (
          <>
            {/* Top bar: team tabs + stats button */}
            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${GOLD}` }}>
              <div className="flex items-center gap-1">
                {teams.map((team, idx) => (
                  <button
                    key={idx}
                    className="px-2 py-1 text-sm rounded transition-colors"
                    style={{
                      fontFamily: FONT_HEAD,
                      fontWeight: activeTeam === idx ? 800 : 500,
                      background: activeTeam === idx ? NAVY : 'transparent',
                      color: activeTeam === idx ? CREAM : '#5A3E28',
                      letterSpacing: '0.05em',
                    }}
                    onClick={() => setActiveTeam(idx)}
                  >
                    {idx === 0 ? '⚾' : '🏟️'} {team.name}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setMobileView('stats')}
                style={{ fontFamily: FONT_HEAD, borderColor: GOLD, color: NAVY }}>
                Stats
              </Button>
            </div>

            {/* Inning dots */}
            <div className="flex justify-center gap-1 py-2">
              {innings.map((_, i) => (
                <button
                  key={i}
                  className="w-7 h-7 rounded-full text-xs font-bold transition-colors"
                  style={{
                    fontFamily: FONT_HEAD,
                    background: mobileInningIdx === i ? NAVY : 'rgba(196,162,101,0.2)',
                    color: mobileInningIdx === i ? CREAM : '#5A3E28',
                  }}
                  onClick={() => setMobileInningIdx(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Big diamond — tap to open drawer */}
            <div
              className={`flex-1 flex items-center justify-center px-12 ${mobileInningClosed ? 'opacity-30' : 'cursor-pointer active:scale-95 transition-transform'}`}
              onClick={() => !mobileInningClosed && setDrawerOpen(true)}
            >
              <svg viewBox="0 0 68 56" className="w-full max-w-xs">
                <path
                  d="M34 4 L56 28 L34 52 L12 28 Z"
                  fill="none"
                  stroke={GOLD}
                  strokeWidth="1.5"
                />
                {mobileAb.first && (
                  <line x1="34" y1="52" x2="56" y2="28" stroke={RED} strokeWidth="3" />
                )}
                {mobileAb.second && (
                  <line x1="56" y1="28" x2="34" y2="4" stroke={RED} strokeWidth="3" />
                )}
                {mobileAb.third && (
                  <line x1="34" y1="4" x2="12" y2="28" stroke={RED} strokeWidth="3" />
                )}
                {mobileAb.home && (
                  <>
                    <line x1="12" y1="28" x2="34" y2="52" stroke={RED} strokeWidth="3" />
                    <path d="M34 8 L52 28 L34 48 L16 28 Z" fill={RED} fillOpacity="0.15" />
                  </>
                )}
                <text x="34" y="28" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="bold"
                  fill={NAVY} style={{ fontFamily: FONT_HEAD }}>
                  {mobileAb.result}
                </text>
                {mobileCellIsOut && (
                  <>
                    <circle cx="57" cy="46" r="8" fill={RED} />
                    <text x="57" y="46" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="bold" fill={CREAM}>
                      {getOutNumber(mobilePlayerIdx, mobileInningIdx)}
                    </text>
                  </>
                )}
              </svg>
            </div>

            {/* Player info */}
            <div className="px-4 py-2 text-center">
              <p className="font-bold text-lg" style={{ fontFamily: FONT_HEAD, color: NAVY, letterSpacing: '0.04em' }}>
                {players[mobilePlayerIdx].num ? `#${players[mobilePlayerIdx].num} ` : ''}
                {players[mobilePlayerIdx].name || `Batter ${mobilePlayerIdx + 1}`}
              </p>
              <p className="text-sm" style={{ fontFamily: FONT_MONO, color: '#5A3E28' }}>
                {players[mobilePlayerIdx].pos || '--'} · Batting {mobilePlayerIdx + 1} of 9
              </p>
            </div>

            {/* Bottom nav: prev/next batter + inning arrows */}
            <div className="flex items-center justify-between px-3 py-3" style={{ borderTop: `1px solid ${GOLD}` }}>
              <Button
                variant="outline"
                size="sm"
                disabled={mobilePlayerIdx === 0}
                onClick={() => setMobilePlayerIdx(p => p - 1)}
                style={{ fontFamily: FONT_HEAD, borderColor: GOLD, color: NAVY }}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={mobileInningIdx === 0}
                  onClick={() => setMobileInningIdx(i => i - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-bold w-12 text-center" style={{ fontFamily: FONT_HEAD, color: NAVY, letterSpacing: '0.04em' }}>
                  Inn {mobileInningIdx + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={mobileInningIdx === 8}
                  onClick={() => setMobileInningIdx(i => i + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={mobilePlayerIdx === 8}
                onClick={() => setMobilePlayerIdx(p => p + 1)}
                style={{ fontFamily: FONT_HEAD, borderColor: GOLD, color: NAVY }}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Drawer for result entry */}
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle style={{ fontFamily: FONT_HEAD, color: NAVY, letterSpacing: '0.04em' }}>
                    {players[mobilePlayerIdx].name || `Batter ${mobilePlayerIdx + 1}`} — Inning {mobileInningIdx + 1}
                  </DrawerTitle>
                </DrawerHeader>
                <div className="px-4 pb-6 space-y-3">
                  <div className="grid grid-cols-5 gap-2">
                    {quickResults.map(r => {
                      const rIsOut = isOutResult(r);
                      const rOuts = r === 'DP' ? 2 : (rIsOut ? 1 : 0);
                      const wouldExceed = rIsOut && !mobileCellIsOut && mobileInningOuts + rOuts > 3;
                      return (
                        <Button
                          key={r}
                          variant="outline"
                          className="h-10 text-sm"
                          style={{ fontFamily: FONT_MONO, borderColor: GOLD, color: NAVY }}
                          disabled={wouldExceed}
                          onClick={() => handleMobileResult(r)}
                        >
                          {r}
                        </Button>
                      );
                    })}
                  </div>
                  {mobileInningOuts >= 3 && !mobileCellIsOut && (
                    <p className="text-xs font-semibold text-center" style={{ fontFamily: FONT_MONO, color: RED }}>
                      3 outs recorded in inning {mobileInningIdx + 1}
                    </p>
                  )}
                  <Input
                    placeholder="Custom..."
                    className="h-10 text-sm"
                    style={{ fontFamily: FONT_MONO, borderColor: GOLD }}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') {
                        handleMobileResult(e.currentTarget.value.toUpperCase());
                      }
                    }}
                  />
                  <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${GOLD}` }}>
                    <span className="text-sm" style={{ fontFamily: FONT_MONO, color: '#5A3E28' }}>Bases:</span>
                    {(['first', 'second', 'third', 'home'] as Base[]).map((base, i) => (
                      <Button
                        key={base}
                        variant={mobileAb[base] ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 w-8 p-0"
                        style={{
                          fontFamily: FONT_HEAD,
                          background: mobileAb[base] ? RED : 'transparent',
                          borderColor: mobileAb[base] ? RED : GOLD,
                          color: mobileAb[base] ? CREAM : NAVY,
                        }}
                        onClick={() => toggleBase(mobilePlayerIdx, mobileInningIdx, base)}
                      >
                        {i === 3 ? 'H' : i + 1}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full"
                    style={{ fontFamily: FONT_MONO, color: '#5A3E28' }}
                    onClick={() => handleMobileResult('')}
                  >
                    Clear
                  </Button>
                </div>
              </DrawerContent>
            </Drawer>
          </>
        ) : (
          /* STATS VIEW */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Stats header */}
            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${GOLD}` }}>
              <Button variant="ghost" size="sm" onClick={() => setMobileView('card')}
                style={{ fontFamily: FONT_HEAD, color: NAVY }}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div className="flex items-center gap-1">
                {teams.map((team, idx) => (
                  <button
                    key={idx}
                    className="px-2 py-1 text-sm rounded transition-colors"
                    style={{
                      fontFamily: FONT_HEAD,
                      fontWeight: activeTeam === idx ? 800 : 500,
                      background: activeTeam === idx ? NAVY : 'transparent',
                      color: activeTeam === idx ? CREAM : '#5A3E28',
                    }}
                    onClick={() => setActiveTeam(idx)}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={resetScorecard}
                style={{ borderColor: GOLD, color: NAVY }}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Linescore */}
            <div className="flex items-center px-3 py-2 text-xs" style={{ background: NAVY, color: CREAM, borderBottom: `1px solid ${GOLD}`, fontFamily: FONT_MONO }}>
              <span className="w-20 font-bold truncate" style={{ fontFamily: FONT_HEAD, letterSpacing: '0.05em' }}>
                {teams[activeTeam].name}
              </span>
              {innings.map((_, i) => (
                <span key={i} className="w-6 text-center">{getInningRuns(i) || '-'}</span>
              ))}
              <span className="w-8 text-center font-bold ml-2" style={{ color: GOLD }}>
                {atBats.flat().filter(ab => ab.home).length}R
              </span>
            </div>

            {/* Player rows */}
            <div className="flex-1 overflow-auto">
              {players.map((player, pIdx) => {
                const pAB = atBats[pIdx].filter(ab => ab.result && !['BB', 'HBP'].includes(ab.result)).length;
                const pH = atBats[pIdx].filter(ab => ['1B', '2B', '3B', 'HR'].some(h => ab.result.includes(h))).length;
                const pR = atBats[pIdx].filter(ab => ab.home).length;
                return (
                  <div
                    key={pIdx}
                    className="flex items-center justify-between px-3 py-3 cursor-pointer transition-colors"
                    style={{ borderBottom: `1px solid ${GOLD}` }}
                    onClick={() => { setMobilePlayerIdx(pIdx); setMobileView('card'); }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs w-4" style={{ color: '#5A3E28', fontFamily: FONT_MONO }}>{pIdx + 1}</span>
                      <div className="min-w-0">
                        <span className="font-bold text-sm truncate" style={{ fontFamily: FONT_HEAD, color: NAVY, letterSpacing: '0.03em' }}>
                          {player.num ? `#${player.num} ` : ''}{player.name || `Batter ${pIdx + 1}`}
                        </span>
                        <span className="text-xs ml-2" style={{ fontFamily: FONT_MONO, color: '#5A3E28' }}>{player.pos || '--'}</span>
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs shrink-0" style={{ fontFamily: FONT_MONO, color: NAVY }}>
                      <span>AB:{pAB}</span>
                      <span>H:{pH}</span>
                      <span style={{ color: RED, fontWeight: 700 }}>R:{pR}</span>
                    </div>
                  </div>
                );
              })}
              {/* Totals row */}
              <div className="flex items-center justify-between px-3 py-3 font-bold" style={{ background: NAVY, color: CREAM }}>
                <span className="text-sm" style={{ fontFamily: FONT_HEAD, letterSpacing: '0.06em' }}>TOTALS</span>
                <div className="flex gap-3 text-xs" style={{ fontFamily: FONT_MONO }}>
                  <span>AB:{atBats.flat().filter(ab => ab.result && !['BB', 'HBP'].includes(ab.result)).length}</span>
                  <span>H:{getTotalHits()}</span>
                  <span style={{ color: GOLD }}>R:{atBats.flat().filter(ab => ab.home).length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP LAYOUT */}
      <div className="hidden md:flex flex-1 flex-col p-2 md:p-4 overflow-auto">
        <Card className="w-full max-w-6xl mx-auto" style={{ border: `2px solid ${GOLD}`, borderRadius: '4px' }}>
          <CardHeader className="pb-2" style={{ background: NAVY, borderRadius: '2px 2px 0 0', borderBottom: `2px solid ${GOLD}` }}>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {teams.map((team, idx) => (
                  <div
                    key={idx}
                    className="cursor-pointer px-1 pb-1 transition-all flex items-center gap-1"
                    style={{
                      borderBottom: activeTeam === idx ? `3px solid ${GOLD}` : '3px solid transparent',
                      opacity: activeTeam === idx ? 1 : 0.5,
                    }}
                    onClick={() => setActiveTeam(idx)}
                  >
                    <span className="text-lg">{idx === 0 ? '⚾' : '🏟️'}</span>
                    <Input
                      value={team.name}
                      onChange={(e) => updateTeamName(idx, e.target.value.toUpperCase())}
                      onClick={(e) => { setActiveTeam(idx); e.stopPropagation(); }}
                      className="h-8 w-28 border-0 bg-transparent text-center"
                      style={{
                        fontFamily: FONT_HEAD,
                        fontWeight: 800,
                        fontSize: '14px',
                        color: CREAM,
                        letterSpacing: '0.08em',
                      }}
                      maxLength={12}
                    />
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={resetScorecard}
                style={{ fontFamily: FONT_HEAD, borderColor: GOLD, color: CREAM, background: 'transparent' }}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2" style={{ background: PARCH }}>
            {/* Scorecard Grid */}
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs" style={{ fontFamily: FONT_MONO }}>
                <thead>
                  <tr style={{ background: NAVY }}>
                    <th className="p-1 w-8 text-center" style={{ border: `1px solid ${GOLD}`, color: CREAM, fontFamily: FONT_HEAD, letterSpacing: '0.06em' }}>#</th>
                    <th className="p-1 w-28 text-left"   style={{ border: `1px solid ${GOLD}`, color: CREAM, fontFamily: FONT_HEAD, letterSpacing: '0.06em' }}>PLAYER</th>
                    <th className="p-1 w-8 text-center"  style={{ border: `1px solid ${GOLD}`, color: CREAM, fontFamily: FONT_HEAD, letterSpacing: '0.06em' }}>POS</th>
                    {innings.map(i => (
                      <th key={i} className="p-1 w-16 text-center font-bold" style={{ border: `1px solid ${GOLD}`, color: GOLD, fontFamily: FONT_HEAD, fontSize: '13px' }}>{i}</th>
                    ))}
                    <th className="p-1 w-8 text-center" style={{ border: `1px solid ${GOLD}`, color: CREAM, fontFamily: FONT_HEAD, background: 'rgba(196,162,101,0.15)' }}>AB</th>
                    <th className="p-1 w-8 text-center" style={{ border: `1px solid ${GOLD}`, color: CREAM, fontFamily: FONT_HEAD, background: 'rgba(196,162,101,0.15)' }}>H</th>
                    <th className="p-1 w-8 text-center" style={{ border: `1px solid ${GOLD}`, color: GOLD,  fontFamily: FONT_HEAD, background: 'rgba(196,162,101,0.15)' }}>R</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, pIdx) => (
                    <tr key={pIdx} style={{ background: pIdx % 2 === 0 ? 'transparent' : 'rgba(196,162,101,0.06)' }}>
                      {/* Jersey Number */}
                      <td className="p-0" style={{ border: `1px solid ${GOLD}` }}>
                        <Input
                          value={player.num}
                          onChange={(e) => updatePlayer(pIdx, 'num', e.target.value)}
                          className="h-14 w-full text-center text-xs border-0 bg-transparent p-0"
                          style={{ fontFamily: FONT_HEAD, color: NAVY, fontWeight: 700 }}
                          maxLength={2}
                          placeholder="--"
                        />
                      </td>
                      {/* Player Name */}
                      <td className="p-0" style={{ border: `1px solid ${GOLD}` }}>
                        <Input
                          value={player.name}
                          onChange={(e) => updatePlayer(pIdx, 'name', e.target.value)}
                          className="h-14 w-full text-xs border-0 bg-transparent px-1"
                          style={{ fontFamily: FONT_HEAD, color: NAVY, fontWeight: 600 }}
                          placeholder={`Batter ${pIdx + 1}`}
                        />
                      </td>
                      {/* Position */}
                      <td className="p-0" style={{ border: `1px solid ${GOLD}` }}>
                        <Input
                          value={player.pos}
                          onChange={(e) => updatePlayer(pIdx, 'pos', e.target.value.toUpperCase())}
                          className="h-14 w-full text-center text-xs border-0 bg-transparent p-0"
                          style={{ fontFamily: FONT_MONO, color: '#5A3E28' }}
                          maxLength={2}
                          placeholder="--"
                        />
                      </td>
                      {/* At-Bat Boxes with Diamonds */}
                      {innings.map((_, iIdx) => {
                        const ab = atBats[pIdx][iIdx];
                        const cellKey = `${pIdx}-${iIdx}`;
                        const inningOuts = getInningOuts(iIdx);
                        const cellIsOut = ab.out > 0;
                        const cellHasResult = ab.result !== '';
                        const inningClosed = inningOuts >= 3 && !cellHasResult;
                        return (
                          <td key={iIdx} className="p-0 [&>button]:p-0"
                            style={{ border: `1px solid ${GOLD}`, background: inningClosed ? 'rgba(196,162,101,0.12)' : 'transparent' }}>
                            <Popover open={openPopover === cellKey} onOpenChange={(open) => !inningClosed && setOpenPopover(open ? cellKey : null)}>
                              <PopoverTrigger render={<div className={`w-full h-14 transition-colors ${inningClosed ? 'cursor-not-allowed opacity-30' : 'cursor-pointer hover:bg-[rgba(196,162,101,0.15)]'}`} />}>
                                <svg viewBox="0 0 68 56" className="w-full h-full">
                                  {/* Diamond outline */}
                                  <path
                                    d="M34 4 L56 28 L34 52 L12 28 Z"
                                    fill="none"
                                    stroke={GOLD}
                                    strokeWidth="1.5"
                                    strokeOpacity="0.6"
                                  />
                                  {/* Base lines when reached */}
                                  {ab.first && (
                                    <line x1="34" y1="52" x2="56" y2="28" stroke={RED} strokeWidth="3" />
                                  )}
                                  {ab.second && (
                                    <line x1="56" y1="28" x2="34" y2="4" stroke={RED} strokeWidth="3" />
                                  )}
                                  {ab.third && (
                                    <line x1="34" y1="4" x2="12" y2="28" stroke={RED} strokeWidth="3" />
                                  )}
                                  {ab.home && (
                                    <>
                                      <line x1="12" y1="28" x2="34" y2="52" stroke={RED} strokeWidth="3" />
                                      <path d="M34 8 L52 28 L34 48 L16 28 Z" fill={RED} fillOpacity="0.12" />
                                    </>
                                  )}
                                  {/* Result text in center */}
                                  <text x="34" y="28" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="bold" fill={NAVY} style={{ fontFamily: FONT_HEAD }}>
                                    {ab.result}
                                  </text>
                                  {/* Out number in filled circle, bottom right */}
                                  {cellIsOut && (
                                    <>
                                      <circle cx="57" cy="46" r="8" fill={RED} />
                                      <text x="57" y="46" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="bold" fill={CREAM}>
                                        {getOutNumber(pIdx, iIdx)}
                                      </text>
                                    </>
                                  )}
                                </svg>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-2" style={{ borderColor: GOLD }}>
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold" style={{ fontFamily: FONT_HEAD, color: NAVY, letterSpacing: '0.05em' }}>Quick Entry:</p>
                                  <div className="grid grid-cols-5 gap-1">
                                    {quickResults.map(r => {
                                      const rIsOut = isOutResult(r);
                                      const rOuts = r === 'DP' ? 2 : (rIsOut ? 1 : 0);
                                      const wouldExceed = rIsOut && !cellIsOut && inningOuts + rOuts > 3;
                                      return (
                                        <Button
                                          key={r}
                                          variant="outline"
                                          size="sm"
                                          className="h-7 text-xs"
                                          style={{ fontFamily: FONT_MONO, borderColor: GOLD, color: NAVY }}
                                          disabled={wouldExceed}
                                          onClick={() => updateAtBat(pIdx, iIdx, r)}
                                        >
                                          {r}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                  {inningOuts >= 3 && !cellIsOut && (
                                    <p className="text-xs font-semibold" style={{ fontFamily: FONT_MONO, color: RED }}>
                                      3 outs recorded in inning {iIdx + 1}
                                    </p>
                                  )}
                                  <div className="flex gap-1 mt-2">
                                    <Input
                                      placeholder="Custom..."
                                      className="h-7 text-xs"
                                      style={{ fontFamily: FONT_MONO, borderColor: GOLD }}
                                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                        if (e.key === 'Enter') {
                                          updateAtBat(pIdx, iIdx, e.currentTarget.value.toUpperCase());
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="flex gap-2 pt-2" style={{ borderTop: `1px solid ${GOLD}` }}>
                                    <p className="text-xs" style={{ fontFamily: FONT_MONO, color: '#5A3E28' }}>Bases:</p>
                                    {(['first', 'second', 'third', 'home'] as Base[]).map((base, i) => (
                                      <Button
                                        key={base}
                                        variant={ab[base] ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-6 w-6 p-0 text-xs"
                                        style={{
                                          fontFamily: FONT_HEAD,
                                          background: ab[base] ? RED : 'transparent',
                                          borderColor: ab[base] ? RED : GOLD,
                                          color: ab[base] ? CREAM : NAVY,
                                        }}
                                        onClick={() => toggleBase(pIdx, iIdx, base)}
                                      >
                                        {i === 3 ? 'H' : i + 1}
                                      </Button>
                                    ))}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full h-6 text-xs"
                                    style={{ fontFamily: FONT_MONO, color: '#5A3E28' }}
                                    onClick={() => updateAtBat(pIdx, iIdx, '')}
                                  >
                                    Clear
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </td>
                        );
                      })}
                      {/* Stats */}
                      <td className="p-1 text-center" style={{ border: `1px solid ${GOLD}`, background: 'rgba(196,162,101,0.1)', fontFamily: FONT_MONO, color: NAVY }}>
                        {atBats[pIdx].filter(ab => ab.result && !['BB', 'HBP'].includes(ab.result)).length}
                      </td>
                      <td className="p-1 text-center" style={{ border: `1px solid ${GOLD}`, background: 'rgba(196,162,101,0.1)', fontFamily: FONT_MONO, color: NAVY }}>
                        {atBats[pIdx].filter(ab => ['1B', '2B', '3B', 'HR'].some(h => ab.result.includes(h))).length}
                      </td>
                      <td className="p-1 text-center" style={{ border: `1px solid ${GOLD}`, background: 'rgba(196,162,101,0.1)', fontFamily: FONT_HEAD, color: RED, fontWeight: 700 }}>
                        {atBats[pIdx].filter(ab => ab.home).length}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr style={{ background: NAVY }}>
                    <td colSpan={3} className="p-1 text-right pr-2" style={{ border: `1px solid ${GOLD}`, fontFamily: FONT_HEAD, color: CREAM, letterSpacing: '0.08em', fontWeight: 800 }}>
                      TOTALS
                    </td>
                    {innings.map((_, iIdx) => (
                      <td key={iIdx} className="p-1 text-center" style={{ border: `1px solid ${GOLD}`, fontFamily: FONT_HEAD, color: getInningRuns(iIdx) > 0 ? GOLD : 'rgba(196,162,101,0.4)', fontWeight: 700, fontSize: '13px' }}>
                        {getInningRuns(iIdx) || ''}
                      </td>
                    ))}
                    <td className="p-1 text-center" style={{ border: `1px solid ${GOLD}`, fontFamily: FONT_MONO, color: CREAM }}>
                      {atBats.flat().filter(ab => ab.result && !['BB', 'HBP'].includes(ab.result)).length}
                    </td>
                    <td className="p-1 text-center" style={{ border: `1px solid ${GOLD}`, fontFamily: FONT_MONO, color: CREAM }}>
                      {getTotalHits()}
                    </td>
                    <td className="p-1 text-center" style={{ border: `1px solid ${GOLD}`, fontFamily: FONT_HEAD, color: GOLD, fontWeight: 800, fontSize: '13px' }}>
                      {atBats.flat().filter(ab => ab.home).length}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="mt-4 p-3 rounded-sm grid grid-cols-2 md:grid-cols-4 gap-2 text-xs"
              style={{ background: 'rgba(27,40,56,0.06)', border: `1px solid ${GOLD}`, fontFamily: FONT_MONO, color: '#5A3E28' }}>
              <div><strong style={{ color: NAVY }}>K</strong> = Strikeout</div>
              <div><strong style={{ color: NAVY }}>BB</strong> = Walk</div>
              <div><strong style={{ color: NAVY }}>1B/2B/3B</strong> = Single/Double/Triple</div>
              <div><strong style={{ color: RED }}>HR</strong> = Home Run</div>
              <div><strong style={{ color: NAVY }}>F7/F8/F9</strong> = Fly out to LF/CF/RF</div>
              <div><strong style={{ color: NAVY }}>6-3</strong> = SS to 1B groundout</div>
              <div><strong style={{ color: NAVY }}>DP</strong> = Double Play</div>
              <div><strong style={{ color: NAVY }}>Positions</strong>: 1-P 2-C 3-1B 4-2B 5-3B 6-SS 7-LF 8-CF 9-RF</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
