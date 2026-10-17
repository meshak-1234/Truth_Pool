Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\assets\branding_board.png"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# 1. Full Main Logo (top-left)
# In 1536x1024: x: 70, y: 25, w: 830, h: 550
$logoRect = [System.Drawing.Rectangle]::new(70, 25, 830, 550)
$logo = $src.Clone($logoRect, $src.PixelFormat)
$logo.Save((Join-Path $PSScriptRoot "..\assets\truth-pool-logo.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$logo.Dispose()

# 2. Mascot Head Only (top)
# x: 380, y: 30, w: 380, h: 280
$emblemRect = [System.Drawing.Rectangle]::new(380, 30, 380, 280)
$emblem = $src.Clone($emblemRect, $src.PixelFormat)
$emblem.Save((Join-Path $PSScriptRoot "..\assets\truth-pool-emblem.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$emblem.Dispose()

# 3. Clean Hero Character with FACT! & TRAP! speech bubbles (bottom-left)
# x: 370, y: 670, w: 420, h: 275
$heroRect = [System.Drawing.Rectangle]::new(370, 672, 420, 275)
$hero = $src.Clone($heroRect, $src.PixelFormat)
$hero.Save((Join-Path $PSScriptRoot "..\assets\truth-pool-hero.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$hero.Dispose()

# 4. Standalone Mascot Ball (bottom-left character only)
# x: 375, y: 690, w: 235, h: 240
$ballRect = [System.Drawing.Rectangle]::new(375, 690, 235, 240)
$ball = $src.Clone($ballRect, $src.PixelFormat)
$ball.Save((Join-Path $PSScriptRoot "..\assets\truth-pool-mascot.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$ball.Dispose()

$src.Dispose()
Write-Host "All assets extracted with clean boundaries!"
