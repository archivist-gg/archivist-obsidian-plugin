#!/usr/bin/env node
// Zero-dependency CDP driver: verifies the Archivist plugin inside the LIVE Obsidian.
// Node >= 22 (built-in fetch + WebSocket). No puppeteer/playwright required.
//
// DEFAULT flow (unchanged, runs when no new flags are passed):
//   1. connect to Obsidian's remote-debugging port (open it with obsidian-debug.sh)
//   2. reload the plugin (disable + enable) so the freshly deployed main.js is live
//   3. open the target note and force reading view
//   4. wait for the rendered selector (default .archivist-pc-sheet)
//   5. screenshot the window
//   6. report console errors/warnings + uncaught exceptions captured during 2 to 5
//
// OPT-IN modes (PC-sheet visual testing; each is additive, default behavior is untouched):
//   --tab actions|passive       click that PC tab before asserting / screenshotting
//   --widths 1200,768,400       responsive width sweep: narrow the pane per width, MEASURE
//                               .pc-content clientWidth, screenshot each width, and fail the
//                               sweep as VACUOUS if the narrowest step does not drop below 499px
//   --check-overflow            fail on horizontal overflow (scrollWidth > clientWidth) on the check root
//   --check-overlap             fail on bounding-box overlap of in-flow sibling rows/cells
//   --check-root <sel>          check root for the two detectors above (default .pc-content). The --widths
//                               breakpoint measurement stays PINNED to .pc-content: BREAKPOINT = 499 is
//                               PC-sheet-specific, so routing it would pass meaninglessly off the PC sheet.
//   --assert-selector <sel>     fail unless at least one element matches <sel>
//   --assert-text <text>        fail unless rendered text matches: substring, /regex/flags, or one of
//                               the literal keywords  no-emdash  /  no-emdash-strict . Both scan for
//                               U+2014 and report BOTH signals (inVisible from innerText, inHtml from
//                               innerHTML); only the verdict differs. no-emdash keys to visible text;
//                               no-emdash-strict keys to innerHTML and so also sees a hidden/inactive
//                               tab panel, whose innerText is '' while its innerHTML is populated.
//                               Neither looks for the &mdash; entity: the HTML serializer escapes only
//                               & < > NBSP (and " in attributes), so that string is never produced.
//                               BOTH modes MUST be scoped with --within (a sheet-wide scan is disabled
//                               on purpose: weapon formatDamage emits U+2014 for zero-dice weapons).
//   --within <sel>             scope --assert-text (esp. the no-emdash modes) to a subtree
//   --self-test                inject a known-bad + a known-good fixture and assert the overflow /
//                               overlap detector fires on the bad one and stays clean on the good one
//   --click <sel>              ORDERED STEPS. These six verbs are collected by a walk over argv,
//   --press-key Escape|Enter|Tab   not by opt() (which keeps only the FIRST occurrence of a
//   --wait <ms>                    repeated flag), so they may repeat and they run in the order
//   --expect <sel>                 written. --expect-absent is the negative form --assert-selector
//   --expect-absent <sel>          lacks: without it "Escape closes the modal" is not expressible.
//   --shot <name>                  Keys go out as TRUSTED Input.dispatchKeyEvent events, because an
//                                  untrusted dispatchEvent does not drive Obsidian's Keymap.
//                                  MISUSE, all caught offline at parse time and exiting 2 before
//                                  connecting: a verb with no value, an unknown --press-key, and a
//                                  non-numeric --wait. WHERE they run: WITHOUT --widths, once at
//                                  natural width, after the --tab click and before the screenshot.
//                                  WITH --widths, once per (width, tab) PAIR and NOT at natural
//                                  width, so a step list cannot fire before the sweep has narrowed
//                                  anything. Declaring steps that never execute fails the run.
//                                  Steps MUST be self-reverting: nothing left open, no note
//                                  written. --shot names carry the pair label, or the images from
//                                  a multi-width sweep would overwrite each other.
//   --scroll-capture [sel]      step the SCROLL CONTAINER by one clientHeight at a time, screenshot
//                               each viewport-full, then restore scrollTop. The container is
//                               Obsidian's own reading-view scroller, NOT .pc-content, which carries
//                               no overflow-y in any partial. Resolution order: .markdown-preview-view
//                               then .cm-scroller, first candidate that actually scrolls wins, else
//                               first that merely exists. A container that matches nothing, or a
//                               scrollTop that does not come back to where it started, FAILS the run.
//                               The selector is OPTIONAL, and opt() returns the NEXT argv token
//                               whenever the flag is present, so the parse must treat BOTH undefined
//                               (a trailing --scroll-capture) and a leading "--" (the next flag) as
//                               "no value given" using strict ===. A loose == null would fold the
//                               trailing case into the flag-absent branch and silently disable it.
//                               Runs ONCE, at natural width, after any --widths sweep has restored
//                               the pane: the shot names carry no width/tab label, so running it per
//                               sweep pair would overwrite its own evidence.
//
// Retained flags: --port 9222, --vault DnD, --note "PlayerCharacters/Grendal.md",
//                 --plugin archivist-gg, --selector .archivist-pc-sheet, --out DIR,
//                 --no-reload, --timeout 15000
//
// Reliability: --cdp-timeout 60000 bounds every individual CDP message, so a stalled or dropped
//              socket fails loudly instead of hanging forever. It is separate from --timeout,
//              which is and stays the selector poll budget.
//
// Exit codes: 0 verified · 1 verification failed (now ALSO on overflow, overlap, a check root that
//             matched no element, a --tab that failed to activate, a failed assertion, a failed
//             step, a vacuous width sweep, a self-test detector miss, or a scroll container that is
//             missing or left unrestored)
//             · 2 cannot connect, wrong vault, or misuse. MISUSE is the FULL offline parse-time
//             set, and this line is the one that goes stale: a no-emdash mode without --within, a
//             step verb with no value, an unknown --press-key value, and a non-finite --wait. The
//             last two are also recorded in the step-verb flag block above; the two statements must
//             agree, because a reader who trusts only this line under-tests the parse guards.
//
// NOTE on --vault: Obsidian can have SEVERAL vault windows open at once, each its own CDP page
// target. Targets are matched by the stable " - <vault> - Obsidian" window-title segment, and the
// vault name is re-asserted via app.vault.getName() after connecting: verifying against the wrong
// vault silently is exactly the failure this prevents.
//
// NOTE on responsiveness: the PC sheet is CONTAINER-query responsive (@container off .pc-content /
// the outer .archivist-pc-sheet), driven by the Obsidian pane/leaf width, NOT the device viewport.
// Emulation.setDeviceMetricsOverride alone may not narrow the pane if the sidebars pin it, so the
// sweep collapses both sidebars and constrains the active workspace leaf directly.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const has = (name) => args.includes(`--${name}`);

