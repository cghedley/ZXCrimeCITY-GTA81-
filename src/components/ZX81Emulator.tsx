import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RotateCcw, ExternalLink, Trash2, HelpCircle } from 'lucide-react';
import { Z80 } from '../emulator/z80';
import { SYM, PB64, ScoreEntry, computeCheckCode } from '../data/projectBundle';

interface ZX81EmulatorProps {
  centralScores: ScoreEntry[];
  pendingScores: ScoreEntry[];
  onAddPendingScore: (entry: ScoreEntry) => void;
  onDiscardTopPending: () => void;
  repoOwner: string;
  repoName: string;
}

const CHARS = '"\u00a3$:?()><=+-*/;,.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // ZX81 codes 11..63
const F5: Record<string, string> = {
  A: '01110,10001,10001,11111,10001,10001,10001',
  B: '11110,10001,10001,11110,10001,10001,11110',
  C: '01110,10001,10000,10000,10000,10001,01110',
  D: '11110,10001,10001,10001,10001,10001,11110',
  E: '11111,10000,10000,11110,10000,10000,11111',
  F: '11111,10000,10000,11110,10000,10000,10000',
  G: '01110,10001,10000,10111,10001,10001,01111',
  H: '10001,10001,10001,11111,10001,10001,10001',
  I: '01110,00100,00100,00100,00100,00100,01110',
  J: '00111,00010,00010,00010,00010,10010,01100',
  K: '10001,10010,10100,11000,10100,10010,10001',
  L: '10000,10000,10000,10000,10000,10000,11111',
  M: '10001,11011,10101,10101,10001,10001,10001',
  N: '10001,10001,11001,10101,10011,10001,10001',
  O: '01110,10001,10001,10001,10001,10001,01110',
  P: '11110,10001,10001,11110,10000,10000,10000',
  Q: '01110,10001,10001,10001,10101,10010,01101',
  R: '11110,10001,10001,11110,10100,10010,10001',
  S: '01111,10000,10000,01110,00001,00001,11110',
  T: '11111,00100,00100,00100,00100,00100,00100',
  U: '10001,10001,10001,10001,10001,10001,01110',
  V: '10001,10001,10001,10001,10001,01010,00100',
  W: '10001,10001,10001,10101,10101,11011,10001',
  X: '10001,10001,01010,00100,01010,10001,10001',
  Y: '10001,10001,01010,00100,00100,00100,00100',
  Z: '11111,00001,00010,00100,01000,10000,11111',
  '0': '01110,10001,10011,10101,11001,10001,01110',
  '1': '00100,01100,00100,00100,00100,00100,01110',
  '2': '01110,10001,00001,00010,00100,01000,11111',
  '3': '11110,00001,00001,01110,00001,00001,11110',
  '4': '00010,00110,01010,10010,11111,00010,00010',
  '5': '11111,10000,11110,00001,00001,10001,01110',
  '6': '00110,01000,10000,11110,10001,10001,01110',
  '7': '11111,00001,00010,00100,01000,01000,01000',
  '8': '01110,10001,10001,01110,10001,10001,01110',
  '9': '01110,10001,10001,01111,00001,00010,01100',
  '"': '01010,01010,00000,00000,00000,00000,00000',
  '\u00a3': '00110,01001,01000,11100,01000,01000,11111',
  $: '00100,01111,10100,01110,00101,11110,00100',
  ':': '00000,00100,00000,00000,00100,00000,00000',
  '?': '01110,10001,00001,00010,00100,00000,00100',
  '(': '00010,00100,01000,01000,01000,00100,00010',
  ')': '01000,00100,00010,00010,00010,00100,01000',
  '>': '10000,01000,00100,00010,00100,01000,10000',
  '<': '00001,00010,00100,01000,00100,00010,00001',
  '=': '00000,00000,11111,00000,11111,00000,00000',
  '+': '00000,00100,00100,11111,00100,00100,00000',
  '-': '00000,00000,00000,11111,00000,00000,00000',
  '*': '00000,10101,01110,11111,01110,10101,00000',
  '/': '00001,00010,00010,00100,01000,01000,10000',
  ';': '00000,00100,00000,00000,00100,00100,01000',
  ',': '00000,00000,00000,00000,00110,00100,01000',
  '.': '00000,00000,00000,00000,00000,01100,01100',
};

