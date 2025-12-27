@echo off
echo Cleaning corrupted CMake cache files...
cd /d "%~dp0"

REM Clean corrupted execution history
if exist ".gradle\8.14.1\executionHistory" (
    echo Removing corrupted execution history...
    rmdir /s /q ".gradle\8.14.1\executionHistory"
)

REM Clean CMake cache for react-native-audio-recorder-player
if exist "node_modules\react-native-audio-recorder-player\android\.cxx" (
    echo Cleaning react-native-audio-recorder-player CMake cache...
    rmdir /s /q "node_modules\react-native-audio-recorder-player\android\.cxx"
)

if exist "node_modules\react-native-audio-recorder-player\android\build\cmake" (
    echo Cleaning react-native-audio-recorder-player build cache...
    rmdir /s /q "node_modules\react-native-audio-recorder-player\android\build\cmake"
)

echo Cache cleanup complete!
pause

