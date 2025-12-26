import esbuild from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const bundleDir = path.join(distDir, 'bundle');

// Convert to forward slash path (cross-platform compatibility)
const toSlash = (p) => p.replace(/\\/g, '/');

// Ensure directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}
if (!fs.existsSync(bundleDir)) {
  fs.mkdirSync(bundleDir, { recursive: true });
}

// Get command line arguments
const args = process.argv.slice(2);
const targetArg = args.find(arg => arg.startsWith('--target='));
const target = targetArg ? targetArg.split('=')[1] : 'node18-win-x64';

// Resolve target platform
const targetMap = {
  'win': 'node18-win-x64',
  'win-x64': 'node18-win-x64',
  'linux': 'node18-linux-x64',
  'linux-x64': 'node18-linux-x64',
  'linux-arm64': 'node18-linux-arm64',
  'macos': 'node18-macos-x64',
  'macos-x64': 'node18-macos-x64',
  'macos-arm64': 'node18-macos-arm64',
  'all': 'node18-win-x64,node18-linux-x64,node18-linux-arm64,node18-macos-x64,node18-macos-arm64'
};

const resolvedTarget = targetMap[target] || target;

// Output filename mapping
const outputNameMap = {
  'node18-win-x64': 'antigravity-win-x64.exe',
  'node18-linux-x64': 'antigravity-linux-x64',
  'node18-linux-arm64': 'antigravity-linux-arm64',
  'node18-macos-x64': 'antigravity-macos-x64',
  'node18-macos-arm64': 'antigravity-macos-arm64'
};

// Platform-to-bin file mapping
const binFileMap = {
  'node18-win-x64': 'antigravity_requester_windows_amd64.exe',
  'node18-linux-x64': 'antigravity_requester_linux_amd64',
  'node18-linux-arm64': 'antigravity_requester_android_arm64',  // ARM64 uses Android version
  'node18-macos-x64': 'antigravity_requester_linux_amd64',      // macOS x64 temporarily uses Linux version
  'node18-macos-arm64': 'antigravity_requester_android_arm64'   // macOS ARM64 temporarily uses Android version
};

console.log('📦 Step 1: Bundling with esbuild...');

// Bundle into CommonJS with esbuild
await esbuild.build({
  entryPoints: ['src/server/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: path.join(bundleDir, 'server.cjs'),
  external: [],
  minify: false,
  sourcemap: false,
  // Handle __dirname and __filename
  define: {
    'import.meta.url': 'importMetaUrl'
  },
  banner: {
    js: `
const importMetaUrl = require('url').pathToFileURL(__filename).href;
const __importMetaDirname = __dirname;
`
  },
  // Copy static assets
  loader: {
    '.node': 'copy'
  }
});

console.log('✅ Bundle created: dist/bundle/server.cjs');

// Create temporary package.json for pkg
// Reference asset files with absolute paths
const pkgJson = {
  name: 'antigravity-to-openai',
  version: '1.0.0',
  bin: 'server.cjs',
  pkg: {
    assets: [
      toSlash(path.join(rootDir, 'public', '**/*')),
      toSlash(path.join(rootDir, 'public', '*.html')),
      toSlash(path.join(rootDir, 'public', '*.css')),
      toSlash(path.join(rootDir, 'public', 'js', '*.js')),
      toSlash(path.join(rootDir, 'public', 'assets', '*')),
      toSlash(path.join(rootDir, 'src', 'bin', '*'))
    ]
  }
};

fs.writeFileSync(
  path.join(bundleDir, 'package.json'),
  JSON.stringify(pkgJson, null, 2)
);

console.log('📦 Step 2: Building executable with pkg...');

// Helper function to run pkg command
function runPkg(args) {
  // Convert paths in arguments to forward slash format
  const quotedArgs = args.map(arg => {
    if (arg.includes(' ') || arg.includes('\\')) {
      return `"${arg.replace(/\\/g, '/')}"`;
    }
    return arg;
  });

  const cmd = `npx pkg ${quotedArgs.join(' ')}`;
  console.log(`Running: ${cmd}`);

  try {
    execSync(cmd, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true
    });
  } catch (error) {
    throw new Error(`pkg failed: ${error.message}`);
  }
}

// Build pkg command
const targets = resolvedTarget.split(',');
const isMultiTarget = targets.length > 1;

