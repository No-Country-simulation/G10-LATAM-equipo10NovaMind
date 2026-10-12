param([string]$Python = "python", [string]$OciEnvFile = "", [string]$PemFile = "")
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
# Only infrastructure variables are imported; account USER/PASS never enter the backend.
if ($OciEnvFile) {
    $allowedNames = @('OCI_USER','OCI_TENANCY','OCI_FINGERPRINT','OCI_REGION','OCI_NAMESPACE','OCI_BUCKET_NAME')
    foreach ($line in Get-Content -LiteralPath $OciEnvFile) {
        if ($line -match '^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$' -and $matches[1] -in $allowedNames) {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim('"').Trim("'"), 'Process')
        }
    }
}
if ($PemFile) {
    $resolvedPem = (Resolve-Path -LiteralPath $PemFile).Path
    [Environment]::SetEnvironmentVariable('OCI_KEY_FILE', $resolvedPem, 'Process')
}
& $Python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
exit $LASTEXITCODE
