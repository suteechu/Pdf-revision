@echo off
chcp 65001 > nul
echo ==========================================
echo  🚀 ระบบอัปโหลดและอัปเดตเว็บไซต์อัตโนมัติ
echo ==========================================
echo.

echo [1/3] กำลังบันทึกโค้ดลง Git (Commit)...
git add .
git commit -m "Auto update code and deploy"

echo.
echo [2/3] กำลังอัปโหลดโค้ด (Push to main)...
git push origin main

echo.
echo [3/3] กำลัง Build และอัปเดตเว็บไซต์ GitHub Pages (Deploy)...
call npm run deploy

echo.
echo ==========================================
echo  ✅ เสร็จสิ้น! เว็บไซต์และโค้ดของคุณได้รับการอัปเดตแล้ว
echo  (อาจต้องรอ 1-2 นาทีเพื่อให้ GitHub Pages แสดงผลเวอร์ชันล่าสุด)
echo ==========================================
pause