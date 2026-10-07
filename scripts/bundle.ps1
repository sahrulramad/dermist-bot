Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = "dermist-discloud.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')

# Add all files in src with linux-style forward slashes
$files = Get-ChildItem -Path src -Recurse -File
foreach ($f in $files) {
    $rel = $f.FullName.Substring((Get-Item .).FullName.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $rel) | Out-Null
}

# Add root files
foreach ($f in @('package.json', 'discloud.config', '.env')) {
    if (Test-Path $f) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Resolve-Path $f).Path, $f) | Out-Null
    }
}

$zip.Dispose()
Copy-Item -Path $zipPath -Destination "..\dermist-bot.zip" -Force -ErrorAction SilentlyContinue
Write-Host "✅ Selesai! File zip berhasil dibuat (Ukuran: $((Get-Item $zipPath).Length / 1KB) KB)"
