<<<<<<< HEAD
param(
    [switch]$SkipInstall,
    [switch]$KeepPorts,
    [switch]$NoWait,
    [switch]$NoBrowser
)

$scriptPath = $PSCommandPath
if (-not $scriptPath) {
    $scriptPath = $MyInvocation.MyCommand.Path
}
if (-not $scriptPath) {
    throw 'Unable to resolve script path. Invoke via "pwsh -File scripts/dev.ps1" or double-click dev.bat.'
}

$scriptFile = [System.IO.Path]::GetFullPath($scriptPath)
$scriptDir = Split-Path -Parent $scriptFile
$repoRoot = Split-Path -Parent $scriptDir
Set-Location $repoRoot

$ErrorActionPreference = "Stop"

$logDir = Join-Path $repoRoot 'logs'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logFile = Join-Path $logDir 'dev-launcher.log'

function Write-Log {
    param(
        [string]$Message,
        [ConsoleColor]$Color = [ConsoleColor]::Gray
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $logFile -Value "[$timestamp] $Message"
    Write-Host $Message -ForegroundColor $Color
}

function Ensure-Venv {
    if (Test-Path '.venv\Scripts\python.exe') {
        Write-Log 'Using existing virtual environment (.venv).' ([ConsoleColor]::DarkGray)
        return
    }

    Write-Log 'Creating virtual environment (.venv)...' ([ConsoleColor]::Cyan)
    py -3 -m venv .venv
}

function Install-Dependencies {
    param(
        [string]$PythonExe
    )

    Write-Log 'Installing Python dependencies...' ([ConsoleColor]::Cyan)
    & $PythonExe -m pip install --upgrade pip
    & $PythonExe -m pip install -r services\api\requirements.txt
    & $PythonExe -m pip install -r requirements-dev.txt

    Write-Log 'Installing console dependencies...' ([ConsoleColor]::Cyan)
    npm --prefix web\console install --no-audit --no-fund
}

function Stop-PortListeners {
    param(
        [int[]]$Ports
    )

    if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
        Write-Log 'Get-NetTCPConnection not available; skipping port cleanup.' ([ConsoleColor]::Yellow)
        return
    }

    foreach ($port in $Ports) {
        try {
            $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction Stop |
                Where-Object { $_.State -eq 'Listen' }
        } catch {
            Write-Log "Unable to query port ${port}: $_" ([ConsoleColor]::Yellow)
            continue
        }

        foreach ($conn in $connections) {
            $pid = $conn.OwningProcess
            if (-not $pid) {
                continue
            }

            try {
                $process = Get-Process -Id $pid -ErrorAction Stop
                Write-Log "Stopping process $($process.ProcessName) (PID $pid) holding port ${port}" ([ConsoleColor]::Yellow)
                Stop-Process -Id $pid -Force
            } catch {
                Write-Log "Failed to stop PID $pid on port ${port}: $_" ([ConsoleColor]::Red)
            }
        }
    }
}

$exitCode = 0

try {
    Write-Log '=== Dev launcher starting ===' ([ConsoleColor]::Green)

    Ensure-Venv
    $python = Join-Path $repoRoot '.venv\Scripts\python.exe'

    if (-not $SkipInstall) {
        Install-Dependencies -PythonExe $python
    } else {
        Write-Log 'Skipping dependency installation (--SkipInstall).' ([ConsoleColor]::Yellow)
    }

    if (-not $KeepPorts) {
        Stop-PortListeners -Ports @(9000, 5173)
    } else {
        Write-Log 'Preserving existing listeners on ports 9000/5173 (--KeepPorts).' ([ConsoleColor]::DarkGray)
    }

    $shellExe = if (Get-Command pwsh -ErrorAction SilentlyContinue) { (Get-Command pwsh).Source } else { (Get-Command powershell).Source }

    $apiCommand = '& .\.venv\Scripts\Activate.ps1; uvicorn services.api.main:app --host 0.0.0.0 --port 9000'
    $uiCommand = 'npm --prefix web/console run dev -- --host 0.0.0.0'

    Write-Log 'Launching API server window...' ([ConsoleColor]::Cyan)
    $apiProcess = Start-Process -FilePath $shellExe -WorkingDirectory $repoRoot -ArgumentList '-NoExit','-Command',$apiCommand -PassThru -WindowStyle Normal

    Write-Log 'Launching console server window...' ([ConsoleColor]::Cyan)
    $uiProcess = Start-Process -FilePath $shellExe -WorkingDirectory $repoRoot -ArgumentList '-NoExit','-Command',$uiCommand -PassThru -WindowStyle Normal

    Write-Log "API PowerShell PID: $($apiProcess.Id)" ([ConsoleColor]::Green)
    Write-Log "Console PowerShell PID: $($uiProcess.Id)" ([ConsoleColor]::Green)
    Write-Log 'Servers running. Close spawned windows or press Ctrl+C inside them to stop.' ([ConsoleColor]::Green)

    if (-not $NoBrowser) {
        $url = 'http://localhost:5173/jobs'
        Write-Log "Opening browser at $url" ([ConsoleColor]::Cyan)
        try {
            Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','start','', $url | Out-Null
        } catch {
            Write-Log "Failed to open browser automatically: $_" ([ConsoleColor]::Yellow)
        }
    }
} catch {
    $exitCode = 1
    Write-Log "Launcher failed: $_" ([ConsoleColor]::Red)
} finally {
    Write-Log "=== Dev launcher finished (exit code $exitCode) ===" ([ConsoleColor]::DarkGray)
    if (-not $NoWait) {
        Read-Host 'Press Enter to close this launcher window' | Out-Null
    }
    exit $exitCode
}
=======
﻿param(
    [switch]$FrontendOnly,
    [switch]$BackendOnly
)

