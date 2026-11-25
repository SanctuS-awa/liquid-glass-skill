#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {version} = require('../package.json');

const help = 'LiquidGlass Skill ' + version + '\n' +
  '用法：liquidglass-skill install [--user]\n' +
  '默认安装到当前项目的 .agents/skills/liquid-glass。\n' +
  '--user 安装到当前用户的 ~/.agents/skills/liquid-glass。\n' +
  '如目标已有文件，本命令不会覆盖。';

function ensureDirectory(dir) {
  try { fs.mkdirSync(dir); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  if (!fs.lstatSync(dir).isDirectory())
    throw new Error('安装路径必须是普通目录，不能是文件或符号链接：' + dir);
}

function main(args) {
  if (args.length === 1 && args[0] === '--version') {
    console.log(version); return;
  }
  if (args.length === 0 || (args.length === 1 && args[0] === '--help')) {
    console.log(help); return;
  }
  if (args[0] !== 'install' || args.length > 2 ||
      (args.length === 2 && args[1] !== '--user')) {
    throw new Error('不支持的参数。使用 --help 查看用法。');
  }

  const source = path.join(__dirname, '..', 'liquid-glass');
  if (!fs.statSync(path.join(source, 'SKILL.md')).isFile())
    throw new Error('安装包缺少 SKILL.md。');

  const agents = path.join(args[1] === '--user' ? os.homedir() : process.cwd(), '.agents');
  const parent = path.join(agents, 'skills');
  const target = path.join(parent, 'liquid-glass');
  ensureDirectory(agents);
  ensureDirectory(parent);

  try { fs.mkdirSync(target); }
  catch (error) {
    if (error.code === 'EEXIST')
      throw new Error('已有 LiquidGlass Skill，未覆盖：' + target + '\n如要升级，请先把旧目录移出 skills 目录保存后再装。');
    throw error;
  }
  try {
    for (const entry of fs.readdirSync(source)) {
      fs.cpSync(path.join(source, entry), path.join(target, entry), {
        recursive: true, force: false, errorOnExist: true,
      });
    }
  } catch (error) {
    fs.rmSync(target, {recursive: true, force: true});
    throw error;
  }
  console.log('已安装 LiquidGlass Skill ' + version + '：' + path.join(target, 'SKILL.md'));
  console.log('打开该项目的新 Codex 会话，输入 $liquid-glass 使用。');
}

try { main(process.argv.slice(2)); }
catch (error) { console.error(error.message); process.exitCode = 1; }
