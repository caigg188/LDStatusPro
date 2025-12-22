    // ==UserScript==
    // @name         LDStatus Pro
    // @namespace    http://tampermonkey.net/
    // @version      3.5.0.4
    // @description  在 Linux.do 和 IDCFlare 页面显示信任级别进度，支持历史趋势、里程碑通知、阅读时间统计、排行榜系统、我的活动查看。两站点均支持排行榜和云同步功能
    // @author       JackLiii
    // @license      MIT
    // @match        https://linux.do/*
    // @match        https://idcflare.com/*
    // @run-at       document-start
    // @grant        GM_xmlhttpRequest
    // @grant        GM_setValue    
    // @grant        GM_getValue
    // @grant        GM_info
    // @grant        GM_notification
    // @connect      connect.linux.do
    // @connect      linux.do
    // @connect      connect.idcflare.com
    // @connect      idcflare.com
    // @connect      github.com
    // @connect      raw.githubusercontent.com
    // @connect      https://ldstatus-pro-api.jackcai711.workers.dev
    // @connect      *.workers.dev
    // @updateURL    https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js
    // @downloadURL  https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js
    // @icon         https://linux.do/uploads/default/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png
    // ==/UserScript==

    (function() {
        'use strict';

        // ==================== 尽早捕获 OAuth 登录结果 ====================
        // 由于 Discourse 路由可能会处理掉 URL hash，需要在脚本最开始就提取
        let _pendingOAuthData = null;
        try {
            const hash = window.location.hash;
            console.log('[OAuth] Initial hash check:', hash ? hash.substring(0, 100) + '...' : '(empty)');
            if (hash) {
                const match = hash.match(/ldsp_oauth=([^&]+)/);
                if (match) {
                    console.log('[OAuth] Found ldsp_oauth in hash, decoding...');
                    const encoded = match[1];
                    const decoded = JSON.parse(decodeURIComponent(atob(encoded)));
                    console.log('[OAuth] Decoded data:', { hasToken: !!decoded.t, hasUser: !!decoded.u, ts: decoded.ts });
                    // 检查时效性（5分钟内有效）
                    if (decoded.ts && Date.now() - decoded.ts < 5 * 60 * 1000) {
                        _pendingOAuthData = {
                            success: true,
                            token: decoded.t,
                            user: decoded.u,
                            isJoined: decoded.j === 1
                        };
                        console.log('[OAuth] ✅ Captured login data from URL hash, user:', decoded.u?.username);
                    } else {
                        console.log('[OAuth] ⚠️ Login data expired, age:', Date.now() - decoded.ts, 'ms');
                    }
                    // 立即清除 URL 中的登录参数
                    let newHash = hash.replace(/[#&]?ldsp_oauth=[^&]*/, '').replace(/^[#&]+/, '').replace(/[#&]+$/, '');
                    const newUrl = window.location.pathname + window.location.search + (newHash ? '#' + newHash : '');
                    history.replaceState(null, '', newUrl);
                }
            }
        } catch (e) {
            console.warn('[OAuth] Failed to capture OAuth data:', e);
        }

        // ==================== 浏览器兼容性检查 ====================
        // 检测必需的 API 是否存在
        if (typeof Map === 'undefined' || typeof Set === 'undefined' || typeof Promise === 'undefined') {
            console.error('[LDStatus Pro] 浏览器版本过低，请升级浏览器');
            return;
        }

        // 兼容性：requestIdleCallback polyfill（Firefox 和旧版浏览器）
        const requestIdleCallback = window.requestIdleCallback || function(cb) {
            const start = Date.now();
            return setTimeout(() => cb({ didTimeout: false, timeRemaining: () => Math.max(0, 50 - (Date.now() - start)) }), 1);
        };
        const cancelIdleCallback = window.cancelIdleCallback || clearTimeout;

        // ==================== 网站配置 ====================
        const SITE_CONFIGS = {
            'linux.do': {
                name: 'Linux.do',
                icon: 'https://linux.do/uploads/default/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png',
                apiUrl: 'https://connect.linux.do',
                supportsLeaderboard: true
            },
            'idcflare.com': {
                name: 'IDCFlare',
                icon: 'https://idcflare.com/uploads/default/optimized/1X/8746f94a48ddc8140e8c7a52084742f38d3f5085_2_180x180.png',
                apiUrl: 'https://connect.idcflare.com',
                supportsLeaderboard: true
            }
        };

        const CURRENT_SITE = (() => {
            const hostname = window.location.hostname;
            for (const [domain, config] of Object.entries(SITE_CONFIGS)) {
                if (hostname === domain || hostname.endsWith(`.${domain}`)) {
                    return { domain, prefix: domain.replace('.', '_'), ...config };
                }
            }
            return null;
        })();

        if (!CURRENT_SITE) {
            console.warn('[LDStatus Pro] 不支持的网站');
            return;
        }

        // ==================== 事件总线（跨模块通信） ====================
        const EventBus = {
            _listeners: new Map(),
            
            // 订阅事件
            on(event, callback) {
                if (!this._listeners.has(event)) {
                    this._listeners.set(event, new Set());
                }
                this._listeners.get(event).add(callback);
                // 返回取消订阅函数
                return () => this.off(event, callback);
            },
            
            // 取消订阅
            off(event, callback) {
                this._listeners.get(event)?.delete(callback);
            },
            
            // 发布事件
            emit(event, data) {
                this._listeners.get(event)?.forEach(cb => {
                    try { cb(data); } catch (e) { /* 静默失败 */ }
                });
            },
            
            // 一次性订阅
            once(event, callback) {
                const wrapper = (data) => {
                    this.off(event, wrapper);
                    callback(data);
                };
                return this.on(event, wrapper);
            },
            
            // 清理所有监听器
            clear() {
                this._listeners.clear();
            }
        };

        // ==================== 跨标签页领导者管理器（全局单例） ====================
        // 确保同一时间只有一个标签页执行定时任务（阅读计时、同步、刷新等）
        const TabLeader = {
            LEADER_KEY: `ldsp_tab_leader_${CURRENT_SITE.prefix}`,
            HEARTBEAT: 5000,    // 5秒心跳
            TIMEOUT: 10000,     // 10秒超时（减少陈旧数据导致的等待时间）
            _tabId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            _isLeader: false,
            _initialized: false,
            _interval: null,
            _callbacks: [],     // 领导者状态变化回调
            
            init() {
                if (this._initialized) return;
                this._initialized = true;
                
                this._tryBecomeLeader();
                this._interval = setInterval(() => this._tryBecomeLeader(), this.HEARTBEAT);
                
                // 监听其他标签页的变化
                this._storageHandler = (e) => {
                    if (e.key === this.LEADER_KEY) this._tryBecomeLeader();
                };
                window.addEventListener('storage', this._storageHandler);
                
                // 页面卸载时释放领导者
                this._unloadHandler = () => this._release();
                window.addEventListener('beforeunload', this._unloadHandler);
            },
            
            _tryBecomeLeader() {
                const now = Date.now();
                let data = {};
                
                // 检查 localStorage 是否可用（隐私模式、存储满等情况）
                if (!this._storageAvailable) {
                    if (this._storageAvailable === undefined) {
                        try {
                            const testKey = '__ldsp_test__';
                            localStorage.setItem(testKey, '1');
                            localStorage.removeItem(testKey);
                            this._storageAvailable = true;
                        } catch (e) {
                            this._storageAvailable = false;
                            Logger.log('localStorage not available, becoming sole leader');
                        }
                    }
                    // localStorage 不可用，直接成为领导者
                    if (!this._storageAvailable) {
                        if (!this._isLeader) {
                            this._isLeader = true;
                            this._notifyCallbacks(true);
                            EventBus.emit('leader:change', { isLeader: true, tabId: this._tabId });
                        }
                        return;
                    }
                }
                
                try {
                    const stored = localStorage.getItem(this.LEADER_KEY);
                    if (stored) data = JSON.parse(stored);
                } catch (e) { /* 解析失败视为无数据 */ }
                
                const expired = !data.timestamp || (now - data.timestamp) > this.TIMEOUT;
                const iAmLeader = data.tabId === this._tabId;
                
                if (expired || iAmLeader) {
                    const wasLeader = this._isLeader;
                    this._isLeader = true;
                    try {
                        localStorage.setItem(this.LEADER_KEY, JSON.stringify({
                            tabId: this._tabId,
                            timestamp: now
                        }));
                    } catch (e) { /* 存储失败不影响逻辑 */ }
                    if (!wasLeader) {
                        this._notifyCallbacks(true);
                        EventBus.emit('leader:change', { isLeader: true, tabId: this._tabId });
                    }
                } else if (this._isLeader) {
                    this._isLeader = false;
                    this._notifyCallbacks(false);
                    EventBus.emit('leader:change', { isLeader: false, tabId: this._tabId });
                }
            },
            
            _release() {
                if (this._isLeader) {
                    try {
                        const stored = localStorage.getItem(this.LEADER_KEY);
                        if (stored) {
                            const data = JSON.parse(stored);
                            if (data.tabId === this._tabId) {
                                localStorage.removeItem(this.LEADER_KEY);
                            }
                        }
                    } catch (e) { /* 静默失败 */ }
                }
            },
            
            _notifyCallbacks(isLeader) {
                this._callbacks.forEach(cb => {
                    try { cb(isLeader); } catch (e) { /* 静默失败 */ }
                });
            },
            
            // 公开方法：检查是否是领导者
            isLeader() {
                return this._isLeader;
            },
            
            // 公开方法：获取当前标签页 ID
            getTabId() {
                return this._tabId;
            },
            
            // 公开方法：注册领导者状态变化回调
            onLeaderChange(callback) {
                if (typeof callback === 'function') {
                    this._callbacks.push(callback);
                }
            },
            
            // 公开方法：销毁
            destroy() {
                if (this._interval) {
                    clearInterval(this._interval);
                    this._interval = null;
                }
                if (this._storageHandler) {
                    window.removeEventListener('storage', this._storageHandler);
                }
                if (this._unloadHandler) {
                    window.removeEventListener('beforeunload', this._unloadHandler);
                }
                this._release();
                this._callbacks = [];
                this._initialized = false;
            }
        };

        // ==================== 常量配置 ====================
        const CONFIG = {
            // 时间间隔（毫秒）- 优化版：减少请求频率
            INTERVALS: {
                REFRESH: 300000,           // 数据刷新间隔
                READING_TRACK: 10000,      // 阅读追踪间隔
                READING_SAVE: 30000,       // 阅读保存间隔
                READING_IDLE: 60000,       // 空闲阈值
                STORAGE_DEBOUNCE: 1000,    // 存储防抖
                READING_UPDATE: 2000,      // 阅读时间UI更新（2秒，减少更新频率避免动画闪烁）
                LEADERBOARD_SYNC: 900000,  // 排行榜同步（15分钟，原10分钟）
                CLOUD_UPLOAD: 3600000,     // 云同步上传（60分钟，原30分钟）
                CLOUD_DOWNLOAD: 43200000,  // 云同步下载（12小时，原6小时）
                CLOUD_CHECK: 600000,       // 云同步检查（10分钟，原5分钟）
                REQ_SYNC_INCREMENTAL: 3600000, // 升级要求增量同步（1小时）
                REQ_SYNC_FULL: 43200000,   // 升级要求全量同步（12小时，与reading同步间隔一致）
                SYNC_RETRY_DELAY: 60000    // 同步失败后重试延迟（1分钟）
            },
            // 缓存配置
            CACHE: {
                MAX_HISTORY_DAYS: 365,
                LRU_SIZE: 50,
                VALUE_TTL: 5000,
                SCREEN_TTL: 100,
                YEAR_DATA_TTL: 5000,
                HISTORY_TTL: 1000,
                LEADERBOARD_DAILY_TTL: 600000,     // 日榜缓存 10 分钟（减少请求频率）
                LEADERBOARD_WEEKLY_TTL: 7200000,   // 周榜缓存 2 小时
                LEADERBOARD_MONTHLY_TTL: 21600000  // 月榜缓存 6 小时
            },
            // 网络配置
            NETWORK: {
                RETRY_COUNT: 3,
                RETRY_DELAY: 1000,
                TIMEOUT: 15000
            },
            // 里程碑配置
            MILESTONES: {
                '浏览话题': [100, 500, 1000, 2000, 5000],
                '已读帖子': [500, 1000, 5000, 10000, 20000],
                '获赞': [10, 50, 100, 500, 1000],
                '送出赞': [50, 100, 500, 1000, 2000],
                '回复': [10, 50, 100, 500, 1000]
            },
            // 趋势字段配置
            TREND_FIELDS: [
                { key: '浏览话题', search: '浏览的话题', label: '浏览话题' },
                { key: '已读帖子', search: '已读帖子', label: '已读帖子' },
                { key: '点赞', search: '送出赞', label: '点赞' },
                { key: '回复', search: '回复', label: '回复' },
                { key: '获赞', search: '获赞', label: '获赞' }
            ],
            // 阅读等级预设样式（图标、颜色、背景色固定，按索引匹配，共10级）
            READING_LEVEL_PRESETS: [
                { icon: '🌱', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },  // 0: 灰色 - 刚起步
                { icon: '📖', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },  // 1: 蓝色 - 热身中
                { icon: '📚', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },  // 2: 绿色 - 渐入佳境
                { icon: '🔥', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },  // 3: 黄色 - 沉浸阅读
                { icon: '⚡', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },  // 4: 橙色 - 深度学习
                { icon: '🏆', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },  // 5: 紫色 - LD达人
                { icon: '👑', color: '#ec4899', bg: 'rgba(236,72,153,0.15)' },  // 6: 粉色 - 超级水怪
                { icon: '💎', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },   // 7: 青色 - 钻石级
                { icon: '🌟', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },   // 8: 金色 - 传奇级
                { icon: '🚀', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }    // 9: 红色 - 神话级
            ],
            // 阅读等级默认阈值和标签（与 PRESETS 索引对应）
            READING_LEVELS_DEFAULT: [
                { min: 0, label: '刚起步' },
                { min: 30, label: '热身中' },
                { min: 90, label: '渐入佳境' },
                { min: 180, label: '沉浸阅读' },
                { min: 300, label: '深度学习' },
                { min: 450, label: 'LD达人' },
                { min: 600, label: '超级水怪' }
            ],
            // 动态阅读等级配置（运行时从服务器加载）
            READING_LEVELS: null,
            // 阅读等级配置刷新间隔（24小时）
            READING_LEVELS_REFRESH: 24 * 60 * 60 * 1000,
            // 名称替换映射
            NAME_MAP: new Map([
                ['已读帖子（所有时间）', '已读帖子'],
                ['浏览的话题（所有时间）', '浏览话题'],
                ['获赞：点赞用户数量', '点赞用户'],
                ['获赞：单日最高数量', '获赞天数'],
                ['被禁言（过去 6 个月）', '禁言'],
                ['被封禁（过去 6 个月）', '封禁'],
                ['发帖数量', '发帖'],
                ['回复数量', '回复'],
                ['被举报的帖子（过去 6 个月）', '被举报帖子'],
                ['发起举报的用户（过去 6 个月）', '发起举报']
            ]),
            // 存储键
            STORAGE_KEYS: {
                position: 'position', collapsed: 'collapsed', theme: 'theme',
                trendTab: 'trend_tab', history: 'history', milestones: 'milestones',
                lastNotify: 'last_notify', lastVisit: 'last_visit', todayData: 'today_data',
                userAvatar: 'user_avatar', readingTime: 'reading_time', currentUser: 'current_user',
                lastCloudSync: 'last_cloud_sync', lastDownloadSync: 'last_download_sync',
                lastUploadHash: 'last_upload_hash', leaderboardToken: 'leaderboard_token',
                leaderboardUser: 'leaderboard_user', leaderboardJoined: 'leaderboard_joined',
                leaderboardTab: 'leaderboard_tab',
                readingLevels: 'reading_levels', readingLevelsTime: 'reading_levels_time',
                websiteUrl: 'website_url', websiteUrlDate: 'website_url_date'
            },
            // 用户特定的存储键
            USER_KEYS: new Set(['history', 'milestones', 'lastVisit', 'todayData', 'userAvatar', 'readingTime']),
            // 周和月名称
            WEEKDAYS: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
            MONTHS: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
            // API地址
            LEADERBOARD_API: 'https://ldstatus-pro-api.jackcai711.workers.dev'
        };

        // 预编译正则
        const PATTERNS = {
            REVERSE: /被举报|发起举报|禁言|封禁/,
            USERNAME: /\/u\/([^/]+)/,
            TRUST_LEVEL: /(.*) - 信任级别 (\d+)/,
            TRUST_LEVEL_H1: /你好，.*?\(([^)]+)\)\s*(\d+)级用户/,  // 匹配 h1 中的 "你好，XX (username) X级用户"
            VERSION: /@version\s+([\d.]+)/,
            AVATAR_SIZE: /\/\d+\//,
            NUMBER: /(\d+)/
        };

        // ==================== 调试与日志 ====================
        const Logger = {
            _enabled: false,  // 生产环境默认关闭详细日志
            _prefix: '[LDSP]',
            
            enable() { this._enabled = true; },
            disable() { this._enabled = false; },
            
            log(...args) {
                if (this._enabled) console.log(this._prefix, ...args);
            },
            warn(...args) {
                console.warn(this._prefix, ...args);
            },
            error(...args) {
                console.error(this._prefix, ...args);
            },
            // 带标签的日志（用于追踪特定模块）
            tag(tag) {
                return {
                    log: (...args) => this._enabled && console.log(`${this._prefix}[${tag}]`, ...args),
                    warn: (...args) => console.warn(`${this._prefix}[${tag}]`, ...args),
                    error: (...args) => console.error(`${this._prefix}[${tag}]`, ...args)
                };
            }
        };

        // ==================== 工具函数 ====================
        const Utils = {
            _nameCache: new Map(),
            _htmlEntities: { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' },

            // HTML 转义（防止 XSS）
            escapeHtml(str) {
                if (!str || typeof str !== 'string') return '';
                return str.replace(/[&<>"']/g, c => this._htmlEntities[c]);
            },

            // 清理用户输入（移除控制字符，限制长度）
            sanitize(str, maxLen = 100) {
                if (!str || typeof str !== 'string') return '';
                return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').substring(0, maxLen).trim();
            },
            
            // 安全的数值转换（防止 NaN 和 Infinity）
            toSafeNumber(val, defaultVal = 0) {
                const num = Number(val);
                return Number.isFinite(num) ? num : defaultVal;
            },
            
            // 安全的整数转换
            toSafeInt(val, defaultVal = 0) {
                const num = parseInt(val, 10);
                return Number.isFinite(num) ? num : defaultVal;
            },
            
            // 深度冻结对象（防止意外修改）
            deepFreeze(obj) {
                if (obj && typeof obj === 'object') {
                    Object.keys(obj).forEach(key => this.deepFreeze(obj[key]));
                    return Object.freeze(obj);
                }
                return obj;
            },

            // 版本比较
            compareVersion(v1, v2) {
                if (!v1 || !v2) return 0;
                const [p1, p2] = [v1, v2].map(v => String(v).split('.').map(n => this.toSafeInt(n)));
                const len = Math.max(p1.length, p2.length);
                for (let i = 0; i < len; i++) {
                    const diff = (p1[i] || 0) - (p2[i] || 0);
                    if (diff !== 0) return diff > 0 ? 1 : -1;
                }
                return 0;
            },

            // 简化名称
            simplifyName(name) {
                if (this._nameCache.has(name)) return this._nameCache.get(name);
                let result = CONFIG.NAME_MAP.get(name);
                if (!result) {
                    for (const [from, to] of CONFIG.NAME_MAP) {
                        if (name.includes(from.split('（')[0])) {
                            result = name.replace(from, to);
                            break;
                        }
                    }
                }
                result = result || name;
                this._nameCache.set(name, result);
                return result;
            },

            // 格式化日期
            formatDate(ts, format = 'short') {
                const d = new Date(ts);
                const [m, day] = [d.getMonth() + 1, d.getDate()];
                if (format === 'short') return `${m}/${day}`;
                if (format === 'time') return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                return `${m}月${day}日`;
            },

            // 格式化相对时间（将UTC时间转为本地时间并显示为xx前）
            formatRelativeTime(utcStr) {
                if (!utcStr) return '';
                const d = new Date(utcStr); // 自动转换UTC到本地时区
                const now = new Date();
                const diff = (now - d) / 1000;
                if (diff < 60) return '刚刚';
                if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
                if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
                if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
                if (diff < 31536000) return `${d.getMonth() + 1}月${d.getDate()}日`;
                return `${d.getFullYear()}年${d.getMonth() + 1}月`;
            },

            // 格式化完整日期时间（年月日时分）
            formatDateTime(utcStr) {
                if (!utcStr) return '';
                const d = new Date(utcStr);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hour = String(d.getHours()).padStart(2, '0');
                const minute = String(d.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day} ${hour}:${minute}`;
            },

            // 获取今日键
            getTodayKey: () => new Date().toDateString(),

            // 格式化阅读时间
            formatReadingTime(minutes) {
                if (minutes < 1) return '< 1分钟';
                if (minutes < 60) return `${Math.round(minutes)}分钟`;
                const h = Math.floor(minutes / 60);
                const m = Math.round(minutes % 60);
                return m > 0 ? `${h}小时${m}分` : `${h}小时`;
            },

            // 获取阅读等级（合并服务端配置和预设样式）
            getReadingLevel(minutes) {
                const levels = CONFIG.READING_LEVELS || CONFIG.READING_LEVELS_DEFAULT;
                const presets = CONFIG.READING_LEVEL_PRESETS;
                
                for (let i = levels.length - 1; i >= 0; i--) {
                    if (minutes >= levels[i].min) {
                        const level = levels[i];
                        const preset = presets[i] || presets[presets.length - 1];
                        // 合并：使用服务端的 min/label，预设的 icon/color/bg
                        return {
                            min: level.min,
                            label: level.label,
                            icon: preset.icon,
                            color: preset.color,
                            bg: preset.bg
                        };
                    }
                }
                const first = levels[0];
                const preset = presets[0];
                return {
                    min: first.min,
                    label: first.label,
                    icon: preset.icon,
                    color: preset.color,
                    bg: preset.bg
                };
            },

            // 获取热力图等级
            getHeatmapLevel(minutes) {
                if (minutes < 1) return 0;
                if (minutes < 60) return 1;
                if (minutes < 180) return 2;
                if (minutes < 300) return 3;
                return 4;
            },

            // 重排需求项（将举报相关项移到禁言前）
            reorderRequirements(reqs) {
                const reports = [], others = [];
                reqs.forEach(r => {
                    (r.name.includes('被举报') || r.name.includes('发起举报') ? reports : others).push(r);
                });
                const banIdx = others.findIndex(r => r.name.includes('禁言'));
                if (banIdx >= 0) others.splice(banIdx, 0, ...reports);
                else others.push(...reports);
                return others;
            },

            // 防抖（带取消功能）
            debounce(fn, wait) {
                let timer = null;
                const debounced = function(...args) {
                    if (timer !== null) clearTimeout(timer);
                    timer = setTimeout(() => {
                        timer = null;
                        fn.apply(this, args);
                    }, wait);
                };
                debounced.cancel = () => {
                    if (timer !== null) {
                        clearTimeout(timer);
                        timer = null;
                    }
                };
                return debounced;
            },

            // 节流（保证首次立即执行，后续按间隔执行）
            throttle(fn, limit) {
                let lastTime = 0;
                return function(...args) {
                    const now = Date.now();
                    if (now - lastTime >= limit) {
                        lastTime = now;
                        fn.apply(this, args);
                    }
                };
            },

            // 安全执行（捕获异常）
            safeCall(fn, fallback = null) {
                try {
                    return fn();
                } catch (e) {
                    return fallback;
                }
            },
            
            // 安全的异步执行（捕获 Promise 异常）
            async safeAsync(fn, fallback = null) {
                try {
                    return await fn();
                } catch (e) {
                    Logger.warn('Async operation failed:', e.message);
                    return fallback;
                }
            },
            
            // 生成唯一 ID
            uid() {
                return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            },
            
            // 检查是否为有效的 URL
            isValidUrl(str) {
                if (!str || typeof str !== 'string') return false;
                try {
                    const url = new URL(str);
                    return url.protocol === 'http:' || url.protocol === 'https:';
                } catch {
                    return false;
                }
            },
            
            // 安全获取嵌套对象属性
            get(obj, path, defaultVal = undefined) {
                if (!obj || typeof path !== 'string') return defaultVal;
                const keys = path.split('.');
                let result = obj;
                for (const key of keys) {
                    if (result == null || typeof result !== 'object') return defaultVal;
                    result = result[key];
                }
                return result !== undefined ? result : defaultVal;
            },
            
            // 克隆对象（浅拷贝，用于配置等）
            clone(obj) {
                if (!obj || typeof obj !== 'object') return obj;
                return Array.isArray(obj) ? [...obj] : { ...obj };
            }
        };

        // ==================== 屏幕工具 ====================
        const Screen = {
            _cache: null,
            _cacheTime: 0,

            getSize() {
                const now = Date.now();
                if (this._cache && (now - this._cacheTime) < CONFIG.CACHE.SCREEN_TTL) {
                    return this._cache;
                }
                const { innerWidth: w, innerHeight: h } = window;
                this._cache = (w < 1400 || h < 800) ? 'small' : w < 1920 ? 'medium' : 'large';
                this._cacheTime = now;
                return this._cache;
            },

            getConfig() {
                const configs = {
                    small: { width: 280, maxHeight: Math.min(innerHeight - 100, 450), fontSize: 11, padding: 10, avatarSize: 44, ringSize: 70 },
                    medium: { width: 300, maxHeight: Math.min(innerHeight - 100, 520), fontSize: 12, padding: 12, avatarSize: 48, ringSize: 76 },
                    large: { width: 320, maxHeight: 580, fontSize: 12, padding: 14, avatarSize: 52, ringSize: 80 }
                };
                return configs[this.getSize()];
            }
        };

        // ==================== LRU 缓存 ====================
        class LRUCache {
            constructor(maxSize = CONFIG.CACHE.LRU_SIZE) {
                this.maxSize = maxSize;
                this.cache = new Map();
            }

            get(key) {
                if (!this.cache.has(key)) return undefined;
                const value = this.cache.get(key);
                this.cache.delete(key);
                this.cache.set(key, value);
                return value;
            }

            set(key, value) {
                this.cache.has(key) && this.cache.delete(key);
                if (this.cache.size >= this.maxSize) {
                    this.cache.delete(this.cache.keys().next().value);
                }
                this.cache.set(key, value);
            }

            has(key) { return this.cache.has(key); }
            clear() { this.cache.clear(); }
        }

        // ==================== 存储管理器 ====================
        class Storage {
            constructor() {
                this._pending = new Map();
                this._timer = null;
                this._user = null;
                this._keyCache = new Map();
                this._valueCache = new Map();
                this._valueCacheTime = new Map();
            }

            // 获取当前用户
            getUser() {
                if (this._user) return this._user;
                const link = document.querySelector('.current-user a[href^="/u/"]');
                if (link) {
                    const match = link.getAttribute('href').match(PATTERNS.USERNAME);
                    if (match) {
                        this._user = match[1];
                        GM_setValue(this._globalKey('currentUser'), this._user);
                        return this._user;
                    }
                }
                return this._user = GM_getValue(this._globalKey('currentUser'), null);
            }

            setUser(username) {
                if (this._user !== username) {
                    this._user = username;
                    this._keyCache.clear();  // 用户变化时清除 key 缓存
                    GM_setValue(this._globalKey('currentUser'), username);
                }
            }

            // 生成全局键
            _globalKey(key) {
                return `ldsp_${CURRENT_SITE.prefix}_${CONFIG.STORAGE_KEYS[key] || key}`;
            }

            // 生成用户键
            _userKey(key) {
                const cacheKey = `${key}_${this._user || ''}`;
                if (this._keyCache.has(cacheKey)) return this._keyCache.get(cacheKey);
                
                const base = CONFIG.STORAGE_KEYS[key] || key;
                const user = this.getUser();
                const result = user && CONFIG.USER_KEYS.has(key) 
                    ? `ldsp_${CURRENT_SITE.prefix}_${base}_${user}`
                    : `ldsp_${CURRENT_SITE.prefix}_${base}`;
                
                this._keyCache.set(cacheKey, result);
                return result;
            }

            // 获取用户数据
            get(key, defaultValue = null) {
                const storageKey = this._userKey(key);
                const now = Date.now();
                
                if (this._valueCache.has(storageKey)) {
                    const cacheTime = this._valueCacheTime.get(storageKey);
                    if ((now - cacheTime) < CONFIG.CACHE.VALUE_TTL) {
                        return this._valueCache.get(storageKey);
                    }
                }
                
                const value = GM_getValue(storageKey, defaultValue);
                this._valueCache.set(storageKey, value);
                this._valueCacheTime.set(storageKey, now);
                return value;
            }

            // 设置用户数据（带防抖）
            set(key, value) {
                const storageKey = this._userKey(key);
                this._valueCache.set(storageKey, value);
                this._valueCacheTime.set(storageKey, Date.now());
                this._pending.set(storageKey, value);
                this._scheduleWrite();
            }

            // 立即设置用户数据
            setNow(key, value) {
                const storageKey = this._userKey(key);
                this._valueCache.set(storageKey, value);
                this._valueCacheTime.set(storageKey, Date.now());
                GM_setValue(storageKey, value);
            }

            // 获取全局数据
            getGlobal(key, defaultValue = null) {
                return GM_getValue(this._globalKey(key), defaultValue);
            }

            // 设置全局数据（带防抖）
            setGlobal(key, value) {
                this._pending.set(this._globalKey(key), value);
                this._scheduleWrite();
            }

            // 立即设置全局数据
            setGlobalNow(key, value) {
                GM_setValue(this._globalKey(key), value);
            }

            // 调度写入
            _scheduleWrite() {
                if (this._timer) return;
                this._timer = setTimeout(() => {
                    this.flush();
                    this._timer = null;
                }, CONFIG.INTERVALS.STORAGE_DEBOUNCE);
            }

            // 刷新所有待写入数据
            flush() {
                this._pending.forEach((value, key) => {
                    try { GM_setValue(key, value); } catch (e) { console.error('[Storage]', key, e); }
                });
                this._pending.clear();
            }

            // 清除缓存
            invalidateCache(key) {
                if (key) {
                    const storageKey = this._userKey(key);
                    this._valueCache.delete(storageKey);
                    this._valueCacheTime.delete(storageKey);
                } else {
                    this._valueCache.clear();
                    this._valueCacheTime.clear();
                }
            }

            // 迁移旧数据
            migrate(username) {
                const flag = `ldsp_migrated_v3_${username}`;
                if (GM_getValue(flag, false)) return;

                CONFIG.USER_KEYS.forEach(key => {
                    const oldKey = CONFIG.STORAGE_KEYS[key];
                    const newKey = `ldsp_${CURRENT_SITE.prefix}_${oldKey}_${username}`;
                    const oldData = GM_getValue(oldKey, null);
                    if (oldData !== null && GM_getValue(newKey, null) === null) {
                        GM_setValue(newKey, oldData);
                    }
                });

                this._migrateReadingTime(username);
                GM_setValue(flag, true);
            }

            // 迁移阅读时间数据
            _migrateReadingTime(username) {
                const key = `ldsp_${CURRENT_SITE.prefix}_reading_time_${username}`;
                const data = GM_getValue(key, null);
                if (!data || typeof data !== 'object') return;

                if (data.date && data.minutes !== undefined && !data.dailyData) {
                    GM_setValue(key, {
                        version: 3,
                        dailyData: { [data.date]: { totalMinutes: data.minutes || 0, lastActive: data.lastActive || Date.now(), sessions: [] } },
                        monthlyCache: {},
                        yearlyCache: {}
                    });
                } else if (data.version === 2) {
                    data.version = 3;
                    data.monthlyCache = data.monthlyCache || {};
                    data.yearlyCache = data.yearlyCache || {};
                    if (data.dailyData) {
                        Object.entries(data.dailyData).forEach(([dateKey, dayData]) => {
                            try {
                                const d = new Date(dateKey);
                                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                const yearKey = `${d.getFullYear()}`;
                                const minutes = dayData.totalMinutes || 0;
                                data.monthlyCache[monthKey] = (data.monthlyCache[monthKey] || 0) + minutes;
                                data.yearlyCache[yearKey] = (data.yearlyCache[yearKey] || 0) + minutes;
                            } catch (e) {}
                        });
                    }
                    GM_setValue(key, data);
                }
            }
        }

        // ==================== 自定义错误类型 ====================
        class NetworkError extends Error {
            constructor(message, code = 'NETWORK_ERROR', status = 0) {
                super(message);
                this.name = 'NetworkError';
                this.code = code;
                this.status = status;
            }
            
            get isTimeout() { return this.code === 'TIMEOUT'; }
            get isAuth() { return this.code === 'UNAUTHORIZED' || this.status === 401; }
            get isNotFound() { return this.status === 404; }
            get isServerError() { return this.status >= 500; }
        }

        // ==================== 网络管理器 ====================
        class Network {
            constructor() {
                this._pending = new Map();
                this._apiCache = new Map();
                this._apiCacheTime = new Map();
            }
            
            // 创建统一的错误对象
            static createError(message, code = 'UNKNOWN', status = 0) {
                return new NetworkError(message, code, status);
            }

            // 静态方法：加载阅读等级配置（从服务端获取，本地缓存24小时）
            static async loadReadingLevels() {
                const storageKey = `ldsp_reading_levels`;
                const timeKey = `ldsp_reading_levels_time`;
                
                try {
                    // 检查本地缓存是否过期（24小时刷新一次）
                    const cachedTime = GM_getValue(timeKey, 0);
                    const now = Date.now();
                    
                    if (cachedTime && (now - cachedTime) < CONFIG.READING_LEVELS_REFRESH) {
                        // 缓存未过期，使用本地数据
                        const cached = GM_getValue(storageKey, null);
                        if (cached && Array.isArray(cached) && cached.length > 0) {
                            CONFIG.READING_LEVELS = cached;
                            return;
                        }
                    }
                    
                    // 需要从服务端获取
                    const response = await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'GET',
                            url: `${CONFIG.LEADERBOARD_API}/api/config/reading-levels`,
                            headers: { 'Content-Type': 'application/json' },
                            timeout: 10000,
                            onload: res => {
                                if (res.status >= 200 && res.status < 300) {
                                    try {
                                        resolve(JSON.parse(res.responseText));
                                    } catch (e) {
                                        reject(new Error('Parse error'));
                                    }
                                } else {
                                    reject(new Error(`HTTP ${res.status}`));
                                }
                            },
                            onerror: () => reject(new Error('Network error')),
                            ontimeout: () => reject(new Error('Timeout'))
                        });
                    });
                    
                    if (response.success && response.data?.levels && Array.isArray(response.data.levels)) {
                        const levels = response.data.levels;
                        CONFIG.READING_LEVELS = levels;
                        GM_setValue(storageKey, levels);
                        GM_setValue(timeKey, now);
                    } else {
                        throw new Error('Invalid response format');
                    }
                } catch (e) {
                    // 尝试使用本地缓存（即使过期也比没有好）
                    const cached = GM_getValue(storageKey, null);
                    if (cached && Array.isArray(cached) && cached.length > 0) {
                        CONFIG.READING_LEVELS = cached;
                    } else {
                        // 使用默认配置
                        CONFIG.READING_LEVELS = CONFIG.READING_LEVELS_DEFAULT;
                    }
                }
            }

            async fetch(url, options = {}) {
                if (this._pending.has(url)) return this._pending.get(url);
                
                const promise = this._fetchWithRetry(url, options);
                this._pending.set(url, promise);
                
                try {
                    return await promise;
                } finally {
                    this._pending.delete(url);
                }
            }

            // 清除 API 缓存
            clearApiCache(endpoint) {
                if (endpoint) {
                    this._apiCache.delete(endpoint);
                    this._apiCacheTime.delete(endpoint);
                } else {
                    this._apiCache.clear();
                    this._apiCacheTime.clear();
                }
            }

            async _fetchWithRetry(url, options) {
                const { maxRetries = CONFIG.NETWORK.RETRY_COUNT, timeout = CONFIG.NETWORK.TIMEOUT } = options;
                
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        return await this._doFetch(url, timeout);
                    } catch (e) {
                        if (i === maxRetries - 1) throw e;
                        await new Promise(r => setTimeout(r, CONFIG.NETWORK.RETRY_DELAY * Math.pow(2, i)));
                    }
                }
            }

            async _doFetch(url, timeout) {
                // 检测 GM_xmlhttpRequest 是否可用
                const hasGM = typeof GM_xmlhttpRequest === 'function';
                
                // 方法1: 尝试 GM_xmlhttpRequest（可绕过跨域）
                if (hasGM) {
                    try {
                        const result = await new Promise((resolve, reject) => {
                            let settled = false;
                            const timeoutId = setTimeout(() => {
                                if (!settled) {
                                    settled = true;
                                    reject(new Error('Timeout'));
                                }
                            }, timeout);
                            
                            try {
                                GM_xmlhttpRequest({
                                    method: 'GET',
                                    url,
                                    timeout,
                                    onload: res => {
                                        if (settled) return;
                                        settled = true;
                                        clearTimeout(timeoutId);
                                        if (res.status >= 200 && res.status < 300) {
                                            resolve(res.responseText);
                                        } else {
                                            reject(new Error(`HTTP ${res.status}`));
                                        }
                                    },
                                    onerror: () => {
                                        if (settled) return;
                                        settled = true;
                                        clearTimeout(timeoutId);
                                        reject(new Error('Network error'));
                                    },
                                    ontimeout: () => {
                                        if (settled) return;
                                        settled = true;
                                        clearTimeout(timeoutId);
                                        reject(new Error('GM Timeout'));
                                    }
                                });
                            } catch (gmCallError) {
                                if (settled) return;
                                settled = true;
                                clearTimeout(timeoutId);
                                reject(gmCallError);
                            }
                        });
                        return result;
                    } catch (gmError) {
                        // 跨域请求不使用 native fetch fallback（会触发 CORS 错误）
                        const isCrossOrigin = !url.startsWith(location.origin);
                        if (isCrossOrigin) {
                            throw gmError;  // 直接抛出错误，不 fallback
                        }
                        // 同源请求继续尝试 native fetch
                    }
                }
                
                // 方法2: native fetch 作为 fallback（仅同源请求）
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                const resp = await fetch(url, { 
                    credentials: 'include',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                return await resp.text();
            }

            // API 请求（带认证和缓存）
            async api(endpoint, options = {}) {
                const method = options.method || 'GET';
                const cacheTtl = options.cacheTtl || 0;
                
                // GET 请求支持缓存
                if (method === 'GET' && cacheTtl > 0) {
                    const now = Date.now();
                    const cacheKey = `${endpoint}_${options.token || ''}`;
                    if (this._apiCache.has(cacheKey)) {
                        const cacheTime = this._apiCacheTime.get(cacheKey);
                        if (now - cacheTime < cacheTtl) {
                            return this._apiCache.get(cacheKey);
                        }
                    }
                }

                return new Promise((resolve, reject) => {
                    // 确保 body 是字符串
                    let bodyData = options.body;
                    if (bodyData && typeof bodyData === 'object') {
                        bodyData = JSON.stringify(bodyData);
                    }
                    
                    GM_xmlhttpRequest({
                        method,
                        url: `${CONFIG.LEADERBOARD_API}${endpoint}`,
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Client-Version': GM_info.script.version || 'unknown',
                            ...(options.token ? { 'Authorization': `Bearer ${options.token}` } : {})
                        },
                        data: bodyData || undefined,
                        timeout: CONFIG.NETWORK.TIMEOUT,
                        onload: res => {
                            try {
                                const data = JSON.parse(res.responseText);
                                if (res.status >= 200 && res.status < 300) {
                                    // 缓存成功响应
                                    if (method === 'GET' && cacheTtl > 0) {
                                        const cacheKey = `${endpoint}_${options.token || ''}`;
                                        this._apiCache.set(cacheKey, data);
                                        this._apiCacheTime.set(cacheKey, Date.now());
                                    }
                                    resolve(data);
                                } else {
                                    // 构建错误消息，包含错误码便于识别
                                    const errorCode = data.error?.code || '';
                                    const errorMsg = data.error?.message || data.error || `HTTP ${res.status}`;
                                    reject(new Error(`${errorCode}: ${errorMsg}`));
                                }
                            } catch (e) {
                                reject(new Error('Parse error'));
                            }
                        },
                        onerror: () => reject(new Error('Network error')),
                        ontimeout: () => reject(new Error('Timeout'))
                    });
                });
            }

            // 获取 JSON 数据（带 cookie 同源请求）
            async fetchJson(url, options = {}) {
                const timeout = options.timeout || CONFIG.NETWORK.TIMEOUT;
                const headers = options.headers || {};
                
                // 使用 GM_xmlhttpRequest 发送带 cookie 的请求
                return new Promise((resolve, reject) => {
                    const timeoutId = setTimeout(() => reject(new Error('Timeout')), timeout);
                    
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url,
                        headers: {
                            'Accept': 'application/json',
                            ...headers
                        },
                        timeout,
                        withCredentials: true,
                        onload: res => {
                            clearTimeout(timeoutId);
                            try {
                                if (res.status >= 200 && res.status < 300) {
                                    resolve(JSON.parse(res.responseText));
                                } else if (res.status === 403) {
                                    reject(new Error('需要登录后访问'));
                                } else {
                                    reject(new Error(`HTTP ${res.status}`));
                                }
                            } catch (e) {
                                reject(new Error('解析响应失败'));
                            }
                        },
                        onerror: () => {
                            clearTimeout(timeoutId);
                            reject(new Error('网络错误'));
                        },
                        ontimeout: () => {
                            clearTimeout(timeoutId);
                            reject(new Error('请求超时'));
                        }
                    });
                });
            }
        }

        // ==================== 历史数据管理器 ====================
        class HistoryManager {
            constructor(storage) {
                this.storage = storage;
                this.cache = new LRUCache();
                this._history = null;
                this._historyTime = 0;
            }

            getHistory() {
                const now = Date.now();
                if (this._history && (now - this._historyTime) < CONFIG.CACHE.HISTORY_TTL) {
                    return this._history;
                }
                
                const history = this.storage.get('history', []);
                const cutoff = now - CONFIG.CACHE.MAX_HISTORY_DAYS * 86400000;
                this._history = history.filter(h => h.ts > cutoff);
                this._historyTime = now;
                return this._history;
            }

            addHistory(data, readingTime = 0) {
                const history = this.getHistory();
                const now = Date.now();
                const today = new Date().toDateString();
                const record = { ts: now, data, readingTime };

                const idx = history.findIndex(h => new Date(h.ts).toDateString() === today);
                idx >= 0 ? history[idx] = record : history.push(record);

                this.storage.set('history', history);
                this._history = history;
                this._historyTime = now;
                this.cache.clear();
                return history;
            }

            // 聚合每日增量
            aggregateDaily(history, reqs, maxDays) {
                const cacheKey = `daily_${maxDays}_${history.length}`;
                if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

                const byDay = new Map();
                history.forEach(h => {
                    const day = new Date(h.ts).toDateString();
                    byDay.has(day) ? byDay.get(day).push(h) : byDay.set(day, [h]);
                });

                const sortedDays = [...byDay.keys()].sort((a, b) => new Date(a) - new Date(b));
                const result = new Map();
                let prevData = null;

                sortedDays.forEach(day => {
                    const latest = byDay.get(day).at(-1);
                    const dayData = {};
                    reqs.forEach(r => {
                        dayData[r.name] = (latest.data[r.name] || 0) - (prevData?.[r.name] || 0);
                    });
                    result.set(day, dayData);
                    prevData = { ...latest.data };
                });

                this.cache.set(cacheKey, result);
                return result;
            }

            // 聚合每周增量
            aggregateWeekly(history, reqs) {
                const cacheKey = `weekly_${history.length}`;
                if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

                const now = new Date();
                const [year, month] = [now.getFullYear(), now.getMonth()];
                const weeks = this._getWeeksInMonth(year, month);
                const result = new Map();
                const byWeek = new Map(weeks.map((_, i) => [i, []]));

                history.forEach(h => {
                    const d = new Date(h.ts);
                    if (d.getFullYear() === year && d.getMonth() === month) {
                        weeks.forEach((week, i) => {
                            if (d >= week.start && d <= week.end) byWeek.get(i).push(h);
                        });
                    }
                });

                let prevData = null;
                const lastMonth = history.filter(h => new Date(h.ts) < new Date(year, month, 1));
                if (lastMonth.length) prevData = { ...lastMonth.at(-1).data };

                weeks.forEach((week, i) => {
                    const records = byWeek.get(i);
                    const weekData = {};
                    if (records.length) {
                        const latest = records.at(-1);
                        reqs.forEach(r => {
                            weekData[r.name] = (latest.data[r.name] || 0) - (prevData?.[r.name] || 0);
                        });
                        prevData = { ...latest.data };
                    } else {
                        reqs.forEach(r => weekData[r.name] = 0);
                    }
                    result.set(i, { weekNum: i + 1, start: week.start, end: week.end, label: `第${i + 1}周`, data: weekData });
                });

                this.cache.set(cacheKey, result);
                return result;
            }

            // 聚合每月增量
            aggregateMonthly(history, reqs) {
                const cacheKey = `monthly_${history.length}`;
                if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

                const byMonth = new Map();
                history.forEach(h => {
                    const d = new Date(h.ts);
                    const key = new Date(d.getFullYear(), d.getMonth(), 1).toDateString();
                    byMonth.has(key) ? byMonth.get(key).push(h) : byMonth.set(key, [h]);
                });

                const sortedMonths = [...byMonth.keys()].sort((a, b) => new Date(a) - new Date(b));
                const result = new Map();
                let prevData = null;

                sortedMonths.forEach(month => {
                    const latest = byMonth.get(month).at(-1);
                    const monthData = {};
                    reqs.forEach(r => {
                        monthData[r.name] = (latest.data[r.name] || 0) - (prevData?.[r.name] || 0);
                    });
                    result.set(month, monthData);
                    prevData = { ...latest.data };
                });

                this.cache.set(cacheKey, result);
                return result;
            }

            _getWeeksInMonth(year, month) {
                const weeks = [];
                const lastDay = new Date(year, month + 1, 0);
                let start = new Date(year, month, 1);
                
                while (start <= lastDay) {
                    let end = new Date(start);
                    end.setDate(end.getDate() + 6);
                    if (end > lastDay) end = new Date(lastDay);
                    weeks.push({ start: new Date(start), end });
                    start = new Date(end);
                    start.setDate(start.getDate() + 1);
                }
                return weeks;
            }
        }

        // ==================== 阅读时间追踪器 ====================
        class ReadingTracker {
            constructor(storage) {
                this.storage = storage;
                this.isActive = true;
                this.lastActivity = Date.now();
                this.lastSave = Date.now();
                this._intervals = [];
                this._initialized = false;
                this._yearCache = null;
                this._yearCacheTime = 0;
            }

            init(username) {
                if (this._initialized) return;
                this.storage.migrate(username);
                this._bindEvents();
                
                // 始终启动活动状态追踪（用于 UI 显示）
                // 但只有领导者才会执行数据保存（避免多标签页重复写入）
                this._startTracking();
                
                this._initialized = true;
            }
            
            _stopTracking() {
                this._intervals.forEach(id => clearInterval(id));
                this._intervals = [];
                this._tracking = false;
                // 停止前保存当前数据
                this.save();
            }

            _bindEvents() {
                try {
                    // 使用节流的活动处理器
                    // 普通事件：每秒最多触发一次
                    this._activityHandler = Utils.throttle(() => this._onActivity(), 1000);
                    // 高频事件（如 mousemove）：每 3 秒最多触发一次
                    this._highFreqHandler = Utils.throttle(() => this._onActivity(), 3000);
                    
                    // 监听用户活动事件
                    // 使用 capture: true 确保在事件捕获阶段就能获取，避免被其他脚本阻止
                    // 普通频率事件：点击、按键、触摸开始
                    this._normalEvents = ['mousedown', 'keydown', 'click', 'touchstart', 'pointerdown'];
                    this._normalEvents.forEach(e => {
                        document.addEventListener(e, this._activityHandler, { passive: true, capture: true });
                    });
                    
                    // 高频事件：移动、滚动（使用更长的节流时间）
                    this._highFreqEvents = ['mousemove', 'scroll', 'wheel', 'touchmove', 'pointermove'];
                    this._highFreqEvents.forEach(e => {
                        document.addEventListener(e, this._highFreqHandler, { passive: true, capture: true });
                    });

                    // 页面可见性变化
                    this._visibilityHandler = () => {
                        if (document.hidden) {
                            this.save();
                            this.isActive = false;
                        } else {
                            // 页面恢复可见时，假定用户正在查看，恢复活动状态
                            // 如果用户60秒内无任何操作，定时器会自动设为 inactive
                            this.lastActivity = Date.now();
                            this.isActive = true;
                        }
                    };
                    document.addEventListener('visibilitychange', this._visibilityHandler);
                    
                    // Safari/iOS 兼容：pageshow/pagehide 事件比 visibilitychange 更可靠
                    this._pageShowHandler = (e) => {
                        // e.persisted 表示页面从 bfcache 恢复
                        this.lastActivity = Date.now();
                        this.isActive = true;
                    };
                    this._pageHideHandler = () => {
                        this.save();
                        this.isActive = false;
                    };
                    window.addEventListener('pageshow', this._pageShowHandler);
                    window.addEventListener('pagehide', this._pageHideHandler);
                    
                    // 窗口获得焦点时更新活动状态（同时监听 window 和 document）
                    this._focusHandler = () => {
                        this.lastActivity = Date.now();
                        // Safari 上 focus 事件更可靠，直接设置 active
                        this.isActive = true;
                    };
                    this._blurHandler = () => {
                        // 窗口失去焦点时保存数据（Safari 上 visibilitychange 可能不触发）
                        this.save();
                    };
                    window.addEventListener('focus', this._focusHandler);
                    window.addEventListener('blur', this._blurHandler);
                    document.addEventListener('focus', this._focusHandler);

                    // 页面卸载前保存
                    this._beforeUnloadHandler = () => this.save();
                    window.addEventListener('beforeunload', this._beforeUnloadHandler);
                    
                } catch (e) {
                    Logger.log('Failed to bind events:', e);
                    // 降级：即使事件绑定失败，也尝试启动基本功能
                }
            }

            _onActivity() {
                const now = Date.now();
                if (!this.isActive) this.isActive = true;
                this.lastActivity = now;
            }

            _startTracking() {
                // 防止重复启动
                if (this._tracking) return;
                this._tracking = true;
                
                // 用于检测系统休眠/恢复
                let lastCheckTime = Date.now();
                
                // 记录定时器启动时间，用于健康检查
                this._trackingStartTime = Date.now();
                
                this._intervals.push(
                    setInterval(() => {
                        const now = Date.now();
                        const checkGap = now - lastCheckTime;
                        
                        // 检测系统休眠：如果两次检查间隔超过预期的 3 倍，说明可能休眠过
                        // 例如：READING_TRACK=10秒，如果间隔超过 30 秒，说明系统暂停过
                        if (checkGap > CONFIG.INTERVALS.READING_TRACK * 3) {
                            // 系统刚从休眠恢复，重置状态避免累积错误时间
                            this.isActive = false;
                            this.lastActivity = now;
                            this.lastSave = now;
                            lastCheckTime = now;
                            Logger.log('System resume detected, reset tracking state');
                            return; // 跳过本次空闲检测，等待用户新活动
                        }
                        lastCheckTime = now;
                        
                        // 空闲检测逻辑：只负责将 active 状态设为 false
                        // isActive = true 只能通过用户活动事件触发（_onActivity）
                        const idle = now - this.lastActivity;
                        if (this.isActive && idle > CONFIG.INTERVALS.READING_IDLE) {
                            this.isActive = false;
                        }
                        // 注意：不再自动将 isActive 设为 true
                        // 用户必须有新活动才能恢复记录状态
                    }, CONFIG.INTERVALS.READING_TRACK),
                    setInterval(() => this.save(), CONFIG.INTERVALS.READING_SAVE)
                );
                
                // 健康检查：每 60 秒检查定时器是否还存活
                // 如果定时器意外被清除，尝试重新启动
                this._healthCheckId = setInterval(() => {
                    if (this._tracking && this._intervals.length === 0) {
                        Logger.log('Tracking timers died, restarting...');
                        this._tracking = false;
                        this._startTracking();
                    }
                }, 60000);
            }

            save() {
                if (!this.storage.getUser()) return;

                const todayKey = Utils.getTodayKey();
                const now = Date.now();
                
                // 计算这次应该加的时间（基于本标签页的活动状态）
                const elapsed = (now - this.lastSave) / 1000;
                const idle = now - this.lastActivity;
                
                // 防护：检测异常数据
                // 1. elapsed 为负数（系统时间被调整）
                // 2. elapsed 过大（超过 2 分钟，可能是休眠恢复）
                // 3. idle 为负数（系统时间被调整）
                if (elapsed < 0 || elapsed > 120 || idle < 0) {
                    // 重置状态，不记录这段异常时间
                    this.lastSave = now;
                    this.lastActivity = now;
                    this.isActive = false;
                    return;
                }
                
                let toAdd = 0;
                if (elapsed > 0) {
                    // 计算有效的活动时间
                    // 如果用户一直活跃（idle <= 60秒），记录全部 elapsed 时间
                    // 如果用户空闲了，减去超出空闲阈值的部分
                    toAdd = idle <= CONFIG.INTERVALS.READING_IDLE 
                        ? elapsed 
                        : Math.max(0, elapsed - (idle - CONFIG.INTERVALS.READING_IDLE) / 1000);
                    
                    // 额外防护：单次保存不能超过保存间隔的 1.5 倍（正常约45秒）
                    const maxToAdd = CONFIG.INTERVALS.READING_SAVE / 1000 * 1.5;
                    toAdd = Math.min(toAdd, maxToAdd);
                }
                
                // 无论是否是领导者，都更新 lastSave（避免时间累积）
                this.lastSave = now;
                
                // 只有领导者才写入 storage
                if (!TabLeader.isLeader()) return;

                let stored = this.storage.get('readingTime', null);

                if (!stored?.dailyData) {
                    stored = { version: 3, dailyData: {}, monthlyCache: {}, yearlyCache: {} };
                }

                let today = stored.dailyData[todayKey] || { totalMinutes: 0, lastActive: now, sessions: [] };

                const minutes = toAdd / 60;
                if (minutes > 0.1) {
                    today.totalMinutes += minutes;
                    today.lastActive = now;
                    today.sessions = (today.sessions || []).slice(-20); // 限制会话数量
                    today.sessions.push({ time: now, added: minutes });

                    stored.dailyData[todayKey] = today;
                    this._updateCache(stored, todayKey, minutes);
                    this._cleanOld(stored);
                    this.storage.set('readingTime', stored);
                    this._yearCache = null;
                }
            }

            _updateCache(stored, dateKey, minutes) {
                try {
                    const d = new Date(dateKey);
                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const yearKey = `${d.getFullYear()}`;
                    stored.monthlyCache[monthKey] = (stored.monthlyCache[monthKey] || 0) + minutes;
                    stored.yearlyCache[yearKey] = (stored.yearlyCache[yearKey] || 0) + minutes;
                } catch (e) {}
            }

            _cleanOld(stored) {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - CONFIG.CACHE.MAX_HISTORY_DAYS);

                Object.keys(stored.dailyData).forEach(key => {
                    if (new Date(key) < cutoff) delete stored.dailyData[key];
                });

                Object.keys(stored.monthlyCache || {}).forEach(key => {
                    const [y, m] = key.split('-');
                    if (new Date(+y, +m - 1, 1) < cutoff) delete stored.monthlyCache[key];
                });
            }

            getTodayTime() {
                if (!this.storage.getUser()) return 0;
                
                const stored = this.storage.get('readingTime', null);
                const saved = stored?.dailyData?.[Utils.getTodayKey()]?.totalMinutes || 0;
                
                const now = Date.now();
                const elapsed = (now - this.lastSave) / 1000;
                const idle = now - this.lastActivity;
                
                let unsaved = 0;
                if (idle <= CONFIG.INTERVALS.READING_IDLE) {
                    unsaved = elapsed / 60;
                } else {
                    unsaved = Math.max(0, elapsed - (idle - CONFIG.INTERVALS.READING_IDLE) / 1000) / 60;
                }

                return saved + Math.max(0, unsaved);
            }

            getTimeForDate(dateKey) {
                return this.storage.get('readingTime', null)?.dailyData?.[dateKey]?.totalMinutes || 0;
            }

            getWeekHistory() {
                const result = [];
                const now = new Date();
                
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(now);
                    d.setDate(d.getDate() - i);
                    const key = d.toDateString();
                    result.push({
                        date: key,
                        label: Utils.formatDate(d.getTime()),
                        day: CONFIG.WEEKDAYS[d.getDay()],
                        minutes: i === 0 ? this.getTodayTime() : this.getTimeForDate(key),
                        isToday: i === 0
                    });
                }
                return result;
            }

            getYearData() {
                const now = Date.now();
                if (this._yearCache && (now - this._yearCacheTime) < CONFIG.CACHE.YEAR_DATA_TTL) {
                    return this._yearCache;
                }

                const today = new Date();
                const year = today.getFullYear();
                const stored = this.storage.get('readingTime', null);
                const daily = stored?.dailyData || {};
                const result = new Map();

                Object.entries(daily).forEach(([key, data]) => {
                    if (new Date(key).getFullYear() === year) {
                        result.set(key, data.totalMinutes || 0);
                    }
                });
                result.set(Utils.getTodayKey(), this.getTodayTime());

                this._yearCache = result;
                this._yearCacheTime = now;
                return result;
            }

            getTotalTime() {
                const stored = this.storage.get('readingTime', null);
                if (!stored?.dailyData) return this.getTodayTime();

                const todayKey = Utils.getTodayKey();
                let total = 0;
                Object.entries(stored.dailyData).forEach(([key, data]) => {
                    total += key === todayKey ? this.getTodayTime() : (data.totalMinutes || 0);
                });
                return total;
            }
            
            destroy() {
                // 清除计时定时器
                this._intervals.forEach(id => clearInterval(id));
                this._intervals = [];
                this._tracking = false;
                
                // 清除健康检查定时器
                if (this._healthCheckId) {
                    clearInterval(this._healthCheckId);
                    this._healthCheckId = null;
                }
                
                // 移除普通事件监听器（注意：capture 必须与添加时一致）
                if (this._activityHandler && this._normalEvents) {
                    this._normalEvents.forEach(e => {
                        document.removeEventListener(e, this._activityHandler, { passive: true, capture: true });
                    });
                }
                // 移除高频事件监听器
                if (this._highFreqHandler && this._highFreqEvents) {
                    this._highFreqEvents.forEach(e => {
                        document.removeEventListener(e, this._highFreqHandler, { passive: true, capture: true });
                    });
                }
                if (this._visibilityHandler) {
                    document.removeEventListener('visibilitychange', this._visibilityHandler);
                }
                // 移除 Safari 兼容事件
                if (this._pageShowHandler) {
                    window.removeEventListener('pageshow', this._pageShowHandler);
                }
                if (this._pageHideHandler) {
                    window.removeEventListener('pagehide', this._pageHideHandler);
                }
                // 移除焦点事件
                if (this._focusHandler) {
                    window.removeEventListener('focus', this._focusHandler);
                    document.removeEventListener('focus', this._focusHandler);
                }
                if (this._blurHandler) {
                    window.removeEventListener('blur', this._blurHandler);
                }
                if (this._beforeUnloadHandler) {
                    window.removeEventListener('beforeunload', this._beforeUnloadHandler);
                }
                
                // 保存数据
                this.save();
            }
        }

        // ==================== 通知管理器 ====================
        class Notifier {
            constructor(storage) {
                this.storage = storage;
            }

            check(reqs) {
                const achieved = this.storage.get('milestones', {});
                const newMilestones = [];

                reqs.forEach(r => {
                    Object.entries(CONFIG.MILESTONES).forEach(([key, thresholds]) => {
                        if (r.name.includes(key)) {
                            thresholds.forEach(t => {
                                const k = `${key}_${t}`;
                                if (r.currentValue >= t && !achieved[k]) {
                                    newMilestones.push({ name: key, threshold: t });
                                    achieved[k] = true;
                                }
                            });
                        }
                    });

                    const reqKey = `req_${r.name}`;
                    if (r.isSuccess && !achieved[reqKey]) {
                        newMilestones.push({ name: r.name, type: 'req' });
                        achieved[reqKey] = true;
                    }
                });

                if (newMilestones.length) {
                    this.storage.set('milestones', achieved);
                    this._notify(newMilestones);
                }
            }

            _notify(milestones) {
                const last = this.storage.get('lastNotify', 0);
                if (Date.now() - last < 60000) return;
                
                this.storage.set('lastNotify', Date.now());
                const msg = milestones.slice(0, 3).map(m => 
                    m.type === 'req' ? `✅ ${m.name}` : `🏆 ${m.name} → ${m.threshold}`
                ).join('\n');

                typeof GM_notification !== 'undefined' && GM_notification({
                    title: '🎉 达成里程碑！',
                    text: msg,
                    timeout: 5000
                });
            }
        }

        // ==================== OAuth 管理器 ====================
        class OAuthManager {
            constructor(storage, network) {
                this.storage = storage;
                this.network = network;
            }

            getToken() { return this.storage.getGlobal('leaderboardToken', null); }
            setToken(token) { this.storage.setGlobalNow('leaderboardToken', token); }
            
            getUserInfo() { return this.storage.getGlobal('leaderboardUser', null); }
            setUserInfo(user) { this.storage.setGlobalNow('leaderboardUser', user); }
            
            /**
             * 检查是否已登录且 Token 未过期
             */
            isLoggedIn() {
                const token = this.getToken();
                const user = this.getUserInfo();
                if (!token || !user) return false;
                
                // 检查 token 是否过期
                if (this._isTokenExpired(token)) {
                    Logger.log('Token expired, logging out');
                    this.logout();
                    return false;
                }
                return true;
            }
            
            /**
             * 解析 JWT Token 检查是否过期
             */
            _isTokenExpired(token) {
                try {
                    const parts = token.split('.');
                    if (parts.length !== 3) return true;
                    
                    // 解析 payload (base64url)
                    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                    const decoded = JSON.parse(atob(payload));
                    
                    // 检查过期时间 (exp 是秒级时间戳)
                    if (!decoded.exp) return false; // 无过期时间则认为有效
                    
                    const now = Math.floor(Date.now() / 1000);
                    // 提前 10 分钟判断为过期，增加容错时间避免边界情况
                    return decoded.exp < (now + 600);
                } catch (e) {
                    console.error('[LDStatus Pro] Token parse error:', e);
                    return true; // 解析失败视为过期
                }
            }
            
            isJoined() { return this.storage.getGlobal('leaderboardJoined', false); }
            setJoined(v) { this.storage.setGlobalNow('leaderboardJoined', v); }

            /**
             * 检查 URL hash 中的登录结果
             * 统一同窗口登录模式：回调后通过 URL hash 传递登录结果
             */
            _checkUrlHashLogin() {
                try {
                    const hash = window.location.hash;
                    if (!hash) return null;
                    
                    // 查找 ldsp_oauth 参数
                    const match = hash.match(/ldsp_oauth=([^&]+)/);
                    if (!match) return null;
                    
                    const encoded = match[1];
                    // 解码 base64
                    const decoded = JSON.parse(decodeURIComponent(atob(encoded)));
                    
                    // 检查时效性（5分钟内有效）
                    if (decoded.ts && Date.now() - decoded.ts > 5 * 60 * 1000) {
                        console.log('[OAuth] URL login result expired');
                        this._clearUrlHash();
                        return null;
                    }
                    
                    // 转换为标准格式
                    const result = {
                        success: true,
                        token: decoded.t,
                        user: decoded.u,
                        isJoined: decoded.j === 1
                    };
                    
                    // 清除 URL 中的登录参数，保持 URL 干净
                    this._clearUrlHash();
                    
                    return result;
                } catch (e) {
                    console.error('[OAuth] Failed to parse URL hash login:', e);
                    this._clearUrlHash();
                    return null;
                }
            }
            
            /**
             * 清除 URL 中的 OAuth 登录参数
             */
            _clearUrlHash() {
                try {
                    const hash = window.location.hash;
                    if (!hash || !hash.includes('ldsp_oauth=')) return;
                    
                    // 移除 ldsp_oauth 参数
                    let newHash = hash.replace(/[#&]?ldsp_oauth=[^&]*/, '');
                    // 清理多余的 # 和 &
                    newHash = newHash.replace(/^[#&]+/, '').replace(/[#&]+$/, '');
                    
                    // 更新 URL（不触发页面刷新）
                    const newUrl = window.location.pathname + window.location.search + (newHash ? '#' + newHash : '');
                    history.replaceState(null, '', newUrl);
                } catch (e) {
                    console.warn('[OAuth] Failed to clear URL hash:', e);
                }
            }

            /**
             * 统一同窗口登录
             * 所有环境都使用同窗口跳转方式，避免弹窗拦截和跨窗口通信问题
             */
            async login() {
                // 检查是否有待处理的登录结果（从 URL hash 中获取）
                const pendingResult = this._checkUrlHashLogin();
                if (pendingResult?.success && pendingResult.token && pendingResult.user) {
                    this.setToken(pendingResult.token);
                    this.setUserInfo(pendingResult.user);
                    this.setJoined(pendingResult.isJoined || false);
                    return pendingResult.user;
                }

                // 获取授权链接并跳转（同窗口模式）
                const siteParam = encodeURIComponent(CURRENT_SITE.domain);
                // 使用不带 hash 的 URL 作为返回地址
                const returnUrl = encodeURIComponent(window.location.origin + window.location.pathname + window.location.search);
                
                try {
                    const result = await this.network.api(`/api/auth/init?site=${siteParam}&return_url=${returnUrl}`);
                    
                    if (result.success && result.data?.auth_url) {
                        // 跳转到授权页面
                        window.location.href = result.data.auth_url;
                        // 返回一个永不 resolve 的 Promise（页面会跳转，不会执行后续代码）
                        return new Promise(() => {});
                    } else {
                        throw new Error(result.error?.message || '获取授权链接失败');
                    }
                } catch (e) {
                    throw new Error(e.message || '登录请求失败');
                }
            }

            logout() {
                this.setToken(null);
                this.setUserInfo(null);
                this.setJoined(false);
            }

            /**
             * 发起 API 请求，自动处理 Token 过期
             * @param {string} endpoint - API 端点
             * @param {Object} options - 请求选项
             * @param {boolean} options.requireAuth - 是否需要登录（默认 true）
             */
            async api(endpoint, options = {}) {
                const { requireAuth = true, ...restOptions } = options;
                
                // 需要登录的接口，先检查登录状态（包含 Token 过期检测）
                if (requireAuth) {
                    const token = this.getToken();
                    // 无 Token 或 Token 已过期，直接返回错误
                    if (!token || this._isTokenExpired(token)) {
                        // 清理过期状态
                        if (token) this.logout();
                        return { success: false, error: { code: 'NOT_LOGGED_IN', message: 'Not logged in or token expired' } };
                    }
                }
                
                try {
                    const result = await this.network.api(endpoint, { ...restOptions, token: this.getToken() });
                    return result;
                } catch (e) {
                    // 检查是否是 Token 过期错误
                    const errMsg = e.message || '';
                    const isAuthError = errMsg.includes('expired') || errMsg.includes('TOKEN_EXPIRED') || 
                        errMsg.includes('INVALID_TOKEN') || errMsg.includes('401') ||
                        errMsg.includes('Unauthorized') || (e instanceof NetworkError && e.isAuth);
                    
                    if (isAuthError) {
                        this.logout();
                        // 通过事件总线通知（替代全局 window 事件）
                        EventBus.emit('auth:expired', { endpoint });
                    }
                    throw e;
                }
            }
        }

        // ==================== 排行榜管理器 ====================
        class LeaderboardManager {
            constructor(oauth, readingTracker, storage) {
                this.oauth = oauth;
                this.tracker = readingTracker;
                this.storage = storage;  // v3.2.7: 用于智能同步缓存
                this.cache = new Map();
                this._syncTimer = null;
                this._lastSync = 0;
                this._manualRefreshTime = new Map(); // 记录每种榜的手动刷新时间
            }

            // 手动刷新冷却时间 5 分钟
            static MANUAL_REFRESH_COOLDOWN = 5 * 60 * 1000;

            async getLeaderboard(type = 'daily') {
                const key = `lb_${type}`;
                const cached = this.cache.get(key);
                const now = Date.now();
                const ttlMap = {
                    daily: CONFIG.CACHE.LEADERBOARD_DAILY_TTL,
                    weekly: CONFIG.CACHE.LEADERBOARD_WEEKLY_TTL,
                    monthly: CONFIG.CACHE.LEADERBOARD_MONTHLY_TTL
                };
                const ttl = ttlMap[type] || CONFIG.CACHE.LEADERBOARD_DAILY_TTL;

                if (cached && (now - cached.time) < ttl) return cached.data;

                try {
                    // oauth.api() 内置登录检查，未登录时返回 { success: false }
                    const result = await this.oauth.api(`/api/leaderboard/${type}`);
                    if (result.success) {
                        const data = {
                            rankings: result.data.rankings || [],
                            period: result.data.period,
                            myRank: result.data.myRank
                        };
                        this.cache.set(key, { data, time: now });
                        return data;
                    }
                    throw new Error(result.error || '获取排行榜失败');
                } catch (e) {
                    if (cached) return cached.data;
                    throw e;
                }
            }

            // 手动刷新排行榜（有5分钟冷却时间）
            async forceRefresh(type = 'daily') {
                const key = `lb_${type}`;
                const now = Date.now();
                const lastRefresh = this._manualRefreshTime.get(type) || 0;

                // 检查冷却时间
                if (now - lastRefresh < LeaderboardManager.MANUAL_REFRESH_COOLDOWN) {
                    // 冷却中，返回缓存
                    const cached = this.cache.get(key);
                    if (cached) return { data: cached.data, fromCache: true };
                    throw new Error('刷新冷却中');
                }

                try {
                    const result = await this.oauth.api(`/api/leaderboard/${type}`);
                    if (result.success) {
                        const data = {
                            rankings: result.data.rankings || [],
                            period: result.data.period,
                            myRank: result.data.myRank
                        };
                        this.cache.set(key, { data, time: now });
                        this._manualRefreshTime.set(type, now);
                        return { data, fromCache: false };
                    }
                    throw new Error(result.error || '获取排行榜失败');
                } catch (e) {
                    const cached = this.cache.get(key);
                    if (cached) return { data: cached.data, fromCache: true };
                    throw e;
                }
            }

            // 获取手动刷新剩余冷却时间（秒）
            getRefreshCooldown(type = 'daily') {
                const lastRefresh = this._manualRefreshTime.get(type) || 0;
                const elapsed = Date.now() - lastRefresh;
                const remaining = LeaderboardManager.MANUAL_REFRESH_COOLDOWN - elapsed;
                return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
            }

            async join() {
                const result = await this.oauth.api('/api/user/register', { method: 'POST' });
                if (result.success) {
                    this.oauth.setJoined(true);
                    return true;
                }
                // 检测登录失效情况
                const errCode = result.error?.code;
                if (errCode === 'NOT_LOGGED_IN' || errCode === 'AUTH_EXPIRED' || errCode === 'INVALID_TOKEN') {
                    throw new Error('登录已失效，请重新登录');
                }
                throw new Error(result.error?.message || result.error || '加入失败');
            }

            async quit() {
                const result = await this.oauth.api('/api/user/quit', { method: 'POST' });
                if (result.success) {
                    this.oauth.setJoined(false);
                    return true;
                }
                // 检测登录失效情况
                const errCode = result.error?.code;
                if (errCode === 'NOT_LOGGED_IN' || errCode === 'AUTH_EXPIRED' || errCode === 'INVALID_TOKEN') {
                    throw new Error('登录已失效，请重新登录');
                }
                throw new Error(result.error?.message || result.error || '退出失败');
            }

            async syncReadingTime() {
                if (!this.oauth.isLoggedIn() || !this.oauth.isJoined()) return;
                // 只有领导者标签页才执行同步，避免多标签页重复请求
                if (!TabLeader.isLeader()) return;
                if (Date.now() - this._lastSync < 60000) return;

                try {
                    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                    const currentMinutes = this.tracker.getTodayTime();
                    
                    // v3.2.7 优化（方案E）：智能同步 - 只在数据变化时才发送请求
                    // 节省约 30% 的 D1 写入额度
                    const lastSyncedKey = `lastSynced_${today}`;
                    const lastSyncedMinutes = this.storage?.getGlobal(lastSyncedKey, -1) ?? -1;
                    
                    if (currentMinutes === lastSyncedMinutes) {
                        // 数据没变化，跳过同步
                        return;
                    }
                    
                    const result = await this.oauth.api('/api/reading/sync', {
                        method: 'POST',
                        body: { 
                            date: today,
                            minutes: currentMinutes,
                            client_timestamp: Date.now()
                        }
                    });
                    
                    // 登录失效或请求失败，不更新本地状态
                    if (!result?.success && !result?.server_minutes) {
                        return;
                    }
                    
                    this._lastSync = Date.now();
                    
                    // v3.4.2 修复：渐进同步 - 处理服务器截断响应
                    // 服务器防刷机制会限制单次增量，需要多次同步才能完成大幅增量
                    if (result && result.server_minutes !== undefined) {
                        // 以服务器实际接受的分钟数为准
                        const serverAccepted = result.server_minutes;
                        this.storage?.setGlobal(lastSyncedKey, serverAccepted);
                        
                        if (result.truncated && serverAccepted < currentMinutes) {
                            // 服务器截断了数据，需要继续同步
                            Logger.log(`Leaderboard sync truncated: server=${serverAccepted}, client=${currentMinutes}, will retry`);
                            // 35秒后再次尝试同步剩余数据（服务器限制是30秒）
                            setTimeout(() => {
                                this._lastSync = 0; // 重置冷却时间
                                this.syncReadingTime();
                            }, 35000);
                        } else if (result.rateLimited) {
                            // 被服务器限速，稍后重试
                            Logger.log('Leaderboard rate limited, will retry later');
                            setTimeout(() => {
                                this._lastSync = 0;
                                this.syncReadingTime();
                            }, 35000);
                        }
                    } else {
                        // 兼容旧版响应格式
                        this.storage?.setGlobal(lastSyncedKey, currentMinutes);
                    }
                } catch (e) {
                    console.warn('[Leaderboard] Sync failed:', e.message || e);
                }
            }

            startSync() {
                if (this._syncTimer) return;
                // 延迟5秒后首次同步，避免与页面加载时的其他请求并发
                setTimeout(() => this.syncReadingTime(), 5000);
                this._syncTimer = setInterval(() => this.syncReadingTime(), CONFIG.INTERVALS.LEADERBOARD_SYNC);
            }

            stopSync() {
                this._syncTimer && clearInterval(this._syncTimer);
                this._syncTimer = null;
            }

            clearCache() { this.cache.clear(); }
            
            destroy() {
                this.stopSync();
                this.clearCache();
            }
        }

        // ==================== 云同步管理器 ====================
        class CloudSyncManager {
            constructor(storage, oauth, tracker) {
                this.storage = storage;
                this.oauth = oauth;
                this.tracker = tracker;
                this._timer = null;
                this._syncing = false;
                this._lastUpload = storage.getGlobal('lastCloudSync', 0);
                this._lastDownload = storage.getGlobal('lastDownloadSync', 0);
                this._lastHash = storage.getGlobal('lastUploadHash', '');
                this._onSyncStateChange = null;  // 同步状态变化回调
                
                // 失败重试机制
                this._failureCount = { reading: 0, requirements: 0 };
                this._lastFailure = { reading: 0, requirements: 0 };
                
                // trust_level 缓存（避免重复调用 requirements 接口）
                this._trustLevelCache = storage.getGlobal('trustLevelCache', null);
                this._trustLevelCacheTime = storage.getGlobal('trustLevelCacheTime', 0);
            }
            
            // 计算退避延迟（指数退避，最大 30 分钟）
            _getBackoffDelay(type) {
                const failures = this._failureCount[type] || 0;
                if (failures === 0) return 0;
                const baseDelay = CONFIG.INTERVALS.SYNC_RETRY_DELAY || 60000;
                return Math.min(baseDelay * Math.pow(2, failures - 1), 30 * 60 * 1000);
            }
            
            // 检查是否可以重试
            _canRetry(type) {
                const lastFail = this._lastFailure[type] || 0;
                const backoff = this._getBackoffDelay(type);
                return Date.now() - lastFail >= backoff;
            }
            
            // 记录失败
            _recordFailure(type) {
                this._failureCount[type] = Math.min((this._failureCount[type] || 0) + 1, 6);
                this._lastFailure[type] = Date.now();
            }
            
            // 记录成功（重置失败计数）
            _recordSuccess(type) {
                this._failureCount[type] = 0;
                this._lastFailure[type] = 0;
            }
            
            // 检查用户 trust_level 是否足够
            // 优先从 OAuth 用户信息获取，其次使用缓存
            _hasSufficientTrustLevel() {
                // 1. 优先从 OAuth 用户信息获取 trust_level（最准确）
                // v3.4.7: 兼容 trust_level 和 trustLevel 两种命名格式
                const userInfo = this.oauth.getUserInfo();
                const trustLevel = userInfo?.trust_level ?? userInfo?.trustLevel;
                if (userInfo && typeof trustLevel === 'number') {
                    const hasTrust = trustLevel >= 2;
                    // 更新缓存以便其他地方使用
                    if (this._trustLevelCache !== hasTrust) {
                        this._updateTrustLevelCache(hasTrust);
                    }
                    return hasTrust;
                }
                
                // 2. 使用缓存（24小时有效）
                const now = Date.now();
                const cacheAge = now - this._trustLevelCacheTime;
                if (this._trustLevelCache !== null && cacheAge < 24 * 60 * 60 * 1000) {
                    return this._trustLevelCache;
                }
                
                // 3. 无法确定，返回 null（需要从 API 获取）
                return null;
            }
            
            // 更新 trust_level 缓存（兼容性保留）
            _updateTrustLevelCache(hasTrust) {
                // v3.4.8: 移除等级限制，始终缓存为 true
                this._trustLevelCache = true;
                this._trustLevelCacheTime = Date.now();
                this.storage.setGlobalNow('trustLevelCache', true);
                this.storage.setGlobalNow('trustLevelCacheTime', this._trustLevelCacheTime);
            }

            // 设置同步状态变化回调
            setSyncStateCallback(callback) {
                this._onSyncStateChange = callback;
            }

            // 更新同步状态
            _setSyncing(syncing) {
                this._syncing = syncing;
                this._onSyncStateChange?.(syncing);
            }

            // 获取同步状态
            isSyncing() {
                return this._syncing;
            }

            _getDataHash() {
                const data = this.storage.get('readingTime', null);
                if (!data?.dailyData) return '';
                const days = Object.keys(data.dailyData).length;
                const total = Object.values(data.dailyData).reduce((s, d) => s + (d.totalMinutes || 0), 0);
                return `${days}:${Math.round(total)}`;
            }

            async download() {
                // 检查退避延迟
                if (!this._canRetry('reading')) {
                    return null;
                }

                try {
                    const result = await this.oauth.api('/api/reading/history?days=365');
                    if (!result.success) {
                        this._recordFailure('reading');
                        return null;
                    }
                    
                    this._recordSuccess('reading');

                    const cloud = result.data.dailyData || {};
                    let local = this.storage.get('readingTime', null);

                    if (!local?.dailyData) {
                        local = { version: 3, dailyData: cloud, monthlyCache: {}, yearlyCache: {} };
                        this._rebuildCache(local);
                        this.storage.setNow('readingTime', local);
                        // 通知 UI 阅读数据已更新（新设备首次同步）
                        EventBus.emit('reading:synced', { merged: Object.keys(cloud).length, source: 'cloud' });
                        return { merged: Object.keys(cloud).length, source: 'cloud' };
                    }

                    let merged = 0;
                    Object.entries(cloud).forEach(([key, cloudDay]) => {
                        const localMinutes = local.dailyData[key]?.totalMinutes || 0;
                        const cloudMinutes = cloudDay.totalMinutes || 0;
                        if (cloudMinutes > localMinutes) {
                            local.dailyData[key] = {
                                totalMinutes: cloudMinutes,
                                lastActive: cloudDay.lastActive || Date.now(),
                                sessions: local.dailyData[key]?.sessions || []
                            };
                            merged++;
                        }
                    });

                    if (merged > 0) {
                        this._rebuildCache(local);
                        this.storage.setNow('readingTime', local);
                        // 通知 UI 阅读数据已更新
                        EventBus.emit('reading:synced', { merged, source: 'merge' });
                    }
                    return { merged, source: 'merge' };
                } catch (e) {
                    console.error('[CloudSync] Download failed:', e);
                    this._recordFailure('reading');
                    return null;
                }
            }

            async upload() {
                // 前置检查：登录状态 + 同步状态 + 数据有效性
                if (!this.oauth.isLoggedIn() || this._syncing) return null;
                
                const local = this.storage.get('readingTime', null);
                if (!local?.dailyData || Object.keys(local.dailyData).length === 0) {
                    return null;
                }
                
                // 检查退避延迟
                if (!this._canRetry('reading')) {
                    return null;
                }

                try {
                    this._setSyncing(true);

                    // 优化：只上传最近 90 天的数据，减少请求大小
                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - 90);
                    const cutoff = cutoffDate.toDateString();
                    
                    const recentData = {};
                    let count = 0;
                    for (const [key, value] of Object.entries(local.dailyData)) {
                        // 只保留最近90天的数据
                        try {
                            const date = new Date(key);
                            if (date >= cutoffDate && count < 100) { // 最多100条
                                recentData[key] = value;
                                count++;
                            }
                        } catch (e) {}
                    }
                    
                    if (Object.keys(recentData).length === 0) {
                        this._setSyncing(false);
                        return null;
                    }

                    const result = await this.oauth.api('/api/reading/sync-full', {
                        method: 'POST',
                        body: { dailyData: recentData, lastSyncTime: Date.now() }
                    });

                    if (result.success) {
                        this._lastUpload = Date.now();
                        this.storage.setGlobalNow('lastCloudSync', this._lastUpload);
                        this._recordSuccess('reading');
                        return result.data;
                    }
                    this._recordFailure('reading');
                    throw new Error(result.error || '上传失败');
                } catch (e) {
                    console.error('[CloudSync] Upload failed:', e);
                    this._recordFailure('reading');
                    return null;
                } finally {
                    this._setSyncing(false);
                }
            }

            async onPageLoad() {
                if (!this.oauth.isLoggedIn()) return;

                const now = Date.now();
                const local = this.storage.get('readingTime', null);
                const hasLocal = local?.dailyData && Object.keys(local.dailyData).length > 0;
                const isNew = !hasLocal || this._lastDownload === 0;

                // 串行执行同步请求，避免并发压力
                // 1. 下载检查（优先级最高）
                if (isNew || (now - this._lastDownload) > CONFIG.INTERVALS.CLOUD_DOWNLOAD) {
                    const result = await this.download();
                    if (result) {
                        this._lastDownload = now;
                        this.storage.setGlobalNow('lastDownloadSync', now);
                        if (isNew && result.merged > 0) this.tracker._yearCache = null;
                    }
                }

                // 2. 上传检查（仅在数据变化时）
                const hash = this._getDataHash();
                if (hash && hash !== this._lastHash && (now - this._lastUpload) > 5 * 60 * 1000) {
                    // 至少间隔 5 分钟才上传
                    const result = await this.upload();
                    if (result) {
                        this._lastHash = hash;
                        this.storage.setGlobalNow('lastUploadHash', hash);
                    }
                }

                this._startPeriodicSync();
            }

            async fullSync() {
                // 前置登录检查
                if (!this.oauth.isLoggedIn() || this._syncing) return;
                
                try {
                    this._setSyncing(true);
                    
                    await this.download();
                    this._lastDownload = Date.now();
                    this.storage.setGlobalNow('lastDownloadSync', this._lastDownload);

                    // 上传本地数据（只上传最近 90 天，减少请求大小）
                    const local = this.storage.get('readingTime', null);
                    if (local?.dailyData && Object.keys(local.dailyData).length > 0) {
                        const cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - 90);
                        
                        const recentData = {};
                        let count = 0;
                        for (const [key, value] of Object.entries(local.dailyData)) {
                            try {
                                const date = new Date(key);
                                if (date >= cutoffDate && count < 100) {
                                    recentData[key] = value;
                                    count++;
                                }
                            } catch (e) {}
                        }
                        
                        if (Object.keys(recentData).length > 0) {
                            const result = await this.oauth.api('/api/reading/sync-full', {
                                method: 'POST',
                                body: { dailyData: recentData, lastSyncTime: Date.now() }
                            });
                            if (result?.success) {
                                this._lastUpload = Date.now();
                                this.storage.setGlobalNow('lastCloudSync', this._lastUpload);
                            }
                        }
                    }
                    this._lastHash = this._getDataHash();
                    this.storage.setGlobalNow('lastUploadHash', this._lastHash);

                    this._startPeriodicSync();
                } finally {
                    this._setSyncing(false);
                }
            }

            _startPeriodicSync() {
                if (this._timer) return;
                this._timer = setInterval(async () => {
                    if (!this.oauth.isLoggedIn()) return;
                    // 只有领导者标签页才执行定期同步，避免多标签页重复请求
                    if (!TabLeader.isLeader()) return;
                    if (this._syncing) return; // 避免并发

                    const now = Date.now();
                    const hash = this._getDataHash();

                    // 上传检查：数据变化 + 间隔足够 + 不在退避期
                    if (hash !== this._lastHash && 
                        (now - this._lastUpload) > CONFIG.INTERVALS.CLOUD_UPLOAD &&
                        this._canRetry('reading')) {
                        const result = await this.upload();
                        if (result) {
                            this._lastHash = hash;
                            this.storage.setGlobalNow('lastUploadHash', hash);
                        }
                    }

                    // 下载检查：间隔足够 + 不在退避期
                    if ((now - this._lastDownload) > CONFIG.INTERVALS.CLOUD_DOWNLOAD &&
                        this._canRetry('reading')) {
                        const result = await this.download();
                        if (result) {
                            this._lastDownload = now;
                            this.storage.setGlobalNow('lastDownloadSync', now);
                        }
                    }
                }, CONFIG.INTERVALS.CLOUD_CHECK);
            }

            _rebuildCache(data) {
                data.monthlyCache = {};
                data.yearlyCache = {};
                Object.entries(data.dailyData).forEach(([key, day]) => {
                    try {
                        const d = new Date(key);
                        if (isNaN(d.getTime())) return;
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        const yearKey = `${d.getFullYear()}`;
                        const minutes = day.totalMinutes || 0;
                        data.monthlyCache[monthKey] = (data.monthlyCache[monthKey] || 0) + minutes;
                        data.yearlyCache[yearKey] = (data.yearlyCache[yearKey] || 0) + minutes;
                    } catch (e) {}
                });
            }

            // ==================== 升级要求历史同步 (trust_level >= 2) ====================

            /**
             * 设置 HistoryManager 引用（用于升级要求同步）
             */
            setHistoryManager(historyMgr) {
                this._historyMgr = historyMgr;
                // 兼容旧版本存储 key
                this._reqLastDownload = this.storage.getGlobal('lastReqDownload', 0);
                this._reqLastFullSync = this.storage.getGlobal('lastReqFullSync', 0) || 
                                        this.storage.getGlobal('lastReqSync', 0); // 兼容旧 key
                this._reqLastIncrementalSync = this.storage.getGlobal('lastReqIncrementalSync', 0);
            }

            /**
             * 获取升级要求历史数据的 hash
             */
            _getReqHash() {
                if (!this._historyMgr) return '';
                const history = this._historyMgr.getHistory();
                if (!history.length) return '';
                return `${history.length}:${history[history.length - 1].ts}`;
            }

            /**
             * 下载升级要求历史数据
             */
            async downloadRequirements() {
                // 前置检查：登录状态 + 只有领导者标签页执行
                if (!this.oauth.isLoggedIn() || !this._historyMgr) return null;
                if (!TabLeader.isLeader()) return null;
                
                // 检查退避延迟
                if (!this._canRetry('requirements')) {
                    return null;
                }

                try {
                    // 减少请求数据量：从 100 天减少到 60 天
                    const result = await this.oauth.api('/api/requirements/history?days=60');
                    
                    if (!result.success) {
                        // 权限不足（trust_level < 2）是正常情况，缓存结果避免重复请求
                        if (result.error?.code === 'INSUFFICIENT_TRUST_LEVEL') {
                            this._updateTrustLevelCache(false);
                            return null;
                        }
                        this._recordFailure('requirements');
                        return null;
                    }
                    
                    // 请求成功，说明有足够权限
                    this._updateTrustLevelCache(true);
                    this._recordSuccess('requirements');

                    const cloudHistory = result.data.history || [];
                    if (!cloudHistory.length) return { merged: 0, source: 'empty' };

                    let localHistory = this._historyMgr.getHistory();
                    const localByDay = new Map();
                    localHistory.forEach(h => {
                        const day = new Date(h.ts).toDateString();
                        localByDay.set(day, h);
                    });

                    let merged = 0;
                    cloudHistory.forEach(cloudRecord => {
                        const day = new Date(cloudRecord.ts).toDateString();
                        const localRecord = localByDay.get(day);

                        if (!localRecord) {
                            // 本地没有，添加云端数据
                            localHistory.push(cloudRecord);
                            merged++;
                        } else {
                            // 本地有，合并数据（取每个字段的较大值）
                            let changed = false;
                            for (const [key, cloudValue] of Object.entries(cloudRecord.data)) {
                                if (typeof cloudValue === 'number') {
                                    const localValue = localRecord.data[key] || 0;
                                    if (cloudValue > localValue) {
                                        localRecord.data[key] = cloudValue;
                                        changed = true;
                                    }
                                }
                            }
                            if (cloudRecord.readingTime > (localRecord.readingTime || 0)) {
                                localRecord.readingTime = cloudRecord.readingTime;
                                changed = true;
                            }
                            if (changed) merged++;
                        }
                    });

                    if (merged > 0) {
                        // 按时间排序
                        localHistory.sort((a, b) => a.ts - b.ts);
                        this.storage.set('history', localHistory);
                        this._historyMgr._history = localHistory;
                        this._historyMgr._historyTime = Date.now();
                        this._historyMgr.cache.clear();
                    }

                    return { merged, source: 'merge' };
                } catch (e) {
                    console.error('[CloudSync] Requirements download failed:', e);
                    this._recordFailure('requirements');
                    return null;
                }
            }

            /**
             * 增量同步当天的升级要求数据
             * @param {Object} todayRecord - 今天的历史记录 {ts, data, readingTime}
             */
            async syncTodayRequirements(todayRecord) {
                // 前置检查：登录状态 + 数据有效性
                if (!this.oauth.isLoggedIn() || !this._historyMgr) return null;
                if (!todayRecord?.data || Object.keys(todayRecord.data).length === 0) return null;
                
                // 检查退避延迟
                if (!this._canRetry('requirements')) {
                    return null;
                }

                try {
                    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                    const result = await this.oauth.api('/api/requirements/sync', {
                        method: 'POST',
                        body: { 
                            date: today,
                            requirements: todayRecord.data,
                            readingTime: todayRecord.readingTime || 0
                        }
                    });

                    if (result.success) {
                        this._reqLastIncrementalSync = Date.now();
                        this.storage.setGlobalNow('lastReqIncrementalSync', this._reqLastIncrementalSync);
                        this._updateTrustLevelCache(true);
                        this._recordSuccess('requirements');
                        return result.data;
                    }
                    
                    // 权限不足是正常情况，缓存结果
                    if (result.error?.code === 'INSUFFICIENT_TRUST_LEVEL') {
                        this._updateTrustLevelCache(false);
                        return null;
                    }
                    
                    this._recordFailure('requirements');
                    return null;
                } catch (e) {
                    console.error('[CloudSync] Requirements incremental sync failed:', e);
                    this._recordFailure('requirements');
                    return null;
                }
            }

            /**
             * 全量上传升级要求历史数据（仅在需要时调用）
             */
            async uploadRequirementsFull() {
                // 前置检查：登录状态 + 数据有效性
                if (!this.oauth.isLoggedIn() || !this._historyMgr || this._syncing) return null;
                
                const history = this._historyMgr.getHistory();
                if (!history.length) return null;
                
                // 检查退避延迟
                if (!this._canRetry('requirements')) {
                    return null;
                }

                try {
                    // 限制上传数据量，最多 60 天
                    const recentHistory = history.slice(-60);
                    
                    const result = await this.oauth.api('/api/requirements/sync-full', {
                        method: 'POST',
                        body: { history: recentHistory, lastSyncTime: Date.now() }
                    });

                    if (result.success) {
                        this._reqLastFullSync = Date.now();
                        this.storage.setGlobalNow('lastReqFullSync', this._reqLastFullSync);
                        this._updateTrustLevelCache(true);
                        this._recordSuccess('requirements');
                        return result.data;
                    }
                    
                    // 权限不足是正常情况，缓存结果
                    if (result.error?.code === 'INSUFFICIENT_TRUST_LEVEL') {
                        this._updateTrustLevelCache(false);
                        return null;
                    }
                    
                    this._recordFailure('requirements');
                    throw new Error(result.error?.message || '上传失败');
                } catch (e) {
                    console.error('[CloudSync] Requirements full upload failed:', e);
                    this._recordFailure('requirements');
                    return null;
                }
            }

            /**
             * 兼容旧调用 - 重定向到增量同步
             * @deprecated 使用 syncTodayRequirements 或 uploadRequirementsFull
             */
            async uploadRequirements() {
                // 获取今天的记录并进行增量同步
                const history = this._historyMgr?.getHistory() || [];
                const today = new Date().toDateString();
                const todayRecord = history.find(h => new Date(h.ts).toDateString() === today);
                return this.syncTodayRequirements(todayRecord);
            }

            /**
             * 页面加载时同步升级要求数据
             * 仅 trust_level >= 2 的用户可用
             * 
             * 优化策略（v3.3.1）：
             * 1. 增量同步：默认只同步当天数据（1小时间隔）
             * 2. 全量同步：仅在以下情况触发（12小时间隔）：
             *    - 首次登录（从未下载过云端数据）
             *    - 本地数据天数与云端不一致
             */
            async syncRequirementsOnLoad() {
                // 前置检查：登录状态 + 只有领导者标签页执行
                if (!this.oauth.isLoggedIn() || !this._historyMgr) return;
                if (!TabLeader.isLeader()) return;

                const now = Date.now();
                const localHistory = this._historyMgr.getHistory();
                const INCREMENTAL_INTERVAL = CONFIG.INTERVALS.REQ_SYNC_INCREMENTAL || 3600000; // 1小时
                const FULL_INTERVAL = CONFIG.INTERVALS.REQ_SYNC_FULL || 43200000; // 12小时
                
                // ========== 判断是否需要全量同步 ==========
                const isFirstTime = this._reqLastDownload === 0;
                const needFullSync = isFirstTime || (now - (this._reqLastFullSync || 0)) > FULL_INTERVAL;
                
                if (needFullSync) {
                    // 1. 先下载云端数据
                    const downloadResult = await this.downloadRequirements();
                    if (downloadResult) {
                        this._reqLastDownload = now;
                        this.storage.setGlobalNow('lastReqDownload', now);
                        
                        // 2. 如果本地有数据且云端数据较少，上传本地数据
                        const cloudDays = downloadResult.merged || 0;
                        const localDays = localHistory.length;
                        
                        if (localDays > 0 && (isFirstTime || localDays > cloudDays)) {
                            const uploadResult = await this.uploadRequirementsFull();
                            if (uploadResult) {
                                this._reqLastFullSync = now;
                                this.storage.setGlobalNow('lastReqFullSync', now);
                            }
                        } else {
                            this._reqLastFullSync = now;
                            this.storage.setGlobalNow('lastReqFullSync', now);
                        }
                    }
                    return;
                }
                
                // ========== 增量同步：只同步当天数据 ==========
                const lastIncremental = this._reqLastIncrementalSync || 0;
                if ((now - lastIncremental) < INCREMENTAL_INTERVAL) {
                    return;
                }
                
                // 获取今天的记录
                const today = new Date().toDateString();
                const todayRecord = localHistory.find(h => new Date(h.ts).toDateString() === today);
                
                if (todayRecord) {
                    await this.syncTodayRequirements(todayRecord);
                }
            }

            /**
             * 获取系统公告（公开接口，不需要登录）
             * @returns {Promise<{enabled: boolean, content: string, type: string}|null>}
             */
            async getAnnouncement() {
                try {
                    const response = await fetch(`${CONFIG.LEADERBOARD_API}/api/config/announcement`);
                    if (!response.ok) return null;
                    const result = await response.json();
                    if (result.success && result.data) {
                        return result.data;
                    }
                    return null;
                } catch (e) {
                    console.error('[CloudSync] Get announcement failed:', e);
                    return null;
                }
            }

            /**
             * 获取官网URL（公开接口，不需要登录）
             * 每天最多请求一次，使用本地缓存
             * @returns {Promise<string>} 官网URL
             */
            async getWebsiteUrl() {
                const DEFAULT_URL = 'https://ldspro.qzz.io/';
                const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
                
                try {
                    // 检查今日是否已请求过
                    const cachedDate = GM_getValue('ldsp_website_url_date', null);
                    const cachedUrl = GM_getValue('ldsp_website_url', null);
                    
                    if (cachedDate === today && cachedUrl) {
                        return cachedUrl;
                    }
                    
                    // 今日未请求，发起请求
                    const response = await fetch(`${CONFIG.LEADERBOARD_API}/api/config/website-url`);
                    if (!response.ok) {
                        // 请求失败，返回缓存或默认值
                        return cachedUrl || DEFAULT_URL;
                    }
                    
                    const result = await response.json();
                    if (result.success && result.data?.url) {
                        // 更新缓存
                        GM_setValue('ldsp_website_url', result.data.url);
                        GM_setValue('ldsp_website_url_date', today);
                        return result.data.url;
                    }
                    
                    return cachedUrl || DEFAULT_URL;
                } catch (e) {
                    console.error('[CloudSync] Get website URL failed:', e);
                    // 出错时返回缓存或默认值
                    const cachedUrl = GM_getValue('ldsp_website_url', null);
                    return cachedUrl || DEFAULT_URL;
                }
            }

            destroy() {
                this._timer && clearInterval(this._timer);
                this._timer = null;
            }
        }

        // ==================== 样式管理器 ====================
        const Styles = {
            _injected: false,

            inject() {
                if (this._injected) return;
                const cfg = Screen.getConfig();
                const style = document.createElement('style');
                style.id = 'ldsp-styles';
                style.textContent = this._css(cfg);
                document.head.appendChild(style);
                this._injected = true;
            },

            _css(c) {
                return `
    #ldsp-panel{--dur-fast:120ms;--dur:200ms;--dur-slow:350ms;--ease:cubic-bezier(.22,1,.36,1);--ease-circ:cubic-bezier(.85,0,.15,1);--ease-spring:cubic-bezier(.175,.885,.32,1.275);--ease-out:cubic-bezier(0,.55,.45,1);--bg:#12131a;--bg-card:rgba(24,26,36,.92);--bg-hover:rgba(38,42,56,.95);--bg-el:rgba(32,35,48,.88);--bg-glass:rgba(255,255,255,.02);--txt:#e4e6ed;--txt-sec:#9499ad;--txt-mut:#5d6275;--accent:#6b8cef;--accent-light:#8aa4f4;--accent2:#5bb5a6;--accent2-light:#7cc9bc;--accent3:#e07a8d;--grad:linear-gradient(135deg,#5a7de0 0%,#4a6bc9 100%);--grad-accent:linear-gradient(135deg,#4a6bc9,#3d5aaa);--grad-warm:linear-gradient(135deg,#e07a8d,#c9606e);--grad-gold:linear-gradient(135deg,#d4a853 0%,#c49339 100%);--ok:#5bb5a6;--ok-light:#7cc9bc;--ok-bg:rgba(91,181,166,.12);--err:#e07a8d;--err-light:#ea9aa8;--err-bg:rgba(224,122,141,.12);--warn:#d4a853;--warn-bg:rgba(212,168,83,.12);--border:rgba(255,255,255,.06);--border2:rgba(255,255,255,.1);--border-accent:rgba(107,140,239,.3);--shadow:0 20px 50px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.04);--shadow-lg:0 25px 70px rgba(0,0,0,.5),0 0 30px rgba(107,140,239,.06);--shadow-glow:0 0 20px rgba(107,140,239,.15);--glow-accent:0 0 15px rgba(107,140,239,.2);--scrollbar:rgba(140,150,175,.5);--scrollbar-hover:rgba(140,150,175,.7);--r-xs:4px;--r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:20px;--w:${c.width}px;--h:${c.maxHeight}px;--fs:${c.fontSize}px;--pd:${c.padding}px;--av:${c.avatarSize}px;--ring:${c.ringSize}px;display:flex;flex-direction:column;position:fixed;left:12px;top:80px;right:auto;width:var(--w);background:var(--bg);border-radius:var(--r-lg);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Noto Sans SC',sans-serif;font-size:var(--fs);color:var(--txt);box-shadow:var(--shadow);z-index:99999;overflow:hidden;border:1px solid var(--border);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
    #ldsp-panel,#ldsp-panel *{transition:opacity var(--dur) var(--ease),transform var(--dur) var(--ease);user-select:none;-webkit-font-smoothing:antialiased}
    #ldsp-panel{transform:translateZ(0);backface-visibility:hidden}
    #ldsp-panel input,#ldsp-panel textarea{cursor:text;user-select:text}
    #ldsp-panel [data-clickable],#ldsp-panel [data-clickable] *,#ldsp-panel button,#ldsp-panel a,#ldsp-panel .ldsp-tab,#ldsp-panel .ldsp-subtab,#ldsp-panel .ldsp-ring-lvl,#ldsp-panel .ldsp-rd-day-bar,#ldsp-panel .ldsp-year-cell:not(.empty),#ldsp-panel .ldsp-rank-item,#ldsp-panel .ldsp-ticket-item,#ldsp-panel .ldsp-ticket-type,#ldsp-panel .ldsp-ticket-tab,#ldsp-panel .ldsp-ticket-close,#ldsp-panel .ldsp-ticket-back,#ldsp-panel .ldsp-lb-refresh,#ldsp-panel .ldsp-modal-btn,#ldsp-panel .ldsp-lb-btn,#ldsp-panel .ldsp-update-bubble-close{cursor:pointer}
    #ldsp-panel.no-trans,#ldsp-panel.no-trans *{transition:none!important;animation-play-state:paused!important}
    #ldsp-panel.anim{transition:width var(--dur-slow) var(--ease),height var(--dur-slow) var(--ease),left var(--dur-slow) var(--ease),top var(--dur-slow) var(--ease)}
    #ldsp-panel.light{--bg:rgba(250,251,254,.97);--bg-card:rgba(245,247,252,.94);--bg-hover:rgba(238,242,250,.96);--bg-el:rgba(255,255,255,.94);--bg-glass:rgba(0,0,0,.012);--txt:#1e2030;--txt-sec:#4a5068;--txt-mut:#8590a6;--accent:#5070d0;--accent-light:#6b8cef;--accent2:#4a9e8f;--accent2-light:#5bb5a6;--ok:#4a9e8f;--ok-light:#5bb5a6;--ok-bg:rgba(74,158,143,.08);--err:#d45d6e;--err-light:#e07a8d;--err-bg:rgba(212,93,110,.08);--warn:#c49339;--warn-bg:rgba(196,147,57,.08);--border:rgba(0,0,0,.05);--border2:rgba(0,0,0,.08);--border-accent:rgba(80,112,208,.2);--shadow:0 20px 50px rgba(0,0,0,.07),0 0 0 1px rgba(0,0,0,.04);--shadow-lg:0 25px 70px rgba(0,0,0,.1);--glow-accent:0 0 15px rgba(80,112,208,.1);--scrollbar:var(--accent);--scrollbar-hover:var(--accent-light)}
    #ldsp-panel.collapsed{width:48px!important;height:48px!important;border-radius:var(--r-md);cursor:pointer;touch-action:none;background:linear-gradient(135deg,#7a9bf5 0%,#5a7de0 50%,#5bb5a6 100%);border:none;box-shadow:var(--shadow),0 0 20px rgba(107,140,239,.35)}
    #ldsp-panel.collapsed .ldsp-hdr{padding:0;justify-content:center;align-items:center;height:100%;background:0 0;min-height:0}
    #ldsp-panel.collapsed .ldsp-hdr-info{opacity:0;visibility:hidden;pointer-events:none;position:absolute;transform:translateX(-10px)}
    #ldsp-panel.collapsed .ldsp-body{display:none!important}
    #ldsp-panel.collapsed .ldsp-hdr-btns>button:not(.ldsp-toggle){opacity:0;visibility:hidden;pointer-events:none;transform:scale(0.8);position:absolute}
    #ldsp-panel.collapsed .ldsp-hdr-btns{justify-content:center;width:100%;height:100%;margin-left:0}
    #ldsp-panel.collapsed,#ldsp-panel.collapsed *{cursor:pointer!important}
    #ldsp-panel.collapsed .ldsp-toggle{width:100%;height:100%;font-size:18px;background:0 0;display:flex;align-items:center;justify-content:center;color:#fff;position:absolute;inset:0;margin:0;padding:0;box-sizing:border-box}
    #ldsp-panel.collapsed .ldsp-toggle .ldsp-toggle-arrow{display:none}
    #ldsp-panel.collapsed .ldsp-toggle .ldsp-toggle-logo{display:block;width:24px;height:24px;filter:brightness(1.05) drop-shadow(0 0 2px rgba(140,180,255,.2));transition:filter .2s var(--ease),transform .2s var(--ease)}
    #ldsp-panel:not(.collapsed) .ldsp-toggle .ldsp-toggle-logo{display:none}
    @media (hover:hover){#ldsp-panel.collapsed:hover{transform:scale(1.08);box-shadow:var(--shadow-lg),0 0 35px rgba(120,160,255,.6)}#ldsp-panel.collapsed:hover .ldsp-toggle-logo{filter:brightness(1.6) drop-shadow(0 0 12px rgba(160,200,255,1)) drop-shadow(0 0 20px rgba(140,180,255,.8));transform:scale(1.15) rotate(360deg);transition:filter .3s var(--ease),transform .6s var(--ease-spring)}}
    #ldsp-panel.collapsed:active .ldsp-toggle-logo{filter:brightness(2) drop-shadow(0 0 16px rgba(200,230,255,1)) drop-shadow(0 0 30px rgba(160,200,255,1));transform:scale(0.92)}
    #ldsp-panel.collapsed.no-hover-effect{transform:none!important}#ldsp-panel.collapsed.no-hover-effect .ldsp-toggle-logo{filter:brightness(1.05) drop-shadow(0 0 2px rgba(140,180,255,.2))!important;transform:none!important}
    .ldsp-hdr{display:flex;align-items:center;padding:10px 12px;background:var(--grad);cursor:move;user-select:none;touch-action:none;position:relative;gap:8px;min-height:52px;box-sizing:border-box;flex-shrink:0}
    .ldsp-hdr::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.1) 0%,transparent 100%);pointer-events:none}
    .ldsp-hdr::after{content:'';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(circle,rgba(255,255,255,.1) 0%,transparent 60%);opacity:0;transition:opacity .5s;pointer-events:none}
    .ldsp-hdr:hover::after{opacity:1}
    .ldsp-hdr-info{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto;position:relative;z-index:1;transition:opacity .25s var(--ease),visibility .25s,transform .25s var(--ease);overflow:hidden}
    .ldsp-site-wrap{display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0;position:relative}
    .ldsp-site-icon{width:26px;height:26px;border-radius:7px;border:2px solid rgba(255,255,255,.25);flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.2)}
    .ldsp-hdr-text{display:flex;flex-direction:column;align-items:flex-start;gap:1px;min-width:0;flex:1 1 0;overflow:hidden}
    .ldsp-title{font-weight:800;font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;letter-spacing:-.02em;text-shadow:0 1px 2px rgba(0,0,0,.2);max-width:100%}
    .ldsp-ver{font-size:10px;color:rgba(255,255,255,.6);line-height:1.2;display:flex;align-items:center;gap:4px;overflow:hidden;max-width:100%}
    .ldsp-learn-trust{display:block;text-align:center;margin-top:8px;font-size:10px;color:var(--txt-dim);text-decoration:none;opacity:.6;transition:opacity .15s,color .15s}
    .ldsp-learn-trust:hover{opacity:1;color:var(--txt-sec)}
    .ldsp-app-name{font-size:10px;font-weight:700;white-space:nowrap;background:linear-gradient(90deg,#a8c0f8,#7a9eef,#7cc9bc,#7a9eef,#a8c0f8);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:gradient-shift 6s ease infinite;will-change:background-position}
    @keyframes gradient-shift{0%{background-position:0% center}50%{background-position:100% center}100%{background-position:0% center}}
    .ldsp-ver-num{background:rgba(255,255,255,.2);padding:2px 8px;border-radius:10px;color:#fff;font-weight:600;font-size:9px;backdrop-filter:blur(4px)}
    .ldsp-site-ver{font-size:9px;color:#fff;text-align:center;font-weight:700;background:rgba(0,0,0,.25);padding:1px 5px;border-radius:5px;letter-spacing:.02em}
    .ldsp-hdr-btns{display:flex;gap:4px;flex-shrink:0;position:relative;z-index:1;margin-left:auto}
    .ldsp-hdr-btns button{width:28px;height:28px;border:none;background:rgba(255,255,255,.12);color:#fff;border-radius:var(--r-sm);font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;outline:none;-webkit-tap-highlight-color:transparent;backdrop-filter:blur(4px);transition:transform .25s var(--ease),background .15s,box-shadow .2s,opacity .2s,visibility .2s}
    .ldsp-hdr-btns button:hover{background:rgba(255,255,255,.25);transform:translateY(-2px) scale(1.05);box-shadow:0 4px 12px rgba(0,0,0,.2)}
    .ldsp-hdr-btns button:active{transform:translateY(0) scale(.95)}
    .ldsp-hdr-btns button:focus{outline:none}
    .ldsp-hdr-btns button:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
    .ldsp-hdr-btns button.has-update{background:linear-gradient(135deg,var(--ok),var(--ok-light));animation:pulse-update 3s ease-in-out infinite;position:relative;box-shadow:0 0 15px rgba(16,185,129,.4)}
    .ldsp-hdr-btns button.has-update::after{content:'';position:absolute;top:-3px;right:-3px;width:10px;height:10px;background:var(--err);border-radius:50%;border:2px solid rgba(0,0,0,.2);animation:pulse-dot 2.5s ease infinite}
    @keyframes pulse-update{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
    @keyframes pulse-dot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.15);opacity:.8}}
    .ldsp-update-bubble{position:absolute;top:52px;left:50%;transform:translateX(-50%) translateY(-10px);background:var(--bg-card);border:1px solid var(--border-accent);border-radius:var(--r-md);padding:16px 18px;text-align:center;z-index:100;box-shadow:var(--shadow-lg),var(--glow-accent);opacity:0;pointer-events:none;transition:transform .3s var(--ease-spring),opacity .3s var(--ease);max-width:calc(100% - 24px);width:220px;backdrop-filter:blur(16px);will-change:transform,opacity}
    .ldsp-update-bubble::before{content:'';position:absolute;top:-7px;left:50%;transform:translateX(-50%) rotate(45deg);width:12px;height:12px;background:var(--bg-card);border-left:1px solid var(--border-accent);border-top:1px solid var(--border-accent)}
    .ldsp-update-bubble.show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto}
    .ldsp-update-bubble-close{position:absolute;top:8px;right:10px;font-size:16px;color:var(--txt-mut);transition:color .15s,background .15s;line-height:1;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:50%}
    .ldsp-update-bubble-close:hover{color:var(--txt);background:var(--bg-hover)}
    .ldsp-update-bubble-icon{font-size:28px;margin-bottom:8px;animation:bounce-in .5s var(--ease-spring)}
    @keyframes bounce-in{0%{transform:scale(0)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
    .ldsp-update-bubble-title{font-size:13px;font-weight:700;margin-bottom:6px;color:var(--txt);letter-spacing:-.01em}
    .ldsp-update-bubble-ver{font-size:11px;margin-bottom:12px;color:var(--txt-sec)}
    .ldsp-update-bubble-btn{background:var(--grad);color:#fff;border:none;padding:8px 20px;border-radius:20px;font-size:12px;font-weight:600;transition:transform .2s var(--ease),box-shadow .2s;box-shadow:0 4px 15px rgba(107,140,239,.3)}
    .ldsp-update-bubble-btn:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 6px 20px rgba(107,140,239,.4)}
    .ldsp-update-bubble-btn:active{transform:translateY(0) scale(.98)}
    .ldsp-update-bubble-btn:disabled{opacity:.6;cursor:not-allowed;transform:none!important}
    .ldsp-body{background:var(--bg);position:relative;overflow:hidden;display:flex;flex-direction:column;flex:1;min-height:0}
    .ldsp-announcement{overflow:hidden;background:linear-gradient(90deg,rgba(59,130,246,.1),rgba(107,140,239,.1));border-bottom:1px solid var(--border);padding:0;height:0;opacity:0;transition:height .3s var(--ease),opacity .3s,padding .3s;flex-shrink:0}
    .ldsp-announcement.active{height:24px;min-height:24px;opacity:1;padding:0 10px}
    .ldsp-announcement.warning{background:linear-gradient(90deg,rgba(245,158,11,.15),rgba(239,68,68,.08))}
    .ldsp-announcement.success{background:linear-gradient(90deg,rgba(16,185,129,.12),rgba(34,197,94,.08))}
    .ldsp-announcement-inner{display:flex;align-items:center;height:24px;white-space:nowrap;animation:marquee var(--marquee-duration,20s) linear forwards}
    .ldsp-announcement-inner:hover{animation-play-state:paused}
    .ldsp-announcement-text{font-size:11px;font-weight:500;color:var(--txt-sec);display:flex;align-items:center;gap:6px;padding-right:50px}
    .ldsp-announcement-text::before{content:'📢';font-size:12px}
    .ldsp-announcement.warning .ldsp-announcement-text::before{content:'⚠️'}
    .ldsp-announcement.success .ldsp-announcement-text::before{content:'🎉'}
    @keyframes marquee{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
    .ldsp-user{display:flex;align-items:stretch;gap:10px;padding:10px var(--pd) 24px;background:var(--bg-card);border-bottom:1px solid var(--border);position:relative;overflow:hidden;flex-shrink:0}
    .ldsp-user::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.3}
    .ldsp-user-left{display:flex;flex-direction:column;flex:1;min-width:0;gap:8px}
    .ldsp-user-row{display:flex;align-items:center;gap:10px}
    .ldsp-user-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
    .ldsp-avatar{width:var(--av);height:var(--av);border-radius:12px;border:2px solid var(--accent);flex-shrink:0;background:var(--bg-el);position:relative;box-shadow:0 4px 12px rgba(107,140,239,.2);transition:transform .3s var(--ease),box-shadow .3s,border-color .2s}
    .ldsp-avatar:hover{transform:scale(1.08) rotate(-3deg);border-color:var(--accent-light);box-shadow:0 6px 20px rgba(107,140,239,.35),var(--glow-accent)}
    .ldsp-avatar-ph{width:var(--av);height:var(--av);border-radius:12px;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;flex-shrink:0;transition:transform .3s var(--ease),box-shadow .3s;position:relative;box-shadow:0 4px 12px rgba(107,140,239,.25)}
    .ldsp-avatar-ph:hover{transform:scale(1.08) rotate(-3deg);box-shadow:0 6px 20px rgba(107,140,239,.4)}
    .ldsp-avatar-wrap{position:relative;flex-shrink:0}
    .ldsp-avatar-wrap::after{content:'🔗 GitHub';position:absolute;bottom:-20px;left:50%;transform:translateX(-50%) translateY(4px);background:var(--bg-el);color:var(--txt-sec);padding:3px 8px;border-radius:6px;font-size:8px;white-space:nowrap;opacity:0;pointer-events:none;transition:transform .2s var(--ease),opacity .2s;border:1px solid var(--border2);box-shadow:0 4px 12px rgba(0,0,0,.2)}
    .ldsp-avatar-wrap:hover::after{opacity:1;transform:translateX(-50%) translateY(0)}
    .ldsp-user-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .ldsp-user-display-name{font-weight:700;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;letter-spacing:-.01em;background:linear-gradient(135deg,var(--txt) 0%,var(--txt-sec) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    .ldsp-user-handle{font-size:12px;color:var(--txt-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
    .ldsp-user.not-logged .ldsp-avatar,.ldsp-user.not-logged .ldsp-avatar-ph{border:2px dashed var(--warn);animation:pulse-border 3s ease infinite}
    @keyframes pulse-border{0%,100%{border-color:var(--warn)}50%{border-color:rgba(245,158,11,.5)}}
    @keyframes pulse-border-red{0%,100%{border-color:#ef4444}50%{border-color:rgba(239,68,68,.4)}}
    .ldsp-user.not-logged .ldsp-user-display-name{color:var(--warn);-webkit-text-fill-color:var(--warn)}
    .ldsp-login-hint{font-size:9px;color:var(--warn);margin-left:4px;animation:blink 2.5s ease-in-out infinite;background:var(--warn-bg);padding:2px 6px;border-radius:8px;font-weight:500}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.7}}
    .ldsp-user-meta{display:flex;align-items:center;gap:8px;margin-top:3px}

    .ldsp-reading{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 12px;border-radius:var(--r-md);min-width:70px;position:relative;overflow:visible;border:1px solid var(--border);transition:background .2s,border-color .2s,box-shadow .3s}
    .ldsp-reading::before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.05) 0%,transparent 100%);pointer-events:none}
    .ldsp-reading-icon{font-size:20px;margin-bottom:3px;animation:bounce 3s ease-in-out infinite;filter:drop-shadow(0 2px 4px rgba(0,0,0,.2));will-change:transform}
    @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
    .ldsp-reading-time{font-size:13px;font-weight:800;letter-spacing:-.02em}
    .ldsp-reading-label{font-size:9px;opacity:.85;margin-top:2px;font-weight:600;letter-spacing:.02em}
    .ldsp-reading{--rc:#94a3b8}
    .ldsp-reading::after{content:'未活动 已停止记录';position:absolute;bottom:-16px;left:50%;transform:translateX(-50%);font-size:8px;color:var(--err);white-space:nowrap;font-weight:600;letter-spacing:.02em;opacity:.8}
    .ldsp-reading.tracking{animation:reading-glow 3.5s ease-in-out infinite;will-change:box-shadow}
    .ldsp-reading.tracking::after{content:'阅读时间记录中...';color:var(--rc);opacity:1}
    @keyframes reading-glow{0%,100%{box-shadow:0 0 8px color-mix(in srgb,var(--rc) 40%,transparent),0 0 16px color-mix(in srgb,var(--rc) 20%,transparent),0 0 24px color-mix(in srgb,var(--rc) 10%,transparent)}50%{box-shadow:0 0 16px color-mix(in srgb,var(--rc) 60%,transparent),0 0 32px color-mix(in srgb,var(--rc) 35%,transparent),0 0 48px color-mix(in srgb,var(--rc) 15%,transparent)}}
    .ldsp-reading-ripple{position:absolute;inset:-2px;border-radius:inherit;pointer-events:none;z-index:-1;opacity:0}
    .ldsp-reading.tracking .ldsp-reading-ripple{opacity:1}
    .ldsp-reading.tracking .ldsp-reading-ripple::before,.ldsp-reading.tracking .ldsp-reading-ripple::after{content:'';position:absolute;inset:0;border-radius:inherit;border:2px solid var(--rc);opacity:.5;animation:ripple-expand 4s ease-out infinite;will-change:transform,opacity}
    .ldsp-reading.tracking .ldsp-reading-ripple::after{animation-delay:2s}
    @keyframes ripple-expand{0%{transform:scale(1);opacity:.5;border-width:2px}100%{transform:scale(1.4);opacity:0;border-width:1px}}
    .ldsp-reading.hi{box-shadow:0 0 20px rgba(249,115,22,.2)}
    .ldsp-reading.hi .ldsp-reading-icon{animation:fire 1.2s ease-in-out infinite;will-change:transform}
    @keyframes fire{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
    .ldsp-reading.max{box-shadow:0 0 25px rgba(236,72,153,.25)}
    .ldsp-reading.max .ldsp-reading-icon{animation:crown 2s ease-in-out infinite;will-change:transform}
    @keyframes crown{0%,100%{transform:rotate(-5deg) scale(1)}50%{transform:rotate(5deg) scale(1.1)}}

    .ldsp-tabs{display:flex;padding:10px 12px;gap:8px;background:var(--bg);border-bottom:1px solid var(--border);flex-shrink:0}
    .ldsp-tab{flex:1;padding:8px 12px;border:none;background:var(--bg-card);color:var(--txt-sec);border-radius:var(--r-sm);font-size:11px;font-weight:600;transition:background .15s,color .15s,border-color .15s,box-shadow .2s;border:1px solid transparent;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:4px;min-width:0}
    .ldsp-tab .ldsp-tab-icon{flex-shrink:0}
    .ldsp-tab .ldsp-tab-text{overflow:hidden;text-overflow:ellipsis}
    .ldsp-tab:hover{background:var(--bg-hover);color:var(--txt);border-color:var(--border2);transform:translateY(-1px)}
    .ldsp-tab.active{background:var(--grad);color:#fff;box-shadow:0 4px 15px rgba(107,140,239,.3);border-color:transparent}
    @media (max-width:340px){.ldsp-tab{font-size:10px;padding:6px 8px;gap:3px}.ldsp-tab .ldsp-tab-icon{display:none}}
    @media (max-width:280px){.ldsp-tab{font-size:9px;padding:5px 6px}}
    .ldsp-content{flex:1 1 auto;min-height:0;max-height:calc(var(--h) - 180px);overflow-y:auto;scrollbar-width:thin;scrollbar-color:transparent transparent}
    .ldsp-content.scrolling{scrollbar-color:var(--scrollbar) transparent}
    .ldsp-content::-webkit-scrollbar{width:6px;background:transparent}
    .ldsp-content::-webkit-scrollbar-track{background:transparent}
    .ldsp-content::-webkit-scrollbar-thumb{background:transparent;border-radius:4px;transition:background .3s}
    .ldsp-content.scrolling::-webkit-scrollbar-thumb{background:var(--scrollbar)}
    .ldsp-content::-webkit-scrollbar-button{width:0;height:0;display:none}
    .ldsp-section{display:none;padding:10px}
    .ldsp-section.active{display:block;animation:enter var(--dur) var(--ease-out)}
    @keyframes enter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
    .ldsp-ring{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-card);border-radius:var(--r-md);margin-bottom:10px;position:relative;overflow:hidden;border:1px solid var(--border);gap:12px}
    .ldsp-ring::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 0%,rgba(107,140,239,.08) 0%,transparent 70%);pointer-events:none}
    .ldsp-ring-stat{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:50px;gap:4px;z-index:1}
    .ldsp-ring-stat-val{font-size:18px;font-weight:800;letter-spacing:-.02em}
    .ldsp-ring-stat-val.ok{color:var(--ok)}
    .ldsp-ring-stat-val.fail{color:var(--err)}
    .ldsp-ring-stat-lbl{font-size:9px;color:var(--txt-mut);font-weight:500;white-space:nowrap}
    .ldsp-ring-center{display:flex;flex-direction:column;align-items:center;position:relative}
    .ldsp-ring-wrap{position:relative;width:var(--ring);height:var(--ring)}
    .ldsp-ring-wrap svg{transform:rotate(-90deg);width:100%;height:100%;overflow:visible}
    .ldsp-ring-bg{fill:none;stroke:var(--bg-el);stroke-width:7}
    .ldsp-ring-fill{fill:none;stroke:url(#ldsp-grad);stroke-width:7;stroke-linecap:round;transition:stroke-dashoffset 1s var(--ease)}
    .ldsp-ring-fill.anim{animation:ring 1.5s var(--ease) forwards}
    @keyframes ring{from{stroke-dashoffset:var(--circ)}to{stroke-dashoffset:var(--off)}}
    .ldsp-ring-txt{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
    .ldsp-ring-val{font-size:clamp(12px,calc(var(--ring) * 0.2),18px);font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-.02em}
    .ldsp-ring-val.anim{animation:val 1s var(--ease-spring) .5s forwards;opacity:0}
    @keyframes val{from{opacity:0;transform:scale(.6)}60%{transform:scale(1.1)}to{opacity:1;transform:scale(1)}}
    .ldsp-ring-lbl{font-size:9px;color:var(--txt-mut);margin-top:2px;font-weight:500}
    .ldsp-ring-lvl{font-size:12px;font-weight:700;margin-top:8px;padding:4px 14px;border-radius:12px;background-image:linear-gradient(90deg,#64748b 0%,#94a3b8 50%,#64748b 100%);background-size:200% 100%;background-position:0% 50%;color:#fff;box-shadow:0 2px 10px rgba(100,116,139,.35);letter-spacing:.03em;text-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform 2s ease;transform-style:preserve-3d;animation:lvl-shimmer 6s ease-in-out infinite;will-change:background-position}
    .ldsp-ring-lvl:hover{transform:rotateY(360deg);animation-play-state:paused}
    .ldsp-ring-lvl.lv1{background-image:linear-gradient(90deg,#64748b 0%,#94a3b8 50%,#64748b 100%);box-shadow:0 2px 10px rgba(100,116,139,.35);animation-duration:4s}
    .ldsp-ring-lvl.lv2{background-image:linear-gradient(90deg,#3b82f6 0%,#60a5fa 50%,#3b82f6 100%);box-shadow:0 2px 10px rgba(59,130,246,.4);animation-duration:3.5s}
    .ldsp-ring-lvl.lv3{background-image:linear-gradient(90deg,#5070d0 0%,#8aa4f4 30%,#5bb5a6 70%,#5070d0 100%);box-shadow:0 2px 12px rgba(107,140,239,.45);animation-duration:3s}
    .ldsp-ring-lvl.lv4{background-image:linear-gradient(90deg,#f59e0b 0%,#fbbf24 25%,#f97316 50%,#ef4444 75%,#f59e0b 100%);box-shadow:0 2px 15px rgba(245,158,11,.5),0 0 20px rgba(249,115,22,.3);animation-duration:2.5s;animation-name:lvl-shimmer-gold}
    @keyframes lvl-shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
    @keyframes lvl-shimmer-gold{0%,100%{background-position:0% 50%;filter:brightness(1)}50%{background-position:100% 50%;filter:brightness(1.2)}}
    .ldsp-confetti{position:absolute;width:100%;height:100%;top:0;left:0;pointer-events:none;overflow:visible;z-index:10}
    .ldsp-confetti-piece{position:absolute;font-size:12px;opacity:0;top:42%;left:50%;transform-origin:center center;text-shadow:0 1px 3px rgba(0,0,0,.3)}
    .ldsp-ring.complete.anim-done .ldsp-confetti-piece{animation:confetti-burst 2s cubic-bezier(.15,.8,.3,1) forwards}
    @keyframes confetti-burst{0%{opacity:1;transform:translate(-50%,-50%) scale(0)}5%{opacity:1;transform:translate(-50%,-50%) scale(1.5)}25%{opacity:1;transform:translate(calc(var(--tx) * 1.2),calc(var(--ty) * 1.2)) rotate(calc(var(--rot) * 0.4)) scale(1.1)}100%{opacity:0;transform:translate(calc(var(--tx) + var(--drift)),calc(var(--ty) + 110px)) rotate(var(--rot)) scale(0.2)}}
    .ldsp-ring-tip{font-size:11px;text-align:center;margin:12px 0 16px;padding:8px 14px;border-radius:20px;font-weight:600;letter-spacing:.02em}
    .ldsp-ring-tip.ok{color:var(--ok);background:linear-gradient(135deg,var(--ok-bg),rgba(16,185,129,.05));border:1px solid rgba(16,185,129,.2)}
    .ldsp-ring-tip.progress{color:var(--accent);background:linear-gradient(135deg,rgba(107,140,239,.1),rgba(6,182,212,.05));border:1px solid rgba(107,140,239,.2)}
    .ldsp-ring-tip.max{color:var(--warn);background:linear-gradient(135deg,rgba(251,191,36,.1),rgba(249,115,22,.05));border:1px solid rgba(251,191,36,.25)}
    .ldsp-item{display:flex;align-items:center;padding:8px 10px;margin-bottom:6px;background:var(--bg-card);border-radius:var(--r-sm);border-left:3px solid var(--border2);animation:item var(--dur) var(--ease-out) backwards;transition:background .15s,border-color .15s,transform .2s var(--ease);border:1px solid var(--border);border-left-width:3px}
    .ldsp-item:nth-child(1){animation-delay:0ms}.ldsp-item:nth-child(2){animation-delay:25ms}.ldsp-item:nth-child(3){animation-delay:50ms}.ldsp-item:nth-child(4){animation-delay:75ms}.ldsp-item:nth-child(5){animation-delay:100ms}.ldsp-item:nth-child(6){animation-delay:125ms}.ldsp-item:nth-child(7){animation-delay:150ms}.ldsp-item:nth-child(8){animation-delay:175ms}.ldsp-item:nth-child(9){animation-delay:200ms}.ldsp-item:nth-child(10){animation-delay:225ms}.ldsp-item:nth-child(11){animation-delay:250ms}.ldsp-item:nth-child(12){animation-delay:275ms}
    @keyframes item{from{opacity:0;transform:translateX(-15px)}to{opacity:1;transform:none}}
    .ldsp-item:hover{background:var(--bg-hover);transform:translateX(4px);box-shadow:0 4px 12px rgba(0,0,0,.1)}
    .ldsp-item.ok{border-left-color:var(--ok);background:linear-gradient(135deg,var(--ok-bg) 0%,transparent 100%)}
    .ldsp-item.fail{border-left-color:var(--err);background:linear-gradient(135deg,var(--err-bg) 0%,transparent 100%)}
    .ldsp-item-icon{font-size:12px;margin-right:8px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--bg-el)}
    .ldsp-item.ok .ldsp-item-icon{background:var(--ok-bg);color:var(--ok)}
    .ldsp-item.fail .ldsp-item-icon{background:var(--err-bg);color:var(--err)}
    .ldsp-item-name{flex:1;font-size:11px;color:var(--txt-sec);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
    .ldsp-item.ok .ldsp-item-name{color:var(--ok)}
    .ldsp-item-vals{display:flex;align-items:center;gap:3px;font-size:12px;font-weight:700;margin-left:8px}
    .ldsp-item-cur{color:var(--txt);transition:color .2s}
    .ldsp-item-cur.upd{animation:upd .7s var(--ease-spring)}
    @keyframes upd{0%{transform:scale(1)}30%{transform:scale(1.3);background:var(--accent);color:#fff;border-radius:6px;padding:0 4px}100%{transform:scale(1)}}
    .ldsp-item.ok .ldsp-item-cur{color:var(--ok)}
    .ldsp-item.fail .ldsp-item-cur{color:var(--err)}
    .ldsp-item-sep{color:var(--txt-mut);font-weight:400;opacity:.6}
    .ldsp-item-req{color:var(--txt-mut);font-weight:500}
    .ldsp-item-chg{font-size:10px;padding:2px 6px;border-radius:6px;font-weight:700;margin-left:6px;animation:pop var(--dur) var(--ease-spring)}
    @keyframes pop{from{transform:scale(0) rotate(-10deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}
    .ldsp-item-chg.up{background:var(--ok-bg);color:var(--ok);box-shadow:0 2px 8px rgba(16,185,129,.2)}
    .ldsp-item-chg.down{background:var(--err-bg);color:var(--err);box-shadow:0 2px 8px rgba(244,63,94,.2)}
    .ldsp-subtabs{display:flex;align-items:center;gap:6px;padding:6px 10px;overflow-x:auto;scrollbar-width:thin;scrollbar-color:var(--scrollbar) transparent;-webkit-overflow-scrolling:touch}
    .ldsp-subtabs::-webkit-scrollbar{height:6px;background:var(--bg-el);border-radius:3px}
    .ldsp-subtabs::-webkit-scrollbar-track{background:var(--bg-el);border-radius:3px}
    .ldsp-subtabs::-webkit-scrollbar-thumb{background:var(--scrollbar);border-radius:3px;transition:background .3s}
    .ldsp-subtabs::-webkit-scrollbar-thumb:hover{background:var(--accent)}
    .ldsp-subtabs::-webkit-scrollbar-button{width:0;height:0;display:none}
    .ldsp-subtab{padding:6px 12px;border:1px solid var(--border2);background:var(--bg-card);color:var(--txt-sec);border-radius:20px;font-size:10px;font-weight:600;white-space:nowrap;flex-shrink:0;transition:background .15s,color .15s,border-color .15s}
    .ldsp-subtab:hover{border-color:var(--accent);color:var(--accent);background:rgba(107,140,239,.08);transform:translateY(-1px)}
    .ldsp-subtab.active{background:var(--grad);border-color:transparent;color:#fff;box-shadow:0 4px 12px rgba(107,140,239,.25)}
    .ldsp-chart{background:var(--bg-card);border-radius:var(--r-md);padding:12px;margin-bottom:10px;border:1px solid var(--border);position:relative;overflow:hidden}
    .ldsp-chart::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.2}
    .ldsp-chart:last-child{margin-bottom:0}
    .ldsp-chart-title{font-size:12px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px;color:var(--txt)}
    .ldsp-chart-sub{font-size:10px;color:var(--txt-mut);font-weight:500;margin-left:auto}
    .ldsp-spark-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}
    .ldsp-spark-row:last-child{margin-bottom:0}
    .ldsp-spark-lbl{width:55px;font-size:10px;color:var(--txt-sec);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
    .ldsp-spark-bars{flex:1;display:flex;align-items:flex-end;gap:3px;height:24px}
    .ldsp-spark-bar{flex:1;background:linear-gradient(180deg,var(--accent),var(--accent2));border-radius:3px 3px 0 0;min-height:3px;opacity:.35;position:relative;transition:opacity .2s,height .2s var(--ease)}
    .ldsp-spark-bar:last-child{opacity:1}
    .ldsp-spark-bar:hover{opacity:1;transform:scaleY(1.15);box-shadow:0 -4px 12px rgba(107,140,239,.3)}
    .ldsp-spark-bar::after{content:attr(data-v);position:absolute;bottom:100%;left:50%;transform:translateX(-50%) translateY(5px);font-size:9px;background:var(--bg-el);padding:3px 6px;border-radius:4px;opacity:0;white-space:nowrap;pointer-events:none;border:1px solid var(--border2);box-shadow:0 4px 12px rgba(0,0,0,.2);transition:transform .15s var(--ease),opacity .15s}
    .ldsp-spark-bar:hover::after{opacity:1;transform:translateX(-50%) translateY(-2px)}
    .ldsp-spark-val{font-size:11px;font-weight:700;min-width:35px;text-align:right;color:var(--accent)}
    .ldsp-date-labels{display:flex;justify-content:space-between;padding:8px 0 0 60px;margin-right:40px}
    .ldsp-date-lbl{font-size:9px;color:var(--txt-mut);text-align:center;font-weight:500}
    .ldsp-changes{margin-top:8px}
    .ldsp-chg-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);transition:background .15s}
    .ldsp-chg-row:hover{background:var(--bg-glass);margin:0 -6px;padding:8px 6px;border-radius:var(--r-xs)}
    .ldsp-chg-row:last-child{border-bottom:none}
    .ldsp-chg-name{font-size:11px;color:var(--txt-sec);flex:1;font-weight:500}
    .ldsp-chg-cur{font-size:10px;color:var(--txt-mut);margin-right:8px}
    .ldsp-chg-val{font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px}
    .ldsp-chg-val.up{background:var(--ok-bg);color:var(--ok)}
    .ldsp-chg-val.down{background:var(--err-bg);color:var(--err)}
    .ldsp-chg-val.neu{background:var(--bg-el);color:var(--txt-mut)}
    .ldsp-rd-stats{border-radius:var(--r-md);padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;border:1px solid var(--border)}
    .ldsp-rd-stats-icon{font-size:32px;flex-shrink:0;filter:drop-shadow(0 2px 8px rgba(0,0,0,.2))}
    .ldsp-rd-stats-info{flex:1}
    .ldsp-rd-stats-val{font-size:18px;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-.02em}
    .ldsp-rd-stats-lbl{font-size:10px;color:var(--txt-mut);margin-top:3px;font-weight:500}
    .ldsp-rd-stats-badge{padding:5px 12px;border-radius:12px;font-size:10px;font-weight:700;transform:translateY(-1px);transition:transform .15s,box-shadow .15s}
    .ldsp-track{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-card);border-radius:var(--r-sm);margin-bottom:10px;font-size:10px;color:var(--txt-mut);border:1px solid var(--border);font-weight:500}
    .ldsp-track-dot{width:8px;height:8px;border-radius:50%;background:var(--ok);animation:pulse 3s ease-in-out infinite;box-shadow:0 0 10px rgba(16,185,129,.4);will-change:opacity,transform}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1);box-shadow:0 0 10px rgba(16,185,129,.4)}50%{opacity:.7;transform:scale(.9);box-shadow:0 0 5px rgba(16,185,129,.2)}}
    @keyframes gradient-shift{0%{background-position:0% center}50%{background-position:100% center}100%{background-position:0% center}}
    .ldsp-rd-prog{background:var(--bg-card);border-radius:var(--r-md);padding:12px;margin-bottom:10px;border:1px solid var(--border)}
    .ldsp-rd-prog-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
    .ldsp-rd-prog-title{font-size:11px;color:var(--txt-sec);font-weight:600}
    .ldsp-rd-prog-val{font-size:12px;font-weight:700;color:var(--accent)}
    .ldsp-rd-prog-bar{height:8px;background:var(--bg-el);border-radius:4px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.1)}
    .ldsp-rd-prog-fill{height:100%;border-radius:4px;transition:width .5s var(--ease);position:relative}
    .ldsp-rd-prog-fill::after{content:'';position:absolute;top:0;left:0;right:0;height:50%;background:linear-gradient(180deg,rgba(255,255,255,.2) 0%,transparent 100%);border-radius:4px 4px 0 0}
    .ldsp-rd-week{display:flex;justify-content:space-between;align-items:flex-end;height:55px;padding:0 4px;margin:12px 0 8px;gap:4px}
    .ldsp-rd-day{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}
    .ldsp-rd-day-bar{width:100%;max-width:18px;background:linear-gradient(180deg,var(--accent) 0%,var(--accent2) 100%);border-radius:4px 4px 0 0;min-height:3px;position:relative;transition:opacity .2s,height .2s var(--ease)}
    .ldsp-rd-day-bar:hover{transform:scaleX(1.2);box-shadow:0 -4px 15px rgba(91,181,166,.35)}
    .ldsp-rd-day-bar::after{content:attr(data-t);position:absolute;bottom:100%;left:50%;transform:translateX(-50%) translateY(5px);background:var(--bg-el);padding:4px 8px;border-radius:6px;font-size:9px;font-weight:600;white-space:nowrap;opacity:0;pointer-events:none;margin-bottom:4px;border:1px solid var(--border2);box-shadow:0 4px 12px rgba(0,0,0,.2);transition:transform .15s var(--ease),opacity .15s}
    .ldsp-rd-day-bar:hover::after{opacity:1;transform:translateX(-50%) translateY(0)}
    .ldsp-rd-day-lbl{font-size:9px;color:var(--txt-mut);line-height:1;font-weight:500}
    .ldsp-today-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px}
    .ldsp-today-stat{background:var(--bg-card);border-radius:var(--r-md);padding:12px 10px;text-align:center;border:1px solid var(--border);position:relative;overflow:hidden;transition:background .15s,border-color .15s}
    .ldsp-today-stat:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.1)}
    .ldsp-today-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--grad)}
    .ldsp-today-stat-val{font-size:18px;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-.02em}
    .ldsp-today-stat-lbl{font-size:10px;color:var(--txt-mut);margin-top:4px;font-weight:500}
    .ldsp-time-info{font-size:10px;color:var(--txt-mut);text-align:center;padding:8px 10px;background:var(--bg-card);border-radius:var(--r-sm);margin-bottom:10px;border:1px solid var(--border);font-weight:500}
    .ldsp-time-info span{color:var(--accent);font-weight:700}
    .ldsp-year-heatmap{padding:10px 14px 10px 0;overflow-x:hidden;overflow-y:auto;max-height:320px;scrollbar-width:thin;scrollbar-color:transparent transparent}
    .ldsp-year-heatmap.scrolling{scrollbar-color:var(--scrollbar) transparent}
    .ldsp-year-heatmap::-webkit-scrollbar{width:6px;background:transparent}
    .ldsp-year-heatmap::-webkit-scrollbar-track{background:transparent}
    .ldsp-year-heatmap::-webkit-scrollbar-thumb{background:transparent;border-radius:4px;transition:background .3s}
    .ldsp-year-heatmap.scrolling::-webkit-scrollbar-thumb{background:var(--scrollbar)}
    .ldsp-year-heatmap::-webkit-scrollbar-button{width:0;height:0;display:none}
    .ldsp-year-wrap{display:flex;flex-direction:column;gap:3px;width:100%;padding-right:6px}
    .ldsp-year-row{display:flex;align-items:center;gap:4px;width:100%;position:relative}
    .ldsp-year-month{width:28px;font-size:8px;font-weight:600;color:var(--txt-mut);text-align:right;flex-shrink:0;line-height:1;position:absolute;left:0;top:50%;transform:translateY(-50%)}
    .ldsp-year-cells{display:grid;grid-template-columns:repeat(14,minmax(9px,1fr));gap:3px;width:100%;align-items:center;margin-left:32px}
    .ldsp-year-cell{width:100%;aspect-ratio:1;border-radius:3px;background:var(--bg-card);border:1px solid var(--border);position:relative;transition:transform .15s var(--ease),box-shadow .15s}
    .ldsp-year-cell:hover{transform:scale(1.6);box-shadow:0 4px 15px rgba(107,140,239,.4);border-color:var(--accent);z-index:10}
    .ldsp-year-cell.l0{background:rgba(107,140,239,.1);border-color:rgba(107,140,239,.18)}
    .ldsp-year-cell.l1{background:rgba(180,230,210,.35);border-color:rgba(180,230,210,.45)}
    .ldsp-year-cell.l2{background:rgba(130,215,180,.5);border-color:rgba(130,215,180,.6)}
    .ldsp-year-cell.l3{background:rgba(90,195,155,.65);border-color:rgba(90,195,155,.75)}
    .ldsp-year-cell.l4{background:linear-gradient(135deg,#6dcfa5,#50c090);border-color:#6dcfa5;box-shadow:0 0 8px rgba(109,207,165,.4)}
    .ldsp-year-cell.empty{background:0 0;border-color:transparent;cursor:default}
    .ldsp-year-cell.empty:hover{transform:none;box-shadow:none}
    .ldsp-year-tip{position:absolute;left:50%;transform:translateX(-50%);background:var(--bg-el);padding:5px 8px;border-radius:6px;font-size:9px;white-space:nowrap;opacity:0;pointer-events:none;border:1px solid var(--border2);z-index:1000;line-height:1.3;box-shadow:0 4px 15px rgba(0,0,0,.25);font-weight:500}
    .ldsp-year-cell:hover .ldsp-year-tip{opacity:1}
    .ldsp-year-cell .ldsp-year-tip{bottom:100%;margin-bottom:4px}
    .ldsp-year-row:nth-child(-n+3) .ldsp-year-tip{bottom:auto;top:100%;margin-top:4px;margin-bottom:0}
    .ldsp-year-cell:nth-child(13) .ldsp-year-tip,.ldsp-year-cell:nth-child(14) .ldsp-year-tip{left:auto;right:0;transform:translateX(0)}
    .ldsp-heatmap-legend{display:flex;align-items:center;gap:6px;justify-content:center;font-size:9px;color:var(--txt-mut);padding:8px 0;font-weight:500}
    .ldsp-heatmap-legend-cell{width:10px;height:10px;border-radius:2px;border:1px solid var(--border)}
    .ldsp-empty,.ldsp-loading{text-align:center;padding:30px 16px;color:var(--txt-mut)}
    .ldsp-empty-icon{font-size:36px;margin-bottom:12px;filter:drop-shadow(0 2px 8px rgba(0,0,0,.1))}
    .ldsp-empty-txt{font-size:12px;line-height:1.7;font-weight:500}
    .ldsp-spinner{width:28px;height:28px;border:3px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 10px;will-change:transform}
    @keyframes spin{to{transform:rotate(360deg)}}
    .ldsp-mini-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50px 20px;color:var(--txt-mut)}
    .ldsp-mini-spin{width:32px;height:32px;border:3px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite;margin-bottom:14px;will-change:transform}
    .ldsp-mini-txt{font-size:11px;font-weight:500}
    .ldsp-toast{position:absolute;bottom:-55px;left:50%;transform:translateX(-50%) translateY(15px);background:var(--grad);color:#fff;padding:10px 18px;border-radius:20px;font-size:12px;font-weight:600;box-shadow:0 8px 30px rgba(107,140,239,.4);opacity:0;white-space:nowrap;display:flex;align-items:center;gap:8px;z-index:100000;transition:transform .3s var(--ease-spring),opacity .3s;will-change:transform,opacity}
    .ldsp-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    .ldsp-modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:100001;opacity:0;transition:opacity .3s var(--ease)}
    .ldsp-modal-overlay.show{opacity:1}
    .ldsp-modal{background:var(--bg-card);border-radius:var(--r-xl);padding:24px;max-width:340px;width:90%;box-shadow:var(--shadow-lg),var(--glow-accent);transform:scale(.9) translateY(30px);transition:transform .35s var(--ease-spring);border:1px solid var(--border);backdrop-filter:blur(20px)}
    .ldsp-modal-overlay.show .ldsp-modal{transform:scale(1) translateY(0)}
    .ldsp-modal-hdr{display:flex;align-items:center;gap:12px;margin-bottom:18px}
    .ldsp-modal-icon{font-size:28px;filter:drop-shadow(0 2px 8px rgba(0,0,0,.2))}
    .ldsp-modal-title{font-size:17px;font-weight:700;letter-spacing:-.02em}
    .ldsp-modal-body{font-size:13px;color:var(--txt-sec);line-height:1.7;margin-bottom:20px}
    .ldsp-modal-body p{margin:0 0 10px}
    .ldsp-modal-body ul{margin:10px 0;padding-left:0;list-style:none}
    .ldsp-modal-body li{margin:6px 0;padding-left:24px;position:relative}
    .ldsp-modal-body li::before{content:'';position:absolute;left:0;top:6px;width:6px;height:6px;background:var(--accent);border-radius:50%}
    .ldsp-modal-body strong{color:var(--accent);font-weight:600}
    .ldsp-modal-footer{display:flex;gap:12px}
    .ldsp-modal-btn{flex:1;padding:12px 18px;border:none;border-radius:var(--r-md);font-size:13px;font-weight:600;transition:background .15s,transform .2s var(--ease)}
    .ldsp-modal-btn.primary{background:var(--grad);color:#fff;box-shadow:0 4px 15px rgba(107,140,239,.3)}
    .ldsp-modal-btn.primary:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(107,140,239,.4)}
    .ldsp-modal-btn.primary:active{transform:translateY(0)}
    .ldsp-modal-btn.secondary{background:var(--bg-el);color:var(--txt-sec);border:1px solid var(--border2)}
    .ldsp-modal-btn.secondary:hover{background:var(--bg-hover);border-color:var(--border-accent)}
    .ldsp-modal-btn.danger{background:var(--grad-warm);color:#fff;box-shadow:0 4px 15px rgba(224,122,141,.3)}
    .ldsp-modal-btn.danger:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(224,122,141,.4)}
    .ldsp-modal-btn.danger:active{transform:translateY(0)}
    .ldsp-modal-note{margin-top:14px;font-size:11px;color:var(--txt-mut);text-align:center;font-weight:500}
    .ldsp-confirm-overlay{position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;box-sizing:border-box;background:rgba(18,19,26,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;z-index:20;opacity:0;pointer-events:none;transition:opacity .3s var(--ease);border-radius:inherit;margin:0;padding:0 20px}
    .ldsp-confirm-overlay.show{opacity:1;pointer-events:auto}
    .ldsp-confirm-box{background:linear-gradient(145deg,var(--bg-card),var(--bg));border-radius:var(--r-lg);padding:24px 20px;width:100%;max-width:260px;box-shadow:var(--shadow-lg),0 0 40px rgba(224,122,141,.1);transform:scale(.92) translateY(20px);transition:transform .35s var(--ease-spring);border:1px solid var(--border2);position:relative;overflow:hidden;margin:0 auto}
    .ldsp-confirm-box::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--grad-warm);opacity:.8}
    .ldsp-confirm-overlay.show .ldsp-confirm-box{transform:scale(1) translateY(0)}
    .ldsp-confirm-icon{text-align:center;font-size:40px;margin-bottom:14px;filter:drop-shadow(0 4px 8px rgba(224,122,141,.3));animation:confirm-icon-bounce .5s var(--ease-spring) .1s both}
    @keyframes confirm-icon-bounce{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.15) rotate(5deg)}100%{transform:scale(1) rotate(0);opacity:1}}
    .ldsp-confirm-title{text-align:center;font-size:16px;font-weight:700;margin-bottom:10px;color:#ef4444;letter-spacing:-.02em}
    .ldsp-confirm-msg{text-align:center;font-size:12px;color:var(--txt-sec);line-height:1.7;margin-bottom:20px;padding:0 4px}
    .ldsp-confirm-btns{display:flex;gap:10px}
    .ldsp-confirm-btn{flex:1;padding:11px 14px;border:none;border-radius:var(--r-sm);font-size:12px;font-weight:600;transition:background .15s,transform .15s,box-shadow .15s,border-color .15s;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
    .ldsp-confirm-btn.cancel{background:var(--bg-el);color:var(--txt-sec);border:1px solid var(--border2)}
    @media (hover:hover){.ldsp-confirm-btn.cancel:hover{background:var(--bg-hover);border-color:var(--border-accent)}}
    .ldsp-confirm-btn.confirm{background:var(--grad-warm);color:#fff;box-shadow:0 4px 15px rgba(224,122,141,.3);border:none}
    @media (hover:hover){.ldsp-confirm-btn.confirm:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(224,122,141,.4)}}
    .ldsp-confirm-btn:active{transform:scale(.96)}
    @media (max-width:480px){.ldsp-confirm-box{padding:20px 16px;max-width:240px}.ldsp-confirm-icon{font-size:36px;margin-bottom:12px}.ldsp-confirm-title{font-size:14px}.ldsp-confirm-msg{font-size:11px;margin-bottom:16px}.ldsp-confirm-btn{padding:10px 12px;font-size:11px}}
    @media (max-width:320px){.ldsp-confirm-overlay{padding:0 12px}.ldsp-confirm-box{padding:16px 12px;max-width:220px}.ldsp-confirm-icon{font-size:32px;margin-bottom:10px}.ldsp-confirm-title{font-size:13px}.ldsp-confirm-msg{font-size:10px;margin-bottom:14px;line-height:1.6}.ldsp-confirm-btns{gap:8px}.ldsp-confirm-btn{padding:9px 10px;font-size:10px}}
    .ldsp-no-chg{text-align:center;padding:18px;color:var(--txt-mut);font-size:11px;font-weight:500}
    .ldsp-lb-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-card);border-radius:var(--r-md);margin-bottom:10px;border:1px solid var(--border)}
    .ldsp-lb-status{display:flex;align-items:center;gap:10px}
    .ldsp-lb-dot{width:10px;height:10px;border-radius:50%;background:var(--txt-mut);transition:background .2s}
    .ldsp-lb-dot.joined{background:var(--ok);box-shadow:0 0 10px rgba(16,185,129,.4)}
    .ldsp-lb-btn{padding:8px 14px;border:none;border-radius:20px;font-size:11px;font-weight:600;transition:background .15s,color .15s,transform .2s var(--ease)}
    .ldsp-lb-btn.primary{background:var(--grad);color:#fff;box-shadow:0 4px 12px rgba(107,140,239,.25)}
    .ldsp-lb-btn.primary:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(107,140,239,.4)}
    .ldsp-lb-btn.primary:active{transform:translateY(0)}
    .ldsp-lb-btn.secondary{background:var(--bg-el);color:var(--txt-sec);border:1px solid var(--border2)}
    .ldsp-lb-btn.secondary:hover{background:var(--bg-hover);border-color:var(--border-accent)}
    .ldsp-lb-btn.danger{background:var(--err-bg);color:var(--err);border:1px solid rgba(244,63,94,.3)}
    .ldsp-lb-btn.danger:hover{background:var(--err);color:#fff;box-shadow:0 4px 12px rgba(244,63,94,.3)}
    .ldsp-lb-btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
    .ldsp-rank-list{display:flex;flex-direction:column;gap:6px}
    .ldsp-rank-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-card);border-radius:var(--r-md);animation:item var(--dur) var(--ease-out) backwards;border:1px solid var(--border);transition:background .15s,border-color .15s,transform .2s var(--ease)}
    .ldsp-rank-item:hover{background:var(--bg-hover);transform:translateX(4px);box-shadow:0 4px 15px rgba(0,0,0,.1)}
    .ldsp-rank-item.t1{background:linear-gradient(135deg,rgba(255,215,0,.12) 0%,rgba(255,185,0,.05) 100%);border:1px solid rgba(255,215,0,.35);box-shadow:0 4px 20px rgba(255,215,0,.15)}
    .ldsp-rank-item.t2{background:linear-gradient(135deg,rgba(192,192,192,.12) 0%,rgba(160,160,160,.05) 100%);border:1px solid rgba(192,192,192,.35)}
    .ldsp-rank-item.t3{background:linear-gradient(135deg,rgba(205,127,50,.12) 0%,rgba(181,101,29,.05) 100%);border:1px solid rgba(205,127,50,.35)}
    .ldsp-rank-item.me{border-left:3px solid var(--accent);box-shadow:0 0 15px rgba(107,140,239,.1)}
    .ldsp-rank-num{width:28px;height:28px;border-radius:10px;background:var(--bg-el);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--txt-sec);flex-shrink:0}
    .ldsp-rank-item.t1 .ldsp-rank-num{background:linear-gradient(135deg,#ffd700 0%,#ffb700 100%);color:#1a1a1a;font-size:14px;box-shadow:0 4px 12px rgba(255,215,0,.4)}
    .ldsp-rank-item.t2 .ldsp-rank-num{background:linear-gradient(135deg,#e0e0e0 0%,#b0b0b0 100%);color:#1a1a1a;box-shadow:0 4px 12px rgba(192,192,192,.4)}
    .ldsp-rank-item.t3 .ldsp-rank-num{background:linear-gradient(135deg,#cd7f32 0%,#b5651d 100%);color:#fff;box-shadow:0 4px 12px rgba(205,127,50,.4)}
    .ldsp-rank-avatar{width:32px;height:32px;border-radius:10px;border:2px solid var(--border2);flex-shrink:0;background:var(--bg-el);transition:transform .2s var(--ease),border-color .15s}
    .ldsp-rank-item:hover .ldsp-rank-avatar{transform:scale(1.05)}
    .ldsp-rank-item.t1 .ldsp-rank-avatar{border-color:#ffd700;box-shadow:0 0 12px rgba(255,215,0,.3)}
    .ldsp-rank-item.t2 .ldsp-rank-avatar{border-color:#c0c0c0}
    .ldsp-rank-item.t3 .ldsp-rank-avatar{border-color:#cd7f32}
    .ldsp-rank-info{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:3px 5px}
    .ldsp-rank-name{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ldsp-rank-display-name{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:85px}
    .ldsp-rank-username{font-size:10px;color:var(--txt-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
    .ldsp-rank-name-only{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ldsp-rank-me-tag{font-size:10px;color:var(--accent);margin-left:3px;font-weight:600;background:rgba(107,140,239,.1);padding:1px 6px;border-radius:8px}
    .ldsp-rank-time{font-size:13px;font-weight:800;color:var(--accent);white-space:nowrap;letter-spacing:-.02em}
    .ldsp-rank-item.t1 .ldsp-rank-time{color:#ffc107;text-shadow:0 0 10px rgba(255,193,7,.3)}
    .ldsp-rank-item.t2 .ldsp-rank-time{color:#b8b8b8}
    .ldsp-rank-item.t3 .ldsp-rank-time{color:#cd7f32}
    .ldsp-lb-empty{text-align:center;padding:40px 20px;color:var(--txt-mut)}
    .ldsp-lb-empty-icon{font-size:48px;margin-bottom:14px;filter:drop-shadow(0 2px 10px rgba(0,0,0,.1))}
    .ldsp-lb-empty-txt{font-size:12px;line-height:1.7;font-weight:500}
    .ldsp-lb-login{text-align:center;padding:40px 20px}
    .ldsp-lb-login-icon{font-size:56px;margin-bottom:16px;filter:drop-shadow(0 4px 15px rgba(0,0,0,.15))}
    .ldsp-lb-login-title{font-size:15px;font-weight:700;margin-bottom:8px;letter-spacing:-.01em}
    .ldsp-lb-login-desc{font-size:11px;color:var(--txt-mut);margin-bottom:20px;line-height:1.7;font-weight:500}
    .ldsp-lb-period{font-size:10px;color:var(--txt-mut);text-align:center;padding:8px 10px;background:var(--bg-card);border-radius:var(--r-sm);margin-bottom:10px;display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--border);font-weight:500}
    .ldsp-lb-period span{color:var(--accent);font-weight:700}
    .ldsp-lb-period .ldsp-update-rule{font-size:9px;opacity:.8}
    .ldsp-lb-refresh{background:var(--bg-el);border:none;font-size:11px;padding:4px 8px;border-radius:6px;transition:background .15s,opacity .2s;opacity:.8}
    .ldsp-lb-refresh:hover{opacity:1;background:var(--bg-hover);transform:scale(1.05)}
    .ldsp-lb-refresh:active{transform:scale(.95)}
    .ldsp-lb-refresh.spinning{animation:ldsp-spin 1s linear infinite}
    .ldsp-lb-refresh:disabled{opacity:.4;cursor:not-allowed;transform:none!important}
    @keyframes ldsp-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    .ldsp-my-rank{display:flex;align-items:center;justify-content:space-between;padding:14px;background:var(--grad);border-radius:var(--r-md);margin-bottom:10px;color:#fff;position:relative;overflow:hidden;box-shadow:0 8px 25px rgba(107,140,239,.3)}
    .ldsp-my-rank::before{content:'';position:absolute;top:-50%;right:-20%;width:100px;height:100px;background:radial-gradient(circle,rgba(255,255,255,.15) 0%,transparent 70%);pointer-events:none}
    .ldsp-my-rank.not-in-top{background:linear-gradient(135deg,#52525b 0%,#3f3f46 100%);box-shadow:0 8px 25px rgba(0,0,0,.2)}
    .ldsp-my-rank-lbl{font-size:11px;opacity:.9;font-weight:500}
    .ldsp-my-rank-val{font-size:20px;font-weight:800;letter-spacing:-.02em;text-shadow:0 2px 8px rgba(0,0,0,.2)}
    .ldsp-my-rank-time{font-size:12px;opacity:.95;font-weight:600}
    .ldsp-not-in-top-hint{font-size:10px;opacity:.7;margin-left:5px}
    .ldsp-join-prompt{background:var(--bg-card);border-radius:var(--r-md);padding:24px 20px;text-align:center;margin-bottom:10px;border:1px solid var(--border);position:relative;overflow:hidden}
    .ldsp-join-prompt::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--grad)}
    .ldsp-join-prompt-icon{font-size:44px;margin-bottom:12px;filter:drop-shadow(0 2px 10px rgba(0,0,0,.15))}
    .ldsp-join-prompt-title{font-size:14px;font-weight:700;margin-bottom:6px;letter-spacing:-.01em}
    .ldsp-join-prompt-desc{font-size:11px;color:var(--txt-mut);line-height:1.7;margin-bottom:16px;font-weight:500}
    .ldsp-privacy-note{font-size:9px;color:var(--txt-mut);margin-top:12px;display:flex;align-items:center;justify-content:center;gap:5px;font-weight:500}
    @media (prefers-reduced-motion:reduce){#ldsp-panel,#ldsp-panel *{animation:none!important;transition:none!important}#ldsp-panel .ldsp-spinner,#ldsp-panel .ldsp-mini-spin,#ldsp-panel .ldsp-lb-refresh.spinning{animation:spin 1.5s linear infinite!important}}
    @media (min-width:1920px){#ldsp-panel{--w:340px;--fs:13px;--pd:16px;--av:50px;--ring:85px}}
    @media (max-height:700px){#ldsp-panel{top:60px}.ldsp-content{max-height:calc(100vh - 240px)}}
    @media (max-width:1200px){#ldsp-panel{left:10px;right:auto}}
    @media (max-width:768px){#ldsp-panel{--w:280px;--fs:12px;--pd:11px;left:8px;right:auto;top:60px}#ldsp-panel.collapsed{width:42px!important;height:42px!important;border-radius:12px}#ldsp-panel.collapsed .ldsp-toggle{font-size:16px}#ldsp-panel.collapsed .ldsp-toggle-logo{width:22px;height:22px}.ldsp-hdr{padding:8px 10px;gap:6px;min-height:46px}.ldsp-hdr-info{gap:6px}.ldsp-hdr-text{gap:0}.ldsp-site-icon{width:22px;height:22px;border-radius:6px}.ldsp-site-ver{font-size:8px;padding:1px 4px}.ldsp-title{font-size:12px}.ldsp-ver{font-size:8px}.ldsp-app-name{font-size:9px}.ldsp-hdr-btns{gap:3px}.ldsp-hdr-btns button{width:24px;height:24px;font-size:11px}.ldsp-update-bubble{width:200px;padding:14px 16px}.ldsp-content{max-height:calc(100vh - 240px)}.ldsp-rank-item{padding:10px}.ldsp-rank-num{width:26px;height:26px}.ldsp-rank-avatar{width:30px;height:30px}.ldsp-learn-trust{font-size:9px}}
    @media (max-width:480px){#ldsp-panel{--w:260px;--av:36px;--ring:68px;left:6px;right:auto;top:55px;border-radius:var(--r-md);max-height:70vh}#ldsp-panel.collapsed{width:38px!important;height:38px!important;border-radius:10px;max-height:none}#ldsp-panel.collapsed .ldsp-toggle{font-size:14px}#ldsp-panel.collapsed .ldsp-toggle-logo{width:20px;height:20px}.ldsp-hdr{padding:6px 8px;gap:4px;min-height:40px}.ldsp-hdr-info{gap:4px}.ldsp-hdr-text{gap:0}.ldsp-site-icon{width:18px;height:18px;border-radius:5px}.ldsp-site-ver{font-size:7px;padding:1px 3px}.ldsp-site-wrap::after{display:none}.ldsp-title{font-size:10px}.ldsp-ver{font-size:7px}.ldsp-app-name{font-size:8px}.ldsp-hdr-btns{gap:2px}.ldsp-hdr-btns button{width:22px;height:22px;font-size:10px;border-radius:5px}.ldsp-user{padding:8px 8px 20px;gap:8px}.ldsp-reading::after{bottom:-12px;font-size:7px}.ldsp-user-actions{gap:4px}.ldsp-action-btn{padding:4px 6px;font-size:9px;flex:0 1 calc(50% - 2px)}.ldsp-action-btn:only-child{flex:0 1 auto}.ldsp-reading{min-width:60px;padding:5px 8px}.ldsp-reading-icon{font-size:16px}.ldsp-reading-time{font-size:10px}.ldsp-reading-label{font-size:7px}.ldsp-tabs{padding:8px 10px;gap:6px}.ldsp-tab{padding:6px 10px;font-size:10px;border-radius:var(--r-sm)}.ldsp-section{padding:8px}.ldsp-content{max-height:none}.ldsp-rank-item{padding:8px 10px}.ldsp-rank-num{width:24px;height:24px;font-size:10px;border-radius:8px}.ldsp-rank-avatar{width:28px;height:28px;border-radius:8px}.ldsp-rank-display-name,.ldsp-rank-name-only{font-size:11px}.ldsp-rank-time{font-size:12px}.ldsp-my-rank{padding:10px}.ldsp-my-rank-val{font-size:16px}.ldsp-subtab{padding:5px 10px;font-size:9px}.ldsp-learn-trust{font-size:8px}}
    @media (max-height:500px){#ldsp-panel{top:40px}.ldsp-content{max-height:calc(100vh - 180px)}.ldsp-user{padding:8px 8px 18px}.ldsp-user-actions{display:none}.ldsp-tabs{padding:6px 8px}.ldsp-section{padding:6px}}
    .ldsp-action-btn{display:inline-flex;align-items:center;gap:4px;padding:5px 10px;background:linear-gradient(135deg,rgba(107,140,239,.08),rgba(90,125,224,.12));border:1px solid rgba(107,140,239,.2);border-radius:8px;font-size:10px;color:var(--accent);transition:background .15s,border-color .15s,transform .15s,box-shadow .15s;font-weight:600;white-space:nowrap;flex:1 1 0;min-width:0;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
    @media (hover:hover){.ldsp-action-btn:hover{background:linear-gradient(135deg,rgba(107,140,239,.15),rgba(90,125,224,.2));border-color:var(--accent);box-shadow:0 4px 12px rgba(107,140,239,.18)}}
    .ldsp-action-btn:active{background:linear-gradient(135deg,rgba(107,140,239,.18),rgba(90,125,224,.24));transform:scale(.97)}
    .ldsp-action-btn:only-child{flex:0 1 auto}
    .ldsp-action-btn .ldsp-action-icon{flex-shrink:0}
    .ldsp-action-btn .ldsp-action-text{overflow:hidden;text-overflow:ellipsis}
    @media (max-width:320px){#ldsp-panel{--w:240px}#ldsp-panel.collapsed{width:34px!important;height:34px!important;border-radius:8px}#ldsp-panel.collapsed .ldsp-toggle-logo{width:18px;height:18px}.ldsp-hdr{padding:5px 6px;gap:3px;min-height:36px}.ldsp-hdr-info{gap:3px}.ldsp-site-icon{width:16px;height:16px;border-radius:4px;border-width:1px}.ldsp-site-ver{display:none}.ldsp-title{font-size:9px}.ldsp-app-name{display:none}.ldsp-hdr-btns{gap:2px}.ldsp-hdr-btns button{width:20px;height:20px;font-size:9px;border-radius:4px}.ldsp-user-actions{flex-direction:column}.ldsp-action-btn{flex:1 1 100%;min-width:0}}
    .ldsp-logout-btn,.ldsp-ticket-btn,.ldsp-melon-btn{flex:0 0 auto;min-width:auto;padding:5px 8px}
    .ldsp-logout-btn{background:linear-gradient(135deg,rgba(239,68,68,.06),rgba(220,38,38,.08));border-color:rgba(239,68,68,.15);color:rgba(239,68,68,.7)}
    .ldsp-logout-btn:hover{background:linear-gradient(135deg,rgba(239,68,68,.12),rgba(220,38,38,.16));border-color:rgba(239,68,68,.3);color:#ef4444}
    .ldsp-login-btn{flex:1 1 100%;background:linear-gradient(135deg,rgba(212,168,83,.15),rgba(196,147,57,.2));border-color:rgba(212,168,83,.3);color:var(--warn);animation:login-pulse 2.5s ease-in-out infinite}
    .ldsp-login-btn:hover{background:linear-gradient(135deg,rgba(212,168,83,.25),rgba(196,147,57,.3));border-color:var(--warn)}
    @keyframes login-pulse{0%,100%{box-shadow:0 0 0 0 rgba(212,168,83,.3)}50%{box-shadow:0 0 12px 2px rgba(212,168,83,.2)}}
    .ldsp-ticket-btn .ldsp-ticket-badge{background:var(--err);color:#fff;font-size:8px;padding:2px 5px;border-radius:8px;margin-left:2px;font-weight:700;animation:pulse 3s ease infinite}
    .ldsp-ticket-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:var(--bg);border-radius:0 0 var(--r-lg) var(--r-lg);z-index:10;display:none;flex-direction:column;overflow:hidden}
    .ldsp-ticket-overlay.show{display:flex}
    .ldsp-ticket-header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-card);border-bottom:1px solid var(--border);flex-shrink:0}
    .ldsp-ticket-title{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;color:var(--txt)}
    .ldsp-ticket-close{width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:var(--bg-el);border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--txt-sec);transition:background .15s,color .15s}
    .ldsp-ticket-close:hover{background:var(--err-bg);color:var(--err);border-color:var(--err)}
    .ldsp-ticket-tabs{display:flex;border-bottom:1px solid var(--border);padding:0 10px;background:var(--bg-card);flex-shrink:0}
    .ldsp-ticket-tab{padding:8px 12px;font-size:10px;font-weight:600;color:var(--txt-mut);border-bottom:2px solid transparent;transition:color .15s,border-color .15s}
    .ldsp-ticket-tab.active{color:var(--accent);border-color:var(--accent)}
    .ldsp-ticket-tab:hover:not(.active){color:var(--txt-sec)}
    .ldsp-ticket-body{flex:1;overflow-y:auto;padding:12px;background:var(--bg);display:flex;flex-direction:column}
    .ldsp-ticket-body.detail-mode{padding:0;overflow:hidden}
    .ldsp-ticket-empty{text-align:center;padding:30px 16px;color:var(--txt-mut)}
    .ldsp-ticket-empty-icon{font-size:36px;margin-bottom:10px}
    .ldsp-ticket-list{display:flex;flex-direction:column;gap:8px}
    .ldsp-ticket-item{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);padding:10px;cursor:pointer;transition:background .15s,border-color .15s}
    .ldsp-ticket-item:hover{background:var(--bg-hover);transform:translateX(3px)}
    .ldsp-ticket-item.has-reply{border-left:3px solid #ef4444;animation:pulse-border-red 3s ease infinite;background:rgba(239,68,68,.05)}
    .ldsp-ticket-item-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
    .ldsp-ticket-item-type{font-size:10px;color:var(--txt-sec)}
    .ldsp-ticket-item-status{font-size:9px;padding:2px 5px;border-radius:4px}
    .ldsp-ticket-item-status.open{background:var(--ok-bg);color:var(--ok)}
    .ldsp-ticket-item-status.closed{background:var(--bg-el);color:var(--txt-mut)}
    .ldsp-ticket-item-title{font-size:11px;font-weight:600;color:var(--txt);margin-bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ldsp-ticket-item-meta{font-size:9px;color:var(--txt-mut);display:flex;gap:6px}
    .ldsp-ticket-form{display:flex;flex-direction:column;gap:10px}
    .ldsp-ticket-form-group{display:flex;flex-direction:column;gap:5px}
    .ldsp-ticket-label{font-size:10px;font-weight:600;color:var(--txt-sec)}
    .ldsp-ticket-types{display:flex;gap:6px;flex-wrap:wrap}
    .ldsp-ticket-type{flex:1;min-width:80px;padding:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-sm);text-align:center;cursor:pointer;transition:background .15s,border-color .15s}
    .ldsp-ticket-type:hover{border-color:var(--accent)}
    .ldsp-ticket-type.selected{border-color:var(--accent);background:rgba(107,140,239,.1)}
    .ldsp-ticket-type-icon{font-size:16px;display:block;margin-bottom:3px}
    .ldsp-ticket-type-label{font-size:10px;color:var(--txt)}
    .ldsp-ticket-input{padding:8px;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:11px;color:var(--txt)}
    .ldsp-ticket-input:focus{border-color:var(--accent);outline:none}
    .ldsp-ticket-textarea{padding:8px;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:11px;color:var(--txt);min-height:80px;resize:vertical}
    .ldsp-ticket-textarea:focus{border-color:var(--accent);outline:none}
    .ldsp-ticket-submit{padding:10px;background:var(--grad);color:#fff;border:none;border-radius:var(--r-sm);font-size:11px;font-weight:600;cursor:pointer;transition:opacity .15s,transform .2s}
    .ldsp-ticket-submit:hover{box-shadow:0 4px 12px rgba(107,140,239,.3)}
    .ldsp-ticket-submit:disabled{opacity:.5;cursor:not-allowed}
    .ldsp-ticket-detail{display:flex;flex-direction:column;flex:1;min-height:0;background:var(--bg)}
    .ldsp-ticket-detail-top{padding:10px 12px;border-bottom:1px solid var(--border);background:var(--bg-card);flex-shrink:0}
    .ldsp-ticket-back{display:inline-flex;align-items:center;gap:4px;padding:5px 8px;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:10px;color:var(--txt-sec);transition:background .15s,color .15s}
    .ldsp-ticket-back:hover{background:var(--bg-hover);color:var(--txt)}
    .ldsp-ticket-detail-header{margin-top:6px}
    .ldsp-ticket-detail-title{font-size:12px;font-weight:600;color:var(--txt);line-height:1.4;word-break:break-word}
    .ldsp-ticket-detail-meta{display:flex;flex-wrap:wrap;gap:5px;font-size:9px;color:var(--txt-mut);margin-top:5px}
    .ldsp-ticket-detail-meta span{background:var(--bg-el);padding:2px 5px;border-radius:3px}
    .ldsp-ticket-messages{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-height:0}
    .ldsp-ticket-reply{max-width:85%;padding:8px 10px;border-radius:var(--r-sm);font-size:11px;line-height:1.4;word-break:break-word}
    .ldsp-ticket-reply.user{background:linear-gradient(135deg,rgba(107,140,239,.12),rgba(90,125,224,.08));border:1px solid rgba(107,140,239,.2);margin-left:auto;border-bottom-right-radius:3px}
    .ldsp-ticket-reply.admin{background:var(--bg-card);border:1px solid var(--border);margin-right:auto;border-bottom-left-radius:3px}
    .ldsp-ticket-reply-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:9px;color:var(--txt-mut)}
    .ldsp-ticket-reply-author{font-weight:600}
    .ldsp-ticket-reply.admin .ldsp-ticket-reply-author{color:var(--ok)}
    .ldsp-ticket-reply-content{color:var(--txt);white-space:pre-wrap}
    .ldsp-ticket-input-area{border-top:1px solid var(--border);padding:10px 12px;background:var(--bg-card);flex-shrink:0}
    .ldsp-ticket-reply-form{display:flex;gap:6px;align-items:center}
    .ldsp-ticket-reply-input{flex:1;padding:6px 8px;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:11px;resize:none;min-height:32px;max-height:50px;color:var(--txt)}
    .ldsp-ticket-reply-input:focus{border-color:var(--accent);outline:none}
    .ldsp-ticket-reply-btn{padding:6px 12px;background:var(--grad);color:#fff;border:none;border-radius:var(--r-sm);font-size:10px;font-weight:600;transition:opacity .15s,transform .2s;flex-shrink:0;height:32px}
    .ldsp-ticket-reply-btn:hover{box-shadow:0 4px 12px rgba(107,140,239,.3)}
    .ldsp-ticket-reply-btn:disabled{opacity:.5;cursor:not-allowed}
    .ldsp-ticket-closed-hint{text-align:center;color:var(--txt-mut);font-size:10px;padding:10px}
    /* 吃瓜助手样式 */
    .ldsp-melon-btn{background:linear-gradient(135deg,rgba(74,222,128,.08),rgba(34,197,94,.12));border-color:rgba(74,222,128,.2);color:rgba(34,197,94,.85)}
    .ldsp-melon-btn:hover{background:linear-gradient(135deg,rgba(74,222,128,.15),rgba(34,197,94,.2));border-color:rgba(74,222,128,.35);color:#22c55e}
    .ldsp-melon-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:var(--bg);border-radius:0 0 var(--r-lg) var(--r-lg);z-index:10;display:none;flex-direction:column;overflow:hidden}
    .ldsp-melon-overlay.show{display:flex}
    .ldsp-melon-header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-card);border-bottom:1px solid var(--border);flex-shrink:0}
    .ldsp-melon-title{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;color:var(--txt)}
    .ldsp-melon-close{width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:var(--bg-el);border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--txt-sec);transition:background .15s,color .15s;cursor:pointer}
    .ldsp-melon-close:hover{background:var(--err-bg);color:var(--err);border-color:var(--err)}
    .ldsp-melon-tabs{display:flex;border-bottom:1px solid var(--border);padding:0 10px;background:var(--bg-card);flex-shrink:0}
    .ldsp-melon-tab{padding:8px 12px;font-size:10px;font-weight:600;color:var(--txt-mut);border-bottom:2px solid transparent;transition:color .15s,border-color .15s;cursor:pointer}
    .ldsp-melon-tab.active{color:var(--accent);border-color:var(--accent)}
    .ldsp-melon-tab:hover:not(.active){color:var(--txt-sec)}
    .ldsp-melon-body{flex:1;overflow-y:auto;padding:12px;background:var(--bg);display:flex;flex-direction:column;gap:10px}
    .ldsp-melon-info{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);padding:10px;font-size:11px}
    .ldsp-melon-info-title{font-weight:600;color:var(--txt);margin-bottom:6px;display:flex;align-items:center;gap:5px}
    .ldsp-melon-info-row{display:flex;align-items:center;gap:6px;color:var(--txt-sec);font-size:10px;margin-top:4px}
    .ldsp-melon-info-label{color:var(--txt-mut);min-width:50px}
    .ldsp-melon-info-value{color:var(--txt);font-weight:500}
    .ldsp-melon-range{display:flex;align-items:center;gap:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);padding:10px;flex-wrap:wrap}
    .ldsp-melon-range-label{font-size:10px;color:var(--txt-sec);white-space:nowrap}
    .ldsp-melon-range-input{width:70px;padding:5px 8px;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:11px;color:var(--txt);text-align:center}
    .ldsp-melon-range-input:focus{border-color:var(--accent);outline:none}
    .ldsp-melon-range-sep{color:var(--txt-mut);font-size:10px}
    .ldsp-melon-range-hint{font-size:9px;color:var(--txt-mut);margin-left:auto}
    /* 模式选择器 - 卡片式设计 */
    .ldsp-melon-mode-selector{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);padding:10px}
    .ldsp-melon-mode-label{font-size:10px;color:var(--txt-sec);margin-bottom:8px;display:block}
    .ldsp-melon-mode-cards{display:flex;gap:8px}
    .ldsp-melon-mode-card{flex:1;display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-el);border:2px solid var(--border);border-radius:var(--r-md);cursor:pointer;transition:all .2s}
    .ldsp-melon-mode-card:hover{border-color:var(--txt-mut);background:var(--bg)}
    .ldsp-melon-mode-card.active{border-color:var(--accent);background:rgba(107,140,239,.08)}
    .ldsp-melon-mode-card input{display:none}
    .ldsp-melon-mode-card-icon{font-size:20px;flex-shrink:0}
    .ldsp-melon-mode-card-content{flex:1;min-width:0}
    .ldsp-melon-mode-card-title{font-size:11px;font-weight:600;color:var(--txt);margin-bottom:2px}
    .ldsp-melon-mode-card-desc{font-size:9px;color:var(--txt-mut)}
    .ldsp-melon-mode-card.active .ldsp-melon-mode-card-title{color:var(--accent)}
    .ldsp-melon-actions{display:flex;gap:8px}
    .ldsp-melon-btn-summarize{flex:1;padding:10px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border:none;border-radius:var(--r-sm);font-size:12px;font-weight:600;cursor:pointer;transition:opacity .15s,transform .2s,box-shadow .2s;display:flex;align-items:center;justify-content:center;gap:6px}
    .ldsp-melon-btn-summarize:hover{box-shadow:0 4px 16px rgba(34,197,94,.35);transform:translateY(-1px)}
    .ldsp-melon-btn-summarize:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
    .ldsp-melon-btn-summarize.loading{background:linear-gradient(135deg,#6b8cef,#5a7de0)}
    /* 输出区域 */
    .ldsp-melon-output-wrapper{display:flex;flex-direction:column;flex:1;min-height:0}
    .ldsp-melon-output-header{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--bg-card);border:1px solid var(--border);border-bottom:none;border-radius:var(--r-md) var(--r-md) 0 0}
    .ldsp-melon-output-title{font-size:10px;font-weight:600;color:var(--txt-sec)}
    .ldsp-melon-output-actions{display:flex;gap:6px}
    .ldsp-melon-resize-btn{display:flex;align-items:center;gap:4px;padding:4px 8px;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:10px;color:var(--txt-sec);cursor:pointer;transition:all .15s}
    .ldsp-melon-resize-btn:hover{background:rgba(107,140,239,.1);border-color:var(--accent);color:var(--accent)}
    .ldsp-melon-copy-btn{display:flex;align-items:center;gap:4px;padding:4px 8px;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:10px;color:var(--txt-sec);cursor:pointer;transition:all .15s}
    .ldsp-melon-copy-btn:hover{background:var(--accent);color:#fff;border-color:var(--accent)}
    .ldsp-melon-output{flex:1;min-height:120px;max-height:200px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;overflow-y:auto;font-size:11px;line-height:1.6;color:var(--txt);transition:max-height .3s ease}
    .ldsp-melon-output.expanded{max-height:400px}
    .ldsp-melon-output-header+.ldsp-melon-output{border-radius:0 0 var(--r-md) var(--r-md)}
    .ldsp-melon-output:empty::before{content:'点击「立即吃瓜」获取帖子摘要...';color:var(--txt-mut);font-style:italic}
    .ldsp-melon-output-content{min-height:20px}
    .ldsp-melon-cursor{display:inline-block;color:var(--accent);animation:ldsp-blink 1s infinite}
    @keyframes ldsp-blink{0%,50%{opacity:1}51%,100%{opacity:0}}
    /* Markdown 渲染 */
    .ldsp-melon-markdown{font-size:11px;line-height:1.7}
    .ldsp-melon-markdown .ldsp-melon-p{margin:6px 0}
    .ldsp-melon-markdown .ldsp-melon-h2,.ldsp-melon-markdown .ldsp-melon-h3{font-size:13px;font-weight:700;margin:12px 0 8px;color:var(--txt);border-bottom:1px solid var(--border);padding-bottom:4px}
    .ldsp-melon-markdown .ldsp-melon-h4,.ldsp-melon-markdown .ldsp-melon-h5{font-size:12px;font-weight:600;margin:10px 0 6px;color:var(--txt)}
    .ldsp-melon-markdown .ldsp-melon-ul,.ldsp-melon-markdown .ldsp-melon-ol{margin:6px 0;padding-left:18px}
    .ldsp-melon-markdown .ldsp-melon-li,.ldsp-melon-markdown .ldsp-melon-oli{margin:3px 0}
    .ldsp-melon-markdown .ldsp-melon-quote{margin:8px 0;padding:8px 12px;background:var(--bg-el);border-left:3px solid var(--accent);border-radius:0 var(--r-sm) var(--r-sm) 0;color:var(--txt-sec);font-style:italic}
    .ldsp-melon-markdown strong{color:var(--accent);font-weight:600}
    .ldsp-melon-markdown .ldsp-melon-inline-code{background:var(--bg-el);padding:2px 5px;border-radius:3px;font-family:monospace;font-size:10px}
    .ldsp-melon-markdown .ldsp-melon-codeblock{background:var(--bg-el);padding:10px;border-radius:var(--r-sm);overflow-x:auto;margin:8px 0}
    .ldsp-melon-markdown .ldsp-melon-codeblock code{background:none;padding:0;font-family:monospace;font-size:10px}
    .ldsp-melon-markdown .ldsp-melon-hr{border:none;border-top:1px solid var(--border);margin:12px 0}
    .ldsp-melon-markdown .ldsp-melon-link{color:var(--accent);text-decoration:none}
    .ldsp-melon-markdown .ldsp-melon-link:hover{text-decoration:underline}
    .ldsp-melon-output h1,.ldsp-melon-output h2,.ldsp-melon-output h3{font-size:13px;font-weight:700;margin:12px 0 8px;color:var(--txt);border-bottom:1px solid var(--border);padding-bottom:4px}
    .ldsp-melon-output h1:first-child,.ldsp-melon-output h2:first-child,.ldsp-melon-output h3:first-child{margin-top:0}
    .ldsp-melon-output h4,.ldsp-melon-output h5{font-size:12px;font-weight:600;margin:10px 0 6px;color:var(--txt)}
    .ldsp-melon-output p{margin:6px 0}
    .ldsp-melon-output ul,.ldsp-melon-output ol{margin:6px 0;padding-left:18px}
    .ldsp-melon-output li{margin:3px 0}
    .ldsp-melon-output blockquote{margin:8px 0;padding:8px 12px;background:var(--bg-el);border-left:3px solid var(--accent);border-radius:0 var(--r-sm) var(--r-sm) 0;color:var(--txt-sec);font-style:italic}
    .ldsp-melon-output strong{color:var(--accent);font-weight:600}
    .ldsp-melon-output code{background:var(--bg-el);padding:2px 5px;border-radius:3px;font-family:monospace;font-size:10px}
    .ldsp-melon-output pre{background:var(--bg-el);padding:10px;border-radius:var(--r-sm);overflow-x:auto;margin:8px 0}
    .ldsp-melon-output pre code{background:none;padding:0}
    .ldsp-melon-output table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10px}
    .ldsp-melon-output th,.ldsp-melon-output td{border:1px solid var(--border);padding:6px 8px;text-align:left}
    .ldsp-melon-output th{background:var(--bg-el);font-weight:600}
    .ldsp-melon-output hr{border:none;border-top:1px solid var(--border);margin:12px 0}
    .ldsp-melon-output a{color:var(--accent);text-decoration:none}
    .ldsp-melon-output a:hover{text-decoration:underline}
    .ldsp-melon-status{text-align:center;padding:20px;color:var(--txt-mut);font-size:11px}
    .ldsp-melon-status-icon{font-size:24px;margin-bottom:8px}
    .ldsp-melon-error{color:var(--err);background:var(--err-bg);padding:10px;border-radius:var(--r-sm);font-size:11px}
    /* 历史记录 */
    .ldsp-melon-history{display:flex;flex-direction:column;height:100%}
    .ldsp-melon-history-header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:10px}
    .ldsp-melon-history-header-left{display:flex;align-items:center;gap:8px}
    .ldsp-melon-history-count{font-size:10px;color:var(--txt-mut)}
    .ldsp-melon-history-storage-badge{font-size:9px;color:var(--txt-mut);background:var(--bg-el);padding:2px 6px;border-radius:10px}
    .ldsp-melon-history-storage-hint{font-size:10px;color:var(--txt-mut);margin-top:8px}
    .ldsp-melon-history-clear-all{padding:4px 8px;background:var(--err-bg);border:1px solid rgba(239,68,68,.2);border-radius:var(--r-sm);font-size:9px;color:var(--err);cursor:pointer;transition:all .15s}
    .ldsp-melon-history-clear-all:hover{background:var(--err);color:#fff}
    .ldsp-melon-history-list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px}
    .ldsp-melon-history-item{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);padding:10px;transition:border-color .15s}
    .ldsp-melon-history-item:hover{border-color:var(--accent)}
    .ldsp-melon-history-item-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px}
    .ldsp-melon-history-item-title{font-size:11px;font-weight:600;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
    .ldsp-melon-history-item-meta{display:flex;align-items:center;gap:6px;flex-shrink:0}
    .ldsp-melon-history-mode{font-size:9px;padding:2px 6px;border-radius:10px;font-weight:500}
    .ldsp-melon-history-mode.brief{background:rgba(59,130,246,.1);color:#3b82f6}
    .ldsp-melon-history-mode.detailed{background:rgba(34,197,94,.1);color:#22c55e}
    .ldsp-melon-history-date{font-size:9px;color:var(--txt-mut)}
    .ldsp-melon-history-item-preview{font-size:10px;color:var(--txt-sec);line-height:1.5;margin-bottom:8px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .ldsp-melon-history-item-actions{display:flex;gap:6px}
    .ldsp-melon-history-btn{padding:4px 8px;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:9px;color:var(--txt-sec);cursor:pointer;transition:all .15s}
    .ldsp-melon-history-btn:hover{background:var(--accent);color:#fff;border-color:var(--accent)}
    .ldsp-melon-history-delete:hover{background:var(--err);border-color:var(--err)}
    .ldsp-melon-history-empty{text-align:center;padding:40px 20px;color:var(--txt-mut)}
    .ldsp-melon-history-empty-icon{font-size:36px;margin-bottom:10px}
    .ldsp-melon-history-empty-text{font-size:12px;font-weight:500;margin-bottom:4px}
    .ldsp-melon-history-empty-hint{font-size:10px;color:var(--txt-mut)}
    .ldsp-melon-history-detail{display:flex;flex-direction:column;height:100%}
    .ldsp-melon-history-detail-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
    .ldsp-melon-history-detail-actions{display:flex;gap:6px}
    .ldsp-melon-history-back{padding:6px 12px;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:10px;color:var(--txt-sec);cursor:pointer;transition:all .15s}
    .ldsp-melon-history-back:hover{background:var(--bg-card);border-color:var(--accent);color:var(--accent)}
    .ldsp-melon-history-expand-btn{padding:6px 12px;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:10px;color:var(--accent);cursor:pointer;transition:all .15s}
    .ldsp-melon-history-expand-btn:hover{background:rgba(107,140,239,.1);border-color:var(--accent)}
    .ldsp-melon-history-copy-all{padding:6px 12px;background:var(--accent);border:none;border-radius:var(--r-sm);font-size:10px;color:#fff;cursor:pointer;transition:opacity .15s}
    .ldsp-melon-history-copy-all:hover{opacity:.85}
    .ldsp-melon-history-detail-info{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);padding:10px;margin-bottom:10px}
    .ldsp-melon-history-detail-title{font-size:12px;font-weight:600;color:var(--txt);margin-bottom:4px}
    .ldsp-melon-history-detail-meta{font-size:10px;color:var(--txt-mut)}
    .ldsp-melon-history-detail-content{flex:1;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;overflow-y:auto;font-size:11px;line-height:1.6}
    /* 设置页 */
    .ldsp-melon-settings{display:flex;flex-direction:column;gap:12px}
    .ldsp-melon-setting-group{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);padding:12px}
    .ldsp-melon-setting-title{font-size:11px;font-weight:600;color:var(--txt);margin-bottom:10px;display:flex;align-items:center;gap:5px}
    .ldsp-melon-setting-row{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
    .ldsp-melon-setting-row:last-child{margin-bottom:0}
    .ldsp-melon-setting-label{font-size:10px;color:var(--txt-sec)}
    .ldsp-melon-setting-input{padding:8px;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:11px;color:var(--txt)}
    .ldsp-melon-setting-input:focus{border-color:var(--accent);outline:none}
    .ldsp-melon-setting-input::placeholder{color:var(--txt-mut)}
    .ldsp-melon-setting-input:disabled{background:var(--bg);color:var(--txt-mut);cursor:not-allowed}
    .ldsp-melon-setting-actions{display:flex;gap:8px}
    .ldsp-melon-setting-btn{flex:1;padding:10px 12px;background:var(--grad);color:#fff;border:none;border-radius:var(--r-sm);font-size:11px;font-weight:600;cursor:pointer;transition:all .15s}
    .ldsp-melon-setting-btn:hover{box-shadow:0 4px 12px rgba(107,140,239,.3);transform:translateY(-1px)}
    .ldsp-melon-btn-edit{background:linear-gradient(135deg,#6b8cef,#5a7de0)}
    .ldsp-melon-btn-save{background:linear-gradient(135deg,#22c55e,#16a34a)}
    .ldsp-melon-btn-save:hover{box-shadow:0 4px 12px rgba(34,197,94,.35)}
    .ldsp-melon-btn-prompt{background:linear-gradient(135deg,#6b8cef,#5a7de0)}
    .ldsp-melon-setting-textarea{width:100%;padding:8px;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:10px;color:var(--txt);resize:vertical;min-height:60px;font-family:monospace;line-height:1.5}
    .ldsp-melon-setting-textarea:focus{border-color:var(--accent);outline:none}
    .ldsp-melon-setting-textarea::placeholder{color:var(--txt-mut);font-size:9px;white-space:pre-wrap}
    .ldsp-melon-prompt-reset{margin-left:6px;cursor:pointer;color:var(--err);font-size:10px;opacity:.6;transition:all .15s}
    .ldsp-melon-prompt-reset:hover{opacity:1;color:var(--err)}
    .ldsp-melon-setting-prompt-actions{display:flex;gap:8px;margin-top:8px}
    .ldsp-melon-setting-security{display:flex;align-items:flex-start;gap:10px;margin-top:12px;padding:12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:var(--r-md)}
    .ldsp-melon-setting-security-icon{font-size:18px;flex-shrink:0}
    .ldsp-melon-setting-security-text{font-size:10px;color:var(--txt-sec);line-height:1.5}
    .ldsp-melon-setting-security-text strong{color:var(--ok);font-weight:600}
    .ldsp-melon-setting-hint{font-size:9px;color:var(--txt-mut);margin-top:2px}
    .ldsp-melon-setting-danger{background:var(--err-bg);border-color:rgba(239,68,68,.2);text-align:center}
    .ldsp-melon-setting-danger .ldsp-melon-setting-title{color:var(--err)}
    .ldsp-melon-setting-danger-desc{font-size:10px;color:var(--txt-sec);margin-bottom:10px}
    .ldsp-melon-setting-danger .ldsp-melon-setting-btn{display:inline-block;flex:none;min-width:160px}
    .ldsp-melon-btn-danger{background:linear-gradient(135deg,#ef4444,#dc2626) !important}
    .ldsp-melon-btn-danger:hover{box-shadow:0 4px 12px rgba(239,68,68,.35) !important}
    .ldsp-melon-warning{background:rgba(212,168,83,.1);border:1px solid rgba(212,168,83,.3);border-radius:var(--r-sm);padding:8px 10px;font-size:10px;color:var(--warn);margin-bottom:8px}
    .ldsp-melon-not-topic{text-align:center;padding:40px 20px;color:var(--txt-mut)}
    .ldsp-melon-not-topic-icon{font-size:36px;margin-bottom:10px}
    .ldsp-melon-not-topic-text{font-size:12px;line-height:1.6}
    .ldsp-melon-not-topic-hint{font-size:10px;color:var(--txt-mut);opacity:.7;margin-top:8px}
    /* 全屏展开查看弹窗 - 独立的变量定义以支持body级挂载 */
    .ldsp-melon-viewer-overlay{--bg:#12131a;--bg-card:rgba(24,26,36,.98);--bg-hover:rgba(38,42,56,.95);--bg-el:rgba(32,35,48,.88);--txt:#e4e6ed;--txt-sec:#9499ad;--txt-mut:#5d6275;--accent:#6b8cef;--border:rgba(255,255,255,.06);--r-sm:6px;--r-md:10px;--r-lg:14px;--err:#e07a8d;--err-bg:rgba(224,122,141,.12);position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:99999;display:flex;align-items:center;justify-content:center;animation:ldsp-viewer-fade-in .2s}
    .ldsp-melon-viewer-overlay.light{--bg:rgba(250,251,254,.97);--bg-card:rgba(255,255,255,.98);--bg-hover:rgba(238,242,250,.96);--bg-el:rgba(245,247,252,.94);--txt:#1e2030;--txt-sec:#4a5068;--txt-mut:#8590a6;--accent:#5070d0;--border:rgba(0,0,0,.08);--err:#d45d6e;--err-bg:rgba(212,93,110,.08)}
    @keyframes ldsp-viewer-fade-in{from{opacity:0}to{opacity:1}}
    @keyframes ldsp-viewer-scale-in{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}
    .ldsp-melon-viewer{position:absolute;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:0 20px 60px rgba(0,0,0,.5);display:flex;flex-direction:column;min-width:320px;min-height:240px;max-width:95vw;max-height:90vh;overflow:hidden;animation:ldsp-viewer-scale-in .2s}
    .ldsp-melon-viewer-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border);cursor:move;user-select:none;flex-shrink:0}
    .ldsp-melon-viewer-title{font-size:13px;font-weight:700;color:var(--txt);display:flex;align-items:center;gap:8px}
    .ldsp-melon-viewer-title-icon{font-size:16px}
    .ldsp-melon-viewer-actions{display:flex;gap:6px}
    .ldsp-melon-viewer-btn{width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:var(--bg-el);border:1px solid var(--border);border-radius:var(--r-sm);font-size:12px;color:var(--txt-sec);cursor:pointer;transition:all .15s}
    .ldsp-melon-viewer-btn:hover{background:var(--bg-hover);border-color:var(--accent);color:var(--accent)}
    .ldsp-melon-viewer-close:hover{background:var(--err-bg);border-color:var(--err);color:var(--err)}
    .ldsp-melon-viewer-body{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg-card)}
    .ldsp-melon-viewer-info{padding:12px 16px;background:var(--bg-el);border-bottom:1px solid var(--border);flex-shrink:0}
    .ldsp-melon-viewer-topic-title{font-size:14px;font-weight:700;color:var(--txt);line-height:1.4;margin-bottom:6px}
    .ldsp-melon-viewer-meta{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--txt-mut)}
    .ldsp-melon-viewer-mode{padding:2px 6px;border-radius:8px;font-weight:600;font-size:9px}
    .ldsp-melon-viewer-mode.brief{background:rgba(34,197,94,.15);color:#22c55e}
    .ldsp-melon-viewer-mode.detailed{background:rgba(107,140,239,.15);color:#6b8cef}
    .ldsp-melon-viewer-content{flex:1;overflow-y:auto;padding:16px;background:var(--bg-card);color:var(--txt)}
    .ldsp-melon-viewer-content .ldsp-melon-markdown{font-size:13px;line-height:1.7;color:var(--txt)}
    .ldsp-melon-viewer-content .ldsp-melon-markdown .ldsp-melon-p{color:var(--txt)}
    .ldsp-melon-viewer-content .ldsp-melon-markdown strong{color:var(--accent)}
    .ldsp-melon-viewer-content .ldsp-melon-markdown .ldsp-melon-h2,.ldsp-melon-viewer-content .ldsp-melon-markdown .ldsp-melon-h3,.ldsp-melon-viewer-content .ldsp-melon-markdown .ldsp-melon-h4{color:var(--txt);border-color:var(--border)}
    .ldsp-melon-viewer-content .ldsp-melon-markdown .ldsp-melon-quote{background:var(--bg-el);border-left-color:var(--accent);color:var(--txt-sec)}
    .ldsp-melon-viewer-content .ldsp-melon-markdown .ldsp-melon-inline-code{background:var(--bg-el);color:var(--txt)}
    .ldsp-melon-viewer-content .ldsp-melon-markdown .ldsp-melon-codeblock{background:var(--bg);border:1px solid var(--border);color:var(--txt);padding:10px;border-radius:6px;overflow-x:auto}
    .ldsp-melon-viewer-content .ldsp-melon-markdown .ldsp-melon-ul,.ldsp-melon-viewer-content .ldsp-melon-markdown .ldsp-melon-ol{margin:8px 0;padding-left:20px}
    .ldsp-melon-viewer-content .ldsp-melon-markdown .ldsp-melon-li,.ldsp-melon-viewer-content .ldsp-melon-markdown .ldsp-melon-oli{margin:4px 0;color:var(--txt)}
    .ldsp-melon-viewer-content .ldsp-melon-markdown .ldsp-melon-hr{border:none;border-top:1px solid var(--border);margin:12px 0}
    .ldsp-melon-viewer-content::-webkit-scrollbar{width:6px}
    .ldsp-melon-viewer-content::-webkit-scrollbar-track{background:var(--bg)}
    .ldsp-melon-viewer-content::-webkit-scrollbar-thumb{background:var(--txt-mut);border-radius:3px}
    .ldsp-melon-viewer-content::-webkit-scrollbar-thumb:hover{background:var(--txt-sec)}
    /* 调整大小手柄 */
    .ldsp-melon-resize-handle{position:absolute;background:transparent}
    .ldsp-melon-resize-handle-e{top:10px;right:0;width:6px;height:calc(100% - 20px);cursor:e-resize}
    .ldsp-melon-resize-handle-s{bottom:0;left:10px;width:calc(100% - 20px);height:6px;cursor:s-resize}
    .ldsp-melon-resize-handle-se{bottom:0;right:0;width:16px;height:16px;cursor:se-resize}
    .ldsp-melon-resize-handle-se::before{content:'';position:absolute;right:3px;bottom:3px;width:8px;height:8px;border-right:2px solid var(--txt-mut);border-bottom:2px solid var(--txt-mut);opacity:.5}
    .ldsp-melon-resize-handle-w{top:10px;left:0;width:6px;height:calc(100% - 20px);cursor:w-resize}
    .ldsp-melon-resize-handle-n{top:0;left:10px;width:calc(100% - 20px);height:6px;cursor:n-resize}
    .ldsp-melon-resize-handle-nw{top:0;left:0;width:16px;height:16px;cursor:nw-resize}
    .ldsp-melon-resize-handle-ne{top:0;right:0;width:16px;height:16px;cursor:ne-resize}
    .ldsp-melon-resize-handle-sw{bottom:0;left:0;width:16px;height:16px;cursor:sw-resize}
    /* 自定义确认对话框 */
    .ldsp-melon-confirm-dialog{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:100;animation:ldsp-fade-in .15s}
    .ldsp-melon-confirm-content{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px;width:85%;max-width:280px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.2);animation:ldsp-scale-in .2s}
    @keyframes ldsp-fade-in{from{opacity:0}to{opacity:1}}
    @keyframes ldsp-scale-in{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}
    .ldsp-melon-confirm-icon{font-size:32px;margin-bottom:12px}
    .ldsp-melon-confirm-message{font-size:12px;color:var(--txt);line-height:1.6;margin-bottom:16px}
    .ldsp-melon-confirm-actions{display:flex;gap:10px}
    .ldsp-melon-confirm-btn{flex:1;padding:10px 16px;border:none;border-radius:var(--r-sm);font-size:11px;font-weight:600;cursor:pointer;transition:all .15s}
    .ldsp-melon-confirm-cancel{background:var(--bg-el);color:var(--txt-sec);border:1px solid var(--border)}
    .ldsp-melon-confirm-cancel:hover{background:var(--bg);border-color:var(--txt-mut)}
    .ldsp-melon-confirm-ok{background:var(--err);color:#fff}
    .ldsp-melon-confirm-ok:hover{background:#dc2626;box-shadow:0 4px 12px rgba(239,68,68,.3)}
    .ldsp-user-meta{display:flex;align-items:center;flex-wrap:wrap;margin-top:2px}
    .ldsp-follow-stats{display:flex;gap:6px;padding:2px 0}
    .ldsp-follow-combined{display:inline-flex;align-items:center;gap:3px;padding:2px 0;font-size:10px;color:var(--txt-mut)}
    .ldsp-follow-part{cursor:pointer;transition:color .15s;font-weight:500}
    .ldsp-follow-part:hover{color:var(--accent)}
    .ldsp-follow-sep{color:var(--txt-mut);margin:0 1px}
    .ldsp-follow-num-following,.ldsp-follow-num-followers{font-weight:600;color:var(--txt-sec);transition:color .15s}
    .ldsp-follow-part:hover .ldsp-follow-num-following,.ldsp-follow-part:hover .ldsp-follow-num-followers{color:var(--accent)}
    .ldsp-join-days{display:inline-flex;align-items:center;font-size:10px;color:var(--txt-mut);margin-left:6px;cursor:pointer;transition:color .15s}
    .ldsp-join-days:hover{color:var(--accent)}
    .ldsp-join-days-num{font-weight:600;color:var(--txt-sec);margin:0 2px;transition:color .15s}
    .ldsp-join-days:hover .ldsp-join-days-num{color:var(--accent)}
    .ldsp-follow-stat{display:flex;align-items:center;gap:3px;padding:2px 6px;background:var(--bg-el);border:1px solid var(--border);border-radius:12px;font-size:9px;color:var(--txt-sec);cursor:pointer;transition:all .15s}
    .ldsp-follow-stat:hover{background:var(--bg-hover);border-color:var(--accent);color:var(--accent)}
    .ldsp-follow-stat:active{transform:scale(.98)}
    .ldsp-follow-stat-icon{display:flex;align-items:center;justify-content:center;width:12px;height:12px;opacity:.7}
    .ldsp-follow-stat-icon svg{width:11px;height:11px;stroke-width:2}
    .ldsp-follow-stat:hover .ldsp-follow-stat-icon{opacity:1}
    .ldsp-follow-stat:hover .ldsp-follow-stat-icon svg{stroke:var(--accent)}
    .ldsp-follow-stat-num{font-weight:700;color:var(--txt);font-size:10px}
    .ldsp-follow-stat-label{font-weight:500;font-size:9px}
    .ldsp-follow-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:var(--bg);border-radius:0 0 var(--r-lg) var(--r-lg);z-index:10;display:none;flex-direction:column;overflow:hidden}
    .ldsp-follow-overlay.show{display:flex}
    .ldsp-follow-header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-card);border-bottom:1px solid var(--border);flex-shrink:0}
    .ldsp-follow-title{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;color:var(--txt)}
    .ldsp-follow-title svg{width:16px;height:16px;stroke:var(--accent);stroke-width:2}
    .ldsp-follow-close{width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:var(--bg-el);border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--txt-sec);cursor:pointer;transition:background .15s,color .15s}
    .ldsp-follow-close:hover{background:var(--err-bg);color:var(--err);border-color:var(--err)}
    .ldsp-follow-tabs{display:flex;border-bottom:1px solid var(--border);background:var(--bg-card);flex-shrink:0}
    .ldsp-follow-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:9px 10px;font-size:10px;font-weight:600;color:var(--txt-mut);border-bottom:2px solid transparent;cursor:pointer;transition:color .15s,border-color .15s,background .15s}
    .ldsp-follow-tab:hover:not(.active){background:var(--bg-hover)}
    .ldsp-follow-tab.active{color:var(--accent);border-color:var(--accent)}
    .ldsp-follow-tab-icon{display:flex;align-items:center;justify-content:center;width:14px;height:14px}
    .ldsp-follow-tab-icon svg{width:13px;height:13px;stroke-width:2}
    .ldsp-follow-tab.active .ldsp-follow-tab-icon svg{stroke:var(--accent)}
    .ldsp-follow-tab-count{padding:1px 6px;background:var(--bg-el);border-radius:10px;font-size:10px;font-weight:700;color:var(--txt-sec)}
    .ldsp-follow-tab.active .ldsp-follow-tab-count{background:var(--accent);color:#fff}
    .ldsp-follow-body{flex:1;overflow-y:auto;padding:10px;background:var(--bg)}
    .ldsp-follow-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:40px 20px;color:var(--txt-mut)}
    .ldsp-follow-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:40px 20px;text-align:center;color:var(--txt-mut)}
    .ldsp-follow-empty-icon{width:48px;height:48px;opacity:.4}
    .ldsp-follow-empty-icon svg{width:100%;height:100%;stroke-width:1.5}
    .ldsp-follow-list{display:flex;flex-direction:column;gap:5px}
    .ldsp-follow-item{display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-md);cursor:pointer;transition:all .15s;text-decoration:none;position:relative;overflow:hidden}
    .ldsp-follow-item::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--accent);opacity:0;transition:opacity .15s}
    .ldsp-follow-item:hover{background:var(--bg-hover);border-color:rgba(107,140,239,.4);box-shadow:0 2px 8px rgba(107,140,239,.08)}
    .ldsp-follow-item:hover::before{opacity:1}
    .ldsp-follow-avatar-wrap{flex-shrink:0;position:relative}
    .ldsp-follow-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;background:var(--bg-el);border:2px solid var(--border);transition:border-color .15s,transform .15s}
    .ldsp-follow-item:hover .ldsp-follow-avatar{border-color:var(--accent);transform:scale(1.05)}
    .ldsp-follow-user-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .ldsp-follow-user-name{font-size:12px;font-weight:600;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ldsp-follow-item:hover .ldsp-follow-user-name{color:var(--accent)}
    .ldsp-follow-user-id{font-size:10px;color:var(--txt-mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ldsp-follow-arrow{flex-shrink:0;width:20px;height:20px;display:flex;align-items:center;justify-content:center;color:var(--txt-mut);opacity:.4;transition:opacity .15s,transform .15s}
    .ldsp-follow-arrow svg{width:14px;height:14px}
    .ldsp-follow-item:hover .ldsp-follow-arrow{opacity:1;transform:translateX(2px);color:var(--accent)}
    .ldsp-activity-content{flex:1;overflow-y:auto;padding:8px}
    .ldsp-topic-list{display:flex;flex-direction:column;gap:6px}
    .ldsp-topic-list-enhanced .ldsp-topic-item{display:flex;flex-direction:row;align-items:center;gap:8px;padding:10px;background:var(--bg-card);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:var(--r-md);cursor:pointer;transition:all .15s ease;text-decoration:none}
    .ldsp-topic-item:hover{background:var(--bg-hover);border-color:rgba(107,140,239,.5);border-left-color:#5a7de0;transform:translateX(2px);box-shadow:0 2px 8px rgba(107,140,239,.1)}
    .ldsp-topic-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
    .ldsp-topic-header{display:flex;flex-direction:column;gap:4px}
    .ldsp-topic-title-row{display:flex;align-items:center;gap:5px;min-width:0}
    .ldsp-topic-badges{display:flex;gap:3px;flex-shrink:0}
    .ldsp-topic-badge{padding:1px 4px;border-radius:6px;font-size:8px;font-weight:600;line-height:1.2}
    .ldsp-badge-unread{background:var(--accent);color:#fff}
    .ldsp-badge-new{background:#10b981;color:#fff}
    .ldsp-topic-title{font-size:12px;font-weight:600;color:var(--txt);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
    .ldsp-topic-item:hover .ldsp-topic-title{color:var(--accent)}
    .ldsp-topic-info{display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-height:16px}
    .ldsp-topic-tags{display:flex;gap:3px;flex-wrap:wrap}
    .ldsp-topic-tag{padding:1px 6px;background:rgba(107,140,239,.08);border:1px solid rgba(107,140,239,.2);border-radius:8px;font-size:8px;color:#5a7de0;max-width:55px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ldsp-topic-tag-more{padding:1px 5px;background:rgba(107,140,239,.15);border:1px solid rgba(107,140,239,.3);border-radius:8px;font-size:8px;color:#4a6bc9;font-weight:600}
    .ldsp-topic-footer{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .ldsp-topic-posters{display:flex;align-items:center;flex-shrink:0}
    .ldsp-topic-avatar{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--bg-card);margin-left:-5px;object-fit:cover;background:var(--bg-el)}
    .ldsp-topic-avatar:first-child{margin-left:0}
    .ldsp-poster-op{border-color:var(--accent)}
    .ldsp-poster-latest{border-color:#10b981}
    .ldsp-topic-posters-more{margin-left:2px;font-size:8px;color:var(--txt-mut)}
    .ldsp-topic-stats{display:flex;align-items:center;gap:6px;flex:1;justify-content:flex-end;flex-wrap:nowrap;min-width:0}
    .ldsp-topic-stat{display:flex;align-items:center;gap:2px;font-size:9px;color:var(--txt-mut);white-space:nowrap;flex-shrink:0}
    .ldsp-topic-stat svg{width:10px;height:10px;stroke-width:2;opacity:.6;flex-shrink:0}
    .ldsp-topic-stat em{font-style:normal}
    .ldsp-stat-like{color:#ef4444}
    .ldsp-stat-like svg{stroke:#ef4444;opacity:.8}
    .ldsp-topic-time{font-size:9px;color:var(--txt-mut);opacity:.8;white-space:nowrap;flex-shrink:0}
    .ldsp-topic-thumbnail{width:48px;height:48px;flex-shrink:0;border-radius:6px;overflow:hidden;background:var(--bg-el)}
    .ldsp-topic-thumbnail img{width:100%;height:100%;object-fit:cover;transition:transform .15s}
    .ldsp-topic-item:hover .ldsp-topic-thumbnail img{transform:scale(1.05)}
    .ldsp-bookmark-list{display:flex;flex-direction:column;gap:8px}
    .ldsp-bookmark-item{display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--bg-card);border:1px solid var(--border);border-left:3px solid #f59e0b;border-radius:var(--r-md);cursor:pointer;transition:all .15s ease;text-decoration:none}
    .ldsp-bookmark-item:hover{background:var(--bg-hover);border-color:rgba(245,158,11,.5);border-left-color:#eab308;transform:translateX(2px);box-shadow:0 2px 8px rgba(245,158,11,.1)}
    .ldsp-bookmark-title{font-size:12px;font-weight:600;color:var(--txt);line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .ldsp-bookmark-item:hover .ldsp-bookmark-title{color:#b45309}
    .ldsp-bookmark-meta{display:flex;flex-wrap:wrap;gap:8px;font-size:9px;color:var(--txt-mut);align-items:center}
    .ldsp-bookmark-time{display:flex;align-items:center;gap:3px;white-space:nowrap}
    .ldsp-bookmark-time svg{width:10px;height:10px;stroke-width:2;flex-shrink:0;opacity:.6}
    .ldsp-bookmark-tags{display:flex;flex-wrap:wrap;gap:3px}
    .ldsp-bookmark-tag{padding:1px 6px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:8px;font-size:8px;color:#b45309;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ldsp-bookmark-tag-more{padding:1px 5px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.3);border-radius:8px;font-size:8px;color:#92400e;font-weight:600}
    .ldsp-bookmark-excerpt{font-size:10px;color:var(--txt-sec);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;padding:6px 0 0;word-break:break-word;border-top:1px dashed var(--border);margin-top:2px}
    .ldsp-bookmark-excerpt *{all:revert;font-size:inherit;line-height:inherit;color:inherit;margin:0;padding:0;border:none;background:none;box-shadow:none}
    .ldsp-bookmark-excerpt img{display:inline-block!important;max-width:18px!important;max-height:18px!important;vertical-align:middle!important;margin:0 2px!important;border-radius:2px!important}
    .ldsp-bookmark-excerpt a{color:var(--accent)!important;text-decoration:none!important}
    .ldsp-bookmark-excerpt a:hover{text-decoration:underline!important}
    .ldsp-bookmark-excerpt .emoji{width:18px!important;height:18px!important;vertical-align:middle!important}
    .ldsp-bookmark-excerpt .lightbox,.ldsp-bookmark-excerpt .lightbox img{display:inline!important;max-width:18px!important;max-height:18px!important}
    .ldsp-bookmark-excerpt .anchor{display:none!important}
    .ldsp-reply-list{display:flex;flex-direction:column;gap:8px}
    .ldsp-reply-item{display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--bg-card);border:1px solid var(--border);border-left:3px solid #10b981;border-radius:var(--r-md);cursor:pointer;transition:all .15s ease}
    .ldsp-reply-item:hover{background:var(--bg-hover);border-color:rgba(16,185,129,.5);border-left-color:#059669;transform:translateX(2px);box-shadow:0 2px 8px rgba(16,185,129,.1)}
    .ldsp-reply-title{font-size:12px;font-weight:600;color:var(--txt);line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .ldsp-reply-item:hover .ldsp-reply-title{color:#059669}
    .ldsp-reply-meta{display:flex;flex-wrap:wrap;gap:8px;font-size:9px;color:var(--txt-mut);align-items:center}
    .ldsp-reply-time,.ldsp-reply-to{display:flex;align-items:center;gap:3px;white-space:nowrap}
    .ldsp-reply-time svg,.ldsp-reply-to svg{width:10px;height:10px;stroke-width:2;flex-shrink:0;opacity:.6}
    .ldsp-reply-to{color:#10b981;font-weight:500}
    .ldsp-reply-excerpt{font-size:10px;color:var(--txt-sec);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;padding:6px 0 0;word-break:break-word;border-top:1px dashed var(--border);margin-top:2px}
    .ldsp-reply-excerpt *{all:revert;font-size:inherit;line-height:inherit;color:inherit;margin:0;padding:0;border:none;background:none;box-shadow:none}
    .ldsp-reply-excerpt img{display:inline-block!important;max-width:16px!important;max-height:16px!important;vertical-align:middle!important;margin:0 2px!important;border-radius:2px!important}
    .ldsp-reply-excerpt a{color:var(--accent)!important;text-decoration:none!important}
    .ldsp-reply-excerpt a:hover{text-decoration:underline!important}
    .ldsp-reply-excerpt .emoji{width:16px!important;height:16px!important;vertical-align:middle!important}
    .ldsp-reply-excerpt .lightbox,.ldsp-reply-excerpt .lightbox img{display:inline!important;max-width:16px!important;max-height:16px!important}
    .ldsp-reply-excerpt .anchor{display:none!important}
    .ldsp-like-list{display:flex;flex-direction:column;gap:8px}
    .ldsp-like-item{display:flex;flex-direction:column;gap:6px;padding:10px;background:var(--bg-card);border:1px solid var(--border);border-left:3px solid #ef4444;border-radius:var(--r-md);cursor:pointer;transition:all .15s ease}
    .ldsp-like-item:hover{background:var(--bg-hover);border-color:rgba(239,68,68,.5);border-left-color:#dc2626;transform:translateX(2px);box-shadow:0 2px 8px rgba(239,68,68,.1)}
    .ldsp-like-title{font-size:12px;font-weight:600;color:var(--txt);line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .ldsp-like-item:hover .ldsp-like-title{color:#dc2626}
    .ldsp-like-meta{display:flex;flex-wrap:wrap;gap:8px;font-size:9px;color:var(--txt-mut);align-items:center}
    .ldsp-like-time,.ldsp-like-author{display:flex;align-items:center;gap:3px;white-space:nowrap}
    .ldsp-like-time svg,.ldsp-like-author svg{width:10px;height:10px;stroke-width:2;flex-shrink:0;opacity:.6}
    .ldsp-like-author{color:#ef4444;font-weight:500}
    .ldsp-like-author svg{fill:#ef4444;stroke:none;opacity:.8}
    .ldsp-like-excerpt{font-size:10px;color:var(--txt-sec);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;padding:6px 0 0;word-break:break-word;border-top:1px dashed var(--border);margin-top:2px}
    .ldsp-like-excerpt *{all:revert;font-size:inherit;line-height:inherit;color:inherit;margin:0;padding:0;border:none;background:none;box-shadow:none}
    .ldsp-like-excerpt img{display:inline-block!important;max-width:16px!important;max-height:16px!important;vertical-align:middle!important;margin:0 2px!important;border-radius:2px!important}
    .ldsp-like-excerpt a{color:var(--accent)!important;text-decoration:none!important}
    .ldsp-like-excerpt a:hover{text-decoration:underline!important}
    .ldsp-like-excerpt .emoji{width:16px!important;height:16px!important;vertical-align:middle!important}
    .ldsp-like-excerpt .lightbox,.ldsp-like-excerpt .lightbox img{display:inline!important;max-width:16px!important;max-height:16px!important}
    .ldsp-like-excerpt .anchor{display:none!important}
    .ldsp-mytopic-list{display:flex;flex-direction:column;gap:8px}
    .ldsp-mytopic-item{display:flex;flex-direction:column;gap:5px;padding:10px;background:var(--bg-card);border:1px solid var(--border);border-left:3px solid #8b5cf6;border-radius:var(--r-md);cursor:pointer;transition:all .15s ease;text-decoration:none}
    .ldsp-mytopic-item:hover{background:var(--bg-hover);border-color:rgba(139,92,246,.5);border-left-color:#7c3aed;transform:translateX(2px);box-shadow:0 2px 8px rgba(139,92,246,.1)}
    .ldsp-mytopic-item.closed{opacity:.7}
    .ldsp-mytopic-item.closed .ldsp-mytopic-title{text-decoration:line-through;color:var(--txt-mut)}
    .ldsp-mytopic-header{display:flex;align-items:flex-start;gap:6px}
    .ldsp-mytopic-title{flex:1;font-size:12px;font-weight:600;color:var(--txt);line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .ldsp-mytopic-item:hover .ldsp-mytopic-title{color:#7c3aed}
    .ldsp-mytopic-icons{display:flex;gap:3px;flex-shrink:0}
    .ldsp-mytopic-status{display:flex;align-items:center;justify-content:center;width:14px;height:14px}
    .ldsp-mytopic-status svg{width:11px;height:11px;fill:#8b5cf6}
    .ldsp-mytopic-status.ldsp-mytopic-closed svg{fill:var(--txt-mut);stroke:var(--txt-mut);stroke-width:2}
    .ldsp-mytopic-row{display:flex;align-items:center;flex-wrap:nowrap;gap:6px}
    .ldsp-mytopic-tags{display:flex;flex-wrap:wrap;gap:3px;flex:1;min-width:0}
    .ldsp-mytopic-tag{padding:1px 6px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:8px;font-size:8px;color:#7c3aed;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ldsp-mytopic-tag-more{padding:1px 5px;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.3);border-radius:8px;font-size:8px;color:#6d28d9;font-weight:600}
    .ldsp-mytopic-time{display:flex;align-items:center;gap:3px;font-size:8px;color:var(--txt-mut);flex-shrink:0;white-space:nowrap}
    .ldsp-mytopic-time svg{width:9px;height:9px;stroke-width:2;flex-shrink:0;opacity:.7}
    .ldsp-mytopic-meta{display:flex;align-items:center;gap:8px;font-size:9px;color:var(--txt-mut);padding-top:5px;border-top:1px solid var(--border)}
    .ldsp-mytopic-stat{display:flex;align-items:center;gap:2px;white-space:nowrap}
    .ldsp-mytopic-stat svg{width:11px;height:11px;stroke-width:2;flex-shrink:0}
    .ldsp-mytopic-likes{color:#ef4444}
    .ldsp-mytopic-likes svg{stroke:#ef4444}
    .ldsp-mytopic-meta-right{display:flex;align-items:center;gap:6px;margin-left:auto;font-size:8px;white-space:nowrap}
    @media (max-width:320px){.ldsp-activity-content{padding:6px}.ldsp-topic-list{gap:4px}.ldsp-topic-item{padding:8px;gap:6px}.ldsp-topic-title{font-size:11px}.ldsp-topic-footer{gap:4px}.ldsp-topic-stats{gap:4px}.ldsp-topic-stat{font-size:8px}.ldsp-topic-stat svg{width:9px;height:9px}.ldsp-topic-time{font-size:8px}.ldsp-topic-thumbnail{width:40px;height:40px}.ldsp-topic-avatar{width:14px;height:14px;margin-left:-4px}.ldsp-topic-tag{max-width:45px;font-size:7px}.ldsp-bookmark-list,.ldsp-reply-list,.ldsp-like-list,.ldsp-mytopic-list{gap:6px}.ldsp-bookmark-item,.ldsp-reply-item,.ldsp-like-item,.ldsp-mytopic-item{padding:10px}.ldsp-bookmark-title,.ldsp-reply-title,.ldsp-like-title,.ldsp-mytopic-title{font-size:11px}.ldsp-bookmark-meta,.ldsp-reply-meta,.ldsp-like-meta,.ldsp-mytopic-meta{gap:8px;font-size:8px}.ldsp-bookmark-excerpt,.ldsp-reply-excerpt,.ldsp-like-excerpt{font-size:9px;-webkit-line-clamp:2}.ldsp-bookmark-tag,.ldsp-reply-to,.ldsp-like-author,.ldsp-mytopic-tag{font-size:7px}.ldsp-bookmark-time svg,.ldsp-reply-time svg,.ldsp-like-time svg,.ldsp-mytopic-time svg{width:9px;height:9px}.ldsp-follow-stats{gap:4px}.ldsp-follow-stat{padding:2px 4px;font-size:8px}.ldsp-follow-stat-icon{width:10px;height:10px}.ldsp-follow-stat-icon svg{width:9px;height:9px}.ldsp-follow-stat-num{font-size:9px}.ldsp-follow-tab{padding:7px 8px;font-size:9px}.ldsp-follow-tab-icon{width:12px;height:12px}.ldsp-follow-tab-icon svg{width:11px;height:11px}.ldsp-follow-tab-count{font-size:8px;padding:1px 4px}.ldsp-follow-item{padding:8px;gap:8px}.ldsp-follow-avatar{width:32px;height:32px}.ldsp-follow-user-name{font-size:11px}.ldsp-follow-user-id{font-size:9px}}
    @media (max-width:280px){.ldsp-topic-thumbnail{display:none}.ldsp-topic-posters{display:none}.ldsp-topic-stats{justify-content:flex-start}.ldsp-topic-tags{display:none}.ldsp-bookmark-tags,.ldsp-mytopic-tags{display:none}.ldsp-bookmark-excerpt,.ldsp-reply-excerpt,.ldsp-like-excerpt{-webkit-line-clamp:2}.ldsp-follow-stat-label{display:none}.ldsp-follow-arrow{display:none}.ldsp-follow-tab-text{display:none}}
    .ldsp-load-more{display:flex;align-items:center;justify-content:center;padding:12px;color:var(--txt-sec);font-size:10px}
    .ldsp-load-more.loading::after{content:'';width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:ldsp-spin .8s linear infinite;margin-left:6px}
    .ldsp-activity-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;color:var(--txt-mut)}
    .ldsp-activity-placeholder-icon{font-size:32px;margin-bottom:10px;opacity:.5}
    .ldsp-activity-placeholder-text{font-size:11px}
    .ldsp-tooltip{position:fixed;z-index:2147483647;max-width:220px;padding:6px 10px;background:linear-gradient(135deg,rgba(30,32,48,.96),rgba(24,26,38,.98));color:#e8eaf0;font-size:11px;font-weight:500;line-height:1.4;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.3),0 0 0 1px rgba(255,255,255,.06);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .15s ease,transform .15s ease;white-space:pre-line;word-break:break-word}
    .ldsp-tooltip.show{opacity:1;transform:translateY(0)}
    .ldsp-tooltip::before{content:'';position:absolute;width:8px;height:8px;background:inherit;transform:rotate(45deg);box-shadow:-1px -1px 0 rgba(255,255,255,.06)}
    .ldsp-tooltip.top::before{bottom:-4px;left:50%;margin-left:-4px}
    .ldsp-tooltip.bottom::before{top:-4px;left:50%;margin-left:-4px}
    .ldsp-tooltip.left::before{bottom:-4px;right:12px}
    .ldsp-tooltip.right::before{bottom:-4px;left:12px}
    #ldsp-panel.light .ldsp-tooltip{background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(248,250,254,.98));color:#2d3148;box-shadow:0 4px 16px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.06)}
    #ldsp-panel.light .ldsp-tooltip::before{box-shadow:-1px -1px 0 rgba(0,0,0,.04)}`;
            }
        };
        
        // ==================== Tooltip 管理器 ====================
        const Tooltip = {
            el: null,
            timer: null,
            currentTarget: null,
            
            init() {
                if (this.el) return;
                this.el = document.createElement('div');
                this.el.className = 'ldsp-tooltip';
                document.body.appendChild(this.el);
            },
            
            show(target, text, delay = 400) {
                if (!text || !target) return;
                this.hide();
                this.currentTarget = target;
                this.timer = setTimeout(() => {
                    if (this.currentTarget !== target) return;
                    this.el.textContent = text;
                    this.el.classList.remove('show', 'top', 'bottom', 'left', 'right');
                    
                    // 先显示以获取尺寸
                    this.el.style.visibility = 'hidden';
                    this.el.style.display = 'block';
                    
                    const rect = target.getBoundingClientRect();
                    const tipRect = this.el.getBoundingClientRect();
                    const padding = 8;
                    
                    // 计算位置（优先显示在上方）
                    let top, left;
                    const spaceAbove = rect.top;
                    const spaceBelow = window.innerHeight - rect.bottom;
                    
                    if (spaceAbove >= tipRect.height + padding || spaceAbove > spaceBelow) {
                        // 显示在上方
                        top = rect.top - tipRect.height - padding;
                        this.el.classList.add('top');
                    } else {
                        // 显示在下方
                        top = rect.bottom + padding;
                        this.el.classList.add('bottom');
                    }
                    
                    // 水平居中，但不超出屏幕
                    left = rect.left + (rect.width - tipRect.width) / 2;
                    if (left < padding) {
                        left = padding;
                        this.el.classList.add('right');
                    } else if (left + tipRect.width > window.innerWidth - padding) {
                        left = window.innerWidth - tipRect.width - padding;
                        this.el.classList.add('left');
                    }
                    
                    // 确保不超出顶部
                    if (top < padding) top = padding;
                    
                    this.el.style.top = `${top}px`;
                    this.el.style.left = `${left}px`;
                    this.el.style.visibility = '';
                    
                    // 添加面板主题类
                    const panel = document.getElementById('ldsp-panel');
                    if (panel?.classList.contains('light')) {
                        this.el.closest('body').querySelector('.ldsp-tooltip')?.classList.add('light-theme');
                    }
                    
                    requestAnimationFrame(() => this.el.classList.add('show'));
                }, delay);
            },
            
            hide() {
                if (this.timer) {
                    clearTimeout(this.timer);
                    this.timer = null;
                }
                this.currentTarget = null;
                if (this.el) {
                    this.el.classList.remove('show');
                }
            },
            
            // 绑定到面板
            bindToPanel(panel) {
                this.init();
                
                // 使用事件委托
                panel.addEventListener('mouseenter', (e) => {
                    const target = e.target.closest('[title], [data-tip]');
                    if (!target) return;
                    const text = target.dataset.tip || target.getAttribute('title');
                    if (text) {
                        // 临时移除 title 防止浏览器默认提示
                        if (target.hasAttribute('title')) {
                            target.dataset.tip = text;
                            target.removeAttribute('title');
                        }
                        this.show(target, text);
                    }
                }, true);
                
                panel.addEventListener('mouseleave', (e) => {
                    const target = e.target.closest('[data-tip]');
                    if (target) this.hide();
                }, true);
                
                // 滚动和点击时隐藏
                panel.addEventListener('scroll', () => this.hide(), true);
                panel.addEventListener('click', () => this.hide(), true);
            }
        };

        // ==================== 工单管理器 ====================
        class TicketManager {
            // 跨标签页共享的缓存 key
            static CACHE_KEY = 'ldsp_ticket_unread';
            static CACHE_TTL = 30 * 1000;  // 30 秒缓存有效期
            
            constructor(oauth, panelBody) {
                this.oauth = oauth;
                this.panelBody = panelBody;
                this.overlay = null;
                this.ticketTypes = [];
                this.tickets = [];
                this.currentTicket = null;
                this.currentView = 'list';
                this.unreadCount = 0;
                this._isOverlayOpen = false;  // 工单面板是否打开
                this._lastHiddenTime = null;  // 页面隐藏时间，用于触发式检测
            }

            async init() {
                this._createOverlay();
                await this._loadTicketTypes();
                this._bindVisibilityHandler();
                // 延迟 5 秒后首次检查
                setTimeout(() => this._checkUnread(), 5000);
            }
            
            _bindVisibilityHandler() {
                // 页面可见性变化时触发式检测（切换标签页、最小化窗口等）
                this._visibilityHandler = () => {
                    if (document.hidden) {
                        // 页面隐藏时，记录时间
                        this._lastHiddenTime = Date.now();
                    } else {
                        // 页面恢复可见时，检查是否超过10分钟阈值
                        const hiddenDuration = this._lastHiddenTime ? Date.now() - this._lastHiddenTime : 0;
                        const TEN_MINUTES = 10 * 60 * 1000;  // 10分钟
                        if (hiddenDuration >= TEN_MINUTES) {
                            // 超过10分钟，触发检测
                            this._checkUnread();
                        }
                        this._lastHiddenTime = null;
                    }
                };
                document.addEventListener('visibilitychange', this._visibilityHandler);
            }

            _createOverlay() {
                this.overlay = document.createElement('div');
                this.overlay.className = 'ldsp-ticket-overlay';
                this.overlay.innerHTML = `
                    <div class="ldsp-ticket-header">
                        <div class="ldsp-ticket-title">📪 工单系统</div>
                        <div class="ldsp-ticket-close">×</div>
                    </div>
                    <div class="ldsp-ticket-tabs">
                        <div class="ldsp-ticket-tab active" data-tab="list">我的工单</div>
                        <div class="ldsp-ticket-tab" data-tab="create">提交工单</div>
                    </div>
                    <div class="ldsp-ticket-body"></div>`;
                if (this.panelBody) {
                    this.panelBody.appendChild(this.overlay);
                }
                this._bindEvents();
            }

            _bindEvents() {
                this.overlay.querySelector('.ldsp-ticket-close').addEventListener('click', () => this.hide());
                document.addEventListener('keydown', e => {
                    if (e.key === 'Escape' && this.overlay.classList.contains('show')) this.hide();
                });
                this.overlay.querySelectorAll('.ldsp-ticket-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        this.overlay.querySelectorAll('.ldsp-ticket-tab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        const tabName = tab.dataset.tab;
                        if (tabName === 'list') {
                            // 先显示加载状态
                            this._showListLoading();
                            this._loadTickets().then(() => this._renderList());
                        } else if (tabName === 'create') {
                            this._renderCreate();
                        }
                    });
                });
            }

            async _loadTicketTypes() {
                const defaultTypes = [
                    { id: 'feature_request', label: '功能建议', icon: '💡' },
                    { id: 'bug_report', label: 'BUG反馈', icon: '📪' }
                ];
                try {
                    const result = await this.oauth?.api('/api/tickets/types');
                    const data = result?.data?.data || result?.data;
                    this.ticketTypes = (result?.success && data?.types) ? data.types : defaultTypes;
                } catch (e) {
                    this.ticketTypes = defaultTypes;
                }
            }

            // 检查未读工单数（触发式调用，支持跨标签页缓存）
            // 触发时机：1. 面板打开 2. 页面可见性恢复(>10分钟) 3. 数据同步完成
            async _checkUnread(forceRefresh = false) {
                // 1. 检查登录状态
                if (!this.oauth?.isLoggedIn()) return;
                
                const now = Date.now();
                
                // 2. 检查跨标签页共享缓存（除非强制刷新）
                if (!forceRefresh) {
                    try {
                        const cached = GM_getValue(TicketManager.CACHE_KEY, null);
                        if (cached && (now - cached.time) < TicketManager.CACHE_TTL) {
                            // 使用缓存数据更新徽章
                            this.unreadCount = cached.count || 0;
                            this._updateBadge();
                            return;
                        }
                    } catch (e) { /* 缓存读取失败，继续请求 */ }
                }
                
                // 3. 发起请求
                try {
                    const result = await this.oauth.api('/api/tickets/unread/count');
                    const data = result.data?.data || result.data;
                    if (result.success) {
                        this.unreadCount = data?.count || 0;
                        this._updateBadge();
                        // 更新跨标签页缓存
                        try {
                            GM_setValue(TicketManager.CACHE_KEY, { count: this.unreadCount, time: now });
                        } catch (e) { /* 缓存写入失败，忽略 */ }
                    }
                } catch (e) {
                    // 静默失败（未登录等情况）
                }
            }

            _updateBadge() {
                const btn = document.querySelector('.ldsp-ticket-btn');
                if (!btn) return;
                let badge = btn.querySelector('.ldsp-ticket-badge');
                if (this.unreadCount > 0) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'ldsp-ticket-badge';
                        btn.appendChild(badge);
                    }
                    badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                } else if (badge) {
                    badge.remove();
                }
            }

            async show() {
                this.currentView = 'list';
                this._isOverlayOpen = true;
                const activeTab = this.overlay.querySelector('.ldsp-ticket-tab.active');
                if (activeTab?.dataset.tab === 'create') {
                    this._renderCreate();
                } else {
                    // 先显示加载状态
                    this._showListLoading();
                }
                this.overlay.classList.add('show');
                // 异步加载工单列表
                await this._loadTickets();
                this._updateTabBadge();
                if (activeTab?.dataset.tab !== 'create') {
                    this._renderList();
                }
                // 工单面板打开时立即检查一次（触发式检测）
                if (!document.hidden) {
                    this._checkUnread(true);  // 强制刷新，忽略缓存
                }
            }

            _updateTabBadge() {
                const listTab = this.overlay.querySelector('.ldsp-ticket-tab[data-tab="list"]');
                if (!listTab) return;
                const hasUnread = this.tickets.some(t => t.has_new_reply);
                listTab.classList.toggle('has-unread', hasUnread);
            }

            _showListLoading() {
                const body = this.overlay.querySelector('.ldsp-ticket-body');
                if (!body) return;
                body.classList.remove('detail-mode');
                body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;flex:1;min-height:120px"><div class="ldsp-loading"><div class="ldsp-spinner"></div><div>加载中...</div></div></div>';
            }

            hide() {
                this._isOverlayOpen = false;
                this.overlay.classList.remove('show');
                this.currentView = 'list';
                this.currentTicket = null;
                this.overlay.querySelectorAll('.ldsp-ticket-tab').forEach(t => t.classList.remove('active'));
                this.overlay.querySelector('.ldsp-ticket-tab[data-tab="list"]')?.classList.add('active');
            }

            async _loadTickets() {
                try {
                    const result = await this.oauth?.api('/api/tickets');
                    const data = result?.data?.data || result?.data;
                    this.tickets = result?.success ? (data?.tickets || []) : [];
                } catch (e) {
                    this.tickets = [];
                }
            }

            _renderList() {
                this.currentView = 'list';
                const body = this.overlay.querySelector('.ldsp-ticket-body');
                body.classList.remove('detail-mode');
                
                if (this.tickets.length === 0) {
                    body.innerHTML = `
                        <div class="ldsp-ticket-empty">
                            <div class="ldsp-ticket-empty-icon">📭</div>
                            <div>暂无工单记录</div>
                            <div style="margin-top:6px;font-size:10px">点击"提交工单"反馈建议或问题</div>
                        </div>`;
                    return;
                }

                body.innerHTML = `
                    <div class="ldsp-ticket-list">
                        ${this.tickets.map(t => `
                            <div class="ldsp-ticket-item ${t.has_new_reply ? 'has-reply' : ''}" data-id="${t.id}">
                                <div class="ldsp-ticket-item-header">
                                    <span class="ldsp-ticket-item-type">${this._getTypeIcon(t.type)} ${this._getTypeLabel(t.type)}</span>
                                    <span class="ldsp-ticket-item-status ${t.status}">${t.status === 'open' ? '处理中' : '已关闭'}</span>
                                </div>
                                <div class="ldsp-ticket-item-title">${Utils.sanitize(t.title, 50)}</div>
                                <div class="ldsp-ticket-item-meta">
                                    <span>#${t.id}</span>
                                    <span>${this._formatTime(t.created_at)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>`;

                body.querySelectorAll('.ldsp-ticket-item').forEach(item => {
                    item.addEventListener('click', () => this._showDetail(item.dataset.id));
                });
            }

            _renderCreate() {
                this.currentView = 'create';
                const body = this.overlay.querySelector('.ldsp-ticket-body');
                body.classList.remove('detail-mode');
                
                if (!this.ticketTypes || this.ticketTypes.length === 0) {
                    this.ticketTypes = [
                        { id: 'feature_request', label: '功能建议', icon: '💡' },
                        { id: 'bug_report', label: 'BUG反馈', icon: '📪' }
                    ];
                }
                
                // 不同类型的 placeholder 提示
                const placeholders = {
                    'feature_request': '请详细描述您的功能建议...',
                    'bug_report': '请详细描述您遇到的问题，建议包含以下信息：\n\n• 浏览器及版本（如 Chrome 120）\n• 操作系统（如 Windows 11）\n• 问题复现步骤\n• 预期行为与实际行为'
                };
                const defaultPlaceholder = placeholders[this.ticketTypes[0]?.id] || placeholders['feature_request'];
                
                body.innerHTML = `
                    <div class="ldsp-ticket-form">
                        <div class="ldsp-ticket-form-group">
                            <div class="ldsp-ticket-label">工单类型</div>
                            <div class="ldsp-ticket-types">
                                ${this.ticketTypes.map((t, i) => `
                                    <div class="ldsp-ticket-type ${i === 0 ? 'selected' : ''}" data-type="${t.id}">
                                        <span class="ldsp-ticket-type-icon">${t.icon}</span>
                                        <span class="ldsp-ticket-type-label">${t.label}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="ldsp-ticket-form-group">
                            <div class="ldsp-ticket-label">标题 <span style="color:var(--txt-mut);font-weight:400">(4-50字)</span></div>
                            <input type="text" class="ldsp-ticket-input" placeholder="简要描述您的问题或建议" minlength="4" maxlength="50">
                        </div>
                        <div class="ldsp-ticket-form-group">
                            <div class="ldsp-ticket-label">详细描述 <span style="color:var(--txt-mut);font-weight:400">(8-500字)</span></div>
                            <textarea class="ldsp-ticket-textarea" placeholder="${defaultPlaceholder}" minlength="8" maxlength="500"></textarea>
                        </div>
                        <button class="ldsp-ticket-submit">提交工单</button>
                    </div>`;

                const textarea = body.querySelector('.ldsp-ticket-textarea');
                body.querySelectorAll('.ldsp-ticket-type').forEach(type => {
                    type.addEventListener('click', () => {
                        body.querySelectorAll('.ldsp-ticket-type').forEach(t => t.classList.remove('selected'));
                        type.classList.add('selected');
                        // 根据类型更新 placeholder
                        const selectedType = type.dataset.type;
                        textarea.placeholder = placeholders[selectedType] || placeholders['feature_request'];
                    });
                });

                body.querySelector('.ldsp-ticket-submit').addEventListener('click', () => this._submitTicket());
            }

            async _submitTicket() {
                const body = this.overlay.querySelector('.ldsp-ticket-body');
                const type = body.querySelector('.ldsp-ticket-type.selected')?.dataset.type;
                const title = body.querySelector('.ldsp-ticket-input')?.value.trim();
                const content = body.querySelector('.ldsp-ticket-textarea')?.value.trim();
                const btn = body.querySelector('.ldsp-ticket-submit');

                if (!title || title.length < 4) { alert('标题至少需要4个字符'); return; }
                if (title.length > 50) { alert('标题最多50个字符'); return; }
                if (!content || content.length < 8) { alert('描述至少需要8个字符'); return; }
                if (content.length > 500) { alert('描述最多500个字符'); return; }

                btn.disabled = true;
                btn.textContent = '提交中...';

                try {
                    const result = await this.oauth.api('/api/tickets', {
                        method: 'POST',
                        body: JSON.stringify({ type: type || 'feature_request', title, content })
                    });
                    const data = result.data?.data || result.data;
                    if (result.success || data?.success) {
                        await this._loadTickets();
                        this.overlay.querySelectorAll('.ldsp-ticket-tab').forEach(t => t.classList.remove('active'));
                        this.overlay.querySelector('.ldsp-ticket-tab[data-tab="list"]')?.classList.add('active');
                        this._renderList();
                    } else {
                        // 检测登录失效情况
                        const errCode = result.error?.code;
                        if (errCode === 'NOT_LOGGED_IN' || errCode === 'AUTH_EXPIRED' || errCode === 'INVALID_TOKEN') {
                            alert('登录已失效，请重新登录后再试');
                        } else {
                            alert(result.error?.message || result.error || data?.error || '提交失败');
                        }
                    }
                } catch (e) {
                    alert('提交失败: ' + (e.message || '网络错误'));
                } finally {
                    btn.disabled = false;
                    btn.textContent = '提交工单';
                }
            }

            async _showDetail(ticketId) {
                this.currentView = 'detail';
                const body = this.overlay.querySelector('.ldsp-ticket-body');
                body.classList.add('detail-mode');
                body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;flex:1"><div class="ldsp-loading"><div class="ldsp-spinner"></div><div>加载中...</div></div></div>';

                try {
                    const result = await this.oauth.api(`/api/tickets/${ticketId}`);
                    if (!result.success) {
                        const errCode = result.error?.code;
                        if (errCode === 'NOT_LOGGED_IN' || errCode === 'AUTH_EXPIRED' || errCode === 'INVALID_TOKEN') {
                            throw new Error('登录已失效，请重新登录');
                        }
                        throw new Error(result.error?.message || result.error || '加载失败');
                    }
                    
                    const data = result.data?.data || result.data;
                    const ticket = data?.ticket || data;
                    const replies = ticket?.replies || [];
                    this.currentTicket = ticket;

                    body.innerHTML = `
                        <div class="ldsp-ticket-detail">
                            <div class="ldsp-ticket-detail-top">
                                <div class="ldsp-ticket-back">← 返回</div>
                                <div class="ldsp-ticket-detail-header">
                                    <div class="ldsp-ticket-detail-title">${Utils.sanitize(ticket.title, 100)}</div>
                                    <div class="ldsp-ticket-detail-meta">
                                        <span>${this._getTypeIcon(ticket.type)} ${this._getTypeLabel(ticket.type)}</span>
                                        <span>#${ticket.id}</span>
                                        <span class="ldsp-ticket-item-status ${ticket.status}">${ticket.status === 'open' ? '处理中' : '已关闭'}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="ldsp-ticket-messages">
                                <div class="ldsp-ticket-reply user">
                                    <div class="ldsp-ticket-reply-header">
                                        <span class="ldsp-ticket-reply-author">👤 我</span>
                                        <span>${this._formatTime(ticket.created_at)}</span>
                                    </div>
                                    <div class="ldsp-ticket-reply-content">${Utils.sanitize(ticket.content, 2000)}</div>
                                </div>
                                ${replies.map(r => `
                                    <div class="ldsp-ticket-reply ${r.is_admin ? 'admin' : 'user'}">
                                        <div class="ldsp-ticket-reply-header">
                                            <span class="ldsp-ticket-reply-author">${r.is_admin ? '👨‍💼 ' + (r.admin_name || '管理员') : '👤 我'}</span>
                                            <span>${this._formatTime(r.created_at)}</span>
                                        </div>
                                        <div class="ldsp-ticket-reply-content">${Utils.sanitize(r.content, 2000)}</div>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="ldsp-ticket-input-area">
                                ${ticket.status === 'open' ? `
                                    <div class="ldsp-ticket-reply-form">
                                        <textarea class="ldsp-ticket-reply-input" placeholder="输入回复..." maxlength="500"></textarea>
                                        <button class="ldsp-ticket-reply-btn">发送</button>
                                    </div>
                                ` : '<div class="ldsp-ticket-closed-hint">此工单已关闭</div>'}
                            </div>
                        </div>`;

                    body.querySelector('.ldsp-ticket-back').addEventListener('click', () => {
                        this._loadTickets().then(() => this._renderList());
                    });

                    const replyBtn = body.querySelector('.ldsp-ticket-reply-btn');
                    if (replyBtn) {
                        replyBtn.addEventListener('click', () => this._sendReply(ticketId));
                    }
                    
                    requestAnimationFrame(() => {
                        const messagesEl = body.querySelector('.ldsp-ticket-messages');
                        if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
                    });

                    if (ticket.has_new_reply) {
                        // 获取工单详情时已自动标记已读，只需更新本地状态
                        this._checkUnread();
                        const t = this.tickets.find(x => x.id == ticketId);
                        if (t) t.has_new_reply = false;
                        this._updateTabBadge();
                    }
                } catch (e) {
                    body.innerHTML = '<div class="ldsp-ticket-empty"><div class="ldsp-ticket-empty-icon">❌</div><div>加载失败</div></div>';
                }
            }

            async _sendReply(ticketId) {
                const body = this.overlay.querySelector('.ldsp-ticket-body');
                const input = body.querySelector('.ldsp-ticket-reply-input');
                const btn = body.querySelector('.ldsp-ticket-reply-btn');
                const text = input?.value.trim();

                if (!text) return;

                btn.disabled = true;
                try {
                    const result = await this.oauth.api(`/api/tickets/${ticketId}/reply`, {
                        method: 'POST',
                        body: JSON.stringify({ content: text })
                    });
                    if (result.success) {
                        this._showDetail(ticketId);
                    } else {
                        // 检测登录失效情况
                        const errCode = result.error?.code;
                        if (errCode === 'NOT_LOGGED_IN' || errCode === 'AUTH_EXPIRED' || errCode === 'INVALID_TOKEN') {
                            alert('登录已失效，请重新登录后再试');
                        } else {
                            alert(result.error?.message || result.error || '发送失败');
                        }
                    }
                } catch (e) {
                    alert('网络错误');
                } finally {
                    btn.disabled = false;
                }
            }

            _getTypeIcon(type) {
                const t = this.ticketTypes.find(x => x.id === type);
                return t?.icon || '💡';
            }

            _getTypeLabel(type) {
                const t = this.ticketTypes.find(x => x.id === type);
                return t?.label || type;
            }

            _formatTime(ts) {
                if (!ts) return '';
                const d = new Date(ts);
                const now = new Date();
                const diff = (now - d) / 1000;
                if (diff < 60) return '刚刚';
                if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
                if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
                if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
                return `${d.getMonth() + 1}/${d.getDate()}`;
            }

            // 销毁方法 - 清理定时器和事件监听
            destroy() {
                this._stopUnreadPoll();
                // 移除页面可见性监听
                if (this._visibilityHandler) {
                    document.removeEventListener('visibilitychange', this._visibilityHandler);
                    this._visibilityHandler = null;
                }
                if (this.overlay) {
                    this.overlay.remove();
                    this.overlay = null;
                }
            }
        }

        // ==================== 吃瓜助手 ====================
        class MelonHelper {
            static STORAGE_KEY = 'ldsp_melon_config';
            static HISTORY_KEY = 'ldsp_melon_history';
            
            // 简略总结提示词
            static PROMPT_BRIEF = `用简洁的方式总结以下论坛讨论：`;

            // 详细总结提示词
            static PROMPT_DETAILED = `详细分析和总结以下论坛讨论：`;

            constructor(panelBody, renderer) {
                this.panelBody = panelBody;
                this.renderer = renderer;
                this.overlay = null;
                this.config = this._loadConfig();
                this.history = this._loadHistory();
                this._abortController = null;
                this._isEditing = false;
                this._topicCache = null;
                this._currentOutput = '';  // 当前输出的原始文本
                this._summaryMode = 'detailed';  // 默认详细模式
                this._lastUrl = location.href;  // 上次URL
                this._urlCheckInterval = null;  // URL检测定时器
            }

            _loadConfig() {
                try {
                    const saved = GM_getValue(MelonHelper.STORAGE_KEY, null);
                    const defaultConfig = {
                        apiUrl: '',
                        apiKey: '',
                        model: 'gpt-4o-mini',
                        promptBrief: '',
                        promptDetailed: ''
                    };
                    return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
                } catch {
                    return { apiUrl: '', apiKey: '', model: 'gpt-4o-mini', promptBrief: '', promptDetailed: '' };
                }
            }

            _saveConfig() {
                try {
                    GM_setValue(MelonHelper.STORAGE_KEY, JSON.stringify(this.config));
                } catch (e) {
                    Logger.error('[MelonHelper] Save config failed:', e);
                }
            }

            _loadHistory() {
                try {
                    const saved = GM_getValue(MelonHelper.HISTORY_KEY, null);
                    return saved ? JSON.parse(saved) : [];
                } catch {
                    return [];
                }
            }

            _saveHistory() {
                try {
                    GM_setValue(MelonHelper.HISTORY_KEY, JSON.stringify(this.history));
                } catch (e) {
                    Logger.error('[MelonHelper] Save history failed:', e);
                }
            }

            _addToHistory(topicId, title, summary, mode) {
                // 以 topicId + mode 为主键，同一话题的简略和详细版可以同时存在
                const historyKey = `${topicId}_${mode}`;
                const existingIndex = this.history.findIndex(h => `${h.topicId}_${h.mode}` === historyKey);
                const record = {
                    topicId,
                    title,
                    summary,
                    mode,
                    timestamp: Date.now()
                };
                if (existingIndex >= 0) {
                    this.history[existingIndex] = record;
                } else {
                    this.history.unshift(record);
                }
                // 最多保留 100 条
                if (this.history.length > 100) {
                    this.history = this.history.slice(0, 100);
                }
                this._saveHistory();
            }

            _clearHistory() {
                this.history = [];
                this._saveHistory();
            }

            init() {
                this._createOverlay();
            }

            _createOverlay() {
                this.overlay = document.createElement('div');
                this.overlay.className = 'ldsp-melon-overlay';
                this.overlay.innerHTML = `
                    <div class="ldsp-melon-header">
                        <div class="ldsp-melon-title">🍉 吃瓜助手</div>
                        <div class="ldsp-melon-close">×</div>
                    </div>
                    <div class="ldsp-melon-tabs">
                        <div class="ldsp-melon-tab active" data-tab="home">首页</div>
                        <div class="ldsp-melon-tab" data-tab="history">历史</div>
                        <div class="ldsp-melon-tab" data-tab="settings">设置</div>
                    </div>
                    <div class="ldsp-melon-body"></div>`;
                if (this.panelBody) {
                    this.panelBody.appendChild(this.overlay);
                }
                this._bindEvents();
            }

            _bindEvents() {
                this.overlay.querySelector('.ldsp-melon-close').addEventListener('click', () => this.hide());
                document.addEventListener('keydown', e => {
                    if (e.key === 'Escape' && this.overlay.classList.contains('show')) this.hide();
                });
                this.overlay.querySelectorAll('.ldsp-melon-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        this.overlay.querySelectorAll('.ldsp-melon-tab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        const tabName = tab.dataset.tab;
                        if (tabName === 'home') {
                            this._renderHome();
                        } else if (tabName === 'history') {
                            this._renderHistory();
                        } else if (tabName === 'settings') {
                            this._renderSettings();
                        }
                    });
                });
                
            }
            
            // URL 监听 - 仅在面板打开且非话题页时启动
            _startUrlWatch() {
                if (this._urlCheckInterval) return;
                this._urlCheckInterval = setInterval(() => {
                    const currentUrl = location.href;
                    if (currentUrl !== this._lastUrl) {
                        this._lastUrl = currentUrl;
                        this._topicCache = null;  // 清空话题缓存
                        
                        // 如果面板打开且在首页，检测到话题 ID 有变化时刷新
                        if (this.overlay.classList.contains('show')) {
                            const activeTab = this.overlay.querySelector('.ldsp-melon-tab.active');
                            if (activeTab?.dataset.tab === 'home') {
                                const newTopicId = this._getTopicId();
                                // 只有当进入新话题时才刷新（从非话题页进入话题页）
                                if (newTopicId) {
                                    this._renderHome();
                                    // 成功进入话题后停止轮询，避免频繁刷新
                                    this._stopUrlWatch();
                                }
                            }
                        }
                    }
                }, 800);  // 降低检测频率
            }
            
            _stopUrlWatch() {
                if (this._urlCheckInterval) {
                    clearInterval(this._urlCheckInterval);
                    this._urlCheckInterval = null;
                }
            }

            show() {
                // 更新 URL 记录
                this._lastUrl = location.href;
                
                // 检查是否切换了话题，如果是则清空缓存
                const currentTopicId = this._getTopicId();
                if (this._topicCache && this._topicCache.id !== currentTopicId) {
                    this._topicCache = null;
                    Logger.log('[MelonHelper] Topic changed, clearing cache');
                }
                
                this.overlay.classList.add('show');
                const activeTab = this.overlay.querySelector('.ldsp-melon-tab.active');
                if (activeTab?.dataset.tab === 'settings') {
                    this._renderSettings();
                } else {
                    this._renderHome();
                }
            }

            hide() {
                // 停止 URL 监听
                this._stopUrlWatch();
                // 中止正在进行的请求
                if (this._abortController) {
                    this._abortController.abort();
                    this._abortController = null;
                }
                this.overlay.classList.remove('show');
            }

            _getTopicId() {
                return window.location.href.match(/\/t(?:opic)?\/[^\/]+\/(\d+)/)?.[1] || 
                       window.location.href.match(/\/t(?:opic)?\/(\d+)/)?.[1];
            }

            _getReplyCount() {
                const el = document.querySelector('.timeline-replies');
                if (!el) return 0;
                const txt = el.textContent.trim();
                return parseInt(txt.includes('/') ? txt.split('/')[1] : txt) || 0;
            }

            async _getTopicInfo(forceRefresh = false) {
                const topicId = this._getTopicId();
                if (!topicId) return null;
                
                // 使用缓存（同一话题不重复请求）
                if (!forceRefresh && this._topicCache && this._topicCache.id === topicId) {
                    Logger.log('[MelonHelper] Using cached topic info');
                    return this._topicCache;
                }
                
                try {
                    Logger.log('[MelonHelper] Fetching topic info for:', topicId);
                    const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
                    const response = await fetch(`${location.origin}/t/${topicId}.json`, {
                        headers: {
                            'x-csrf-token': csrf,
                            'x-requested-with': 'XMLHttpRequest'
                        }
                    });
                    if (!response.ok) {
                        Logger.warn('[MelonHelper] Topic API response not ok:', response.status);
                        throw new Error(`HTTP ${response.status}`);
                    }
                    const data = await response.json();
                    Logger.log('[MelonHelper] Topic data received:', { title: data.title, posts_count: data.posts_count });
                    
                    this._topicCache = {
                        id: topicId,
                        title: data.title || '未知标题',
                        category: data.category_id ? (document.querySelector('.category-name')?.textContent || '') : '',
                        postsCount: data.posts_count || 1,
                        replyCount: Math.max(0, (data.posts_count || 1) - 1),
                        views: data.views || 0,
                        likeCount: data.like_count || 0,
                        createdAt: data.created_at,
                        lastPostedAt: data.last_posted_at
                    };
                    return this._topicCache;
                } catch (e) {
                    Logger.error('[MelonHelper] Get topic info failed:', e);
                    // 降级：从页面 DOM 获取
                    const fallbackInfo = {
                        id: topicId,
                        title: document.querySelector('.fancy-title, .topic-title')?.textContent?.trim() || '当前话题',
                        replyCount: this._getReplyCount(),
                        postsCount: Math.max(1, this._getReplyCount() + 1),
                        views: 0
                    };
                    Logger.log('[MelonHelper] Using fallback info:', fallbackInfo);
                    return fallbackInfo;
                }
            }

            async _fetchDialogues(topicId, start, end, progressCallback) {
                Logger.log('[MelonHelper] Fetching dialogues:', { topicId, start, end });
                const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
                const opts = {
                    headers: {
                        'x-csrf-token': csrf,
                        'x-requested-with': 'XMLHttpRequest'
                    }
                };

                // 获取帖子ID列表
                progressCallback?.('正在获取帖子列表...');
                const idRes = await fetch(`${location.origin}/t/${topicId}/post_ids.json?post_number=0&limit=99999`, opts);
                if (!idRes.ok) throw new Error(`获取帖子列表失败 (${idRes.status})`);
                const idData = await idRes.json();
                Logger.log('[MelonHelper] Total post IDs:', idData.post_ids?.length);
                
                let pIds = idData.post_ids.slice(Math.max(0, start - 1), end);
                Logger.log('[MelonHelper] Selected post IDs count:', pIds.length);

                // 如果包含第1楼，获取主帖信息确保第一楼ID正确
                if (start <= 1 && pIds.length > 0) {
                    const mainRes = await fetch(`${location.origin}/t/${topicId}.json`, opts);
                    if (mainRes.ok) {
                        const mainData = await mainRes.json();
                        const firstId = mainData.post_stream?.posts?.[0]?.id;
                        if (firstId && !pIds.includes(firstId)) {
                            pIds.unshift(firstId);
                            Logger.log('[MelonHelper] Added first post ID:', firstId);
                        }
                    }
                }

                if (pIds.length === 0) {
                    throw new Error('没有找到帖子内容');
                }

                let text = '';
                const totalBatches = Math.ceil(pIds.length / 200);
                
                // 分批获取帖子详情（每批200条）
                for (let i = 0; i < pIds.length; i += 200) {
                    const batchNum = Math.floor(i / 200) + 1;
                    progressCallback?.(`正在获取帖子内容 (${batchNum}/${totalBatches})...`);
                    
                    const chunk = pIds.slice(i, i + 200);
                    const q = chunk.map(id => `post_ids[]=${id}`).join('&');
                    const res = await fetch(`${location.origin}/t/${topicId}/posts.json?${q}&include_suggested=false`, opts);
                    if (!res.ok) throw new Error(`获取帖子详情失败 (${res.status})`);
                    const data = await res.json();
                    
                    Logger.log('[MelonHelper] Batch', batchNum, 'posts count:', data.post_stream?.posts?.length);

                    text += data.post_stream.posts.map(p => {
                        let content = p.cooked || '';

                        // 处理图片
                        content = content.replace(
                            /<div class="lightbox-wrapper">\s*<a class="lightbox" href="([^"]+)"(?:\s+data-download-href="([^"]+)")?[^>]*title="([^"]*)"[^>]*>[\s\S]*?<\/a>\s*<\/div>/gi,
                            (match, hrefUrl, downloadHref, title) => {
                                let imgUrl = hrefUrl || `${location.origin}${downloadHref || ''}`;
                                const filename = title || '图片';
                                return `\n[图片: ${filename}](${imgUrl})\n`;
                            }
                        );

                        // 处理附件
                        content = content.replace(
                            /<a class="attachment" href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
                            (match, url, name) => `\n[附件: ${name.trim()}](${url})\n`
                        );

                        // 处理emoji
                        content = content.replace(
                            /<img[^>]+class="emoji[^>]*alt="([^"]*)"[^>]*>/gi,
                            '$1 '
                        );

                        // 处理引用块
                        content = content.replace(
                            /<aside class="quote(?:-modified)?[^>]*>[\s\S]*?<blockquote>([\s\S]*?)<\/blockquote>[\s\S]*?<\/aside>/gi,
                            (match, quoteInner) => {
                                let cleanQuote = quoteInner.replace(/<[^>]+>/g, '').trim();
                                return `\n[引用]\n${cleanQuote}\n[/引用]\n`;
                            }
                        );

                        // 移除所有HTML标签
                        content = content.replace(/<[^>]+>/g, '').trim();

                        // 格式化输出
                        const userName = p.name || p.username;
                        const userPart = `${userName}（${p.username}）`;
                        let replyPart = '';

                        if (p.reply_to_post_number && p.reply_to_user) {
                            const replyToName = p.reply_to_user.name || p.reply_to_user.username;
                            const replyToUsername = p.reply_to_user.username;
                            replyPart = `-回复[${p.reply_to_post_number}楼] ${replyToName}（${replyToUsername}）`;
                        }

                        return `[${p.post_number}楼] ${userPart}${replyPart}:\n${content}`;
                    }).join('\n\n');
                }

                return text;
            }

            _renderHome() {
                const body = this.overlay.querySelector('.ldsp-melon-body');
                const topicId = this._getTopicId();

                if (!topicId) {
                    // 非话题页，启动 URL 监听等待用户进入话题
                    this._startUrlWatch();
                    body.innerHTML = `
                        <div class="ldsp-melon-not-topic">
                            <div class="ldsp-melon-not-topic-icon">🍈</div>
                            <div class="ldsp-melon-not-topic-text">请先进入一个话题帖子<br>才能使用吃瓜助手哦~</div>
                            <div class="ldsp-melon-not-topic-hint">进入话题后会自动刷新</div>
                        </div>`;
                    return;
                }

                // 已在话题页，停止 URL 监听
                this._stopUrlWatch();

                // 先显示加载状态
                body.innerHTML = `<div class="ldsp-melon-status"><div class="ldsp-melon-status-icon">⏳</div>正在获取话题信息...</div>`;

                this._getTopicInfo().then(info => {
                    if (!info) {
                        body.innerHTML = `<div class="ldsp-melon-error">❌ 获取话题信息失败，请刷新页面后重试</div>`;
                        return;
                    }

                    const totalPosts = info.postsCount || 1;
                    const defaultEnd = totalPosts;
                    const rangeHint = totalPosts > 100 ? `共${totalPosts}楼，内容较多可能需要较长时间` : `共${totalPosts}楼`;

                    // 检查是否已配置 API
                    const hasConfig = this.config.apiUrl && this.config.apiKey;

                    body.innerHTML = `
                        <div class="ldsp-melon-info">
                            <div class="ldsp-melon-info-title">📋 ${Utils.escapeHtml(info.title)}</div>
                            <div class="ldsp-melon-info-row">
                                <span class="ldsp-melon-info-label">总楼层</span>
                                <span class="ldsp-melon-info-value">${totalPosts} 楼</span>
                            </div>
                            ${info.views ? `<div class="ldsp-melon-info-row">
                                <span class="ldsp-melon-info-label">浏览量</span>
                                <span class="ldsp-melon-info-value">${info.views.toLocaleString()}</span>
                            </div>` : ''}
                            ${info.likeCount ? `<div class="ldsp-melon-info-row">
                                <span class="ldsp-melon-info-label">点赞数</span>
                                <span class="ldsp-melon-info-value">${info.likeCount}</span>
                            </div>` : ''}
                        </div>
                        ${!hasConfig ? `<div class="ldsp-melon-warning">⚠️ 请先在「设置」中配置 API 信息</div>` : ''}
                        <div class="ldsp-melon-range">
                            <span class="ldsp-melon-range-label">楼层范围</span>
                            <input type="number" class="ldsp-melon-range-input" id="melon-start" value="1" min="1" max="${totalPosts}">
                            <span class="ldsp-melon-range-sep">~</span>
                            <input type="number" class="ldsp-melon-range-input" id="melon-end" value="${defaultEnd}" min="1" max="${totalPosts}">
                            <span class="ldsp-melon-range-hint">${rangeHint}</span>
                        </div>
                        <div class="ldsp-melon-mode-selector">
                            <span class="ldsp-melon-mode-label">总结模式</span>
                            <div class="ldsp-melon-mode-cards">
                                <label class="ldsp-melon-mode-card ${this._summaryMode === 'brief' ? 'active' : ''}">
                                    <input type="radio" name="melon-mode" value="brief" ${this._summaryMode === 'brief' ? 'checked' : ''}>
                                    <div class="ldsp-melon-mode-card-icon">⚡</div>
                                    <div class="ldsp-melon-mode-card-content">
                                        <div class="ldsp-melon-mode-card-title">简略模式</div>
                                        <div class="ldsp-melon-mode-card-desc">~150字快速概要</div>
                                    </div>
                                </label>
                                <label class="ldsp-melon-mode-card ${this._summaryMode === 'detailed' ? 'active' : ''}">
                                    <input type="radio" name="melon-mode" value="detailed" ${this._summaryMode === 'detailed' ? 'checked' : ''}>
                                    <div class="ldsp-melon-mode-card-icon">📊</div>
                                    <div class="ldsp-melon-mode-card-content">
                                        <div class="ldsp-melon-mode-card-title">详细模式</div>
                                        <div class="ldsp-melon-mode-card-desc">完整结构化分析</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div class="ldsp-melon-actions">
                            <button class="ldsp-melon-btn-summarize" id="melon-summarize" ${!hasConfig ? 'disabled' : ''}>
                                <span>🍉</span>
                                <span>立即吃瓜</span>
                            </button>
                        </div>
                        <div class="ldsp-melon-output-wrapper">
                            <div class="ldsp-melon-output-header" style="display:none;">
                                <span class="ldsp-melon-output-title">📝 总结结果</span>
                                <div class="ldsp-melon-output-actions">
                                    <button class="ldsp-melon-resize-btn" id="melon-expand" title="在新窗口中展开查看">
                                        <span>🔍</span>
                                        <span>展开</span>
                                    </button>
                                    <button class="ldsp-melon-copy-btn" id="melon-copy" title="复制到剪贴板">
                                        <span>📋</span>
                                        <span>复制</span>
                                    </button>
                                </div>
                            </div>
                            <div class="ldsp-melon-output" id="melon-output"></div>
                        </div>`;

                    // 绑定模式选择
                    body.querySelectorAll('input[name="melon-mode"]').forEach(radio => {
                        radio.addEventListener('change', (e) => {
                            this._summaryMode = e.target.value;
                            // 更新卡片active状态
                            body.querySelectorAll('.ldsp-melon-mode-card').forEach(card => {
                                card.classList.toggle('active', card.querySelector('input').value === e.target.value);
                            });
                        });
                    });

                    // 绑定复制按钮
                    body.querySelector('#melon-copy').addEventListener('click', () => this._copyOutput());
                    
                    // 绑定展开按钮 - 打开独立大窗口
                    body.querySelector('#melon-expand').addEventListener('click', () => {
                        if (this._currentOutput) {
                            this._showViewer({
                                title: info.title,
                                summary: this._currentOutput,
                                mode: this._summaryMode,
                                topicId: info.id
                            });
                        }
                    });

                    body.querySelector('#melon-summarize').addEventListener('click', () => this._doSummarize(info));
                }).catch(e => {
                    Logger.error('[MelonHelper] Render home error:', e);
                    body.innerHTML = `<div class="ldsp-melon-error">❌ 获取话题信息失败: ${Utils.escapeHtml(e.message)}</div>`;
                });
            }

            async _copyOutput() {
                if (!this._currentOutput) {
                    return;
                }
                try {
                    await navigator.clipboard.writeText(this._currentOutput);
                    const copyBtn = this.overlay.querySelector('#melon-copy');
                    if (copyBtn) {
                        const originalText = copyBtn.innerHTML;
                        copyBtn.innerHTML = '<span>✅</span><span>已复制</span>';
                        setTimeout(() => {
                            copyBtn.innerHTML = originalText;
                        }, 1500);
                    }
                } catch (e) {
                    Logger.error('[MelonHelper] Copy failed:', e);
                }
            }

            async _doSummarize(topicInfo) {
                const body = this.overlay.querySelector('.ldsp-melon-body');
                const btn = body.querySelector('#melon-summarize');
                const output = body.querySelector('#melon-output');
                const outputHeader = body.querySelector('.ldsp-melon-output-header');
                const startInput = body.querySelector('#melon-start');
                const endInput = body.querySelector('#melon-end');

                const start = parseInt(startInput.value) || 1;
                const end = parseInt(endInput.value) || topicInfo.postsCount;

                Logger.log('[MelonHelper] Starting summarize:', { topicId: topicInfo.id, start, end, mode: this._summaryMode });

                if (start > end) {
                    output.innerHTML = '<div class="ldsp-melon-error">❌ 起始楼层不能大于结束楼层</div>';
                    return;
                }

                if (start < 1) {
                    output.innerHTML = '<div class="ldsp-melon-error">❌ 起始楼层不能小于1</div>';
                    return;
                }

                if (!this.config.apiUrl || !this.config.apiKey) {
                    output.innerHTML = '<div class="ldsp-melon-error">❌ 请先在「设置」中配置 API 地址和密钥</div>';
                    return;
                }

                btn.disabled = true;
                btn.classList.add('loading');
                this._currentOutput = '';  // 清空当前输出
                outputHeader.style.display = 'none';  // 隐藏复制按钮
                
                const updateStatus = (msg) => {
                    btn.innerHTML = `<span>⏳</span><span>${msg}</span>`;
                };
                
                updateStatus('获取帖子内容...');
                output.innerHTML = '<div class="ldsp-melon-status"><div class="ldsp-melon-status-icon">🔄</div>正在获取帖子内容...</div>';

                try {
                    // 1. 获取帖子内容
                    const dialogues = await this._fetchDialogues(topicInfo.id, start, end, updateStatus);
                    
                    Logger.log('[MelonHelper] Dialogues length:', dialogues?.length);
                    
                    if (!dialogues || dialogues.trim().length < 20) {
                        throw new Error('获取帖子内容失败或内容为空');
                    }

                    updateStatus('AI 分析中...');
                    output.innerHTML = '<div class="ldsp-melon-output-content"></div><div class="ldsp-melon-cursor">▌</div>';

                    // 2. 根据模式选择提示词（优先使用自定义提示词）
                    const prompt = this._summaryMode === 'brief' 
                        ? (this.config.promptBrief || MelonHelper.PROMPT_BRIEF)
                        : (this.config.promptDetailed || MelonHelper.PROMPT_DETAILED);
                    const userContent = `话题标题: ${topicInfo.title}\n\n帖子内容 (第${start}楼 ~ 第${end}楼):\n${dialogues}`;

                    Logger.log('[MelonHelper] Calling AI, content length:', userContent.length, 'mode:', this._summaryMode);
                    this._abortController = new AbortController();

                    // 3. 流式调用 AI 接口
                    await this._callAIStream(prompt, userContent, this._abortController.signal, (chunk) => {
                        // 增量更新
                        this._currentOutput += chunk;
                        const contentDiv = output.querySelector('.ldsp-melon-output-content');
                        if (contentDiv) {
                            contentDiv.innerHTML = this._renderMarkdown(this._currentOutput);
                            // 自动滚动到底部
                            output.scrollTop = output.scrollHeight;
                        }
                    });
                    
                    // 移除光标
                    const cursor = output.querySelector('.ldsp-melon-cursor');
                    if (cursor) cursor.remove();
                    
                    Logger.log('[MelonHelper] AI response complete, length:', this._currentOutput?.length);
                    
                    // 显示复制按钮
                    outputHeader.style.display = 'flex';

                    // 保存到历史
                    this._addToHistory(topicInfo.id, topicInfo.title, this._currentOutput, this._summaryMode);
                    
                    this.renderer?.showToast('✅ 吃瓜完成！');

                } catch (e) {
                    Logger.error('[MelonHelper] Summarize error:', e);
                    // 移除光标
                    const cursor = output.querySelector('.ldsp-melon-cursor');
                    if (cursor) cursor.remove();
                    
                    if (e.name === 'AbortError') {
                        output.innerHTML = '<div class="ldsp-melon-status"><div class="ldsp-melon-status-icon">⏹️</div>已取消</div>';
                    } else {
                        output.innerHTML = `<div class="ldsp-melon-error">❌ ${Utils.escapeHtml(e.message || '请求失败')}</div>`;
                    }
                } finally {
                    btn.disabled = false;
                    btn.classList.remove('loading');
                    btn.innerHTML = '<span>🍉</span><span>立即吃瓜</span>';
                    this._abortController = null;
                }
            }

            async _callAIStream(systemPrompt, userContent, signal, onChunk) {
                const { apiUrl, apiKey, model } = this.config;
                
                // 构建流式请求体
                const requestBody = {
                    model: model || 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ],
                    max_tokens: 4096,
                    temperature: 0.7,
                    stream: true  // 启用流式输出
                };

                Logger.log('[MelonHelper] Calling AI API (stream):', apiUrl);

                try {
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify(requestBody),
                        signal: signal
                    });

                    Logger.log('[MelonHelper] API response status:', response.status);

                    if (!response.ok) {
                        let errMsg = `请求失败 (${response.status})`;
                        try {
                            const errData = await response.json();
                            errMsg = errData.error?.message || errMsg;
                            Logger.error('[MelonHelper] API error response:', errData);
                        } catch {}
                        throw new Error(errMsg);
                    }

                    // 处理 SSE 流式响应
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';  // 保留未完成的行

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed === 'data: [DONE]') continue;
                            if (!trimmed.startsWith('data: ')) continue;

                            try {
                                const json = JSON.parse(trimmed.slice(6));
                                const content = json.choices?.[0]?.delta?.content;
                                if (content) {
                                    onChunk(content);
                                }
                            } catch (e) {
                                // 忽略解析错误
                                Logger.log('[MelonHelper] SSE parse skip:', trimmed);
                            }
                        }
                    }

                    Logger.log('[MelonHelper] Stream complete');
                } catch (e) {
                    if (e.name === 'AbortError') {
                        throw e;
                    }
                    Logger.error('[MelonHelper] Stream fetch error:', e);
                    if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
                        throw new Error('网络请求失败，请检查 API 地址是否正确，或该 API 是否支持跨域请求');
                    }
                    throw e;
                }
            }

            _renderMarkdown(md) {
                if (!md) return '';
                
                let html = md;
                
                // 1. 保护代码块，先提取出来
                const codeBlocks = [];
                html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
                    const placeholder = `%%CODEBLOCK_${codeBlocks.length}%%`;
                    codeBlocks.push(`<pre class="ldsp-melon-codeblock"><code>${Utils.escapeHtml(code.trim())}</code></pre>`);
                    return placeholder;
                });
                
                // 2. 行内代码
                const inlineCodes = [];
                html = html.replace(/`([^`\n]+)`/g, (match, code) => {
                    const placeholder = `%%INLINECODE_${inlineCodes.length}%%`;
                    inlineCodes.push(`<code class="ldsp-melon-inline-code">${Utils.escapeHtml(code)}</code>`);
                    return placeholder;
                });
                
                // 3. 标题 - 支持 emoji 开头的标题
                html = html.replace(/^#### (.+)$/gm, '<h5 class="ldsp-melon-h5">$1</h5>');
                html = html.replace(/^### (.+)$/gm, '<h4 class="ldsp-melon-h4">$1</h4>');
                html = html.replace(/^## (.+)$/gm, '<h3 class="ldsp-melon-h3">$1</h3>');
                html = html.replace(/^# (.+)$/gm, '<h2 class="ldsp-melon-h2">$1</h2>');
                
                // 4. 粗体 - 修复跨行和 emoji 后的情况
                html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
                html = html.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
                
                // 5. 斜体
                html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
                html = html.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '<em>$1</em>');
                
                // 6. 引用块
                html = html.replace(/^> (.+)$/gm, '<blockquote class="ldsp-melon-quote">$1</blockquote>');
                html = html.replace(/<\/blockquote>\n<blockquote class="ldsp-melon-quote">/g, '<br>');
                
                // 7. 无序列表
                html = html.replace(/^[-*] (.+)$/gm, '<li class="ldsp-melon-li">$1</li>');
                html = html.replace(/((?:<li class="ldsp-melon-li">[^<]*<\/li>\n?)+)/g, '<ul class="ldsp-melon-ul">$1</ul>');
                
                // 8. 有序列表
                html = html.replace(/^\d+\. (.+)$/gm, '<li class="ldsp-melon-oli">$1</li>');
                html = html.replace(/((?:<li class="ldsp-melon-oli">[^<]*<\/li>\n?)+)/g, '<ol class="ldsp-melon-ol">$1</ol>');
                
                // 9. 链接
                html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="ldsp-melon-link">$1</a>');
                
                // 10. 分隔线
                html = html.replace(/^---+$/gm, '<hr class="ldsp-melon-hr">');
                html = html.replace(/^\*\*\*+$/gm, '<hr class="ldsp-melon-hr">');
                
                // 11. 段落处理
                html = html.replace(/\n\n+/g, '</p><p class="ldsp-melon-p">');
                html = html.replace(/\n/g, '<br>');
                
                // 12. 清理
                html = html.replace(/<p class="ldsp-melon-p"><\/p>/g, '');
                html = html.replace(/<p class="ldsp-melon-p">(<h[2-5])/g, '$1');
                html = html.replace(/(<\/h[2-5]>)<\/p>/g, '$1');
                html = html.replace(/<p class="ldsp-melon-p">(<ul)/g, '$1');
                html = html.replace(/(<\/ul>)<\/p>/g, '$1');
                html = html.replace(/<p class="ldsp-melon-p">(<ol)/g, '$1');
                html = html.replace(/(<\/ol>)<\/p>/g, '$1');
                html = html.replace(/<p class="ldsp-melon-p">(<blockquote)/g, '$1');
                html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
                html = html.replace(/<p class="ldsp-melon-p">(<pre)/g, '$1');
                html = html.replace(/(<\/pre>)<\/p>/g, '$1');
                html = html.replace(/<br><(h[2-5]|ul|ol|blockquote|pre)/g, '<$1');
                html = html.replace(/<\/(h[2-5]|ul|ol|blockquote|pre)><br>/g, '</$1>');
                
                // 13. 恢复代码块
                codeBlocks.forEach((block, i) => {
                    html = html.replace(`%%CODEBLOCK_${i}%%`, block);
                });
                inlineCodes.forEach((code, i) => {
                    html = html.replace(`%%INLINECODE_${i}%%`, code);
                });
                
                return `<div class="ldsp-melon-markdown"><p class="ldsp-melon-p">${html}</p></div>`;
            }

            _renderSettings() {
                const body = this.overlay.querySelector('.ldsp-melon-body');
                const hasConfig = this.config.apiUrl && this.config.apiKey;
                // 如果已有配置，默认不可编辑状态
                const isEditing = !hasConfig || this._isEditing;
                
                body.innerHTML = `
                    <div class="ldsp-melon-settings">
                        <div class="ldsp-melon-setting-group">
                            <div class="ldsp-melon-setting-title">🔑 API 配置</div>
                            <div class="ldsp-melon-setting-row">
                                <label class="ldsp-melon-setting-label">API 地址 <span style="color:var(--err)">*</span></label>
                                <input type="text" class="ldsp-melon-setting-input" id="melon-api-url" 
                                    placeholder="https://api.openai.com/v1/chat/completions" 
                                    value="${Utils.escapeHtml(this.config.apiUrl || '')}"
                                    ${!isEditing ? 'disabled' : ''}>
                                <div class="ldsp-melon-setting-hint">支持 OpenAI 兼容格式的 API（如 OpenRouter、DeepSeek、Claude 等）</div>
                            </div>
                            <div class="ldsp-melon-setting-row">
                                <label class="ldsp-melon-setting-label">API Key <span style="color:var(--err)">*</span></label>
                                <input type="${isEditing ? 'text' : 'password'}" class="ldsp-melon-setting-input" id="melon-api-key" 
                                    placeholder="sk-..." 
                                    value="${Utils.escapeHtml(this.config.apiKey || '')}"
                                    ${!isEditing ? 'disabled' : ''}>
                            </div>
                            <div class="ldsp-melon-setting-row">
                                <label class="ldsp-melon-setting-label">模型名称</label>
                                <input type="text" class="ldsp-melon-setting-input" id="melon-model" 
                                    placeholder="gpt-4o-mini" 
                                    value="${Utils.escapeHtml(this.config.model || 'gpt-4o-mini')}"
                                    ${!isEditing ? 'disabled' : ''}>
                                <div class="ldsp-melon-setting-hint">推荐: gpt-4o-mini, deepseek-chat, claude-3-haiku-20240307 等</div>
                            </div>
                        </div>
                        <div class="ldsp-melon-setting-actions">
                            ${isEditing ? `
                                <button class="ldsp-melon-setting-btn ldsp-melon-btn-save" id="melon-save-settings">💾 保存设置</button>
                            ` : `
                                <button class="ldsp-melon-setting-btn ldsp-melon-btn-edit" id="melon-edit-settings">✏️ 编辑设置</button>
                            `}
                        </div>
                        <div class="ldsp-melon-setting-group">
                            <div class="ldsp-melon-setting-title">📝 自定义提示词</div>
                            <div class="ldsp-melon-setting-hint" style="margin-bottom:10px">自定义 AI 总结的提示词，留空则使用默认提示词</div>
                            <div class="ldsp-melon-setting-row">
                                <label class="ldsp-melon-setting-label">
                                    简略模式提示词
                                    <span class="ldsp-melon-prompt-reset" data-prompt="brief" title="清空并恢复默认">🗑️</span>
                                </label>
                                <textarea class="ldsp-melon-setting-textarea" id="melon-prompt-brief" 
                                    placeholder="${Utils.escapeHtml(MelonHelper.PROMPT_BRIEF.trim())}"
                                    rows="5">${Utils.escapeHtml(this.config.promptBrief || '')}</textarea>
                                <div class="ldsp-melon-setting-hint">${this.config.promptBrief ? '✅ 已自定义' : '💡 使用默认提示词'}</div>
                            </div>
                            <div class="ldsp-melon-setting-row">
                                <label class="ldsp-melon-setting-label">
                                    详细模式提示词
                                    <span class="ldsp-melon-prompt-reset" data-prompt="detailed" title="清空并恢复默认">🗑️</span>
                                </label>
                                <textarea class="ldsp-melon-setting-textarea" id="melon-prompt-detailed" 
                                    placeholder="${Utils.escapeHtml(MelonHelper.PROMPT_DETAILED.trim())}"
                                    rows="8">${Utils.escapeHtml(this.config.promptDetailed || '')}</textarea>
                                <div class="ldsp-melon-setting-hint">${this.config.promptDetailed ? '✅ 已自定义' : '💡 使用默认提示词'}</div>
                            </div>
                            <div class="ldsp-melon-setting-prompt-actions">
                                <button class="ldsp-melon-setting-btn ldsp-melon-btn-prompt" id="melon-save-prompts">💾 保存提示词</button>
                            </div>
                        </div>
                        <div class="ldsp-melon-setting-security">
                            <div class="ldsp-melon-setting-security-icon">🔒</div>
                            <div class="ldsp-melon-setting-security-text">
                                <strong>数据安全说明</strong><br>
                                您的 API Key 等配置信息仅保存在浏览器本地存储中，不会上传到任何服务器。请放心使用。
                            </div>
                        </div>
                        <div class="ldsp-melon-setting-group ldsp-melon-setting-danger">
                            <div class="ldsp-melon-setting-title">🗑️ 数据清理</div>
                            <div class="ldsp-melon-setting-danger-desc">清空所有本地存储的数据，包括 API 配置和历史记录</div>
                            <button class="ldsp-melon-setting-btn ldsp-melon-btn-danger" id="melon-clear-all-data">🗑️ 清空所有数据</button>
                        </div>
                    </div>`;

                if (isEditing) {
                    body.querySelector('#melon-save-settings').addEventListener('click', () => {
                        const apiUrl = body.querySelector('#melon-api-url').value.trim();
                        const apiKey = body.querySelector('#melon-api-key').value.trim();
                        const model = body.querySelector('#melon-model').value.trim() || 'gpt-4o-mini';
                        
                        // 验证必填项
                        if (!apiUrl) {
                            this.renderer?.showToast('⚠️ 请输入 API 地址');
                            return;
                        }
                        if (!apiKey) {
                            this.renderer?.showToast('⚠️ 请输入 API Key');
                            return;
                        }
                        
                        // 简单验证 URL 格式
                        if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
                            this.renderer?.showToast('⚠️ API 地址格式不正确');
                            return;
                        }
                        
                        this.config.apiUrl = apiUrl;
                        this.config.apiKey = apiKey;
                        this.config.model = model;
                        this._saveConfig();
                        this._isEditing = false;
                        this.renderer?.showToast('✅ 设置已保存');
                        this._renderSettings();  // 重新渲染为不可编辑状态
                    });
                } else {
                    body.querySelector('#melon-edit-settings').addEventListener('click', () => {
                        this._isEditing = true;
                        this._renderSettings();  // 重新渲染为可编辑状态
                    });
                }
                
                // 保存提示词按钮
                body.querySelector('#melon-save-prompts')?.addEventListener('click', () => {
                    const promptBrief = body.querySelector('#melon-prompt-brief').value.trim();
                    const promptDetailed = body.querySelector('#melon-prompt-detailed').value.trim();
                    this.config.promptBrief = promptBrief;
                    this.config.promptDetailed = promptDetailed;
                    this._saveConfig();
                    this.renderer?.showToast('✅ 提示词已保存');
                    // 更新状态提示
                    const hintBrief = body.querySelector('#melon-prompt-brief')?.parentElement?.querySelector('.ldsp-melon-setting-hint');
                    const hintDetailed = body.querySelector('#melon-prompt-detailed')?.parentElement?.querySelector('.ldsp-melon-setting-hint');
                    if (hintBrief) hintBrief.textContent = promptBrief ? '✅ 已自定义' : '💡 使用默认提示词';
                    if (hintDetailed) hintDetailed.textContent = promptDetailed ? '✅ 已自定义' : '💡 使用默认提示词';
                });
                
                // 恢复默认提示词
                body.querySelectorAll('.ldsp-melon-prompt-reset').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const type = btn.dataset.prompt;
                        if (type === 'brief') {
                            body.querySelector('#melon-prompt-brief').value = '';
                            this.config.promptBrief = '';
                        } else {
                            body.querySelector('#melon-prompt-detailed').value = '';
                            this.config.promptDetailed = '';
                        }
                        this._saveConfig();
                        this.renderer?.showToast('✅ 已恢复默认提示词');
                    });
                });
                
                // 清空数据按钮
                body.querySelector('#melon-clear-all-data')?.addEventListener('click', () => {
                    this._showConfirm('确定要清空所有数据吗？<br>包括 API 配置、提示词和历史记录，此操作不可撤销。', () => {
                        // 清空配置
                        this.config = { apiUrl: '', apiKey: '', model: 'gpt-4o-mini', promptBrief: '', promptDetailed: '' };
                        this._saveConfig();
                        // 清空历史
                        this._clearHistory();
                        this._isEditing = false;
                        this.renderer?.showToast('✅ 所有数据已清空');
                        this._renderSettings();
                    });
                });
            }

            _renderHistory() {
                const body = this.overlay.querySelector('.ldsp-melon-body');
                
                if (this.history.length === 0) {
                    body.innerHTML = `
                        <div class="ldsp-melon-history-empty">
                            <div class="ldsp-melon-history-empty-icon">📭</div>
                            <div class="ldsp-melon-history-empty-text">暂无历史记录</div>
                            <div class="ldsp-melon-history-empty-hint">使用吃瓜助手总结话题后会自动保存到这里</div>
                            <div class="ldsp-melon-history-storage-hint">💾 数据仅存储在浏览器本地</div>
                        </div>`;
                    return;
                }
                
                const historyHtml = this.history.map((h, idx) => {
                    const date = new Date(h.timestamp);
                    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                    const modeLabel = h.mode === 'brief' ? '简略' : '详细';
                    const previewText = h.summary.slice(0, 100).replace(/\n/g, ' ') + (h.summary.length > 100 ? '...' : '');
                    
                    return `
                        <div class="ldsp-melon-history-item" data-index="${idx}">
                            <div class="ldsp-melon-history-item-header">
                                <span class="ldsp-melon-history-item-title" title="${Utils.escapeHtml(h.title)}">${Utils.escapeHtml(h.title)}</span>
                                <span class="ldsp-melon-history-item-meta">
                                    <span class="ldsp-melon-history-mode ${h.mode}">${modeLabel}</span>
                                    <span class="ldsp-melon-history-date">${dateStr}</span>
                                </span>
                            </div>
                            <div class="ldsp-melon-history-item-preview">${Utils.escapeHtml(previewText)}</div>
                            <div class="ldsp-melon-history-item-actions">
                                <button class="ldsp-melon-history-btn ldsp-melon-history-view" data-idx="${idx}" title="查看完整内容">👁️ 查看</button>
                                <button class="ldsp-melon-history-btn ldsp-melon-history-expand" data-idx="${idx}" title="展开大窗口查看">🔍 展开</button>
                                <button class="ldsp-melon-history-btn ldsp-melon-history-copy" data-idx="${idx}" title="复制到剪贴板">📋 复制</button>
                                <button class="ldsp-melon-history-btn ldsp-melon-history-goto" data-topic="${h.topicId}" title="跳转到话题">🔗 话题</button>
                                <button class="ldsp-melon-history-btn ldsp-melon-history-delete" data-idx="${idx}" title="删除此记录">🗑️</button>
                            </div>
                        </div>`;
                }).join('');
                
                body.innerHTML = `
                    <div class="ldsp-melon-history">
                        <div class="ldsp-melon-history-header">
                            <div class="ldsp-melon-history-header-left">
                                <span class="ldsp-melon-history-count">共 ${this.history.length} 条记录</span>
                                <span class="ldsp-melon-history-storage-badge">💾 本地存储</span>
                            </div>
                            <button class="ldsp-melon-history-clear-all" id="melon-clear-history">🗑️ 清空全部</button>
                        </div>
                        <div class="ldsp-melon-history-list">
                            ${historyHtml}
                        </div>
                    </div>`;
                
                // 绑定事件 - 使用自定义确认框
                body.querySelector('#melon-clear-history').addEventListener('click', () => {
                    this._showConfirm('确定要清空所有历史记录吗？<br>此操作不可撤销。', () => {
                        this._clearHistory();
                        this.renderer?.showToast('✅ 历史记录已清空');
                        this._renderHistory();
                    });
                });
                
                body.querySelectorAll('.ldsp-melon-history-view').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const idx = parseInt(btn.dataset.idx);
                        this._showHistoryDetail(idx);
                    });
                });
                
                body.querySelectorAll('.ldsp-melon-history-copy').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const idx = parseInt(btn.dataset.idx);
                        const record = this.history[idx];
                        if (record) {
                            try {
                                await navigator.clipboard.writeText(record.summary);
                                btn.textContent = '✅ 已复制';
                                setTimeout(() => { btn.innerHTML = '📋 复制'; }, 1500);
                            } catch (e) {
                                Logger.error('[MelonHelper] Copy history failed:', e);
                            }
                        }
                    });
                });
                
                body.querySelectorAll('.ldsp-melon-history-goto').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const topicId = btn.dataset.topic;
                        window.open(`${location.origin}/t/${topicId}`, '_blank');
                    });
                });
                
                body.querySelectorAll('.ldsp-melon-history-delete').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const idx = parseInt(btn.dataset.idx);
                        this.history.splice(idx, 1);
                        this._saveHistory();
                        this.renderer?.showToast('✅ 已删除');
                        this._renderHistory();
                    });
                });
                
                // 绑定展开按钮 - 打开独立大窗口
                body.querySelectorAll('.ldsp-melon-history-expand').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const idx = parseInt(btn.dataset.idx);
                        const record = this.history[idx];
                        if (record) {
                            this._showViewer({
                                title: record.title,
                                summary: record.summary,
                                mode: record.mode,
                                topicId: record.topicId,
                                timestamp: record.timestamp
                            });
                        }
                    });
                });
            }

            _showHistoryDetail(idx) {
                const record = this.history[idx];
                if (!record) return;
                
                const body = this.overlay.querySelector('.ldsp-melon-body');
                const date = new Date(record.timestamp);
                const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                const modeLabel = record.mode === 'brief' ? '简略模式' : '详细模式';
                
                body.innerHTML = `
                    <div class="ldsp-melon-history-detail">
                        <div class="ldsp-melon-history-detail-header">
                            <button class="ldsp-melon-history-back" id="melon-history-back">← 返回列表</button>
                            <div class="ldsp-melon-history-detail-actions">
                                <button class="ldsp-melon-history-expand-btn" id="melon-history-expand">🔍 展开</button>
                                <button class="ldsp-melon-history-copy-all" id="melon-history-copy-all">📋 复制</button>
                            </div>
                        </div>
                        <div class="ldsp-melon-history-detail-info">
                            <div class="ldsp-melon-history-detail-title">${Utils.escapeHtml(record.title)}</div>
                            <div class="ldsp-melon-history-detail-meta">${modeLabel} · ${dateStr}</div>
                        </div>
                        <div class="ldsp-melon-history-detail-content">
                            ${this._renderMarkdown(record.summary)}
                        </div>
                    </div>`;
                
                body.querySelector('#melon-history-back').addEventListener('click', () => {
                    this._renderHistory();
                });
                
                // 展开查看按钮
                body.querySelector('#melon-history-expand').addEventListener('click', () => {
                    this._showViewer({
                        title: record.title,
                        summary: record.summary,
                        mode: record.mode,
                        topicId: record.topicId,
                        timestamp: record.timestamp
                    });
                });
                
                body.querySelector('#melon-history-copy-all').addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(record.summary);
                        const btn = body.querySelector('#melon-history-copy-all');
                        btn.textContent = '✅ 已复制';
                        setTimeout(() => { btn.innerHTML = '📋 复制'; }, 1500);
                    } catch (e) {
                        Logger.error('[MelonHelper] Copy detail failed:', e);
                    }
                });
            }

            destroy() {
                this._stopUrlWatch();
                this._closeViewer();
                if (this._abortController) {
                    this._abortController.abort();
                    this._abortController = null;
                }
                if (this.overlay) {
                    this.overlay.remove();
                    this.overlay = null;
                }
            }
            
            // 显示全屏可调整大小的查看器
            _showViewer(data) {
                // 移除已存在的 viewer
                this._closeViewer();
                
                const dateStr = data.timestamp 
                    ? new Date(data.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : '刚刚';
                const modeLabel = data.mode === 'brief' ? '简略' : '详细';
                
                // 检测当前主题
                const isLightTheme = document.querySelector('#ldsp-panel.light') !== null;
                
                const overlay = document.createElement('div');
                overlay.className = 'ldsp-melon-viewer-overlay' + (isLightTheme ? ' light' : '');
                overlay.innerHTML = `
                    <div class="ldsp-melon-viewer" style="width:700px;height:500px;">
                        <div class="ldsp-melon-viewer-header">
                            <div class="ldsp-melon-viewer-title">
                                <span class="ldsp-melon-viewer-title-icon">🍈</span>
                                <span>吃瓜详情</span>
                            </div>
                            <div class="ldsp-melon-viewer-actions">
                                <button class="ldsp-melon-viewer-btn" id="viewer-copy" title="复制内容">📋</button>
                                <button class="ldsp-melon-viewer-btn" id="viewer-goto" title="跳转到话题">🔗</button>
                                <button class="ldsp-melon-viewer-btn ldsp-melon-viewer-close" id="viewer-close" title="关闭">✕</button>
                            </div>
                        </div>
                        <div class="ldsp-melon-viewer-body">
                            <div class="ldsp-melon-viewer-info">
                                <div class="ldsp-melon-viewer-topic-title">${Utils.escapeHtml(data.title)}</div>
                                <div class="ldsp-melon-viewer-meta">
                                    <span class="ldsp-melon-viewer-mode ${data.mode}">${modeLabel}模式</span>
                                    <span>${dateStr}</span>
                                </div>
                            </div>
                            <div class="ldsp-melon-viewer-content">
                                ${this._renderMarkdown(data.summary)}
                            </div>
                        </div>
                        <div class="ldsp-melon-resize-handle ldsp-melon-resize-handle-e"></div>
                        <div class="ldsp-melon-resize-handle ldsp-melon-resize-handle-s"></div>
                        <div class="ldsp-melon-resize-handle ldsp-melon-resize-handle-se"></div>
                        <div class="ldsp-melon-resize-handle ldsp-melon-resize-handle-w"></div>
                        <div class="ldsp-melon-resize-handle ldsp-melon-resize-handle-n"></div>
                        <div class="ldsp-melon-resize-handle ldsp-melon-resize-handle-nw"></div>
                        <div class="ldsp-melon-resize-handle ldsp-melon-resize-handle-ne"></div>
                        <div class="ldsp-melon-resize-handle ldsp-melon-resize-handle-sw"></div>
                    </div>`;
                
                document.body.appendChild(overlay);
                this._viewerOverlay = overlay;
                
                const viewer = overlay.querySelector('.ldsp-melon-viewer');
                const header = overlay.querySelector('.ldsp-melon-viewer-header');
                
                // 关闭按钮
                overlay.querySelector('#viewer-close').addEventListener('click', () => this._closeViewer());
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) this._closeViewer();
                });
                
                // ESC 关闭
                this._viewerEscHandler = (e) => {
                    if (e.key === 'Escape') this._closeViewer();
                };
                document.addEventListener('keydown', this._viewerEscHandler);
                
                // 复制按钮
                overlay.querySelector('#viewer-copy').addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(data.summary);
                        const btn = overlay.querySelector('#viewer-copy');
                        btn.textContent = '✅';
                        setTimeout(() => { btn.textContent = '📋'; }, 1500);
                    } catch (e) {
                        Logger.error('[MelonHelper] Copy viewer content failed:', e);
                    }
                });
                
                // 跳转按钮
                overlay.querySelector('#viewer-goto').addEventListener('click', () => {
                    if (data.topicId) {
                        window.open(`${location.origin}/t/${data.topicId}`, '_blank');
                    }
                });
                
                // 拖拽移动
                let isDragging = false;
                let startX, startY, startLeft, startTop;
                
                header.addEventListener('mousedown', (e) => {
                    if (e.target.closest('.ldsp-melon-viewer-btn')) return;
                    isDragging = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    const rect = viewer.getBoundingClientRect();
                    startLeft = rect.left;
                    startTop = rect.top;
                    viewer.style.position = 'fixed';
                    viewer.style.left = `${startLeft}px`;
                    viewer.style.top = `${startTop}px`;
                    viewer.style.transform = 'none';
                    e.preventDefault();
                });
                
                document.addEventListener('mousemove', this._viewerMoveHandler = (e) => {
                    if (!isDragging) return;
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    viewer.style.left = `${startLeft + dx}px`;
                    viewer.style.top = `${startTop + dy}px`;
                });
                
                document.addEventListener('mouseup', this._viewerUpHandler = () => {
                    isDragging = false;
                });
                
                // 调整大小
                let isResizing = false;
                let resizeDir = '';
                let resizeStartX, resizeStartY, resizeStartW, resizeStartH, resizeStartL, resizeStartT;
                
                overlay.querySelectorAll('.ldsp-melon-resize-handle').forEach(handle => {
                    handle.addEventListener('mousedown', (e) => {
                        isResizing = true;
                        resizeDir = handle.className.replace('ldsp-melon-resize-handle ldsp-melon-resize-handle-', '');
                        resizeStartX = e.clientX;
                        resizeStartY = e.clientY;
                        const rect = viewer.getBoundingClientRect();
                        resizeStartW = rect.width;
                        resizeStartH = rect.height;
                        resizeStartL = rect.left;
                        resizeStartT = rect.top;
                        viewer.style.position = 'fixed';
                        viewer.style.left = `${resizeStartL}px`;
                        viewer.style.top = `${resizeStartT}px`;
                        viewer.style.transform = 'none';
                        e.preventDefault();
                        e.stopPropagation();
                    });
                });
                
                document.addEventListener('mousemove', this._viewerResizeHandler = (e) => {
                    if (!isResizing) return;
                    const dx = e.clientX - resizeStartX;
                    const dy = e.clientY - resizeStartY;
                    let newW = resizeStartW, newH = resizeStartH;
                    let newL = resizeStartL, newT = resizeStartT;
                    
                    if (resizeDir.includes('e')) newW = Math.max(320, resizeStartW + dx);
                    if (resizeDir.includes('w')) {
                        newW = Math.max(320, resizeStartW - dx);
                        newL = resizeStartL + (resizeStartW - newW);
                    }
                    if (resizeDir.includes('s')) newH = Math.max(240, resizeStartH + dy);
                    if (resizeDir.includes('n')) {
                        newH = Math.max(240, resizeStartH - dy);
                        newT = resizeStartT + (resizeStartH - newH);
                    }
                    
                    viewer.style.width = `${newW}px`;
                    viewer.style.height = `${newH}px`;
                    viewer.style.left = `${newL}px`;
                    viewer.style.top = `${newT}px`;
                });
                
                document.addEventListener('mouseup', this._viewerResizeUpHandler = () => {
                    isResizing = false;
                });
            }
            
            _closeViewer() {
                if (this._viewerOverlay) {
                    this._viewerOverlay.remove();
                    this._viewerOverlay = null;
                }
                if (this._viewerEscHandler) {
                    document.removeEventListener('keydown', this._viewerEscHandler);
                    this._viewerEscHandler = null;
                }
                if (this._viewerMoveHandler) {
                    document.removeEventListener('mousemove', this._viewerMoveHandler);
                    this._viewerMoveHandler = null;
                }
                if (this._viewerUpHandler) {
                    document.removeEventListener('mouseup', this._viewerUpHandler);
                    this._viewerUpHandler = null;
                }
                if (this._viewerResizeHandler) {
                    document.removeEventListener('mousemove', this._viewerResizeHandler);
                    this._viewerResizeHandler = null;
                }
                if (this._viewerResizeUpHandler) {
                    document.removeEventListener('mouseup', this._viewerResizeUpHandler);
                    this._viewerResizeUpHandler = null;
                }
            }
            
            // 显示自定义确认对话框
            _showConfirm(message, onConfirm) {
                const existingDialog = this.overlay.querySelector('.ldsp-melon-confirm-dialog');
                if (existingDialog) existingDialog.remove();
                
                const dialog = document.createElement('div');
                dialog.className = 'ldsp-melon-confirm-dialog';
                dialog.innerHTML = `
                    <div class="ldsp-melon-confirm-content">
                        <div class="ldsp-melon-confirm-icon">⚠️</div>
                        <div class="ldsp-melon-confirm-message">${message}</div>
                        <div class="ldsp-melon-confirm-actions">
                            <button class="ldsp-melon-confirm-btn ldsp-melon-confirm-cancel">取消</button>
                            <button class="ldsp-melon-confirm-btn ldsp-melon-confirm-ok">确认</button>
                        </div>
                    </div>`;
                
                dialog.querySelector('.ldsp-melon-confirm-cancel').addEventListener('click', () => dialog.remove());
                dialog.querySelector('.ldsp-melon-confirm-ok').addEventListener('click', () => {
                    dialog.remove();
                    onConfirm();
                });
                dialog.addEventListener('click', (e) => {
                    if (e.target === dialog) dialog.remove();
                });
                
                this.overlay.appendChild(dialog);
            }
        }

        // ==================== 关注/粉丝管理器 ====================
        class FollowManager {
            static CACHE_KEY = 'ldsp_follow_cache';
            
            // SVG 图标定义
            static ICONS = {
                // 关注：人+右箭头（表示我关注的人/向外关注）
                following: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="10" cy="8" r="4"/><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M19 8h4m-2-2v4"/></svg>',
                // 粉丝：人+心形（表示喜欢我的人）
                followers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="10" cy="8" r="4"/><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M19.5 10.5c-.6-.6-1.5-.6-2.1 0l-.4.4-.4-.4c-.6-.6-1.5-.6-2.1 0-.6.6-.6 1.5 0 2.1l2.5 2.4 2.5-2.4c.6-.6.6-1.5 0-2.1z"/></svg>',
                // 用户组图标（用于标题）
                users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="10" r="3"/><path d="M21 21v-1.5a3 3 0 0 0-3-3h-1"/></svg>',
                // 单人图标（用于空状态）
                user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/></svg>'
            };
            
            constructor(network, storage, panelBody, renderer) {
                this.network = network;
                this.storage = storage;
                this.panelBody = panelBody;
                this.renderer = renderer;
                this.overlay = null;
                this.following = [];
                this.followers = [];
                this.followingCount = 0;
                this.followersCount = 0;
                this.cakedate = null;
                this.animatedAvatar = null;
                this._loaded = false;
                this._loading = false;
                this._profileLoaded = false;
            }

            async init() {
                // 先从缓存加载数量显示
                this._loadFromCache();
                this._createOverlay();
            }
            
            // 从本地缓存加载
            _loadFromCache() {
                try {
                    const username = this.storage.getUser();
                    if (!username) return;
                    
                    const cacheKey = `${FollowManager.CACHE_KEY}_${CURRENT_SITE.prefix}_${username}`;
                    const cached = GM_getValue(cacheKey, null);
                    if (cached && typeof cached === 'object') {
                        this.followingCount = cached.followingCount || 0;
                        this.followersCount = cached.followersCount || 0;
                        this.cakedate = cached.cakedate || null;
                        this.animatedAvatar = cached.animatedAvatar || null;
                        // 立即更新显示
                        this._updateStats();
                        this._updateDays();
                    }
                } catch (e) {
                    // 缓存读取失败，忽略
                }
            }
            
            // 保存到本地缓存
            _saveToCache() {
                try {
                    const username = this.storage.getUser();
                    if (!username) return;
                    
                    const cacheKey = `${FollowManager.CACHE_KEY}_${CURRENT_SITE.prefix}_${username}`;
                    GM_setValue(cacheKey, {
                        followingCount: this.followingCount,
                        followersCount: this.followersCount,
                        cakedate: this.cakedate,
                        animatedAvatar: this.animatedAvatar,
                        time: Date.now()
                    });
                } catch (e) {
                    // 缓存写入失败，忽略
                }
            }

            _createOverlay() {
                this.overlay = document.createElement('div');
                this.overlay.className = 'ldsp-follow-overlay';
                this.overlay.innerHTML = `
                    <div class="ldsp-follow-header">
                        <div class="ldsp-follow-title">${FollowManager.ICONS.users} 关注与粉丝</div>
                        <div class="ldsp-follow-close">×</div>
                    </div>
                    <div class="ldsp-follow-tabs">
                        <div class="ldsp-follow-tab active" data-tab="following">
                            <span class="ldsp-follow-tab-icon">${FollowManager.ICONS.following}</span>
                            <span class="ldsp-follow-tab-text">关注</span>
                            <span class="ldsp-follow-tab-count">${this.followingCount}</span>
                        </div>
                        <div class="ldsp-follow-tab" data-tab="followers">
                            <span class="ldsp-follow-tab-icon">${FollowManager.ICONS.followers}</span>
                            <span class="ldsp-follow-tab-text">粉丝</span>
                            <span class="ldsp-follow-tab-count">${this.followersCount}</span>
                        </div>
                    </div>
                    <div class="ldsp-follow-body"></div>`;
                if (this.panelBody) {
                    this.panelBody.appendChild(this.overlay);
                }
                this._bindEvents();
            }

            _bindEvents() {
                this.overlay.querySelector('.ldsp-follow-close').addEventListener('click', () => this.hide());
                document.addEventListener('keydown', e => {
                    if (e.key === 'Escape' && this.overlay.classList.contains('show')) this.hide();
                });
                this.overlay.querySelectorAll('.ldsp-follow-tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        this.overlay.querySelectorAll('.ldsp-follow-tab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        const tabName = tab.dataset.tab;
                        this._renderList(tabName);
                    });
                });
            }

            async loadData(forceRefresh = false) {
                if (this._loading) return;
                if (this._loaded && !forceRefresh) return;
                
                this._loading = true;
                const username = this.storage.getUser();
                if (!username) {
                    this._loading = false;
                    return;
                }

                // 保存旧的数量用于比较
                const oldFollowingCount = this.followingCount;
                const oldFollowersCount = this.followersCount;

                const baseUrl = `https://${CURRENT_SITE.domain}`;
                
                try {
                    const [followingRes, followersRes] = await Promise.all([
                        this.network.fetchJson(`${baseUrl}/u/${username}/follow/following`),
                        this.network.fetchJson(`${baseUrl}/u/${username}/follow/followers`)
                    ]);
                    
                    this.following = Array.isArray(followingRes) ? followingRes : [];
                    this.followers = Array.isArray(followersRes) ? followersRes : [];
                    this.followingCount = this.following.length;
                    this.followersCount = this.followers.length;
                    this._loaded = true;
                    
                    // 检查是否有变化，有变化则更新缓存
                    if (this.followingCount !== oldFollowingCount || this.followersCount !== oldFollowersCount) {
                        this._saveToCache();
                    }
                    
                    // 更新显示
                    this._updateStats();
                    this._updateTabCounts();
                } catch (e) {
                    Logger.warn('Failed to load follow data:', e.message);
                    // 加载失败时保持缓存的数量，不清零
                } finally {
                    this._loading = false;
                }
            }
            
            // 加载用户 profile 数据（cakedate, animated_avatar）
            async loadProfile() {
                if (this._profileLoaded) return;
                
                const username = this.storage.getUser();
                if (!username) return;
                
                const baseUrl = `https://${CURRENT_SITE.domain}`;
                
                try {
                    const profileRes = await this.network.fetchJson(`${baseUrl}/u/${encodeURIComponent(username)}.json`);
                    if (profileRes && profileRes.user) {
                        const user = profileRes.user;
                        let hasChanges = false;
                        
                        // 获取 cakedate
                        if (user.cakedate && user.cakedate !== this.cakedate) {
                            this.cakedate = user.cakedate;
                            this._updateDays();
                            hasChanges = true;
                        }
                        
                        // 获取 animated_avatar
                        if (user.animated_avatar) {
                            const animatedUrl = user.animated_avatar.startsWith('http') 
                                ? user.animated_avatar 
                                : `${baseUrl}${user.animated_avatar}`;
                            // 只有动态头像变化时才更新
                            if (animatedUrl !== this.animatedAvatar) {
                                this.animatedAvatar = animatedUrl;
                                // 通过 renderer 渲染头像
                                if (this.renderer) {
                                    this.renderer.renderAvatar(animatedUrl);
                                }
                                hasChanges = true;
                            }
                        }
                        
                        this._profileLoaded = true;
                        if (hasChanges) {
                            this._saveToCache();
                        }
                    }
                } catch (e) {
                    Logger.warn('Failed to load user profile:', e.message);
                }
            }
            
            // 更新注册天数显示
            _updateDays() {
                const daysNumEl = document.querySelector('.ldsp-join-days-num');
                const siteEl = document.querySelector('.ldsp-join-days-site');
                const joinDaysEl = document.querySelector('.ldsp-join-days');
                
                if (!this.cakedate) {
                    if (joinDaysEl) joinDaysEl.style.display = 'none';
                    return;
                }
                
                try {
                    const joinDate = new Date(this.cakedate);
                    const now = new Date();
                    const diffTime = Math.abs(now - joinDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const siteShort = CURRENT_SITE.domain === 'linux.do' ? 'L站' : 'IF站';
                    const siteFull = CURRENT_SITE.domain === 'linux.do' ? 'Linux.do' : 'IDCFlare';
                    if (siteEl) siteEl.textContent = siteShort;
                    if (daysNumEl) daysNumEl.textContent = diffDays;
                    if (joinDaysEl) {
                        joinDaysEl.style.display = '';
                        // 设置悬浮提示：于xxxx年xx月xx日加入xx站
                        const year = joinDate.getFullYear();
                        const month = joinDate.getMonth() + 1;
                        const day = joinDate.getDate();
                        joinDaysEl.title = `于${year}年${month}月${day}日加入${siteFull}`;
                    }
                } catch (e) {
                    if (joinDaysEl) joinDaysEl.style.display = 'none';
                }
            }

            _updateStats() {
                // 支持新的合并按钮样式
                const combinedEl = document.querySelector('.ldsp-follow-combined');
                if (combinedEl) {
                    const followingNum = combinedEl.querySelector('.ldsp-follow-num-following');
                    const followersNum = combinedEl.querySelector('.ldsp-follow-num-followers');
                    if (followingNum) followingNum.textContent = this.followingCount;
                    if (followersNum) followersNum.textContent = this.followersCount;
                }
                // 兼容旧样式
                const statsEl = document.querySelector('.ldsp-follow-stats');
                if (statsEl) {
                    const following = statsEl.querySelector('.ldsp-follow-stat-following .ldsp-follow-stat-num');
                    const followers = statsEl.querySelector('.ldsp-follow-stat-followers .ldsp-follow-stat-num');
                    if (following) following.textContent = this.followingCount;
                    if (followers) followers.textContent = this.followersCount;
                }
            }

            _updateTabCounts() {
                const followingTab = this.overlay.querySelector('.ldsp-follow-tab[data-tab="following"] .ldsp-follow-tab-count');
                const followersTab = this.overlay.querySelector('.ldsp-follow-tab[data-tab="followers"] .ldsp-follow-tab-count');
                if (followingTab) followingTab.textContent = this.followingCount;
                if (followersTab) followersTab.textContent = this.followersCount;
            }

            async show() {
                this.overlay.classList.add('show');
                const body = this.overlay.querySelector('.ldsp-follow-body');
                body.innerHTML = '<div class="ldsp-follow-loading"><div class="ldsp-spinner"></div><div>加载中...</div></div>';
                
                // 加载数据（如果还没加载）
                if (!this._loaded) {
                    await this.loadData();
                }
                
                // 渲染当前激活的tab
                const activeTab = this.overlay.querySelector('.ldsp-follow-tab.active');
                this._renderList(activeTab?.dataset.tab || 'following');
            }

            hide() {
                this.overlay.classList.remove('show');
            }

            _renderList(type = 'following') {
                const body = this.overlay.querySelector('.ldsp-follow-body');
                const list = type === 'following' ? this.following : this.followers;
                const emptyText = type === 'following' ? '还没有关注任何人' : '还没有粉丝';
                const emptyIcon = type === 'following' ? FollowManager.ICONS.user : FollowManager.ICONS.followers;
                
                if (list.length === 0) {
                    body.innerHTML = `
                        <div class="ldsp-follow-empty">
                            <div class="ldsp-follow-empty-icon">${emptyIcon}</div>
                            <div>${emptyText}</div>
                        </div>`;
                    return;
                }

                const baseUrl = `https://${CURRENT_SITE.domain}`;
                body.innerHTML = `
                    <div class="ldsp-follow-list">
                        ${list.map(user => {
                            const avatarUrl = this._getAvatarUrl(user.avatar_template, user.animated_avatar, 64);
                            const displayName = user.name || user.username;
                            return `
                                <a href="${baseUrl}/u/${user.username}" target="_blank" class="ldsp-follow-item" data-username="${user.username}">
                                    <div class="ldsp-follow-avatar-wrap">
                                        <img class="ldsp-follow-avatar" src="${avatarUrl}" alt="${Utils.escapeHtml(user.username)}" loading="lazy">
                                    </div>
                                    <div class="ldsp-follow-user-info">
                                        <div class="ldsp-follow-user-name">${Utils.escapeHtml(displayName)}</div>
                                        <div class="ldsp-follow-user-id">@${Utils.escapeHtml(user.username)}</div>
                                    </div>
                                    <div class="ldsp-follow-arrow">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M9 18l6-6-6-6"/>
                                        </svg>
                                    </div>
                                </a>`;
                        }).join('')}
                    </div>`;
            }

            _getAvatarUrl(template, animatedAvatar, size = 64) {
                if (!template) return '';
                // 优先使用动画头像
                if (animatedAvatar) {
                    return `https://${CURRENT_SITE.domain}${animatedAvatar}`;
                }
                // 替换size占位符
                let url = template.replace('{size}', size);
                // 如果是相对路径，添加域名
                if (url.startsWith('/')) {
                    url = `https://${CURRENT_SITE.domain}${url}`;
                }
                return url;
            }

            getStats() {
                return {
                    following: this.followingCount,
                    followers: this.followersCount
                };
            }

            destroy() {
                if (this.overlay) {
                    this.overlay.remove();
                    this.overlay = null;
                }
            }
        }

        // ==================== 面板渲染器 ====================
        class Renderer {
            constructor(panel) {
                this.panel = panel;
                this.prevValues = new Map();
                this.lastPct = -1;
            }

            // 渲染用户信息
            renderUser(name, level, isOK, reqs, displayName = null) {
                const done = reqs.filter(r => r.isSuccess).length;
                const $ = this.panel.$;
                // XSS 防护：使用 textContent 而不是 innerHTML，并清理输入
                const safeName = Utils.sanitize(name, 30);
                const safeDisplayName = Utils.sanitize(displayName, 100);
                // 如果有 displayName 则显示 displayName + @username，否则只显示 username
                if (safeDisplayName && safeDisplayName !== safeName) {
                    $.userDisplayName.textContent = safeDisplayName;
                    $.userHandle.textContent = `@${safeName}`;
                    $.userHandle.style.display = '';
                } else {
                    $.userDisplayName.textContent = safeName;
                    $.userHandle.textContent = '';
                    $.userHandle.style.display = 'none';
                }
            }

            // 渲染需求列表
            renderReqs(reqs, level = null) {
                const done = reqs.filter(r => r.isSuccess).length;
                const remain = reqs.length - done;
                const pct = Math.round(done / reqs.length * 100);
                const cfg = Screen.getConfig();
                const r = (cfg.ringSize / 2) - 8;
                const circ = 2 * Math.PI * r;
                const off = circ * (1 - pct / 100);
                const anim = this.lastPct === -1 || this.lastPct !== pct || this.panel.animRing;
                this.lastPct = pct;
                this.panel.animRing = false;
                
                // 使用缓存的level或传入的level
                // v3.4.7: 确保 level 是数字类型，避免字符串拼接 bug (如 "2" + 1 = "21")
                // 注意：不能用 || 2，因为 0 级用户会被错误地当作 2 级
                // 优先级：传入的 level > panel.cachedLevel > OAuth userInfo > 默认值 2
                const parsedLevel = level !== null ? parseInt(level, 10) : NaN;
                let currentLevel;
                if (!isNaN(parsedLevel)) {
                    currentLevel = parsedLevel;
                } else if (this.panel.cachedLevel !== undefined) {
                    currentLevel = this.panel.cachedLevel;
                } else {
                    // 尝试从 OAuth 用户信息获取（Tab 切换时的 fallback）
                    const oauthUser = this.panel.oauth?.getUserInfo?.();
                    const oauthLevel = oauthUser?.trust_level ?? oauthUser?.trustLevel;
                    currentLevel = typeof oauthLevel === 'number' ? oauthLevel : 2;
                }
                if (level !== null && !isNaN(parsedLevel)) this.panel.cachedLevel = currentLevel;
                
                // 普通用户最高只能升级到LV3，LV4需要管理员手动授予
                const maxTargetLevel = 3;
                const canUpgrade = currentLevel < maxTargetLevel;
                const targetLevel = canUpgrade ? currentLevel + 1 : currentLevel;
                
                let tipText, tipClass;
                if (!canUpgrade) {
                    tipText = currentLevel >= 4 ? '🏆 已达最高等级' : '🎖️ 已达普通用户最高等级';
                    tipClass = 'max';
                } else if (remain > 0) {
                    tipText = `⏳ 距升级还需完成 ${remain} 项要求`;
                    tipClass = 'progress';
                } else {
                    tipText = '🎉 已满足升级条件';
                    tipClass = 'ok';
                }

                const confettiColors = ['#5070d0', '#5bb5a6', '#f97316', '#22c55e', '#eab308', '#ec4899', '#f43f5e', '#6b8cef'];
                const confettiPieces = pct === 100 ? Array.from({length: 28}, (_, i) => {
                    const color = confettiColors[i % confettiColors.length];
                    const angle = (i / 28) * 360 + (Math.random() - 0.5) * 25;
                    const rad = angle * Math.PI / 180;
                    const dist = 55 + Math.random() * 45;
                    const tx = Math.cos(rad) * dist;
                    const ty = Math.sin(rad) * dist * 0.7;
                    const drift = (Math.random() - 0.5) * 40;
                    const rot = (Math.random() - 0.5) * 900;
                    const delay = Math.random() * 0.06;
                    const shape = ['\u25cf', '\u25a0', '\u2605', '\u2764', '\u2728', '\u2740'][Math.floor(Math.random() * 6)];
                    return `<span class="ldsp-confetti-piece" style="color:${color};--tx:${tx}px;--ty:${ty}px;--drift:${drift}px;--rot:${rot}deg;animation-delay:${delay}s">${shape}</span>`;
                }).join('') : '';

                // 使用数组构建HTML（避免多次字符串拼接）
                const htmlParts = [];
                htmlParts.push(`<div class="ldsp-ring${pct === 100 ? ' complete' : ''}">`);
                if (pct === 100) htmlParts.push(`<div class="ldsp-confetti">${confettiPieces}</div>`);
                htmlParts.push(`
                    <div class="ldsp-ring-stat">
                        <div class="ldsp-ring-stat-val ok">✓${done}</div>
                        <div class="ldsp-ring-stat-lbl">已达标</div>
                    </div>
                    <div class="ldsp-ring-center">
                        <div class="ldsp-ring-wrap">
                            <svg width="${cfg.ringSize}" height="${cfg.ringSize}" viewBox="0 0 ${cfg.ringSize} ${cfg.ringSize}">
                                <defs><linearGradient id="ldsp-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#5070d0"/><stop offset="100%" style="stop-color:#5bb5a6"/></linearGradient></defs>
                                <circle class="ldsp-ring-bg" cx="${cfg.ringSize/2}" cy="${cfg.ringSize/2}" r="${r}"/>
                                <circle class="ldsp-ring-fill${anim ? ' anim' : ''}" cx="${cfg.ringSize/2}" cy="${cfg.ringSize/2}" r="${r}" stroke-dasharray="${circ}" stroke-dashoffset="${anim ? circ : off}" style="--circ:${circ};--off:${off}"/>
                            </svg>
                            <div class="ldsp-ring-txt"><div class="ldsp-ring-val${anim ? ' anim' : ''}">${pct}%</div><div class="ldsp-ring-lbl">完成度</div></div>
                        </div>
                        <div class="ldsp-ring-lvl lv${currentLevel}">${canUpgrade ? `Lv${currentLevel} → Lv${targetLevel}` : `Lv${currentLevel} ★`}</div>
                    </div>
                    <div class="ldsp-ring-stat">
                        <div class="ldsp-ring-stat-val fail">○${remain}</div>
                        <div class="ldsp-ring-stat-lbl">待完成</div>
                    </div>
                </div>
                <div class="ldsp-ring-tip ${tipClass}">${tipText}</div>`);

                // 批量处理需求项（减少Map查询和字符串操作）
                for (const r of reqs) {
                    const name = Utils.simplifyName(r.name);
                    const prev = this.prevValues.get(r.name);
                    const upd = prev !== undefined && prev !== r.currentValue;
                    const changeHtml = r.change 
                        ? `<span class="ldsp-item-chg ${r.change > 0 ? 'up' : 'down'}">${r.change > 0 ? '+' : ''}${r.change}</span>` 
                        : '';
                    htmlParts.push(`<div class="ldsp-item ${r.isSuccess ? 'ok' : 'fail'}">
                        <span class="ldsp-item-icon">${r.isSuccess ? '✓' : '○'}</span>
                        <span class="ldsp-item-name">${name}</span>
                        <div class="ldsp-item-vals">
                            <span class="ldsp-item-cur${upd ? ' upd' : ''}">${r.currentValue}</span>
                            <span class="ldsp-item-sep">/</span>
                            <span class="ldsp-item-req">${r.requiredValue}</span>
                        </div>
                        ${changeHtml}
                    </div>`);
                    this.prevValues.set(r.name, r.currentValue);
                }

                // 添加底部了解信任等级的提示链接
                htmlParts.push(`<a class="ldsp-learn-trust" href="https://linux.do/t/topic/2460" target="_blank" rel="noopener">了解论坛信任等级 →</a>`);

                this.panel.$.reqs.innerHTML = htmlParts.join('');
                
                // 100%时，等圆环动画完成后触发撒花
                if (pct === 100 && anim) {
                    setTimeout(() => {
                        const ring = this.panel.$.reqs.querySelector('.ldsp-ring.complete');
                        if (ring) ring.classList.add('anim-done');
                    }, 950); // 等待圆环动画
                } else if (pct === 100) {
                    setTimeout(() => {
                        const ring = this.panel.$.reqs.querySelector('.ldsp-ring.complete');
                        if (ring) ring.classList.add('anim-done');
                    }, 50);
                }
            }

            // 渲染阅读卡片（带缓存，避免频繁更新导致动画闪烁）
            renderReading(minutes, isTracking = true) {
                const lv = Utils.getReadingLevel(minutes);
                const timeStr = Utils.formatReadingTime(minutes);
                const $ = this.panel.$;
                
                // 缓存上次渲染的状态，避免不必要的 DOM 操作和样式更新
                const cacheKey = `${lv.label}|${timeStr}|${isTracking}|${minutes >= 180}|${minutes >= 450}`;
                if (this._readingCache === cacheKey) return;
                this._readingCache = cacheKey;
                
                // 只更新变化的内容
                if ($.readingIcon.textContent !== lv.icon) $.readingIcon.textContent = lv.icon;
                if ($.readingTime.textContent !== timeStr) $.readingTime.textContent = timeStr;
                if ($.readingLabel.textContent !== lv.label) $.readingLabel.textContent = lv.label;
                
                // 只在颜色变化时更新样式（避免重置动画）
                if (this._readingColor !== lv.color) {
                    this._readingColor = lv.color;
                    $.reading.style.cssText = `background:${lv.bg};color:${lv.color};--rc:${lv.color}`;
                    $.readingTime.style.color = lv.color;
                    $.readingLabel.style.color = lv.color;
                }
                
                // tracking 类表示正在追踪，显示波浪效果和"阅读时间记录中..."
                $.reading.classList.toggle('tracking', isTracking);
                // hi 类表示阅读时间达到沉浸阅读(180-450分钟)
                $.reading.classList.toggle('hi', minutes >= 180 && minutes < 450);
                // max 类表示阅读时间达到极限(450分钟+)
                $.reading.classList.toggle('max', minutes >= 450);
            }

            // 渲染头像
            renderAvatar(url) {
                const wrap = this.panel.$.user.querySelector('.ldsp-avatar-wrap');
                if (!wrap) return;
                const el = wrap.querySelector('.ldsp-avatar-ph, .ldsp-avatar');
                if (!el) return;
                const img = document.createElement('img');
                img.className = 'ldsp-avatar';
                img.src = url;
                img.alt = 'Avatar';
                img.onerror = () => {
                    const ph = document.createElement('div');
                    ph.className = 'ldsp-avatar-ph';
                    ph.textContent = '👤';
                    img.replaceWith(ph);
                };
                el.replaceWith(img);
            }

            // 渲染趋势标签页
            renderTrends(currentTab) {
                const tabs = [
                    { id: 'today', icon: '☀️', label: '今日' },
                    { id: 'week', icon: '📅', label: '本周' },
                    { id: 'month', icon: '📊', label: '本月' },
                    { id: 'year', icon: '📈', label: '本年' },
                    { id: 'all', icon: '🌐', label: '全部' }
                ];
                this.panel.$.trends.innerHTML = `
                    <div class="ldsp-subtabs">${tabs.map(t => 
                        `<div class="ldsp-subtab${currentTab === t.id ? ' active' : ''}" data-tab="${t.id}">${t.icon} ${t.label}</div>`
                    ).join('')}</div>
                    <div class="ldsp-trend-content"></div>`;
            }

            // 获取趋势字段
            getTrendFields(reqs) {
                return CONFIG.TREND_FIELDS.map(f => {
                    const req = reqs.find(r => r.name.includes(f.search));
                    return req ? { ...f, req, name: req.name } : null;
                }).filter(Boolean);
            }

            // 渲染今日趋势
            renderTodayTrend(reqs, readingTime, todayData) {
                if (!todayData) {
                    return `<div class="ldsp-empty"><div class="ldsp-empty-icon">☀️</div><div class="ldsp-empty-txt">今日首次访问<br>数据将从现在开始统计</div></div>`;
                }

                const now = new Date();
                const start = new Date(todayData.startTs);
                const startStr = `${start.getHours()}:${String(start.getMinutes()).padStart(2, '0')}`;
                const nowStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
                const lv = Utils.getReadingLevel(readingTime);
                const pct = Math.min(readingTime / 600 * 100, 100);

                // 阅读时间基础信息（所有用户都可见）
                let html = `
                    <div class="ldsp-time-info">今日 00:00 ~ ${nowStr} (首次记录于 ${startStr})</div>
                    <div class="ldsp-rd-stats" style="background:${lv.bg.replace('0.15', '0.08')}">
                        <div class="ldsp-rd-stats-icon">${lv.icon}</div>
                        <div class="ldsp-rd-stats-info"><div class="ldsp-rd-stats-val">${Utils.formatReadingTime(readingTime)}</div><div class="ldsp-rd-stats-lbl">今日累计阅读</div></div>
                        <div class="ldsp-rd-stats-badge" style="background:${lv.bg};color:${lv.color};box-shadow:0 3px 12px ${lv.bg.replace('0.15','0.4')},inset 0 1px 0 rgba(255,255,255,.25)">${lv.label}</div>
                    </div>
                    <div class="ldsp-rd-prog">
                        <div class="ldsp-rd-prog-hdr"><span class="ldsp-rd-prog-title">📖 阅读目标 (10小时)</span><span class="ldsp-rd-prog-val">${Math.round(pct)}%</span></div>
                        <div class="ldsp-rd-prog-bar"><div class="ldsp-rd-prog-fill" style="width:${pct}%;background:${lv.bg.replace('0.15', '1')}"></div></div>
                    </div>`;

                // 升级要求变化明细（仅当有reqs时显示）
                if (reqs && reqs.length > 0) {
                    const changes = reqs.map(r => ({
                        name: Utils.simplifyName(r.name),
                        diff: r.currentValue - (todayData.startData[r.name] || 0)
                    })).filter(c => c.diff !== 0).sort((a, b) => b.diff - a.diff);

                    const pos = changes.filter(c => c.diff > 0).length;
                    const neg = changes.filter(c => c.diff < 0).length;

                    html += `
                    <div class="ldsp-today-stats">
                        <div class="ldsp-today-stat"><div class="ldsp-today-stat-val">${pos}</div><div class="ldsp-today-stat-lbl">📈 增长项</div></div>
                        <div class="ldsp-today-stat"><div class="ldsp-today-stat-val">${neg}</div><div class="ldsp-today-stat-lbl">📉 下降项</div></div>
                    </div>`;

                    if (changes.length > 0) {
                        html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📊 今日变化明细</div><div class="ldsp-changes">${
                            changes.map(c => `<div class="ldsp-chg-row"><span class="ldsp-chg-name">${c.name}</span><span class="ldsp-chg-val ${c.diff > 0 ? 'up' : 'down'}">${c.diff > 0 ? '+' : ''}${c.diff}</span></div>`).join('')
                        }</div></div>`;
                    } else {
                        html += `<div class="ldsp-no-chg">今日暂无数据变化</div>`;
                    }
                }

                return html;
            }

            // 渲染周趋势
            renderWeekTrend(history, reqs, historyMgr, tracker) {
                // 阅读时间图表始终显示
                let html = this._renderWeekChart(tracker);

                // 升级要求趋势（仅当有reqs时显示）
                if (reqs && reqs.length > 0) {
                    const weekAgo = Date.now() - 7 * 86400000;
                    const recent = history.filter(h => h.ts > weekAgo);
                    if (recent.length >= 1) {
                        const daily = historyMgr.aggregateDaily(recent, reqs, 7);
                        const fields = this.getTrendFields(reqs);
                        const trends = [];

                        for (const f of fields) {
                            const data = this._calcDailyTrend(daily, f.name, 7);
                            if (data.values.some(v => v > 0)) {
                                trends.push({ label: f.label, ...data, current: f.req.currentValue });
                            }
                        }

                        if (trends.length > 0) {
                            html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📈 本周每日增量<span class="ldsp-chart-sub">每日累积量</span></div>`;
                            html += this._renderSparkRows(trends);
                            if (trends[0].dates.length > 0) {
                                html += `<div class="ldsp-date-labels">${trends[0].dates.map(d => `<span class="ldsp-date-lbl">${d}</span>`).join('')}</div>`;
                            }
                            html += `</div>`;
                        }
                    }
                }

                return html;
            }

            // 渲染月趋势
            renderMonthTrend(history, reqs, historyMgr, tracker) {
                // 阅读时间图表始终显示
                let html = this._renderMonthChart(tracker);

                // 升级要求趋势（仅当有reqs时显示）
                if (reqs && reqs.length > 0 && history.length >= 1) {
                    const weekly = historyMgr.aggregateWeekly(history, reqs);
                    const fields = this.getTrendFields(reqs);
                    const trends = [];

                    for (const f of fields) {
                        const data = this._calcWeeklyTrend(weekly, f.name);
                        if (data.values.length > 0) {
                            trends.push({ label: f.label, ...data, current: f.req.currentValue });
                        }
                    }

                    if (trends.length > 0) {
                        html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📈 本月每周增量<span class="ldsp-chart-sub">每周累积量</span></div>`;
                        html += this._renderSparkRows(trends, true);
                        if (trends[0].labels?.length > 0) {
                            html += `<div class="ldsp-date-labels" style="padding-left:60px">${trends[0].labels.map(l => `<span class="ldsp-date-lbl">${l}</span>`).join('')}</div>`;
                        }
                        html += `</div>`;
                    }
                }

                return html;
            }

            // 渲染年趋势
            renderYearTrend(history, reqs, historyMgr, tracker) {
                // 阅读热力图始终显示
                let html = this._renderYearChart(tracker);

                // 升级要求趋势（仅当有reqs时显示）
                if (reqs && reqs.length > 0) {
                    const yearAgo = Date.now() - 365 * 86400000;
                    const recent = history.filter(h => h.ts > yearAgo);
                    if (recent.length >= 1) {
                        const monthly = historyMgr.aggregateMonthly(recent, reqs);
                        const fields = this.getTrendFields(reqs);
                        const trends = [];

                        for (const f of fields) {
                            const data = this._calcMonthlyTrend(monthly, f.name);
                            if (data.values.some(v => v > 0)) {
                                trends.push({ label: f.label, ...data, current: f.req.currentValue });
                            }
                        }

                        if (trends.length > 0) {
                            html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📊 本年每月增量<span class="ldsp-chart-sub">每月累积量</span></div>`;
                            trends.forEach(t => {
                                const max = Math.max(...t.values, 1);
                                const bars = t.values.map((v, i) => `<div class="ldsp-spark-bar" style="height:${Math.max(v / max * 16, 2)}px" data-v="${v}" title="${i + 1}月: ${v}"></div>`).join('');
                                html += `<div class="ldsp-spark-row"><span class="ldsp-spark-lbl">${t.label}</span><div class="ldsp-spark-bars" style="max-width:100%">${bars}</div><span class="ldsp-spark-val">${t.current}</span></div>`;
                            });
                            html += `</div>`;
                        }
                    }
                }

                return html;
            }

            // 渲染全部趋势
            renderAllTrend(history, reqs, tracker) {
                const total = tracker.getTotalTime();
                const readingData = tracker.storage.get('readingTime', null);
                const actualReadingDays = readingData?.dailyData ? Object.keys(readingData.dailyData).length : 1;
                const avg = Math.round(total / Math.max(actualReadingDays, 1));
                const lv = Utils.getReadingLevel(avg);

                // 阅读时间统计（始终显示）
                let html = `<div class="ldsp-time-info">共记录 <span>${actualReadingDays}</span> 天阅读数据</div>`;

                if (total > 0) {
                    html += `<div class="ldsp-rd-stats" style="background:${lv.bg.replace('0.15', '0.08')}">
                        <div class="ldsp-rd-stats-icon">${lv.icon}</div>
                        <div class="ldsp-rd-stats-info"><div class="ldsp-rd-stats-val">${Utils.formatReadingTime(total)}</div><div class="ldsp-rd-stats-lbl">累计阅读时间 · 日均 ${Utils.formatReadingTime(avg)}</div></div>
                        <div class="ldsp-rd-stats-badge" style="background:${lv.bg};color:${lv.color};box-shadow:0 3px 12px ${lv.bg.replace('0.15','0.4')},inset 0 1px 0 rgba(255,255,255,.25)">${lv.label}</div>
                    </div>`;
                }

                // 升级要求统计（仅当有reqs和history时显示）
                if (reqs && reqs.length > 0 && history.length >= 1) {
                    const oldest = history[0], newest = history.at(-1);
                    const recordDays = history.length;
                    const spanDays = Math.ceil((Date.now() - oldest.ts) / 86400000);

                    if (spanDays > actualReadingDays) {
                        html = html.replace(`共记录 <span>${actualReadingDays}</span> 天阅读数据`, 
                            `共记录 <span>${recordDays}</span> 天数据${spanDays > recordDays ? ` · 跨度 ${spanDays} 天` : ''}`);
                    }

                    // 累计变化统计
                    const changes = reqs.map(r => ({
                        name: Utils.simplifyName(r.name),
                        diff: (newest.data[r.name] || 0) - (oldest.data[r.name] || 0),
                        current: r.currentValue,
                        required: r.requiredValue,
                        isSuccess: r.isSuccess
                    })).filter(c => c.diff !== 0 || c.current > 0);

                    if (changes.length > 0) {
                        html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📊 累计变化 <span style="font-size:9px;color:var(--txt-mut);font-weight:normal">(${recordDays}天)</span></div><div class="ldsp-changes">${
                            changes.map(c => {
                                const diffText = c.diff !== 0 ? `<span class="ldsp-chg-val ${c.diff > 0 ? 'up' : 'down'}">${c.diff > 0 ? '+' : ''}${c.diff}</span>` : '';
                                return `<div class="ldsp-chg-row"><span class="ldsp-chg-name">${c.name}</span><span class="ldsp-chg-cur">${c.current}/${c.required}</span>${diffText}</div>`;
                            }).join('')
                        }</div></div>`;
                    }

                    // 如果有足够的历史数据，显示更多统计
                    if (recordDays >= 2) {
                        const dailyAvgChanges = reqs.map(r => ({
                            name: Utils.simplifyName(r.name),
                            avg: Math.round(((newest.data[r.name] || 0) - (oldest.data[r.name] || 0)) / Math.max(recordDays - 1, 1) * 10) / 10
                        })).filter(c => c.avg > 0);

                        if (dailyAvgChanges.length > 0) {
                            html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📈 日均增量</div><div class="ldsp-changes">${
                                dailyAvgChanges.map(c => `<div class="ldsp-chg-row"><span class="ldsp-chg-name">${c.name}</span><span class="ldsp-chg-val up">+${c.avg}</span></div>`).join('')
                            }</div></div>`;
                        }
                    }
                }

                return html;
            }

            _renderSparkRows(trends, isWeekly = false) {
                let html = '';
                for (const t of trends) {
                    const max = Math.max(...t.values, 1);
                    const bars = t.values.map((v, i) => {
                        const h = Math.max(v / max * 20, 2);
                        const op = isWeekly && i === t.values.length - 1 ? 1 : (isWeekly ? 0.6 : '');
                        return `<div class="ldsp-spark-bar" style="height:${h}px${op ? `;opacity:${op}` : ''}" data-v="${v}"></div>`;
                    }).join('');
                    html += `<div class="ldsp-spark-row"><span class="ldsp-spark-lbl">${t.label}</span><div class="ldsp-spark-bars">${bars}</div><span class="ldsp-spark-val">${t.current}</span></div>`;
                }
                return html;
            }

            _renderWeekChart(tracker) {
                const days = tracker.getWeekHistory();
                const max = Math.max(...days.map(d => d.minutes), 60);
                const total = days.reduce((s, d) => s + d.minutes, 0);
                const avg = Math.round(total / 7);

                const bars = days.map(d => {
                    const h = Math.max(d.minutes / max * 45, 3);
                    return `<div class="ldsp-rd-day"><div class="ldsp-rd-day-bar" style="height:${h}px;opacity:${d.isToday ? 1 : 0.7}" data-t="${Utils.formatReadingTime(d.minutes)}"></div><span class="ldsp-rd-day-lbl">${d.day}</span></div>`;
                }).join('');

                return `<div class="ldsp-chart"><div class="ldsp-chart-title">⏱️ 7天阅读时间<span class="ldsp-chart-sub">共 ${Utils.formatReadingTime(total)} · 日均 ${Utils.formatReadingTime(avg)}</span></div><div class="ldsp-rd-week">${bars}</div></div>`;
            }

            _renderMonthChart(tracker) {
                const today = new Date();
                const [year, month, currentDay] = [today.getFullYear(), today.getMonth(), today.getDate()];
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                let max = 1, total = 0;
                const days = [];

                for (let d = 1; d <= daysInMonth; d++) {
                    const key = new Date(year, month, d).toDateString();
                    const isToday = d === currentDay;
                    const isFuture = d > currentDay;
                    const mins = isFuture ? 0 : (isToday ? tracker.getTodayTime() : tracker.getTimeForDate(key));
                    if (!isFuture) { max = Math.max(max, mins); total += mins; }
                    days.push({ d, mins: Math.max(mins, 0), isToday, isFuture });
                }

                const avg = currentDay > 0 ? Math.round(total / currentDay) : 0;
                // 日期标签字号根据天数动态调整
                const lblFontSize = daysInMonth >= 31 ? '7px' : (daysInMonth >= 28 ? '8px' : '9px');
                const bars = days.map(day => {
                    const h = max > 0 ? (day.mins > 0 ? Math.max(day.mins / max * 45, 2) : 1) : 1;
                    const op = day.isFuture ? 0.35 : (day.isToday ? 1 : 0.75);
                    const timeStr = day.isFuture ? '0分钟 (未到)' : Utils.formatReadingTime(day.mins);
                    return `<div class="ldsp-rd-day" style="margin:0 1px;flex:1;min-width:2px"><div class="ldsp-rd-day-bar" style="height:${h}px;opacity:${op};background:var(--accent2);width:100%;border-radius:3px 3px 0 0" data-t="${day.d}日: ${timeStr}"></div><div class="ldsp-rd-day-lbl" style="margin-top:3px;font-size:${lblFontSize}">${day.d}</div></div>`;
                }).join('');

                return `<div class="ldsp-chart"><div class="ldsp-chart-title">⏱️ 本月阅读时间<span class="ldsp-chart-sub">共 ${Utils.formatReadingTime(total)} · 日均 ${Utils.formatReadingTime(avg)}</span></div><div class="ldsp-rd-week" style="height:100px;align-items:flex-end;gap:1px">${bars}</div></div>`;
            }

            _renderYearChart(tracker) {
                const today = new Date();
                const year = today.getFullYear();
                const data = tracker.getYearData();

                const jan1 = new Date(year, 0, 1);
                const blanks = jan1.getDay() === 0 ? 6 : jan1.getDay() - 1;

                let total = 0;
                data.forEach(m => total += m);

                const days = Array(blanks).fill({ empty: true });
                let d = new Date(jan1);
                while (d <= today) {
                    days.push({
                        date: new Date(d),
                        mins: Math.max(data.get(d.toDateString()) || 0, 0),
                        month: d.getMonth(),
                        day: d.getDate()
                    });
                    d.setDate(d.getDate() + 1);
                }

                const COLS = 14;
                while (days.length % COLS) days.push({ empty: true });

                const rows = [];
                for (let i = 0; i < days.length; i += COLS) {
                    rows.push(days.slice(i, i + COLS));
                }

                const monthRows = new Map();
                rows.forEach((r, i) => {
                    r.forEach(day => {
                        if (!day.empty) {
                            const m = day.month;
                            if (!monthRows.has(m)) monthRows.set(m, { start: i, end: i });
                            else monthRows.get(m).end = i;
                        }
                    });
                });

                const labels = new Map();
                monthRows.forEach((info, m) => {
                    const mid = Math.floor((info.start + info.end) / 2);
                    if (!labels.has(mid)) labels.set(mid, CONFIG.MONTHS[m]);
                });

                let html = `<div class="ldsp-chart"><div class="ldsp-chart-title">⏱️ 本年阅读时间<span class="ldsp-chart-sub">共 ${Utils.formatReadingTime(total)}</span></div><div class="ldsp-year-heatmap"><div class="ldsp-year-wrap">`;

                rows.forEach((row, i) => {
                    const lbl = labels.get(i) || '';
                    html += `<div class="ldsp-year-row"><span class="ldsp-year-month">${lbl}</span><div class="ldsp-year-cells">`;
                    row.forEach(day => {
                        if (day.empty) {
                            html += `<div class="ldsp-year-cell empty"></div>`;
                        } else {
                            const lv = Utils.getHeatmapLevel(day.mins);
                            html += `<div class="ldsp-year-cell l${lv}"><div class="ldsp-year-tip">${day.month + 1}/${day.day}<br>${Utils.formatReadingTime(day.mins)}</div></div>`;
                        }
                    });
                    html += `</div></div>`;
                });

                html += `</div><div class="ldsp-heatmap-legend"><span>&lt;1分</span>`;
                const legendColors = ['rgba(107,140,239,.1)', 'rgba(180,230,210,.35)', 'rgba(130,215,180,.5)', 'rgba(90,195,155,.65)', 'linear-gradient(135deg,#6dcfa5,#50c090)'];
                for (let i = 0; i <= 4; i++) html += `<div class="ldsp-heatmap-legend-cell" style="background:${legendColors[i]}"></div>`;
                html += `<span>&gt;5小时</span></div></div></div>`;

                return html;
            }

            _calcDailyTrend(daily, name, maxDays) {
                const sorted = [...daily.keys()].sort((a, b) => new Date(a) - new Date(b)).slice(-maxDays);
                return {
                    values: sorted.map(d => Math.max(daily.get(d)[name] || 0, 0)),
                    dates: sorted.map(d => Utils.formatDate(new Date(d).getTime(), 'short'))
                };
            }

            _calcWeeklyTrend(weekly, name) {
                const sorted = [...weekly.keys()].sort((a, b) => a - b);
                return {
                    values: sorted.map(i => Math.max(weekly.get(i).data[name] || 0, 0)),
                    labels: sorted.map(i => weekly.get(i).label)
                };
            }

            _calcMonthlyTrend(monthly, name) {
                const sorted = [...monthly.keys()].sort((a, b) => new Date(a) - new Date(b));
                return {
                    values: sorted.map(m => Math.max(monthly.get(m)[name] || 0, 0)),
                    dates: sorted.map(m => `${new Date(m).getMonth() + 1}月`)
                };
            }

            // Toast 提示
            showToast(msg) {
                const toast = document.createElement('div');
                toast.className = 'ldsp-toast';
                toast.innerHTML = msg;
                this.panel.el.appendChild(toast);
                requestAnimationFrame(() => toast.classList.add('show'));
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                }, 4000);
            }

            // 登录提示模态框
            showLoginPrompt(isUpgrade = false) {
                const overlay = document.createElement('div');
                overlay.className = 'ldsp-modal-overlay';
                overlay.innerHTML = `
                    <div class="ldsp-modal">
                        <div class="ldsp-modal-hdr"><span class="ldsp-modal-icon">${isUpgrade ? '🎉' : '👋'}</span><span class="ldsp-modal-title">${isUpgrade ? '升级到 v3.0' : '欢迎使用 LDStatus Pro'}</span></div>
                        <div class="ldsp-modal-body">
                            ${isUpgrade ? `<p>v3.0 版本新增了 <strong>云同步</strong> 功能！</p><p>登录后，你的阅读数据将自动同步到云端，支持跨浏览器、跨设备访问。</p>` : `<p>登录 Linux.do 账号后可以：</p><ul><li>☁️ 阅读数据云端同步</li><li>🔄 跨浏览器/设备同步</li><li>🏆 查看/加入阅读排行榜</li></ul>`}
                        </div>
                        <div class="ldsp-modal-footer">
                            <button class="ldsp-modal-btn primary" id="ldsp-modal-login">🚀 立即登录</button>
                            <button class="ldsp-modal-btn secondary" id="ldsp-modal-skip">稍后再说</button>
                        </div>
                        <div class="ldsp-modal-note">登录仅用于云同步，不登录也可正常使用本地功能</div>
                    </div>`;
                this.panel.el.appendChild(overlay);
                requestAnimationFrame(() => overlay.classList.add('show'));
                return overlay;
            }

            // 渲染排行榜
            renderLeaderboard(tab, isLoggedIn, isJoined) {
                const tabs = [
                    { id: 'daily', label: '📅 日榜' },
                    { id: 'weekly', label: '📊 周榜' },
                    { id: 'monthly', label: '📈 月榜' }
                ];
                this.panel.$.leaderboard.innerHTML = `
                    <div class="ldsp-subtabs">${tabs.map(t => 
                        `<div class="ldsp-subtab${tab === t.id ? ' active' : ''}" data-lb="${t.id}">${t.label}</div>`
                    ).join('')}</div>
                    <div class="ldsp-lb-content"></div>`;
            }

            renderLeaderboardLogin() {
                return `<div class="ldsp-lb-login">
                    <div class="ldsp-lb-login-icon">🔐</div>
                    <div class="ldsp-lb-login-title">需要登录</div>
                    <div class="ldsp-lb-login-desc">登录后可以：<br>☁️ 阅读数据云端同步<br>🏆 查看/加入排行榜</div>
                    <button class="ldsp-lb-btn primary" id="ldsp-lb-login">🚀 立即登录</button>
                    <div class="ldsp-privacy-note"><span>🔒</span><span>仅获取基本信息，用于数据同步</span></div>
                </div>`;
            }

            renderLeaderboardJoin() {
                return `<div class="ldsp-join-prompt">
                    <div class="ldsp-join-prompt-icon">🏆</div>
                    <div class="ldsp-join-prompt-title">加入阅读排行榜</div>
                    <div class="ldsp-join-prompt-desc">加入后可以查看排行榜，你的阅读时间将与其他用户一起展示<br>这是完全可选的，随时可以退出</div>
                    <button class="ldsp-lb-btn primary" id="ldsp-lb-join">✨ 加入排行榜</button>
                    <div class="ldsp-privacy-note"><span>🔒</span><span>仅展示用户名和阅读时间</span></div>
                </div>`;
            }

            renderLeaderboardData(data, userId, isJoined, type = 'daily') {
                // 从 CONFIG.CACHE 动态读取更新频率并格式化
                const formatInterval = (ms) => {
                    const mins = Math.round(ms / 60000);
                    if (mins < 60) return `每 ${mins} 分钟更新`;
                    const hours = Math.round(mins / 60);
                    return `每 ${hours} 小时更新`;
                };
                const rules = {
                    daily: formatInterval(CONFIG.CACHE.LEADERBOARD_DAILY_TTL),
                    weekly: formatInterval(CONFIG.CACHE.LEADERBOARD_WEEKLY_TTL),
                    monthly: formatInterval(CONFIG.CACHE.LEADERBOARD_MONTHLY_TTL)
                };

                if (!data?.rankings?.length) {
                    return `<div class="ldsp-lb-empty"><div class="ldsp-lb-empty-icon">📭</div><div class="ldsp-lb-empty-txt">暂无排行数据<br>成为第一个上榜的人吧！</div></div>`;
                }

                let html = `<div class="ldsp-lb-period"><button class="ldsp-lb-refresh" data-type="${type}" title="手动刷新">🔄</button>${data.period ? `📅 统计周期: <span>${data.period}</span>` : ''}<span class="ldsp-update-rule">🔄 ${rules[type]}</span></div>`;

                if (data.myRank && isJoined) {
                    // 显示用户排名（无论是否在榜内都显示真实排名）
                    const rankDisplay = data.myRank.rank ? `#${data.myRank.rank}` : (data.myRank.rank_display || '--');
                    const inTopClass = data.myRank.in_top ? '' : ' not-in-top';
                    const topLabel = data.myRank.in_top ? '' : '<span class="ldsp-not-in-top-hint">（未入榜）</span>';
                    html += `<div class="ldsp-my-rank${inTopClass}"><div><div class="ldsp-my-rank-lbl">我的排名${topLabel}</div><div class="ldsp-my-rank-val">${rankDisplay}</div></div><div class="ldsp-my-rank-time">${Utils.formatReadingTime(data.myRank.minutes)}</div></div>`;
                }

                html += '<div class="ldsp-rank-list">';
                const siteBaseUrl = `https://${CURRENT_SITE.domain}`;
                data.rankings.forEach((user, i) => {
                    const rank = i + 1;
                    const isMe = userId && user.user_id === userId;
                    const cls = [rank <= 3 ? `t${rank}` : '', isMe ? 'me' : ''].filter(Boolean).join(' ');
                    const icon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
                    const avatar = user.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${siteBaseUrl}${user.avatar_url}`) : '';
                    // XSS 防护：转义用户名和显示名称
                    const safeUsername = Utils.escapeHtml(Utils.sanitize(user.username, 30));
                    const safeName = Utils.escapeHtml(Utils.sanitize(user.name, 100));
                    const hasName = safeName && safeName.trim();
                    const nameHtml = hasName 
                        ? `<span class="ldsp-rank-display-name">${safeName}</span><span class="ldsp-rank-username">@${safeUsername}</span>`
                        : `<span class="ldsp-rank-name-only">${safeUsername}</span>`;

                    html += `<div class="ldsp-rank-item ${cls}" style="animation-delay:${i * 30}ms">
                        <div class="ldsp-rank-num">${rank <= 3 ? icon : rank}</div>
                        ${avatar ? `<img class="ldsp-rank-avatar" src="${avatar}" alt="${safeUsername}" onerror="this.outerHTML='<div class=\\'ldsp-rank-avatar\\' style=\\'display:flex;align-items:center;justify-content:center;font-size:12px\\'>👤</div>'">` : '<div class="ldsp-rank-avatar" style="display:flex;align-items:center;justify-content:center;font-size:12px">👤</div>'}
                        <div class="ldsp-rank-info">${nameHtml}${isMe ? '<span class="ldsp-rank-me-tag">(我)</span>' : ''}</div>
                        <div class="ldsp-rank-time">${Utils.formatReadingTime(user.minutes)}</div>
                    </div>`;
                });
                html += '</div>';

                if (isJoined) {
                    html += `<div style="margin-top:12px;text-align:center"><button class="ldsp-lb-btn danger" id="ldsp-lb-quit" style="font-size:9px;padding:4px 8px">退出排行榜</button></div>`;
                }

                return html;
            }

            renderLeaderboardLoading() {
                return `<div class="ldsp-mini-loader"><div class="ldsp-mini-spin"></div><div class="ldsp-mini-txt">加载排行榜...</div></div>`;
            }

            renderLeaderboardError(msg) {
                return `<div class="ldsp-lb-empty"><div class="ldsp-lb-empty-icon">❌</div><div class="ldsp-lb-empty-txt">${msg}</div><button class="ldsp-lb-btn secondary" id="ldsp-lb-retry" style="margin-top:12px">🔄 重试</button></div>`;
            }

            // ========== 我的活动渲染 ==========
            renderActivity(activeSubTab) {
                const tabs = [
                    { id: 'read', label: '已读', icon: '📖' },
                    { id: 'bookmarks', label: '收藏', icon: '⭐' },
                    { id: 'replies', label: '回复', icon: '💬' },
                    { id: 'likes', label: '赞过', icon: '❤️' },
                    { id: 'topics', label: '我的话题', icon: '📝' }
                ];
                this.panel.$.activity.innerHTML = `
                    <div class="ldsp-subtabs">${tabs.map(t => 
                        `<div class="ldsp-subtab${activeSubTab === t.id ? ' active' : ''}" data-activity="${t.id}">${t.icon} ${t.label}</div>`
                    ).join('')}</div>
                    <div class="ldsp-activity-content"></div>`;
            }

            renderActivityLoading() {
                return `<div class="ldsp-mini-loader"><div class="ldsp-mini-spin"></div><div class="ldsp-mini-txt">加载中...</div></div>`;
            }

            renderActivityEmpty(icon, msg) {
                return `<div class="ldsp-lb-empty"><div class="ldsp-lb-empty-icon">${icon}</div><div class="ldsp-lb-empty-txt">${msg}</div></div>`;
            }

            renderActivityError(msg) {
                return `<div class="ldsp-lb-empty"><div class="ldsp-lb-empty-icon">❌</div><div class="ldsp-lb-empty-txt">${msg}</div><button class="ldsp-lb-btn secondary ldsp-activity-retry" style="margin-top:12px">🔄 重试</button></div>`;
            }

            renderTopicList(topics, hasMore) {
                if (!topics || topics.length === 0) {
                    return this.renderActivityEmpty('📭', '暂无已读话题');
                }

                // SVG 图标定义（更小更简洁）
                const icons = {
                    reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
                    view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
                    like: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
                };

                // 获取头像URL
                const getAvatarUrl = (user, size = 36) => {
                    if (!user || !user.avatar_template) return '';
                    let template = user.avatar_template;
                    if (template.startsWith('/')) {
                        template = `https://${CURRENT_SITE.domain}${template}`;
                    }
                    return template.replace('{size}', size);
                };

                // 获取缩略图URL
                const getThumbnailUrl = (topic) => {
                    if (!topic.thumbnails || topic.thumbnails.length === 0) return null;
                    const small = topic.thumbnails.find(t => t.max_width && t.max_width <= 200);
                    return small?.url || topic.thumbnails[topic.thumbnails.length - 1]?.url || topic.image_url;
                };

                let html = '<div class="ldsp-topic-list ldsp-topic-list-enhanced">';
                topics.forEach((topic, i) => {
                    const title = Utils.escapeHtml(topic.title || '无标题');
                    const postsCount = topic.posts_count || 0;
                    const views = topic.views || 0;
                    const likeCount = topic.like_count || 0;
                    const unread = topic.unread_posts || topic.unread || 0;
                    const newPosts = topic.new_posts || 0;
                    const tags = topic.tags || [];
                    const relativeTime = Utils.formatRelativeTime(topic.bumped_at);
                    const topicUrl = `https://${CURRENT_SITE.domain}/t/topic/${topic.id}`;
                    const thumbnailUrl = getThumbnailUrl(topic);
                    const posters = topic.postersInfo || [];
                    
                    // 未读/新回复标记（简化，只显示一个）
                    let badgeHtml = '';
                    if (unread > 0) {
                        badgeHtml = `<span class="ldsp-topic-badge ldsp-badge-unread">${unread}</span>`;
                    } else if (newPosts > 0) {
                        badgeHtml = `<span class="ldsp-topic-badge ldsp-badge-new">${newPosts}</span>`;
                    }

                    // 标签（最多2个）
                    let tagsHtml = '';
                    if (tags.length > 0) {
                        tagsHtml = `<div class="ldsp-topic-tags">${tags.slice(0, 2).map(tag => 
                            `<span class="ldsp-topic-tag">${Utils.escapeHtml(tag)}</span>`
                        ).join('')}${tags.length > 2 ? `<span class="ldsp-topic-tag-more">+${tags.length - 2}</span>` : ''}</div>`;
                    }

                    // 发帖人头像（最多3个，更小）
                    let postersHtml = '';
                    if (posters.length > 0) {
                        postersHtml = '<div class="ldsp-topic-posters">';
                        posters.slice(0, 3).forEach((poster, idx) => {
                            const isOP = poster.description?.includes('原始发帖人');
                            const isLatest = poster.extras?.includes('latest');
                            const cls = isOP ? 'ldsp-poster-op' : (isLatest ? 'ldsp-poster-latest' : '');
                            postersHtml += `<img src="${getAvatarUrl(poster)}" class="ldsp-topic-avatar ${cls}" title="${Utils.escapeHtml(poster.name || poster.username)}" style="z-index:${5-idx}" loading="lazy">`;
                        });
                        if (posters.length > 3) postersHtml += `<span class="ldsp-topic-posters-more">+${posters.length - 3}</span>`;
                        postersHtml += '</div>';
                    }
                    
                    // 缩略图
                    const thumbHtml = thumbnailUrl ? `<div class="ldsp-topic-thumbnail"><img src="${thumbnailUrl}" loading="lazy"></div>` : '';
                    
                    html += `
                        <a href="${topicUrl}" target="_blank" class="ldsp-topic-item" style="animation-delay:${i * 20}ms">
                            <div class="ldsp-topic-main">
                                <div class="ldsp-topic-header">
                                    <div class="ldsp-topic-title-row">
                                        ${badgeHtml ? `<div class="ldsp-topic-badges">${badgeHtml}</div>` : ''}
                                        <div class="ldsp-topic-title" title="${title}">${title}</div>
                                    </div>
                                    <div class="ldsp-topic-info">
                                        ${tagsHtml}
                                    </div>
                                </div>
                                <div class="ldsp-topic-footer">
                                    ${postersHtml}
                                    <div class="ldsp-topic-stats">
                                        <span class="ldsp-topic-stat" title="回复">${icons.reply}<em>${postsCount}</em></span>
                                        <span class="ldsp-topic-stat" title="阅读">${icons.view}<em>${views >= 1000 ? (views/1000).toFixed(1)+'k' : views}</em></span>
                                        ${likeCount > 0 ? `<span class="ldsp-topic-stat ldsp-stat-like" title="点赞">${icons.like}<em>${likeCount}</em></span>` : ''}
                                        <span class="ldsp-topic-time">${relativeTime}</span>
                                    </div>
                                </div>
                            </div>
                            ${thumbHtml}
                        </a>`;
                });
                html += '</div>';

                if (hasMore) {
                    html += '<div class="ldsp-load-more"><div class="ldsp-load-more-spinner"></div><span>加载更多...</span></div>';
                }

                return html;
            }

            renderBookmarkList(bookmarks, hasMore) {
                if (!bookmarks || bookmarks.length === 0) {
                    return this.renderActivityEmpty('⭐', '暂无收藏');
                }

                // SVG 图标定义
                const icons = {
                    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
                    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
                    bookmark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>'
                };

                let html = '<div class="ldsp-bookmark-list">';
                bookmarks.forEach((bookmark, i) => {
                    const title = Utils.escapeHtml(bookmark.title || bookmark.fancy_title || '无标题');
                    const tags = bookmark.tags || [];
                    const bumpedAt = bookmark.bumped_at;
                    const createdAt = bookmark.created_at;
                    const relativeTime = Utils.formatRelativeTime(bumpedAt);
                    const createdTime = Utils.formatDateTime(createdAt);
                    const bookmarkUrl = bookmark.bookmarkable_url || '#';
                    const excerpt = bookmark.excerpt || '';
                    
                    // 构建标签HTML
                    let tagsHtml = '';
                    if (tags.length > 0) {
                        tagsHtml = `<div class="ldsp-bookmark-tags">${tags.slice(0, 4).map(tag => 
                            `<span class="ldsp-bookmark-tag">${Utils.escapeHtml(tag)}</span>`
                        ).join('')}${tags.length > 4 ? `<span class="ldsp-bookmark-tag-more">+${tags.length - 4}</span>` : ''}</div>`;
                    }
                    
                    html += `
                        <div class="ldsp-bookmark-item" data-url="${bookmarkUrl}" style="animation-delay:${i * 30}ms">
                            <div class="ldsp-bookmark-title">${title}</div>
                            <div class="ldsp-bookmark-meta">
                                <span class="ldsp-bookmark-time" title="收藏时间">${icons.calendar}${createdTime || '--'}</span>
                                <span class="ldsp-bookmark-time" title="最后活动">${icons.clock}${relativeTime || '--'}</span>
                            </div>
                            ${tagsHtml}
                            ${excerpt ? `<div class="ldsp-bookmark-excerpt">${excerpt}</div>` : ''}
                        </div>`;
                });
                html += '</div>';

                if (hasMore) {
                    html += '<div class="ldsp-load-more"><div class="ldsp-load-more-spinner"></div><span>加载更多...</span></div>';
                }

                return html;
            }

            renderReplyList(replies, hasMore) {
                if (!replies || replies.length === 0) {
                    return this.renderActivityEmpty('💬', '暂无回复');
                }

                // SVG 图标定义
                const icons = {
                    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
                    reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'
                };

                let html = '<div class="ldsp-reply-list">';
                replies.forEach((reply, i) => {
                    const title = Utils.escapeHtml(reply.title || '无标题');
                    const excerpt = reply.excerpt || '';
                    const createdAt = reply.created_at;
                    const relativeTime = Utils.formatRelativeTime(createdAt);
                    const topicId = reply.topic_id;
                    const postNumber = reply.post_number;
                    const replyUrl = `https://${CURRENT_SITE.domain}/t/topic/${topicId}/${postNumber}`;
                    const replyToPostNumber = reply.reply_to_post_number;
                    
                    html += `
                        <div class="ldsp-reply-item" data-url="${replyUrl}" style="animation-delay:${i * 30}ms">
                            <div class="ldsp-reply-title">${title}</div>
                            <div class="ldsp-reply-meta">
                                <span class="ldsp-reply-time" title="回复时间">${icons.clock}${relativeTime || '--'}</span>
                                ${replyToPostNumber ? `<span class="ldsp-reply-to" title="回复楼层">${icons.reply}#${replyToPostNumber}</span>` : ''}
                            </div>
                            ${excerpt ? `<div class="ldsp-reply-excerpt">${excerpt}</div>` : ''}
                        </div>`;
                });
                html += '</div>';

                if (hasMore) {
                    html += '<div class="ldsp-load-more"><div class="ldsp-load-more-spinner"></div><span>加载更多...</span></div>';
                }

                return html;
            }

            renderLikeList(likes, hasMore) {
                if (!likes || likes.length === 0) {
                    return this.renderActivityEmpty('❤️', '暂无赞过内容');
                }

                // SVG 图标定义
                const icons = {
                    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
                    heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
                    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
                };

                let html = '<div class="ldsp-like-list">';
                likes.forEach((like, i) => {
                    const title = Utils.escapeHtml(like.title || '无标题');
                    const excerpt = like.excerpt || '';
                    const createdAt = like.created_at;
                    const relativeTime = Utils.formatRelativeTime(createdAt);
                    const topicId = like.topic_id;
                    const postNumber = like.post_number;
                    const likeUrl = `https://${CURRENT_SITE.domain}/t/topic/${topicId}/${postNumber}`;
                    const authorName = Utils.escapeHtml(like.name || like.username || '匿名');
                    const authorUsername = like.username;
                    
                    html += `
                        <div class="ldsp-like-item" data-url="${likeUrl}" style="animation-delay:${i * 30}ms">
                            <div class="ldsp-like-title">${title}</div>
                            <div class="ldsp-like-meta">
                                <span class="ldsp-like-time" title="点赞时间">${icons.clock}${relativeTime || '--'}</span>
                                <span class="ldsp-like-author" title="作者：@${authorUsername}">${icons.user}${authorName}</span>
                            </div>
                            ${excerpt ? `<div class="ldsp-like-excerpt">${excerpt}</div>` : ''}
                        </div>`;
                });
                html += '</div>';

                if (hasMore) {
                    html += '<div class="ldsp-load-more"><div class="ldsp-load-more-spinner"></div><span>加载更多...</span></div>';
                }

                return html;
            }

            renderMyTopicList(topics, hasMore) {
                if (!topics || topics.length === 0) {
                    return this.renderActivityEmpty('📝', '暂无发布的话题');
                }

                // SVG 图标定义
                const icons = {
                    reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
                    view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
                    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
                    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
                    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
                    pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>',
                    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>'
                };

                let html = '<div class="ldsp-mytopic-list">';
                topics.forEach((topic, i) => {
                    const title = Utils.escapeHtml(topic.title || topic.fancy_title || '无标题');
                    const postsCount = topic.posts_count || 0;
                    const views = topic.views || 0;
                    const likeCount = topic.like_count || 0;
                    const tags = topic.tags || [];
                    const bumpedAt = topic.bumped_at;
                    const createdAt = topic.created_at;
                    const relativeTime = Utils.formatRelativeTime(bumpedAt);
                    const createdTime = Utils.formatDateTime(createdAt);
                    const topicUrl = `https://${CURRENT_SITE.domain}/t/topic/${topic.id}`;
                    const isPinned = topic.pinned;
                    const isClosed = topic.closed;
                    
                    // 构建标签HTML
                    let tagsHtml = '';
                    if (tags.length > 0) {
                        tagsHtml = `<div class="ldsp-mytopic-tags">${tags.slice(0, 3).map(tag => 
                            `<span class="ldsp-mytopic-tag">${Utils.escapeHtml(tag)}</span>`
                        ).join('')}${tags.length > 3 ? `<span class="ldsp-mytopic-tag-more">+${tags.length - 3}</span>` : ''}</div>`;
                    }

                    // 状态图标
                    let statusIcons = '';
                    if (isPinned) statusIcons += `<span class="ldsp-mytopic-status" title="已置顶">${icons.pin}</span>`;
                    if (isClosed) statusIcons += `<span class="ldsp-mytopic-status ldsp-mytopic-closed" title="已关闭">${icons.lock}</span>`;
                    
                    html += `
                        <a href="${topicUrl}" target="_blank" class="ldsp-mytopic-item${isClosed ? ' closed' : ''}" style="animation-delay:${i * 30}ms" title="${title}">
                            <div class="ldsp-mytopic-header">
                                <div class="ldsp-mytopic-title">${title}</div>
                                ${statusIcons ? `<div class="ldsp-mytopic-icons">${statusIcons}</div>` : ''}
                            </div>
                            <div class="ldsp-mytopic-row">
                                ${tagsHtml}
                                <span class="ldsp-mytopic-time" title="创建时间">${icons.calendar}${createdTime || '--'}</span>
                            </div>
                            <div class="ldsp-mytopic-meta">
                                <span class="ldsp-mytopic-stat" title="回复数">${icons.reply}${postsCount}</span>
                                <span class="ldsp-mytopic-stat" title="浏览量">${icons.view}${views}</span>
                                <span class="ldsp-mytopic-stat ldsp-mytopic-likes" title="点赞数">${icons.heart}${likeCount}</span>
                                <div class="ldsp-mytopic-meta-right">
                                    <span class="ldsp-mytopic-time" title="最后活动">${icons.clock}${relativeTime || '--'}</span>
                                </div>
                            </div>
                        </a>`;
                });
                html += '</div>';

                if (hasMore) {
                    html += '<div class="ldsp-load-more"><div class="ldsp-load-more-spinner"></div><span>加载更多...</span></div>';
                }

                return html;
            }
        }

        // ==================== 我的活动管理器 ====================
        class ActivityManager {
            constructor(network) {
                this.network = network;
                this._cache = new Map();
                this._loading = new Map();
                this._pageState = new Map(); // 记录每个子tab的分页状态
            }

            // 获取已读话题列表
            async getReadTopics(page = 0) {
                const cacheKey = `read_${page}`;
                
                // 检查缓存（1分钟有效）
                const cached = this._cache.get(cacheKey);
                if (cached && Date.now() - cached.time < 60000) {
                    return cached.data;
                }

                // 防止重复请求
                if (this._loading.get(cacheKey)) {
                    return new Promise((resolve) => {
                        const check = () => {
                            if (!this._loading.get(cacheKey)) {
                                resolve(this._cache.get(cacheKey)?.data);
                            } else {
                                setTimeout(check, 100);
                            }
                        };
                        check();
                    });
                }

                this._loading.set(cacheKey, true);

                try {
                    const url = page > 0 
                        ? `https://${CURRENT_SITE.domain}/read.json?page=${page}`
                        : `https://${CURRENT_SITE.domain}/read.json`;
                    
                    const response = await this.network.fetchJson(url, {
                        headers: {
                            'Accept': 'application/json, text/javascript, */*; q=0.01',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Discourse-Present': 'true',
                            'Discourse-Logged-In': 'true'
                        },
                        credentials: 'include'
                    });

                    if (!response || !response.topic_list) {
                        throw new Error('无效的响应数据');
                    }

                    // 构建用户ID到用户信息的映射
                    const usersMap = {};
                    if (response.users && Array.isArray(response.users)) {
                        response.users.forEach(user => {
                            usersMap[user.id] = user;
                        });
                    }

                    // 为每个话题附加发帖人信息
                    const topics = (response.topic_list.topics || []).map(topic => {
                        if (topic.posters && topic.posters.length > 0) {
                            topic.postersInfo = topic.posters.map(poster => {
                                const user = usersMap[poster.user_id];
                                return user ? { ...user, description: poster.description, extras: poster.extras } : null;
                            }).filter(Boolean);
                        }
                        return topic;
                    });

                    const result = {
                        topics: topics,
                        hasMore: !!response.topic_list.more_topics_url,
                        page: page
                    };

                    this._cache.set(cacheKey, { data: result, time: Date.now() });
                    return result;
                } catch (e) {
                    throw new Error(e.message || '获取已读话题失败');
                } finally {
                    this._loading.set(cacheKey, false);
                }
            }

            // 获取收藏列表
            async getBookmarks(page = 0, username) {
                if (!username) throw new Error('未登录');
                
                const cacheKey = `bookmarks_${page}`;
                
                // 检查缓存（1分钟有效）
                const cached = this._cache.get(cacheKey);
                if (cached && Date.now() - cached.time < 60000) {
                    return cached.data;
                }

                // 防止重复请求
                if (this._loading.get(cacheKey)) {
                    return new Promise((resolve) => {
                        const check = () => {
                            if (!this._loading.get(cacheKey)) {
                                resolve(this._cache.get(cacheKey)?.data);
                            } else {
                                setTimeout(check, 100);
                            }
                        };
                        check();
                    });
                }

                this._loading.set(cacheKey, true);

                try {
                    const url = `https://${CURRENT_SITE.domain}/u/${encodeURIComponent(username)}/bookmarks.json?page=${page}`;
                    
                    const response = await this.network.fetchJson(url, {
                        headers: {
                            'Accept': 'application/json, text/javascript, */*; q=0.01',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Discourse-Present': 'true',
                            'Discourse-Logged-In': 'true'
                        },
                        credentials: 'include'
                    });

                    if (!response || !response.user_bookmark_list) {
                        throw new Error('无效的响应数据');
                    }

                    const result = {
                        bookmarks: response.user_bookmark_list.bookmarks || [],
                        hasMore: !!response.user_bookmark_list.more_bookmarks_url,
                        page: page
                    };

                    this._cache.set(cacheKey, { data: result, time: Date.now() });
                    return result;
                } catch (e) {
                    throw new Error(e.message || '获取收藏列表失败');
                } finally {
                    this._loading.set(cacheKey, false);
                }
            }

            // 获取回复列表
            async getReplies(offset = 0, username) {
                if (!username) throw new Error('未登录');
                
                const cacheKey = `replies_${offset}`;
                
                // 检查缓存（1分钟有效）
                const cached = this._cache.get(cacheKey);
                if (cached && Date.now() - cached.time < 60000) {
                    return cached.data;
                }

                // 防止重复请求
                if (this._loading.get(cacheKey)) {
                    return new Promise((resolve) => {
                        const check = () => {
                            if (!this._loading.get(cacheKey)) {
                                resolve(this._cache.get(cacheKey)?.data);
                            } else {
                                setTimeout(check, 100);
                            }
                        };
                        check();
                    });
                }

                this._loading.set(cacheKey, true);

                try {
                    const url = `https://${CURRENT_SITE.domain}/user_actions.json?offset=${offset}&username=${encodeURIComponent(username)}&filter=5`;
                    
                    const response = await this.network.fetchJson(url, {
                        headers: {
                            'Accept': 'application/json, text/javascript, */*; q=0.01',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Discourse-Present': 'true',
                            'Discourse-Logged-In': 'true'
                        },
                        credentials: 'include'
                    });

                    if (!response || !response.user_actions) {
                        throw new Error('无效的响应数据');
                    }

                    const replies = response.user_actions || [];
                    const result = {
                        replies: replies,
                        hasMore: replies.length >= 30, // 每页30条，如果返回30条说明可能还有更多
                        offset: offset
                    };

                    this._cache.set(cacheKey, { data: result, time: Date.now() });
                    return result;
                } catch (e) {
                    throw new Error(e.message || '获取回复列表失败');
                } finally {
                    this._loading.set(cacheKey, false);
                }
            }

            // 获取赞过列表
            async getLikes(offset = 0, username) {
                if (!username) throw new Error('未登录');
                
                const cacheKey = `likes_${offset}`;
                
                // 检查缓存（1分钟有效）
                const cached = this._cache.get(cacheKey);
                if (cached && Date.now() - cached.time < 60000) {
                    return cached.data;
                }

                // 防止重复请求
                if (this._loading.get(cacheKey)) {
                    return new Promise((resolve) => {
                        const check = () => {
                            if (!this._loading.get(cacheKey)) {
                                resolve(this._cache.get(cacheKey)?.data);
                            } else {
                                setTimeout(check, 100);
                            }
                        };
                        check();
                    });
                }

                this._loading.set(cacheKey, true);

                try {
                    const url = `https://${CURRENT_SITE.domain}/user_actions.json?offset=${offset}&username=${encodeURIComponent(username)}&filter=1`;
                    
                    const response = await this.network.fetchJson(url, {
                        headers: {
                            'Accept': 'application/json, text/javascript, */*; q=0.01',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Discourse-Present': 'true',
                            'Discourse-Logged-In': 'true'
                        },
                        credentials: 'include'
                    });

                    if (!response || !response.user_actions) {
                        throw new Error('无效的响应数据');
                    }

                    const likes = response.user_actions || [];
                    const result = {
                        likes: likes,
                        hasMore: likes.length >= 30, // 每页30条，如果返回30条说明可能还有更多
                        offset: offset
                    };

                    this._cache.set(cacheKey, { data: result, time: Date.now() });
                    return result;
                } catch (e) {
                    throw new Error(e.message || '获取赞过列表失败');
                } finally {
                    this._loading.set(cacheKey, false);
                }
            }

            // 获取我的话题列表
            async getMyTopics(page = 0, username) {
                if (!username) throw new Error('未登录');
                
                const cacheKey = `topics_${page}`;
                
                // 检查缓存（1分钟有效）
                const cached = this._cache.get(cacheKey);
                if (cached && Date.now() - cached.time < 60000) {
                    return cached.data;
                }

                // 防止重复请求
                if (this._loading.get(cacheKey)) {
                    return new Promise((resolve) => {
                        const check = () => {
                            if (!this._loading.get(cacheKey)) {
                                resolve(this._cache.get(cacheKey)?.data);
                            } else {
                                setTimeout(check, 100);
                            }
                        };
                        check();
                    });
                }

                this._loading.set(cacheKey, true);

                try {
                    const url = page > 0
                        ? `https://${CURRENT_SITE.domain}/topics/created-by/${encodeURIComponent(username)}.json?page=${page}`
                        : `https://${CURRENT_SITE.domain}/topics/created-by/${encodeURIComponent(username)}.json`;
                    
                    const response = await this.network.fetchJson(url, {
                        headers: {
                            'Accept': 'application/json, text/javascript, */*; q=0.01',
                            'X-Requested-With': 'XMLHttpRequest',
                            'Discourse-Present': 'true',
                            'Discourse-Logged-In': 'true'
                        },
                        credentials: 'include'
                    });

                    if (!response || !response.topic_list) {
                        throw new Error('无效的响应数据');
                    }

                    const topics = response.topic_list.topics || [];
                    const result = {
                        topics: topics,
                        hasMore: topics.length >= 30, // 每页30条
                        page: page
                    };

                    this._cache.set(cacheKey, { data: result, time: Date.now() });
                    return result;
                } catch (e) {
                    throw new Error(e.message || '获取我的话题失败');
                } finally {
                    this._loading.set(cacheKey, false);
                }
            }

            // 清除缓存和分页状态
            clearCache(type) {
                if (type) {
                    // 清除特定类型的缓存
                    for (const key of this._cache.keys()) {
                        if (key.startsWith(type)) {
                            this._cache.delete(key);
                        }
                    }
                    // 同时清除分页状态
                    this._pageState.delete(type);
                } else {
                    this._cache.clear();
                    this._pageState.clear();
                }
            }

            // 获取分页状态
            getPageState(type) {
                return this._pageState.get(type) || { page: 0, allTopics: [], hasMore: true };
            }

            // 设置分页状态
            setPageState(type, state) {
                this._pageState.set(type, state);
            }
        }

        // ==================== 主面板类 ====================
        class Panel {
            constructor() {
                this._initManagers();
                this._initState();
                this._initUI();
                this._initCloudServices();
                this._initEventListeners();
                this._initTimers();
            }
            
            // 初始化管理器实例
            _initManagers() {
                this.storage = new Storage();
                this.network = new Network();
                this.historyMgr = new HistoryManager(this.storage);
                this.tracker = new ReadingTracker(this.storage);
                this.notifier = new Notifier(this.storage);
                this.activityMgr = new ActivityManager(this.network);

                // 排行榜相关（仅支持的站点）
                this.hasLeaderboard = CURRENT_SITE.supportsLeaderboard;
                if (this.hasLeaderboard) {
                    this.oauth = new OAuthManager(this.storage, this.network);
                    this.leaderboard = new LeaderboardManager(this.oauth, this.tracker, this.storage);
                    this.cloudSync = new CloudSyncManager(this.storage, this.oauth, this.tracker);
                    this.cloudSync.setHistoryManager(this.historyMgr);
                    this.lbTab = this.storage.getGlobal('leaderboardTab', 'daily');
                }
            }
            
            // 初始化状态变量
            _initState() {
                this.prevReqs = [];
                this.trendTab = this.storage.getGlobal('trendTab', 'today');
                // 兼容性：修复旧版本的无效 tab 值
                if (!['today', 'week', 'month', 'year', 'all'].includes(this.trendTab)) {
                    this.trendTab = 'today';
                    this.storage.setGlobal('trendTab', 'today');
                }
                this.avatar = this.storage.get('userAvatar', null);
                this.readingTime = 0;
                this.username = null;
                this.animRing = true;
                this.cachedHistory = [];
                this.cachedReqs = [];
                this.loading = false;
                this._readingTimer = null;
                this._destroyed = false;  // 销毁标记
                
                // 我的活动相关状态
                this.activitySubTab = 'read';  // 默认子tab
                this._activityScrollHandler = null;  // 滚动事件处理器
            }
            
            // 初始化 UI
            _initUI() {
                Styles.inject();
                this._createPanel();
                this.renderer = new Renderer(this);
                this._bindEvents();
                this._restore();
                this.fetch();

                // 工单管理器初始化
                if (this.hasLeaderboard && this.oauth) {
                    this.ticketManager = new TicketManager(this.oauth, this.$.panelBody);
                    this.ticketManager.init().catch(e => Logger.warn('TicketManager init error:', e));
                }

                // 吃瓜助手初始化
                this.melonHelper = new MelonHelper(this.$.panelBody, this.renderer);
                this.melonHelper.init();
                
                // 关注/粉丝管理器初始化（包含头像缓存）
                this.followManager = new FollowManager(this.network, this.storage, this.$.panelBody, this.renderer);
                this.followManager.init();
                // 从缓存加载头像（优先动态头像）
                this._loadAvatarFromCache();
                // 延迟懒加载关注/粉丝数据和用户profile
                setTimeout(() => {
                    this.followManager.loadData().catch(e => Logger.warn('FollowManager load error:', e));
                    this.followManager.loadProfile().catch(e => Logger.warn('FollowManager profile error:', e));
                }, 2000);
            }
            
            // 初始化云服务
            _initCloudServices() {
                // 检查待处理的 OAuth 登录结果（统一同窗口模式）
                let justLoggedIn = false;
                if (this.hasLeaderboard && this.oauth) {
                    justLoggedIn = this._checkPendingOAuthLogin();
                }

                if (!this.hasLeaderboard) return;
                
                // 注册同步状态回调
                this.cloudSync.setSyncStateCallback(syncing => {
                    if (this._destroyed) return;
                    if (this.$.btnCloudSync) {
                        this.$.btnCloudSync.disabled = syncing;
                        this.$.btnCloudSync.textContent = syncing ? '⏳' : '☁️';
                        this.$.btnCloudSync.title = syncing ? '同步中...' : '云同步';
                    }
                    // 云同步完成时检查未读工单
                    if (!syncing) this.ticketManager?._checkUnread();
                });

                if (this.oauth.isLoggedIn() && !justLoggedIn) {
                    this._initLoggedInUser();
                } else if (justLoggedIn) {
                    if (this.oauth.isJoined()) this.leaderboard.startSync();
                } else {
                    this._checkLoginPrompt();
                }
            }
            
            // 初始化已登录用户
            _initLoggedInUser() {
                const oauthUser = this.oauth.getUserInfo();
                if (oauthUser?.username) {
                    const currentUser = this.storage.getUser();
                    if (currentUser !== oauthUser.username) {
                        this.storage.setUser(oauthUser.username);
                        this.storage.invalidateCache();
                        this.storage.migrate(oauthUser.username);
                    }
                    this._updateUserInfoFromOAuth(oauthUser);
                }
                // 串行化同步请求
                this.cloudSync.onPageLoad()
                    .then(() => this.cloudSync.syncRequirementsOnLoad())
                    .catch(e => Logger.warn('CloudSync error:', e));
                this._syncPrefs();
                if (this.oauth.isJoined()) this.leaderboard.startSync();
                this._updateLoginUI();
            }
            
            // 初始化事件监听器
            _initEventListeners() {
                // 窗口大小变化
                this._resizeHandler = Utils.debounce(() => this._onResize(), 250);
                window.addEventListener('resize', this._resizeHandler);
                
                // 订阅 Token 过期事件
                EventBus.on('auth:expired', () => {
                    this.renderer?.showToast('⚠️ 登录已过期，请重新登录');
                    this._updateLoginUI();
                });
                
                // 订阅阅读数据同步完成事件
                EventBus.on('reading:synced', ({ merged, source }) => {
                    Logger.log(`阅读数据已同步: ${merged} 天, 来源: ${source}`);
                    // 更新本地阅读时间变量
                    this.readingTime = this.tracker.getTodayTime();
                    // 清除年度缓存
                    this.tracker._yearCache = null;
                    // 检查当前是否在趋势页面（通过 DOM 查询）
                    const trendsActive = this.el?.querySelector('.ldsp-tab[data-tab="trends"].active');
                    if (trendsActive) {
                        // 使用缓存的历史和要求数据重新渲染趋势页面
                        this._renderTrends(this.cachedHistory || [], this.cachedReqs || []);
                    }
                    // 更新顶部阅读时间显示
                    this.renderer.renderReading(this.readingTime, this.tracker.isActive);
                    // 数据同步完成后触发工单未读检测
                    this.ticketManager?._checkUnread();
                });
            }
            
            // 初始化定时任务
            _initTimers() {
                // 定期刷新数据（只有领导者标签页执行）
                this._refreshTimer = setInterval(() => {
                    if (!this._destroyed && TabLeader.isLeader()) {
                        this.fetch();
                    }
                }, CONFIG.INTERVALS.REFRESH);
                
                // 延迟检查版本更新
                setTimeout(() => !this._destroyed && this._checkUpdate(true), 2000);
                
                // 延迟加载系统公告
                setTimeout(() => !this._destroyed && this._loadAnnouncement(), 1500);
            }

            _createPanel() {
                this.el = document.createElement('div');
                this.el.id = 'ldsp-panel';
                this.el.setAttribute('role', 'complementary');
                this.el.setAttribute('aria-label', `${CURRENT_SITE.name} 信任级别面板`);

                this.el.innerHTML = `
                    <div class="ldsp-hdr">
                        <div class="ldsp-hdr-info">
                            <div class="ldsp-site-wrap">
                                <img class="ldsp-site-icon" src="${CURRENT_SITE.icon}" alt="${CURRENT_SITE.name}">
                                <span class="ldsp-site-ver">v${GM_info.script.version}</span>
                            </div>
                            <div class="ldsp-hdr-text">
                                <span class="ldsp-title">${CURRENT_SITE.name}</span>
                                <span class="ldsp-ver"><span class="ldsp-app-name">LDStatus Pro</span></span>
                            </div>
                        </div>
                        <div class="ldsp-hdr-btns">
                            <button class="ldsp-update" title="检查更新" aria-label="检查更新">🔍</button>
                            <button class="ldsp-cloud-sync" title="云同步" aria-label="云同步" style="display:none">☁️</button>
                            <button class="ldsp-refresh" title="刷新数据" aria-label="刷新数据">🔄</button>
                            <button class="ldsp-theme" title="切换主题" aria-label="切换主题">🌓</button>
                            <button class="ldsp-toggle" title="折叠面板" aria-label="折叠面板"><span class="ldsp-toggle-arrow">◀</span><svg class="ldsp-toggle-logo" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ldsp-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8fa8f8"/><stop offset="100%" stop-color="#7ed4c4"/></linearGradient></defs><path d="M 31,4 A 28,28 0 1,1 11,52" fill="none" stroke="url(#ldsp-logo-grad)" stroke-width="8" stroke-linecap="round"/><rect x="25" y="26" width="12" height="12" rx="3" fill="url(#ldsp-logo-grad)" transform="rotate(45 31 32)"/></svg></button>
                        </div>
                    </div>
                    <div class="ldsp-update-bubble" style="display:none">
                        <div class="ldsp-update-bubble-close">×</div>
                        <div class="ldsp-update-bubble-icon">🎉</div>
                        <div class="ldsp-update-bubble-title">发现新版本</div>
                        <div class="ldsp-update-bubble-ver"></div>
                        <button class="ldsp-update-bubble-btn">🚀 立即更新</button>
                    </div>
                    <div class="ldsp-body">
                        <div class="ldsp-announcement">
                            <div class="ldsp-announcement-inner">
                                <span class="ldsp-announcement-text"></span>
                            </div>
                        </div>
                        <div class="ldsp-user">
                            <div class="ldsp-user-left">
                                <div class="ldsp-user-row">
                                    <div class="ldsp-avatar-wrap" data-clickable><div class="ldsp-avatar-ph">👤</div></div>
                                    <div class="ldsp-user-info">
                                        <div class="ldsp-user-display-name">加载中...</div>
                                        <div class="ldsp-user-handle"></div>
                                    </div>
                                </div>
                                <div class="ldsp-user-meta">
                                    <div class="ldsp-follow-combined">
                                        <span class="ldsp-follow-part ldsp-follow-following" data-clickable data-tab="following" title="查看关注列表">关注 <span class="ldsp-follow-num-following">-</span></span>
                                        <span class="ldsp-follow-sep">·</span>
                                        <span class="ldsp-follow-part ldsp-follow-followers" data-clickable data-tab="followers" title="查看粉丝列表"><span class="ldsp-follow-num-followers">-</span> 粉丝</span>
                                    </div>
                                    <span class="ldsp-join-days">来<span class="ldsp-join-days-site"></span><span class="ldsp-join-days-num">-</span>天</span>
                                </div>
                                <div class="ldsp-user-actions">
                                    <div class="ldsp-action-btn ldsp-login-btn" data-clickable title="点击登录"><span class="ldsp-action-icon">🔑</span><span class="ldsp-action-text">点击登录</span></div>
                                    <div class="ldsp-action-btn ldsp-logout-btn" data-clickable title="注销登录"><span class="ldsp-action-icon">⏻</span><span class="ldsp-action-text">注销</span></div>
                                    <div class="ldsp-action-btn ldsp-ticket-btn" data-clickable title="工单系统"><span class="ldsp-action-icon">📪</span><span class="ldsp-action-text">工单</span></div>
                                    <div class="ldsp-action-btn ldsp-melon-btn" data-clickable title="AI 帖子总结"><span class="ldsp-action-icon">🍉</span><span class="ldsp-action-text">总结</span></div>
                                </div>
                            </div>
                            <div class="ldsp-reading" data-clickable title="点击访问 LDStatus Pro 官网">
                                <div class="ldsp-reading-ripple"></div>
                                <span class="ldsp-reading-icon">🌱</span>
                                <span class="ldsp-reading-time">--</span>
                                <span class="ldsp-reading-label">今日阅读</span>
                            </div>
                        </div>
                        <div class="ldsp-tabs">
                            <button class="ldsp-tab active" data-tab="reqs"><span class="ldsp-tab-icon">📋</span><span class="ldsp-tab-text">要求</span></button>
                            <button class="ldsp-tab" data-tab="trends"><span class="ldsp-tab-icon">📈</span><span class="ldsp-tab-text">趋势</span></button>
                            ${this.hasLeaderboard ? '<button class="ldsp-tab" data-tab="leaderboard"><span class="ldsp-tab-icon">🏆</span><span class="ldsp-tab-text">排行</span></button>' : ''}
                            <button class="ldsp-tab" data-tab="activity"><span class="ldsp-tab-icon">👤</span><span class="ldsp-tab-text">我的</span></button>
                        </div>
                        <div class="ldsp-content">
                            <div id="ldsp-reqs" class="ldsp-section active"><div class="ldsp-loading"><div class="ldsp-spinner"></div><div>加载中...</div></div></div>
                            <div id="ldsp-trends" class="ldsp-section"><div class="ldsp-empty"><div class="ldsp-empty-icon">📊</div><div class="ldsp-empty-txt">暂无历史数据</div></div></div>
                            ${this.hasLeaderboard ? '<div id="ldsp-leaderboard" class="ldsp-section"><div class="ldsp-loading"><div class="ldsp-spinner"></div><div>加载中...</div></div></div>' : ''}
                            <div id="ldsp-activity" class="ldsp-section"><div class="ldsp-empty"><div class="ldsp-empty-icon">👤</div><div class="ldsp-empty-txt">选择一个分类查看</div></div></div>
                        </div>
                        <div class="ldsp-confirm-overlay">
                            <div class="ldsp-confirm-box">
                                <div class="ldsp-confirm-icon">⏻</div>
                                <div class="ldsp-confirm-title">确认注销登录吗？</div>
                                <div class="ldsp-confirm-msg">退出后排行榜和云同步功能将不可用</div>
                                <div class="ldsp-confirm-btns">
                                    <button class="ldsp-confirm-btn cancel">取消</button>
                                    <button class="ldsp-confirm-btn confirm">确认注销</button>
                                </div>
                            </div>
                        </div>
                    </div>`;

                document.body.appendChild(this.el);
                
                // 绑定自定义 Tooltip
                Tooltip.bindToPanel(this.el);

                this.$ = {
                    header: this.el.querySelector('.ldsp-hdr'),
                    announcement: this.el.querySelector('.ldsp-announcement'),
                    announcementText: this.el.querySelector('.ldsp-announcement-text'),
                    user: this.el.querySelector('.ldsp-user'),
                    userDisplayName: this.el.querySelector('.ldsp-user-display-name'),
                    userHandle: this.el.querySelector('.ldsp-user-handle'),
                    ticketBtn: this.el.querySelector('.ldsp-ticket-btn'),
                    melonBtn: this.el.querySelector('.ldsp-melon-btn'),
                    logoutBtn: this.el.querySelector('.ldsp-logout-btn'),
                    loginBtn: this.el.querySelector('.ldsp-login-btn'),
                    confirmOverlay: this.el.querySelector('.ldsp-confirm-overlay'),
                    confirmCancel: this.el.querySelector('.ldsp-confirm-btn.cancel'),
                    confirmOk: this.el.querySelector('.ldsp-confirm-btn.confirm'),
                    panelBody: this.el.querySelector('.ldsp-body'),
                    reading: this.el.querySelector('.ldsp-reading'),
                    readingIcon: this.el.querySelector('.ldsp-reading-icon'),
                    readingTime: this.el.querySelector('.ldsp-reading-time'),
                    readingLabel: this.el.querySelector('.ldsp-reading-label'),
                    tabs: this.el.querySelectorAll('.ldsp-tab'),
                    sections: this.el.querySelectorAll('.ldsp-section'),
                    reqs: this.el.querySelector('#ldsp-reqs'),
                    trends: this.el.querySelector('#ldsp-trends'),
                    leaderboard: this.el.querySelector('#ldsp-leaderboard'),
                    activity: this.el.querySelector('#ldsp-activity'),
                    btnToggle: this.el.querySelector('.ldsp-toggle'),
                    btnRefresh: this.el.querySelector('.ldsp-refresh'),
                    btnTheme: this.el.querySelector('.ldsp-theme'),
                    btnUpdate: this.el.querySelector('.ldsp-update'),
                    btnCloudSync: this.el.querySelector('.ldsp-cloud-sync'),
                    updateBubble: this.el.querySelector('.ldsp-update-bubble'),
                    updateBubbleVer: this.el.querySelector('.ldsp-update-bubble-ver'),
                    updateBubbleBtn: this.el.querySelector('.ldsp-update-bubble-btn'),
                    updateBubbleClose: this.el.querySelector('.ldsp-update-bubble-close')
                };
            }

            _bindEvents() {
                // 拖拽（支持鼠标和触摸）
                let dragging = false, ox, oy, moved = false, sx, sy;
                const THRESHOLD = 5;

                const getPos = e => e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };

                const startDrag = e => {
                    if (!this.el.classList.contains('collapsed') && e.target.closest('button')) return;
                    const p = getPos(e);
                    dragging = true;
                    moved = false;
                    // 使用 left/top 进行拖拽计算
                    this.el.style.right = 'auto';
                    this.el.style.left = this.el.offsetLeft + 'px';
                    ox = p.x - this.el.offsetLeft;
                    oy = p.y - this.el.offsetTop;
                    sx = p.x;
                    sy = p.y;
                    this.el.classList.add('no-trans');
                    e.preventDefault();
                };

                const updateDrag = e => {
                    if (!dragging) return;
                    const p = getPos(e);
                    if (Math.abs(p.x - sx) > THRESHOLD || Math.abs(p.y - sy) > THRESHOLD) moved = true;
                    this.el.style.left = Math.max(0, Math.min(p.x - ox, innerWidth - this.el.offsetWidth)) + 'px';
                    this.el.style.top = Math.max(0, Math.min(p.y - oy, innerHeight - this.el.offsetHeight)) + 'px';
                };

                const endDrag = () => {
                    if (!dragging) return;
                    dragging = false;
                    this.el.classList.remove('no-trans');
                    this.storage.setGlobalNow('position', { left: this.el.style.left, top: this.el.style.top });
                    this._updateExpandDir();
                };

                // 鼠标事件
                this.$.header.addEventListener('mousedown', e => !this.el.classList.contains('collapsed') && startDrag(e));
                this.el.addEventListener('mousedown', e => this.el.classList.contains('collapsed') && startDrag(e));
                document.addEventListener('mousemove', updateDrag);
                document.addEventListener('mouseup', endDrag);
                // 触摸事件（移动端拖拽）
                this.$.header.addEventListener('touchstart', e => !this.el.classList.contains('collapsed') && startDrag(e), { passive: false });
                this.el.addEventListener('touchstart', e => this.el.classList.contains('collapsed') && startDrag(e), { passive: false });
                document.addEventListener('touchmove', updateDrag, { passive: false });
                document.addEventListener('touchend', e => {
                    const wasDragging = dragging;
                    const isCollapsed = this.el.classList.contains('collapsed');
                    endDrag();
                    // 触摸未移动且是折叠状态，视为点击展开
                    if (wasDragging && !moved && isCollapsed) {
                        this._toggle();
                    }
                    // 移动端：清除折叠 logo 的 hover 残留效果
                    if (isCollapsed && wasDragging) {
                        this.el.classList.add('no-hover-effect');
                        setTimeout(() => this.el.classList.remove('no-hover-effect'), 50);
                    }
                });

                // 按钮事件
                this.$.btnToggle.addEventListener('click', e => {
                    e.stopPropagation();
                    if (moved) { moved = false; return; }
                    this._toggle();
                });

                this.$.btnRefresh.addEventListener('click', () => {
                    if (this.loading) return;
                    this.animRing = true;
                    this.fetch();
                    // 刷新数据时同步检查未读工单
                    this.ticketManager?._checkUnread();
                });

                this.$.btnTheme.addEventListener('click', () => this._switchTheme());
                this.$.btnUpdate.addEventListener('click', () => this._checkUpdate());
                
                // 彩蛋：点击头像打开GitHub仓库
                this.$.user.addEventListener('click', e => {
                    if (e.target.closest('.ldsp-avatar-wrap')) {
                        window.open('https://github.com/caigg188/LDStatusPro', '_blank');
                    }
                });
                
                // 注销登录按钮与确认弹窗
                const showLogoutConfirm = () => {
                    if (!this.hasLeaderboard || !this.oauth?.isLoggedIn()) {
                        this.renderer.showToast('ℹ️ 当前未登录');
                        return;
                    }
                    this.$.confirmOverlay?.classList.add('show');
                };
                const hideLogoutConfirm = () => {
                    this.$.confirmOverlay?.classList.remove('show');
                };
                const doLogout = () => {
                    hideLogoutConfirm();
                    this.oauth.logout();
                    this.leaderboard?.stopSync();
                    this.renderer.showToast('✅ 已退出登录');
                    this._updateLoginUI();
                    this._renderLeaderboard();
                };
                // 注销按钮点击
                this.$.logoutBtn?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showLogoutConfirm();
                });
                // 确认弹窗按钮
                this.$.confirmCancel?.addEventListener('click', hideLogoutConfirm);
                this.$.confirmOk?.addEventListener('click', doLogout);
                // 点击遮罩关闭
                this.$.confirmOverlay?.addEventListener('click', (e) => {
                    if (e.target === this.$.confirmOverlay) hideLogoutConfirm();
                });
                
                // 云同步按钮（状态由 CloudSyncManager 的回调自动管理）
                this.$.btnCloudSync?.addEventListener('click', async () => {
                    if (!this.hasLeaderboard || !this.oauth?.isLoggedIn()) return;
                    if (this.cloudSync.isSyncing()) return;  // 正在同步中，忽略点击
                    try {
                        await this.cloudSync.fullSync();
                        this.renderer.showToast('✅ 数据同步完成');
                        this.renderer.renderReading(this.tracker.getTodayTime(), this.tracker.isActive);
                        // 显示成功状态
                        if (this.$.btnCloudSync) {
                            this.$.btnCloudSync.textContent = '✅';
                            setTimeout(() => {
                                if (this.$.btnCloudSync) this.$.btnCloudSync.textContent = '☁️';
                            }, 1000);
                        }
                    } catch (e) {
                        this.renderer.showToast(`❌ 同步失败: ${e.message || e}`);
                        // 显示失败状态
                        if (this.$.btnCloudSync) {
                            this.$.btnCloudSync.textContent = '❌';
                            setTimeout(() => {
                                if (this.$.btnCloudSync) this.$.btnCloudSync.textContent = '☁️';
                            }, 10000);
                        }
                    }
                });

                // 工单按钮
                this.$.ticketBtn?.addEventListener('click', e => {
                    e.stopPropagation();
                    if (!this.hasLeaderboard || !this.oauth?.isLoggedIn()) {
                        this.renderer.showToast('⚠️ 请先登录后使用工单功能');
                        return;
                    }
                    if (this.ticketManager) {
                        this.ticketManager.show();
                    }
                });

                // 吃瓜助手按钮
                this.$.melonBtn?.addEventListener('click', e => {
                    e.stopPropagation();
                    if (this.melonHelper) {
                        this.melonHelper.show();
                    }
                });
                
                // 关注/粉丝分别点击
                this.el.querySelectorAll('.ldsp-follow-part').forEach(part => {
                    part.addEventListener('click', e => {
                        e.stopPropagation();
                        const username = this.storage.getUser();
                        if (!username) {
                            this.renderer.showToast('⚠️ 请先登录论坛');
                            return;
                        }
                        if (this.followManager) {
                            // 根据点击的区域打开对应列表
                            const tabName = part.dataset.tab || 'following';
                            const tabs = this.followManager.overlay.querySelectorAll('.ldsp-follow-tab');
                            tabs.forEach(t => t.classList.remove('active'));
                            const targetTab = this.followManager.overlay.querySelector(`.ldsp-follow-tab[data-tab="${tabName}"]`);
                            targetTab?.classList.add('active');
                            this.followManager.show();
                        }
                    });
                });
                
                // 兼容旧样式的关注/粉丝统计点击
                this.el.querySelectorAll('.ldsp-follow-stat').forEach(stat => {
                    stat.addEventListener('click', e => {
                        e.stopPropagation();
                        const username = this.storage.getUser();
                        if (!username) {
                            this.renderer.showToast('⚠️ 请先登录论坛');
                            return;
                        }
                        if (this.followManager) {
                            // 设置激活的tab
                            const isFollowing = stat.classList.contains('ldsp-follow-stat-following');
                            const tabs = this.followManager.overlay.querySelectorAll('.ldsp-follow-tab');
                            tabs.forEach(t => t.classList.remove('active'));
                            const targetTab = this.followManager.overlay.querySelector(`.ldsp-follow-tab[data-tab="${isFollowing ? 'following' : 'followers'}"]`);
                            targetTab?.classList.add('active');
                            this.followManager.show();
                        }
                    });
                });
                
                // 阅读卡片点击彩蛋 - 跳转到官网（动态URL）
                this.$.reading?.addEventListener('click', async e => {
                    e.stopPropagation();
                    const url = await this.cloudSync?.getWebsiteUrl() || 'https://ldspro.qzz.io/';
                    window.open(url, '_blank');
                });

                // 标签页切换
                this.$.tabs.forEach((tab, i) => {
                    tab.addEventListener('click', () => {
                        this.$.tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
                        this.$.sections.forEach(s => s.classList.remove('active'));
                        tab.classList.add('active');
                        tab.setAttribute('aria-selected', 'true');
                        this.el.querySelector(`#ldsp-${tab.dataset.tab}`).classList.add('active');

                        if (tab.dataset.tab === 'reqs') {
                            this.animRing = true;
                            this.cachedReqs.length && this.renderer.renderReqs(this.cachedReqs);
                        } else if (tab.dataset.tab === 'leaderboard') {
                            this._renderLeaderboard();
                        } else if (tab.dataset.tab === 'activity') {
                            this._renderActivity();
                        }
                    });

                    tab.addEventListener('keydown', e => {
                        if (['ArrowRight', 'ArrowLeft'].includes(e.key)) {
                            e.preventDefault();
                            const next = e.key === 'ArrowRight' ? (i + 1) % this.$.tabs.length : (i - 1 + this.$.tabs.length) % this.$.tabs.length;
                            this.$.tabs[next].click();
                            this.$.tabs[next].focus();
                        }
                    });
                });
                
                // 监听 Token 过期事件，刷新 UI
                window.addEventListener('ldsp_token_expired', () => {
                    this.renderer.showToast('⚠️ 登录已过期，请重新登录');
                    this._renderLeaderboard();
                });
                
                // 滚动条自动隐藏：滚动时显示，停止后隐藏
                this._initScrollbarAutoHide();
            }
            
            _initScrollbarAutoHide() {
                // 使用闭包存储状态，避免污染实例属性
                const timers = new WeakMap();
                const showScrollbar = (el) => {
                    if (this._programmaticScroll) return; // 忽略程序性滚动
                    el.classList.add('scrolling');
                    clearTimeout(timers.get(el));
                    timers.set(el, setTimeout(() => el.classList.remove('scrolling'), 800));
                };
                // 事件委托：捕获所有可滚动元素的滚动事件
                this.el.addEventListener('scroll', (e) => {
                    const t = e.target;
                    if (t.classList.contains('ldsp-content') || 
                        t.classList.contains('ldsp-subtabs') || 
                        t.classList.contains('ldsp-year-heatmap')) {
                        showScrollbar(t);
                    }
                }, { capture: true, passive: true });
            }
            
            // 程序性滚动（不显示滚动条）
            _scrollTo(el, top) {
                this._programmaticScroll = true;
                el.scrollTop = top;
                requestAnimationFrame(() => { this._programmaticScroll = false; });
            }

            _restore() {
                const pos = this.storage.getGlobal('position');
                if (pos) { 
                    this.el.style.right = 'auto'; // 拖拽后使用 left
                    this.el.style.left = pos.left; 
                    this.el.style.top = pos.top; 
                }

                if (this.storage.getGlobal('collapsed', false)) {
                    this.el.classList.add('collapsed');
                    const arrow = this.$.btnToggle.querySelector('.ldsp-toggle-arrow');
                    if (arrow) arrow.textContent = '▶';
                }

                const theme = this.storage.getGlobal('theme', 'light');
                if (theme === 'light') this.el.classList.add('light');
                this.$.btnTheme.textContent = theme === 'dark' ? '🌓' : '☀️';

                requestAnimationFrame(() => this._updateExpandDir());
            }

            _updateExpandDir() {
                const rect = this.el.getBoundingClientRect();
                const center = rect.left + rect.width / 2;
                this.el.classList.toggle('expand-left', center > innerWidth / 2);
                this.el.classList.toggle('expand-right', center <= innerWidth / 2);
            }

            _onResize() {
                const cfg = Screen.getConfig();
                ['width', 'maxHeight', 'fontSize', 'padding', 'avatarSize', 'ringSize'].forEach((k, i) => {
                    const props = ['--w', '--h', '--fs', '--pd', '--av', '--ring'];
                    this.el.style.setProperty(props[i], `${cfg[k]}px`);
                });
                
                // 检查面板是否超出视口边界，如果超出则调整位置
                this._clampPosition();
                this._updateExpandDir();
            }
            
            // 确保面板位置在视口内
            _clampPosition() {
                const rect = this.el.getBoundingClientRect();
                const margin = 8; // 最小边距
                let needUpdate = false;
                
                // 检查右边界
                if (rect.right > innerWidth - margin) {
                    this.el.style.left = Math.max(margin, innerWidth - rect.width - margin) + 'px';
                    this.el.style.right = 'auto';
                    needUpdate = true;
                }
                // 检查左边界
                if (rect.left < margin) {
                    this.el.style.left = margin + 'px';
                    this.el.style.right = 'auto';
                    needUpdate = true;
                }
                // 检查下边界
                if (rect.bottom > innerHeight - margin) {
                    this.el.style.top = Math.max(margin, innerHeight - rect.height - margin) + 'px';
                    needUpdate = true;
                }
                // 检查上边界
                if (rect.top < margin) {
                    this.el.style.top = margin + 'px';
                    needUpdate = true;
                }
                
                // 如果位置有调整，保存新位置
                if (needUpdate) {
                    this.storage.setGlobalNow('position', { left: this.el.style.left, top: this.el.style.top });
                }
            }

            _toggle() {
                const collapsing = !this.el.classList.contains('collapsed');
                const rect = this.el.getBoundingClientRect();
                const cfg = Screen.getConfig();

                this.el.classList.add('anim');

                if (collapsing) {
                    if (this.el.classList.contains('expand-left')) this.el.style.left = (rect.right - 44) + 'px';
                    const arrow = this.$.btnToggle.querySelector('.ldsp-toggle-arrow');
                    if (arrow) arrow.textContent = '▶';
                } else {
                    this._updateExpandDir();
                    if (this.el.classList.contains('expand-left')) this.el.style.left = Math.max(0, rect.left - (cfg.width - 44)) + 'px';
                    const arrow = this.$.btnToggle.querySelector('.ldsp-toggle-arrow');
                    if (arrow) arrow.textContent = '◀';
                    this.animRing = true;
                    this.cachedReqs.length && setTimeout(() => this.renderer.renderReqs(this.cachedReqs), 100);
                }

                this.el.classList.toggle('collapsed');
                this.storage.setGlobalNow('collapsed', collapsing);

                setTimeout(() => {
                    this.el.classList.remove('anim');
                    this.storage.setGlobalNow('position', { left: this.el.style.left, top: this.el.style.top });
                }, 400);
            }

            _switchTheme() {
                const light = this.el.classList.toggle('light');
                this.$.btnTheme.textContent = light ? '☀️' : '🌓';
                this.storage.setGlobalNow('theme', light ? 'light' : 'dark');
            }

            // 从缓存加载头像（优先动态头像）
            _loadAvatarFromCache() {
                // 1. 优先使用缓存的动态头像
                if (this.followManager?.animatedAvatar) {
                    this.renderer.renderAvatar(this.followManager.animatedAvatar);
                    return;
                }
                // 2. 其次使用缓存的普通头像
                if (this.avatar) {
                    this.renderer.renderAvatar(this.avatar);
                    return;
                }
                // 3. 都没有则尝试从页面获取
                const el = document.querySelector('.current-user img.avatar');
                if (el) {
                    this._updateAvatar(el.src);
                }
            }

            // 更新普通头像（从页面获取时调用）
            _updateAvatar(url) {
                if (!url) return;
                if (url.startsWith('/')) url = `https://${CURRENT_SITE.domain}${url}`;
                url = url.replace(PATTERNS.AVATAR_SIZE, '/128/');
                // 只有头像变化时才更新
                if (this.avatar === url) return;
                this.avatar = url;
                this.storage.set('userAvatar', url);
                // 只有在没有动态头像时才渲染普通头像
                if (!this.followManager?.animatedAvatar) {
                    this.renderer.renderAvatar(url);
                }
            }

            _startReadingUpdate() {
                if (this._readingTimer) return;
                this._readingTimer = setInterval(() => {
                    this.readingTime = this.tracker.getTodayTime();
                    this.renderer.renderReading(this.readingTime, this.tracker.isActive);
                }, CONFIG.INTERVALS.READING_UPDATE);
            }

            _setLoading(v) {
                this.loading = v;
                this.$.btnRefresh.disabled = v;
                this.$.btnRefresh.style.animation = v ? 'spin 1s linear infinite' : '';
            }

            async fetch() {
                if (this.loading) return;
                this._setLoading(true);
                this.$.reqs.innerHTML = `<div class="ldsp-loading"><div class="ldsp-spinner"></div><div>加载中...</div></div>`;

                try {
                    const url = CURRENT_SITE.apiUrl;
                    
                    // 使用 network.fetch（包含 GM_xmlhttpRequest 绕过跨域，以及 fallback）
                    const html = await this.network.fetch(url);
                    
                    if (!html) {
                        throw new Error('无法获取数据');
                    }
                    
                    await this._parse(html);
                } catch (e) {
                    this._showError(e.message || '网络错误');
                } finally {
                    this._setLoading(false);
                }
            }

            _showError(msg) {
                this.$.reqs.innerHTML = `<div class="ldsp-empty"><div class="ldsp-empty-icon">❌</div><div class="ldsp-empty-txt">${msg}</div></div>`;
            }

            // 更新信任等级到服务端和本地缓存
            async _updateTrustLevel(connectLevel) {
                // 同时检查 oauth 和 cloudSync.oauth 的登录状态
                if (!this.oauth?.isLoggedIn() || !this.cloudSync?.oauth?.isLoggedIn()) return;
                
                const userInfo = this.oauth.getUserInfo();
                // v3.4.7: 兼容 trust_level 和 trustLevel 两种命名格式
                const currentLevel = userInfo?.trust_level ?? userInfo?.trustLevel;
                
                // 只有当等级变化时才更新
                if (currentLevel === connectLevel) return;
                
                try {
                    // 更新服务端（使用统一的 oauth 实例）
                    const result = await this.oauth.api('/api/user/trust-level', {
                        method: 'POST',
                        body: { trust_level: connectLevel }
                    });
                    
                    if (result?.success) {
                        // 更新本地缓存
                        const updatedUserInfo = { ...userInfo, trust_level: connectLevel };
                        this.oauth.setUserInfo(updatedUserInfo);
                    }
                } catch (e) { /* 同步失败，忽略 */ }
            }

            // 当没有升级要求表格时显示备选内容
            // 优先级：1. 服务端同步的数据 2. summary API 数据
            async _showFallbackStats(username, level) {
                const $ = this.$;
                
                // 优先从 OAuth 获取用户信息（更可靠，尤其在移动端）
                let effectiveUsername = username;
                let numLevel = parseInt(level) || 0;
                
                if (this.oauth?.isLoggedIn()) {
                    const oauthUser = this.oauth.getUserInfo();
                    // 优先使用 OAuth 中的用户名
                    if (oauthUser?.username) {
                        effectiveUsername = oauthUser.username;
                    }
                    // 优先使用 OAuth 中的信任等级
                    const oauthTrustLevel = oauthUser?.trust_level ?? oauthUser?.trustLevel;
                    if (typeof oauthTrustLevel === 'number') {
                        numLevel = oauthTrustLevel;
                    }
                }
                
                // 确保阅读追踪器已初始化（_showFallbackStats 可能在 tracker.init 之前被调用）
                if (effectiveUsername && effectiveUsername !== '未知') {
                    if (!this.username) {
                        this.storage.setUser(effectiveUsername);
                        this.username = effectiveUsername;
                    }
                    this.tracker.init(effectiveUsername);
                    this._startReadingUpdate();
                    this.readingTime = this.tracker.getTodayTime();
                    this.renderer.renderReading(this.readingTime, this.tracker.isActive);
                } else {
                    // 即使没有用户名，也初始化匿名模式追踪
                    this.tracker.init('anonymous');
                    this._startReadingUpdate();
                }
                
                // 显示用户信息
                if (effectiveUsername && effectiveUsername !== '未知') {
                    $.userDisplayName.textContent = effectiveUsername;
                    $.userHandle.textContent = '';
                    $.userHandle.style.display = 'none';
                }
                
                // === 方案1：优先从服务端获取已同步的升级要求数据 ===
                // 这些数据是桌面端解析 connect 页面后上传的，最完整准确
                if (this.oauth?.isLoggedIn() && this.cloudSync) {
                    this.$.reqs.innerHTML = `<div class="ldsp-loading"><div class="ldsp-spinner"></div><div>正在获取云端数据...</div></div>`;
                    try {
                        const cloudData = await this._fetchCloudRequirements();
                        if (cloudData && cloudData.length > 0) {
                            return this._renderCloudRequirements(cloudData, effectiveUsername, numLevel);
                        }
                    } catch (e) { /* 云端获取失败，继续尝试 summary */ }
                }
                
                // === 方案2：从 summary API 获取统计数据 ===
                if (effectiveUsername && effectiveUsername !== '未知') {
                    this.$.reqs.innerHTML = `<div class="ldsp-loading"><div class="ldsp-spinner"></div><div>正在获取统计数据...</div></div>`;
                    const summaryData = await this._fetchSummaryData(effectiveUsername);
                    if (summaryData && Object.keys(summaryData).length > 0) {
                        return this._renderSummaryData(summaryData, effectiveUsername, numLevel);
                    }
                }
                
                // 如果无法获取 summary 数据，显示简要信息
                this.$.reqs.innerHTML = `
                    <div class="ldsp-empty">
                        <div class="ldsp-empty-icon">📊</div>
                        <div class="ldsp-empty-txt">
                            <div style="margin-bottom:8px;">当前信任等级：<b style="color:#5a7de0;">${numLevel}</b></div>
                            <div style="font-size:12px;color:#6b7280;">暂无升级进度数据</div>
                            <div style="margin-top:10px;font-size:11px;color:#9ca3af;">
                                <a href="https://linux.do/t/topic/2460" target="_blank" style="color:#5a7de0;text-decoration:none;">📖 查看完整信任等级说明</a>
                            </div>
                        </div>
                    </div>`;
                
                // 初始化 todayData（用于今日趋势显示）
                const todayData = this._getTodayData();
                if (!todayData) {
                    this._setTodayData({}, true);
                }
                
                // 低信任等级用户也可以查看阅读时间趋势
                const history = this.historyMgr.getHistory();
                this.cachedHistory = history;
                this.cachedReqs = []; // 空的升级要求数组
                this._renderTrends(history, []);
            }

            /**
             * 从服务端获取最近同步的升级要求数据
             * @returns {Array|null} - 升级要求数组或 null
             */
            async _fetchCloudRequirements() {
                // 前置登录检查，避免无效请求
                if (!this.cloudSync?.oauth?.isLoggedIn()) return null;
                
                try {
                    // 获取最近一天的历史数据
                    const result = await this.cloudSync.oauth.api('/api/requirements/history?days=1');
                    if (!result?.success || !result.data?.history?.length) {
                        return null;
                    }
                    
                    // 取最新的一条记录
                    const latestRecord = result.data.history[result.data.history.length - 1];
                    if (!latestRecord?.data) return null;
                    
                    // 转换为升级要求数组格式
                    const reqs = [];
                    for (const [name, value] of Object.entries(latestRecord.data)) {
                        if (name === '阅读时间(分钟)') continue; // 跳过阅读时间
                        reqs.push({
                            name,
                            currentValue: value,
                            requiredValue: 0, // 从配置获取
                            isSuccess: false,
                            change: 0,
                            isReverse: /举报|禁言|封禁/.test(name)
                        });
                    }
                    
                    return reqs.length > 0 ? reqs : null;
                } catch (e) {
                    return null;
                }
            }

            /**
             * 渲染从云端获取的升级要求数据
             * @param {Array} cloudReqs - 云端数据数组
             * @param {string} username - 用户名
             * @param {number} level - 信任等级
             */
            _renderCloudRequirements(cloudReqs, username, level) {
                // 2-4级用户的升级/保持要求配置（基于 connect 页面的 14 项要求）
                const LEVEL_2_PLUS_REQUIREMENTS = {
                    '访问次数': 50,           // 50%
                    '回复的话题': 10,
                    '浏览的话题': 500,
                    '浏览的话题（所有时间）': 200,
                    '已读帖子': 20000,
                    '已读帖子（所有时间）': 500,
                    '被举报的帖子': 5,         // 最多5个（反向）
                    '发起举报的用户': 5,       // 最多5个（反向）
                    '点赞': 30,
                    '获赞': 20,
                    '获赞：单日最高数量': 7,
                    '获赞：点赞用户数量': 5,
                    '被禁言（过去 6 个月）': 0, // 必须为0（反向）
                    '被封禁（过去 6 个月）': 0  // 必须为0（反向）
                };
                
                // 为云端数据填充要求值
                const reqs = cloudReqs.map(req => {
                    const requiredValue = LEVEL_2_PLUS_REQUIREMENTS[req.name] ?? 0;
                    const isReverse = /举报|禁言|封禁/.test(req.name);
                    const isSuccess = isReverse 
                        ? req.currentValue <= requiredValue 
                        : req.currentValue >= requiredValue;
                    
                    return {
                        ...req,
                        requiredValue,
                        isSuccess,
                        isReverse
                    };
                });
                
                // 按照配置顺序排序
                const orderedNames = Object.keys(LEVEL_2_PLUS_REQUIREMENTS);
                const orderedReqs = reqs.sort((a, b) => {
                    const idxA = orderedNames.indexOf(a.name);
                    const idxB = orderedNames.indexOf(b.name);
                    if (idxA === -1 && idxB === -1) return 0;
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });
                
                // 检查是否达标
                const isOK = orderedReqs.every(r => r.isSuccess);
                
                // 保存历史数据
                const histData = {};
                orderedReqs.forEach(r => histData[r.name] = r.currentValue);
                const history = this.historyMgr.addHistory(histData, this.readingTime);
                
                // 保存今日数据
                const todayData = this._getTodayData();
                this._setTodayData(histData, !todayData);
                
                // 获取显示名称
                let displayName = null;
                if (this.hasLeaderboard && this.oauth?.isLoggedIn()) {
                    const oauthUser = this.oauth.getUserInfo();
                    if (oauthUser?.name && oauthUser.name !== oauthUser.username) {
                        displayName = oauthUser.name;
                    }
                }
                
                // 渲染
                this.renderer.renderUser(username, level.toString(), isOK, orderedReqs, displayName);
                this.renderer.renderReqs(orderedReqs, level);
                
                this.cachedHistory = history;
                this.cachedReqs = orderedReqs;
                
                this._renderTrends(history, orderedReqs);
                this._setLastVisit(histData);
                this.prevReqs = orderedReqs;
                
                return true;
            }
            
            /**
             * 从 summary.json API 获取用户统计数据 (使用 user_summary 字段)
             * @param {string} username - 用户名
             * @returns {Object|null} - 统计数据对象或null
             */
            async _fetchSummaryData(username) {
                try {
                    const baseUrl = `https://${CURRENT_SITE.domain}`;
                    const data = {};
                    
                    // 优先使用 summary.json API（Discourse 标准 API）的 user_summary 字段
                    const jsonUrl = `${baseUrl}/u/${encodeURIComponent(username)}/summary.json`;
                    
                    // 尝试多种方式获取数据，兼容不同的用户脚本管理器
                    let jsonText = null;
                    
                    // 方法1: 使用 GM_xmlhttpRequest
                    try {
                        jsonText = await this.network.fetch(jsonUrl, { maxRetries: 2, timeout: 10000 });
                    } catch (e) { /* GM fetch 失败 */ }
                    
                    // 方法2: 如果 GM 方式失败，尝试原生 fetch（同源请求更可靠）
                    if (!jsonText) {
                        try {
                            const response = await fetch(jsonUrl, { 
                                credentials: 'include',
                                headers: { 'Accept': 'application/json' }
                            });
                            if (response.ok) {
                                jsonText = await response.text();
                            }
                        } catch (e) { /* native fetch 失败 */ }
                    }
                    
                    if (jsonText) {
                        try {
                            const json = JSON.parse(jsonText);
                            
                            // 从 user_summary 字段提取统计数据
                            const stats = json?.user_summary;
                            if (stats) {
                                // 映射 Discourse API 字段到显示名称
                                if (stats.days_visited !== undefined) data['访问天数'] = stats.days_visited;
                                if (stats.topics_entered !== undefined) data['浏览话题'] = stats.topics_entered;
                                if (stats.posts_read_count !== undefined) data['已读帖子'] = stats.posts_read_count;
                                if (stats.likes_given !== undefined) data['送出赞'] = stats.likes_given;
                                if (stats.likes_received !== undefined) data['获赞'] = stats.likes_received;
                                if (stats.post_count !== undefined) data['回复'] = stats.post_count;
                                if (stats.topic_count !== undefined) data['创建话题'] = stats.topic_count;
                                // 额外有用的字段
                                if (stats.time_read !== undefined) data['阅读时间'] = Math.round(stats.time_read / 60); // 秒转分钟
                                
                                if (Object.keys(data).length > 0) {
                                    return data;
                                }
                            }
                        } catch (e) { /* JSON 解析失败 */ }
                    }
                    
                    // 方法B：回退到 HTML 解析
                    const url = `${baseUrl}/u/${encodeURIComponent(username)}/summary`;
                    let html = null;
                    
                    // 先尝试 GM_xmlhttpRequest
                    try {
                        html = await this.network.fetch(url, { maxRetries: 2 });
                    } catch (e) { /* GM fetch 失败 */ }
                    
                    // 备用：原生 fetch
                    if (!html) {
                        try {
                            const resp = await fetch(url, { credentials: 'include' });
                            if (resp.ok) {
                                html = await resp.text();
                            }
                        } catch (e) { /* native fetch 失败 */ }
                    }
                    
                    if (!html) {
                        return null;
                    }
                    
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    
                    // 辅助函数：解析数值（支持 k、m 等缩写和逗号分隔）
                    const parseValue = (text) => {
                        if (!text) return 0;
                        const cleaned = text.replace(/,/g, '').trim();
                        const match = cleaned.match(/([\d.]+)\s*([km万亿])?/i);
                        if (!match) return 0;
                        let value = parseFloat(match[1]);
                        const suffix = match[2]?.toLowerCase();
                        if (suffix === 'k' || suffix === '万') value *= 1000;
                        if (suffix === 'm' || suffix === '亿') value *= 1000000;
                        return Math.round(value);
                    };
                    
                    // 方法1：通过 class 名称查找统计项（Discourse 标准结构）
                    const statItems = doc.querySelectorAll('li[class*="stats-"], .stat-item, .user-stat');
                    statItems.forEach(item => {
                        const className = item.className || '';
                        const valueEl = item.querySelector('.value .number, .value, .stat-value');
                        if (!valueEl) return;
                        
                        // 优先从 title 获取完整数值
                        let value = 0;
                        const titleAttr = valueEl.getAttribute('title') || item.getAttribute('title');
                        if (titleAttr) {
                            value = parseValue(titleAttr);
                        } else {
                            value = parseValue(valueEl.textContent);
                        }
                        
                        // 根据 class 名称映射
                        if (className.includes('days-visited')) data['访问天数'] = value;
                        else if (className.includes('topics-entered')) data['浏览话题'] = value;
                        else if (className.includes('posts-read')) data['已读帖子'] = value;
                        else if (className.includes('likes-given')) data['送出赞'] = value;
                        else if (className.includes('likes-received')) data['获赞'] = value;
                        else if (className.includes('post-count')) data['回复'] = value;
                        else if (className.includes('topic-count')) data['创建话题'] = value;
                        else if (className.includes('solved-count')) data['解决方案'] = value;
                    });
                    
                    // 方法2：如果方法1没找到数据，尝试通过标签文本匹配
                    if (Object.keys(data).length === 0) {
                        // 查找所有可能包含统计数据的元素
                        const allStats = doc.querySelectorAll('.stats-section li, .top-section li, .user-summary-stat');
                        allStats.forEach(item => {
                            const text = item.textContent.trim();
                            const labelEl = item.querySelector('.label, .stat-label');
                            const valueEl = item.querySelector('.value, .number, .stat-value');
                            
                            if (!labelEl && !valueEl) return;
                            
                            const label = (labelEl?.textContent || '').toLowerCase().trim();
                            let value = 0;
                            
                            if (valueEl) {
                                const titleAttr = valueEl.getAttribute('title') || item.getAttribute('title');
                                value = parseValue(titleAttr || valueEl.textContent);
                            }
                            
                            // 根据标签文本匹配
                            if (label.includes('访问') || label.includes('visited') || text.includes('访问天数')) {
                                data['访问天数'] = value;
                            } else if (label.includes('浏览') && label.includes('话题') || label.includes('topics') || text.includes('浏览的话题')) {
                                data['浏览话题'] = value;
                            } else if (label.includes('已读') || label.includes('阅读') || label.includes('posts read') || text.includes('已读帖子')) {
                                data['已读帖子'] = value;
                            } else if (label.includes('送出') || label.includes('given') || text.includes('已送出')) {
                                data['送出赞'] = value;
                            } else if (label.includes('收到') || label.includes('received') || text.includes('已收到')) {
                                data['获赞'] = value;
                            } else if (label.includes('帖子') && !label.includes('已读') || label.includes('创建的帖子') || text.includes('创建的帖子')) {
                                data['回复'] = value;
                            } else if (label.includes('创建') && label.includes('话题') || text.includes('创建的话题')) {
                                data['创建话题'] = value;
                            }
                        });
                    }
                    
                    // 方法3：通用文本解析（作为最后手段）
                    if (Object.keys(data).length === 0) {
                        const statsText = doc.body?.textContent || '';
                        // 尝试匹配 "数字+标签" 的模式
                        const patterns = [
                            { regex: /([\d,.]+[km]?)\s*访问天数/i, key: '访问天数' },
                            { regex: /([\d,.]+[km]?)\s*浏览的?话题/i, key: '浏览话题' },
                            { regex: /([\d,.]+[km]?)\s*已读帖子/i, key: '已读帖子' },
                            { regex: /([\d,.]+[km]?)\s*已?送出/i, key: '送出赞' },
                            { regex: /([\d,.]+[km]?)\s*已?收到/i, key: '获赞' },
                            { regex: /([\d,.]+[km]?)\s*创建的帖子/i, key: '回复' }
                        ];
                        patterns.forEach(p => {
                            const match = statsText.match(p.regex);
                            if (match) data[p.key] = parseValue(match[1]);
                        });
                    }
                    
                    return Object.keys(data).length > 0 ? data : null;
                } catch (e) {
                    return null;
                }
            }
            
            /**
             * 渲染 summary 统计数据（低信任等级用户）
             * 使用与 2 级用户相同的 renderReqs 方法显示进度
             */
            _renderSummaryData(data, username, level) {
                // 构建要求数据结构（用于显示和趋势）
                const reqs = [];
                
                // 这是 connect 页面获取失败时的 fallback 方案
                // summary API 只能提供有限的累计统计数据（约8项）
                // 注意：summary API 返回的是累计总数，而 2→3 级升级要求是"过去100天"的数据
                // 因此这里的数据仅供参考，不能完全代表升级进度
                // 升级要求参考: https://linux.do/t/topic/2460
                let statsConfig;
                
                if (level === 0) {
                    // 0级升1级要求：
                    // - 进入5个话题、阅读30篇帖子、阅读10分钟
                    statsConfig = [
                        { key: '浏览话题', required: 5 },
                        { key: '已读帖子', required: 30 },
                        { key: '阅读时间', required: 10 }  // 10分钟
                    ];
                } else if (level === 1) {
                    // 1级升2级要求：
                    // - 访问15天、浏览20话题、阅读100帖子、阅读60分钟
                    // - 送出和收到各1个赞、回复3个不同话题
                    statsConfig = [
                        { key: '访问天数', required: 15 },
                        { key: '浏览话题', required: 20 },
                        { key: '已读帖子', required: 100 },
                        { key: '阅读时间', required: 60 },  // 60分钟
                        { key: '送出赞', required: 1 },
                        { key: '获赞', required: 1 },
                        { key: '回复', required: 3 }  // 3个不同话题
                    ];
                } else {
                    // 2级及以上用户：仅显示统计数据，不显示升级要求
                    // 重要：2级用户的升级进度应从 connect 页面获取（有详细的100天内数据）
                    // 这里只是 connect 页面完全无法获取时的兜底方案
                    // summary API 返回的是累计数据，无法反映真实的升级进度
                    statsConfig = [
                        { key: '访问天数', required: 0, isStats: true },
                        { key: '浏览话题', required: 0, isStats: true },
                        { key: '已读帖子', required: 0, isStats: true },
                        { key: '送出赞', required: 0, isStats: true },
                        { key: '获赞', required: 0, isStats: true },
                        { key: '回复', required: 0, isStats: true },
                        { key: '创建话题', required: 0, isStats: true },
                        { key: '阅读时间', required: 0, isStats: true }
                    ];
                }
                
                statsConfig.forEach(config => {
                    // 获取当前值（如果没有数据则默认为 0）
                    const currentValue = data[config.key] !== undefined ? data[config.key] : 0;
                    const requiredValue = config.required;
                    const isSuccess = currentValue >= requiredValue;
                    const prev = this.prevReqs.find(p => p.name === config.key);
                    
                    reqs.push({
                        name: config.key,
                        currentValue,
                        requiredValue,
                        isSuccess,
                        change: prev ? currentValue - prev.currentValue : 0,
                        isReverse: false
                    });
                });
                
                // 如果没有任何配置项，返回 false
                if (reqs.length === 0) return false;
                
                // 检查升级条件
                const requiredItems = reqs.filter(r => r.requiredValue > 0);
                const metItems = requiredItems.filter(r => r.isSuccess);
                const isOK = requiredItems.length > 0 && metItems.length === requiredItems.length;
                
                // 通知检查
                this.notifier.check(reqs);
                
                // 保存历史数据
                const histData = {};
                reqs.forEach(r => histData[r.name] = r.currentValue);
                const history = this.historyMgr.addHistory(histData, this.readingTime);
                
                // 保存今日数据
                const todayData = this._getTodayData();
                this._setTodayData(histData, !todayData);
                
                // 获取 OAuth 用户信息中的显示名称
                let displayName = null;
                if (this.hasLeaderboard && this.oauth?.isLoggedIn()) {
                    const oauthUser = this.oauth.getUserInfo();
                    if (oauthUser?.name && oauthUser.name !== oauthUser.username) {
                        displayName = oauthUser.name;
                    }
                }
                
                // 渲染用户信息和统计数据（与 2 级用户使用相同的 renderReqs 方法）
                this.renderer.renderUser(username, level.toString(), isOK, reqs, displayName);
                this.renderer.renderReqs(reqs, level);
                
                // 保存缓存
                this.cachedHistory = history;
                this.cachedReqs = reqs;
                this.prevReqs = reqs;
                
                // 0-1级用户也触发数据同步（阅读时间等）
                if (this.hasLeaderboard && this.cloudSync && this.oauth?.isLoggedIn()) {
                    // 同步阅读时间数据
                    this.cloudSync.upload().catch(() => {});
                }
                
                // 渲染趋势
                this._renderTrends(history, reqs);
                
                return true;
            }
            
            async _parse(html) {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                
                // 尝试获取用户名（即使没有升级要求数据也可能有用户信息）
                const avatarEl = doc.querySelector('img[src*="avatar"]');
                
                // 尝试从页面提取用户名和信任等级
                let username = null;
                let level = '?';
                let connectLevel = null;  // 从 connect 页面获取的等级（最新）
                
                // 1. 优先从 h1 标签获取等级信息: "你好，昵称 (username) X级用户"
                const h1El = doc.querySelector('h1');
                if (h1El) {
                    const h1Text = h1El.textContent;
                    const h1Match = h1Text.match(PATTERNS.TRUST_LEVEL_H1);
                    if (h1Match) {
                        username = h1Match[1];  // 括号内的 username
                        connectLevel = parseInt(h1Match[2]) || 0;
                        level = connectLevel.toString();
                    }
                }
                
                // 2. 从头像 alt 获取用户名（备用）
                if (!username && avatarEl?.alt) {
                    username = avatarEl.alt;
                }
                
                // 3. 查找包含信任级别的区块获取更多信息
                const section = [...doc.querySelectorAll('.bg-white.p-6.rounded-lg')].find(d => d.querySelector('h2')?.textContent.includes('信任级别'));
                

                
                // 如果没找到 section，检查原因
                if (!section) {
                    // 检查是否返回了错误的页面（主站而非 connect）
                    const isMainSite = html?.includes('欢迎来到 LINUX DO') || doc.querySelector('title')?.textContent?.includes('LINUX DO -');
                    const isConnectPage = html?.includes('信任级别') || html?.includes('trust level');
                    
                    if (isMainSite && !isConnectPage) {
                        // 返回了主站页面，说明 connect 认证失败（常见于 iOS Safari + Stay）
                        // 使用 OAuth 缓存的用户信息
                        let oauthUsername = username;
                        let oauthLevel = level;
                        
                        if (this.oauth?.isLoggedIn()) {
                            const oauthUser = this.oauth.getUserInfo();
                            if (oauthUser?.username) oauthUsername = oauthUser.username;
                            const trustLevel = oauthUser?.trust_level ?? oauthUser?.trustLevel;
                            if (typeof trustLevel === 'number') oauthLevel = trustLevel.toString();
                        }
                        
                        // 直接使用 fallback 显示，不弹窗打扰用户
                        console.warn('[LDStatus Pro] Connect 页面认证失败，使用 summary 数据');
                        return await this._showFallbackStats(oauthUsername, oauthLevel);
                    }
                    
                    return await this._showFallbackStats(username, level);
                }
                
                if (section) {
                    const heading = section.querySelector('h2').textContent;
                    const match = heading.match(PATTERNS.TRUST_LEVEL);
                    if (match) {
                        if (!username) username = match[1];
                        if (connectLevel === null) {
                            connectLevel = parseInt(match[2]) || 0;
                            level = match[2];
                        }
                    }
                }
                
                // 无论是否有升级要求，只要能识别用户就初始化阅读追踪
                if (username && username !== '未知') {
                    this.storage.setUser(username);
                    this.username = username;
                    this.tracker.init(username);
                    this._startReadingUpdate();
                } else {
                    // 即使没有用户名，也尝试使用匿名模式初始化阅读追踪
                    this.tracker.init('anonymous');
                    this._startReadingUpdate();
                }

                if (avatarEl) this._updateAvatar(avatarEl.src);

                this.readingTime = this.tracker.getTodayTime();
                this.renderer.renderReading(this.readingTime, this.tracker.isActive);
                
                // 如果用户已登录，且从 connect 获取到了等级信息，更新本地缓存和服务端
                if (connectLevel !== null && this.oauth?.isLoggedIn()) {
                    this._updateTrustLevel(connectLevel);
                }
                
                // 如果没有找到升级要求区块，fallback 到 summary 数据
                if (!section) {
                    return await this._showFallbackStats(username, level);
                }

                const rows = section.querySelectorAll('table tr');
                const reqs = [];

                for (let i = 1; i < rows.length; i++) {
                    const cells = rows[i].querySelectorAll('td');
                    if (cells.length < 3) continue;

                    const name = cells[0].textContent.trim();
                    const curMatch = cells[1].textContent.match(PATTERNS.NUMBER);
                    const reqMatch = cells[2].textContent.match(PATTERNS.NUMBER);
                    const currentValue = curMatch ? +curMatch[1] : 0;
                    const requiredValue = reqMatch ? +reqMatch[1] : 0;
                    const isSuccess = cells[1].classList.contains('text-green-500');
                    const prev = this.prevReqs.find(p => p.name === name);

                    reqs.push({
                        name, currentValue, requiredValue, isSuccess,
                        change: prev ? currentValue - prev.currentValue : 0,
                        isReverse: PATTERNS.REVERSE.test(name)
                    });
                }

                const orderedReqs = Utils.reorderRequirements(reqs);
                const isOK = !section.querySelector('p.text-red-500');

                this.notifier.check(orderedReqs);

                const histData = {};
                orderedReqs.forEach(r => histData[r.name] = r.currentValue);
                const history = this.historyMgr.addHistory(histData, this.readingTime);

                // 触发升级要求数据上传（trust_level >= 2 时异步上传）
                if (this.hasLeaderboard && this.cloudSync && this.oauth?.isLoggedIn()) {
                    this.cloudSync.uploadRequirements().catch(() => {});
                }

                const todayData = this._getTodayData();
                this._setTodayData(histData, !todayData);

                // 如果已登录，优先使用 OAuth 用户信息中的 name
                let displayName = null;
                if (this.hasLeaderboard && this.oauth?.isLoggedIn()) {
                    const oauthUser = this.oauth.getUserInfo();
                    if (oauthUser?.name && oauthUser.name !== oauthUser.username) {
                        displayName = oauthUser.name;
                    }
                }
                this.renderer.renderUser(username, level, isOK, orderedReqs, displayName);
                this.renderer.renderReqs(orderedReqs, level);

                this.cachedHistory = history;
                this.cachedReqs = orderedReqs;

                this._renderTrends(history, orderedReqs);
                this._setLastVisit(histData);
                this.prevReqs = orderedReqs;
            }

            _getTodayData() {
                const stored = this.storage.get('todayData', null);
                return stored?.date === Utils.getTodayKey() ? stored : null;
            }

            _setTodayData(data, isStart = false) {
                const today = Utils.getTodayKey();
                const existing = this._getTodayData();
                const now = Date.now();

                this.storage.set('todayData', isStart || !existing
                    ? { date: today, startData: data, startTs: now, currentData: data, currentTs: now }
                    : { ...existing, currentData: data, currentTs: now }
                );
            }

            _setLastVisit(data) {
                this.storage.set('lastVisit', { ts: Date.now(), data });
            }

            _renderTrends(history, reqs) {
                this.renderer.renderTrends(this.trendTab);

                this.$.trends.querySelectorAll('.ldsp-subtab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        this.trendTab = tab.dataset.tab;
                        this.storage.setGlobal('trendTab', this.trendTab);
                        this.$.trends.querySelectorAll('.ldsp-subtab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        this._renderTrendContent(history, reqs);
                    });
                });

                this._renderTrendContent(history, reqs);
            }

            _renderTrendContent(history, reqs) {
                const container = this.$.trends.querySelector('.ldsp-trend-content');

                if (this.trendTab === 'year') {
                    container.innerHTML = `<div class="ldsp-mini-loader"><div class="ldsp-mini-spin"></div><div class="ldsp-mini-txt">加载数据中...</div></div>`;
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            container.innerHTML = this.renderer.renderYearTrend(history, reqs, this.historyMgr, this.tracker);
                            // 自动滚动热力图到today位置（底部），使用程序性滚动避免显示滚动条
                            const heatmap = container.querySelector('.ldsp-year-heatmap');
                            if (heatmap) {
                                requestAnimationFrame(() => this._scrollTo(heatmap, heatmap.scrollHeight));
                            }
                        }, 50);
                    });
                    return;
                }

                const fns = {
                    // 使用 tracker.getTodayTime() 获取实时阅读时间，而不是缓存的 this.readingTime
                    today: () => this.renderer.renderTodayTrend(reqs, this.tracker.getTodayTime(), this._getTodayData()),
                    week: () => this.renderer.renderWeekTrend(history, reqs, this.historyMgr, this.tracker),
                    month: () => this.renderer.renderMonthTrend(history, reqs, this.historyMgr, this.tracker),
                    all: () => this.renderer.renderAllTrend(history, reqs, this.tracker)
                };

                container.innerHTML = fns[this.trendTab]?.() || '';
            }

            /**
             * 加载并显示系统公告（公开接口，不需要登录）
             */
            async _loadAnnouncement() {
                try {
                    const result = await new Promise((resolve, reject) => {
                        GM_xmlhttpRequest({
                            method: 'GET',
                            url: `${CONFIG.LEADERBOARD_API}/api/config/announcement`,
                            headers: { 'Content-Type': 'application/json' },
                            timeout: 10000,
                            onload: res => {
                                if (res.status >= 200 && res.status < 300) {
                                    try {
                                        resolve(JSON.parse(res.responseText));
                                    } catch (e) {
                                        reject(new Error('Parse error'));
                                    }
                                } else {
                                    reject(new Error(`HTTP ${res.status}`));
                                }
                            },
                            onerror: () => reject(new Error('Network error')),
                            ontimeout: () => reject(new Error('Timeout'))
                        });
                    });
                    
                    if (!result.success || !result.data) return;
                    
                    // 处理可能的双重嵌套: result.data.data 或 result.data
                    const announcement = result.data.data || result.data;
                    if (!announcement.enabled) return;
                    
                    // v3.3.3: 支持多条公告 - 兼容旧版单条公告格式
                    let items = [];
                    if (Array.isArray(announcement.items) && announcement.items.length > 0) {
                        items = announcement.items;
                    } else if (announcement.content) {
                        // 兼容旧版单条公告格式
                        items = [{
                            content: announcement.content,
                            type: announcement.type || 'info',
                            expiresAt: announcement.expiresAt || null
                        }];
                    }
                    
                    // 过滤已过期的公告
                    const now = Date.now();
                    items = items.filter(item => !item.expiresAt || item.expiresAt > now);
                    
                    if (items.length === 0) {
                        return;
                    }
                    
                    // 显示公告
                    this._showAnnouncements(items);
                } catch (e) {
                    console.warn('[Announcement] Load failed:', e.message);
                }
            }

            /**
             * 显示多条公告轮播
             * @param {Array} items - 公告数组 [{content, type, expiresAt}, ...]
             */
            _showAnnouncements(items) {
                if (!this.$.announcement || !this.$.announcementText) return;
                
                // 清除之前的轮播定时器
                if (this._announcementTimer) {
                    clearTimeout(this._announcementTimer);
                    this._announcementTimer = null;
                }
                
                this._announcementItems = items;
                this._announcementIndex = 0;
                
                // 显示第一条公告
                this._displayCurrentAnnouncement();
                
                // 显示公告栏
                requestAnimationFrame(() => {
                    this.$.announcement.classList.add('active');
                });
            }
            
            /**
             * 安排下一条公告的切换（使用动画结束事件）
             */
            _scheduleNextAnnouncement() {
                if (this._announcementItems.length <= 1) return;
                
                const inner = this.$.announcement.querySelector('.ldsp-announcement-inner');
                if (!inner) return;
                
                // 移除旧的监听器
                if (this._announcementEndHandler) {
                    inner.removeEventListener('animationend', this._announcementEndHandler);
                }
                
                // 添加新的动画结束监听器
                this._announcementEndHandler = () => {
                    this._announcementIndex = (this._announcementIndex + 1) % this._announcementItems.length;
                    this._displayCurrentAnnouncement();
                };
                inner.addEventListener('animationend', this._announcementEndHandler, { once: true });
            }
            
            /**
             * 显示当前索引的公告
             */
            _displayCurrentAnnouncement() {
                const item = this._announcementItems[this._announcementIndex];
                if (!item) return;
                
                // 设置公告类型样式
                this.$.announcement.className = 'ldsp-announcement active';
                if (item.type && item.type !== 'info') {
                    this.$.announcement.classList.add(item.type);
                }
                
                // 设置公告内容（带序号，如果多条）
                const prefix = this._announcementItems.length > 1 
                    ? `[${this._announcementIndex + 1}/${this._announcementItems.length}] ` 
                    : '';
                this.$.announcementText.textContent = prefix + item.content;
                
                // 根据文字长度设置滚动速度
                const textLength = (prefix + item.content).length;
                const duration = Math.max(10, Math.min(30, textLength * 0.3));
                this.$.announcement.style.setProperty('--marquee-duration', `${duration}s`);
                
                // 重置动画
                const inner = this.$.announcement.querySelector('.ldsp-announcement-inner');
                if (inner) {
                    inner.style.animation = 'none';
                    inner.offsetHeight; // 触发重排
                    inner.style.animation = '';
                }
                
                // 安排下一条公告切换
                this._scheduleNextAnnouncement();
            }

            async _checkUpdate(autoCheck = false) {
                const url = 'https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js';
                this.$.btnUpdate.textContent = '⏳';

                try {
                    const text = await this.network.fetch(url, { maxRetries: 1 });
                    const match = text.match(PATTERNS.VERSION);
                    if (match) {
                        const remote = match[1];
                        const current = GM_info.script.version;
                        if (Utils.compareVersion(remote, current) > 0) {
                            this.$.btnUpdate.textContent = '🆕';
                            this.$.btnUpdate.title = `新版本 v${remote}`;
                            this.$.btnUpdate.classList.add('has-update');
                            this._remoteVersion = remote;
                            this._updateUrl = url;
                            
                            // 检查是否已经提示过这个版本
                            const dismissedVer = this.storage.getGlobal('dismissedUpdateVer', '');
                            const shouldShowBubble = autoCheck 
                                ? (dismissedVer !== remote)  // 自动检查：只有未忽略的版本才显示
                                : true;  // 手动检查：总是显示
                            
                            if (shouldShowBubble) {
                                this._showUpdateBubble(current, remote);
                            }
                            
                            this.$.btnUpdate.onclick = () => this._showUpdateBubble(current, remote);
                        } else {
                            this.$.btnUpdate.textContent = '✅';
                            this.$.btnUpdate.title = '已是最新版本';
                            this.$.btnUpdate.classList.remove('has-update');
                            if (!autoCheck) {
                                this.renderer.showToast('✅ 已是最新版本');
                            }
                            setTimeout(() => {
                                this.$.btnUpdate.textContent = '🔍';
                                this.$.btnUpdate.title = '检查更新';
                            }, 2000);
                        }
                    }
                } catch (e) {
                    this.$.btnUpdate.textContent = '❌';
                    this.$.btnUpdate.title = '检查失败';
                    if (!autoCheck) {
                        this.renderer.showToast('❌ 检查更新失败');
                    }
                    setTimeout(() => {
                        this.$.btnUpdate.textContent = '🔍';
                        this.$.btnUpdate.title = '检查更新';
                    }, 2000);
                }
            }

            _showUpdateBubble(current, remote) {
                this.$.updateBubbleVer.innerHTML = `<span style="color:var(--txt-mut)">v${current}</span> → <span style="color:var(--accent);font-weight:700">v${remote}</span>`;
                this.$.updateBubble.style.display = 'block';
                // 延迟一帧添加动画类，确保过渡效果生效
                requestAnimationFrame(() => {
                    this.$.updateBubble.classList.add('show');
                });
                
                // 绑定关闭按钮
                this.$.updateBubbleClose.onclick = () => this._hideUpdateBubble(true);
                
                // 绑定更新按钮
                this.$.updateBubbleBtn.onclick = () => this._doUpdate();
            }

            _hideUpdateBubble(dismiss = false) {
                // 如果用户主动关闭，记录已忽略的版本
                if (dismiss && this._remoteVersion) {
                    this.storage.setGlobalNow('dismissedUpdateVer', this._remoteVersion);
                }
                
                this.$.updateBubble.classList.remove('show');
                setTimeout(() => {
                    this.$.updateBubble.style.display = 'none';
                }, 300);
            }

            _doUpdate() {
                this.$.updateBubbleBtn.disabled = true;
                this.$.updateBubbleBtn.textContent = '⏳ 更新中...';
                
                // 打开更新链接，Tampermonkey 会自动弹出更新确认
                window.open(this._updateUrl || 'https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js');
                
                // 提示用户
                setTimeout(() => {
                    this.$.updateBubbleBtn.textContent = '✅ 请在弹出窗口确认更新';
                    setTimeout(() => {
                        this._hideUpdateBubble();
                        this.$.updateBubbleBtn.disabled = false;
                        this.$.updateBubbleBtn.textContent = '🚀 立即更新';
                    }, 3000);
                }, 1000);
            }

            // ========== 登录相关 ==========

            _updateLoginUI() {
                // 无排行榜站点隐藏登录相关按钮
                if (!this.hasLeaderboard) {
                    if (this.$.btnCloudSync) this.$.btnCloudSync.style.display = 'none';
                    if (this.$.logoutBtn) this.$.logoutBtn.style.display = 'none';
                    if (this.$.ticketBtn) this.$.ticketBtn.style.display = 'none';
                    if (this.$.loginBtn) this.$.loginBtn.style.display = 'none';
                    return;
                }
                const logged = this.oauth.isLoggedIn();
                const forumLogged = !!this.storage.getUser();  // 论坛登录状态
                this.$.user.classList.toggle('not-logged', !logged);

                // 显示/隐藏云同步按钮
                if (this.$.btnCloudSync) {
                    this.$.btnCloudSync.style.display = logged ? '' : 'none';
                }

                // 显示/隐藏注销按钮和工单按钮（未登录时都隐藏）
                if (this.$.logoutBtn) {
                    this.$.logoutBtn.style.display = logged ? '' : 'none';
                }
                if (this.$.ticketBtn) {
                    this.$.ticketBtn.style.display = logged ? '' : 'none';
                }
                // 显示/隐藏登录按钮（已登录时隐藏）
                if (this.$.loginBtn) {
                    this.$.loginBtn.style.display = logged ? 'none' : '';
                }
                
                // 显示/隐藏关注粉丝和天数（论坛未登录时隐藏整个容器）
                const userMeta = this.el.querySelector('.ldsp-user-meta');
                if (userMeta) {
                    userMeta.style.display = forumLogged ? '' : 'none';
                }

                if (!logged) {
                    this._bindUserLogin();
                }
            }

            _bindLoginButton() {
                if (this._loginBtnBound || !this.$.loginBtn) return;
                this._loginBtnBound = true;
                this.$.loginBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!this.oauth?.isLoggedIn()) {
                        await this._doLogin();
                    }
                });
            }

            _bindUserLogin() {
                if (this._userLoginBound) return;
                this._userLoginBound = true;

                const handle = async e => {
                    if (!this.oauth.isLoggedIn() && this.$.user.classList.contains('not-logged')) {
                        e.stopPropagation();
                        await this._doLogin();
                    }
                };

                this.$.user.querySelector('.ldsp-avatar-wrap')?.addEventListener('click', handle);
                this.$.userDisplayName.addEventListener('click', handle);
                
                // 绑定登录按钮
                this._bindLoginButton();
            }

            /**
             * 检查并处理待处理的 OAuth 登录结果
             * 统一同窗口登录模式：用户授权后会跳转回原页面，登录结果通过 URL hash 传递
             * 数据在脚本最开始就被捕获到 _pendingOAuthData 全局变量
             */
            _checkPendingOAuthLogin() {
                console.log('[OAuth] _checkPendingOAuthLogin called, _pendingOAuthData:', _pendingOAuthData ? 'present' : 'null');
                // 优先使用脚本启动时捕获的数据（避免 Discourse 路由处理掉 hash）
                let pendingResult = _pendingOAuthData;
                _pendingOAuthData = null; // 清除已使用的数据
                
                // 备用：再次尝试从 URL hash 读取
                if (!pendingResult) {
                    console.log('[OAuth] No early captured data, trying URL hash fallback...');
                    pendingResult = this.oauth._checkUrlHashLogin();
                }
                
                console.log('[OAuth] pendingResult:', pendingResult ? { success: pendingResult.success, hasToken: !!pendingResult.token, hasUser: !!pendingResult.user } : 'null');
                
                if (pendingResult?.success && pendingResult.token && pendingResult.user) {
                    console.log('[OAuth] ✅ Processing login result for user:', pendingResult.user?.username);
                    // 【关键】先同步保存登录信息，确保后续的 isLoggedIn() 检查能返回 true
                    this.oauth.setToken(pendingResult.token);
                    this.oauth.setUserInfo(pendingResult.user);
                    this.oauth.setJoined(pendingResult.isJoined || false);
                    // 处理登录结果（异步操作如同步、UI更新等）
                    this._handlePendingLoginResult(pendingResult);
                    return true; // 返回 true 表示有登录结果被处理
                } else {
                    console.log('[OAuth] No valid pending login result');
                    return false;
                }
            }

            // 处理待处理的登录结果（登录信息已在 _checkPendingOAuthLogin 中同步保存）
            async _handlePendingLoginResult(result) {
                try {
                    this.renderer.showToast('✅ 登录成功');
                    
                    // 同步用户名到 storage
                    if (result.user?.username) {
                        this.storage.setUser(result.user.username);
                        this.storage.invalidateCache();
                        this.storage.migrate(result.user.username);
                        this._updateUserInfoFromOAuth(result.user);
                    }
                    
                    this._updateLoginUI();
                    await this._syncPrefs();
                    
                    // 登录成功后重新获取 connect 页面数据（此时 OAuth 用户信息已设置，可以正确显示信任等级）
                    this.fetch();
                    
                    // 首次登录后的完整同步：阅读数据 + 要求数据
                    this.cloudSync.fullSync().then(() => {
                        // 阅读数据同步完成后，同步要求数据（信任等级进度）
                        return this.cloudSync.syncRequirementsOnLoad();
                    }).catch(e => console.warn('[CloudSync]', e));
                } catch (e) {
                    console.error('[OAuth] Handle pending login error:', e);
                }
            }

            async _doLogin() {
                try {
                    this.renderer.showToast('⏳ 正在跳转到授权页面...');
                    // 统一同窗口登录：login() 会跳转页面，不会返回
                    // 登录成功后页面会跳转回来，由 _checkPendingOAuthLogin 处理结果
                    await this.oauth.login();
                    // 如果 login() 返回了用户（从 localStorage 读取的待处理结果），处理它
                    // 注意：正常情况下不会执行到这里，因为页面会跳转
                } catch (e) {
                    this.renderer.showToast(`❌ ${e.message}`);
                }
            }

            // 使用 OAuth 用户信息更新界面
            _updateUserInfoFromOAuth(user) {
                if (!user) return;
                const $ = this.$;
                // 显示用户名和昵称
                if (user.name && user.name !== user.username) {
                    $.userDisplayName.textContent = user.name;
                    $.userHandle.textContent = `@${user.username}`;
                    $.userHandle.style.display = '';
                } else {
                    $.userDisplayName.textContent = user.username;
                    $.userHandle.textContent = '';
                    $.userHandle.style.display = 'none';
                }
                // 更新头像（如果有）
                if (user.avatar_url) {
                    this._updateAvatar(user.avatar_url.startsWith('http') ? user.avatar_url : `https://linux.do${user.avatar_url}`);
                }
            }

            _checkLoginPrompt() {
                const KEY = 'ldsp_login_prompt_version';
                const VER = '3.0';
                if (this.storage.getGlobal(KEY, null) === VER) {
                    this._updateLoginUI();
                    return;
                }

                const hasData = this.storage.get('readingTime', null);
                const isUpgrade = hasData && Object.keys(hasData.dailyData || {}).length > 0;

                setTimeout(() => {
                    const overlay = this.renderer.showLoginPrompt(isUpgrade);
                    this._bindLoginPrompt(overlay, KEY, VER);
                }, 1500);
            }

            _bindLoginPrompt(overlay, key, ver) {
                const close = (skipped = false) => {
                    overlay.classList.remove('show');
                    setTimeout(() => overlay.remove(), 300);
                    this.storage.setGlobalNow(key, ver);
                    skipped && this._updateLoginUI();
                };

                const loginBtn = overlay.querySelector('#ldsp-modal-login');
                loginBtn?.addEventListener('click', async () => {
                    loginBtn.disabled = true;
                    loginBtn.textContent = '⏳ 跳转中...';
                    try {
                        // 统一同窗口登录：会跳转到授权页面
                        // 登录成功后返回此页面，由 _checkPendingOAuthLogin 处理
                        await this.oauth.login();
                        // 正常情况下不会执行到这里，因为页面会跳转
                    } catch (e) {
                        this.renderer.showToast(`❌ ${e.message}`);
                        loginBtn.disabled = false;
                        loginBtn.textContent = '🚀 立即登录';
                    }
                });

                overlay.querySelector('#ldsp-modal-skip')?.addEventListener('click', () => close(true));
                overlay.addEventListener('click', e => e.target === overlay && close(true));
            }

            async _syncPrefs() {
                if (!this.hasLeaderboard || !this.oauth.isLoggedIn()) return;
                try {
                    const result = await this.oauth.api('/api/user/status');
                    if (result.success && result.data) {
                        this.oauth.setJoined(result.data.isJoined || false);
                        if (this.oauth.isJoined()) this.leaderboard.startSync();
                    }
                } catch (e) {
                    console.warn('[Prefs]', e);
                }
            }

            // ========== 我的活动 ==========

            async _renderActivity() {
                if (!this.$.activity) return;

                // 检查论坛登录状态：未登录时显示登录提示
                const username = this.storage.getUser();
                if (!username) {
                    this.$.activity.innerHTML = `
                        <div class="ldsp-lb-login">
                            <div class="ldsp-lb-login-icon">🔐</div>
                            <div class="ldsp-lb-login-title">需要登录</div>
                            <div class="ldsp-lb-login-desc">请先登录论坛后再查看您的活动数据</div>
                        </div>`;
                    return;
                }

                this.renderer.renderActivity(this.activitySubTab);

                // 绑定子tab点击事件
                this.$.activity.querySelectorAll('.ldsp-subtab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        const tabId = tab.dataset.activity;
                        this.activitySubTab = tabId;
                        this.$.activity.querySelectorAll('.ldsp-subtab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        // 清除缓存强制重新加载
                        this.activityMgr.clearCache(tabId);
                        this._renderActivityContent();
                    });
                });

                await this._renderActivityContent();
            }

            async _renderActivityContent() {
                const container = this.$.activity.querySelector('.ldsp-activity-content');
                if (!container) return;

                // 清理之前的滚动事件
                this._cleanupActivityScroll();

                container.innerHTML = this.renderer.renderActivityLoading();

                try {
                    switch (this.activitySubTab) {
                        case 'read':
                            await this._loadReadTopics(container);
                            break;
                        case 'bookmarks':
                            await this._loadBookmarks(container);
                            break;
                        case 'replies':
                            await this._loadReplies(container);
                            break;
                        case 'likes':
                            await this._loadLikes(container);
                            break;
                        case 'topics':
                            await this._loadMyTopics(container);
                            break;
                        default:
                            container.innerHTML = this.renderer.renderActivityEmpty('📭', '请选择一个分类');
                    }
                } catch (e) {
                    container.innerHTML = this.renderer.renderActivityError(e.message || '加载失败');
                    container.querySelector('.ldsp-activity-retry')?.addEventListener('click', () => {
                        this.activityMgr.clearCache(this.activitySubTab);
                        this._renderActivityContent();
                    });
                }
            }

            async _loadReadTopics(container) {
                // 获取当前分页状态
                let state = this.activityMgr.getPageState('read');
                
                // 如果是首次加载，重置状态
                if (state.allTopics.length === 0) {
                    state = { page: 0, allTopics: [], hasMore: true };
                }

                try {
                    const result = await this.activityMgr.getReadTopics(state.page);
                    
                    // 合并话题（避免重复）
                    const existingIds = new Set(state.allTopics.map(t => t.id));
                    const newTopics = result.topics.filter(t => !existingIds.has(t.id));
                    state.allTopics = [...state.allTopics, ...newTopics];
                    state.hasMore = result.hasMore;
                    
                    this.activityMgr.setPageState('read', state);

                    container.innerHTML = this.renderer.renderTopicList(state.allTopics, state.hasMore);

                    // 绑定瀑布流滚动加载
                    if (state.hasMore) {
                        this._bindActivityScroll(container);
                    }
                } catch (e) {
                    if (state.allTopics.length > 0) {
                        // 如果已有数据，显示已有数据并提示加载更多失败
                        container.innerHTML = this.renderer.renderTopicList(state.allTopics, false);
                        this.renderer.showToast(`⚠️ ${e.message}`);
                    } else {
                        throw e;
                    }
                }
            }

            async _loadBookmarks(container) {
                // 获取当前用户名
                const username = this.storage.getUser();
                if (!username) {
                    container.innerHTML = this.renderer.renderActivityEmpty('🔒', '请先登录论坛');
                    return;
                }

                // 获取当前分页状态
                let state = this.activityMgr.getPageState('bookmarks');
                
                // 如果是首次加载，重置状态
                if (!state.allItems || state.allItems.length === 0) {
                    state = { page: 0, allItems: [], hasMore: true };
                }

                try {
                    const result = await this.activityMgr.getBookmarks(state.page, username);
                    
                    // 合并收藏（避免重复）
                    const existingIds = new Set(state.allItems.map(b => b.id));
                    const newItems = result.bookmarks.filter(b => !existingIds.has(b.id));
                    state.allItems = [...state.allItems, ...newItems];
                    state.hasMore = result.hasMore;
                    
                    this.activityMgr.setPageState('bookmarks', state);

                    container.innerHTML = this.renderer.renderBookmarkList(state.allItems, state.hasMore);
                    this._bindBookmarkClicks(container);

                    // 绑定瀑布流滚动加载
                    if (state.hasMore) {
                        this._bindActivityScroll(container, 'bookmarks');
                    }
                } catch (e) {
                    if (state.allItems && state.allItems.length > 0) {
                        // 如果已有数据，显示已有数据并提示加载更多失败
                        container.innerHTML = this.renderer.renderBookmarkList(state.allItems, false);
                        this._bindBookmarkClicks(container);
                        this.renderer.showToast(`⚠️ ${e.message}`);
                    } else {
                        throw e;
                    }
                }
            }

            async _loadReplies(container) {
                // 获取当前用户名
                const username = this.storage.getUser();
                if (!username) {
                    container.innerHTML = this.renderer.renderActivityEmpty('🔒', '请先登录论坛');
                    return;
                }

                // 获取当前分页状态
                let state = this.activityMgr.getPageState('replies');
                
                // 如果是首次加载，重置状态
                if (!state.allItems || state.allItems.length === 0) {
                    state = { offset: 0, allItems: [], hasMore: true };
                }

                try {
                    const result = await this.activityMgr.getReplies(state.offset, username);
                    
                    // 合并回复（避免重复，使用 post_id 作为唯一标识）
                    const existingIds = new Set(state.allItems.map(r => r.post_id));
                    const newItems = result.replies.filter(r => !existingIds.has(r.post_id));
                    state.allItems = [...state.allItems, ...newItems];
                    state.hasMore = result.hasMore;
                    
                    this.activityMgr.setPageState('replies', state);

                    container.innerHTML = this.renderer.renderReplyList(state.allItems, state.hasMore);
                    this._bindReplyClicks(container);

                    // 绑定瀑布流滚动加载
                    if (state.hasMore) {
                        this._bindActivityScroll(container, 'replies');
                    }
                } catch (e) {
                    if (state.allItems && state.allItems.length > 0) {
                        // 如果已有数据，显示已有数据并提示加载更多失败
                        container.innerHTML = this.renderer.renderReplyList(state.allItems, false);
                        this._bindReplyClicks(container);
                        this.renderer.showToast(`⚠️ ${e.message}`);
                    } else {
                        throw e;
                    }
                }
            }

            _bindReplyClicks(container) {
                container.querySelectorAll('.ldsp-reply-item[data-url]').forEach(item => {
                    item.addEventListener('click', (e) => {
                        // 如果点击的是excerpt内的链接，不阻止默认行为
                        if (e.target.closest('.ldsp-reply-excerpt a')) {
                            return;
                        }
                        e.preventDefault();
                        const url = item.dataset.url;
                        if (url && url !== '#') {
                            window.open(url, '_blank');
                        }
                    });
                });
            }

            async _loadLikes(container) {
                // 获取当前用户名
                const username = this.storage.getUser();
                if (!username) {
                    container.innerHTML = this.renderer.renderActivityEmpty('🔒', '请先登录论坛');
                    return;
                }

                // 获取当前分页状态
                let state = this.activityMgr.getPageState('likes');
                
                // 如果是首次加载，重置状态
                if (!state.allItems || state.allItems.length === 0) {
                    state = { offset: 0, allItems: [], hasMore: true };
                }

                try {
                    const result = await this.activityMgr.getLikes(state.offset, username);
                    
                    // 合并赞过（避免重复，使用 post_id 作为唯一标识）
                    const existingIds = new Set(state.allItems.map(l => l.post_id));
                    const newItems = result.likes.filter(l => !existingIds.has(l.post_id));
                    state.allItems = [...state.allItems, ...newItems];
                    state.hasMore = result.hasMore;
                    
                    this.activityMgr.setPageState('likes', state);

                    container.innerHTML = this.renderer.renderLikeList(state.allItems, state.hasMore);
                    this._bindLikeClicks(container);

                    // 绑定瀑布流滚动加载
                    if (state.hasMore) {
                        this._bindActivityScroll(container, 'likes');
                    }
                } catch (e) {
                    if (state.allItems && state.allItems.length > 0) {
                        // 如果已有数据，显示已有数据并提示加载更多失败
                        container.innerHTML = this.renderer.renderLikeList(state.allItems, false);
                        this._bindLikeClicks(container);
                        this.renderer.showToast(`⚠️ ${e.message}`);
                    } else {
                        throw e;
                    }
                }
            }

            _bindLikeClicks(container) {
                container.querySelectorAll('.ldsp-like-item[data-url]').forEach(item => {
                    item.addEventListener('click', (e) => {
                        // 如果点击的是excerpt内的链接，不阻止默认行为
                        if (e.target.closest('.ldsp-like-excerpt a')) {
                            return;
                        }
                        e.preventDefault();
                        const url = item.dataset.url;
                        if (url && url !== '#') {
                            window.open(url, '_blank');
                        }
                    });
                });
            }

            async _loadMyTopics(container) {
                // 获取当前用户名
                const username = this.storage.getUser();
                if (!username) {
                    container.innerHTML = this.renderer.renderActivityEmpty('🔒', '请先登录论坛');
                    return;
                }

                // 获取当前分页状态
                let state = this.activityMgr.getPageState('topics');
                
                // 如果是首次加载，重置状态
                if (!state.allItems || state.allItems.length === 0) {
                    state = { page: 0, allItems: [], hasMore: true };
                }

                try {
                    const result = await this.activityMgr.getMyTopics(state.page, username);
                    
                    // 合并话题（避免重复，使用 id 作为唯一标识）
                    const existingIds = new Set(state.allItems.map(t => t.id));
                    const newItems = result.topics.filter(t => !existingIds.has(t.id));
                    state.allItems = [...state.allItems, ...newItems];
                    state.hasMore = result.hasMore;
                    
                    this.activityMgr.setPageState('topics', state);

                    container.innerHTML = this.renderer.renderMyTopicList(state.allItems, state.hasMore);

                    // 绑定瀑布流滚动加载
                    if (state.hasMore) {
                        this._bindActivityScroll(container, 'topics');
                    }
                } catch (e) {
                    if (state.allItems && state.allItems.length > 0) {
                        // 如果已有数据，显示已有数据并提示加载更多失败
                        container.innerHTML = this.renderer.renderMyTopicList(state.allItems, false);
                        this.renderer.showToast(`⚠️ ${e.message}`);
                    } else {
                        throw e;
                    }
                }
            }

            _bindActivityScroll(container, type = 'read') {
                const content = this.el.querySelector('.ldsp-content');
                if (!content) return;

                let isLoading = false;
                const threshold = 100; // 距离底部100px时触发加载

                this._activityScrollHandler = async () => {
                    if (isLoading) return;
                    
                    const scrollTop = content.scrollTop;
                    const scrollHeight = content.scrollHeight;
                    const clientHeight = content.clientHeight;

                    if (scrollHeight - scrollTop - clientHeight < threshold) {
                        const state = this.activityMgr.getPageState(type);
                        if (!state.hasMore) return;

                        isLoading = true;
                        const loadMoreEl = container.querySelector('.ldsp-load-more');
                        if (loadMoreEl) {
                            loadMoreEl.classList.add('loading');
                        }

                        try {
                            // 加载下一页
                            let result, newItems;
                            const username = this.storage.getUser();
                            
                            if (type === 'bookmarks') {
                                state.page++;
                                result = await this.activityMgr.getBookmarks(state.page, username);
                                const existingIds = new Set(state.allItems.map(b => b.id));
                                newItems = result.bookmarks.filter(b => !existingIds.has(b.id));
                                state.allItems = [...state.allItems, ...newItems];
                                state.hasMore = result.hasMore;
                                this.activityMgr.setPageState(type, state);
                                container.innerHTML = this.renderer.renderBookmarkList(state.allItems, state.hasMore);
                                this._bindBookmarkClicks(container);
                            } else if (type === 'replies') {
                                state.offset += 30;
                                result = await this.activityMgr.getReplies(state.offset, username);
                                const existingIds = new Set(state.allItems.map(r => r.post_id));
                                newItems = result.replies.filter(r => !existingIds.has(r.post_id));
                                state.allItems = [...state.allItems, ...newItems];
                                state.hasMore = result.hasMore;
                                this.activityMgr.setPageState(type, state);
                                container.innerHTML = this.renderer.renderReplyList(state.allItems, state.hasMore);
                                this._bindReplyClicks(container);
                            } else if (type === 'likes') {
                                state.offset += 30;
                                result = await this.activityMgr.getLikes(state.offset, username);
                                const existingIds = new Set(state.allItems.map(l => l.post_id));
                                newItems = result.likes.filter(l => !existingIds.has(l.post_id));
                                state.allItems = [...state.allItems, ...newItems];
                                state.hasMore = result.hasMore;
                                this.activityMgr.setPageState(type, state);
                                container.innerHTML = this.renderer.renderLikeList(state.allItems, state.hasMore);
                                this._bindLikeClicks(container);
                            } else if (type === 'topics') {
                                state.page++;
                                result = await this.activityMgr.getMyTopics(state.page, username);
                                const existingIds = new Set(state.allItems.map(t => t.id));
                                newItems = result.topics.filter(t => !existingIds.has(t.id));
                                state.allItems = [...state.allItems, ...newItems];
                                state.hasMore = result.hasMore;
                                this.activityMgr.setPageState(type, state);
                                container.innerHTML = this.renderer.renderMyTopicList(state.allItems, state.hasMore);
                            } else {
                                state.page++;
                                result = await this.activityMgr.getReadTopics(state.page);
                                const existingIds = new Set(state.allTopics.map(t => t.id));
                                newItems = result.topics.filter(t => !existingIds.has(t.id));
                                state.allTopics = [...state.allTopics, ...newItems];
                                state.hasMore = result.hasMore;
                                this.activityMgr.setPageState(type, state);
                                container.innerHTML = this.renderer.renderTopicList(state.allTopics, state.hasMore);
                            }
                            
                            if (state.hasMore) {
                                // 继续监听
                                isLoading = false;
                            } else {
                                this._cleanupActivityScroll();
                            }
                        } catch (e) {
                            this.renderer.showToast(`⚠️ 加载更多失败: ${e.message}`);
                            // 回退页码/偏移
                            if (type === 'replies' || type === 'likes') {
                                state.offset -= 30;
                            } else {
                                state.page--;
                            }
                            this.activityMgr.setPageState(type, state);
                            isLoading = false;
                            
                            if (loadMoreEl) {
                                loadMoreEl.classList.remove('loading');
                                loadMoreEl.innerHTML = '<span>加载失败，向下滚动重试</span>';
                            }
                        }
                    }
                };

                content.addEventListener('scroll', this._activityScrollHandler, { passive: true });
            }

            _bindBookmarkClicks(container) {
                container.querySelectorAll('.ldsp-bookmark-item[data-url]').forEach(item => {
                    item.addEventListener('click', (e) => {
                        // 如果点击的是excerpt内的链接，不阻止默认行为
                        if (e.target.closest('.ldsp-bookmark-excerpt a')) {
                            return;
                        }
                        e.preventDefault();
                        const url = item.dataset.url;
                        if (url && url !== '#') {
                            window.open(url, '_blank');
                        }
                    });
                });
            }

            _cleanupActivityScroll() {
                if (this._activityScrollHandler) {
                    const content = this.el.querySelector('.ldsp-content');
                    if (content) {
                        content.removeEventListener('scroll', this._activityScrollHandler);
                    }
                    this._activityScrollHandler = null;
                }
                // 重置分页状态
                this.activityMgr.setPageState('read', { page: 0, allTopics: [], hasMore: true });
                this.activityMgr.setPageState('bookmarks', { page: 0, allItems: [], hasMore: true });
                this.activityMgr.setPageState('replies', { offset: 0, allItems: [], hasMore: true });
                this.activityMgr.setPageState('likes', { offset: 0, allItems: [], hasMore: true });
                this.activityMgr.setPageState('topics', { page: 0, allItems: [], hasMore: true });
            }

            // ========== 排行榜 ==========

            async _renderLeaderboard() {
                if (!this.hasLeaderboard || !this.$.leaderboard) return;

                const logged = this.oauth.isLoggedIn();
                const joined = this.oauth.isJoined();

                this.renderer.renderLeaderboard(this.lbTab, logged, joined);

                this.$.leaderboard.querySelectorAll('.ldsp-subtab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        this.lbTab = tab.dataset.lb;
                        this.storage.setGlobal('leaderboardTab', this.lbTab);
                        this.$.leaderboard.querySelectorAll('.ldsp-subtab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        this._renderLeaderboardContent();
                    });
                });

                await this._renderLeaderboardContent();
            }

            async _renderLeaderboardContent() {
                if (!this.hasLeaderboard) return;

                const container = this.$.leaderboard.querySelector('.ldsp-lb-content');
                if (!container) return;

                const logged = this.oauth.isLoggedIn();
                const joined = this.oauth.isJoined();

                if (!logged) {
                    container.innerHTML = this.renderer.renderLeaderboardLogin();
                    const loginBtn = container.querySelector('#ldsp-lb-login');
                    if (loginBtn) {
                        loginBtn.onclick = async () => {
                            loginBtn.disabled = true;
                            loginBtn.textContent = '⏳ 跳转中...';
                            try {
                                // 统一同窗口登录：会跳转到授权页面
                                await this.oauth.login();
                                // 正常情况下不会执行到这里，因为页面会跳转
                            } catch (e) {
                                this.renderer.showToast(`❌ ${e.message}`);
                                loginBtn.disabled = false;
                                loginBtn.textContent = '🚀 立即登录';
                            }
                        };
                    }
                    return;
                }

                if (!joined) {
                    container.innerHTML = this.renderer.renderLeaderboardJoin();
                    const joinBtn = container.querySelector('#ldsp-lb-join');
                    if (joinBtn) {
                        joinBtn.onclick = async () => {
                            joinBtn.disabled = true;
                            joinBtn.textContent = '⏳ 加入中...';
                            try {
                                await this.leaderboard.join();
                                this.leaderboard.startSync();
                                this.renderer.showToast('✅ 已成功加入排行榜');
                                await this._renderLeaderboardContent();
                            } catch (e) {
                                this.renderer.showToast(`❌ ${e.message}`);
                                joinBtn.disabled = false;
                                joinBtn.textContent = '✨ 加入排行榜';
                            }
                        };
                    }
                    return;
                }

                container.innerHTML = this.renderer.renderLeaderboardLoading();

                try {
                    const data = await this.leaderboard.getLeaderboard(this.lbTab);
                    const user = this.oauth.getUserInfo();
                    container.innerHTML = this.renderer.renderLeaderboardData(data, user?.id, joined, this.lbTab);
                    this._bindLeaderboardEvents(container, joined);
                } catch (e) {
                    container.innerHTML = this.renderer.renderLeaderboardError(e.message || '加载失败');
                    container.querySelector('#ldsp-lb-retry')?.addEventListener('click', () => {
                        this.leaderboard.clearCache();
                        this._renderLeaderboardContent();
                    });
                }
            }

            // 绑定排行榜内容区的事件（统一绑定，避免代码重复）
            _bindLeaderboardEvents(container, joined) {
                // 手动刷新按钮
                const refreshBtn = container.querySelector('.ldsp-lb-refresh');
                if (refreshBtn) {
                    refreshBtn.onclick = async (e) => {
                        const btn = e.target;
                        const type = btn.dataset.type;
                        if (btn.disabled) return;
                        
                        const cooldown = this.leaderboard.getRefreshCooldown(type);
                        if (cooldown > 0) {
                            this.renderer.showToast(`⏳ 请等待 ${cooldown} 秒后再刷新`);
                            return;
                        }
                        
                        btn.disabled = true;
                        btn.classList.add('spinning');
                        
                        try {
                            const result = await this.leaderboard.forceRefresh(type);
                            this.renderer.showToast(result.fromCache ? '📦 获取缓存数据' : '✅ 已刷新排行榜');
                            const userData = this.oauth.getUserInfo();
                            container.innerHTML = this.renderer.renderLeaderboardData(result.data, userData?.id, joined, type);
                            this._bindLeaderboardEvents(container, joined);
                        } catch (err) {
                            this.renderer.showToast(`❌ ${err.message}`);
                            btn.disabled = false;
                            btn.classList.remove('spinning');
                        }
                    };
                }

                // 退出排行榜按钮
                const quitBtn = container.querySelector('#ldsp-lb-quit');
                if (quitBtn) {
                    quitBtn.onclick = async () => {
                        if (!confirm('确定要退出排行榜吗？')) return;
                        quitBtn.disabled = true;
                        quitBtn.textContent = '退出中...';
                        try {
                            await this.leaderboard.quit();
                            this.leaderboard.stopSync();
                            this.renderer.showToast('✅ 已退出排行榜');
                            await this._renderLeaderboardContent();
                        } catch (e) {
                            this.renderer.showToast(`❌ ${e.message}`);
                            quitBtn.disabled = false;
                            quitBtn.textContent = '退出排行榜';
                        }
                    };
                }
            }

            destroy() {
                if (this._destroyed) return;
                this._destroyed = true;
                
                // 清理定时器
                if (this._refreshTimer) {
                    clearInterval(this._refreshTimer);
                    this._refreshTimer = null;
                }
                if (this._readingTimer) {
                    clearInterval(this._readingTimer);
                    this._readingTimer = null;
                }
                
                // 清理事件监听器
                if (this._resizeHandler) {
                    window.removeEventListener('resize', this._resizeHandler);
                }
                
                // 清理阅读追踪器
                this.tracker?.destroy();
                
                // 清理排行榜相关
                if (this.hasLeaderboard) {
                    this.leaderboard?.destroy();
                    this.cloudSync?.destroy();
                }
                
                // 清理工单管理器
                this.ticketManager?.destroy();

                // 清理吃瓜助手
                this.melonHelper?.destroy();
                
                // 清理关注/粉丝管理器
                this.followManager?.destroy();
                
                // 保存数据
                this.storage?.flush();
                
                // 清理事件总线
                EventBus.clear();
                
                // 移除面板
                this.el?.remove();
                
                Logger.log('Panel destroyed');
            }
        }

        // ==================== 启动 ====================
        async function startup() {
            // 初始化全局领导者管理器（必须在其他组件之前）
            TabLeader.init();
            
            // 性能优化：使用 requestIdleCallback 在空闲时加载非关键配置
            requestIdleCallback(() => {
                Network.loadReadingLevels().catch(() => {});
            }, { timeout: 3000 });
            
            // 创建面板
            try {
                new Panel();
            } catch (e) {
                Logger.error('Panel initialization failed:', e);
            }
        }

        // 确保 DOM 就绪后启动
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startup, { once: true });
        } else {
            // 使用 requestAnimationFrame 确保在下一帧渲染
            requestAnimationFrame(startup);
        }

    })();
