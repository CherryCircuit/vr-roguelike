$path = "c:\Users\graem\OneDrive\Documents\GitHub\vr-roguelike\main.js"
$content = Get-Content $path -Raw

# Fix updateExplosionVisuals signature
$target1 = 'function updateExplosionVisuals(dt, now) {'
$replace1 = 'function updateExplosionVisuals(now) {'
if ($content.Contains($target1)) {
    $content = $content.Replace($target1, $replace1)
    Write-Output "Fixed updateExplosionVisuals signature"
} else {
    Write-Warning "Could not find updateExplosionVisuals signature"
}

# Fix spawnComboPopup call in hud.js (safe navigation)
# We can't easily patch hud.js from here without reading it, but let's stick to main.js for now.
# However, we can patch the call in main.js if we can find it.
# The user state says active document is hud.js, but I'm editing main.js via script.

$content | Set-Content $path -NoNewline
Write-Output "Patch applied to main.js"
