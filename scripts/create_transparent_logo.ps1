Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\assets\truth-pool-logo.png"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)
$bmp = [System.Drawing.Bitmap]::new($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $src.Height; $y++) {
    for ($x = 0; $x -lt $src.Width; $x++) {
        $c = $src.GetPixel($x, $y)
        # Background threshold (dark navy #0B1F3B or darker)
        if ($c.R -le 18 -and $c.G -le 35 -and $c.B -le 66) {
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            $bmp.SetPixel($x, $y, $c)
        }
    }
}

$outPath = Join-Path $PSScriptRoot "..\assets\truth-pool-logo-transparent.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$src.Dispose()
Write-Host "Transparent logo generated at $outPath"
