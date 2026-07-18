Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-DotEnv($Path) {
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $idx = $line.IndexOf('=')
    if ($idx -le 0) { continue }
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    if ($key) { $map[$key] = $value }
  }
  return $map
}

function Resolve-Value($EnvMap, [string[]] $Names, [string] $Fallback = '') {
  foreach ($name in $Names) {
    $fromProcess = [Environment]::GetEnvironmentVariable($name)
    if ($fromProcess) { return $fromProcess.Trim() }
    if ($EnvMap.ContainsKey($name) -and $EnvMap[$name]) { return $EnvMap[$name].Trim() }
  }
  return $Fallback
}

function Read-RequiredText([string] $Prompt, [string] $DefaultValue) {
  $suffix = if ($DefaultValue) { " [$DefaultValue]" } else { '' }
  $value = Read-Host "$Prompt$suffix"
  if (-not $value -and $DefaultValue) { return $DefaultValue }
  if (-not $value) { throw "$Prompt wajib diisi." }
  return $value.Trim()
}

function Convert-SecureStringToPlain([securestring] $Secure) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    if ($bstr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }
}

function Read-RequiredPassword([string] $Prompt) {
  $first = Read-Host $Prompt -AsSecureString
  $second = Read-Host "$Prompt (ulang)" -AsSecureString
  $plainFirst = Convert-SecureStringToPlain $first
  $plainSecond = Convert-SecureStringToPlain $second
  if ($plainFirst -ne $plainSecond) { throw 'Password tidak sama.' }
  if ($plainFirst.Length -lt 8) { throw 'Password minimal 8 karakter.' }
  return $plainFirst
}

function Invoke-SupabaseJson([string] $Method, [string] $Uri, $Body = $null, $ExtraHeaders = @{}) {
  $headers = @{
    apikey = $ServiceRoleKey
    Authorization = "Bearer $ServiceRoleKey"
    'Content-Type' = 'application/json'
  }
  foreach ($key in $ExtraHeaders.Keys) { $headers[$key] = $ExtraHeaders[$key] }
  $params = @{
    Method = $Method
    Uri = $Uri
    Headers = $headers
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 10)
  }
  return Invoke-RestMethod @params
}

function Get-AuthUserByEmail([string] $Email) {
  $usersResponse = Invoke-SupabaseJson 'GET' "$SupabaseUrl/auth/v1/admin/users?per_page=1000&page=1"
  $users = @($usersResponse.users)
  return $users | Where-Object { $_.email -eq $Email } | Select-Object -First 1
}

function Upsert-AuthUser([string] $Username, [string] $Role, [string] $Password) {
  $email = "$Username@$AuthDomain"
  $existing = Get-AuthUserByEmail $email
  $body = @{
    email = $email
    password = $Password
    email_confirm = $true
    app_metadata = @{ app_role = $Role }
    user_metadata = @{ username = $Username }
  }

  if ($existing) {
    $updated = Invoke-SupabaseJson 'PUT' "$SupabaseUrl/auth/v1/admin/users/$($existing.id)" $body
    return @{ id = $updated.id; email = $email; role = $Role; label = $Username; action = 'updated' }
  }

  $created = Invoke-SupabaseJson 'POST' "$SupabaseUrl/auth/v1/admin/users" $body
  return @{ id = $created.id; email = $email; role = $Role; label = $Username; action = 'created' }
}

$envPath = Join-Path (Get-Location) '.env.local'
$envMap = Read-DotEnv $envPath

$SupabaseUrl = Resolve-Value $envMap @('SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
$ServiceRoleKey = Resolve-Value $envMap @('SUPABASE_SERVICE_ROLE_KEY')
$AuthDomain = Resolve-Value $envMap @('VITE_AUTH_EMAIL_DOMAIN', 'NEXT_PUBLIC_AUTH_EMAIL_DOMAIN') 'pip.local'

if (-not $SupabaseUrl) { throw 'SUPABASE_URL/VITE_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL belum terisi.' }
if (-not $ServiceRoleKey) { throw 'SUPABASE_SERVICE_ROLE_KEY belum terisi.' }

Write-Host 'Setup akun Supabase Auth: hanya akun USER bersama dan akun ADMIN.' -ForegroundColor Cyan
Write-Host "Project: $SupabaseUrl"
Write-Host "Domain auth: $AuthDomain"
Write-Host ''

$userUsername = Read-RequiredText 'Username akun USER bersama' 'tim-pip'
$userPassword = Read-RequiredPassword "Password akun USER bersama ($userUsername)"
$adminUsername = Read-RequiredText 'Username akun ADMIN' 'admin'
$adminPassword = Read-RequiredPassword "Password akun ADMIN ($adminUsername)"

if ($userUsername -eq $adminUsername) { throw 'Username USER dan ADMIN harus berbeda.' }

$userAccount = Upsert-AuthUser $userUsername 'USER' $userPassword
$adminAccount = Upsert-AuthUser $adminUsername 'ADMIN' $adminPassword

$roles = @(
  @{ user_id = $userAccount.id; role = 'USER'; account_label = $userUsername },
  @{ user_id = $adminAccount.id; role = 'ADMIN'; account_label = $adminUsername }
)

Invoke-SupabaseJson `
  'POST' `
  "$SupabaseUrl/rest/v1/account_roles?on_conflict=user_id" `
  $roles `
  @{ Prefer = 'resolution=merge-duplicates,return=minimal' } | Out-Null

$roleRows = Invoke-SupabaseJson 'GET' "$SupabaseUrl/rest/v1/account_roles?select=user_id,role,account_label"

Write-Host ''
Write-Host 'Selesai. Ringkasan:' -ForegroundColor Green
Write-Host "USER  $($userAccount.action): $($userAccount.email)"
Write-Host "ADMIN $($adminAccount.action): $($adminAccount.email)"
Write-Host "account_roles saat ini: $(@($roleRows).Count)"
Write-Host 'Password tidak disimpan oleh skrip ini.'
