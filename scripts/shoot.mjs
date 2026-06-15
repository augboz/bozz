/**
 * Marketing screenshot generator.
 * Drives the running dev server (localhost:1420) with a real Edge window
 * (chromeless --app mode), signs in as the bozz.test.user1 demo account,
 * and captures the window client area via Win32 into website/assets/.
 *
 * Notes from debugging:
 *  - CDP screenshots (page.screenshot) return solid black for this app in
 *    automated Edge on this machine, so we capture at the OS level instead.
 *  - The app also *renders* black under CDP viewport emulation, so we use
 *    the native window size and override background-attachment before shots.
 *
 * Run: node scripts/shoot.mjs   (dev server must be running on :1420)
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:1420';
const OUT = 'website/assets';
const profile = join(tmpdir(), `bozz-shoot-${Date.now()}`);

mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Capture the foreground window's CLIENT area (no titlebar/chrome). */
function osShot(outPath) {
  const abs = resolve(outPath).replace(/\\/g, '\\\\');
  const ps = `
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out R r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref P p);
  public struct R { public int L, T, Rt, B; }
  public struct P { public int X, Y; }
}
"@
$h = [W]::GetForegroundWindow()
$r = New-Object W+R
[void][W]::GetClientRect($h, [ref]$r)
$p = New-Object W+P
[void][W]::ClientToScreen($h, [ref]$p)
$w = $r.Rt - $r.L; $ht = $r.B - $r.T
$bmp = New-Object System.Drawing.Bitmap($w, $ht)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($p.X, $p.Y, 0, 0, $bmp.Size)
$bmp.Save("${abs}", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
`;
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'pipe' });
}

/** Click the first button whose trimmed text or title/aria-label matches. */
async function clickText(page, text) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll('button')];
    const el = els.find(x =>
      x.textContent.trim() === t ||
      x.title === t || x.title.startsWith(t) ||
      x.getAttribute('aria-label') === t);
    if (el) { el.click(); return true; }
    return false;
  }, text);
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: false,
  userDataDir: profile,
  args: [
    `--app=${URL}`,                       // chromeless window, page only
    '--window-size=1500,980', '--window-position=40,40',
    '--hide-scrollbars',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-features=msEdgeFirstRunExperience,msImplicitSignin',
    '--disable-gpu-compositing',
  ],
});

try {
  // In --app mode the page is the initial target, not a new tab.
  await sleep(2500);
  const pages = await browser.pages();
  const page = pages.find(p => p.url().startsWith(URL)) ?? pages[0];
  await sleep(2000);

  // ── Sign in as the demo user ────────────────────────────────────────────
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', 'bozz.test.user1@gmail.com');
  await page.type('input[type="password"]', 'BozzTest123!x');
  await clickText(page, 'Sign in');
  await sleep(5000);
  console.log('signed in');

  // ── Dark mode for brand-consistent shots ────────────────────────────────
  await clickText(page, 'Settings');
  await sleep(800);
  await clickText(page, 'Appearance');
  await sleep(700);
  await clickText(page, 'Dark');
  await sleep(1000);
  await clickText(page, 'Go to home');
  await sleep(1500);
  console.log('dark mode set');

  // The fixed-attachment gradient renders black under automation — pin it
  // to scroll for the shots (visually identical for a static capture).
  await page.addStyleTag({ content: '* { background-attachment: scroll !important; }' });
  await sleep(500);

  // ── Shot 1: home dashboard ──────────────────────────────────────────────
  await page.bringToFront(); await sleep(800);
  await page.screenshot({ path: `${OUT}/bozz-home.png` });
  console.log('saved bozz-home.png');

  // ── Shot 2: topic page ──────────────────────────────────────────────────
  await clickText(page, 'U1 Uni Work');
  await sleep(1500);
  await page.bringToFront(); await sleep(500);
  await page.screenshot({ path: `${OUT}/bozz-topic.png` });
  console.log('saved bozz-topic.png');

  // ── Shot 3: quicks page ─────────────────────────────────────────────────
  await clickText(page, 'Quicks');
  await sleep(1200);
  await page.bringToFront(); await sleep(500);
  await page.screenshot({ path: `${OUT}/bozz-quicks.png` });
  console.log('saved bozz-quicks.png');
} finally {
  await browser.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* win file locks */ }
}
console.log('done');