try {
  const pkgJsonPath = path.join(bundleDir, 'package.json');

  // Delete old executable file (avoid EPERM error)
  if (isMultiTarget) {
    for (const t of targets) {
      const oldFile = path.join(distDir, outputNameMap[t] || 'antigravity');
      if (fs.existsSync(oldFile)) {
        console.log(`🗑️ Removing old file: ${oldFile}`);
        fs.unlinkSync(oldFile);
      }
    }
  } else {
    const outputName = outputNameMap[resolvedTarget] || 'antigravity';
    const oldFile = path.join(distDir, outputName);
    if (fs.existsSync(oldFile)) {
      console.log(`🗑️ Removing old file: ${oldFile}`);
      fs.unlinkSync(oldFile);
    }
  }

  if (isMultiTarget) {
    // Multi-target build
    runPkg([pkgJsonPath, '--target', resolvedTarget, '--compress', 'GZip', '--out-path', distDir]);
  } else {
    // Single-target build
    const outputName = outputNameMap[resolvedTarget] || 'antigravity';
    const outputPath = path.join(distDir, outputName);

    // Disable compression when cross-compiling ARM64 on Windows (avoid spawn UNKNOWN error)
    const isArm64 = resolvedTarget.includes('arm64');
    const isWindows = process.platform === 'win32';
    const compressArgs = (isArm64 && isWindows) ? [] : ['--compress', 'GZip'];

    runPkg([pkgJsonPath, '--target', resolvedTarget, ...compressArgs, '--output', outputPath]);
  }

  console.log('✅ Build complete!');

  // Copy files needed at runtime to dist directory
  console.log('📁 Copying runtime files...');

  // Copy public directory (exclude images)
  const publicSrcDir = path.join(rootDir, 'public');
  const publicDestDir = path.join(distDir, 'public');
  console.log(`  Source: ${publicSrcDir}`);
  console.log(`  Dest: ${publicDestDir}`);
  console.log(`  Source exists: ${fs.existsSync(publicSrcDir)}`);

  if (fs.existsSync(publicSrcDir)) {
    try {
      if (fs.existsSync(publicDestDir)) {
        console.log('  Removing existing public directory...');
        fs.rmSync(publicDestDir, { recursive: true, force: true });
      }
      // Copy directory using system commands (more reliable)
      console.log('  Copying public directory...');
      if (process.platform === 'win32') {
        execSync(`xcopy /E /I /Y /Q "${publicSrcDir}" "${publicDestDir}"`, { stdio: 'pipe', shell: true });
      } else {
        fs.mkdirSync(publicDestDir, { recursive: true });
        execSync(`cp -r "${publicSrcDir}"/* "${publicDestDir}/"`, { stdio: 'pipe', shell: true });
      }
      // Delete images directory (generated at runtime, no need to bundle)
      const imagesDir = path.join(publicDestDir, 'images');
      if (fs.existsSync(imagesDir)) {
        fs.rmSync(imagesDir, { recursive: true, force: true });
      }
      console.log('  ✓ Copied public directory');
    } catch (err) {
      console.error('  ❌ Failed to copy public directory:', err.message);
      throw err;
    }
  } else {
    console.error('  ❌ Source public directory not found!');
  }

  // Copy bin directory (only copy files for the corresponding platform)
  const binSrcDir = path.join(rootDir, 'src', 'bin');
  const binDestDir = path.join(distDir, 'bin');
  if (fs.existsSync(binSrcDir)) {
    if (fs.existsSync(binDestDir)) {
      fs.rmSync(binDestDir, { recursive: true, force: true });
    }
    fs.mkdirSync(binDestDir, { recursive: true });

    // Only copy bin files for the corresponding platform
    const targetBinFiles = isMultiTarget
      ? [...new Set(targets.map(t => binFileMap[t]).filter(Boolean))]  // Multi-target: deduplicated all files
      : [binFileMap[resolvedTarget]].filter(Boolean);  // Single-target: copy only one file

    if (targetBinFiles.length > 0) {
      for (const binFile of targetBinFiles) {
        const srcPath = path.join(binSrcDir, binFile);
        const destPath = path.join(binDestDir, binFile);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`  ✓ Copied bin/${binFile}`);
        } else {
          console.warn(`  ⚠ Warning: bin/${binFile} not found`);
        }
      }
    } else {
      // If no mapping, copy all files (compatibility for legacy behavior)
      try {
        if (process.platform === 'win32') {
          execSync(`xcopy /E /I /Y "${binSrcDir}" "${binDestDir}"`, { stdio: 'pipe', shell: true });
        } else {
          execSync(`cp -r "${binSrcDir}"/* "${binDestDir}/"`, { stdio: 'pipe', shell: true });
        }
        console.log('  ✓ Copied all bin files');
      } catch (err) {
        console.error('  ⚠ Warning: Failed to copy bin directory:', err.message);
      }
    }
  }

  // Copy configuration template (only copy config.json)
  const configSrcPath = path.join(rootDir, 'config.json');
  const configDestPath = path.join(distDir, 'config.json');
  if (fs.existsSync(configSrcPath)) {
    fs.copyFileSync(configSrcPath, configDestPath);
    console.log('  ✓ Copied config.json');
  }

  console.log('');
  console.log('🎉 Build successful!');
  console.log('');
  console.log('📋 Usage:');
  console.log('  1. Copy the dist folder to your target machine');
  console.log('  2. Run the executable (will auto-generate random credentials if not configured)');
  console.log('  3. Optionally create .env file to customize settings');
  console.log('');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
} finally {
  // Clean up temporary files
  if (fs.existsSync(bundleDir)) {
    fs.rmSync(bundleDir, { recursive: true, force: true });
    console.log('🧹 Cleaned up temporary files');
  }
}