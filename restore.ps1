# restore.ps1 — WIP 커밋 목록 확인 및 특정 시점으로 복원
#
# 사용법:
#   .\restore.ps1              → WIP 커밋 목록 표시
#   .\restore.ps1 1            → 1번 시점으로 복원 (현재 변경사항 유지)
#   .\restore.ps1 1 -hard      → 1번 시점으로 복원 (현재 변경사항 버림)

param(
    [string]$number = "",
    [switch]$hard
)

$GIT = "C:\Users\c9611\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
if (-not (Test-Path $GIT)) {
    $found = Get-Command git -ErrorAction SilentlyContinue
    if (-not $found) { Write-Error "git"; exit 1 }
    $GIT = $found.Source
}

$repo = $PSScriptRoot

# WIP 커밋 목록 (최근 30개 중 [WIP] 태그 포함)
$log = & $GIT -C $repo log --oneline -30 2>$null
$wips = @()
$i = 1
foreach ($line in $log) {
    if ($line -match "\[WIP\]") {
        $hash = $line.Substring(0, 7)
        $msg  = $line.Substring(8)
        $wips += [PSCustomObject]@{ No=$i; Hash=$hash; Msg=$msg; Line=$line }
        $i++
    }
}

if ($wips.Count -eq 0) {
    Write-Host "저장된 체크포인트가 없습니다." -ForegroundColor Yellow
    Write-Host "저장하려면: .\checkpoint.ps1 [메모]"
    exit 0
}

Write-Host ""
Write-Host "=== 체크포인트 목록 ===" -ForegroundColor Cyan
foreach ($w in $wips) {
    Write-Host "  [$($w.No)] $($w.Hash)  $($w.Msg)"
}
Write-Host ""

if ($number -eq "") {
    Write-Host "복원하려면: .\restore.ps1 <번호>" -ForegroundColor Cyan
    Write-Host "  예시: .\restore.ps1 1        (1번으로 복원, 현재 작업 유지)"
    Write-Host "        .\restore.ps1 1 -hard  (1번으로 복원, 현재 작업 버림)"
    exit 0
}

$n = [int]$number
$target = $wips | Where-Object { $_.No -eq $n }
if (-not $target) {
    Write-Error "존재하지 않는 번호: $n"
    exit 1
}

Write-Host "복원 대상: [$n] $($target.Hash) $($target.Msg)" -ForegroundColor Yellow
Write-Host ""

if ($hard) {
    $answer = Read-Host "현재 변경사항이 모두 삭제됩니다. 계속할까요? (y/N)"
    if ($answer -ne "y" -and $answer -ne "Y") { Write-Host "취소했습니다."; exit 0 }
    & $GIT -C $repo reset --hard "$($target.Hash)"
} else {
    # soft: 커밋 취소 but 변경사항은 working tree에 유지
    & $GIT -C $repo reset --soft "$($target.Hash)"
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "복원 완료!" -ForegroundColor Green
    Write-Host "(이후 변경사항은 working tree에 unstaged 상태로 남아 있습니다)"
} else {
    Write-Error "복원 실패"
}
