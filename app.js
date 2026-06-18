/* ==========================================================================
   WealthPath Core Application Logic - Portfolio Tracker
   ========================================================================== */

// --- Constants & Global State ---
const LOCAL_STORAGE_KEY = 'wealthpath_portfolio_data';
const THEME_STORAGE_KEY = 'wealthpath_color_theme';
const GITHUB_TOKEN_KEY = 'wealthpath_github_token';
const GITHUB_GIST_KEY = 'wealthpath_github_gist_id';

let state = {
    holdings: {},    // symbol -> { symbol, name, transactions: [], manualPrice: null, currentPrice: 0, changePercent: 0 }
    colorTheme: 'intl' // 'intl' (green-up, red-down) or 'tw' (red-up, green-down)
};

let syncState = {
    token: localStorage.getItem(GITHUB_TOKEN_KEY) || null,
    gistId: localStorage.getItem(GITHUB_GIST_KEY) || null,
    isSyncing: false,
    lastSyncTime: null
};

// Global Chart references to allow destroying/rebuilding on data change
let allocationChartInstance = null;
let costValueChartInstance = null;
let performanceChartInstance = null;

// --- DOM Cache ---
const DOM = {
    body: document.body,
    // Metrics
    totalValue: document.getElementById('val-total-value'),
    totalCost: document.getElementById('val-total-cost'),
    totalProfit: document.getElementById('val-total-profit'),
    totalRoi: document.getElementById('val-total-roi'),
    subTotalProfit: document.getElementById('sub-total-profit'),
    subTotalRoi: document.getElementById('sub-total-roi'),
    
    // Holdings list
    tbody: document.getElementById('holdings-tbody'),
    search: document.getElementById('holdings-search'),
    sort: document.getElementById('holdings-sort'),
    
    // Theme & Sync Actions
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    btnSyncPanel: document.getElementById('btn-sync-panel'),
    btnExportJson: document.getElementById('btn-export-json'),
    inputImportJson: document.getElementById('input-import-json'),
    btnFileMock: document.querySelector('.btn-file-mock'),
    
    // Add Transaction Modal
    modalTx: document.getElementById('modal-transaction'),
    btnTxTrigger: document.getElementById('btn-add-transaction-trigger'),
    btnCloseTx: document.getElementById('btn-close-transaction-modal'),
    btnCancelTx: document.getElementById('btn-cancel-transaction'),
    formTx: document.getElementById('form-transaction'),
    btnFetchPreview: document.getElementById('btn-fetch-preview'),
    
    // Edit Stock Modal
    modalEdit: document.getElementById('modal-edit-stock'),
    btnCloseEdit: document.getElementById('btn-close-edit-stock-modal'),
    btnCancelEdit: document.getElementById('btn-cancel-edit-stock'),
    formEdit: document.getElementById('form-edit-stock'),
    
    // Sync Modal
    modalSync: document.getElementById('modal-sync'),
    btnCloseSync: document.getElementById('btn-close-sync-modal'),
    btnCloseSyncFooter: document.getElementById('btn-close-sync-footer'),
    
    // Toast Container
    toastContainer: document.getElementById('toast-container'),

    // GitHub Sync UI elements
    syncTabs: document.querySelectorAll('.sync-tab-btn'),
    syncTabContents: document.querySelectorAll('.sync-tab-content'),
    githubUnlinkedState: document.getElementById('github-unlinked-state'),
    githubLinkedState: document.getElementById('github-linked-state'),
    formGithubSetup: document.getElementById('form-github-setup'),
    ghTokenInput: document.getElementById('gh-token'),
    ghGistIdInput: document.getElementById('gh-gist-id'),
    displayGistId: document.getElementById('display-gist-id'),
    displaySyncTime: document.getElementById('display-sync-time'),
    syncQrcode: document.getElementById('sync-qrcode'),
    btnCopySyncLink: document.getElementById('btn-copy-sync-link'),
    btnSyncNow: document.getElementById('btn-sync-now'),
    btnDisconnectGithub: document.getElementById('btn-disconnect-github')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    
    // 檢查是否有來自 QR Code 的同步參數
    checkUrlSyncParams();
    
    loadPortfolioData();
    setupEventListeners();
    setupSyncUI();
    
    // Trigger initial calculation and render
    calculatePortfolio();
    updateUI();
    
    // Auto-fetch latest stock prices at startup (delay slightly to prevent blocking main UI thread)
    setTimeout(refreshAllPrices, 1000);
    
    // 如果已連結 GitHub，在啟動後背景自動同步拉取最新資料
    if (syncState.token && syncState.gistId) {
        setTimeout(syncWithGithub, 1500);
    }
});

// --- Theme Management ---
function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'intl';
    state.colorTheme = savedTheme;
    if (savedTheme === 'tw') {
        DOM.body.classList.add('color-theme-tw');
        DOM.btnThemeToggle.querySelector('span').textContent = '台股配色 (紅漲綠跌)';
    } else {
        DOM.body.classList.remove('color-theme-tw');
        DOM.btnThemeToggle.querySelector('span').textContent = '美股配色 (綠漲紅跌)';
    }
}

