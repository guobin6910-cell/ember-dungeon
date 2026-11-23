import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function encodePowerShellUtf16(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const distIndex = path.join(rootDir, 'dist', 'index.html');
  const icoPath = path.join(rootDir, 'build', 'icon.ico');
  if (!fs.existsSync(distIndex)) {
    throw new Error(`Missing build output: ${distIndex}. Run "npm run build" first.`);
  }
  if (!fs.existsSync(icoPath)) {
    throw new Error(`Missing icon file: ${icoPath}. Run "npm run build:icon" first.`);
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const electronPkg = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'node_modules', 'electron', 'package.json'), 'utf8')
  );

  const ep = await import('@electron/packager');
  const packager = ep.packager ?? ep.default;

  const outDir = path.join(rootDir, 'release');
  const appPaths = await packager({
    dir: rootDir,
    out: outDir,
    name: '餘燼地城',
    executableName: '餘燼地城',
    platform: 'win32',
    arch: 'x64',
    asar: true,
    prune: false,
    overwrite: true,
    electronVersion: electronPkg.version,
    icon: icoPath,
    appVersion: pkg.version,
    win32metadata: {
      ProductName: '餘燼地城 (Ember Dungeon)',
      FileDescription: '餘燼地城 — 2D 暗黑奇幻風單機 ARPG',
      InternalName: 'ember-dungeon',
      OriginalFilename: '餘燼地城.exe',
      CompanyName: 'Ember Dungeon',
    },
    ignore(filePath) {
      const normalized = filePath.replace(/\\/g, '/');
      if (normalized === '' || normalized === '/package.json') return false;
      if (
        normalized === '/dist' ||
        normalized.startsWith('/dist/') ||
        normalized === '/electron' ||
        normalized.startsWith('/electron/') ||
        normalized === '/build' ||
        normalized.startsWith('/build/')
      ) {
        return false;
      }
      return true;
    },
  });

  if (!appPaths || appPaths.length === 0) {
    throw new Error('Electron packager returned no output directories.');
  }

  const appDir = appPaths[0];
  const exePath = path.join(appDir, '餘燼地城.exe');
  if (!fs.existsSync(exePath)) {
    throw new Error(`Expected packaged executable not found: ${exePath}`);
  }

  const shortcutPath = path.join(rootDir, '餘燼地城.lnk');
  const psScript = [
    '$WshShell = New-Object -ComObject WScript.Shell',
    `$Shortcut = $WshShell.CreateShortcut(${psQuote(shortcutPath)})`,
    `$Shortcut.TargetPath = ${psQuote(exePath)}`,
    `$Shortcut.WorkingDirectory = ${psQuote(appDir)}`,
    `$Shortcut.IconLocation = ${psQuote(`${exePath},0`)}`,
    `$Shortcut.Description = ${psQuote('餘燼地城 (Ember Dungeon)')}`,
    '$Shortcut.Save()',
  ].join('\n');

  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodePowerShellUtf16(psScript)],
    { stdio: 'inherit' }
  );

  const asarPath = path.join(appDir, 'resources', 'app.asar');
  const asarSize = fs.existsSync(asarPath) ? fs.statSync(asarPath).size : 0;

  console.log('\n=== Packaging Complete ===');
  console.log(`Output directory : ${appDir}`);
  console.log(`Executable       : ${exePath}`);
  console.log(`Shortcut         : ${shortcutPath}`);
  console.log(`app.asar size    : ${(asarSize / (1024 * 1024)).toFixed(2)} MB (${asarSize} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

