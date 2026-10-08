@echo off
chcp 65001 >nul
title Terres Vives - serveur de la classe
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n est pas installe. Telechargez-le sur https://nodejs.org puis relancez ce fichier.
  pause
  exit /b
)
node server.js
pause
