Add-Type -AssemblyName System.Drawing

$logoPath = "d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\public\logo.jpg"
$outputDir = "d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\android\app\src\main\res"

Write-Host "Cargando logo..."
$logo = [System.Drawing.Image]::FromFile($logoPath)

# Splash screens
$splashSizes = @{
    "drawable-port-mdpi" = 480
    "drawable-port-hdpi" = 720
    "drawable-port-xhdpi" = 960
    "drawable-port-xxhdpi" = 1440
    "drawable-port-xxxhdpi" = 1920
    "drawable-land-mdpi" = 480
    "drawable-land-hdpi" = 720
    "drawable-land-xhdpi" = 960
    "drawable-land-xxhdpi" = 1440
    "drawable-land-xxxhdpi" = 1920
}

Write-Host "Generando splash screens..."
foreach ($folder in $splashSizes.Keys) {
    $size = $splashSizes[$folder]
    $path = "$outputDir\$folder\splash.png"
    
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(3, 107, 178))
    $logoRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $g.DrawImage($logo, $logoRect)
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "  $folder\splash.png"
}

# drawable y drawable-v24 splash
$bmp = New-Object System.Drawing.Bitmap(960, 960)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(3, 107, 178))
$g.DrawImage($logo, (New-Object System.Drawing.Rectangle(0, 0, 960, 960)))
$bmp.Save("$outputDir\drawable\splash.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Host "  drawable\splash.png"

$bmp2 = New-Object System.Drawing.Bitmap(960, 960)
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.Clear([System.Drawing.Color]::FromArgb(3, 107, 178))
$g2.DrawImage($logo, (New-Object System.Drawing.Rectangle(0, 0, 960, 960)))
$bmp2.Save("$outputDir\drawable-v24\splash.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose()
$bmp2.Dispose()
Write-Host "  drawable-v24\splash.png"

# Iconos
$iconSizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

Write-Host "Generando iconos (ic_launcher, ic_launcher_round, ic_launcher_foreground)..."
foreach ($folder in $iconSizes.Keys) {
    $size = $iconSizes[$folder]
    
    # ic_launcher.png
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(3, 107, 178))
    $g.DrawImage($logo, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)))
    $bmp.Save("$outputDir\$folder\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    
    # ic_launcher_round.png
    $bmpRound = New-Object System.Drawing.Bitmap($size, $size)
    $gRound = [System.Drawing.Graphics]::FromImage($bmpRound)
    $gRound.Clear([System.Drawing.Color]::FromArgb(3, 107, 178))
    $gRound.DrawImage($logo, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)))
    $bmpRound.Save("$outputDir\$folder\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $gRound.Dispose()
    $bmpRound.Dispose()
    
    # ic_launcher_foreground.png
    $bmpFg = New-Object System.Drawing.Bitmap($size, $size)
    $gFg = [System.Drawing.Graphics]::FromImage($bmpFg)
    $gFg.Clear([System.Drawing.Color]::Transparent)
    $gFg.DrawImage($logo, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)))
    $bmpFg.Save("$outputDir\$folder\ic_launcher_foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $gFg.Dispose()
    $bmpFg.Dispose()
    
    Write-Host "  $folder\ic_launcher*.png y ic_launcher_foreground.png"
}

$logo.Dispose()
Write-Host "✅ Todos los PNG generados (incluyendo foreground)"