const PORT = Number(opt('port', '9222'));
const VAULT = opt('vault', 'DnD');
const NOTE = opt('note', 'PlayerCharacters/Grendal.md');
const PLUGIN = opt('plugin', 'archivist-gg');
const SELECTOR = opt('selector', '.archivist-pc-sheet');
const OUT = opt('out', '/Users/shinoobi/w/archivist-obsidian/.superpowers/verify');
const TIMEOUT = Number(opt('timeout', '15000'));
// Per-message CDP reply budget. Deliberately NOT derived from TIMEOUT (the selector poll):
// the plugin reload and the screenshot capture legitimately take longer than 15s.
const CDP_TIMEOUT = Number(opt('cdp-timeout', '60000'));

// new opt-in modes
const TAB = opt('tab', null);
const WIDTHS_RAW = opt('widths', null);
const CHECK_OVERFLOW = has('check-overflow');
const CHECK_OVERLAP = has('check-overlap');
const CHECK_ROOT = opt('check-root', '.pc-content');
const ASSERT_SELECTOR = opt('assert-selector', null);
const ASSERT_TEXT = opt('assert-text', null);
const WITHIN = opt('within', null);
const SELF_TEST = has('self-test');
// The value comes from opt(), so guard against swallowing the next flag:
// `--scroll-capture --check-overflow` must not take "--check-overflow" as the
// container selector. Same rule the step walk uses. [Gate-2 N7a]
//
// STRICT === on BOTH clauses, never ==. opt() returns args[i + 1], NOT the default, whenever the
// flag is present, so a TRAILING --scroll-capture yields undefined. Under `SCROLL_RAW == null` that
// case collapses into the flag-absent branch, SCROLL_CAPTURE becomes null, the capture block is
// skipped, scrollFail stays false and the run exits 0 having taken ZERO shots. `--widths 400
// --scroll-capture` is exactly that shape, so the flag would ship silently disabled in its own
// prescribed invocation. The tell for the bug is that the `=== undefined` clause goes dead.
const SCROLL_RAW = has('scroll-capture') ? opt('scroll-capture', '') : null;
const SCROLL_CAPTURE = SCROLL_RAW === null ? null
  : (SCROLL_RAW === undefined || SCROLL_RAW.startsWith('--') ? '' : SCROLL_RAW);

const BREAKPOINT = 499; // .pc-content below this exercises the narrow container-query path
const tabToPanel = (t) => (t == null ? null : t.startsWith('panel-') ? t : `panel-${t}`);

// --- ordered step list -----------------------------------------------------
// Collected by an ordered walk over argv rather than opt(): opt() uses args.indexOf and returns
// only the FIRST occurrence, silently dropping every repeat with no diagnostic. The walk is
// therefore required both for SEQUENCING (steps run in the order given) and to avoid silent loss.
// STEP_VERBS is a Set, NOT an object literal: with a bare object, --constructor, --toString and
// --valueOf all resolve truthy through Object.prototype and would be consumed as step verbs.
// This sits ABOVE the misuse guard below because both guards must precede the first fetch, so
// the no-value guard is reachable without a running Obsidian.
const STEP_VERBS = new Set(['click', 'press-key', 'wait', 'expect', 'expect-absent', 'shot']);
// Known --press-key values. Declared HERE, above the walk rather than beside pressKey, so an
// unknown key is misuse caught OFFLINE: validating it inside runSteps would only fire after
// connecting, after the plugin reload, and after every preceding step had already executed
// against the LIVE vault. Membership is tested with Object.hasOwn, never a truthiness check on
// VK[value]: this is a plain object, so VK['constructor'] is truthy and a bare `!VK[value]`
// would wave --press-key constructor straight through, which is the same Object.prototype
// hazard STEP_VERBS uses a Set to avoid.
const VK = { Escape: 27, Enter: 13, Tab: 9 };
const STEPS = [];
for (let i = 0; i < args.length; i++) {
  const tok = args[i];
  if (!tok.startsWith('--')) continue;
  const verb = tok.slice(2);
  if (!STEP_VERBS.has(verb)) continue;
  const value = args[i + 1];
  // "No value" covers BOTH shapes on purpose: a trailing --press-key, and --press-key --wait 100
  // where the next token merely looks like a flag.
  if (value === undefined || value.startsWith('--')) {
    console.error(`FAIL: --${verb} requires a value (got ${value === undefined ? 'end of arguments' : value}).`);
    process.exit(2);
  }
  if (verb === 'press-key' && !Object.hasOwn(VK, value)) {
    console.error(`FAIL: --press-key ${value} is not a known key (known: ${Object.keys(VK).join(', ')}).`);
    process.exit(2);
  }
  // Number('abc') is NaN and setTimeout(r, NaN) fires in about 2ms, so an unvalidated --wait
  // would report PASS having waited for nothing.
  if (verb === 'wait' && !Number.isFinite(Number(value))) {
    console.error(`FAIL: --wait requires a finite number of milliseconds (got ${value}).`);
    process.exit(2);
  }
  STEPS.push({ verb, value });
  i++;
}

