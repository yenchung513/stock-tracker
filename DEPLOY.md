# 富足軌跡 WealthPath - 雲端部署與 iPhone 同步指南

本工具是一個**純前端網頁應用**（無須執行任何後端伺服器），透過 **GitHub Pages** 提供網頁存取，並藉由 **GitHub Gist (私密隨手記)** 作為雲端資料庫。

請跟著下方步驟，只需 3 分鐘即可完成您專屬的雲端股票記帳工具，並在 iPhone 上同步查看與編輯！

---

## 步驟 1：取得您的 GitHub 雲端金鑰 (Token)

這個金鑰能讓您的網頁有權限將記帳資料讀寫至您個人的 GitHub 雲端（私密 Gist），確保資料安全且不外流。

1. 登入您的 GitHub 帳號。
2. 點擊此快速連結：[建立新權杖 (Personal Access Token)](https://github.com/settings/tokens/new?scopes=gist&description=WealthPathStockTracker)
   * *(或者手動前往：Settings -> Developer Settings -> Personal Access Tokens -> Tokens (classic) -> Generate new token (classic))*
3. 在設定畫面中：
   * **Note (備註)**：輸入 `WealthPathStockTracker`
   * **Expiration (過期時間)**：建議設定 `No expiration` (永不過期) 或依需求選擇
   * **Select scopes (勾選權限)**：**請務必勾選 `gist`**
4. 滾動到最下方點選 **Generate token (產生權杖)**。
5. **重要**：產生後，複製畫面上 `ghp_` 開頭的一長串字元並妥善保存（離開畫面後就無法再看到它了）。

---

## 步驟 2：部署您的記帳網頁到 GitHub Pages (免費)

1. 在 GitHub 上建立一個新的公開儲存庫 (Public Repository)，命名為 `stock-tracker`（或任何您喜歡的名稱）。
2. 將此資料夾內的 3 個核心檔案上傳至該儲存庫中：
   * `index.html`
   * `style.css`
   * `app.js`
3. 前往該 GitHub 儲存庫的 **Settings (設定)** -> **Pages**。
4. 在 **Build and deployment** 下方的 Branch 選擇 `main` (或 `master`) 分支，資料夾選擇 `/ (root)`，然後點選 **Save**。
5. 等待約 1 分鐘，重新整理頁面，最上方會出現您的專屬網址，例如：
   `https://<您的帳號>.github.io/stock-tracker/`

---

## 步驟 3：在 Mac (電腦端) 啟用雲端同步

1. 使用瀏覽器開啟您剛部署好的專屬網址（例如：`https://<您的帳號>.github.io/stock-tracker/`）。
2. 點選右上角的 **「備份同步」** 按鈕。
3. 在 **「GitHub 雲端同步」** 標籤頁中：
   * 在 **GitHub 個人存取權杖 (PAT)** 欄位中，貼上您在【步驟 1】複製的 `ghp_...` 金鑰。
   * **現有 Gist ID** 欄位留空。
4. 點選 **「啟動 GitHub 雲端同步」**。
5. 系統會自動在您的 GitHub 建立一個私密 Gist，連結成功後會顯示「已成功連結 GitHub 雲端」，並顯示一組 Gist ID。

---

## 步驟 4：在 iPhone (手機端) 同步存取

1. 在電腦畫面的「備份同步」面板中，您會看到一個 **自動產生的 QR Code**。
2. 拿起您的 iPhone，打開內建的**相機**掃描該 QR Code，並在手機瀏覽器（Safari 或 Chrome）中開啟。
3. 手機版網頁會自動載入電腦上完全相同的投資記帳資料！
4. **安心安全**：手機載入後，會自動把金鑰與 ID 儲存在手機本地，並**自動把網址列上的敏感金鑰隱藏**，防止金鑰外洩。

現在，不論您在 Mac 電腦前還是出門在外用 iPhone，只要新增或修改任何一筆股票交易，資料都會自動在雲端同步！

---

## 💡 常見問題與備忘錄

* **股票現價多久更新一次？**
  網頁每次載入或點選「查詢」時，會自動向 Yahoo Finance 取得即時行情（延遲約 15 分鐘）。
* **我可以有多個不同的記帳本嗎？**
  可以！只要在步驟 3 中使用不同的 GitHub Token 或對應不同的 Gist ID，就能連結至不同的私密記帳檔案。
* **資料不小心打錯怎麼辦？**
  持股明細表中，每一列右側都有「編輯」鈕，可以手動修正股票名稱或強制覆寫最新股價；點擊「刪除」會移除該股票的所有交易記錄。
* **若想解除連結？**
  點選「中斷雲端連結」即可恢復成普通的本地儲存模式，您的雲端資料仍會保留在您的 GitHub Gist 中不會遺失。
