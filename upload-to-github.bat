@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo  Iron Lift 3D - GitHub 업로드
echo  https://github.com/JeongGyu11/iron-lift-3d
echo ==========================================

where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] Git이 설치되어 있지 않습니다.
  echo     https://git-scm.com/download/win 에서 설치한 뒤 이 파일을 다시 실행하세요.
  pause
  exit /b 1
)

if not exist .git git init
git config user.name >nul 2>nul || git config user.name "JeongGyu11"
git config user.email >nul 2>nul || git config user.email "JeongGyu11@users.noreply.github.com"

git add -A
git commit -m "Iron Lift 3D 업데이트" || echo (새로 바뀐 내용이 없습니다)
git branch -M main
git remote get-url origin >nul 2>nul || git remote add origin https://github.com/JeongGyu11/iron-lift-3d.git

echo.
echo GitHub로 올리는 중... (처음이면 GitHub 로그인 창이 뜰 수 있습니다)
git push -u origin main
if errorlevel 1 (
  echo.
  echo [!] 업로드에 실패했습니다. 위의 메시지를 확인해 주세요.
) else (
  echo.
  echo [완료] https://github.com/JeongGyu11/iron-lift-3d 에 올라갔습니다.
)
pause
