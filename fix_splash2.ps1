Add-Type -AssemblyName System.Drawing

$logo = [System.Drawing.Image]::FromFile("d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\public\logo.jpg")
$dir = "d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\android\app\src\main\res"

# drawable\splash.png
$bmp = New-Object System.Drawing.Bitmap(960, 960)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(3, 107, 178))
$g.DrawImage($logo, (New-Object System.Drawing.Rectangle(0, 0, 960, 960)))
$bmp.Save("$dir\drawable\splash.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

# drawable-v24\splash.png
$bmp2 = New-Object System.Drawing.Bitmap(960, 960)
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.Clear([System.Drawing.Color]::FromArgb(3, 107, 178))
$g2.DrawImage($logo, (New-Object System.Drawing.Rectangle(0, 0, 960, 960)))
$bmp2.Save("$dir\drawable-v24\splash.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose()
$bmp2.Dispose()

$logo.Dispose()
Write-Host "drawable y drawable-v24 splash.png generados"