// misuse guard (before touching the environment): a sheet-wide em-dash scan is intentionally
// disabled, so EVERY no-emdash mode requires an explicit --within scope. Widening this list and
// the dispatch below must stay in lockstep: a mode the guard knows but the dispatch does not
// degrades into an always-failing substring match, and a mode the dispatch knows but the guard
// does not silently skips the --within requirement.
const EMDASH_MODES = ['no-emdash', 'no-emdash-strict'];
if (EMDASH_MODES.includes(ASSERT_TEXT) && !WITHIN) {
  console.error(`FAIL: --assert-text ${ASSERT_TEXT} requires --within <selector>.`);
  console.error('      A sheet-wide em-dash scan is disabled on purpose: weapon formatDamage emits U+2014');
  console.error('      for zero-dice weapons (pre-existing, benign). Scope it, e.g. --within ".pc-weapon-mastery".');
  process.exit(2);
}

// --- connect ---------------------------------------------------------------
let targets;
try {
  targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
} catch {
  console.error(`FAIL: no CDP endpoint on 127.0.0.1:${PORT}.`);
  console.error(`      Open one with: obsidian-debug.sh ${PORT}  (relaunches Obsidian with --remote-debugging-port)`);
  process.exit(2);
}
const pages = targets.filter((t) => t.type === 'page' && t.url.startsWith('app://obsidian.md'));
const target = pages.find((t) => t.title.includes(` - ${VAULT} - Obsidian`));
if (!target) {
  console.error(`FAIL: no window for vault "${VAULT}" among ${pages.length} Obsidian window(s):`);
  for (const p of pages) console.error(`      - ${p.title}`);
  console.error(`      (pass --vault <name>, or close stray vault windows)`);
  process.exit(2);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });

let nextId = 1;
const pending = new Map();
const consoleErrors = [];
const consoleWarnings = [];
const exceptions = [];

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    if (msg.params.type === 'error') consoleErrors.push(text);
    if (msg.params.type === 'warning') consoleWarnings.push(text);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    exceptions.push(d.exception?.description || d.text || 'unknown exception');
  }
};

// A dead socket must not strand in-flight requests. This REPLACES the handshake-only onerror
// binding above, which stayed bound but unhandled once that promise had settled.
const failAllPending = (why) => {
  for (const [, { reject }] of pending) reject(new Error(why));
  pending.clear();
};
ws.onclose = () => failAllPending('CDP socket closed while requests were in flight');
ws.onerror = () => failAllPending('CDP socket error while requests were in flight');

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    // A send on an already-CLOSED socket is a silent no-op per WHATWG (only
    // CONNECTING throws), so without this guard the reply never arrives and the
    // call blocks for the FULL CDP_TIMEOUT before rejecting with the wrong
    // message. failAllPending clears the map, but any LATER send registers a new
    // entry, and the sweep's restore in the finally is exactly such a call.
    if (ws.readyState !== 1) {
      reject(new Error(`CDP socket is not open (readyState ${ws.readyState}): ${method}`));
      return;
    }
    const id = nextId++;
    const timer = setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`CDP timeout after ${CDP_TIMEOUT}ms: ${method}`));
    }, CDP_TIMEOUT);
    const done = (fn) => (v) => { clearTimeout(timer); fn(v); };
    pending.set(id, { resolve: done(resolve), reject: done(reject) });
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaljs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    throw new Error('page exception: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Runtime.enable');
await send('Page.enable');

// --- verify ----------------------------------------------------------------
const report = { note: NOTE, plugin: PLUGIN, selector: SELECTOR };

const env = await evaljs(
  `({ vault: app.vault.getName(), enabled: app.plugins.enabledPlugins.has(${JSON.stringify(PLUGIN)}),
      version: app.plugins.plugins[${JSON.stringify(PLUGIN)}]?.manifest?.version ?? null })`
);
report.vault = env.vault;
report.versionBefore = env.version;
console.log(`== vault "${env.vault}" · ${PLUGIN}@${env.version} (enabled: ${env.enabled})`);
if (env.vault !== VAULT) {
  console.error(`FAIL: connected window's vault is "${env.vault}", expected "${VAULT}", aborting before touching anything.`);
  ws.close();
  process.exit(2);
}

if (!has('no-reload')) {
  report.reloaded = await evaljs(
    `(async () => { await app.plugins.disablePlugin(${JSON.stringify(PLUGIN)});
                    await app.plugins.enablePlugin(${JSON.stringify(PLUGIN)});
                    return app.plugins.plugins[${JSON.stringify(PLUGIN)}]?.manifest?.version ?? null })()`
  );
  console.log(`== plugin reloaded -> version ${report.reloaded}`);
}

const opened = await evaljs(
  `(async () => { const f = app.vault.getAbstractFileByPath(${JSON.stringify(NOTE)});
      if (!f) return { ok: false, error: 'note not found: ' + ${JSON.stringify(NOTE)} };
      const leaf = app.workspace.getLeaf(false); await leaf.openFile(f);
      const st = leaf.getViewState(); if (st.state) { st.state.mode = 'preview'; await leaf.setViewState(st); }
      return { ok: true }; })()`
);
report.noteOpened = opened.ok;
if (!opened.ok) console.error(`== FAIL opening note: ${opened.error}`);

let found = 0;
if (opened.ok) {
  const deadline = Date.now() + TIMEOUT;
  while (Date.now() < deadline) {
    found = await evaljs(`document.querySelectorAll(${JSON.stringify(SELECTOR)}).length`);
    if (found > 0) break;
    await sleep(500);
  }
}
report.selectorCount = found;
console.log(`== selector "${SELECTOR}": ${found} rendered element(s)`);