if ($FrontendOnly -and $BackendOnly) {
    Write-Error "Use either -FrontendOnly or -BackendOnly, not both."
    exit 1
}

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
$consoleDir = Join-Path $repoRoot "web/console"
$dataDir = Join-Path $repoRoot "data"
$devSecretsPath = Join-Path $scriptRoot ".dev-credentials.ps1"

function Escape-SingleQuote {
    param([string]$Value)
    return ($Value -replace "'", "''")
}

$defaultEmail = "admin@example.com"
$defaultPassword = "a"

if (Test-Path $devSecretsPath) {
    try {
        . $devSecretsPath
        if (Get-Variable -Name DevUserEmail -ErrorAction SilentlyContinue) {
            $defaultEmail = $DevUserEmail
        }
        if (Get-Variable -Name DevUserPassword -ErrorAction SilentlyContinue) {
            $defaultPassword = $DevUserPassword
        }
    } catch {
        Write-Warning ("Failed to import {0}: {1}" -f $devSecretsPath, $_)
    }
}

if ($env:ZIMUSYOKU_DEFAULT_USER_EMAIL) {
    $defaultEmail = $env:ZIMUSYOKU_DEFAULT_USER_EMAIL
}
if ($env:ZIMUSYOKU_DEFAULT_USER_PASSWORD) {
    $defaultPassword = $env:ZIMUSYOKU_DEFAULT_USER_PASSWORD
}

$escapedEmail = Escape-SingleQuote $defaultEmail
$escapedPassword = Escape-SingleQuote $defaultPassword

Write-Host "=== zimusyoku dev launcher ===" -ForegroundColor Cyan
Write-Host "Repository root:" (Resolve-Path $repoRoot) -ForegroundColor DarkGray

if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
}

$shellCmd = "pwsh"
if (-not (Get-Command $shellCmd -ErrorAction SilentlyContinue)) {
    $shellCmd = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
}

function Start-DevProcess {
    param(
        [string]$Title,
        [string]$ShellPath,
        [string]$Command
    )

    if ($ShellPath -like "*pwsh*") {
        $arguments = @("-NoExit", "-Command", $Command)
    } else {
        $arguments = @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $Command)
    }

    Start-Process -FilePath $ShellPath -ArgumentList $arguments | Out-Null
    Write-Host "-> Started $Title" -ForegroundColor Green
}

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    Write-Warning "npm was not found in PATH. Install Node.js 18+ before running the console dev server."
}

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Warning "python was not found in PATH. Install Python 3.11+ so that the FastAPI server can run."
}

if (-not $BackendOnly) {
    $frontendCommand = @"
Set-Location '$consoleDir'
if (-not (Test-Path 'node_modules')) {
    Write-Host 'Installing console dependencies...' -ForegroundColor Yellow
    npm install
}
$env:VITE_API_URL = 'http://127.0.0.1:8000'
Write-Host "VITE_API_URL set to $env:VITE_API_URL" -ForegroundColor Cyan
npm run dev
"@
    Start-DevProcess "console dev server" $shellCmd $frontendCommand
}

if (-not $FrontendOnly) {
    $backendCommand = @"
Set-Location '$repoRoot'
`$env:DATA_DIR = '$dataDir'
`$env:API_FORCE_EAGER = '1'
`$env:API_AUTH_ENABLED = '1'
`$env:API_DEFAULT_USER_EMAIL = '$escapedEmail'
`$env:API_DEFAULT_USER_PASSWORD = '$escapedPassword'
python -m uvicorn services.api.app:create_app --factory --reload
"@
    Start-DevProcess "FastAPI server" $shellCmd $backendCommand

    Write-Host ""
    Write-Host "Optional: start a Celery worker in another shell if you want real async processing:" -ForegroundColor Yellow
    Write-Host "  cd '$repoRoot'" -ForegroundColor Yellow
    Write-Host "  celery -A services.api.celery_app:celery_app worker --loglevel=info" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Frontend dev server: http://localhost:5173" -ForegroundColor Cyan
Write-Host "API (with eager tasks): http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host ("Default login -> email: {0}  password: {1}" -f $defaultEmail, $defaultPassword) -ForegroundColor DarkGray

try {
    Start-Process "http://localhost:5173" | Out-Null
} catch {
    Write-Warning "Could not launch browser automatically. Open http://localhost:5173 manually."
}
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
