$path = "c:\Users\graem\OneDrive\Documents\GitHub\vr-roguelike\main.js"
$content = Get-Content $path -Raw
$target = 'function debugJumpToLevel(targetLevel) {
  console.log(`[debug] Jump to level ${targetLevel}`);
  hideTitle();
  resetGame();
  game.state = State.PLAYING;
  game.level = targetLevel;
  game._levelConfig = getLevelConfig();
  game.health = game.maxHealth;

  const hand = (lvl, idx) => ((lvl + idx) % 2 === 1 ? 'left' : 'right');
  for (let lvl = 1; lvl < targetLevel; lvl++) {
    const cfg = LEVELS[lvl - 1];
    if (cfg && cfg.isBoss) {
      const special = getRandomSpecialUpgrades(1)[0];
      if (special) addUpgrade(special.id, hand(lvl, 0));
    } else {
      const upgrades = getRandomUpgrades(3);
      upgrades.forEach((u, idx) => addUpgrade(u.id, hand(lvl, idx)));
    }
  }
  game.kills = 0;
  game._levelConfig = getLevelConfig();
  showHUD();
  blasterDisplays.forEach(d => { if (d) d.visible = false; });
  if (targetLevel >= 6) playMusic(\'levels6to10\');
}'

$replacement = 'function debugJumpToLevel(targetLevel) {
  console.log(`[debug] Jump to level ${targetLevel}`);
  hideTitle();
  resetGame();
  game.state = State.DEBUG_JUMP;
  game.level = targetLevel;
  game._levelConfig = getLevelConfig();
  game.health = game.maxHealth;

  const hand = (lvl, idx) => ((lvl + idx) % 2 === 1 ? 'left' : 'right');
  for (let lvl = 1; lvl < targetLevel; lvl++) {
    const cfg = LEVELS[lvl - 1];
    if (cfg && cfg.isBoss) {
      const special = getRandomSpecialUpgrades(1)[0];
      if (special) addUpgrade(special.id, hand(lvl, 0));
    } else {
      const upgrades = getRandomUpgrades(3);
      upgrades.forEach((u, idx) => addUpgrade(u.id, hand(lvl, idx)));
    }
  }
  
  showDebugJumpScreen(targetLevel);
}

function handleDebugJumpTrigger(controller) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const raycaster = new THREE.Raycaster(origin, direction, 0, 10);

  const action = getDebugJumpHit(raycaster);
  if (action === "start") {
    playMenuClick();
    hideHUD(); 
    startGame();
  }
}'

if ($content.Contains($target)) {
    $content = $content.Replace($target, $replacement)
    $content | Set-Content $path -NoNewline
    Write-Output "Patch applied successfully"
} else {
    Write-Error "Could not find target function block"
}