function toggleTheme() {
    if (state.colorTheme === 'intl') {
        state.colorTheme = 'tw';
        DOM.body.classList.add('color-theme-tw');
        DOM.btnThemeToggle.querySelector('span').textContent = '台股配色 (紅漲綠跌)';
        showToast('已切換為台股配色（紅漲綠跌）', 'info');
    } else {
        state.colorTheme = 'intl';
        DOM.body.classList.remove('color-theme-tw');
        DOM.btnThemeToggle.querySelector('span').textContent = '美股配色 (綠漲紅跌)';
        showToast('已切換為美股/國際配色（綠漲紅跌）', 'info');
    }
    localStorage.setItem(THEME_STORAGE_KEY, state.colorTheme);
    // Re-render because charts rely on theme variables
    updateUI();
}

// 檢查是否有來自 QR Code 的同步參數
function checkUrlSyncParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('t');
    const gistId = urlParams.get('g');
    
    if (token && gistId) {
        // 儲存金鑰與 Gist ID
        syncState.token = token;
        syncState.gistId = gistId;
        localStorage.setItem(GITHUB_TOKEN_KEY, token);
        localStorage.setItem(GITHUB_GIST_KEY, gistId);
        
        // 立即清除網址中的參數，確保安全與美觀
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        showToast('已成功從 QR Code 載入雲端同步設定！', 'success');
    }
}


// --- Data Persistence ---
function savePortfolioData() {
    // 永遠先存在本地備份
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.holdings));
    
    // 如果有連結 GitHub，在資料變更時自動同步上傳
    if (syncState.token && syncState.gistId) {
        saveToGithubDebounced();
    }
}

// 避免頻繁發送 API 請求的防抖機制
let debounceTimer = null;
function saveToGithubDebounced() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        uploadToGithub();
    }, 2000); // 停止操作 2 秒後上傳
}

// 將資料上傳到 GitHub Gist
async function uploadToGithub() {
    if (!syncState.token || !syncState.gistId) return;
    
    try {
        const response = await fetch(`https://api.github.com/gists/${syncState.gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${syncState.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: '富足軌跡 WealthPath Stock Portfolio Data',
                files: {
                    'portfolio.json': {
                        content: JSON.stringify(state.holdings, null, 2)
                    }
                }
            })
        });
        
        if (response.ok) {
            syncState.lastSyncTime = new Date();
            updateSyncTimeDisplay();
            console.log('Successfully synced to GitHub Gist');
        } else {
            const errData = await response.json();
            console.error('Failed to sync to GitHub Gist:', errData);
            showToast('自動雲端同步失敗，請檢查 Token 權限', 'error');
        }
    } catch (e) {
        console.error('Network error during Gist patch:', e);
    }
}

// 從 GitHub Gist 下載資料
async function syncWithGithub() {
    if (!syncState.token || !syncState.gistId) return;
    
    showToast('正在與雲端同步資料...', 'info');
    
    try {
        const response = await fetch(`https://api.github.com/gists/${syncState.gistId}`, {
            method: 'GET',
            headers: {
                'Authorization': `token ${syncState.token}`
            }
        });
        
        if (response.ok) {
            const gist = await response.json();
            const file = gist.files['portfolio.json'];
            if (file && file.content) {
                const cloudHoldings = JSON.parse(file.content);
                
                if (typeof cloudHoldings === 'object' && cloudHoldings !== null) {
                    state.holdings = cloudHoldings;
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.holdings));
                    
                    calculatePortfolio();
                    updateUI();
                    
                    syncState.lastSyncTime = new Date();
                    updateSyncTimeDisplay();
                    showToast('已從雲端載入最新投資記錄！', 'success');
                }
            }
        } else if (response.status === 404) {
            showToast('雲端資料夾不存在 (404)，請檢查 Gist ID 是否正確', 'error');
        } else {
            showToast('讀取雲端資料失敗，請檢查權杖權限', 'error');
        }
    } catch (e) {
        console.error('Network error during Gist get:', e);
        showToast('無法連接雲端，暫時使用本地記錄', 'info');
    }
}

// 連結/建立 GitHub 雲端帳本
async function setupGithubCloud(token, existingGistId) {
    if (!token) {
        showToast('請輸入 GitHub 個人存取權杖 (PAT)', 'error');
        return;
    }
    
    showToast('正在驗證與連結 GitHub 雲端...', 'info');
    
    try {
        if (existingGistId) {
            // 嘗試讀取現有的 Gist
            const response = await fetch(`https://api.github.com/gists/${existingGistId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${token}`
                }
            });
            
            if (response.ok) {
                const gist = await response.json();
                const file = gist.files['portfolio.json'];
                if (file && file.content) {
                    if (confirm('已成功找到雲端帳本！是否使用雲端資料覆蓋本地資料？\n（若選「是」將會匯入雲端資料；選「否」則使用目前本地資料覆蓋雲端）')) {
                        state.holdings = JSON.parse(file.content);
                        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.holdings));
                    } else {
                        // 使用本地資料覆蓋雲端
                        syncState.token = token;
                        syncState.gistId = existingGistId;
                        await uploadToGithub();
                    }
                }
                
                syncState.token = token;
                syncState.gistId = existingGistId;
                localStorage.setItem(GITHUB_TOKEN_KEY, token);
                localStorage.setItem(GITHUB_GIST_KEY, existingGistId);
                
                syncState.lastSyncTime = new Date();
                calculatePortfolio();
                updateUI();
                setupSyncUI();
                showToast('雲端連結成功！', 'success');
            } else {
                showToast('連結失敗：找不到該 Gist ID，請檢查是否正確或留空自動建立。', 'error');
            }
        } else {
            // 自動建立新的私密 Gist
            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: '富足軌跡 WealthPath Stock Portfolio Data',
                    public: false,
                    files: {
                        'portfolio.json': {
                            content: JSON.stringify(state.holdings, null, 2)
                        }
                    }
                })
            });
            
            if (response.ok) {
                const gist = await response.json();
                const newGistId = gist.id;
                
                syncState.token = token;
                syncState.gistId = newGistId;
                localStorage.setItem(GITHUB_TOKEN_KEY, token);
                localStorage.setItem(GITHUB_GIST_KEY, newGistId);
                
                syncState.lastSyncTime = new Date();
                setupSyncUI();
                showToast('已在您的 GitHub 建立私密雲端帳本，連結成功！', 'success');
            } else {
                const err = await response.json();
                console.error('Gist creation failed:', err);
                showToast('建立雲端帳本失敗，請確認 Token 是否勾選 gist 權限', 'error');
            }
        }
    } catch (e) {
        console.error('Setup cloud failed:', e);
        showToast('與 GitHub API 連線失敗，請檢查網路連線', 'error');
    }
}

