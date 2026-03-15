param(
  [int[]]$Ports = @(3000, 8000)
)

$ErrorActionPreference = "Continue"

foreach ($port in $Ports) {
  $listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq $port }
  if (!$listeners) {
    Write-Host "[ports] $port: free"
    continue
  }

  $ids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $ids) {
    if (!$procId -or $procId -eq 0 -or $procId -eq 4) {
      continue
    }
    try {
      Stop-Process -Id $procId -Force -ErrorAction Stop
      Write-Host "[ports] $port: killed pid $procId"
    } catch {
      Write-Host "[ports] $port: failed to kill pid $procId ($($_.Exception.Message))"
    }
  }
}
