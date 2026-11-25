// Generates authentic 512x384 (2x scaled 256x192) ZX81 display SVG screenshots
// using the exact 5x7 font and 2x2 block graphic character codes from docs/index.html.

const CHARS = '"\u00a3$:?()><=+-*/;,.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
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

function charToZX81Code(ch: string, inv = false): number {
  if (ch === ' ') return inv ? 128 : 0;
  const idx = CHARS.indexOf(ch.toUpperCase());
  const base = idx >= 0 ? idx + 11 : 0;
  return inv ? base | 128 : base;
}

function getGlyphBitmap(code: number): Uint8Array {
  const b = new Uint8Array(64);
  const c = code & 127;
  const inv = (code & 128) !== 0;
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
  return b;
}

function renderGridToSvg(grid: number[][], titleLabel: string): string {
  // Combine horizontal runs of dark pixels per scanline for a compact, ultra-crisp SVG
  const paths: string[] = [];
  for (let cy = 0; cy < 24; cy++) {
    for (let cx = 0; cx < 32; cx++) {
      const code = grid[cy]?.[cx] ?? 0;
      if (code === 0) continue;
      if (code === 128) {
        paths.push(`M${cx * 8},${cy * 8}h8v8h-8z`);
        continue;
      }
      const bmp = getGlyphBitmap(code);
      for (let py = 0; py < 8; py++) {
        let runStart = -1;
        for (let px = 0; px <= 8; px++) {
          const on = px < 8 && bmp[py * 8 + px] === 1;
          if (on && runStart === -1) {
            runStart = px;
          } else if (!on && runStart !== -1) {
            const x0 = cx * 8 + runStart;
            const y0 = cy * 8 + py;
            const w = px - runStart;
            paths.push(`M${x0},${y0}h${w}v1h-${w}z`);
            runStart = -1;
          }
        }
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 276 212" width="552" height="424" role="img" aria-label="${titleLabel}">
  <rect width="276" height="212" rx="6" fill="#0c0c0c"/>
  <rect x="10" y="10" width="256" height="192" fill="#f4f3ec"/>
  <g transform="translate(10,10)" fill="#121212">
    <path d="${paths.join('')}"/>
  </g>
</svg>`;
}

function makeEmptyGrid(): number[][] {
  return Array.from({ length: 24 }, () => Array(32).fill(0));
}

function putText(grid: number[][], row: number, col: number, text: string, inv = false) {
  for (let i = 0; i < text.length && col + i < 32; i++) {
    grid[row][col + i] = charToZX81Code(text[i], inv);
  }
}

// 1. Authentic Title Screen + High Score Table SVG (matches Z80 msg_t1..msg_hs & drawhs)
export function generateTitleScreenshotSvg(): string {
  const g = makeEmptyGrid();
  putText(g, 1, 11, 'CRIME CITY', true);
  putText(g, 3, 1, '5 6 7 8 STEER  0 STOP  E EXIT');
  putText(g, 4, 1, 'I PED $100   H STEAL CAR');
  putText(g, 5, 1, 'Z POLICE     $ PICKUP  X DROP');
  putText(g, 7, 10, 'HIGH  SCORES');
  putText(g, 9, 9, '1. ACE   02500');
  putText(g, 10, 9, '2. BOB   01800');
  putText(g, 11, 9, '3. CAT   01200');
  putText(g, 12, 9, '4. DAN   00800');
  putText(g, 13, 9, '5. EVE   00500');
  putText(g, 16, 4, 'CAR TAKES 3 HITS  3 LIVES');
  putText(g, 19, 3, 'SPACE TO PLAY   Q FOR BASIC');
  return renderGridToSvg(g, 'CRIME CITY ZX81 Title Screen and High Score Table');
}

// 2. Authentic Gameplay City Grid SVG (matches Z80 wall formula: 2<=(c%8)<=5 and 2<=(r%6)<=4)
export function generateGameplayScreenshotSvg(): string {
  const g = makeEmptyGrid();
  // Draw city blocks using ZX81 character 136 (0x88 inverse dithered checkerboard block)
  for (let r = 0; r <= 20; r++) {
    for (let c = 0; c <= 31; c++) {
      if (c % 8 >= 2 && c % 8 <= 5 && r % 6 >= 2 && r % 6 <= 4) {
        g[r][c] = 0x88;
      }
    }
  }

  // Pedestrians ('I')
  g[1][7] = charToZX81Code('I');
  g[7][14] = charToZX81Code('I');
  g[13][6] = charToZX81Code('I');
  g[17][22] = charToZX81Code('I');

  // Traffic cars ('H')
  g[6][4] = charToZX81Code('H');
  g[12][19] = charToZX81Code('H');
  g[18][11] = charToZX81Code('H');

  // Police cars (inverse 'Z' = 0xBF)
  g[7][9] = charToZX81Code('Z', true);
  g[11][16] = charToZX81Code('Z', true);

  // Taxi pickup / dropoff ('$' and 'X')
  g[1][21] = charToZX81Code('$');
  g[13][25] = charToZX81Code('X');

  // Player in stolen car (0xB4 = inverse '7' / '@' car token at intersection)
  g[7][12] = charToZX81Code('7', true);

  // Bottom status bar at row 22 (matches Z80 status routine)
  putText(g, 22, 0, '$01450 L3 W2 CAR3 T28');
  return renderGridToSvg(g, 'CRIME CITY ZX81 Active Gameplay Screenshot');
}

// 3. Authentic Game Over & Initials Entry Screen SVG (matches Z80 gameover / getname)
export function generateHighscoreScreenshotSvg(): string {
  const g = makeEmptyGrid();
  putText(g, 4, 11, 'GAME  OVER', true);
  putText(g, 7, 9, 'SCORE   03200');
  putText(g, 10, 8, 'NEW HIGH SCORE!');
  putText(g, 12, 6, 'TYPE YOUR INITIALS:');
  putText(g, 15, 14, 'S I _', true);
  putText(g, 19, 4, 'THEN SUBMIT ON GITHUB ISSUE');
  return renderGridToSvg(g, 'CRIME CITY ZX81 High Score Initials Entry Screen');
}

export function generateFormattedReadme(repoOwner: string, repoName: string): string {
  const owner = repoOwner || 'YOUR-NAME';
  const repo = repoName || 'crimecity';
  const liveUrl = `https://${owner}.github.io/${repo}/`;

  return `# CRIME CITY for the Sinclair ZX81 (16K)

[![Play CRIME CITY in Browser](https://img.shields.io/badge/Play_in_Browser-ZX81_Emulator-b3261e?style=for-the-badge)](${liveUrl})
[![Platform](https://img.shields.io/badge/Platform-Sinclair_ZX81_16K-1c1b19?style=for-the-badge)](#)
[![CPU](https://img.shields.io/badge/CPU-Z80A_Machine_Code-3a382f?style=for-the-badge)](#build)

A tiny top-down open-world crime game (and 1981 homage to *Grand Theft Auto*) written in Z80 machine code for the **Sinclair ZX81 (16K)**: steal traffic cars, run over pedestrians, dodge police cruisers, complete timed taxi fares, and post your initials to a shared GitHub-powered high score table.

👉 **[Play the live ZX81 browser edition on GitHub Pages](${liveUrl})**

---

## Screenshots

| Title & Shared High Scores | City Grid, Police & Taxi Jobs | High Score Initials Entry |
| :---: | :---: | :---: |
| ![Title Screen](docs/screenshots/title.svg) | ![Gameplay](docs/screenshots/gameplay.svg) | ![High Score Entry](docs/screenshots/highscore.svg) |
| *5-entry leaderboard synced from \`docs/data/scores.json\`* | *Dithered city blocks, police (\`Z\`), traffic (\`H\`), peds (\`I\`), taxi (\`$\`/\`X\`)* | *Qualifying scores unlock 1-click GitHub Issue submission* |

---

## Repository Contents

| Path | Description |
| :--- | :--- |
| [\`docs/index.html\`](docs/index.html) | **GitHub Pages site** — runs the real compiled Z80 machine code in a self-contained JavaScript emulator with a 40-key ZX81 membrane keyboard. |
| [\`docs/data/scores.json\`](docs/data/scores.json) | **Shared High Score Table** — served alongside the game and automatically updated by GitHub Actions. |
| [\`dist/crimecity_mc.p\`](dist/crimecity_mc.p) | **ZX81 16K Tape File (Machine Code)** — ready to load in EightyOne,zesarux, sz81, or on real Sinclair ZX81 hardware via ZXpand / TZXDuino. |
| [\`dist/crimecity_basic_v2.txt\`](dist/crimecity_basic_v2.txt) | **ZX81 BASIC Type-In Listing** — the earlier pure Sinclair BASIC prototype. |
| [\`.github/workflows/add-score.yml\`](.github/workflows/add-score.yml) | **Automated Score Verifier Workflow** — runs \`.github/scripts/add_score.py\` whenever a \`[score]\` issue is opened. |

---

## Controls & Legend

### Keyboard Controls
* **\`5\` \`6\` \`7\` \`8\`** *(or **Arrow Keys** in the browser)* — Steer / walk **Left**, **Down**, **Up**, **Right**
* **\`0\`** — Stop / brake
* **\`E\`** — Bail out of your current car onto foot
* **\`Q\`** *(at the Title Screen)* — Quit to Sinclair BASIC (\`0/2\`)
* **\`SPACE\`** — Start game from the Title Screen

### On-Screen Map Legend
* **Inverse \`7\`** / **Inverse \`&\`** — Your player (in a car vs. on foot). Cars move twice as fast as walking and can take **3 hits**.
* **\`H\`** — Traffic car. Walk into a car while on foot to hijack it (restores car armor to 3 HP and raises your Wanted level).
* **\`I\`** — Pedestrian. Run over in a car for **+$100** cash (raises your Wanted level).
* **Inverse \`Z\`** — Police patrol car. Up to 3 police units pursue you based on your Wanted level (\`W1\`–\`W3\`). In a car they dent your armor; **on foot they bust you** (costs 1 life and halves your cash).
* **\`$\`** — Taxi fare pickup. Drive over \`$\` in a car to pick up a passenger.
* **\`X\`** — Taxi fare destination. Deliver the passenger to \`X\` before the countdown timer (\`T\`) expires for **+$200 + time bonus**.

---

## Setting Up GitHub Pages & the Shared High Score Table

1. Create a **public** GitHub repository and push this folder to the \`main\` branch.
2. Go to **Settings → Pages**: under *Build and deployment*, set **Source** to **Deploy from a branch**, select branch **\`main\`** and folder **\`/docs\`**, and click **Save**.
3. Go to **Settings → Actions → General → Workflow permissions**: select **Read and write permissions** and click **Save** (the workflow also requests \`contents: write\` and \`issues: write\`, but repository/organisation defaults can block it unless enabled here).
4. Check **Settings → General → Features** and make sure **Issues** are enabled.
5. Open \`${liveUrl}\`, play a round, beat the 5th score, and submit a score to test the loop.

### How the Shared High Score Loop Works
* The shared table lives in \`docs/data/scores.json\`, which GitHub Pages serves next to the game. The page fetches it each time the title screen appears (falling back to \`raw.githubusercontent.com\`).
* When you qualify for the top 5 and enter your three initials, the page displays a **Submit score on GitHub** button. Clicking it opens a pre-filled issue from \`.github/ISSUE_TEMPLATE/score.yml\`; the player presses **Submit new issue** (a free GitHub account is required).
* \`.github/workflows/add-score.yml\` runs \`.github/scripts/add_score.py\`. It inspects every open \`[score]\` issue, validates the submission (3 letters \`A–Z\`, score \`1..65535\`, matching 32-bit FNV-1a check code, non-bot user, maximum 3 entries per GitHub account), commits the updated \`docs/data/scores.json\`, and comments on and closes the issue.
* Until a score is accepted by the Action, it is stored in the player's browser (\`localStorage\`) and merged into their local high score table.
* If your site is hosted at a custom domain rather than \`owner.github.io/repo/\`, set \`REPO_OVERRIDE = "${owner}/${repo}"\` near the top of the high-score script in \`docs/index.html\` (and \`web/template_gh.html\`).

---

## Building from Z80 Source

Requires **Python 3** and **\`pasmo\`** (plus **Node.js** for the JSDOM browser tests):

\`\`\`bash
# 1. Expand ZX81 string macros (ZS / ZB / HSE), assemble crime.asm -> crime.bin, and wrap in crimecity.p
cd src && python3 build.py && python3 mkp.py
cp ../crimecity.p ../dist/crimecity_mc.p

# 2. Inject z80.js, sym.json, and base64 crimecity.p into docs/index.html
cd ../web && python3 build_web_gh.py ../docs/index.html
\`\`\`

* \`src/build.py\` converts ASCII strings in \`ZS\`, \`ZB\`, and \`HSE\` macros into ZX81 character codes and runs \`pasmo\`.
* \`src/mkp.py\` packages \`crime.bin\` inside a ZX81 \`1 REM\` statement followed by \`2 RAND USR VAL "16514"\` and a 24-line collapsed/expanded Display File.
* \`web/sym.json\` stores label addresses (\`HS\`, \`title\`, \`go2\`, \`SCORE\`) exported from the build so the browser wrapper can hook the title screen and game-over initials entry without modifying the Z80 ROM/RAM logic.

---

## Running the Automated Tests

\`\`\`bash
# Validate FNV-1a check-code parity (JS == Python), per-user cap (3), git commit/push, and error recovery
python3 tests/test_action.py

# End-to-end JSDOM test of docs/index.html with mocked fetch & keyboard input
cd web && npm i jsdom && node page_test_gh.js
\`\`\`

---

## Technical Notes

* The Z80 machine code calls ROM \`$0F2B\` (\`SLOW\`), reads the \`FRAMES\` counter at \`$4034\`, scans the 8×5 keyboard matrix directly via \`IN A,($FE)\`, and avoids \`IX\`/\`IY\` and shadow registers.
* \`docs/index.html\` does not bundle the copyrighted Sinclair ZX81 ROM; it uses its own minimal ~160-line Z80 CPU core (\`web/z80.js\`), a \`RET\` stub at \`$0F2B\`, and a custom 5×7 pixel font table.
* In the \`.P\` tape version, the high score table lives inside the \`1 REM\` machine code block, so typing \`SAVE "CRIMECITY"\` after quitting to BASIC (\`Q\`) preserves your high scores on tape.
`;
}
