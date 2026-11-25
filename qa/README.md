# 网页标本 · 测量与复查

## 本次怎么采

真实入口是 [web/index.html](../web/index.html)，没有请求外部背景。现场文字是 HTML；画布输入是同尺寸原创背景，L4 处理折射像，L5 读取原背景的邻近色，L6 读取扩散前的折射接触。降级 UI 只保证可读，不伪称有折射。

桌面视口 1200 × 785，浏览器以 1× 设备比例显示。固定取样时间 2.15 s，材质画布 663 × 462；展开轮廓 414 × 208，圆角 33 px。探针用局部尺度 S=50 px（不大于 W=208 px）。灰色细纹周期 14 px（0.28 S），宽条纹两边相隔 24 px（0.48 S）。选定 B3 的采样位置后固定使用：上半部 6 个相邻行的峰谷对照，下半部 6 个相邻行的明暗平台对照。原测试帧未调色、未压缩为 JPEG。位移追踪贯穿左近沿的同一宽条上升沿，以原底上下平台的线性亮度中点判定，6 个相邻行平均，保守按 ±1 原生像素计。

- 中性探针：[B0 无玻璃](B0.png) | [B3 折射](B3.png) | [B4a 普通模糊](B4a.png) | [B4b 加亮晕](B4b.png) | [B5 高光](B5.png) | [B6 全开](B6.png)
- 实际图案：[B0](scene-B0.png) | [B3](scene-B3.png) | [B4a](scene-B4a.png) | [B6](scene-B6.png) | [1× 局部拼图](stages.png)。检查蓝铜交界和左下弧的窄亮纹，不能只看面色。
- 数据：[固定坐标](clarity-manifest.json) | [各阶段原始对比与边位置](measurements.json) | [Skill 检查器结果](clarity-result.json) | [交互与减少动态效果检查](browser-checks.json)

## 如何复验

只看网页不需要装工具。下列命令在解压目录运行：

```sh
python3 liquid-glass/scripts/check_clarity.py qa/clarity-manifest.json
```

读取 PNG 需要 Pillow。要重新采集，还需要 Python Playwright、Chromium、NumPy 和 Pillow；录制动图再用到 FFmpeg。设置环境变量 `CHROME` 指向可执行文件，或者使用 Playwright 已安装的 Chromium：

```sh
python3 tools/capture.py still
python3 tools/capture.py checks
python3 tools/measure.py
python3 tools/capture.py motion
```

`still` 在正常网页上直接截图；`checks` 先锁定同一时刻与几何导出诊断图，再交还页面实时控制，在点击、打断、减少动态效果及移动视口分别验证。影片使用实际 DOM 点击和同一弹簧积分器，固定 12 fps 拼帧，便于重现。实况帧率会随硬件、窗口大小变化，本片不拿来报帧率。网页并未抓取浏览器后面任意窗口的像素，也未穷举各平台和六层全部反例。
