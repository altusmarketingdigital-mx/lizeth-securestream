@echo off
echo ========================================================
echo   Convertidor de MP4 a HLS (Para proteccion Anti-Descargas)
echo ========================================================
echo.

if "%~1"=="" (
    echo [ERROR] Arrastra un archivo .mp4 sobre este archivo .bat
    pause
    exit /b
)

set INPUT_FILE=%~1
set FILENAME=%~n1
set OUTPUT_DIR=%~dp1%FILENAME%_hls

echo [INFO] Analizando archivo: %INPUT_FILE%
echo [INFO] Creando directorio: %OUTPUT_DIR%

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

:: Comprobar si FFmpeg esta instalado
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] FFmpeg no esta instalado o no esta en el PATH.
    echo Por favor, descarga FFmpeg de https://ffmpeg.org/ y agregalo a las variables de entorno.
    pause
    exit /b
)

echo [INFO] Iniciando conversion a HLS (resolucion original)...
echo [INFO] Esto puede tardar varios minutos dependiendo de tu procesador.
echo.

ffmpeg -i "%INPUT_FILE%" -codec: copy -start_number 0 -hls_time 10 -hls_list_size 0 -f hls "%OUTPUT_DIR%\%FILENAME%.m3u8"

echo.
echo ========================================================
echo   [EXITO] Conversion terminada.
echo   La carpeta %OUTPUT_DIR% contiene tu video protegido.
echo   Sube TODOS los archivos de esa carpeta a Amazon S3.
echo ========================================================
pause
