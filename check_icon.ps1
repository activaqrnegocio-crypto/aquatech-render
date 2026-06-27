Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\public\icon-512.png")
Write-Host "Width: $($img.Width)"
Write-Host "Height: $($img.Height)"
$img.Dispose()
