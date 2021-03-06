const path = require('path');
const { spawnSync, spawn } = require('child_process');
const fs = require('fs-extra');
const signale = require('signale');
const resolveRoot = require('./utils/resolve');

function runBuildCmd({ buildCmd }) {
  if (!buildCmd)
    throw Error(
      'Warning: Build command not found, use "-c <command>" or "--ignoreBuild"',
    );

  const [cmd, ...args] = buildCmd.split(' ');

  const res = spawnSync(cmd, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  if (res.status !== 0) throw Error(`command "${buildCmd}" Failed`);
}

function prepare({ out, buildCmd, version, ignoreBuild }) {
  const pkg = require(resolveRoot('package.json'));
  const files = pkg.files;
  if (version) pkg.version = version;
  Reflect.deleteProperty(pkg, 'files');
  Reflect.deleteProperty(pkg, 'private');
  const outDir = resolveRoot(out);

  if (!ignoreBuild) runBuildCmd({ buildCmd });

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }

  files?.forEach(file => {
    const src = resolveRoot(file);
    if (!fs.existsSync(src)) {
      signale.warn(`file "${file}" not found. but it's in package.files.`);
      return;
    }

    fs.copySync(src, path.join(outDir, file));
  });

  fs.writeFileSync(
    path.join(outDir, 'package.json'),
    JSON.stringify(pkg, {}, 2),
  );
}

function spawnPublish({ out, version }) {
  const child = spawn('npm', ['publish', '--access=public'], {
    cwd: out,
    stdio: 'inherit',
  });
  child.on('exit', code => {
    if (code === 0) {
      delete require.cache[require.resolve(resolveRoot('package.json'))];
      const pkg = require(resolveRoot('package.json'));
      if (version) pkg.version = version;
      fs.writeFileSync(resolveRoot('package.json'), JSON.stringify(pkg, {}, 2));
    }
  });
}

function spawnPack({ out }) {
  spawn('npm', ['pack'], { cwd: out, stdio: 'inherit' });
}

function pack(opt) {
  prepare(opt);
  spawnPack(opt);
  return Promise.resolve(true);
}

function build(opt) {
  prepare(opt);
  opt.publish && spawnPublish(opt);
  return Promise.resolve(true);
}

module.exports = {
  build,
  pack,
};
