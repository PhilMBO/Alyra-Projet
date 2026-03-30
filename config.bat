GOTO:Body

:FromRelativeToAbsolute
set REL_PATH=%~1
set ABS_PATH=
rem // Save current directory and change to target directory
pushd %REL_PATH%
rem // Save value of CD variable (current directory)
set ABS_PATH=%CD%
rem // Restore original directory
popd
rem // echo Relative path: %REL_PATH%
rem // echo Maps to path: %ABS_PATH%
SET %~2=%ABS_PATH%
IF [%~3]==[] (SET %~2=%ABS_PATH%) ELSE (SET %~2=%ABS_PATH%\%~3)
GOTO:EOF

:Body
SET SCRIPTDIR=%~dp0
call :FromRelativeToAbsolute %SCRIPTDIR%.., PROJECTS_COMMON_ROOT
rem Remove trailing backslash if any
IF %SCRIPTDIR:~-1%==\ SET SCRIPTDIR=%SCRIPTDIR:~0,-1%

SET PROJECT_VERIVO=%PROJECTS_COMMON_ROOT%\Verivo
echo %PROJECT_VERIVO%
