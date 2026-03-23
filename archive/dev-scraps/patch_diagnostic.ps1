$path = "c:\Users\graem\OneDrive\Documents\GitHub\vr-roguelike\main.js"
$content = Get-Content $path -Raw

# 1. Add showError function at the end
$showErrorFunc = '
let errorShown = false;
function showError(e) {
  if (errorShown) return;
  errorShown = true;
  console.error(e);
  
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#440000";
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = "red";
  ctx.font = "40px monospace";
  ctx.fillText("ERROR: " + e.message, 20, 100);
  ctx.fillText((e.stack || "").substring(0, 60), 20, 160);
  
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ map: tex, depthTest: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), mat);
  
  if (camera) {
    camera.add(mesh);
    mesh.position.set(0, 0, -1.5);
    mesh.renderOrder = 9999;
  } else if (scene) {
    scene.add(mesh);
    mesh.position.set(0, 1.6, -1.5);
  }
}
'

if (-not $content.Contains("function showError(e)")) {
    $content += $showErrorFunc
    Write-Output "Added showError function"
}

# 2. Wrap render loop in try-catch
$renderStart = 'function render(timestamp) {'
$renderStartReplace = 'function render(timestamp) { try {'

$renderEnd = 'renderer.render(scene, camera);'
$renderEndReplace = 'renderer.render(scene, camera); } catch (e) { showError(e); }'

if ($content.Contains($renderStart) -and $content.Contains($renderEnd)) {
    $content = $content.Replace($renderStart, $renderStartReplace)
    # We replace only the first occurrence of renderEnd because it might appear elsewhere? 
    # Actually renderer.render(scene, camera) appears once in render loop.
    # But let's be safe and check.
    $content = $content.Replace($renderEnd, $renderEndReplace)
    Write-Output "Wrapped render loop in try-catch"
} else {
    Write-Warning "Could not find render loop block to wrap"
}

$content | Set-Content $path -NoNewline
Write-Output "Diagnostic patch applied"