mkdirSync(OUT, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// --- page-side detector library (identical code used by both real checks and the self-test) ---
// Injected only when a mode that needs it is active, so a default run touches nothing extra.
if (found > 0 && (SELF_TEST || CHECK_OVERFLOW || CHECK_OVERLAP || WIDTHS_RAW)) {
  await evaljs(`(() => {
    window.__vv = {
      overflow: function(rootSel){
        var root = document.querySelector(rootSel);
        if(!root) return { root: rootSel, present:false, overflow:false, culprits:[] };
        var cw = root.clientWidth, sw = root.scrollWidth;
        var overflow = sw > cw + 1;
        var culprits = [];
        if(overflow){
          var rootRight = root.getBoundingClientRect().right;
          var seen = {};
          var all = root.querySelectorAll('*');
          for(var i=0;i<all.length;i++){
            var el = all[i];
            var r = el.getBoundingClientRect();
            if(r.width < 1 || r.height < 1) continue;
            var over = r.right - rootRight;
            if(over > 1){
              var cls = (typeof el.className === 'string' && el.className.trim()) ? '.'+el.className.trim().split(/\\s+/).join('.') : '';
              var key = el.tagName + cls;
              if(seen[key]) continue; seen[key]=1;
              culprits.push({ el: el.tagName.toLowerCase()+cls, right: Math.round(r.right), overBy: Math.round(over), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
              if(culprits.length>=5) break;
            }
          }
        }
        return { root: rootSel, present:true, clientWidth: cw, scrollWidth: sw, overflow: overflow, culprits: culprits };
      },
      overlap: function(rootSel){
        var root = document.querySelector(rootSel);
        if(!root) return { root: rootSel, present:false, overlaps:[] };
        var overlaps = [];
        // Ruling (R4-P2b): this filter deliberately does NOT special-case
        // position:sticky, transforms, or negative margins.
        //  - sticky: zero declarations exist in this codebase, so the filter
        //    proposed upstream would have guarded nothing.
        //  - negative margins: the canonical TRUE-positive shape. The
        //    self-test's own known-bad fixture manufactures its overlap with
        //    margin-top:-30px, so filtering them would destroy the detector's
        //    only proof that it fires.
        //  - transforms: getBoundingClientRect returns the TRANSFORMED box, so
        //    a transform-shifted visual overlap is a real visual overlap.
        // The residual worth watching is a transformed element whose layout box
        // does not overlap but whose painted box does while being visually
        // intended (icon nudges, hover lifts). Measured in R4-P2b's 7a probe;
        // any treatment is PARKED to the ledger, never applied blind.
        var inflow = function(el){
          var cs = getComputedStyle(el);
          if(cs.position==='absolute'||cs.position==='fixed') return false;
          var d = cs.display;
          if(d==='none'||d==='inline'||d==='contents') return false;
          if(cs.visibility==='hidden') return false;
          return true;
        };
        var desc = function(el){ var c = (typeof el.className==='string'&&el.className.trim())?'.'+el.className.trim().split(/\\s+/).slice(0,3).join('.'):''; return el.tagName.toLowerCase()+c; };
        var parents = [root];
        var allP = root.querySelectorAll('*');
        for(var i=0;i<allP.length;i++) parents.push(allP[i]);
        for(var p=0;p<parents.length;p++){
          var par = parents[p];
          var kids = [];
          for(var k=0;k<par.children.length;k++){
            var ch = par.children[k];
            if(!inflow(ch)) continue;
            var rc = ch.getBoundingClientRect();
            if(rc.width>1 && rc.height>1) kids.push(ch);
          }
          for(var a=0;a<kids.length;a++){
            for(var b=a+1;b<kids.length;b++){
              var A=kids[a], B=kids[b];
              if(A.contains(B)||B.contains(A)) continue;
              var ra=A.getBoundingClientRect(), rb=B.getBoundingClientRect();
              var ox = Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left);
              var oy = Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top);
              if(ox>4 && oy>4){
                overlaps.push({ a: desc(A), b: desc(B), overlapX: Math.round(ox), overlapY: Math.round(oy) });
                if(overlaps.length>=10) return { root: rootSel, present:true, overlaps: overlaps };
              }
            }
          }
        }
        return { root: rootSel, present:true, overlaps: overlaps };
      }
    };
    return true;
  })()`);
}

// --- tab driving helper ---
const clickTab = async (panelId) => {
  const sel = `button.pc-tab-btn[data-tab="${panelId}"]`;
  return evaljs(`(async () => {
    var btn = document.querySelector(${JSON.stringify(sel)});
    if(!btn) return { ok:false, error:'tab button not found: '+${JSON.stringify(panelId)} };
    btn.click();
    for(var i=0;i<20;i++){ var p=document.getElementById(${JSON.stringify(panelId)}); if(p&&p.classList.contains('active')) break; await new Promise(function(r){ setTimeout(r,50); }); }
    var pp=document.getElementById(${JSON.stringify(panelId)});
    return { ok: !!(pp&&pp.classList.contains('active')) };
  })()`);
};

// --- step runner (--click / --press-key / --wait / --expect / --expect-absent / --shot) ---
// Keys are dispatched as TRUSTED events via Input.dispatchKeyEvent. An
// untrusted element.dispatchEvent does NOT drive Obsidian's Keymap, which
// binds window at the CAPTURE phase, so a synthetic event never reaches the
// handler under test.
// VK itself is declared up with the argv walk, which is where an unknown key is now REJECTED
// (offline, exit 2). This throw is an unreachable-by-CLI backstop for any future non-CLI caller;
// Object.hasOwn, not a truthiness test, for the VK['constructor'] reason given up there.
const pressKey = async (name) => {
  if (!Object.hasOwn(VK, name)) throw new Error(`unsupported --press-key value: ${name} (known: ${Object.keys(VK).join(', ')})`);
  const vk = VK[name];
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: name, code: name, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp',     key: name, code: name, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
};

// Steps MUST be self-reverting. The sweep's restore covers only leaf style, sheet style and the
// two sidebars, and runSteps is called once per (width, tab) pair: a step that opens a modal
// leaves it open for every later width, and a step that clicks an Activate toggle calls
// editState.toggleActiveBuff, which mutates state.active_buffs and WRITES the note. Leave the
// UI as you found it, and leave real vault notes pristine.
let stepsFail = false;
const runSteps = async (label) => {
  if (!STEPS.length) return;
  for (const [n, st] of STEPS.entries()) {
    const rec = { label, n, verb: st.verb, value: st.value };
    try {
      if (st.verb === 'click') {
        const hit = await evaljs(`(() => { var e = document.querySelector(${JSON.stringify(st.value)}); if(!e) return false; e.click(); return true; })()`);
        rec.pass = !!hit;
      } else if (st.verb === 'press-key') { await pressKey(st.value); rec.pass = true; }
      else if (st.verb === 'wait') { await sleep(Number(st.value)); rec.pass = true; }
      else if (st.verb === 'expect') {
        rec.count = await evaljs(`document.querySelectorAll(${JSON.stringify(st.value)}).length`);
        rec.pass = rec.count > 0;
      } else if (st.verb === 'expect-absent') {
        rec.count = await evaljs(`document.querySelectorAll(${JSON.stringify(st.value)}).length`);
        rec.pass = rec.count === 0;
      } else if (st.verb === 'shot') {
        // label is in the filename on purpose: without it, a --shot in the
        // default two-tab sweep over two widths overwrites itself four times
        // and three evidence images are silently lost.
        const p = join(OUT, `verify-${stamp}-step-${label}-${st.value}.png`);
        const s = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(p, Buffer.from(s.data, 'base64'));
        rec.screenshot = p; rec.pass = true;
      }
    } catch (e) { rec.pass = false; rec.error = String(e && e.message || e); }
    if (!rec.pass) stepsFail = true;
    (report.steps || (report.steps = [])).push(rec);
    console.log(`== step ${label}#${n} ${st.verb} ${st.value}: ${rec.pass ? 'PASS' : 'FAIL'}`);
  }
};

// Declared HERE, deliberately not beside overflowFail/overlapFail/rootMissingFail further down: the
// first write is inside the block immediately below, so a declaration down there would put this write
// in the flag's temporal dead zone and only the --tab arm would ever detonate. Starts false, so a run
// that never requests a tab passes by construction; there is no "absent" branch on purpose.
let tabFail = false;

// If a single tab was requested (and we are not sweeping both), select it before the default shot.
if (found > 0 && TAB) {
  const panelId = tabToPanel(TAB);
  const tabRes = await clickTab(panelId);
  report.tab = { requested: panelId, active: !!tabRes.ok };
  if (!tabRes.ok) tabFail = true;
  console.log(`== tab "${panelId}": ${tabRes.ok ? 'active' : 'FAILED to activate (' + (tabRes.error || '') + ')'}`);
  await sleep(150);
}

// Steps run AFTER the --tab click and BEFORE the default screenshot, so the evidence image is
// post-interaction without changing the backward-compatible filename.
//
// !WIDTHS_RAW is REQUIRED, not a tidy-up: the spec rules that under --widths steps run once per
// (width, tab) PAIR, and this call would make it five runs for the default two-tab two-width
// sweep. The miscount is the lesser harm. With no --tab there is ZERO settle here (the selector
// poll breaks out the instant the element exists, and the sleep(150) above is on the --tab arm
// only), so "open the modal at 400px" would open it at NATURAL width first. If the list's
// closing Escape then missed, the modal would still be open when restoreCtx is captured, for
// every clickTab, and in all four sweep screenshots, and the exit-1 would LOOK like a 400px
// failure. That is a silent-cause failure, which is the class this driver exists to eliminate.
if (found > 0 && !WIDTHS_RAW) await runSteps('main');

// --- default screenshot (natural width; filename unchanged for backward compatibility) ---
const shotPath = join(OUT, `verify-${stamp}.png`);
{
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
  report.screenshot = shotPath;
  console.log(`== screenshot: ${shotPath}`);
}

// --- functional assertions (--assert-selector / --assert-text incl. no-emdash + --within) ---
const textOf = async (sel) => evaljs(
  `(() => { var e = document.querySelector(${JSON.stringify(sel)}); return e ? { present:true, text: e.innerText||'', html: e.innerHTML||'' } : { present:false, text:'', html:'' }; })()`
);
const assertions = [];
if (found > 0 && ASSERT_SELECTOR) {
  const count = await evaljs(`document.querySelectorAll(${JSON.stringify(ASSERT_SELECTOR)}).length`);
  assertions.push({ type: 'selector', selector: ASSERT_SELECTOR, count, pass: count > 0 });
}
if (found > 0 && ASSERT_TEXT) {
  if (EMDASH_MODES.includes(ASSERT_TEXT)) {
    const strict = ASSERT_TEXT === 'no-emdash-strict';
    const scope = await textOf(WITHIN);
    if (!scope.present) {
      assertions.push({ type: ASSERT_TEXT, within: WITHIN, pass: false, reason: 'within selector matched no element' });
    } else {
      const inVisible = scope.text.indexOf('\u2014') >= 0;
      const inHtml = scope.html.indexOf('\u2014') >= 0;
      // A hidden .pc-tab-panel has innerText '' but a fully populated innerHTML,
      // so a default (visible) scan of an inactive panel is VACUOUS. Report both
      // signals always; key the verdict to the requested mode.
      const vacuous = scope.text.length === 0 && scope.html.length > 0;
      assertions.push({
        type: ASSERT_TEXT, within: WITHIN, inVisible, inHtml, vacuousScope: vacuous,
        pass: !(strict ? inHtml : inVisible),
      });
      if (vacuous && !strict) {
        console.log(`WARNING: --within "${WITHIN}" has empty visible text but non-empty innerHTML (hidden panel?); a default no-emdash scan here is vacuous. Use no-emdash-strict or activate the tab.`);
      }
    }
  } else {
    const scopeSel = WITHIN || SELECTOR;
    const scope = await textOf(scopeSel);
    if (!scope.present) {
      assertions.push({ type: 'text', text: ASSERT_TEXT, scope: scopeSel, pass: false, reason: 'scope selector matched no element' });
    } else {
      const isRegex = ASSERT_TEXT.length >= 2 && ASSERT_TEXT[0] === '/' && ASSERT_TEXT.lastIndexOf('/') > 0;
      if (isRegex) {
        const li = ASSERT_TEXT.lastIndexOf('/');
        const re = new RegExp(ASSERT_TEXT.slice(1, li), ASSERT_TEXT.slice(li + 1));
        assertions.push({ type: 'text', mode: 'regex', text: ASSERT_TEXT, scope: scopeSel, pass: re.test(scope.text) });
      } else {
        assertions.push({ type: 'text', mode: 'substring', text: ASSERT_TEXT, scope: scopeSel, pass: scope.text.indexOf(ASSERT_TEXT) >= 0 });
      }
    }
  }
}
if (assertions.length) {
  report.assertions = assertions;
  for (const a of assertions) console.log(`== assert ${a.type}: ${a.pass ? 'PASS' : 'FAIL'} ${a.reason ? '(' + a.reason + ')' : JSON.stringify(a)}`);
}
const assertionsPass = assertions.every((a) => a.pass);

// --- self-test: prove the overflow / overlap detector actually fires ---
let selfTestFail = false;
if (found > 0 && SELF_TEST) {
  await evaljs(`(() => {
    var old = document.getElementById('__vv_selftest_root'); if(old) old.remove();
    var mk = function(id, css){ var d=document.createElement('div'); if(id) d.id=id; d.style.cssText=css; return d; };
    var root = mk('__vv_selftest_root','position:fixed;left:-10000px;top:0;width:800px;box-sizing:border-box;');
    var ofBad = mk('__vv_st_of_bad','width:200px;overflow:hidden;box-sizing:border-box;'); ofBad.appendChild(mk('','width:5000px;height:12px;'));
    var ofGood = mk('__vv_st_of_good','width:200px;overflow:hidden;box-sizing:border-box;'); ofGood.appendChild(mk('','width:60px;height:12px;'));
    var ovBad = mk('__vv_st_ov_bad','box-sizing:border-box;'); ovBad.appendChild(mk('','width:120px;height:40px;')); ovBad.appendChild(mk('','width:120px;height:40px;margin-top:-30px;'));
    var ovGood = mk('__vv_st_ov_good','box-sizing:border-box;'); ovGood.appendChild(mk('','width:120px;height:40px;')); ovGood.appendChild(mk('','width:120px;height:40px;'));
    root.appendChild(ofBad); root.appendChild(ofGood); root.appendChild(ovBad); root.appendChild(ovGood);
    document.body.appendChild(root);
    return true;
  })()`);
  const ofBad = await evaljs('window.__vv.overflow("#__vv_st_of_bad")');
  const ofGood = await evaljs('window.__vv.overflow("#__vv_st_of_good")');
  const ovBad = await evaljs('window.__vv.overlap("#__vv_st_ov_bad")');
  const ovGood = await evaljs('window.__vv.overlap("#__vv_st_ov_good")');
  await evaljs(`(() => { var r=document.getElementById('__vv_selftest_root'); if(r) r.remove(); return true; })()`);
  const selfTest = {
    overflowBadDetected: !!(ofBad && ofBad.overflow),
    overflowGoodClean: !!(ofGood && !ofGood.overflow),
    overlapBadDetected: !!(ovBad && ovBad.overlaps && ovBad.overlaps.length > 0),
    overlapGoodClean: !!(ovGood && ovGood.overlaps && ovGood.overlaps.length === 0),
  };
  selfTest.pass = selfTest.overflowBadDetected && selfTest.overflowGoodClean && selfTest.overlapBadDetected && selfTest.overlapGoodClean;
  report.selfTest = selfTest;
  selfTestFail = !selfTest.pass;
  console.log(`== self-test: ${selfTest.pass ? 'PASS (detector fires on known-bad, clean on known-good)' : 'FAIL ' + JSON.stringify(selfTest)}`);
}

// --- overflow / overlap at natural width when checks requested without a sweep ---
let overflowFail = false;
let overlapFail = false;
// Both detectors report present:false when the check root matches no element. Without this flag a
// missing root returns overflow:false / overlaps:[] and the run passes having checked nothing.
let rootMissingFail = false;
if (found > 0 && (CHECK_OVERFLOW || CHECK_OVERLAP) && !WIDTHS_RAW) {
  const nat = {};
  if (CHECK_OVERFLOW) nat.overflow = await evaljs(`window.__vv.overflow(${JSON.stringify(CHECK_ROOT)})`);
  if (CHECK_OVERLAP) nat.overlap = await evaljs(`window.__vv.overlap(${JSON.stringify(CHECK_ROOT)})`);
  report.naturalCheck = nat;
  if (nat.overflow && !nat.overflow.present) rootMissingFail = true;
  if (nat.overlap && !nat.overlap.present) rootMissingFail = true;
  if (nat.overflow && nat.overflow.overflow) overflowFail = true;
  if (nat.overlap && nat.overlap.overlaps && nat.overlap.overlaps.length) overlapFail = true;
  console.log(`== natural-width check: overflow=${nat.overflow ? nat.overflow.overflow : 'n/a'} overlap=${nat.overlap ? nat.overlap.overlaps.length : 'n/a'}`);
}

// --- responsive width sweep (--widths) ---
let vacuousFail = false;
if (found > 0 && WIDTHS_RAW) {
  const requested = WIDTHS_RAW.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
  if (requested.length === 0) {
    console.error('== width sweep skipped: --widths parsed to no valid numbers');
  } else {
    const narrowStep = Math.min(...requested);
    const tabList = TAB ? [tabToPanel(TAB)] : ['panel-actions', 'panel-passive'];

    // capture state to restore after the sweep
    const restoreCtx = await evaljs(`(() => {
      var sheet = document.querySelector('.archivist-pc-sheet');
      var leaf = document.querySelector('.workspace-leaf.mod-active') || (sheet && sheet.closest('.workspace-leaf'));
      if(leaf) leaf.setAttribute('data-vv-sweep-leaf', '1');
      return {
        leafStyle: leaf ? (leaf.getAttribute('style')||'') : null,
        sheetStyle: sheet ? (sheet.getAttribute('style')||'') : null,
        leftCollapsed: !!(app.workspace.leftSplit && app.workspace.leftSplit.collapsed),
        rightCollapsed: !!(app.workspace.rightSplit && app.workspace.rightSplit.collapsed),
        tagged: !!leaf
      };
    })()`);

    // PINNED to .pc-content on purpose: this measures the container-query
    // breakpoint, and BREAKPOINT = 499 is PC-sheet-specific. Routing it
    // through --check-root would let a non-PC sweep pass meaninglessly
    // against the wrong breakpoint; pinned, it fails loudly as vacuous.
    const narrow = async (width) => evaljs(`(async () => {
      if(app.workspace.leftSplit && app.workspace.leftSplit.collapse) app.workspace.leftSplit.collapse();
      if(app.workspace.rightSplit && app.workspace.rightSplit.collapse) app.workspace.rightSplit.collapse();
      var sheet = document.querySelector('.archivist-pc-sheet');
      var leaf = document.querySelector('[data-vv-sweep-leaf="1"]');
      if(leaf){ leaf.style.flex='0 0 ${width}px'; leaf.style.width='${width}px'; leaf.style.maxWidth='${width}px'; }
      await new Promise(function(r){ setTimeout(r,250); });
      var content = document.querySelector('.pc-content');
      var fellBack = false;
      if(content && content.clientWidth > ${width}){
        if(sheet){ sheet.style.width='${width}px'; sheet.style.maxWidth='${width}px'; fellBack = true; await new Promise(function(r){ setTimeout(r,150); }); }
      }
      content = document.querySelector('.pc-content');
      return { contentClientWidth: content ? content.clientWidth : null, method: fellBack ? 'sheet-direct' : 'leaf' };
    })()`);

    // The sweep below mutates both sidebars and the leaf, so it runs under
    // try/finally: the restore must happen on EVERY exit path, or a mid-sweep
    // throw leaves the workspace collapsed and poisons the next run's capture.
    // restoreCtx and narrow stay OUTSIDE the try on purpose: the finally
    // interpolates restoreCtx, so sweeping it inside would make the finally
    // throw ReferenceError.
    try {
      const perWidth = [];
      for (const w of requested) {
        const n = await narrow(w);
        const belowBreakpoint = n.contentClientWidth != null && n.contentClientWidth < BREAKPOINT;
        const entry = { width: w, contentClientWidth: n.contentClientWidth, method: n.method, belowBreakpoint, tabs: [] };
        console.log(`== width ${w}: .pc-content clientWidth = ${n.contentClientWidth}px (${belowBreakpoint ? 'below' : 'at/above'} ${BREAKPOINT}px breakpoint, via ${n.method})`);
        for (const panelId of tabList) {
          const tabRes = await clickTab(panelId);
          await sleep(200);
          // Once per (width, tab) PAIR: this loop is nested, so with no --tab there are TWO
          // clicks and TWO screenshots per width. Before the screenshot, as above.
          await runSteps(`w${w}-${panelId}`);
          const shotP = join(OUT, `verify-${stamp}-w${w}-${panelId}.png`);
          const s = await send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(shotP, Buffer.from(s.data, 'base64'));
          const tabEntry = { tab: panelId, active: !!tabRes.ok, screenshot: shotP };
          if (!tabRes.ok) tabFail = true;
          if (CHECK_OVERFLOW) {
            tabEntry.overflow = await evaljs(`window.__vv.overflow(${JSON.stringify(CHECK_ROOT)})`);
            if (!tabEntry.overflow.present) rootMissingFail = true;
            if (tabEntry.overflow.overflow) {
              overflowFail = true;
              console.log(`   OVERFLOW @ ${w}/${panelId}: scrollWidth ${tabEntry.overflow.scrollWidth} > clientWidth ${tabEntry.overflow.clientWidth}; culprit ${tabEntry.overflow.culprits[0] ? tabEntry.overflow.culprits[0].el : '?'}`);
            }
          }
          if (CHECK_OVERLAP) {
            tabEntry.overlap = await evaljs(`window.__vv.overlap(${JSON.stringify(CHECK_ROOT)})`);
            if (!tabEntry.overlap.present) rootMissingFail = true;
            if (tabEntry.overlap.overlaps.length) {
              overlapFail = true;
              console.log(`   OVERLAP @ ${w}/${panelId}: ${tabEntry.overlap.overlaps.length} pair(s), first ${JSON.stringify(tabEntry.overlap.overlaps[0])}`);
            }
          }
          entry.tabs.push(tabEntry);
        }
        perWidth.push(entry);
      }

      const narrowEntry = perWidth.find((e) => e.width === narrowStep);
      vacuousFail =
        !(narrowStep < BREAKPOINT) ||
        !(narrowEntry && narrowEntry.contentClientWidth != null && narrowEntry.contentClientWidth < BREAKPOINT);
      report.widthSweep = { requested, narrowStep, breakpoint: BREAKPOINT, vacuous: vacuousFail, perWidth };
      if (vacuousFail) {
        console.error(`== VACUOUS SWEEP: narrow step ${narrowStep}px did not drop .pc-content below ${BREAKPOINT}px; responsive rules were never exercised.`);
      }
    } finally {
      // restore pane + sidebars, and drop the sweep tag
      await evaljs(`(() => {
        var sheet = document.querySelector('.archivist-pc-sheet');
        var leaf = document.querySelector('[data-vv-sweep-leaf="1"]');
        if(leaf){ ${restoreCtx.leafStyle ? `leaf.setAttribute('style', ${JSON.stringify(restoreCtx.leafStyle)});` : `leaf.removeAttribute('style');`} leaf.removeAttribute('data-vv-sweep-leaf'); }
        if(sheet){ ${restoreCtx.sheetStyle ? `sheet.setAttribute('style', ${JSON.stringify(restoreCtx.sheetStyle)});` : `sheet.removeAttribute('style');`} }
        ${restoreCtx.leftCollapsed ? '' : `if(app.workspace.leftSplit && app.workspace.leftSplit.expand) app.workspace.leftSplit.expand();`}
        ${restoreCtx.rightCollapsed ? '' : `if(app.workspace.rightSplit && app.workspace.rightSplit.expand) app.workspace.rightSplit.expand();`}
        return true;
      })()`);
    }

    // AFTER the try/finally on purpose: inside the finally this could fail on
    // its own assertion and mask the restore it is checking.
    const restored = await evaljs(`(() => ({
      stray: document.querySelectorAll('[data-vv-sweep-leaf]').length,
      left: !!(app.workspace.leftSplit && app.workspace.leftSplit.collapsed),
      right: !!(app.workspace.rightSplit && app.workspace.rightSplit.collapsed)
    }))()`);
    report.restoreCheck = restored;
    if (restored.stray > 0) console.log(`WARNING: ${restored.stray} stray sweep tag(s) left on the workspace.`);
  }
}

// --- scroll capture (--scroll-capture) -------------------------------------
// Runs AFTER the sweep's try/finally has restored the pane, so these shots are natural-width. The
// filenames carry only the shot index, so this must stay a single pass: calling it per (width, tab)
// pair would overwrite its own evidence, which is the hazard --shot solves with a pair label.
let scrollFail = false;
if (found > 0 && SCROLL_CAPTURE !== null) {
  // Resolution order: opening the note forces reading view (setViewState with
  // state.mode = 'preview' above), so .markdown-preview-view is live and
  // .cm-scroller is the editing fallback.
  const candidates = SCROLL_CAPTURE ? [SCROLL_CAPTURE] : ['.markdown-preview-view', '.cm-scroller'];
  const chosen = await evaljs(`(() => {
    var list = ${JSON.stringify(candidates)};
    for (var i=0;i<list.length;i++){ var e=document.querySelector(list[i]); if(e && e.scrollHeight > e.clientHeight + 1) return list[i]; }
    for (var j=0;j<list.length;j++){ if(document.querySelector(list[j])) return list[j]; }
    return null;
  })()`);
  if (!chosen) {
    scrollFail = true;
    console.log(`SCROLL CONTAINER NOT FOUND: tried ${candidates.join(', ')}.`);
  } else {
    const start = await evaljs(`document.querySelector(${JSON.stringify(chosen)}).scrollTop`);
    const shots = [];
    for (let i = 0; i < 20; i++) {
      const at = await evaljs(`(() => { var e=document.querySelector(${JSON.stringify(chosen)});
        e.scrollTop = ${i} * e.clientHeight;
        return { top: e.scrollTop, max: e.scrollHeight - e.clientHeight }; })()`);
      await sleep(150);
      const p = join(OUT, `verify-${stamp}-scroll${i}.png`);
      const s = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(p, Buffer.from(s.data, 'base64'));
      shots.push({ index: i, scrollTop: at.top, screenshot: p });
      if (at.top >= at.max) break;
    }
    await evaljs(`(() => { document.querySelector(${JSON.stringify(chosen)}).scrollTop = ${start}; return true; })()`);
    const back = await evaljs(`document.querySelector(${JSON.stringify(chosen)}).scrollTop`);
    report.scrollCapture = { container: chosen, shots, startScrollTop: start, restoredScrollTop: back };
    if (back !== start) { scrollFail = true; console.log(`SCROLL NOT RESTORED: ${back} != ${start}`); }
    console.log(`== scroll-capture: ${shots.length} shot(s) via ${chosen}`);
  }
}

report.consoleErrors = consoleErrors;
report.consoleWarnings = consoleWarnings;
report.exceptions = exceptions;

// STDOUT on purpose: every other loud failure here uses console.error, but the control run asserts
// this marker on stdout. Do not "fix" it to stderr for consistency.
if (rootMissingFail) {
  console.log(`ROOT NOT FOUND: no element matched the check root; the overflow/overlap checks were vacuous.`);
}

// Steps declared but never executed is vacuous: --widths that parses to no valid numbers skips
// the sweep with only a console.error and no failure flag, and the natural-width call is guarded
// off, so without this `--widths garbage --click X` would run zero steps and exit 0. This is the
// companion to that guard, not an extra: together they make "I asked for steps and got a green
// run" impossible.
if (STEPS.length && !(report.steps && report.steps.length)) stepsFail = true;

const ok =
  report.noteOpened &&
  found > 0 &&
  consoleErrors.length === 0 &&
  exceptions.length === 0 &&
  assertionsPass &&
  !overflowFail &&
  !overlapFail &&
  !rootMissingFail &&
  !tabFail &&
  !vacuousFail &&
  !stepsFail &&
  !scrollFail &&
  !selfTestFail;
report.ok = ok;

console.log('\n' + JSON.stringify(report, null, 2));
if (ok) {
  console.log(`\nVERIFIED: sheet rendered, zero console errors, zero exceptions${report.widthSweep ? ', responsive sweep clean' : ''}${report.selfTest ? ', detector self-test passed' : ''}.`);
} else {
  const reasons = [];
  if (!report.noteOpened) reasons.push('note failed to open');
  if (found === 0) reasons.push('selector never rendered');
  if (consoleErrors.length) reasons.push(consoleErrors.length + ' console error(s)');
  if (exceptions.length) reasons.push(exceptions.length + ' exception(s)');
  if (!assertionsPass) reasons.push('failed assertion');
  if (overflowFail) reasons.push('horizontal overflow');
  if (overlapFail) reasons.push('element overlap');
  if (rootMissingFail) reasons.push('check root not found');
  if (tabFail) reasons.push('tab failed to activate');
  if (vacuousFail) reasons.push('vacuous width sweep');
  if (stepsFail) reasons.push('failed step');
  if (scrollFail) reasons.push('scroll capture failed');
  if (selfTestFail) reasons.push('self-test detector miss');
  console.log(`\nNOT VERIFIED: ${reasons.join('; ')}.`);
}

ws.close();
process.exit(ok ? 0 : 1);
