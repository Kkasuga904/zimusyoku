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
