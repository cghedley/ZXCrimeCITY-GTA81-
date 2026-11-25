// Authentic FNV-1a 32-bit check code matching index.html and .github/scripts/add_score.py
export function computeCheckCode(n: string, s: number): string {
  const clean = (n || 'AAA').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A');
  const score = Math.max(1, Math.min(65535, Math.floor(s)));
  const str = `${clean}:${score}:crimecity`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

export interface ScoreEntry {
  n: string;       // 3-letter initials
  s: number;       // 16-bit score (1..65535)
  by?: string;     // GitHub login
  t?: string | number;
  pending?: boolean;
}

// The exact Z80 symbols from web/sym.json
export const SYM = {
  start: 16514,
  main: 16517,
  rnd: 16534,
  wall: 16555,
  newframe: 16649,
  pausef: 16660,
  newgame: 16979,
  gameloop: 17065,
  tick: 17099,
  title: 18326,
  drawhs: 18380,
  qualify: 18461,
  getname: 18477,
  inserths: 18517,
  gameover: 18598,
  go2: 18665,
  HS: 19026,
  SEED: 19051,
  LASTF: 19053,
  VARS: 19054,
  PY: 19054,
  PX: 19055,
  DY: 19056,
  DX: 19057,
  INCAR: 19058,
  CARHP: 19059,
  LIVES: 19060,
  WANT: 19061,
  TWANT: 19062,
  TC: 19063,
  FC: 19064,
  MSTATE: 19065,
  MKY: 19066,
  MKX: 19067,
  NY: 19068,
  NX: 19069,
  MTIME: 19070,
  MSEC: 19071,
  KEYBUF: 19072,
  SCORE: 19073,
  NAMEBUF: 19085,
  peds: 19093,
  cars: 19101,
  cop: 19113,
  VARSEND: 19119,
};

// The exact compiled Z80 machine-code .P tape image (dist/crimecity_mc.p) encoded in Base64 from docs/index.html
export const PB64 =
  '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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB2AAILAPnUxQsdIiEdIAt2dgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdoA=';

// Default high scores stored inside the Z80 binary at SYM.HS (19026)
export const DEFAULT_ROM_SCORES: ScoreEntry[] = [
  { n: 'ACE', s: 2500, by: 'rom-default' },
  { n: 'BOB', s: 1800, by: 'rom-default' },
  { n: 'CAT', s: 1200, by: 'rom-default' },
  { n: 'DAN', s: 800, by: 'rom-default' },
  { n: 'EVE', s: 500, by: 'rom-default' },
];

export const ISSUE_TEMPLATE_YML = `name: Submit a high score
description: Add a score from the CRIME CITY browser game to the shared table
title: "[score] "
body:
  - type: markdown
    attributes:
      value: |
        Press **Submit new issue** below. A GitHub Action will check the score, add it to the table, and close this issue.
  - type: input
    id: initials
    attributes:
      label: Initials
      description: Three letters A–Z
    validations:
      required: true
  - type: input
    id: score
    attributes:
      label: Score
      description: Whole number 1–65535
    validations:
      required: true
  - type: input
    id: check
    attributes:
      label: Check code
      description: Filled in by the game
    validations:
      required: true
`;

export const WORKFLOW_YML = `name: Add high score

on:
  issues:
    types: [opened, edited, reopened]
  schedule:
    - cron: '23 * * * *'
  workflow_dispatch:

permissions:
  contents: write
  issues: write

concurrency:
  group: add-score
  cancel-in-progress: false

jobs:
  score:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Process open score issues
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: \${{ github.repository }}
        run: python3 .github/scripts/add_score.py
`;

export const LICENSE_TXT = `MIT License

Copyright (c) 2026 C. G. Hedley

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
