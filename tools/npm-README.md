# LiquidGlass Skill 0.2 · 折光手册

GlassDesk 的液态玻璃设计与验收 Skill。**0.2**（离线包 **0.2.0**）独立验收三层取样、普通模糊、边缘扩散和内暗边。它教 AI 和开发者做一枚二维透镜：同一条背景亮纹到了边缘要拐弯，进入玻璃后可以变软，离开时还能接回去。文字在玻璃上方独立绘制，不跟着背景变形。

在 Codex 项目目录运行：

```bash
npm exec --offline --yes --package=./liquidglass-skill-0.2.0.tgz -- liquidglass-skill install
```

随后新开 Codex 会话并输入 `$liquid-glass`。不覆盖已有版本。
命令末尾加 `--user` 可装进当前用户的技能目录。
完整项目包另附介绍网页、演示 GIF 和验收证据。

本包采用 MIT 许可证，见同包 LICENSE。