// 管理同步介面狀態
function setupSyncUI() {
    if (syncState.token && syncState.gistId) {
        DOM.githubUnlinkedState.style.display = 'none';
        DOM.githubLinkedState.style.display = 'block';
        DOM.displayGistId.textContent = syncState.gistId;
        updateSyncTimeDisplay();
        generateSyncQrCode();
    } else {
        DOM.githubUnlinkedState.style.display = 'block';
        DOM.githubLinkedState.style.display = 'none';
        DOM.ghTokenInput.value = '';
        DOM.ghGistIdInput.value = '';
    }
}

function updateSyncTimeDisplay() {
    if (syncState.lastSyncTime) {
        const timeStr = syncState.lastSyncTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        DOM.displaySyncTime.textContent = `已於 ${timeStr} 完成同步`;
    } else {
        DOM.displaySyncTime.textContent = '隨時自動同步';
    }
}

// 產生 iPhone 同步 QR Code
function generateSyncQrCode() {
    const cleanUrl = window.location.href.split('?')[0];
    
    // 若為本地 file:// 開啟
    if (cleanUrl.startsWith('file://')) {
        DOM.syncQrcode.innerHTML = `
            <div class="qr-placeholder" style="color: #ef4444; text-align: center; padding: 10px;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px;"></i>
                <p style="margin-top: 6px; font-size: 11px; line-height: 1.5;">本地檔案開啟模式<br>無法產生 iPhone 同步 QR Code。<br>請將專案託管至 GitHub Pages 後，由網址開啟即可使用掃描同步！</p>
            </div>
        `;
        return;
    }
    
    // 生成包含 t (token) 和 g (gistId) 的短網址以簡化 QR 碼複雜度
    const syncUrl = `${cleanUrl}?t=${syncState.token}&g=${syncState.gistId}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(syncUrl)}`;
    
    DOM.syncQrcode.innerHTML = `
        <img src="${qrApiUrl}" alt="iPhone Sync QR Code" title="使用 iPhone 鏡頭掃描即可自動同步此帳本">
    `;
    
    DOM.btnCopySyncLink.onclick = () => {
        navigator.clipboard.writeText(syncUrl).then(() => {
            showToast('同步網址已複製到剪貼簿！', 'success');
        }).catch(() => {
            // fallback
            const el = document.createElement('textarea');
            el.value = syncUrl;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            showToast('同步網址已複製到剪貼簿！', 'success');
        });
    };
}


function loadPortfolioData() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
        try {
            state.holdings = JSON.parse(saved);
        } catch (e) {
            console.error('Error parsing portfolio data:', e);
            state.holdings = {};
        }
    } else {
        // Pre-populate with beautiful example data so user has immediate visualizations
        state.holdings = {
            '2330.TW': {
                symbol: '2330.TW',
                name: '台積電 (範例)',
                manualPrice: null,
                currentPrice: 925.0,
                changePercent: 1.25,
                transactions: [
                    { id: 'ex-1', type: 'buy', date: '2025-01-15', price: 620.0, shares: 1000, fee: 884, tax: 0 }
                ]
            },
            'AAPL': {
                symbol: 'AAPL',
                name: 'Apple Inc. (範例)',
                manualPrice: null,
                currentPrice: 198.5,
                changePercent: -0.45,
                transactions: [
                    { id: 'ex-2', type: 'buy', date: '2025-02-10', price: 172.3, shares: 30, fee: 5, tax: 0 }
                ]
            },
            '0050.TW': {
                symbol: '0050.TW',
                name: '元大台灣50 (範例)',
                manualPrice: null,
                currentPrice: 168.0,
                changePercent: 0.85,
                transactions: [
                    { id: 'ex-3', type: 'buy', date: '2025-03-05', price: 142.0, shares: 2000, fee: 405, tax: 0 },
                    { id: 'ex-4', type: 'sell', date: '2025-05-12', price: 160.0, shares: 500, fee: 114, tax: 240 }
                ]
            }
        };
        savePortfolioData();
    }
}

// --- Stock Price Fetching (Yahoo Finance + CORS Proxy) ---

