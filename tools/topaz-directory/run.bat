@echo off
cd /d "%~dp0"
echo Among The Letters - Topaz Pages crawler
echo.
where py >nul 2>nul && (set PY=py) || (set PY=python)
%PY% -m pip install --quiet -r requirements.txt
%PY% crawl.py %*
echo.
echo Done. Your file is in the "output" folder: topaz_directory.csv
pause
