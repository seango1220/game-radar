@echo off
cd /d "%~dp0"
echo Game Radar is starting on http://localhost:4173/
echo Keep this window open while you use the widget.
node server.js
pause
