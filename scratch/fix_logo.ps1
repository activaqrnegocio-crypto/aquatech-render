$b64Path = "d:\Abel paginas\Aquatech\Crm Aquatech\scratch\logo_b64_utf8.txt"
$tsPath  = "d:\Abel paginas\Aquatech\Crm Aquatech\src\lib\pdf-generator.ts"

$b64 = (Get-Content $b64Path -Raw).Trim()
$lines = [System.IO.File]::ReadAllLines($tsPath)

$newLine = "const AQUATECH_LOGO_B64 = 'data:image/jpeg;base64," + $b64 + "';"

$output = [System.Collections.Generic.List[string]]::new()

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($i -eq 6) {
        # Replace corrupted line 7 (0-indexed = 6)
        $output.Add($newLine)
    }
    elseif ($i -eq 7 -or $i -eq 8) {
        # Skip the continuation lines of the corrupted string
        continue
    }
    else {
        $output.Add($lines[$i])
    }
}

[System.IO.File]::WriteAllLines($tsPath, $output)
Write-Host "Done - replaced logo in pdf-generator.ts ($($output.Count) lines written)"
