@echo off
setlocal
set "NODE_ENV=production"
node "%~dp0apps\server\dist\index.js" %*