const glyphCache: Record<number, Uint8Array> = {};
function glyph(code: number): Uint8Array {
  if (glyphCache[code]) return glyphCache[code];
  const b = new Uint8Array(64);
  const c = code & 127;
  const inv = code & 128;
  if (c >= 1 && c <= 10) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const tl = x < 4 && y < 4;
        const tr = x >= 4 && y < 4;
        const bl = x < 4 && y >= 4;
        const br = x >= 4 && y >= 4;
        let on = false;
        const chq = ((x + y) & 1) === 0;
        switch (c) {
          case 1:
            on = tl;
            break;
          case 2:
            on = tr;
            break;
          case 3:
            on = tl || tr;
            break;
          case 4:
            on = bl;
            break;
          case 5:
            on = tl || bl;
            break;
          case 6:
            on = tr || bl;
            break;
          case 7:
            on = tr || bl || br;
            break;
          case 8:
            on = chq;
            break;
          case 9:
            on = chq && y < 4;
            break;
          default:
            on = chq && y >= 4;
        }
        b[y * 8 + x] = on ? 1 : 0;
      }
    }
  } else if (c >= 11 && c <= 63) {
    const rows = F5[CHARS.charAt(c - 11)];
    if (rows) {
      rows.split(',').forEach((r, ry) => {
        for (let rx = 0; rx < 5; rx++) {
          if (r.charAt(rx) === '1') b[ry * 8 + rx + 1] = 1;
        }
      });
    }
  }
  if (inv) {
    for (let i = 0; i < 64; i++) b[i] ^= 1;
  }
  glyphCache[code] = b;
  return b;
}

const ROWS_MATRIX = [
  ['SHIFT', 'Z', 'X', 'C', 'V'],
  ['A', 'S', 'D', 'F', 'G'],
  ['Q', 'W', 'E', 'R', 'T'],
  ['1', '2', '3', '4', '5'],
  ['0', '9', '8', '7', '6'],
  ['P', 'O', 'I', 'U', 'Y'],
  ['ENTER', 'L', 'K', 'J', 'H'],
  ['SPACE', '.', 'M', 'N', 'B'],
];

const KB_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'ENTER'],
  ['SHIFT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', 'SPACE'],
];

const KEY_CAPTIONS: Record<string, string> = {
  '5': '←',
  '6': '↓',
  '7': '↑',
  '8': '→',
  '0': 'STOP',
  E: 'EXIT',
  Q: 'QUIT',
};

const CODEMAP: Record<string, string> = {
  Space: 'SPACE',
  Enter: 'ENTER',
  NumpadEnter: 'ENTER',
  ShiftLeft: 'SHIFT',
  ShiftRight: 'SHIFT',
  Period: '.',
  NumpadDecimal: '.',
  ArrowLeft: '5',
  ArrowDown: '6',
  ArrowUp: '7',
  ArrowRight: '8',
};

const PBYTES = Uint8Array.from(atob(PB64), (c) => c.charCodeAt(0));

