<#
.SYNOPSIS
  Brings up Redis and Elasticsearch inside WSL for the no-Docker local setup.

.DESCRIPTION
  Docker Compose is the portable way to run this project's infrastructure
  (`npm run docker:up`). On a Windows machine without Docker, Redis and
  Elasticsearch run inside WSL instead. Two things make that awkward, and this
  script handles both:

    1. WSL shuts its VM down shortly after the last attached session exits,
       which kills Redis and Elasticsearch with it. Passing -KeepAlive holds a
       session open for as long as the dev server runs.

    2. Elasticsearch needs a couple of minutes to become healthy on a cold
       start, so the script waits for both services to actually answer rather
       than assuming they are ready.

.PARAMETER Distro
  WSL distribution name. Defaults to Ubuntu.

.PARAMETER KeepAlive
  After the services are healthy, block and hold the WSL VM open. Intended to be
  run alongside the dev servers.

.PARAMETER TimeoutSeconds
  How long to wait for Elasticsearch to report healthy.

.EXAMPLE
  npm run infra:up
  npm run dev
#>
[CmdletBinding()]
param(
  [string]$Distro = 'Ubuntu',
  [switch]$KeepAlive,
  [int]$TimeoutSeconds = 300
)

$ErrorActionPreference = 'Stop'

function Test-Port {
  param([string]$Host_ = 'localhost', [int]$Port, [int]$TimeoutMs = 2000)

  try {
    $client = New-Object Net.Sockets.TcpClient
    $handle = $client.BeginConnect($Host_, $Port, $null, $null)
    $ok = $handle.AsyncWaitHandle.WaitOne($TimeoutMs)
    if ($ok) { $client.EndConnect($handle); $client.Close(); return $true }
    $client.Close()
    return $false
  } catch {
    return $false
  }
}

function Invoke-Wsl {
  param([string]$Command)
  wsl -d $Distro -u root bash -c $Command 2>&1
}

Write-Host "[infra] Starting Redis and Elasticsearch in WSL ($Distro)..." -ForegroundColor Cyan

# systemd needs to be up before the units can be started. `wsl.conf` enables it;
# this just waits for it to finish initialising after a cold VM start.
$null = Invoke-Wsl "for i in 1 2 3 4 5 6 7 8 9 10; do systemctl is-system-running --quiet 2>/dev/null && break; sleep 2; done; true"

$null = Invoke-Wsl "systemctl start redis-server"
$null = Invoke-Wsl "systemctl start elasticsearch"

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$redisReady = $false
$esReady = $false

while ((Get-Date) -lt $deadline) {
  if (-not $redisReady -and (Test-Port -Port 6379)) {
    $redisReady = $true
    Write-Host "[infra] Redis is up on localhost:6379" -ForegroundColor Green
  }

  if (-not $esReady -and (Test-Port -Port 9200)) {
    $esReady = $true
    Write-Host "[infra] Elasticsearch is up on localhost:9200" -ForegroundColor Green
  }

  if ($redisReady -and $esReady) { break }
  Start-Sleep -Seconds 3
}

if (-not $redisReady) {
  Write-Warning "[infra] Redis did not come up. Check: wsl -d $Distro -u root systemctl status redis-server"
  exit 1
}

if (-not $esReady) {
  # Not fatal: the backend degrades to SQL search and retries Elasticsearch
  # periodically, so the app is still usable.
  Write-Warning "[infra] Elasticsearch not ready within ${TimeoutSeconds}s - search will use the SQL fallback until it is."
  Write-Warning "[infra] Check: wsl -d $Distro -u root journalctl -u elasticsearch -n 40"
}

if (-not $KeepAlive) {
  Write-Host "[infra] Ready." -ForegroundColor Cyan
  exit 0
}

Write-Host "[infra] Holding the WSL VM open. Stopping this process shuts Redis and Elasticsearch down." -ForegroundColor Cyan
wsl -d $Distro -u root bash -c "sleep infinity"
