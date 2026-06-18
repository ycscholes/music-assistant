# 曲谱来源记录

## 说明

本目录用于记录曲谱评测 MVP 的首批完整谱面来源。评测运行时不直接解析 PDF/PNG，实际使用的是人工整理后的本地静态音符序列。

运行时不直接展示这些 PDF/PNG；小程序内的五线谱由 `miniprogram/utils/score-practice/piece-library.js` 的本地 `notes` 数据渲染。

## 下载状态

当前仓库已保存 3 首测试曲目的完整谱源，不再只记录选段来源：

- `b-major-scale-violin.jpg`
- `g-minor-scale-violin.jpg`
- `twinkle-twinkle-public-domain.png`
- `vivaldi-lestro-armonico-op3-rv356-mutopia-a4-pdfs.zip`
- `vivaldi-lestro-armonico-op3-rv356-mutopia-lys.zip`
- `vivaldi-lestro-armonico-op3-rv356-mutopia-mids.zip`

说明：当前终端沙箱仍无法直接访问本地代理端口，Mutopia ZIP 通过浏览器下载后复制到本目录；Violinspiration 页面直接暴露的是曲目封面 JPG，实际 PDF 下载由弹窗表单承载，未在无需个人信息的链路里暴露；Wikimedia 原 PNG 通过浏览器访问后保存为本地 PNG 谱图备份。

运行时 `notes` 数据已根据可校验谱源更新：

- 小星星使用 Wikimedia 文件页列出的完整 LilyPond 源，整理为 42 个目标音。
- 维瓦尔第使用 Mutopia `6/violinI.mid` 提取 RV356 第一乐章 violin I 声部，整理为 895 个目标音。
- 音阶组合按 B 大调、g 和声小调、g 旋律小调及对应主和弦琶音规则整理为完整练习序列；本地保存的 Violinspiration JPG 仅作为来源页面封面备份。

## 曲目

### 1. 练习音阶组合

- 曲目：B 大调音阶
- 来源页面：https://violinspiration.com/b-major-scales-arpeggios-violin-sheet-music/
- 目标文件名：`b-major-scale-violin.jpg`
- 直接谱图：https://violinspiration.com/wp-content/uploads/B-Major-Scales-Arpeggios-violin-sheet-music.jpg
- 下载日期：2026-05-06
- 文件格式：JPG
- 谱源范围：完整 B 大调音阶与琶音谱面来源
- 备注：页面公开 JPG 为封面图；应用内 `notes` 使用 B 大调音阶上下行与主和弦琶音上下行。

- 曲目：g 小调音阶
- 来源页面：https://violinspiration.com/g-minor-scales-arpeggios-violin-sheet-music-tutorial/
- 目标文件名：`g-minor-scale-violin.jpg`
- 直接谱图：https://violinspiration.com/wp-content/uploads/G-Minor-Scales-and-arpeggios-violin-sheet-music.jpg
- 下载日期：2026-05-06
- 文件格式：JPG
- 谱源范围：完整 g 小调音阶与琶音谱面来源
- 备注：页面公开 JPG 为封面图；应用内 `notes` 使用 g 和声小调、g 旋律小调与 g 小调主和弦琶音。

### 2. 维瓦尔第 a 小调协奏曲

- 曲目：Violin Concerto in A minor, RV 356
- 来源页面：https://imslp.org/wiki/Violin_Concerto_in_A_minor%2C_RV_356_%28Vivaldi%2C_Antonio%29
- 目标文件名：`vivaldi-rv356-imslp.pdf`
- 下载日期：2026-05-06
- 文件格式：PDF
- 谱源范围：完整作品页面，包含完整谱面文件入口
- 备注：作为人工校对 RV356 的参考入口；本次已落盘的完整谱源使用下方 Mutopia PDF/LilyPond/MIDI 打包文件。

- 曲目：L'estro Armonico, Op. 3（包含 RV356）
- 来源页面：https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2048
- 目标文件名：
  - `vivaldi-lestro-armonico-op3-rv356-mutopia-a4-pdfs.zip`
  - `vivaldi-lestro-armonico-op3-rv356-mutopia-lys.zip`
  - `vivaldi-lestro-armonico-op3-rv356-mutopia-mids.zip`
- 下载 URL：
  - https://www.mutopiaproject.org/ftp/VivaldiA/O3/vivaldi-o3/vivaldi-o3-a4-pdfs.zip
  - https://www.mutopiaproject.org/ftp/VivaldiA/O3/vivaldi-o3/vivaldi-o3-lys.zip
  - https://www.mutopiaproject.org/ftp/VivaldiA/O3/vivaldi-o3/vivaldi-o3-mids.zip
- 下载日期：2026-05-06
- 文件格式：ZIP（PDF / LilyPond / MIDI）
- 授权：Mutopia Project 分发页面标注的许可为准
- 谱源范围：完整 Op. 3 打包源，可用于提取 RV356 完整谱面、LilyPond 和 MIDI
- 下载状态：已下载并通过 `unzip -t` 校验

### 3. 小星星 Twinkle Twinkle Little Star

- 曲目：Twinkle Twinkle Little Star
- 来源页面：https://commons.wikimedia.org/wiki/File:Twinkle_Twinkle_Sheet_Music.png
- 原始谱图：https://upload.wikimedia.org/wikipedia/commons/9/90/Twinkle_Twinkle_Sheet_Music.png
- LilyPond 源：同一 Wikimedia Commons 文件页的源代码区
- 目标文件名：`twinkle-twinkle-public-domain.png`
- 下载日期：2026-05-06
- 文件格式：PNG
- 授权：Public domain（Wikimedia Commons 文件页标注作者将作品释入公有领域）
- 谱源范围：完整公有领域儿歌曲谱图片与 LilyPond 源
- 备注：已保存本地 PNG 谱图备份。

## 可复现下载命令

在具备公网访问的环境中，可以从仓库根目录执行以下命令补齐完整谱源文件：

```bash
mkdir -p docs/sources/sheet-music

curl -L -o docs/sources/sheet-music/vivaldi-lestro-armonico-op3-rv356-mutopia-a4-pdfs.zip \
  https://www.mutopiaproject.org/ftp/VivaldiA/O3/vivaldi-o3/vivaldi-o3-a4-pdfs.zip
curl -L -o docs/sources/sheet-music/vivaldi-lestro-armonico-op3-rv356-mutopia-lys.zip \
  https://www.mutopiaproject.org/ftp/VivaldiA/O3/vivaldi-o3/vivaldi-o3-lys.zip
curl -L -o docs/sources/sheet-music/vivaldi-lestro-armonico-op3-rv356-mutopia-mids.zip \
  https://www.mutopiaproject.org/ftp/VivaldiA/O3/vivaldi-o3/vivaldi-o3-mids.zip

curl -L -o docs/sources/sheet-music/b-major-scale-violin.jpg \
  https://violinspiration.com/wp-content/uploads/B-Major-Scales-Arpeggios-violin-sheet-music.jpg
curl -L -o docs/sources/sheet-music/g-minor-scale-violin.jpg \
  https://violinspiration.com/wp-content/uploads/G-Minor-Scales-and-arpeggios-violin-sheet-music.jpg
curl -L -o docs/sources/sheet-music/twinkle-twinkle-public-domain.png \
  https://upload.wikimedia.org/wikipedia/commons/9/90/Twinkle_Twinkle_Sheet_Music.png
```

## 本地化约束

- 下载后的原始谱面应保留在本目录。
- 曲目若经过裁剪或重编排，需要在后续提交中追加说明。
- 应用内置曲目以 `miniprogram/utils/score-practice/piece-library.js` 为准。
