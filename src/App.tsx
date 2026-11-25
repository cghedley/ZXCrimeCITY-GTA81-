import React, { useState, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import {
  Download,
  CheckSquare,
  Square,
  Copy,
  Check,
  FileCode,
  Terminal,
  ShieldCheck,
  Play,
  ExternalLink,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';
import {
  ScoreEntry,
  DEFAULT_ROM_SCORES,
  PB64,
  ISSUE_TEMPLATE_YML,
  WORKFLOW_YML,
  LICENSE_TXT,
  computeCheckCode,
} from './data/projectBundle';
import {
  generateTitleScreenshotSvg,
  generateGameplayScreenshotSvg,
  generateHighscoreScreenshotSvg,
  generateFormattedReadme,
} from './data/readmeAssets';
import { ZX81Emulator } from './components/ZX81Emulator';

type WorkspaceTab = 'README' | 'AUDIT' | 'FILES' | 'SCORES';

type RepoFilePath =
  | 'README.md'
  | 'docs/screenshots/title.svg'
  | 'docs/screenshots/gameplay.svg'
  | 'docs/screenshots/highscore.svg'
  | 'docs/index.html'
  | 'docs/data/scores.json'
  | '.github/workflows/add-score.yml'
  | '.github/ISSUE_TEMPLATE/score.yml'
  | '.github/scripts/add_score.py'
  | 'dist/crimecity_basic_v2.txt'
  | 'web/z80.js'
  | 'web/template_gh.html'
  | 'web/build_web_gh.py'
  | 'web/sym.json'
  | 'web/page_test_gh.js'
  | 'src/build.py'
  | 'src/mkp.py'
  | 'tests/test_action.py'
  | 'LICENSE';

const UPLOADED_FILE_MAP: Partial<Record<RepoFilePath, string>> = {
  'docs/index.html': '/assets/aistudio/index_4570befb.html',
  'docs/data/scores.json': '/assets/aistudio/scores_7a0b7943.json',
  '.github/scripts/add_score.py': '/assets/aistudio/add_score_05547806.py',
  'dist/crimecity_basic_v2.txt': '/assets/aistudio/crimecity_basic_v2_7bb68c6c.txt',
  'web/z80.js': '/assets/aistudio/z80_49eac05b.js',
  'web/template_gh.html': '/assets/aistudio/template_gh_bad94795.html',
  'web/build_web_gh.py': '/assets/aistudio/build_web_gh_f8efa62b.py',
  'web/sym.json': '/assets/aistudio/sym_7a53e2c3.json',
  'web/page_test_gh.js': '/assets/aistudio/page_test_gh_24a7c670.js',
  'src/build.py': '/assets/aistudio/build_051a2d9e.py',
  'src/mkp.py': '/assets/aistudio/mkp_b5298ceb.py',
  'tests/test_action.py': '/assets/aistudio/test_action_ef01878c.py',
};

const EXTRA_TEST_ASSETS: Record<string, string> = {
  'web/trace_js.js': '/assets/aistudio/trace_js_e85aa6be.js',
  'web/trace_py.py': '/assets/aistudio/trace_py_341596fc.py',
  'tests/sim.py': '/assets/aistudio/sim_f1bb17ae.py',
  'tests/t2.py': '/assets/aistudio/t2_04552b83.py',
  'tests/t3.py': '/assets/aistudio/t3_29023b6d.py',
  'tests/t4.py': '/assets/aistudio/t4_f7e4544c.py',
};

const PENDING_STORAGE_KEY = 'crimecity.pending.v2';

export default function App() {
  const [repoOwner, setRepoOwner] = useState<string>('c-g-hedley');
  const [repoName, setRepoName] = useState<string>('crimecity');
  const [centralScores, setCentralScores] = useState<ScoreEntry[]>([]);
  const [pendingScores, setPendingScores] = useState<ScoreEntry[]>(() => {
    try {
      const raw = localStorage.getItem(PENDING_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('README');
  const [selectedFile, setSelectedFile] = useState<RepoFilePath>('README.md');
  const [fileCache, setFileCache] = useState<Record<string, string>>({});
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
  const [copiedFile, setCopiedFile] = useState<boolean>(false);
  const [copiedReadme, setCopiedReadme] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Interactive check-code & add_score.py simulator
  const [testInitials, setTestInitials] = useState<string>('ABC');
  const [testScore, setTestScore] = useState<number>(3200);
  const [actionSimNotice, setActionSimNotice] = useState<string | null>(null);

  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: false,
    4: false,
    5: false,
    6: false,
  });

  // Memoize the 3 authentic ZX81 SVG screenshots
  const titleSvg = useMemo(() => generateTitleScreenshotSvg(), []);
  const gameplaySvg = useMemo(() => generateGameplayScreenshotSvg(), []);
  const highscoreSvg = useMemo(() => generateHighscoreScreenshotSvg(), []);
  const formattedReadme = useMemo(
    () => generateFormattedReadme(repoOwner, repoName),
    [repoOwner, repoName]
  );

  // Load all uploaded attachments into memory so they can be inspected and zipped
  useEffect(() => {
    const loadUploadedFiles = async () => {
      const loaded: Record<string, string> = {};
      const entries = [...Object.entries(UPLOADED_FILE_MAP), ...Object.entries(EXTRA_TEST_ASSETS)];
      await Promise.all(
        entries.map(async ([repoPath, assetUrl]) => {
          if (!assetUrl) return;
          try {
            const res = await fetch(assetUrl);
            if (res.ok) {
              loaded[repoPath] = await res.text();
            }
          } catch {
            // ignore fetch error
          }
        })
      );
      setFileCache(loaded);
    };
    loadUploadedFiles();
  }, []);

  // Sync pending scores to localStorage under 'crimecity.pending.v2'
  useEffect(() => {
    try {
      localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pendingScores.slice(0, 20)));
    } catch {
      // ignore storage errors
    }
  }, [pendingScores]);

  const handleAddPendingScore = (entry: ScoreEntry) => {
    setPendingScores((prev) => [...prev, entry]);
    setTestInitials(entry.n);
    setTestScore(entry.s);
    const code = computeCheckCode(entry.n, entry.s);
    setActionSimNotice(
      `New high score ${entry.n} ${entry.s} recorded in Z80 RAM (check=${code}). Click "Submit score on GitHub" below the screen or test the Action in tab 4.`
    );
  };

  const handleDiscardTopPending = () => {
    setPendingScores((prev) => {
      const sorted = [...prev].sort((a, b) => b.s - a.s);
      sorted.shift();
      return sorted;
    });
  };

  // Exact Python add_score.py evaluation simulation
  const handleSimulateGitHubAction = () => {
    const cleanInit = testInitials.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A');
    const validScore = Math.max(1, Math.min(65535, Math.floor(testScore || 1)));
    const code = computeCheckCode(cleanInit, validScore);
    const user = repoOwner || 'alice';

    const newEntry: ScoreEntry = {
      n: cleanInit,
      s: validScore,
      by: user,
      t: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };

    const merged = [...centralScores, newEntry];
    merged.sort((a, b) => b.s - a.s);

    const seen: Record<string, number> = {};
    const kept: ScoreEntry[] = [];
    for (const e of merged) {
      const u = e.by || 'player';
      seen[u] = (seen[u] || 0) + 1;
      if (seen[u] <= 3) {
        kept.push(e);
      }
    }
    const finalKept = kept.slice(0, 20);
    setCentralScores(finalKept);

    setPendingScores((prev) =>
      prev.filter((p) => !finalKept.some((c) => c.n === p.n && c.s === p.s))
    );

    setActionSimNotice(
      `add_score.py accepted [score] ${cleanInit} ${validScore} (check=${code}) → committed to docs/data/scores.json and refreshed Z80 RAM table.`
    );
  };

  const getFileContent = (path: RepoFilePath): string => {
    if (path === 'README.md') return formattedReadme;
    if (path === 'docs/screenshots/title.svg') return titleSvg;
    if (path === 'docs/screenshots/gameplay.svg') return gameplaySvg;
    if (path === 'docs/screenshots/highscore.svg') return highscoreSvg;
    if (path === '.github/workflows/add-score.yml') return WORKFLOW_YML;
    if (path === '.github/ISSUE_TEMPLATE/score.yml') return ISSUE_TEMPLATE_YML;
    if (path === 'LICENSE') return LICENSE_TXT;
    if (path === 'docs/data/scores.json') {
      return (
        JSON.stringify(
          {
            entries: centralScores.map(({ n, s, by, t }) => ({
              n,
              s,
              by: by || repoOwner || 'player',
              t: t || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            })),
          },
          null,
          1
        ) + '\n'
      );
    }
    return fileCache[path] || 'Loading file...';
  };

  const downloadSingleTextFile = (filename: string, content: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Assemble the complete, properly structured GitHub repository ZIP including README + SVG screenshots
  const handleDownloadFullRepoZip = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();

      // 1. Root files (Formatted README with Screenshots + MIT License)
      zip.file('README.md', formattedReadme);
      zip.file('LICENSE', LICENSE_TXT);

      // 2. GitHub Pages (/docs) + Authentic ZX81 Screenshots (/docs/screenshots/*.svg)
      zip.file('docs/index.html', getFileContent('docs/index.html'));
      zip.file('docs/data/scores.json', getFileContent('docs/data/scores.json'));
      zip.file('docs/screenshots/title.svg', titleSvg);
      zip.file('docs/screenshots/gameplay.svg', gameplaySvg);
      zip.file('docs/screenshots/highscore.svg', highscoreSvg);

      // 3. GitHub Actions & Issue Form (.github)
      zip.file('.github/workflows/add-score.yml', WORKFLOW_YML);
      zip.file('.github/ISSUE_TEMPLATE/score.yml', ISSUE_TEMPLATE_YML);
      zip.file('.github/scripts/add_score.py', getFileContent('.github/scripts/add_score.py'));

      // 4. Dist files (authentic 2690-byte ZX81 tape binary crimecity_mc.p)
      const pBytes = Uint8Array.from(atob(PB64), (c) => c.charCodeAt(0));
      zip.file('dist/crimecity_mc.p', pBytes);
      zip.file('crimecity.p', pBytes);
      zip.file('dist/crimecity_basic_v2.txt', getFileContent('dist/crimecity_basic_v2.txt'));

      // 5. Web build & test files
      zip.file('web/z80.js', getFileContent('web/z80.js'));
      zip.file('web/template_gh.html', getFileContent('web/template_gh.html'));
      zip.file('web/build_web_gh.py', getFileContent('web/build_web_gh.py'));
      zip.file('web/sym.json', getFileContent('web/sym.json'));
      zip.file('web/page_test_gh.js', getFileContent('web/page_test_gh.js'));

      // 6. Z80 build scripts & test suite
      zip.file('src/build.py', getFileContent('src/build.py'));
      zip.file('src/mkp.py', getFileContent('src/mkp.py'));
      zip.file('tests/test_action.py', getFileContent('tests/test_action.py'));

      Object.keys(EXTRA_TEST_ASSETS).forEach((extraPath) => {
        if (fileCache[extraPath]) {
          zip.file(extraPath, fileCache[extraPath]);
        }
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${repoName || 'crimecity'}-complete-repo.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const toggleStep = (id: number) => {
    setCompletedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const gitInitCommands = `# Push into your GitHub repository
git init -b main
git add -A
git commit -m "Deploy CRIME CITY ZX81 emulator, screenshots & GitHub Pages leaderboard"
git remote add origin https://github.com/${repoOwner || 'YOUR-NAME'}/${repoName || 'crimecity'}.git
git push -u origin main`;

  const copyCommands = () => {
    navigator.clipboard.writeText(gitInitCommands);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const copyActiveFile = () => {
    navigator.clipboard.writeText(getFileContent(selectedFile));
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  const copyFormattedReadme = () => {
    navigator.clipboard.writeText(formattedReadme);
    setCopiedReadme(true);
    setTimeout(() => setCopiedReadme(false), 2000);
  };

  const completedCount = Object.values(completedSteps).filter(Boolean).length;

  const mergedDisplayScores = [
    ...centralScores.map((e) => ({ ...e, source: 'docs/data/scores.json' })),
    ...pendingScores.map((e) => ({ ...e, by: 'local-browser', source: 'pending (local)' })),
    ...DEFAULT_ROM_SCORES.map((e) => ({ ...e, source: 'ZX81 REM default' })),
  ]
    .sort((a, b) => b.s - a.s)
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-zinc-800 bg-zinc-950/90 sticky top-0 z-30 backdrop-blur">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          CRIME CITY ZX81
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
          <a
            href="#emulator"
            onClick={() => setActiveTab('README')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Z80 Emulator
          </a>
          <a
            href="#deployment-hub"
            onClick={() => setActiveTab('README')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            README & Screenshots
          </a>
          <a
            href="#deployment-hub"
            onClick={() => setActiveTab('AUDIT')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            GitHub Setup
          </a>
          <a
            href="#deployment-hub"
            onClick={() => setActiveTab('FILES')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Repo Files
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadFullRepoZip}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-mono font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Packaging Repo...' : 'Download Complete Repo (.ZIP)'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main id="top" className="max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-8 flex-1">
        {/* Top Audit Summary Header */}
        <div className="mb-8 pb-6 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="text-xs font-mono text-red-400">
              AUTHENTIC Z80 MACHINE CODE ($4082) · FORMATTED README + 3 ZX81 SCREENSHOTS READY
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white">
              CRIME CITY for the ZX81 — Live Z80 Emulator & GitHub Pages Kit
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              We generated 3 pixel-exact ZX81 screenshots (<code className="text-zinc-200">docs/screenshots/title.svg</code>,{' '}
              <code className="text-zinc-200">docs/screenshots/gameplay.svg</code>, and{' '}
              <code className="text-zinc-200">docs/screenshots/highscore.svg</code>) using the game&apos;s authentic 5×7 font and dithered city blocks, and formatted your complete <code className="text-zinc-200">README.md</code> with badges, tables, and embedded screenshots. Both are included in the **Download Complete Repo (.ZIP)** button.
            </p>
          </div>

          {/* GitHub Target Repository Inputs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-end gap-3 shrink-0">
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                GITHUB USERNAME
              </label>
              <input
                type="text"
                value={repoOwner}
                onChange={(e) => setRepoOwner(e.target.value.trim())}
                placeholder="your-username"
                className="w-full sm:w-40 px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded text-zinc-100 focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                REPOSITORY NAME
              </label>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value.trim())}
                placeholder="crimecity"
                className="w-full sm:w-44 px-3 py-1.5 text-xs font-mono bg-zinc-950 border border-zinc-800 rounded text-zinc-100 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
        </div>

        {/* 12-Column Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Columns: Real Z80 Machine Code Emulator */}
          <section id="emulator" className="lg:col-span-7">
            <ZX81Emulator
              centralScores={centralScores}
              pendingScores={pendingScores}
              onAddPendingScore={handleAddPendingScore}
              onDiscardTopPending={handleDiscardTopPending}
              repoOwner={repoOwner}
              repoName={repoName}
            />
          </section>

          {/* Right 5 Columns: Formatted README, Screenshots & GitHub Pages Hub */}
          <section id="deployment-hub" className="lg:col-span-5 flex flex-col gap-4">
            {/* Segmented Tab Controls */}
            <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
              {[
                { id: 'README' as WorkspaceTab, label: '1. README & Shots' },
                { id: 'AUDIT' as WorkspaceTab, label: '2. GitHub Steps' },
                { id: 'FILES' as WorkspaceTab, label: '3. Repo Files' },
                { id: 'SCORES' as WorkspaceTab, label: '4. Test Action' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 px-2 text-xs font-mono font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: FORMATTED README & SCREENSHOTS GALLERY */}
            {activeTab === 'README' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-white">
                      Formatted README.md & ZX81 Screenshots
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Bundled inside <code className="text-zinc-200">docs/screenshots/*.svg</code> and linked in <code className="text-zinc-200">README.md</code>.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copyFormattedReadme}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-mono rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {copiedReadme ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedReadme ? 'Copied README' : 'Copy README.md'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadSingleTextFile('README.md', formattedReadme, 'text/markdown')
                      }
                      className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>README.md</span>
                    </button>
                  </div>
                </div>

                {/* 3 Generated ZX81 Screenshots Preview */}
                <div className="space-y-2">
                  <div className="text-xs font-mono text-zinc-300 flex items-center justify-between">
                    <span>GENERATED SCREENSHOTS (DOCS/SCREENSHOTS/*.SVG)</span>
                    <span className="text-zinc-500">256×192 ULA PIXEL-EXACT</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      {
                        label: 'title.svg',
                        caption: 'Title & Scores',
                        svg: titleSvg,
                      },
                      {
                        label: 'gameplay.svg',
                        caption: 'City & Police',
                        svg: gameplaySvg,
                      },
                      {
                        label: 'highscore.svg',
                        caption: 'Initials Entry',
                        svg: highscoreSvg,
                      },
                    ].map((shot) => (
                      <div
                        key={shot.label}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 flex flex-col gap-1.5"
                      >
                        <div className="w-full aspect-[4/3] overflow-hidden rounded border border-zinc-900 bg-black flex items-center justify-center">
                          <img
                            src={`data:image/svg+xml;utf8,${encodeURIComponent(shot.svg)}`}
                            alt={shot.caption}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-zinc-300 truncate">{shot.label}</span>
                          <button
                            type="button"
                            onClick={() =>
                              downloadSingleTextFile(shot.label, shot.svg, 'image/svg+xml')
                            }
                            className="text-red-400 hover:text-red-300 flex items-center gap-0.5 cursor-pointer shrink-0"
                            title={`Download ${shot.label}`}
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Formatted README.md Markdown Source */}
                <div>
                  <div className="flex items-center justify-between px-3 py-2 bg-zinc-950 border border-b-0 border-zinc-800 rounded-t-lg text-xs font-mono text-zinc-300">
                    <span>README.md (Formatted with Screenshots & Badges)</span>
                    <span className="text-zinc-500">{formattedReadme.length} bytes</span>
                  </div>
                  <pre className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-b-lg text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-[320px] overflow-y-auto leading-relaxed">
                    {formattedReadme}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB 2: AUDIT OF UPLOADED FILES & WHAT ELSE YOU NEED TO DO */}
            {activeTab === 'AUDIT' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
                <div className="p-3.5 bg-zinc-950 border border-amber-500/40 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-semibold text-amber-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>ALL MISSING FILES & SCREENSHOTS INCLUDED IN ZIP</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    The **Download Complete Repo (.ZIP)** button bundles all 19 of your uploaded files plus:
                  </p>
                  <ul className="text-xs text-zinc-400 space-y-1 font-mono pl-1">
                    <li>
                      • <strong className="text-zinc-200">README.md + docs/screenshots/*.svg</strong> (formatted README + 3 ZX81 screenshots)
                    </li>
                    <li>
                      • <strong className="text-zinc-200">.github/workflows/add-score.yml</strong> (runs add_score.py on issue open)
                    </li>
                    <li>
                      • <strong className="text-zinc-200">.github/ISSUE_TEMPLATE/score.yml</strong> (pre-filled score submission form)
                    </li>
                    <li>
                      • <strong className="text-zinc-200">dist/crimecity_mc.p &amp; LICENSE</strong> (2,690-byte ZX81 tape file &amp; MIT licence)
                    </li>
                  </ul>
                </div>

                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <h2 className="font-display text-base font-bold text-white">
                    GitHub Pages Activation Checklist
                  </h2>
                  <span className="text-xs font-mono text-zinc-400 tabular-nums">
                    {completedCount}/6 DONE
                  </span>
                </div>

                <div className="space-y-2.5">
                  {[
                    {
                      id: 1,
                      title: '01. Download Complete Repo (.ZIP) with README & Screenshots',
                      detail:
                        'Click "Download Complete Repo (.ZIP)" in the top bar. It includes your formatted README.md, docs/screenshots/*.svg, docs/index.html, and .github/workflows/add-score.yml.',
                    },
                    {
                      id: 2,
                      title: '02. Push or upload to your PUBLIC GitHub repo (main branch)',
                      detail:
                        'Commit and push the unzipped folder (including the hidden .github folder and docs/screenshots/) to the main branch of your public repository.',
                    },
                    {
                      id: 3,
                      title: '03. Settings → Pages: Deploy from branch main /docs',
                      detail:
                        'In your GitHub repo, open Settings → Pages. Under "Build and deployment", set Source to "Deploy from a branch", select branch "main" and folder "/docs", and click Save.',
                    },
                    {
                      id: 4,
                      title: '04. Settings → Actions → General: Read and write permissions',
                      detail:
                        'Under "Workflow permissions", choose "Read and write permissions" and click Save so .github/workflows/add-score.yml can commit new scores to docs/data/scores.json.',
                    },
                    {
                      id: 5,
                      title: '05. Settings → General → Features: Ensure Issues are enabled',
                      detail:
                        'Confirm the "Issues" checkbox is checked so players clicking "Submit score on GitHub" can submit the pre-filled score issue.',
                    },
                    {
                      id: 6,
                      title: '06. Open your live GitHub Pages URL & test a score',
                      detail: `Open https://${repoOwner || 'your-name'}.github.io/${repoName || 'crimecity'}/, score > 500 points, enter 3 initials, and click "Submit score on GitHub".`,
                    },
                  ].map((step) => {
                    const done = !!completedSteps[step.id];
                    return (
                      <div
                        key={step.id}
                        onClick={() => toggleStep(step.id)}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer flex items-start gap-3 ${
                          done
                            ? 'bg-zinc-950/60 border-zinc-800/80 text-zinc-500'
                            : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-200'
                        }`}
                      >
                        <button
                          type="button"
                          className="mt-0.5 shrink-0 cursor-pointer"
                          aria-label={`Toggle ${step.title}`}
                        >
                          {done ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-500" />
                          )}
                        </button>
                        <div className="space-y-1 text-xs">
                          <div className={`font-semibold ${done ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
                            {step.title}
                          </div>
                          <p className="text-zinc-400 leading-relaxed">{step.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-red-500" />
                      <span>GIT COMMANDS TO PUSH YOUR REPO</span>
                    </span>
                    <button
                      type="button"
                      onClick={copyCommands}
                      className="text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                    {gitInitCommands}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB 3: REPOSITORY FILE INSPECTOR */}
            {activeTab === 'FILES' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                <div className="border-b border-zinc-800 pb-3">
                  <h2 className="font-display text-lg font-bold text-white">
                    Repository File Tree Inspector
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Inspect every file included in the downloadable GitHub repository bundle.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[210px] overflow-y-auto pr-1">
                  {(
                    [
                      'README.md',
                      'docs/screenshots/title.svg',
                      'docs/screenshots/gameplay.svg',
                      'docs/screenshots/highscore.svg',
                      '.github/workflows/add-score.yml',
                      '.github/ISSUE_TEMPLATE/score.yml',
                      '.github/scripts/add_score.py',
                      'docs/index.html',
                      'docs/data/scores.json',
                      'dist/crimecity_basic_v2.txt',
                      'web/template_gh.html',
                      'web/z80.js',
                      'web/build_web_gh.py',
                      'web/sym.json',
                      'web/page_test_gh.js',
                      'src/build.py',
                      'src/mkp.py',
                      'tests/test_action.py',
                      'LICENSE',
                    ] as RepoFilePath[]
                  ).map((fileKey) => (
                    <button
                      key={fileKey}
                      type="button"
                      onClick={() => setSelectedFile(fileKey)}
                      className={`px-2.5 py-2 rounded-lg text-left text-xs font-mono flex items-center justify-between gap-1.5 transition-colors truncate cursor-pointer ${
                        selectedFile === fileKey
                          ? 'bg-red-600/20 border border-red-500/50 text-white'
                          : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <FileCode className="w-3.5 h-3.5 shrink-0 text-red-400" />
                        <span className="truncate">{fileKey}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div>
                  <div className="flex items-center justify-between px-3 py-2 bg-zinc-950 border border-b-0 border-zinc-800 rounded-t-lg text-xs font-mono text-zinc-300">
                    <span>{selectedFile}</span>
                    <button
                      type="button"
                      onClick={copyActiveFile}
                      className="flex items-center gap-1 text-zinc-400 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {copiedFile ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedFile ? 'Copied' : 'Copy file'}</span>
                    </button>
                  </div>
                  <pre className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-b-lg text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-[360px] overflow-y-auto leading-relaxed">
                    {getFileContent(selectedFile)}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB 4: HIGH-SCORE CHECK-CODE & ACTION SIMULATOR */}
            {activeTab === 'SCORES' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                <div className="border-b border-zinc-800 pb-3">
                  <h2 className="font-display text-lg font-bold text-white">
                    GitHub Action & FNV-1a Check-Code Tester
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Simulates <code className="text-zinc-200">.github/scripts/add_score.py</code> (32-bit FNV-1a hash of{' '}
                    <code className="text-zinc-200">&quot;INITIALS:SCORE:crimecity&quot;</code>) and updates the Z80 emulator&apos;s high score table live.
                  </p>
                </div>

                {actionSimNotice && (
                  <div className="p-3 bg-zinc-950 border border-emerald-500/40 rounded-lg text-xs font-mono text-emerald-300 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span>{actionSimNotice}</span>
                  </div>
                )}

                <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-lg space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                        INITIALS (A-Z)
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={testInitials}
                        onChange={(e) => setTestInitials(e.target.value.toUpperCase())}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-zinc-900 border border-zinc-800 rounded text-white uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                        SCORE (1–65535)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        value={testScore}
                        onChange={(e) => setTestScore(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-zinc-900 border border-zinc-800 rounded text-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                        8-HEX CHECK CODE
                      </label>
                      <div className="px-2.5 py-1.5 text-xs font-mono bg-zinc-900 border border-zinc-800 rounded text-amber-400 font-bold tabular-nums">
                        {computeCheckCode(testInitials, testScore)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSimulateGitHubAction}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Simulate add_score.py Commit</span>
                    </button>
                    <a
                      href={`https://github.com/${repoOwner || 'YOUR-NAME'}/${repoName || 'crimecity'}/issues/new?template=score.yml&title=${encodeURIComponent(
                        `[score] ${testInitials} ${testScore}`
                      )}&initials=${encodeURIComponent(testInitials)}&score=${encodeURIComponent(
                        String(testScore)
                      )}&check=${encodeURIComponent(computeCheckCode(testInitials, testScore))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Open GitHub Issue URL</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400">
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 px-2">INIT</th>
                        <th className="py-2 px-2">SCORE</th>
                        <th className="py-2 px-2">CHECK CODE</th>
                        <th className="py-2 pl-2">SOURCE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 tabular-nums">
                      {mergedDisplayScores.map((entry, idx) => (
                        <tr key={`${entry.n}-${entry.s}-${idx}`} className="text-zinc-200">
                          <td className="py-2 pr-2 text-zinc-500">{idx + 1}</td>
                          <td className="py-2 px-2 font-bold text-white">{entry.n}</td>
                          <td className="py-2 px-2 text-emerald-400">{entry.s}</td>
                          <td className="py-2 px-2 text-zinc-400">
                            {computeCheckCode(entry.n, entry.s)}
                          </td>
                          <td className="py-2 pl-2 text-zinc-400">{entry.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-5 px-6 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-4 max-w-[1380px] w-full mx-auto">
        <div>CRIME CITY for the Sinclair ZX81 (16K) · Authentic Z80 Machine Code Emulator</div>
        <div>Formatted README.md + 3 ZX81 SVG Screenshots Bundled</div>
      </footer>
    </div>
  );
}
