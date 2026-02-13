# Twitch_AutoGameStatusUpdate

Twitch 遊戲狀態自動更新 ── 串接 Steam API 偵測目前遊戲，自動更新 StreamElements 的 `!遊戲` 指令內容。

## 線上使用

**https://marsantony.github.io/Twitch_AutoGameStatusUpdate/**

## 功能

- **Steam 遊戲偵測** ── 透過 Google Cloud Function 取得目前 Steam 遊戲狀態
- **StreamElements 指令更新** ── 自動修改 `!遊戲` 指令的回覆內容
- **自訂 Template** ── 使用 `{game}` 佔位符，自訂指令回覆格式
- **定時自動更新** ── 每 5 分鐘自動偵測並更新
- **立即更新** ── 手動觸發一次性更新
- **背景執行** ── 使用 HackTimer 避免瀏覽器分頁閒置時計時器被節流

## 使用方式

1. 前往 [StreamElements](https://streamelements.com/dashboard/account/channels) 取得 JWT 金鑰
2. 輸入 JWT 金鑰
3. 設定 `!遊戲指令 Template`，使用 `{game}` 作為遊戲名稱佔位符
4. 選擇「立即更新」或「開始自動更新」

## 技術

- [StreamElements API](https://dev.streamelements.com/) ── 聊天室指令管理
- Steam Cloud Function ── 取得 Steam 遊戲狀態
- [HackTimer](https://github.com/nickvdp/nickvdp.github.io) ── 避免背景分頁計時器節流
- Bootstrap 5 ── UI 介面
- LocalStorage ── 記住 JWT 金鑰與 Template 設定
