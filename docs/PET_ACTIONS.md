# QQ 宠物动作一览

宠物动作全部由 **Ruffle** 播放 **xuemian168/qqpet_automation** 提供的 QQ 宠物 `.swf` 文件；以下是 19 个动作的真实运行 GIF（已裁剪到宠物区域，不含会话内容）。

动作选择是随机的：
- 待机：每 8~16 秒可能随机切换待机/玩耍；
- 玩耍：`P1 / P2 / P5 / P13 / P17 / P22 / P27` 中随机；
- 点击宠物：`H1 / H2 / H3 / LF1 / BE1 / BE2 / BE3` 中随机，并附带弹跳 + 爱心；
- 出现选项：`Speak / Speak-peaceful` 中随机，并举起木牌；
- 打开会话：CSS 跑动动画（未使用带背景的 `Enter1.swf`）。

## 待机（3）

| 动作 | 文件 | GIF |
| --- | --- | --- |
| 标准待机 | `Stand.swf` | ![Stand](gifs/actions/Stand.gif) |
| 开心待机 | `Stand-happy.swf` | ![Stand-happy](gifs/actions/Stand-happy.gif) |
| 安静待机 | `Stand-peaceful.swf` | ![Stand-peaceful](gifs/actions/Stand-peaceful.gif) |

## 玩耍（7）

| 动作 | 文件 | GIF |
| --- | --- | --- |
| 泡澡 | `P1.swf` | ![P1](gifs/actions/P1.gif) |
| 玩耍 2 | `P2.swf` | ![P2](gifs/actions/P2.gif) |
| 玩耍 5 | `P5.swf` | ![P5](gifs/actions/P5.gif) |
| 玩耍 13 | `P13.swf` | ![P13](gifs/actions/P13.gif) |
| 玩耍 17 | `P17.swf` | ![P17](gifs/actions/P17.gif) |
| 玩耍 22 | `P22.swf` | ![P22](gifs/actions/P22.gif) |
| 玩耍 27 | `P27.swf` | ![P27](gifs/actions/P27.gif) |

## 点击互动（7）

| 动作 | 文件 | GIF |
| --- | --- | --- |
| 摸头 1 | `H1.swf` | ![H1](gifs/actions/H1.gif) |
| 摸头 2 | `H2.swf` | ![H2](gifs/actions/H2.gif) |
| 摸头 3 | `H3.swf` | ![H3](gifs/actions/H3.gif) |
| 互动 LF1 | `LF1.swf` | ![LF1](gifs/actions/LF1.gif) |
| 互动 BE1 | `BE1.swf` | ![BE1](gifs/actions/BE1.gif) |
| 互动 BE2 | `BE2.swf` | ![BE2](gifs/actions/BE2.gif) |
| 互动 BE3 | `BE3.swf` | ![BE3](gifs/actions/BE3.gif) |

## 说话（2）

| 动作 | 文件 | GIF |
| --- | --- | --- |
| 说话 | `Speak.swf` | ![Speak](gifs/actions/Speak.gif) |
| 安静说话 | `Speak-peaceful.swf` | ![Speak-peaceful](gifs/actions/Speak-peaceful.gif) |

## 组合状态

| 状态 | GIF |
| --- | --- |
| 趴在输入框上待机 | ![idle](gifs/pet-idle.gif) |
| 举牌列选项 | ![sign](gifs/pet-sign.gif) |
| 打开会话跑过输入框 | ![run](gifs/pet-run.gif) |

> 素材版权说明见 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)：QQ 宠物美术/动画归腾讯所有，`qqpet_automation` 为开源移植项目；仅限个人怀旧使用，禁止商用。
