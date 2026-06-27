Add-Type -AssemblyName System.Drawing

$logoPath = "d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\public\logo.jpg"
$outputDir = "d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\android\app\src\main\res"

Write-Host "Cargando logo..."
$logo = [System.Drawing.Image]::FromFile($logoPath)

# Splash screens (mismo tamaño para todos)
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
    $g.Clear([System.Drawing.Color]::FromArgb(3, 107, 178)) # #036BB2
    
    $logoRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $g.DrawImage($logo, $logoRect)
    
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    
    Write-Host "  $folder\splash.png ($size x $size)"
}

# Iconos
$iconSizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

Write-Host "Generando iconos..."
foreach ($folder in $iconSizes.Keys) {
    $size = $iconSizes[$folder]
    
    # ic_launcher.png
    $path = "$outputDir\$folder\ic_launcher.png"
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(3, 107, 178))
    
    $logoRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $g.DrawImage($logo, $logoRect)
    
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    
    # ic_launcher_round.png
    $pathRound = "$outputDir\$folder\ic_launcher_round.png"
    $bmpRound = New-Object System.Drawing.Bitmap($size, $size)
    $gRound = [System.Drawing.Graphics]::FromImage($bmpRound)
    $gRound.Clear([System.Drawing.Color]::FromArgb(3, 107, 178))
    
    $gRound.DrawImage($logo, $logoRect)
    
    $bmpRound.Save($pathRound, [System.Drawing.Imaging.ImageFormat]::Png)
    $gRound.Dispose()
    $bmpRound.Dispose()
    
    Write-Host "  $folder\ic_launcher.png y ic_launcher_round.png ($size x $size)"
}

$logo.Dispose()
Write-Host "✅ Done! Todos los PNG reales generados."
