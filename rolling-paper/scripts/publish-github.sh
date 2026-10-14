#!/bin/bash
# 컨테이너 안에서 실행: rolling-paper 를 braveload/2021 의 rolling-paper/ 하위 폴더로 올린다 (기존 파일은 건드리지 않음)
set -e
export PATH=/home/node/.local/bin:$PATH SSL_CERT_FILE=/home/node/.local/etc/ca.pem
command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git >/dev/null; }
rm -rf /tmp/repo && gh repo clone braveload/2021 /tmp/repo -- -q
mkdir -p /tmp/repo/rolling-paper
tar -C /app --exclude=node_modules --exclude=shots --exclude=.vercel --exclude='.env*' --exclude=scripts/_q.sql -cf - . | tar -C /tmp/repo/rolling-paper -xf -
cd /tmp/repo
git config user.name "braveload"
git config user.email "braveload@users.noreply.github.com"
gh auth setup-git >/dev/null 2>&1
git add rolling-paper
git status --short | head -40
git commit -q -m "${1:-feat: 우리 팀 롤링페이퍼 (Supabase + Vercel)}" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push origin HEAD:main
git log --oneline | head -3
