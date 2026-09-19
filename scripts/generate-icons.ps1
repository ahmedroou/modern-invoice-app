Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\ayami\.gemini\antigravity\brain\b9012319-5491-4afb-8a5c-c5120ed3cf7d\invoice_app_icon_1789834405927.jpg"
$destBuildDir = "C:\Users\ayami\Documents\antigravity\focused-hypatia\build"
$destPublicDir = "C:\Users\ayami\Documents\antigravity\focused-hypatia\public"
$destAssetsDir = "C:\Users\ayami\Documents\antigravity\focused-hypatia\src\assets"

if (!(Test-Path $destBuildDir)) { New-Item -ItemType Directory -Force -Path $destBuildDir | Out-Null }
if (!(Test-Path $destPublicDir)) { New-Item -ItemType Directory -Force -Path $destPublicDir | Out-Null }
if (!(Test-Path $destAssetsDir)) { New-Item -ItemType Directory -Force -Path $destAssetsDir | Out-Null }

$srcImage = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Host "Original image size: $($srcImage.Width)x$($srcImage.Height)"

# 1. Save full-resolution 512x512 and 256x256 PNGs
$sizes = @(512, 256, 128, 64, 48, 32, 16)

$png512 = [System.Drawing.Bitmap]::new(512, 512)
$g512 = [System.Drawing.Graphics]::FromImage($png512)
$g512.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g512.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g512.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g512.DrawImage($srcImage, 0, 0, 512, 512)
$g512.Dispose()

$png512.Save("$destBuildDir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$png512.Save("$destPublicDir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$png512.Save("$destAssetsDir\app-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Saved icon.png to build, public, and src/assets"

# 2. Build multi-resolution ICO file
# An ICO file consists of:
# ICONDIR (6 bytes): reserved (2), type=1 (2), count (2)
# Array of ICONDIRENTRY (16 bytes each):
#   width(1), height(1), colors(1), reserved(1), planes(2), bpp(2), bytesInRes(4), imageOffset(4)
# PNG / BMP data blocks

$icoSizes = @(256, 64, 48, 32, 16)
$icoBuffers = @()

foreach ($s in $icoSizes) {
    $bmp = [System.Drawing.Bitmap]::new($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcImage, 0, 0, $s, $s)
    $g.Dispose()

    $ms = [System.IO.MemoryStream]::new()
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $icoBuffers += ,@($s, $ms.ToArray())
    $ms.Dispose()
}

$srcImage.Dispose()

# Write ICO binary
$fs = [System.IO.FileStream]::new("$destBuildDir\icon.ico", [System.IO.FileMode]::Create)
$bw = [System.IO.BinaryWriter]::new($fs)

# Header
$bw.Write([UInt16]0) # Reserved
$bw.Write([UInt16]1) # Type 1 = ICO
$bw.Write([UInt16]$icoBuffers.Count) # Count of images

# Calculate offset: 6 bytes header + (count * 16 bytes entry)
$offset = 6 + ($icoBuffers.Count * 16)

foreach ($entry in $icoBuffers) {
    $s = $entry[0]
    $data = $entry[1]
    
    $wByte = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    $hByte = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    
    $bw.Write([byte]$wByte)          # Width (0 for 256)
    $bw.Write([byte]$hByte)          # Height (0 for 256)
    $bw.Write([byte]0)               # Color count
    $bw.Write([byte]0)               # Reserved
    $bw.Write([UInt16]1)             # Color planes
    $bw.Write([UInt16]32)            # Bits per pixel
    $bw.Write([UInt32]$data.Length)  # Size of image data
    $bw.Write([UInt32]$offset)       # Offset of image data
    
    $offset += $data.Length
}

# Write image data
foreach ($entry in $icoBuffers) {
    $data = $entry[1]
    $bw.Write($data)
}

$bw.Flush()
$bw.Dispose()
$fs.Dispose()

Copy-Item -Force "$destBuildDir\icon.ico" "$destPublicDir\favicon.ico"

Write-Host "Successfully generated build\icon.ico and public\favicon.ico!"
