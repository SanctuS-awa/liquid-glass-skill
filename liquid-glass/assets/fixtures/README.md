# 固定盲测底图

SVG 都是纯底图，无玻璃、透明叠层、探针逻辑、网络依赖或模型生成效果。用同一 720×480 坐标系，不要把图案作为生产实现的语义输入。默认 1× 融合，不拉伸底图、不改变曝光。可以离线浏览，也可以等比例栅格化；所有开关与候选实现使用相同栅格。对照记录见[验收协议](../../references/acceptance.md)。

| SVG | 固定用途 |
| --- | --- |
| [geometry-both](geometry-both.svg) / [orange-only](geometry-orange-only.svg) / [blue-only](geometry-blue-only.svg) | 两条平行斜线和一条交叉斜线不动；橘、蓝标记依次移除时其他像素不变。用其隔离 L1–L3，验证方向、细尾与来源。 |
| [texture-dark](texture-dark.svg) / [texture-light](texture-light.svg) | 细纹坐标完全相同，外部底色不同。中央、直边内侧及圆角内侧选各自固定的取样窗；避免窗口覆盖大块色板与细线的交界，交界另外用于观察背景形状有没有糊没。 |
| [matched-lights](matched-lights.svg) / [swapped](matched-lights-swapped.svg) | 两条 48×8 px 的独立光线，中心约 (296, 222)、(424, 222)。先用大面板，向上或向下同方向测亮晕，选未被边缘截断的剖面；再交换亮暗，排除位置、采样核截断的影响。空区可取约 (360, 275)，先确认没有被两者的光晕波及。 |
| [highlight-warm-cool](highlight-warm-cool.svg) / [换位](highlight-cool-warm.svg) | 左上／右下两大柔和光区冷暖互换，用于关 L6 独验 L5。两色线性亮度接近，中心与远离光区的背景近中性。先用推荐大面板，锁定亮区取同一点的高光色；与中性底一起测试，不拿它证明 L6 接触。 |
| [transmission-W40](transmission-W40.svg) | 中灰细纹组和主结构组。40 为本图采用的局部测试尺度（当 W=40 时可令 S=W）；其他尺度用 check_clarity.py --svg S 按实际像素重新生成。见[透射门槛](../../references/04-clarity-gate.md)。 |
| [neutral-flat](neutral-flat.svg) | 均匀底，对照 L4 是否整体变色、L5 的亮暗分布以及 L6 是否无故触发。 |

推荐固定中心 (360, 240)。大圆角矩形可从 460×280、圆角 48 开始，胶囊可从 278×86 开始，圆形可从直径 200 开始；这些仅是画布上的测试布置，不是组件默认值。移动测试可从中心横向往返 80 px，展开测试按 0/25/50/75/100% 取帧。若需要让橘蓝尾刚好相遇或建立 L6 三个触发反例，移动轮廓或制作同场景的单变量标记副本，登记改动；留原底图用于回归。配套底图只是可复跑起点，不能替代实景、L6 实际来光、圆角和时间连续性测试。

可直接复制[验收记录模板](report-template.md)。
