param(
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
`$env:VITE_API_URL = 'http://127.0.0.1:8000'
Write-Host "VITE_API_URL set to `$env:VITE_API_URL" -ForegroundColor Cyan
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