const STOCK_NAME_MAP = {
    // Taiwan Stocks
    '2330.TW': '台積電',
    '0050.TW': '元大台灣50',
    '0056.TW': '元大高股息',
    '00631L.TW': '元大台灣50正2',
    '00632R.TW': '元大台灣50反1',
    '2454.TW': '聯發科',
    '2317.TW': '鴻海',
    '2308.TW': '台達電',
    '2881.TW': '富邦金',
    '2882.TW': '國泰金',
    '2891.TW': '中信金',
    '00878.TW': '國泰永續高股息',
    '00919.TW': '群益台灣精選高息',
    '00929.TW': '復華台灣科技優息',
    '2303.TW': '聯電',
    '2603.TW': '長榮',
    '2609.TW': '陽明',
    '2615.TW': '萬海',
    // US Stocks
    'AAPL': '蘋果公司 (Apple)',
    'TSLA': '特斯拉 (Tesla)',
    'NVDA': '輝達 (NVIDIA)',
    'MSFT': '微軟 (Microsoft)',
    'AMZN': '亞馬遜 (Amazon)',
    'GOOG': '谷歌 (Alphabet)',
    'GOOGL': '谷歌 (Alphabet)',
    'META': 'Meta (Facebook)',
    'NFLX': '網飛 (Netflix)',
    'TSM': '台積電 ADR (TSM)',
    'VOO': 'Vanguard S&P 500 ETF',
    'QQQ': 'Invesco QQQ Trust'
};

/**
 * Try to clean user-input symbol to match Yahoo Finance format
 */
function normalizeSymbol(symbol) {
    let clean = symbol.trim().toUpperCase();
    // If it starts with a digit and doesn't already have a dot suffix, default to Taiwan Stock Exchange (.TW)
    // This supports Taiwan stock/ETF codes containing letters, like 00631L or 00632R
    if (/^\d/.test(clean) && !clean.includes('.')) {
        return `${clean}.TW`;
    }
    return clean;
}

/**
 * Fetch quote from Yahoo Finance using CORS proxies
 */
async function fetchStockData(symbol) {
    const normalized = normalizeSymbol(symbol);
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${normalized}`;
    
    // We implement sequential requests using different proxies to bypass CORS
    const proxies = [
        // Proxy 1: corsproxy.io direct format
        `https://corsproxy.io/?${encodeURIComponent(chartUrl)}`,
        // Proxy 2: corsproxy.io with url parameter
        `https://corsproxy.io/?url=${encodeURIComponent(chartUrl)}`,
        // Proxy 3: allorigins.win raw mode (faster and doesn't wrap in JSON)
        `https://api.allorigins.win/raw?url=${encodeURIComponent(chartUrl)}`
    ];

    // Try each proxy sequentially
    for (let i = 0; i < proxies.length; i++) {
        try {
            const response = await fetch(proxies[i]);
            if (response.ok) {
                const data = await response.json();
                const quote = parseYahooChart(data);
                if (quote) return quote;
            }
        } catch (e) {
            console.warn(`Proxy ${i + 1} failed for ${normalized}:`, e);
        }
    }

    // If it's a Taiwanese stock ending with .TW and failed, try OTC suffix (.TWO)
    if (normalized.endsWith('.TW')) {
        const otcSymbol = normalized.replace('.TW', '.TWO');
        const otcChartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${otcSymbol}`;
        const otcProxies = [
            `https://corsproxy.io/?${encodeURIComponent(otcChartUrl)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(otcChartUrl)}`
        ];
        
        for (let i = 0; i < otcProxies.length; i++) {
            try {
                const response = await fetch(otcProxies[i]);
                if (response.ok) {
                    const data = await response.json();
                    const quote = parseYahooChart(data);
                    if (quote) {
                        quote.symbol = otcSymbol; // update to OTC symbol
                        return quote;
                    }
                }
            } catch (e) {
                console.warn(`OTC Proxy ${i + 1} failed for ${otcSymbol}:`, e);
            }
        }
    }

    return null;
}

function parseYahooChart(data) {
    try {
        if (data && data.chart && data.chart.result && data.chart.result.length > 0) {
            const result = data.chart.result[0];
            const meta = result.meta;
            if (meta) {
                // Get price (fallback chain)
                const price = meta.regularMarketPrice !== undefined && meta.regularMarketPrice !== null
                    ? meta.regularMarketPrice 
                    : (meta.chartPreviousClose || 0);
                    
                const prevClose = meta.previousClose !== undefined && meta.previousClose !== null
                    ? meta.previousClose 
                    : (meta.chartPreviousClose || price);
                    
                const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
                
                const symbolKey = meta.symbol.toUpperCase();
                let name = STOCK_NAME_MAP[symbolKey] || meta.longName || meta.shortName || meta.symbol;
                
                return {
                    symbol: meta.symbol,
                    name: name,
                    price: price,
                    changePercent: changePercent
                };
            }
        }
    } catch (e) {
        console.error('Error parsing Yahoo chart response:', e);
    }
    return null;
}

/**
 * Refresh prices of all stocks in portfolio
 */
async function refreshAllPrices() {
    const symbols = Object.keys(state.holdings);
    if (symbols.length === 0) return;
    
    showToast('正在更新最新股價...', 'info');
    let successCount = 0;
    
    for (const symbol of symbols) {
        const data = await fetchStockData(symbol);
        if (data) {
            state.holdings[symbol].currentPrice = data.price;
            state.holdings[symbol].changePercent = data.changePercent;
            // Only update name if it wasn't manually edited or is empty
            if (!state.holdings[symbol].name || state.holdings[symbol].name.includes('(範例)')) {
                state.holdings[symbol].name = data.name;
            }
            successCount++;
        }
    }
    
    if (successCount > 0) {
        calculatePortfolio();
        updateUI();
        savePortfolioData();
        showToast(`成功更新 ${successCount} 檔持股即時現價`, 'success');
    } else {
        showToast('無法取得即時行情，請檢查網路連線或稍後再試', 'error');
    }
}

