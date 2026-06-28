# checkpoint.ps1 — 현재 로컬 작업을 WIP 커밋으로 저장 (push 없음, 로컬 전용)
#
# 사용법:
#   .\checkpoint.ps1           → 현재 상태 저장 (메모 없음)
#   .\checkpoint.ps1 "설명"    → 설명 포함 저장
#
# 복원:
#   .\restore.ps1              → 저장 목록 확인
#   .\restore.ps1 1            → 1번 항목으로 복원

param([string]$memo = "")

$GIT = "C:\Users\c9611\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
if (-not (Test-Path $GIT)) {
    $found = Get-Command git -ErrorAction SilentlyContinue
    if (-not $found) { Write-Error "git"; exit 1 }
    $GIT = $found.Source
}

$repo = $PSScriptRoot
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$label = if ($memo) { "[WIP] $timestamp -- $memo" } else { "[WIP] $timestamp" }

Write-Host ""
Write-Host "체크포인트 저장 중..." -ForegroundColor Cyan

& $GIT -C $repo add -A
if ($LASTEXITCODE -ne 0) { Write-Error "git add 실패"; exit 1 }

$staged = & $GIT -C $repo diff --cached --name-only
if (-not $staged) {
    Write-Host "저장할 변경사항이 없습니다." -ForegroundColor Yellow
    exit 0
}

& $GIT -C $repo commit -m $label
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "저장 완료: $label" -ForegroundColor Green
    Write-Host "복원하려면: .\restore.ps1" -ForegroundColor Cyan
} else {
    Write-Error "커밋 실패"
    exit 1
}
