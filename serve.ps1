<#
  serve.ps1 — เปิด ProjectPulse ด้วยเว็บเซิร์ฟเวอร์ในเครื่อง (แนะนำแทนการเปิดไฟล์ index.html ตรง ๆ
  เพราะเบราว์เซอร์บางตัวจำกัดการใช้ localStorage บนหน้าที่เปิดแบบ file://)

  วิธีใช้: คลิกขวาไฟล์นี้ > Run with PowerShell
  หรือรันคำสั่ง:  powershell -ExecutionPolicy Bypass -File .\serve.ps1
#>
param([int]$Port = 8791, [string]$Root = $PSScriptRoot)

$root = $Root
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".ico"  = "image/x-icon"
}

$url = "http://localhost:$Port/"
Write-Host "ProjectPulse กำลังทำงานที่ $url"
Write-Host "กด Ctrl+C เพื่อปิดเซิร์ฟเวอร์"
Start-Process $url

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $req = $context.Request
  $res = $context.Response
  try {
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path $root ($path.TrimStart("/"))
    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath)
      $ct = $mime[$ext]
      if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $res.ContentType = $ct
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.OutputStream.Close()
  }
}
