Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot '..\assets\images\logo.jpeg'
$assetsPath = Join-Path $PSScriptRoot '..\assets'
$source = [System.Drawing.Bitmap]::new((Resolve-Path $sourcePath).Path)

function New-Canvas([string]$path, [System.Drawing.Color]$background, [bool]$transparentMark, [bool]$monochrome) {
  $canvas = [System.Drawing.Bitmap]::new(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.Clear($background)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $crop = [System.Drawing.Rectangle]::new(112, 55, 280, 155)
  $target = [System.Drawing.Rectangle]::new(145, 300, 734, 424)
  $graphics.DrawImage($source, $target, $crop, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.Dispose()

  if ($transparentMark -or $monochrome) {
    for ($y = 0; $y -lt $canvas.Height; $y++) {
      for ($x = 0; $x -lt $canvas.Width; $x++) {
        $pixel = $canvas.GetPixel($x, $y)
        if ($pixel.R -gt 225 -and $pixel.G -gt 225 -and $pixel.B -gt 225) {
          $canvas.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($monochrome -and $pixel.A -gt 0) {
          $canvas.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, 255, 255, 255))
        }
      }
    }
  }

  $canvas.Save((Join-Path $assetsPath $path), [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose()
}

New-Canvas 'icon.png' ([System.Drawing.Color]::White) $false $false
New-Canvas 'android-icon-foreground.png' ([System.Drawing.Color]::Transparent) $true $false
New-Canvas 'android-icon-monochrome.png' ([System.Drawing.Color]::Transparent) $false $true
New-Canvas 'splash-icon.png' ([System.Drawing.Color]::Transparent) $true $false

$notification = [System.Drawing.Bitmap]::new(96, 96, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$notificationGraphics = [System.Drawing.Graphics]::FromImage($notification)
$notificationGraphics.Clear([System.Drawing.Color]::Transparent)
$notificationGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$notificationGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$notificationGraphics.DrawImage($source, [System.Drawing.Rectangle]::new(5, 24, 86, 48), [System.Drawing.Rectangle]::new(112, 55, 280, 155), [System.Drawing.GraphicsUnit]::Pixel)
$notificationGraphics.Dispose()
for ($y = 0; $y -lt $notification.Height; $y++) {
  for ($x = 0; $x -lt $notification.Width; $x++) {
    $pixel = $notification.GetPixel($x, $y)
    if ($pixel.R -gt 225 -and $pixel.G -gt 225 -and $pixel.B -gt 225) {
      $notification.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    } elseif ($pixel.A -gt 0) {
      $notification.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, 255, 255, 255))
    }
  }
}
$notification.Save((Join-Path $assetsPath 'notification-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$notification.Dispose()
$source.Dispose()
