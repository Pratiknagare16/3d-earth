# NASA Earth & Moon Texture Downloader
# Downloads free high-resolution textures from CDN and NASA sources

$textureDir = Join-Path $PSScriptRoot "textures"

if (-not (Test-Path $textureDir)) {
    New-Item -ItemType Directory -Path $textureDir | Out-Null
    Write-Host "[+] Created textures/ directory" -ForegroundColor Green
}

$textures = @(
    @{
        Name = "earth_albedo_8k.jpg"
        Url  = "https://unpkg.com/three-globe@2.41.12/example/img/earth-blue-marble.jpg"
        Desc = "Earth Albedo (Blue Marble)"
    },
    @{
        Name = "earth_normal_8k.jpg"
        Url  = "https://unpkg.com/three-globe@2.41.12/example/img/earth-topology.png"
        Desc = "Earth Normal/Topology Map"
    },
    @{
        Name = "earth_specular_8k.jpg"
        Url  = "https://unpkg.com/three-globe@2.41.12/example/img/earth-water.png"
        Desc = "Earth Specular/Water Map"
    },
    @{
        Name = "earth_night_8k.jpg"
        Url  = "https://unpkg.com/three-globe@2.41.12/example/img/earth-night.jpg"
        Desc = "Earth Night Lights"
    },
    @{
        Name = "earth_clouds_4k.png"
        Url  = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r161/examples/textures/planets/earth_clouds_1024.png"
        Desc = "Earth Clouds"
    },
    @{
        Name = "moon_albedo_4k.jpg"
        Url  = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r161/examples/textures/planets/moon_1024.jpg"
        Desc = "Moon Albedo"
    }
)

Write-Host ""
Write-Host "=== NASA Texture Downloader ===" -ForegroundColor Cyan
Write-Host "Downloading $($textures.Count) textures...`n"

foreach ($tex in $textures) {
    $dest = Join-Path $textureDir $tex.Name
    if (Test-Path $dest) {
        Write-Host "[=] $($tex.Desc) already exists, skipping." -ForegroundColor Yellow
        continue
    }
    Write-Host "[>] Downloading $($tex.Desc)..." -ForegroundColor White -NoNewline
    try {
        Invoke-WebRequest -Uri $tex.Url -OutFile $dest -UseBasicParsing
        $size = [math]::Round((Get-Item $dest).Length / 1MB, 2)
        Write-Host " OK (${size} MB)" -ForegroundColor Green
    }
    catch {
        Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n[+] Done! Textures saved to: $textureDir" -ForegroundColor Cyan
