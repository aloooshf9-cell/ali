@echo off
cd /d "%~dp0"

echo [System] Checking for node_modules...
IF NOT EXIST "node_modules\" (
    echo [System] node_modules not found. Installing dependencies automatically...
    call npm install
) ELSE (
    echo [System] node_modules found. Skipping install.
)

echo [System] Checking for compiled production files...
IF NOT EXIST "dist\server.cjs" (
    echo [System] Compiled files not found. Building the application for production...
    call npm run build
) ELSE (
    echo [System] Compiled files found.
)

echo [System] Starting the application on PORT 2026...
node start.js
pause