// --- Portfolio Calculation Logic ---
function calculatePortfolio() {
    let portfolioTotalValue = 0;
    let portfolioTotalCost = 0;
    
    for (const symbol in state.holdings) {
        const stock = state.holdings[symbol];
        
        // Sort transactions chronologically
        stock.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let shares = 0;
        let totalInvestedCost = 0;
        let avgCost = 0;
        let realizedProfit = 0;
        
        // Calculate average cost and shares dynamically based on transaction history
        stock.transactions.forEach(tx => {
            const price = parseFloat(tx.price);
            const txShares = parseFloat(tx.shares);
            const fee = parseFloat(tx.fee || 0);
            const tax = parseFloat(tx.tax || 0);
            
            if (tx.type === 'buy') {
                const costOfTx = (price * txShares) + fee;
                totalInvestedCost += costOfTx;
                shares += txShares;
                avgCost = shares > 0 ? (totalInvestedCost / shares) : 0;
            } else if (tx.type === 'sell') {
                const revenueOfTx = (price * txShares) - fee - tax;
                const costOfSoldShares = avgCost * txShares;
                
                shares = Math.max(0, shares - txShares);
                totalInvestedCost = shares * avgCost; // Cost basis shrinks based on remaining shares
                realizedProfit += (revenueOfTx - costOfSoldShares);
            }
        });
        
        // Store calculated metrics
        stock.shares = shares;
        stock.avgCost = avgCost;
        stock.totalInvestedCost = totalInvestedCost;
        stock.realizedProfit = realizedProfit;
        
        // Determine active price (manual overwrite takes precedence)
        const activePrice = (stock.manualPrice !== null && stock.manualPrice !== undefined && stock.manualPrice !== '') 
            ? parseFloat(stock.manualPrice) 
            : stock.currentPrice;
            
        stock.activePrice = activePrice;
        stock.currentValue = shares * activePrice;
        stock.unrealizedProfit = stock.currentValue - totalInvestedCost;
        stock.roi = totalInvestedCost > 0 ? (stock.unrealizedProfit / totalInvestedCost) * 100 : 0;
        
        // Accumulate overall totals (only count stocks with actual shares remaining)
        if (shares > 0) {
            portfolioTotalValue += stock.currentValue;
            portfolioTotalCost += stock.totalInvestedCost;
        }
    }
    
    // Overall metrics
    state.totalValueAmount = portfolioTotalValue;
    state.totalCostAmount = portfolioTotalCost;
    state.totalProfitAmount = portfolioTotalValue - portfolioTotalCost;
    state.totalRoiPercentage = portfolioTotalCost > 0 ? (state.totalProfitAmount / portfolioTotalCost) * 100 : 0;
}

// --- UI Rendering ---
function updateUI() {
    renderMetrics();
    renderHoldingsTable();
    renderCharts();
}

/**
 * Format currency nicely
 */