export const ZX81Emulator: React.FC<ZX81EmulatorProps> = ({
  centralScores,
  pendingScores,
  onAddPendingScore,
  onDiscardTopPending,
  repoOwner,
  repoName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeKeys, setActiveKeys] = useState<Record<string, boolean>>({});
  const [telemetry, setTelemetry] = useState<{
    score: number;
    lives: number;
    want: number;
    inCar: boolean;
    carHp: number;
    exited: boolean;
  }>({
    score: 0,
    lives: 3,
    want: 0,
    inCar: false,
    carHp: 0,
    exited: false,
  });

  // Latest scores refs so the Z80 PC hook always sees current leaderboard
  const centralRef = useRef<ScoreEntry[]>(centralScores);
  const pendingRef = useRef<ScoreEntry[]>(pendingScores);
  const onAddPendingRef = useRef(onAddPendingScore);

  useEffect(() => {
    centralRef.current = centralScores;
  }, [centralScores]);

  useEffect(() => {
    pendingRef.current = pendingScores;
  }, [pendingScores]);

  useEffect(() => {
    onAddPendingRef.current = onAddPendingScore;
  }, [onAddPendingScore]);

  // Machine state ref
  const machineRef = useRef<{
    mem: Uint8Array;
    cpu: Z80;
    pressedPhys: Record<string, boolean>;
    pressedVirt: Record<string, boolean>;
    defaults: ScoreEntry[];
    lastTable: ScoreEntry[] | null;
    state: 'loading' | 'run';
    loadUntil: number;
    skipPc: number;
    exited: boolean;
    prevCells: Int16Array;
    dirty: boolean;
  } | null>(null);

  const readTableFromMem = (mem: Uint8Array): ScoreEntry[] => {
    const out: ScoreEntry[] = [];
    for (let i = 0; i < 5; i++) {
      const b = SYM.HS + 5 * i;
      let n = '';
      for (let k = 0; k < 3; k++) {
        n += String.fromCharCode(65 + mem[b + k] - 38);
      }
      out.push({ n, s: mem[b + 3] | (mem[b + 4] << 8) });
    }
    return out;
  };

  const writeTableToMem = (mem: Uint8Array, t: ScoreEntry[]) => {
    for (let i = 0; i < 5; i++) {
      const b = SYM.HS + 5 * i;
      const e = t[i];
      if (!e) continue;
      for (let k = 0; k < 3; k++) {
        mem[b + k] = 38 + e.n.charCodeAt(k) - 65;
      }
      mem[b + 3] = e.s & 255;
      mem[b + 4] = (e.s >> 8) & 255;
    }
  };

  const computeMergedTop5 = useCallback((defaults: ScoreEntry[]): ScoreEntry[] => {
    const all = [
      ...centralRef.current.map((e) => ({ n: e.n, s: e.s })),
      ...pendingRef.current.map((e) => ({ n: e.n, s: e.s })),
      ...defaults.map((e) => ({ n: e.n, s: e.s })),
    ];
    return all
      .map((e, i) => ({ n: e.n, s: e.s, i }))
      .sort((x, y) => y.s - x.s || x.i - y.i)
      .slice(0, 5)
      .map((e) => ({ n: e.n, s: e.s }));
  }, []);

  const bootMachine = useCallback(() => {
    const m = machineRef.current;
    if (!m) return;
    m.mem.fill(0);
    m.mem.set(PBYTES, 0x4009);
    m.mem[0x0f2b] = 0xc9; // ROM stub: SLOW just returns
    m.mem[0x7fee] = 0;
    m.mem[0x7fef] = 0x70; // return address = "BASIC"
    m.cpu.R.fill(0);
    m.cpu.f = 0;
    m.cpu.sp = 0x7fee;
    m.cpu.pc = 0x4082;
    m.cpu.t = 0;
    if (m.defaults.length === 0) {
      m.defaults = readTableFromMem(m.mem);
    }
    m.exited = false;
    m.skipPc = -1;
    m.lastTable = null;
    m.state = 'loading';
    m.loadUntil = performance.now() + 1400;
    m.prevCells.fill(-1);
    m.dirty = true;
  }, []);

  useEffect(() => {
    const mem = new Uint8Array(65536);
    const pressedPhys: Record<string, boolean> = {};
    const pressedVirt: Record<string, boolean> = {};

    const inp = (port: number): number => {
      if ((port & 255) !== 0xfe) return 0xff;
      const hi = (port >> 8) & 255;
      let v = 0xff;
      for (let bit = 0; bit < 8; bit++) {
        if (((hi >> bit) & 1) === 0) {
          const keys = ROWS_MATRIX[bit];
          for (let i = 0; i < 5; i++) {
            if (pressedPhys[keys[i]] || pressedVirt[keys[i]]) {
              v &= ~(1 << i);
            }
          }
        }
      }
      return v;
    };

    const cpu = new Z80(
      (a) => mem[a],
      (a, v) => {
        if (a >= 0x4000 && a < 0x8000) mem[a] = v;
      },
      inp,
      () => {}
    );

    machineRef.current = {
      mem,
      cpu,
      pressedPhys,
      pressedVirt,
      defaults: [],
      lastTable: null,
      state: 'loading',
      loadUntil: 0,
      skipPc: -1,
      exited: false,
      prevCells: new Int16Array(768).fill(-1),
      dirty: true,
    };

    bootMachine();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = ctx.createImageData(256, 192);
    const px = new Uint32Array(img.data.buffer);
    const PAPER = 0xffecf3f4;
    const INK = 0xff121212;

    const drawCell = (cx: number, cy: number, code: number) => {
      const g = glyph(code);
      const base = cy * 8 * 256 + cx * 8;
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          px[base + y * 256 + x] = g[y * 8 + x] ? INK : PAPER;
        }
      }
    };

    const renderScreen = () => {
      const m = machineRef.current;
      if (!m) return;
      const df = m.mem[0x400c] | (m.mem[0x400d] << 8);
      for (let r = 0; r < 24; r++) {
        for (let c = 0; c < 32; c++) {
          const code = m.mem[(df + 1 + 33 * r + c) & 0xffff];
          if (code !== m.prevCells[r * 32 + c]) {
            m.prevCells[r * 32 + c] = code;
            drawCell(c, r, code);
            m.dirty = true;
          }
        }
      }
      if (m.dirty) {
        ctx.putImageData(img, 0, 0);
        m.dirty = false;
      }
    };

    const tapeStripes = () => {
      const m = machineRef.current;
      if (!m) return;
      let y = 0;
      let on = Math.random() < 0.5;
      while (y < 192) {
        const h = 1 + Math.floor(Math.random() * (Math.random() < 0.3 ? 28 : 6));
        for (let k = 0; k < h && y < 192; k++, y++) {
          for (let x = 0; x < 256; x++) {
            px[y * 256 + x] = on ? INK : PAPER;
          }
        }
        on = !on;
      }
      ctx.putImageData(img, 0, 0);
      m.prevCells.fill(-1);
      m.dirty = true;
    };

    const showBasicReport = () => {
      const m = machineRef.current;
      if (!m) return;
      const df = m.mem[0x400c] | (m.mem[0x400d] << 8);
      const b = df + 1 + 33 * 23;
      m.mem[b] = 28; // '0'
      m.mem[b + 1] = 24; // '/'
      m.mem[b + 2] = 30; // '2'
    };

    const handlePcHook = (pc: number) => {
      const m = machineRef.current;
      if (!m) return;
      if (pc === SYM.title) {
        const top5 = computeMergedTop5(m.defaults);
        writeTableToMem(m.mem, top5);
        m.lastTable = top5;
      } else if (pc === SYM.go2) {
        const cur = readTableFromMem(m.mem);
        if (m.lastTable) {
          const pool = m.lastTable.slice();
          const added: ScoreEntry[] = [];
          cur.forEach((e) => {
            const k = pool.findIndex((p) => p.n === e.n && p.s === e.s);
            if (k >= 0) pool.splice(k, 1);
            else added.push(e);
          });
          added.sort((a, b) => b.s - a.s);
          if (added[0]) {
            onAddPendingRef.current({
              n: added[0].n,
              s: added[0].s,
              t: Date.now(),
              pending: true,
            });
          }
        }
        const top5 = computeMergedTop5(m.defaults);
        writeTableToMem(m.mem, top5);
        m.lastTable = top5;
      }
      m.skipPc = pc;
    };

    const FRAME_T = 65000;
    const runFrame = () => {
      const m = machineRef.current;
      if (!m || m.exited) return;
      let f = m.mem[0x4034] | (m.mem[0x4035] << 8);
      f = (f - 1) & 0xffff;
      m.mem[0x4034] = f & 255;
      m.mem[0x4035] = f >> 8;

      let budget = FRAME_T;
      while (budget > 0) {
        const pc = m.cpu.pc;
        if (pc === SYM.title || pc === SYM.go2) {
          if (m.skipPc === pc) {
            m.skipPc = -1;
          } else {
            handlePcHook(pc);
            return;
          }
        }
        if (pc === 0x7000) {
          m.exited = true;
          showBasicReport();
          return;
        }
        budget -= m.cpu.step();
      }
    };

    let last = performance.now();
    let acc = 0;
    let tapeAcc = 0;
    let telemAcc = 0;
    let animId: number;

    const loop = (now: number) => {
      const m = machineRef.current;
      if (!m) return;
      const dt = Math.min(now - last, 100);
      last = now;
      acc += dt;
      telemAcc += dt;

      if (m.state === 'loading') {
        tapeAcc += dt;
        if (tapeAcc > 45) {
          tapeAcc = 0;
          tapeStripes();
          acc = 0;
        }
        if (now >= m.loadUntil) {
          m.state = 'run';
          acc = 0;
        }
      } else {
        while (acc >= 20) {
          acc -= 20;
          runFrame();
        }
        renderScreen();
      }

      if (telemAcc > 150) {
        telemAcc = 0;
        setTelemetry({
          score: m.mem[SYM.SCORE] | (m.mem[SYM.SCORE + 1] << 8),
          lives: m.mem[SYM.LIVES],
          want: m.mem[SYM.WANT],
          inCar: m.mem[SYM.INCAR] === 1,
          carHp: m.mem[SYM.CARHP],
          exited: m.exited,
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [bootMachine, computeMergedTop5]);

  // Update ZX81 memory high-score table live whenever centralScores or pendingScores change
  useEffect(() => {
    const m = machineRef.current;
    if (!m || m.defaults.length === 0) return;
    const top5 = computeMergedTop5(m.defaults);
    writeTableToMem(m.mem, top5);
    m.lastTable = top5;
  }, [centralScores, pendingScores, computeMergedTop5]);

  // Physical Keyboard Handling
  useEffect(() => {
    const mapKey = (e: KeyboardEvent): string | null => {
      const c = e.code || '';
      if (CODEMAP[c]) return CODEMAP[c];
      if (/^Key[A-Z]$/.test(c)) return c.charAt(3);
      if (/^Digit[0-9]$/.test(c)) return c.charAt(5);
      if (/^Numpad[0-9]$/.test(c)) return c.charAt(6);
      return null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = mapKey(e);
      if (!k || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      const m = machineRef.current;
      if (m) {
        if (m.state === 'loading') m.loadUntil = 0;
        m.pressedPhys[k] = true;
      }
      setActiveKeys((prev) => ({ ...prev, [k]: true }));
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = mapKey(e);
      if (!k) return;
      e.preventDefault();
      const m = machineRef.current;
      if (m) {
        delete m.pressedPhys[k];
      }
      setActiveKeys((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    };

    const onBlur = () => {
      const m = machineRef.current;
      if (m) {
        m.pressedPhys = {};
        m.pressedVirt = {};
      }
      setActiveKeys({});
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const handleVirtDown = (k: string) => {
    const m = machineRef.current;
    if (m) {
      if (m.state === 'loading') m.loadUntil = 0;
      m.pressedVirt[k] = true;
    }
    setActiveKeys((prev) => ({ ...prev, [k]: true }));
  };

  const handleVirtUp = (k: string) => {
    const m = machineRef.current;
    if (m) {
      delete m.pressedVirt[k];
    }
    setActiveKeys((prev) => {
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  const topPending = pendingScores.length
    ? [...pendingScores].sort((a, b) => b.s - a.s)[0]
    : null;

  const topPendingIssueUrl = topPending
    ? `https://github.com/${repoOwner || 'YOUR-NAME'}/${repoName || 'crime-city-zx81'}/issues/new?template=score.yml&title=${encodeURIComponent(
        `[score] ${topPending.n} ${topPending.s}`
      )}&initials=${topPending.n}&score=${topPending.s}&check=${computeCheckCode(
        topPending.n,
        topPending.s
      )}`
    : '#';

  return (
    <div className="flex flex-col gap-4">
      {/* Authentic ZX81 Hardware Case & 256x192 Screen */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5 shadow-2xl">
        {/* Top Bar inside Bezel */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-zinc-800">
          <div>
            <div className="font-display font-bold text-base text-white tracking-tight">
              CRIME CITY — REAL Z80 MACHINE CODE ($4082)
            </div>
            <div className="text-xs font-mono text-zinc-400">
              32×24 CHARACTERS · 256×192 ULA DISPLAY · 40-KEY ZX81 KEYBOARD
            </div>
          </div>

          <button
            type="button"
            onClick={bootMachine}
            className="px-3 py-1.5 text-xs font-mono font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-400" />
            <span>Reset (RUN)</span>
          </button>
        </div>

        {/* ZX81 256x192 CRT Screen */}
        <div className="bg-black p-2.5 sm:p-3.5 rounded-lg border border-zinc-800 flex justify-center">
          <canvas
            ref={canvasRef}
            width={256}
            height={192}
            onPointerDown={() => {
              const m = machineRef.current;
              if (m && m.state === 'loading') m.loadUntil = 0;
            }}
            className="w-full max-w-[540px] aspect-[4/3] bg-[#f4f3ec] rounded-sm cursor-pointer"
            style={{ imageRendering: 'pixelated' }}
            aria-label="ZX81 screen"
          />
        </div>

        {/* Live Z80 RAM Status Bar ($4034 FRAMES & SYM Addresses) */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-zinc-400">
          <div>
            <span>High scores: shared table, refreshed at the title screen</span>
          </div>
          <div className="text-zinc-300 tabular-nums">
            <span>SCORE: ${telemetry.score}</span>
            <span className="mx-2">·</span>
            <span>LIVES: {telemetry.lives}</span>
            <span className="mx-2">·</span>
            <span>WANTED: {telemetry.want}</span>
            <span className="mx-2">·</span>
            <span>{telemetry.inCar ? `CAR (HP:${telemetry.carHp})` : 'ON FOOT'}</span>
          </div>
        </div>

        {/* Authentic 40-Key 4x10 ZX81 Keyboard from template_gh.html */}
        <div className="mt-4 pt-3 border-t border-zinc-800 select-none">
          <div className="grid gap-1.5">
            {KB_ROWS.map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-10 gap-1 sm:gap-1.5">
                {row.map((k) => {
                  const isDown = !!activeKeys[k];
                  const caption = KEY_CAPTIONS[k] || '';
                  return (
                    <button
                      key={k}
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        handleVirtDown(k);
                      }}
                      onPointerUp={() => handleVirtUp(k)}
                      onPointerLeave={() => {
                        if (activeKeys[k]) handleVirtUp(k);
                      }}
                      onPointerCancel={() => handleVirtUp(k)}
                      className={`min-h-[44px] rounded-md font-mono font-semibold text-xs sm:text-sm px-1 py-1.5 flex flex-col items-center justify-center transition-transform cursor-pointer whitespace-nowrap shrink-0 ${
                        isDown
                          ? 'translate-y-[2px] bg-[#bdb9ad] text-zinc-950 shadow-none'
                          : 'bg-[#d9d6cc] hover:bg-[#e5e2d9] text-zinc-950 shadow-[0_2px_0_#7d7a70]'
                      }`}
                    >
                      <span className={k.length > 1 ? 'text-[10px] sm:text-xs font-bold' : ''}>
                        {k === 'ENTER' ? 'NEW LINE' : k}
                      </span>
                      <small className="text-[9px] font-sans font-bold text-[#a1261c] tracking-wide min-h-[10px]">
                        {caption}
                      </small>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Score GitHub Issue Submission Banner (matches submitBox in docs/index.html) */}
      {topPending && (
        <div className="bg-zinc-900 border border-red-500/50 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-zinc-200">
            <span className="font-semibold text-white">
              Your score {topPending.n} {topPending.s}
            </span>{' '}
            is only on this device so far.
            {pendingScores.length > 1 ? ` (${pendingScores.length - 1} more waiting.)` : ''}{' '}
            <span className="font-mono text-xs text-amber-400">
              (check={computeCheckCode(topPending.n, topPending.s)})
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href={topPendingIssueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Submit score on GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={onDiscardTopPending}
              className="px-2.5 py-2 text-xs text-zinc-400 hover:text-zinc-200 underline flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>
          </div>
        </div>
      )}

      {/* How to Play Box (from docs/index.html) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 space-y-2">
        <div className="font-semibold text-white flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-red-400" />
          <span>How to play Crime City (Real Z80 Machine Code)</span>
        </div>
        <p className="text-zinc-400 leading-relaxed">
          Steer with <strong className="text-zinc-200">5 6 7 8</strong> (left, down, up, right) or the arrow keys.{' '}
          <strong className="text-zinc-200">0</strong> stops, <strong className="text-zinc-200">E</strong> leaves your car. Walk into a traffic car (<strong className="text-zinc-200">H</strong>) to steal it. Run over pedestrians (<strong className="text-zinc-200">I</strong>) for cash, but the police (inverse <strong className="text-zinc-200">Z</strong>) will chase you. On foot, they bust you. In a car, they dent it.
        </p>
        <p className="text-zinc-400 leading-relaxed">
          Drive to the <strong className="text-zinc-200">$</strong> to pick up a fare, then to the <strong className="text-zinc-200">X</strong> before the timer runs out. Three lives. At the title screen press <strong className="text-zinc-200">Q</strong> to drop back to BASIC. When you beat the 5th high score, type 3 initials on the keyboard to unlock the <strong className="text-zinc-200">Submit score on GitHub</strong> button.
        </p>
      </div>
    </div>
  );
};
