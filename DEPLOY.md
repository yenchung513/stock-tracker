# 富足軌跡 WealthPath - 雲端部署與 iPhone 同步指南

本工具是一個**輕量級網頁應用**。為了實現「跨裝置同步」且「穩定獲取即時股價（避開瀏覽器 CORS 限制）」，我們強烈推薦將專案部署到 **Vercel**（完全免費、自動支援後端股價代理，1 分鐘搞定）。

如果您堅持使用 **GitHub Pages**，也可以部署，但由於 GitHub Pages 不支援後端程式，股價將會使用公共代理伺服器抓取（可能因公共代理伺服器擁擠而暫時無法載入）。

---

## 🚀 最佳方案：部署到 Vercel (免費、100% 穩定股價)

Vercel 支援後端 serverless 程式，我們已寫好股價代理程式（`/api/stock-price`），部署後能 100% 穩定取得美股與台股的最新行情，絕不漏接。

### 步驟 1：取得您的 GitHub 雲端金鑰 (Token)
1. 登入您的 GitHub 帳號。
2. 點擊此快速連結：[建立新權杖 (Personal Access Token)](https://github.com/settings/tokens/new?scopes=gist&description=WealthPathStockTracker)
3. 在設定畫面中：
   * **Note (備註)**：輸入 `WealthPathStockTracker`
   * **Expiration**：建議選擇 `No expiration` (永不過期)
   * **Select scopes**：**請務必勾選 `gist`**
4. 點選最下方 **Generate token (產生權杖)**。
5. 複製產生的 `ghp_` 開頭的一長串字元並妥善保存。

### 步驟 2：將專案上傳至 GitHub
1. 在 GitHub 上建立一個新的儲存庫 (Repository)，命名為 `stock-tracker`。
2. 將此資料夾內的所有檔案與資料夾（包含 `api/` 資料夾、`index.html`、`style.css`、`app.js`）上傳至該儲存庫中。

### 步驟 3：連結至 Vercel 進行部署 (免費)
1. 前往 [Vercel 官網 (vercel.com)](https://vercel.com/) 並使用您的 GitHub 帳號登入。
2. 點選 **「Add New...」** -> **「Project」**。
3. 在儲存庫列表中，找到您的 `stock-tracker`，點選 **「Import」**。
4. 在設定頁面中，無須做任何修改，直接點選 **「Deploy」** (部署)。
5. 等待約 30 秒，部署成功！您會獲得一個專屬的網址，例如：`https://stock-tracker-yourname.vercel.app/`

---

## 步驟 4：在電腦端啟用雲端同步
1. 用電腦開啟您剛部署好的 Vercel 專屬網址。
2. 點選右上角的 **「備份同步」** 按鈕。
3. 在 **「GitHub 雲端同步」** 標籤頁中，貼上您在【步驟 1】複製的 `ghp_...` 金鑰，然後點選 **「啟動 GitHub 雲端同步」**。
4. 系統會自動在您的 GitHub 建立一個私密 Gist。連結成功後，網頁會顯示「已成功連結 GitHub 雲端」與一組 Gist ID。

---

## 步驟 5：在 iPhone 手機端同步查看
1. 在電腦的「備份同步」面板中，您會看到一個 **自動產生的 QR Code**。
2. 拿起您的 iPhone，打開相機掃描該 QR Code，並在手機瀏覽器中開啟。
3. 手機版網頁會自動載入電腦上完全相同的投資記帳資料！手機會自動記住金鑰，且網址列上的金鑰會在開啟後**自動隱藏**，保護隱私。

現在，您在 Mac 電腦前或出門在外用 iPhone，只要新增或修改任何股票交易，資料都會在雲端即時同步！

---

## 💡 常見問題與除錯 (Troubleshooting)

* **為什麼在本地直接雙擊 `index.html` (顯示 `file:///...`) 時，股價無法更新？**
  這是因為瀏覽器的 CORS 安全限制，直接以本地檔案開啟時，會被禁止直接存取 Yahoo 股價。請將網頁部署到 Vercel 後，透過 **Vercel 的網址**開啟，即時股價便能完美運作！
* **Vercel 部署是完全免費的嗎？**
  是的！對於個人非商用專案，Vercel 永久免費，且伺服器回應速度極快。
* **如果資料不小心打錯？**
  在持股明細表中，每一列右側都有「編輯」鈕，可以手動修正股票名稱或強制覆寫最新股價；點擊「刪除」會移除該股票的所有交易記錄。
