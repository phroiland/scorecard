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
  num: string;
  name: string;
  pos: string;
}

/** The four bases a runner can occupy/score. */
type Base = 'first' | 'second' | 'third' | 'home';

/** A single at-bat cell: result notation plus base advancement and out count. */
interface AtBat {
  result: string;
  first: boolean;
  second: boolean;
  third: boolean;
  home: boolean;
  out: number;
}

/** A team's full scorecard: name, 9-player lineup, and a 9x9 at-bat grid. */
interface Team {
  name: string;
  players: Player[];
  atBats: AtBat[][];
}

// Brand colors — used only for SVG and conditional active states
const NAVY  = '#1B2838';
const RED   = '#8B2500';
const GOLD  = '#C4A265';
const CREAM = '#F5E6C8';

const FONT_HEAD = "'Playfair Display', Georgia, serif";
const FONT_MONO = "'Special Elite', 'Courier New', monospace";

const INITIAL_ATBAT: AtBat = { result: '', first: false, second: false, third: false, home: false, out: 0 };

const createTeam = (name: string): Team => ({
  name,
  players: Array(9).fill(null).map(() => ({ num: '', name: '', pos: '' })),
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
  const getInningOuts = (inning: number): number =>
    atBats.reduce((sum, player) => sum + (player[inning].out || 0), 0);

  /**
   * Gets the ordinal out number for a specific cell within its inning.
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
  const isOutResult = (result: string): boolean =>
    ['K', 'F', 'GO', 'PO'].some(r => result.includes(r)) ||
    result.includes('-') ||
    result === 'DP';

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

    if (newResultIsOut && !currentCellIsOut && currentOuts + dpOuts > 3) return;

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

  /** Resets both teams back to initial state. */
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
  const getInningRuns = (inning: number): number =>
    atBats.reduce((sum, player) => sum + (player[inning].home ? 1 : 0), 0);

  /** Calculates total hits. */
  const getTotalHits = (): number =>
    atBats.flat().filter(ab =>
      ['1B', '2B', '3B', 'HR'].some(h => ab.result.includes(h))
    ).length;

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
      <div className="scorecard-view flex flex-col flex-1 md:hidden overflow-hidden pb-20">
        {mobileView === 'card' ? (
          <>
            {/* Top bar */}
            <div className="mobile-bar flex items-center justify-between px-3 py-2">
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
              <Button variant="outline" size="sm"
                style={{ fontFamily: FONT_HEAD, borderColor: GOLD, color: NAVY }}
                onClick={() => setMobileView('stats')}>
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

            {/* Big diamond */}
            <div
              className={`flex-1 flex items-center justify-center px-12 ${mobileInningClosed ? 'opacity-30' : 'cursor-pointer active:scale-95 transition-transform'}`}
              onClick={() => !mobileInningClosed && setDrawerOpen(true)}
            >
              <svg viewBox="0 0 68 56" className="w-full max-w-xs">
                <path d="M34 4 L56 28 L34 52 L12 28 Z" fill="none" stroke={GOLD} strokeWidth="1.5" />
                {mobileAb.first  && <line x1="34" y1="52" x2="56" y2="28" stroke={RED} strokeWidth="3" />}
                {mobileAb.second && <line x1="56" y1="28" x2="34" y2="4"  stroke={RED} strokeWidth="3" />}
                {mobileAb.third  && <line x1="34" y1="4"  x2="12" y2="28" stroke={RED} strokeWidth="3" />}
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
              <p className="batter-name font-bold text-lg">
                {players[mobilePlayerIdx].num ? `#${players[mobilePlayerIdx].num} ` : ''}
                {players[mobilePlayerIdx].name || `Batter ${mobilePlayerIdx + 1}`}
              </p>
              <p className="batter-sub text-sm">
                {players[mobilePlayerIdx].pos || '--'} · Batting {mobilePlayerIdx + 1} of 9
              </p>
            </div>

            {/* Bottom nav */}
            <div className="mobile-bar-top flex items-center justify-between px-3 py-3">
              <Button variant="outline" size="sm" disabled={mobilePlayerIdx === 0}
                style={{ fontFamily: FONT_HEAD, borderColor: GOLD, color: NAVY }}
                onClick={() => setMobilePlayerIdx(p => p - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                  disabled={mobileInningIdx === 0}
                  onClick={() => setMobileInningIdx(i => i - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="inning-label text-sm font-bold w-12 text-center">Inn {mobileInningIdx + 1}</span>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                  disabled={mobileInningIdx === 8}
                  onClick={() => setMobileInningIdx(i => i + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" disabled={mobilePlayerIdx === 8}
                style={{ fontFamily: FONT_HEAD, borderColor: GOLD, color: NAVY }}
                onClick={() => setMobilePlayerIdx(p => p + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Drawer */}
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>
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
                        <Button key={r} variant="outline" className="h-10 text-sm"
                          style={{ fontFamily: FONT_MONO, borderColor: GOLD, color: NAVY }}
                          disabled={wouldExceed}
                          onClick={() => handleMobileResult(r)}>
                          {r}
                        </Button>
                      );
                    })}
                  </div>
                  {mobileInningOuts >= 3 && !mobileCellIsOut && (
                    <p className="out-warning text-xs font-semibold text-center">
                      3 outs recorded in inning {mobileInningIdx + 1}
                    </p>
                  )}
                  <Input
                    placeholder="Custom..."
                    className="h-10 text-sm"
                    style={{ fontFamily: FONT_MONO, borderColor: GOLD }}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') handleMobileResult(e.currentTarget.value.toUpperCase());
                    }}
                  />
                  <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${GOLD}` }}>
                    <span className="text-sm" style={{ fontFamily: FONT_MONO, color: '#5A3E28' }}>Bases:</span>
                    {(['first', 'second', 'third', 'home'] as Base[]).map((base, i) => (
                      <Button key={base} variant={mobileAb[base] ? 'default' : 'outline'} size="sm"
                        className="h-8 w-8 p-0"
                        style={{
                          fontFamily: FONT_HEAD,
                          background: mobileAb[base] ? RED : 'transparent',
                          borderColor: mobileAb[base] ? RED : GOLD,
                          color: mobileAb[base] ? CREAM : NAVY,
                        }}
                        onClick={() => toggleBase(mobilePlayerIdx, mobileInningIdx, base)}>
                        {i === 3 ? 'H' : i + 1}
                      </Button>
                    ))}
                  </div>
                  <Button variant="ghost" className="w-full"
                    style={{ fontFamily: FONT_MONO, color: '#5A3E28' }}
                    onClick={() => handleMobileResult('')}>
                    Clear
                  </Button>
                </div>
              </DrawerContent>
            </Drawer>
          </>
        ) : (
          /* STATS VIEW */
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="mobile-bar flex items-center justify-between px-3 py-2">
              <Button variant="ghost" size="sm"
                style={{ fontFamily: FONT_HEAD, color: NAVY }}
                onClick={() => setMobileView('card')}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <div className="flex items-center gap-1">
                {teams.map((team, idx) => (
                  <button key={idx}
                    className="px-2 py-1 text-sm rounded transition-colors"
                    style={{
                      fontFamily: FONT_HEAD,
                      fontWeight: activeTeam === idx ? 800 : 500,
                      background: activeTeam === idx ? NAVY : 'transparent',
                      color: activeTeam === idx ? CREAM : '#5A3E28',
                    }}
                    onClick={() => setActiveTeam(idx)}>
                    {team.name}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm"
                style={{ borderColor: GOLD, color: NAVY }}
                onClick={resetScorecard}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Linescore */}
            <div className="linescore flex items-center px-3 py-2 text-xs">
              <span className="team-name w-20 truncate">{teams[activeTeam].name}</span>
              {innings.map((_, i) => (
                <span key={i} className="w-6 text-center">{getInningRuns(i) || '-'}</span>
              ))}
              <span className="run-total w-8 text-center ml-2">
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
                  <div key={pIdx}
                    className="player-row flex items-center justify-between px-3 py-3 cursor-pointer transition-colors"
                    onClick={() => { setMobilePlayerIdx(pIdx); setMobileView('card'); }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="player-pos text-xs w-4">{pIdx + 1}</span>
                      <div className="min-w-0">
                        <span className="player-name text-sm truncate">
                          {player.num ? `#${player.num} ` : ''}{player.name || `Batter ${pIdx + 1}`}
                        </span>
                        <span className="player-pos text-xs ml-2">{player.pos || '--'}</span>
                      </div>
                    </div>
                    <div className="player-stats flex gap-3 text-xs shrink-0">
                      <span>AB:{pAB}</span>
                      <span>H:{pH}</span>
                      <span className="runs">R:{pR}</span>
                    </div>
                  </div>
                );
              })}
              <div className="totals-mobile flex items-center justify-between px-3 py-3 font-bold">
                <span className="label text-sm">TOTALS</span>
                <div className="flex gap-3 text-xs" style={{ fontFamily: FONT_MONO }}>
                  <span>AB:{atBats.flat().filter(ab => ab.result && !['BB', 'HBP'].includes(ab.result)).length}</span>
                  <span>H:{getTotalHits()}</span>
                  <span className="runs">R:{atBats.flat().filter(ab => ab.home).length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP LAYOUT */}
      <div className="scorecard-view hidden md:flex flex-1 flex-col p-2 md:p-4 overflow-auto">
        <Card className="w-full max-w-6xl mx-auto">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {teams.map((team, idx) => (
                  <div key={idx}
                    className="cursor-pointer px-1 pb-1 transition-all flex items-center gap-1"
                    style={{
                      borderBottom: activeTeam === idx ? `3px solid ${GOLD}` : '3px solid transparent',
                      opacity: activeTeam === idx ? 1 : 0.5,
                    }}
                    onClick={() => setActiveTeam(idx)}>
                    <span className="text-lg">{idx === 0 ? '⚾' : '🏟️'}</span>
                    <Input
                      value={team.name}
                      onChange={(e) => updateTeamName(idx, e.target.value.toUpperCase())}
                      onClick={(e) => { setActiveTeam(idx); e.stopPropagation(); }}
                      className="h-8 w-28 text-center"
                      style={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: '14px', letterSpacing: '0.08em' }}
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
          <CardContent className="p-2">
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="p-1 w-8 text-center">#</th>
                    <th className="p-1 w-28 text-left">PLAYER</th>
                    <th className="p-1 w-8 text-center">POS</th>
                    {innings.map(i => (
                      <th key={i} className="inning-col p-1 w-16 text-center">{i}</th>
                    ))}
                    <th className="stat-col p-1 w-8 text-center">AB</th>
                    <th className="stat-col p-1 w-8 text-center">H</th>
                    <th className="stat-col p-1 w-8 text-center">R</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, pIdx) => (
                    <tr key={pIdx}>
                      <td className="p-0">
                        <Input value={player.num}
                          onChange={(e) => updatePlayer(pIdx, 'num', e.target.value)}
                          className="h-14 w-full text-center text-xs p-0"
                          maxLength={2} placeholder="--" />
                      </td>
                      <td className="p-0">
                        <Input value={player.name}
                          onChange={(e) => updatePlayer(pIdx, 'name', e.target.value)}
                          className="h-14 w-full text-xs px-1"
                          placeholder={`Batter ${pIdx + 1}`} />
                      </td>
                      <td className="p-0">
                        <Input value={player.pos}
                          onChange={(e) => updatePlayer(pIdx, 'pos', e.target.value.toUpperCase())}
                          className="h-14 w-full text-center text-xs p-0"
                          maxLength={2} placeholder="--" />
                      </td>
                      {innings.map((_, iIdx) => {
                        const ab = atBats[pIdx][iIdx];
                        const cellKey = `${pIdx}-${iIdx}`;
                        const inningOuts = getInningOuts(iIdx);
                        const cellIsOut = ab.out > 0;
                        const cellHasResult = ab.result !== '';
                        const inningClosed = inningOuts >= 3 && !cellHasResult;
                        return (
                          <td key={iIdx} className="p-0 [&>button]:p-0"
                            style={{ background: inningClosed ? 'rgba(196,162,101,0.12)' : undefined }}>
                            <Popover open={openPopover === cellKey} onOpenChange={(open) => !inningClosed && setOpenPopover(open ? cellKey : null)}>
                              <PopoverTrigger render={<div className={`w-full h-14 transition-colors ${inningClosed ? 'cursor-not-allowed opacity-30' : 'cursor-pointer hover:bg-[rgba(196,162,101,0.2)]'}`} />}>
                                <svg viewBox="0 0 68 56" className="w-full h-full">
                                  <path d="M34 4 L56 28 L34 52 L12 28 Z" fill="none" stroke={GOLD} strokeWidth="1.5" strokeOpacity="0.6" />
                                  {ab.first  && <line x1="34" y1="52" x2="56" y2="28" stroke={RED} strokeWidth="3" />}
                                  {ab.second && <line x1="56" y1="28" x2="34" y2="4"  stroke={RED} strokeWidth="3" />}
                                  {ab.third  && <line x1="34" y1="4"  x2="12" y2="28" stroke={RED} strokeWidth="3" />}
                                  {ab.home && (
                                    <>
                                      <line x1="12" y1="28" x2="34" y2="52" stroke={RED} strokeWidth="3" />
                                      <path d="M34 8 L52 28 L34 48 L16 28 Z" fill={RED} fillOpacity="0.12" />
                                    </>
                                  )}
                                  <text x="34" y="28" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="bold"
                                    fill={NAVY} style={{ fontFamily: FONT_HEAD }}>
                                    {ab.result}
                                  </text>
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
                              <PopoverContent className="w-64 p-2">
                                <div className="space-y-2">
                                  <p className="popover-label text-xs font-semibold">Quick Entry:</p>
                                  <div className="grid grid-cols-5 gap-1">
                                    {quickResults.map(r => {
                                      const rIsOut = isOutResult(r);
                                      const rOuts = r === 'DP' ? 2 : (rIsOut ? 1 : 0);
                                      const wouldExceed = rIsOut && !cellIsOut && inningOuts + rOuts > 3;
                                      return (
                                        <Button key={r} variant="outline" size="sm"
                                          className="h-7 text-xs"
                                          style={{ fontFamily: FONT_MONO, borderColor: GOLD, color: NAVY }}
                                          disabled={wouldExceed}
                                          onClick={() => updateAtBat(pIdx, iIdx, r)}>
                                          {r}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                  {inningOuts >= 3 && !cellIsOut && (
                                    <p className="out-warning text-xs font-semibold">3 outs recorded in inning {iIdx + 1}</p>
                                  )}
                                  <div className="flex gap-1 mt-2">
                                    <Input placeholder="Custom..." className="h-7 text-xs"
                                      style={{ fontFamily: FONT_MONO, borderColor: GOLD }}
                                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                        if (e.key === 'Enter') updateAtBat(pIdx, iIdx, e.currentTarget.value.toUpperCase());
                                      }} />
                                  </div>
                                  <div className="flex gap-2 pt-2" style={{ borderTop: `1px solid ${GOLD}` }}>
                                    <p className="text-xs" style={{ fontFamily: FONT_MONO, color: '#5A3E28' }}>Bases:</p>
                                    {(['first', 'second', 'third', 'home'] as Base[]).map((base, i) => (
                                      <Button key={base} variant={ab[base] ? 'default' : 'outline'} size="sm"
                                        className="h-6 w-6 p-0 text-xs"
                                        style={{
                                          fontFamily: FONT_HEAD,
                                          background: ab[base] ? RED : 'transparent',
                                          borderColor: ab[base] ? RED : GOLD,
                                          color: ab[base] ? CREAM : NAVY,
                                        }}
                                        onClick={() => toggleBase(pIdx, iIdx, base)}>
                                        {i === 3 ? 'H' : i + 1}
                                      </Button>
                                    ))}
                                  </div>
                                  <Button variant="ghost" size="sm" className="w-full h-6 text-xs"
                                    style={{ fontFamily: FONT_MONO, color: '#5A3E28' }}
                                    onClick={() => updateAtBat(pIdx, iIdx, '')}>
                                    Clear
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </td>
                        );
                      })}
                      <td className="stat-col p-1 text-center">
                        {atBats[pIdx].filter(ab => ab.result && !['BB', 'HBP'].includes(ab.result)).length}
                      </td>
                      <td className="stat-col p-1 text-center">
                        {atBats[pIdx].filter(ab => ['1B', '2B', '3B', 'HR'].some(h => ab.result.includes(h))).length}
                      </td>
                      <td className="run-col p-1 text-center">
                        {atBats[pIdx].filter(ab => ab.home).length}
                      </td>
                    </tr>
                  ))}
                  <tr className="totals-row">
                    <td colSpan={3} className="p-1 text-right pr-2" style={{ letterSpacing: '0.08em' }}>TOTALS</td>
                    {innings.map((_, iIdx) => (
                      <td key={iIdx} className={`p-1 text-center ${getInningRuns(iIdx) > 0 ? 'inning-run' : ''}`}>
                        {getInningRuns(iIdx) || ''}
                      </td>
                    ))}
                    <td className="p-1 text-center">
                      {atBats.flat().filter(ab => ab.result && !['BB', 'HBP'].includes(ab.result)).length}
                    </td>
                    <td className="p-1 text-center">{getTotalHits()}</td>
                    <td className="run-col p-1 text-center">
                      {atBats.flat().filter(ab => ab.home).length}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="scorecard-legend mt-4 p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div><strong>K</strong> = Strikeout</div>
              <div><strong>BB</strong> = Walk</div>
              <div><strong>1B/2B/3B</strong> = Single/Double/Triple</div>
              <div><strong className="hr-key">HR</strong> = Home Run</div>
              <div><strong>F7/F8/F9</strong> = Fly out to LF/CF/RF</div>
              <div><strong>6-3</strong> = SS to 1B groundout</div>
              <div><strong>DP</strong> = Double Play</div>
              <div><strong>Positions</strong>: 1-P 2-C 3-1B 4-2B 5-3B 6-SS 7-LF 8-CF 9-RF</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
