<#
  build-bundle.ps1
  Regenerates bundle.html (the single-file build shared as a Claude Artifact)
  from the multi-file source under assets/js/, so changes to the 4 files below
  never need to be hand-copied into the bundle.

  Auto-synced (confirmed byte-for-byte structural match with the bundle's
  <script> blocks, only internal "*.html" links rewritten to "#route" so any
  future edit can keep using ordinary page-relative hrefs):
    thai-date.js, seed-data.js, store.js, pulse-widget.js

  NOT auto-synced -- hand-edit bundle.html directly when these change:
    - Every page's mount-script (dashboard-student.js, dashboard-advisor.js,
      settings.js, achievements.js, project-timeline.js, task-detail.js,
      feedback-queue.js, review-feedback.js, feedback-to-task.js,
      team-workload.js, notifications.js, weekly-report.js, workload-map.js,
      free-time-planner.js). CONFIRMED by a dry-run diff: the bundle version of
      each of these is NOT a verbatim copy -- the source's self-executing
      `(function () { ... })();` gets rewritten to a named `function
      mountXxx() { ... }` (no auto-invoke) so the SPA router can call it on
      every route change; some also swap `window.location.href = "x.html"`
      navigations for `location.hash = "x"`, use the shared `getRouteQuery()`
      helper instead of `URLSearchParams(location.search)`, or wrap top-level
      statements in a named init function. These are real per-file structural
      adaptations, not mechanical link rewrites -- do not attempt to
      auto-generate them without redoing this analysis per file.
    - nav.js (adds idempotent re-mount-on-route-change logic)
    - index.html's inline login script (bundle version is initLoginView(),
      adapted for the single-page shell instead of a standalone document)
    - Page <template id="tpl-...">  blocks (from pages/*.html)

  Usage: powershell -File build-bundle.ps1
#>

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$bundlePath = Join-Path $root "bundle.html"
$srcRoot = Join-Path $root "assets\js"

$files = @("thai-date.js", "seed-data.js", "store.js", "pulse-widget.js")

function Convert-Hrefs([string]$code) {
  $code = $code -replace "([""'``])\.\./index\.html\1", '$1#login$1'
  $code = $code -replace "([""'``])([a-z0-9-]+)\.html(\?[^""'``]*)?\1", '$1#$2$3$1'
  return $code
}

$bytes = [System.IO.File]::ReadAllBytes($bundlePath)
$bundle = [System.Text.Encoding]::UTF8.GetString($bytes)

$notFound = @()
foreach ($file in $files) {
  $headerPattern = "<script>\r?\n/\*\s*=+\s*\r?\n\s*" + [regex]::Escape($file) + "(?:[^\r\n]*\r?\n)*?\s*=+\s*\*/\s*\r?\n"
  $fullPattern = "(?s)(" + $headerPattern + ")(.*?)\r?\n</script>"
  $rx = [regex]::new($fullPattern)
  $m = $rx.Match($bundle)
  if (-not $m.Success) {
    $notFound += $file
    continue
  }
  $srcPath = Join-Path $srcRoot $file
  $srcContent = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($srcPath))
  $srcContent = $srcContent.TrimEnd("`r", "`n")
  $srcContent = Convert-Hrefs $srcContent
  $header = $m.Groups[1].Value
  $replacement = $header + $srcContent + "`n</script>"
  $bundle = $bundle.Substring(0, $m.Index) + $replacement + $bundle.Substring($m.Index + $m.Length)
  Write-Host "Synced: $file"
}

if ($notFound.Count -gt 0) {
  Write-Warning ("Block header not found for: " + ($notFound -join ", ") + " -- these were left untouched in bundle.html.")
}

[System.IO.File]::WriteAllText($bundlePath, $bundle, [System.Text.UTF8Encoding]::new($false))
Write-Host "bundle.html updated (store.js / seed-data.js / thai-date.js / pulse-widget.js only)."
Write-Host "Reminder: mount-scripts, nav.js, the login script, and <template> blocks still need hand-editing in bundle.html -- see the header comment in this file for why."