function formatCurrency(amount, symbol = '$') {
    return `${symbol}${parseFloat(amount).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function renderMetrics() {
    // Value & Cost
    DOM.totalValue.textContent = formatCurrency(state.totalValueAmount);
    DOM.totalCost.textContent = formatCurrency(state.totalCostAmount);
    
    // Profit
    const profit = state.totalProfitAmount;
    DOM.totalProfit.textContent = formatCurrency(profit);
    
    // Profit trend styling
    DOM.totalProfit.className = 'card-value';
    DOM.totalRoi.className = 'card-value';
    
    if (profit > 0.01) {
        DOM.totalProfit.classList.add('up-trend');
        DOM.totalRoi.classList.add('up-trend');
        DOM.subTotalProfit.innerHTML = `<i class="fa-solid fa-caret-up"></i> +${formatCurrency(profit)}`;
        DOM.subTotalProfit.className = 'card-subtext up-trend';
    } else if (profit < -0.01) {
        DOM.totalProfit.classList.add('down-trend');
        DOM.totalRoi.classList.add('down-trend');
        DOM.subTotalProfit.innerHTML = `<i class="fa-solid fa-caret-down"></i> ${formatCurrency(profit)}`;
        DOM.subTotalProfit.className = 'card-subtext down-trend';
    } else {
        DOM.totalProfit.classList.add('neutral-trend');
        DOM.totalRoi.classList.add('neutral-trend');
        DOM.subTotalProfit.textContent = '損益平衡';
        DOM.subTotalProfit.className = 'card-subtext';
    }
    
    // ROI
    DOM.totalRoi.textContent = `${state.totalRoiPercentage.toFixed(2)}%`;
}

function renderHoldingsTable() {
    const searchTerm = DOM.search.value.toLowerCase();
    const sortBy = DOM.sort.value;
    
    // Convert holdings to array for display processing
    let items = Object.values(state.holdings).filter(stock => {
        // Only show stocks with remaining shares, or search matches
        const matchesSearch = stock.symbol.toLowerCase().includes(searchTerm) || stock.name.toLowerCase().includes(searchTerm);
        return matchesSearch;
    });
    
    // Sort array
    items.sort((a, b) => {
        switch (sortBy) {
            case 'value-desc': return b.currentValue - a.currentValue;
            case 'value-asc': return a.currentValue - b.currentValue;
            case 'roi-desc': return b.roi - a.roi;
            case 'roi-asc': return a.roi - b.roi;
            case 'profit-desc': return b.unrealizedProfit - a.unrealizedProfit;
            case 'profit-asc': return a.unrealizedProfit - b.unrealizedProfit;
            case 'symbol': return a.symbol.localeCompare(b.symbol);
            default: return b.currentValue - a.currentValue;
        }
    });
    
    // Clear list
    DOM.tbody.innerHTML = '';
    
    if (items.length === 0) {
        DOM.tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fa-solid fa-magnifying-glass empty-icon"></i>
                    <p>沒有找到符合的持股資料。</p>
                </td>
            </tr>
        `;
        return;
    }
    
    items.forEach(stock => {
        // Skip display of deleted stocks that have 0 shares and no search filter matching
        if (stock.shares <= 0 && searchTerm === '') return;
        
        const row = document.createElement('tr');
        
        // CSS class for styling positive/negative numbers
        const pTrend = stock.unrealizedProfit > 0.01 ? 'up-trend' : (stock.unrealizedProfit < -0.01 ? 'down-trend' : 'neutral-trend');
        const changeSign = stock.unrealizedProfit > 0.01 ? '+' : '';
        const pctSign = stock.changePercent > 0.01 ? '+' : '';
        
        // Check if user is using manual price overwrite
        const isManualText = stock.manualPrice ? '<span class="manual-badge" title="手動覆寫價格">(手動)</span>' : '';
        
        row.innerHTML = `
            <td>
                <div class="stock-badge-col">
                    <span class="stock-symbol">${stock.symbol}</span>
                    <span class="stock-name">${stock.name}</span>
                </div>
            </td>
            <td class="txt-right">
                <div>${formatCurrency(stock.activePrice)}</div>
                <div class="card-subtext ${stock.changePercent > 0.01 ? 'up-trend' : (stock.changePercent < -0.01 ? 'down-trend' : '')}">
                    ${pctSign}${stock.changePercent.toFixed(2)}% ${isManualText}
                </div>
            </td>
            <td class="txt-right">${formatCurrency(stock.avgCost)}</td>
            <td class="txt-right">${parseFloat(stock.shares.toFixed(4)).toLocaleString('zh-TW')}</td>
            <td class="txt-right">${formatCurrency(stock.totalInvestedCost)}</td>
            <td class="txt-right">${formatCurrency(stock.currentValue)}</td>
            <td class="txt-right ${pTrend}">${changeSign}${formatCurrency(stock.unrealizedProfit)}</td>
            <td class="txt-right ${pTrend}">${changeSign}${stock.roi.toFixed(2)}%</td>
            <td class="txt-center">
                <div class="action-group">
                    <button class="btn-icon btn-edit" onclick="openEditStockModal('${stock.symbol}')" title="編輯明細">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteStock('${stock.symbol}')" title="刪除持股">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;
        DOM.tbody.appendChild(row);
    });
}

// --- Interactive Chart Rendering (Chart.js) ---
function renderCharts() {
    // Get colors from CSS variables
    const bodyStyles = getComputedStyle(DOM.body);
    const colorUp = bodyStyles.getPropertyValue('--color-up').trim() || '#10b981';
    const colorDown = bodyStyles.getPropertyValue('--color-down').trim() || '#ef4444';
    const colorNeutral = bodyStyles.getPropertyValue('--color-neutral').trim() || '#94a3b8';
    
    // Filter active holdings with positive shares
    const activeHoldings = Object.values(state.holdings).filter(s => s.shares > 0);
    
    const labels = activeHoldings.map(s => s.name.split(' ')[0]); // Use first part of name for brevity
    const values = activeHoldings.map(s => s.currentValue);
    const costs = activeHoldings.map(s => s.totalInvestedCost);
    const rois = activeHoldings.map(s => s.roi);
    
    // Clean up old charts before rendering new ones to prevent overlaps
    if (allocationChartInstance) allocationChartInstance.destroy();
    if (costValueChartInstance) costValueChartInstance.destroy();
    if (performanceChartInstance) performanceChartInstance.destroy();
    
    if (activeHoldings.length === 0) {
        return; // No charts to render
    }
    
    // Chart options helpers for dark theme styling
    const darkThemeOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: '#f8fafc',
                    font: { family: 'Outfit, Noto Sans TC', size: 12 }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleFont: { family: 'Outfit, Noto Sans TC', size: 13, weight: 'bold' },
                bodyFont: { family: 'Outfit, Noto Sans TC', size: 12 },
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                padding: 10
            }
        }
    };

    // 1. Portfolio Allocation Chart (Doughnut)
    const ctxAlloc = document.getElementById('chart-allocation').getContext('2d');
    allocationChartInstance = new Chart(ctxAlloc, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#7c3aed', '#00f2fe', '#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#f43f5e', '#a855f7'
                ],
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)'
            }]
        },
        options: {
            ...darkThemeOptions,
            plugins: {
                ...darkThemeOptions.plugins,
                legend: {
                    position: 'bottom',
                    labels: { color: '#f8fafc', padding: 15 }
                }
            }
        }
    });

    // 2. Cost vs Current Value Chart (Bar)
    const ctxCostVal = document.getElementById('chart-cost-value').getContext('2d');
    costValueChartInstance = new Chart(ctxCostVal, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '投入成本',
                    data: costs,
                    backgroundColor: 'rgba(148, 163, 184, 0.65)', // Muted grey
                    borderColor: 'rgba(148, 163, 184, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: '資產現值',
                    data: values,
                    backgroundColor: values.map((val, i) => {
                        return val >= costs[i] ? 'rgba(16, 185, 129, 0.75)' : 'rgba(239, 68, 68, 0.75)';
                    }),
                    borderColor: values.map((val, i) => {
                        return val >= costs[i] ? colorUp : colorDown;
                    }),
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            ...darkThemeOptions,
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
            }
        }
    });

    // 3. Individual Return performance chart (ROI Bar)
    const ctxPerf = document.getElementById('chart-performance').getContext('2d');
    performanceChartInstance = new Chart(ctxPerf, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '回報率 (ROI%)',
                data: rois,
                backgroundColor: rois.map(roi => roi >= 0 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(239, 68, 68, 0.75)'),
                borderColor: rois.map(roi => roi >= 0 ? colorUp : colorDown),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            ...darkThemeOptions,
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                y: { 
                    ticks: { color: '#94a3b8', callback: value => `${value}%` }, 
                    grid: { color: 'rgba(255, 255, 255, 0.05)' } 
                }
            }
        }
    });
}

// --- Interaction Modals Controls ---
function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Pick icon
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';
    
    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
    DOM.toastContainer.appendChild(toast);
    
    // Trigger transition
    setTimeout(() => toast.classList.add('show'), 50);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// --- Global Functions attached to window for HTML actions ---
window.openEditStockModal = function(symbol) {
    const stock = state.holdings[symbol];
    if (!stock) return;
    
    document.getElementById('edit-stock-symbol').value = symbol;
    document.getElementById('edit-stock-symbol-display').value = symbol;
    document.getElementById('edit-stock-name').value = stock.name;
    document.getElementById('edit-stock-price').value = stock.manualPrice || '';
    
    openModal(DOM.modalEdit);
};

window.deleteStock = function(symbol) {
    if (confirm(`確定要完全刪除 ${symbol} 及其底下的所有交易明細嗎？此動作無法復原。`)) {
        delete state.holdings[symbol];
        calculatePortfolio();
        updateUI();
        savePortfolioData();
        showToast(`已刪除持股 ${symbol}`, 'success');
    }
};

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Theme Toggle
    DOM.btnThemeToggle.addEventListener('click', toggleTheme);
    
    // Modals Trigger triggers
    DOM.btnTxTrigger.addEventListener('click', () => {
        DOM.formTx.reset();
        document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('tx-preview-total').textContent = '$0';
        openModal(DOM.modalTx);
    });
    
    DOM.btnCloseTx.addEventListener('click', () => closeModal(DOM.modalTx));
    DOM.btnCancelTx.addEventListener('click', () => closeModal(DOM.modalTx));
    
    DOM.btnSyncPanel.addEventListener('click', () => openModal(DOM.modalSync));
    DOM.btnCloseSync.addEventListener('click', () => closeModal(DOM.modalSync));
    DOM.btnCloseSyncFooter.addEventListener('click', () => closeModal(DOM.modalSync));
    
    DOM.btnCloseEdit.addEventListener('click', () => closeModal(DOM.modalEdit));
    DOM.btnCancelEdit.addEventListener('click', () => closeModal(DOM.modalEdit));

    // Form Calculations Preview
    const txPriceInput = document.getElementById('tx-price');
    const txSharesInput = document.getElementById('tx-shares');
    const txFeeInput = document.getElementById('tx-fee');
    const txTaxInput = document.getElementById('tx-tax');
    const txTypeSelect = document.getElementById('tx-type');

    function updateTxPreview() {
        const price = parseFloat(txPriceInput.value) || 0;
        const shares = parseFloat(txSharesInput.value) || 0;
        const fee = parseFloat(txFeeInput.value) || 0;
        const tax = parseFloat(txTaxInput.value) || 0;
        const type = txTypeSelect.value;
        
        let total = 0;
        if (type === 'buy') {
            total = (price * shares) + fee;
        } else {
            total = (price * shares) - fee - tax;
        }
        document.getElementById('tx-preview-total').textContent = formatCurrency(total);
    }

    txPriceInput.addEventListener('input', updateTxPreview);
    txSharesInput.addEventListener('input', updateTxPreview);
    txFeeInput.addEventListener('input', updateTxPreview);
    txTaxInput.addEventListener('input', updateTxPreview);
    txTypeSelect.addEventListener('change', updateTxPreview);

    // Auto-fetch preview in Form
    DOM.btnFetchPreview.addEventListener('click', async () => {
        const symbolInput = document.getElementById('tx-symbol');
        const symbol = symbolInput.value.trim();
        if (!symbol) {
            showToast('請先輸入股票代號', 'error');
            return;
        }
        
        DOM.btnFetchPreview.disabled = true;
        DOM.btnFetchPreview.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 載入中';
        
        const data = await fetchStockData(symbol);
        
        DOM.btnFetchPreview.disabled = false;
        DOM.btnFetchPreview.innerHTML = '<i class="fa-solid fa-rotate"></i> 查詢';
        
        if (data) {
            document.getElementById('tx-name').value = data.name;
            document.getElementById('tx-price').value = data.price;
            updateTxPreview();
            showToast(`成功讀取：${data.name} (最新市價 ${data.price})`, 'success');
        } else {
            showToast('無法自動搜尋到該股票。請手動輸入股名與價格。', 'info');
        }
    });

    // Form Submissions
    DOM.formTx.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const rawSymbol = document.getElementById('tx-symbol').value.trim();
        const symbol = normalizeSymbol(rawSymbol);
        const name = document.getElementById('tx-name').value.trim();
        const type = document.getElementById('tx-type').value;
        const date = document.getElementById('tx-date').value;
        const price = parseFloat(document.getElementById('tx-price').value);
        const shares = parseFloat(document.getElementById('tx-shares').value);
        const fee = parseFloat(document.getElementById('tx-fee').value) || 0;
        const tax = parseFloat(document.getElementById('tx-tax').value) || 0;
        
        if (!state.holdings[symbol]) {
            state.holdings[symbol] = {
                symbol: symbol,
                name: name,
                manualPrice: null,
                currentPrice: price,
                changePercent: 0,
                transactions: []
            };
        }
        
        const txId = 'tx-' + Date.now();
        state.holdings[symbol].transactions.push({
            id: txId,
            type: type,
            date: date,
            price: price,
            shares: shares,
            fee: fee,
            tax: tax
        });
        
        calculatePortfolio();
        updateUI();
        savePortfolioData();
        closeModal(DOM.modalTx);
        showToast('已成功儲存該筆交易明細', 'success');
    });

    DOM.formEdit.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const symbol = document.getElementById('edit-stock-symbol').value;
        const newName = document.getElementById('edit-stock-name').value.trim();
        const manualPriceVal = document.getElementById('edit-stock-price').value;
        
        if (state.holdings[symbol]) {
            state.holdings[symbol].name = newName;
            state.holdings[symbol].manualPrice = manualPriceVal !== '' ? parseFloat(manualPriceVal) : null;
            
            calculatePortfolio();
            updateUI();
            savePortfolioData();
            closeModal(DOM.modalEdit);
            showToast(`已更新 ${symbol} 的持股參數`, 'success');
        }
    });

    // Search and Sort bindings
    DOM.search.addEventListener('input', renderHoldingsTable);
    DOM.sort.addEventListener('change', renderHoldingsTable);
    
    // Chart Tab toggles
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.chart-view').forEach(v => v.classList.remove('active'));
            
            tab.classList.add('active');
            const target = tab.dataset.chart;
            document.getElementById(`chart-view-${target}`).classList.add('active');
        });
    });

    // Sync / Backup Exports
    DOM.btnExportJson.addEventListener('click', () => {
        const dataStr = JSON.stringify(state.holdings, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `wealthpath_portfolio_backup_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        showToast('已完成備份檔案下載', 'success');
    });

    // Sync / Backup Import File handler
    DOM.inputImportJson.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const parsed = JSON.parse(event.target.result);
                // Basic validation: ensure parsed data is an object
                if (typeof parsed !== 'object' || parsed === null) {
                    throw new Error('資料格式不正確，應為一個 JSON 物件');
                }
                
                // Confirm with user
                if (confirm('匯入備份將會覆蓋您目前的持股資料。您確定要繼續嗎？')) {
                    state.holdings = parsed;
                    calculatePortfolio();
                    updateUI();
                    savePortfolioData();
                    closeModal(DOM.modalSync);
                    showToast('持股資料匯入成功，已恢復全部投資記錄', 'success');
                }
            } catch (err) {
                console.error(err);
                showToast(`匯入失敗：${err.message || '檔案格式損毀或非合法備份檔'}`, 'error');
            }
        };
        reader.readAsText(file);
    });

    // Link styling handler for file uploads
    DOM.btnFileMock.addEventListener('click', () => {
        DOM.inputImportJson.click();
    });

    // --- GitHub Sync Event Listeners ---
    // Sync Panel Tab switches
    DOM.syncTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            DOM.syncTabs.forEach(t => t.classList.remove('active'));
            DOM.syncTabContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const target = tab.dataset.tab;
            document.getElementById(`tab-${target}`).classList.add('active');
        });
    });

    // GitHub Setup Form Submit
    DOM.formGithubSetup.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = DOM.ghTokenInput.value.trim();
        const gistId = DOM.ghGistIdInput.value.trim();
        
        // 停用按鈕防重複點擊
        const btnSubmit = DOM.formGithubSetup.querySelector('button[type="submit"]');
        const originalText = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 連結中...';
        
        await setupGithubCloud(token, gistId);
        
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    });

    // 手動同步按鈕
    DOM.btnSyncNow.addEventListener('click', async () => {
        DOM.btnSyncNow.disabled = true;
        DOM.btnSyncNow.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 同步中...';
        await syncWithGithub();
        DOM.btnSyncNow.disabled = false;
        DOM.btnSyncNow.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> 立即手動同步';
    });

    // 中斷雲端連結按鈕
    DOM.btnDisconnectGithub.addEventListener('click', () => {
        if (confirm('確定要中斷與 GitHub 雲端帳本的連結嗎？這不會刪除您的雲端資料，但您的 Mac 與 iPhone 將不再自動同步。')) {
            syncState.token = null;
            syncState.gistId = null;
            localStorage.removeItem(GITHUB_TOKEN_KEY);
            localStorage.removeItem(GITHUB_GIST_KEY);
            setupSyncUI();
            showToast('已成功中斷雲端連結，回到本地存儲模式', 'success');
        }
    });
}
