// ==UserScript==
// @name         LDStatus Pro
// @namespace    http://tampermonkey.net/
// @version      3.3.1
// @description  在 Linux.do 和 IDCFlare 页面显示信任级别进度，支持历史趋势、里程碑通知、阅读时间统计。两站点均支持排行榜和云同步功能
// @author       JackLiii
// @license      MIT
// @match        https://linux.do/*
// @match        https://idcflare.com/*
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
// @connect      ldstatus-pro-api.jackcai711.workers.dev
// @connect      *.workers.dev
// @updateURL    https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js
// @downloadURL  https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js
// @icon         https://linux.do/uploads/default/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png
// ==/UserScript==

(function() {
    'use strict';

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
            supportsLeaderboard: true  // v3.2.1: 启用排行榜和云同步
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

    // ==================== 常量配置 ====================
    const CONFIG = {
        // 时间间隔（毫秒）- 优化版：减少请求频率
        INTERVALS: {
            REFRESH: 300000,           // 数据刷新间隔
            READING_TRACK: 10000,      // 阅读追踪间隔
            READING_SAVE: 30000,       // 阅读保存间隔
            READING_IDLE: 60000,       // 空闲阈值
            STORAGE_DEBOUNCE: 1000,    // 存储防抖
            READING_UPDATE: 1000,      // 阅读时间UI更新
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
        // 阅读等级配置（默认值，实际从服务端动态获取）
        READING_LEVELS_DEFAULT: [
            { min: 0, icon: '🌱', label: '刚起步', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
            { min: 30, icon: '📖', label: '热身中', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
            { min: 90, icon: '📚', label: '渐入佳境', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
            { min: 180, icon: '🔥', label: '沉浸阅读', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
            { min: 300, icon: '⚡', label: '深度学习', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
            { min: 450, icon: '🏆', label: 'LD达人', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
            { min: 600, icon: '👑', label: '超级水怪', color: '#ec4899', bg: 'rgba(236,72,153,0.15)' }
        ],
        // 阅读等级预设样式（图标、颜色、背景色固定顺序）
        READING_LEVEL_PRESETS: [
            { icon: '🌱', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
            { icon: '📖', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
            { icon: '📚', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
            { icon: '🔥', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
            { icon: '⚡', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
            { icon: '🏆', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
            { icon: '👑', color: '#ec4899', bg: 'rgba(236,72,153,0.15)' }
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
            readingLevels: 'reading_levels', readingLevelsTime: 'reading_levels_time'
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
        VERSION: /@version\s+([\d.]+)/,
        AVATAR_SIZE: /\/\d+\//,
        NUMBER: /(\d+)/
    };

    // ==================== 工具函数 ====================
    const Utils = {
        _nameCache: new Map(),

        // HTML 转义（防止 XSS）
        escapeHtml(str) {
            if (!str || typeof str !== 'string') return '';
            const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
            return str.replace(/[&<>"']/g, c => entities[c]);
        },

        // 清理用户输入
        sanitize(str, maxLen = 100) {
            if (!str || typeof str !== 'string') return '';
            return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').substring(0, maxLen).trim();
        },

        // 版本比较
        compareVersion(v1, v2) {
            const [p1, p2] = [v1, v2].map(v => v.split('.').map(Number));
            const len = Math.max(p1.length, p2.length);
            for (let i = 0; i < len; i++) {
                const diff = (p1[i] || 0) - (p2[i] || 0);
                if (diff !== 0) return diff > 0 ? 1 : -1;
            }
            return 0;
        },

        // 简单字符串哈希
        hash(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash).toString(16);
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
            if (minutes <= 30) return 1;
            if (minutes <= 90) return 2;
            if (minutes <= 180) return 3;
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

        // 防抖
        debounce(fn, wait) {
            let timer;
            return function(...args) {
                clearTimeout(timer);
                timer = setTimeout(() => fn.apply(this, args), wait);
            };
        },

        // 节流
        throttle(fn, limit) {
            let throttled = false;
            return function(...args) {
                if (!throttled) {
                    fn.apply(this, args);
                    throttled = true;
                    setTimeout(() => throttled = false, limit);
                }
            };
        },

        // 生成简单哈希
        simpleHash(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0;
            }
            return hash.toString(36);
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

    // ==================== 网络管理器 ====================
    class Network {
        constructor() {
            this._pending = new Map();
            this._apiCache = new Map();
            this._apiCacheTime = new Map();
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
                        console.log('[ReadingLevels] Using cached config, levels:', cached.length);
                        return;
                    }
                }
                
                // 需要从服务端获取
                console.log('[ReadingLevels] Fetching from server...');
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
                    console.log('[ReadingLevels] Loaded from server, levels:', levels.length);
                } else {
                    throw new Error('Invalid response format');
                }
            } catch (e) {
                console.warn('[ReadingLevels] Failed to load from server:', e.message);
                // 尝试使用本地缓存（即使过期也比没有好）
                const cached = GM_getValue(storageKey, null);
                if (cached && Array.isArray(cached) && cached.length > 0) {
                    CONFIG.READING_LEVELS = cached;
                    console.log('[ReadingLevels] Using expired cache, levels:', cached.length);
                } else {
                    // 使用默认配置
                    CONFIG.READING_LEVELS = CONFIG.READING_LEVELS_DEFAULT;
                    console.log('[ReadingLevels] Using default config');
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

        _doFetch(url, timeout) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    timeout,
                    onload: res => res.status >= 200 && res.status < 300 
                        ? resolve(res.responseText) 
                        : reject(new Error(`HTTP ${res.status}`)),
                    onerror: () => reject(new Error('Network error')),
                    ontimeout: () => reject(new Error('Timeout'))
                });
            });
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
                GM_xmlhttpRequest({
                    method,
                    url: `${CONFIG.LEADERBOARD_API}${endpoint}`,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Client-Version': GM_info.script.version || 'unknown',
                        ...(options.token ? { 'Authorization': `Bearer ${options.token}` } : {})
                    },
                    data: options.body ? JSON.stringify(options.body) : undefined,
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
            this._startTracking();
            this._initialized = true;
        }

        _bindEvents() {
            const handler = Utils.throttle(() => this._onActivity(), 1000);
            ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(e => {
                document.addEventListener(e, handler, { passive: true });
            });

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.save();
                    this.isActive = false;
                } else {
                    this.lastActivity = Date.now();
                    this.isActive = true;
                }
            });

            window.addEventListener('beforeunload', () => this.save());
        }

        _onActivity() {
            const now = Date.now();
            if (!this.isActive) this.isActive = true;
            this.lastActivity = now;
        }

        _startTracking() {
            this._intervals.push(
                setInterval(() => {
                    const idle = Date.now() - this.lastActivity;
                    if (this.isActive && idle > CONFIG.INTERVALS.READING_IDLE) {
                        this.isActive = false;
                    } else if (!this.isActive && idle < CONFIG.INTERVALS.READING_IDLE) {
                        this.isActive = true;
                    }
                }, CONFIG.INTERVALS.READING_TRACK),
                setInterval(() => this.save(), CONFIG.INTERVALS.READING_SAVE)
            );
        }

        save() {
            if (!this.storage.getUser()) return;

            const todayKey = Utils.getTodayKey();
            const now = Date.now();
            let stored = this.storage.get('readingTime', null);

            if (!stored?.dailyData) {
                stored = { version: 3, dailyData: {}, monthlyCache: {}, yearlyCache: {} };
            }

            let today = stored.dailyData[todayKey] || { totalMinutes: 0, lastActive: now, sessions: [] };
            const elapsed = (now - this.lastSave) / 1000;
            const idle = now - this.lastActivity;
            
            let toAdd = 0;
            if (elapsed > 0) {
                toAdd = idle <= CONFIG.INTERVALS.READING_IDLE 
                    ? elapsed 
                    : Math.max(0, elapsed - (idle - CONFIG.INTERVALS.READING_IDLE) / 1000);
            }

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
                this.lastSave = now;
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
            this._intervals.forEach(clearInterval);
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
                console.log('[LDStatus Pro] Token expired, logging out');
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
                // 提前 5 分钟判断为过期，避免请求时刚好过期
                return decoded.exp < (now + 300);
            } catch (e) {
                console.error('[LDStatus Pro] Token parse error:', e);
                return true; // 解析失败视为过期
            }
        }
        
        isJoined() { return this.storage.getGlobal('leaderboardJoined', false); }
        setJoined(v) { this.storage.setGlobalNow('leaderboardJoined', v); }

        async login() {
            const authWindow = window.open('about:blank', 'oauth_login', 'width=600,height=700');
            if (!authWindow) throw new Error('弹窗被拦截');

            return new Promise((resolve, reject) => {
                // 传递当前站点信息用于多站点 OAuth
                const siteParam = encodeURIComponent(CURRENT_SITE.domain);
                this.network.api(`/api/auth/init?site=${siteParam}`).then(result => {
                    if (result.success && result.data?.auth_url) {
                        authWindow.location.href = result.data.auth_url;
                        this._listenCallback(authWindow, resolve, reject);
                    } else {
                        authWindow.close();
                        reject(new Error(result.error?.message || '获取授权链接失败'));
                    }
                }).catch(e => {
                    authWindow.close();
                    reject(e);
                });
            });
        }

        _listenCallback(win, resolve, reject) {
            // 允许的 postMessage 来源列表
            const ALLOWED_ORIGINS = [
                'https://ldstatus-pro-api.jackcai711.workers.dev',
                CONFIG.LEADERBOARD_API
            ];

            const check = setInterval(() => {
                if (win.closed) {
                    clearInterval(check);
                    setTimeout(() => {
                        this.isLoggedIn() ? resolve(this.getUserInfo()) : reject(new Error('登录已取消'));
                    }, 500);
                }
            }, 500);

            const handler = (e) => {
                // 安全检查：验证消息来源
                if (!ALLOWED_ORIGINS.some(origin => e.origin === origin || e.origin.endsWith('.workers.dev'))) {
                    console.warn('[LDStatus Pro] Ignored message from untrusted origin:', e.origin);
                    return;
                }

                if (e.data?.type === 'ldsp_oauth_callback') {
                    clearInterval(check);
                    window.removeEventListener('message', handler);
                    
                    if (e.data.success) {
                        this.setToken(e.data.token);
                        this.setUserInfo(e.data.user);
                        this.setJoined(e.data.isJoined);
                        win.closed || win.close();
                        resolve(e.data.user);
                    } else {
                        reject(new Error(e.data.error || '登录失败'));
                    }
                }
            };
            window.addEventListener('message', handler);

            setTimeout(() => {
                clearInterval(check);
                window.removeEventListener('message', handler);
                this.isLoggedIn() || reject(new Error('登录超时'));
            }, 120000);
        }

        logout() {
            this.setToken(null);
            this.setUserInfo(null);
            this.setJoined(false);
        }

        /**
         * 发起 API 请求，自动处理 Token 过期
         */
        async api(endpoint, options = {}) {
            try {
                const result = await this.network.api(endpoint, { ...options, token: this.getToken() });
                return result;
            } catch (e) {
                // 检查是否是 Token 过期错误
                if (e.message?.includes('expired') || e.message?.includes('TOKEN_EXPIRED') || 
                    e.message?.includes('INVALID_TOKEN') || e.message?.includes('401') ||
                    e.message?.includes('Unauthorized')) {
                    console.log('[LDStatus Pro] Token expired or invalid, logging out');
                    this.logout();
                    // 触发 UI 更新事件
                    window.dispatchEvent(new CustomEvent('ldsp_token_expired'));
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
            // 根据类型使用不同的缓存时间
            const ttlMap = {
                daily: CONFIG.CACHE.LEADERBOARD_DAILY_TTL,
                weekly: CONFIG.CACHE.LEADERBOARD_WEEKLY_TTL,
                monthly: CONFIG.CACHE.LEADERBOARD_MONTHLY_TTL
            };
            const ttl = ttlMap[type] || CONFIG.CACHE.LEADERBOARD_DAILY_TTL;

            if (cached && (now - cached.time) < ttl) return cached.data;

            try {
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
            throw new Error(result.error || '加入失败');
        }

        async quit() {
            const result = await this.oauth.api('/api/user/quit', { method: 'POST' });
            if (result.success) {
                this.oauth.setJoined(false);
                return true;
            }
            throw new Error(result.error || '退出失败');
        }

        async syncReadingTime() {
            if (!this.oauth.isLoggedIn() || !this.oauth.isJoined()) return;
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
                    console.log('[Leaderboard] Sync skipped - no change:', currentMinutes, 'min');
                    return;
                }
                
                await this.oauth.api('/api/reading/sync', {
                    method: 'POST',
                    body: { 
                        date: today,
                        minutes: currentMinutes,
                        client_timestamp: Date.now()
                    }
                });
                this._lastSync = Date.now();
                
                // 记录已同步的分钟数
                this.storage?.setGlobal(lastSyncedKey, currentMinutes);
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
            console.log(`[CloudSync] ${type} failure #${this._failureCount[type]}, next retry in ${this._getBackoffDelay(type)/1000}s`);
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
            const userInfo = this.oauth.getUserInfo();
            if (userInfo && typeof userInfo.trust_level === 'number') {
                const hasTrust = userInfo.trust_level >= 2;
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
        
        // 更新 trust_level 缓存
        _updateTrustLevelCache(hasTrust) {
            this._trustLevelCache = hasTrust;
            this._trustLevelCacheTime = Date.now();
            this.storage.setGlobalNow('trustLevelCache', hasTrust);
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
            if (!this.oauth.isLoggedIn()) return null;
            
            // 检查退避延迟
            if (!this._canRetry('reading')) {
                console.log('[CloudSync] Download skipped - in backoff period');
                return null;
            }

            try {
                const result = await this.oauth.api('/api/reading/history?days=365');
                console.log('[CloudSync] Download result:', result);
                if (!result.success) {
                    this._recordFailure('reading');
                    return null;
                }
                
                this._recordSuccess('reading');

                const cloud = result.data.dailyData || {};
                console.log('[CloudSync] Cloud data days:', Object.keys(cloud).length, 'keys:', Object.keys(cloud).slice(0, 3));
                let local = this.storage.get('readingTime', null);
                console.log('[CloudSync] Local data:', local ? Object.keys(local.dailyData || {}).length + ' days' : 'null');

                if (!local?.dailyData) {
                    local = { version: 3, dailyData: cloud, monthlyCache: {}, yearlyCache: {} };
                    this._rebuildCache(local);
                    this.storage.setNow('readingTime', local);
                    console.log('[CloudSync] Stored cloud data to local, days:', Object.keys(cloud).length);
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
                }
                return { merged, source: 'merge' };
            } catch (e) {
                console.error('[CloudSync] Download failed:', e);
                this._recordFailure('reading');
                return null;
            }
        }

        async upload() {
            if (!this.oauth.isLoggedIn() || this._syncing) return null;
            
            // 检查退避延迟
            if (!this._canRetry('reading')) {
                console.log('[CloudSync] Upload skipped - in backoff period');
                return null;
            }

            try {
                this._setSyncing(true);
                const local = this.storage.get('readingTime', null);
                if (!local?.dailyData) {
                    this._setSyncing(false);
                    return null;
                }

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

                console.log(`[CloudSync] Uploading ${Object.keys(recentData).length} days of data`);
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
            console.log('[CloudSync] onPageLoad - hasLocal:', hasLocal, 'isNew:', isNew, '_lastDownload:', this._lastDownload);

            // 串行执行同步请求，避免并发压力
            // 1. 下载检查（优先级最高）
            if (isNew || (now - this._lastDownload) > CONFIG.INTERVALS.CLOUD_DOWNLOAD) {
                console.log('[CloudSync] Starting download...');
                const result = await this.download();
                console.log('[CloudSync] Download result:', result);
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
            if (this._syncing) return;
            
            try {
                this._setSyncing(true);
                
                console.log('[CloudSync] fullSync - starting download...');
                const downloadResult = await this.download();
                console.log('[CloudSync] fullSync - download result:', downloadResult);
                this._lastDownload = Date.now();
                this.storage.setGlobalNow('lastDownloadSync', this._lastDownload);

                console.log('[CloudSync] fullSync - starting upload...');
                // upload 内部不会重复设置 syncing 因为已经是 true
                const local = this.storage.get('readingTime', null);
                if (local?.dailyData) {
                    const result = await this.oauth.api('/api/reading/sync-full', {
                        method: 'POST',
                        body: { dailyData: local.dailyData, lastSyncTime: Date.now() }
                    });
                    console.log('[CloudSync] fullSync - upload result:', result);
                    if (result.success) {
                        this._lastUpload = Date.now();
                        this.storage.setGlobalNow('lastCloudSync', this._lastUpload);
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
            if (!this.oauth.isLoggedIn() || !this._historyMgr) return null;
            
            // 检查 trust_level 缓存（如果已知不足，跳过请求）
            const cachedTrust = this._hasSufficientTrustLevel();
            if (cachedTrust === false) {
                console.log('[CloudSync] Requirements skipped - cached trust_level < 2');
                return null;
            }
            
            // 检查退避延迟
            if (!this._canRetry('requirements')) {
                console.log('[CloudSync] Requirements download skipped - in backoff period');
                return null;
            }

            try {
                const result = await this.oauth.api('/api/requirements/history?days=100');
                console.log('[CloudSync] Requirements download result:', result);
                
                if (!result.success) {
                    // 权限不足（trust_level < 2）是正常情况，缓存结果避免重复请求
                    if (result.error?.code === 'INSUFFICIENT_TRUST_LEVEL') {
                        console.log('[CloudSync] Requirements sync requires trust_level >= 2');
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
            if (!this.oauth.isLoggedIn() || !this._historyMgr) return null;
            
            // 检查 trust_level 缓存
            const cachedTrust = this._hasSufficientTrustLevel();
            if (cachedTrust === false) {
                console.log('[CloudSync] Requirements sync skipped - cached trust_level < 2');
                return null;
            }
            
            // 检查退避延迟
            if (!this._canRetry('requirements')) {
                console.log('[CloudSync] Requirements incremental sync skipped - in backoff period');
                return null;
            }

            try {
                if (!todayRecord?.data) return null;
                
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
                    console.log('[CloudSync] Requirements incremental sync:', result.data);
                    return result.data;
                }
                
                // 权限不足是正常情况，缓存结果
                if (result.error?.code === 'INSUFFICIENT_TRUST_LEVEL') {
                    console.log('[CloudSync] Requirements sync requires trust_level >= 2');
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
            if (!this.oauth.isLoggedIn() || !this._historyMgr || this._syncing) return null;
            
            // 检查 trust_level 缓存
            const cachedTrust = this._hasSufficientTrustLevel();
            if (cachedTrust === false) {
                console.log('[CloudSync] Requirements full upload skipped - cached trust_level < 2');
                return null;
            }
            
            // 检查退避延迟
            if (!this._canRetry('requirements')) {
                console.log('[CloudSync] Requirements full upload skipped - in backoff period');
                return null;
            }

            try {
                const history = this._historyMgr.getHistory();
                if (!history.length) return null;

                const result = await this.oauth.api('/api/requirements/sync-full', {
                    method: 'POST',
                    body: { history, lastSyncTime: Date.now() }
                });

                if (result.success) {
                    this._reqLastFullSync = Date.now();
                    this.storage.setGlobalNow('lastReqFullSync', this._reqLastFullSync);
                    this._updateTrustLevelCache(true);
                    this._recordSuccess('requirements');
                    console.log('[CloudSync] Requirements full uploaded:', result.data);
                    return result.data;
                }
                
                // 权限不足是正常情况，缓存结果
                if (result.error?.code === 'INSUFFICIENT_TRUST_LEVEL') {
                    console.log('[CloudSync] Requirements sync requires trust_level >= 2');
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
            if (!this.oauth.isLoggedIn() || !this._historyMgr) return;
            
            // 检查 trust_level，如果已知不足则直接跳过（不发起任何请求）
            const hasTrust = this._hasSufficientTrustLevel();
            if (hasTrust === false) {
                console.log('[CloudSync] Requirements sync skipped - trust_level < 2');
                return;
            }
            
            // 如果无法确定 trust_level (hasTrust === null)，检查本地是否有数据
            // 只有本地有升级要求数据时才尝试同步（避免低等级新用户发起无效请求）
            const localHistory = this._historyMgr.getHistory();
            if (hasTrust === null) {
                if (!localHistory || localHistory.length === 0) {
                    console.log('[CloudSync] Requirements sync skipped - no local data and trust_level unknown');
                    return;
                }
            }

            const now = Date.now();
            const INCREMENTAL_INTERVAL = CONFIG.INTERVALS.REQ_SYNC_INCREMENTAL || 3600000; // 1小时
            const FULL_INTERVAL = CONFIG.INTERVALS.REQ_SYNC_FULL || 43200000; // 12小时
            
            // ========== 判断是否需要全量同步 ==========
            const isFirstTime = this._reqLastDownload === 0;
            const needFullSync = isFirstTime || (now - (this._reqLastFullSync || 0)) > FULL_INTERVAL;
            
            if (needFullSync) {
                console.log('[CloudSync] Requirements full sync needed:', isFirstTime ? 'first time' : 'interval exceeded');
                
                // 1. 先下载云端数据
                const downloadResult = await this.downloadRequirements();
                if (downloadResult) {
                    this._reqLastDownload = now;
                    this.storage.setGlobalNow('lastReqDownload', now);
                    
                    // 2. 如果本地有数据且云端数据较少，上传本地数据
                    const cloudDays = downloadResult.merged || 0;
                    const localDays = localHistory.length;
                    
                    if (localDays > 0 && (isFirstTime || localDays > cloudDays)) {
                        console.log('[CloudSync] Local has more data, uploading full history...');
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
                console.log('[CloudSync] Requirements incremental sync skipped - within interval');
                return;
            }
            
            // 获取今天的记录
            const today = new Date().toDateString();
            const todayRecord = localHistory.find(h => new Date(h.ts).toDateString() === today);
            
            if (todayRecord) {
                const result = await this.syncTodayRequirements(todayRecord);
                if (result) {
                    console.log('[CloudSync] Requirements incremental sync completed');
                }
            } else {
                console.log('[CloudSync] No today record to sync');
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
#ldsp-panel{--dur-fast:120ms;--dur:200ms;--dur-slow:350ms;--ease:cubic-bezier(.22,1,.36,1);--ease-circ:cubic-bezier(.85,0,.15,1);--ease-spring:cubic-bezier(.175,.885,.32,1.275);--ease-out:cubic-bezier(0,.55,.45,1);--bg:#0c0c14;--bg-card:rgba(22,22,35,.85);--bg-hover:rgba(40,40,65,.9);--bg-el:rgba(30,30,50,.8);--bg-glass:rgba(255,255,255,.03);--txt:#f0f0f5;--txt-sec:#a8a8bc;--txt-mut:#6b6b80;--accent:#8b5cf6;--accent-light:#a78bfa;--accent2:#22d3ee;--accent2-light:#67e8f9;--accent3:#f472b6;--grad:linear-gradient(135deg,#8b5cf6 0%,#06b6d4 50%,#22d3ee 100%);--grad-accent:linear-gradient(135deg,#8b5cf6,#7c3aed);--grad-warm:linear-gradient(135deg,#f472b6,#ec4899);--grad-gold:linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%);--ok:#10b981;--ok-light:#34d399;--ok-bg:rgba(16,185,129,.12);--err:#f43f5e;--err-light:#fb7185;--err-bg:rgba(244,63,94,.12);--warn:#f59e0b;--warn-bg:rgba(245,158,11,.12);--border:rgba(255,255,255,.04);--border2:rgba(255,255,255,.08);--border-accent:rgba(139,92,246,.3);--shadow:0 20px 60px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.05);--shadow-lg:0 25px 80px rgba(0,0,0,.6),0 0 40px rgba(139,92,246,.1);--shadow-glow:0 0 30px rgba(139,92,246,.2);--glow-accent:0 0 20px rgba(139,92,246,.3);--r-xs:4px;--r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:20px;--w:${c.width}px;--h:${c.maxHeight}px;--fs:${c.fontSize}px;--pd:${c.padding}px;--av:${c.avatarSize}px;--ring:${c.ringSize}px;position:fixed;right:12px;top:80px;left:auto;width:var(--w);background:var(--bg);border-radius:var(--r-lg);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Noto Sans SC',sans-serif;font-size:var(--fs);color:var(--txt);box-shadow:var(--shadow);z-index:99999;overflow:hidden;border:1px solid var(--border);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
#ldsp-panel,#ldsp-panel *{transition:background-color var(--dur) var(--ease),color var(--dur),border-color var(--dur),opacity var(--dur),transform var(--dur) var(--ease),box-shadow var(--dur)}
#ldsp-panel.no-trans,#ldsp-panel.no-trans *{transition:none!important}
#ldsp-panel.anim{transition:width var(--dur-slow) var(--ease),height var(--dur-slow) var(--ease),left var(--dur-slow) var(--ease),top var(--dur-slow) var(--ease)}
#ldsp-panel.light{--bg:rgba(255,255,255,.95);--bg-card:rgba(248,250,252,.9);--bg-hover:rgba(241,245,249,.95);--bg-el:rgba(255,255,255,.9);--bg-glass:rgba(0,0,0,.02);--txt:#0f172a;--txt-sec:#475569;--txt-mut:#94a3b8;--accent:#7c3aed;--accent-light:#8b5cf6;--accent2:#0891b2;--accent2-light:#06b6d4;--ok:#059669;--ok-light:#10b981;--ok-bg:rgba(5,150,105,.08);--err:#dc2626;--err-light:#ef4444;--err-bg:rgba(220,38,38,.08);--warn:#d97706;--warn-bg:rgba(217,119,6,.08);--border:rgba(0,0,0,.05);--border2:rgba(0,0,0,.08);--border-accent:rgba(124,58,237,.2);--shadow:0 20px 60px rgba(0,0,0,.1),0 0 0 1px rgba(0,0,0,.05);--shadow-lg:0 25px 80px rgba(0,0,0,.15);--glow-accent:0 0 20px rgba(124,58,237,.15)}
#ldsp-panel.collapsed{width:48px!important;height:48px!important;border-radius:var(--r-md);cursor:move;touch-action:none;background:var(--grad);border:none;box-shadow:var(--shadow),var(--glow-accent)}
#ldsp-panel.collapsed .ldsp-hdr{padding:0;justify-content:center;align-items:center;height:100%;background:0 0}
#ldsp-panel.collapsed .ldsp-hdr-info,#ldsp-panel.collapsed .ldsp-hdr-btns>button:not(.ldsp-toggle),#ldsp-panel.collapsed .ldsp-body{display:none!important}
#ldsp-panel.collapsed .ldsp-hdr-btns{justify-content:center;width:100%;height:100%}
#ldsp-panel.collapsed .ldsp-toggle{width:100%;height:100%;font-size:18px;background:0 0;display:flex;align-items:center;justify-content:center;color:#fff;position:absolute;inset:0}
#ldsp-panel.collapsed:hover{transform:scale(1.05);box-shadow:var(--shadow-lg),var(--glow-accent)}
.ldsp-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--grad);cursor:move;user-select:none;touch-action:none;position:relative;overflow:hidden}
.ldsp-hdr::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.1) 0%,transparent 100%);pointer-events:none}
.ldsp-hdr::after{content:'';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(circle,rgba(255,255,255,.1) 0%,transparent 60%);opacity:0;transition:opacity .5s;pointer-events:none}
.ldsp-hdr:hover::after{opacity:1}
.ldsp-hdr-info{display:flex;align-items:center;gap:10px;min-width:0;position:relative;z-index:1}
.ldsp-site-wrap{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0}
.ldsp-site-icon{width:28px;height:28px;border-radius:8px;border:2px solid rgba(255,255,255,.25);flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.2);transition:transform .2s var(--ease),border-color .2s;margin-top:-2px}
.ldsp-site-icon:hover{transform:scale(1.1) rotate(-5deg);border-color:rgba(255,255,255,.5)}
.ldsp-hdr-text{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;flex:1;overflow:hidden}
.ldsp-title{font-weight:800;font-size:15px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;letter-spacing:-.02em;text-shadow:0 1px 2px rgba(0,0,0,.2)}
.ldsp-ver{font-size:11px;color:rgba(255,255,255,.6);line-height:1.3;display:flex;flex-wrap:wrap;align-items:center;gap:3px 6px}
.ldsp-app-name{font-size:12px;font-weight:700;background:linear-gradient(90deg,#fff 0%,#a78bfa 50%,#22d3ee 100%);background-size:100% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:color-pulse 2.5s ease-in-out infinite}
@keyframes color-pulse{0%,100%{filter:brightness(1);opacity:.85}50%{filter:brightness(1.4);opacity:1}}
.ldsp-ver-num{background:rgba(255,255,255,.2);padding:2px 8px;border-radius:10px;color:#fff;font-weight:600;font-size:9px;backdrop-filter:blur(4px)}
.ldsp-site-ver{font-size:10px;color:#fff;text-align:center;font-weight:700;background:rgba(0,0,0,.25);padding:2px 7px;border-radius:6px;letter-spacing:.02em}
.ldsp-hdr-btns{display:flex;gap:6px;flex-shrink:0;position:relative;z-index:1}
.ldsp-hdr-btns button{width:30px;height:30px;border:none;background:rgba(255,255,255,.12);color:#fff;border-radius:var(--r-sm);cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;outline:none;-webkit-tap-highlight-color:transparent;backdrop-filter:blur(4px);transition:all .2s var(--ease)}
.ldsp-hdr-btns button:hover{background:rgba(255,255,255,.25);transform:translateY(-2px) scale(1.05);box-shadow:0 4px 12px rgba(0,0,0,.2)}
.ldsp-hdr-btns button:active{transform:translateY(0) scale(.95)}
.ldsp-hdr-btns button:focus{outline:none}
.ldsp-hdr-btns button:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
.ldsp-hdr-btns button.has-update{background:linear-gradient(135deg,var(--ok),var(--ok-light));animation:pulse-update 2s ease-in-out infinite;position:relative;box-shadow:0 0 15px rgba(16,185,129,.4)}
.ldsp-hdr-btns button.has-update::after{content:'';position:absolute;top:-3px;right:-3px;width:10px;height:10px;background:var(--err);border-radius:50%;border:2px solid rgba(0,0,0,.2);animation:pulse-dot 1.5s ease infinite}
@keyframes pulse-update{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes pulse-dot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.2);opacity:.7}}
.ldsp-update-bubble{position:absolute;top:52px;left:50%;transform:translateX(-50%) translateY(-10px);background:var(--bg-card);border:1px solid var(--border-accent);border-radius:var(--r-md);padding:16px 18px;text-align:center;z-index:100;box-shadow:var(--shadow-lg),var(--glow-accent);opacity:0;pointer-events:none;transition:all .3s var(--ease-spring);max-width:calc(100% - 24px);width:220px;backdrop-filter:blur(16px)}
.ldsp-update-bubble::before{content:'';position:absolute;top:-7px;left:50%;transform:translateX(-50%) rotate(45deg);width:12px;height:12px;background:var(--bg-card);border-left:1px solid var(--border-accent);border-top:1px solid var(--border-accent)}
.ldsp-update-bubble.show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto}
.ldsp-update-bubble-close{position:absolute;top:8px;right:10px;font-size:16px;cursor:pointer;color:var(--txt-mut);transition:all .2s;line-height:1;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:50%}
.ldsp-update-bubble-close:hover{color:var(--txt);background:var(--bg-hover)}
.ldsp-update-bubble-icon{font-size:28px;margin-bottom:8px;animation:bounce-in .5s var(--ease-spring)}
@keyframes bounce-in{0%{transform:scale(0)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
.ldsp-update-bubble-title{font-size:13px;font-weight:700;margin-bottom:6px;color:var(--txt);letter-spacing:-.01em}
.ldsp-update-bubble-ver{font-size:11px;margin-bottom:12px;color:var(--txt-sec)}
.ldsp-update-bubble-btn{background:var(--grad);color:#fff;border:none;padding:8px 20px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s var(--ease);box-shadow:0 4px 15px rgba(139,92,246,.3)}
.ldsp-update-bubble-btn:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 6px 20px rgba(139,92,246,.4)}
.ldsp-update-bubble-btn:active{transform:translateY(0) scale(.98)}
.ldsp-update-bubble-btn:disabled{opacity:.6;cursor:not-allowed;transform:none!important}
.ldsp-body{background:var(--bg)}
.ldsp-announcement{overflow:hidden;background:linear-gradient(90deg,rgba(59,130,246,.1),rgba(139,92,246,.1));border-bottom:1px solid var(--border);padding:0;height:0;opacity:0;transition:all .3s var(--ease)}
.ldsp-announcement.active{height:24px;opacity:1;padding:0 10px}
.ldsp-announcement.warning{background:linear-gradient(90deg,rgba(245,158,11,.15),rgba(239,68,68,.08))}
.ldsp-announcement.success{background:linear-gradient(90deg,rgba(16,185,129,.12),rgba(34,197,94,.08))}
.ldsp-announcement-inner{display:flex;align-items:center;height:24px;white-space:nowrap;animation:marquee var(--marquee-duration,20s) linear infinite}
.ldsp-announcement-inner:hover{animation-play-state:paused}
.ldsp-announcement-text{font-size:11px;font-weight:500;color:var(--txt-sec);display:flex;align-items:center;gap:6px;padding-right:50px}
.ldsp-announcement-text::before{content:'📢';font-size:12px}
.ldsp-announcement.warning .ldsp-announcement-text::before{content:'⚠️'}
.ldsp-announcement.success .ldsp-announcement-text::before{content:'🎉'}
@keyframes marquee{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
.ldsp-user{display:flex;align-items:center;gap:12px;padding:8px var(--pd);background:var(--bg-card);border-bottom:1px solid var(--border);position:relative;overflow:hidden}
.ldsp-user::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.3}
.ldsp-avatar{width:var(--av);height:var(--av);border-radius:12px;border:2px solid var(--accent);flex-shrink:0;background:var(--bg-el);position:relative;box-shadow:0 4px 12px rgba(139,92,246,.2);transition:all .3s var(--ease)}
.ldsp-avatar:hover{transform:scale(1.08) rotate(-3deg);border-color:var(--accent-light);box-shadow:0 6px 20px rgba(139,92,246,.35),var(--glow-accent);cursor:pointer}
.ldsp-avatar-ph{width:var(--av);height:var(--av);border-radius:12px;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;flex-shrink:0;cursor:pointer;transition:all .3s var(--ease);position:relative;box-shadow:0 4px 12px rgba(139,92,246,.25)}
.ldsp-avatar-ph:hover{transform:scale(1.08) rotate(-3deg);box-shadow:0 6px 20px rgba(139,92,246,.4)}
.ldsp-avatar-wrap{position:relative;flex-shrink:0}
.ldsp-avatar-wrap::after{content:'🔗 GitHub';position:absolute;bottom:-20px;left:50%;transform:translateX(-50%) translateY(4px);background:var(--bg-el);color:var(--txt-sec);padding:3px 8px;border-radius:6px;font-size:8px;white-space:nowrap;opacity:0;pointer-events:none;transition:all .2s var(--ease);border:1px solid var(--border2);box-shadow:0 4px 12px rgba(0,0,0,.2)}
.ldsp-avatar-wrap:hover::after{opacity:1;transform:translateX(-50%) translateY(0)}
.ldsp-user-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.ldsp-user-display-name{font-weight:700;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;letter-spacing:-.01em;background:linear-gradient(135deg,var(--txt) 0%,var(--txt-sec) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.ldsp-user-handle{font-size:12px;color:var(--txt-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.ldsp-user.not-logged .ldsp-avatar,.ldsp-user.not-logged .ldsp-avatar-ph{border:2px dashed var(--warn);cursor:pointer;animation:pulse-border 2s ease infinite}
@keyframes pulse-border{0%,100%{border-color:var(--warn)}50%{border-color:rgba(245,158,11,.4)}}
.ldsp-user.not-logged .ldsp-user-display-name{color:var(--warn);-webkit-text-fill-color:var(--warn);cursor:pointer}
.ldsp-login-hint{font-size:9px;color:var(--warn);margin-left:4px;animation:blink 1.5s ease-in-out infinite;background:var(--warn-bg);padding:2px 6px;border-radius:8px;font-weight:500}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.6}}
.ldsp-user-meta{display:flex;align-items:center;gap:8px;margin-top:3px}

.ldsp-reading{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 12px;border-radius:var(--r-md);min-width:75px;position:relative;overflow:visible;border:1px solid var(--border);transition:margin .3s var(--ease)}
.ldsp-reading::before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.05) 0%,transparent 100%);pointer-events:none}
.ldsp-reading-icon{font-size:20px;margin-bottom:3px;animation:bounce 2.5s ease-in-out infinite;filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.ldsp-reading-time{font-size:13px;font-weight:800;letter-spacing:-.02em}
.ldsp-reading-label{font-size:9px;opacity:.85;margin-top:2px;font-weight:600;letter-spacing:.02em}
.ldsp-reading{margin-bottom:18px;margin-top:4px;--rc:#94a3b8}
.ldsp-reading::after{content:'未活动 已停止记录';position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:9px;color:var(--err);white-space:nowrap;font-weight:600;letter-spacing:.02em;text-shadow:0 1px 3px rgba(0,0,0,.1);opacity:.8}
.ldsp-reading.tracking{animation:reading-glow 2s ease-in-out infinite}
.ldsp-reading.tracking::after{content:'阅读时间记录中...';color:var(--rc);opacity:1}
@keyframes reading-glow{0%,100%{box-shadow:0 0 8px color-mix(in srgb,var(--rc) 40%,transparent),0 0 16px color-mix(in srgb,var(--rc) 20%,transparent),0 0 24px color-mix(in srgb,var(--rc) 10%,transparent)}50%{box-shadow:0 0 16px color-mix(in srgb,var(--rc) 60%,transparent),0 0 32px color-mix(in srgb,var(--rc) 35%,transparent),0 0 48px color-mix(in srgb,var(--rc) 15%,transparent)}}
.ldsp-reading-ripple{position:absolute;inset:-2px;border-radius:inherit;pointer-events:none;z-index:-1;opacity:0}
.ldsp-reading.tracking .ldsp-reading-ripple{opacity:1}
.ldsp-reading.tracking .ldsp-reading-ripple::before,.ldsp-reading.tracking .ldsp-reading-ripple::after{content:'';position:absolute;inset:0;border-radius:inherit;border:2px solid var(--rc);opacity:.6;animation:ripple-expand 2.5s ease-out infinite}
.ldsp-reading.tracking .ldsp-reading-ripple::after{animation-delay:1.25s}
@keyframes ripple-expand{0%{transform:scale(1);opacity:.7;border-width:2px}100%{transform:scale(1.5);opacity:0;border-width:1px}}
.ldsp-reading.hi{box-shadow:0 0 20px rgba(249,115,22,.2)}
.ldsp-reading.hi .ldsp-reading-icon{animation:fire .6s ease-in-out infinite}
@keyframes fire{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
.ldsp-reading.max{box-shadow:0 0 25px rgba(236,72,153,.25)}
.ldsp-reading.max .ldsp-reading-icon{animation:crown 1.2s ease-in-out infinite}
@keyframes crown{0%,100%{transform:rotate(-8deg) scale(1)}50%{transform:rotate(8deg) scale(1.2)}}

.ldsp-tabs{display:flex;padding:10px 12px;gap:8px;background:var(--bg);border-bottom:1px solid var(--border)}
.ldsp-tab{flex:1;padding:8px 12px;border:none;background:var(--bg-card);color:var(--txt-sec);border-radius:var(--r-sm);cursor:pointer;font-size:11px;font-weight:600;transition:all .2s var(--ease);border:1px solid transparent}
.ldsp-tab:hover{background:var(--bg-hover);color:var(--txt);border-color:var(--border2);transform:translateY(-1px)}
.ldsp-tab.active{background:var(--grad);color:#fff;box-shadow:0 4px 15px rgba(139,92,246,.3);border-color:transparent}
.ldsp-content{max-height:calc(var(--h) - 180px);overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--accent) transparent}
.ldsp-content::-webkit-scrollbar{width:6px}
.ldsp-content::-webkit-scrollbar-track{background:transparent}
.ldsp-content::-webkit-scrollbar-thumb{background:linear-gradient(180deg,var(--accent),var(--accent2));border-radius:4px}
.ldsp-content::-webkit-scrollbar-thumb:hover{background:var(--accent-light)}
.ldsp-section{display:none;padding:10px}
.ldsp-section.active{display:block;animation:enter var(--dur) var(--ease-out)}
@keyframes enter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.ldsp-ring{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--bg-card);border-radius:var(--r-md);margin-bottom:10px;position:relative;overflow:hidden;border:1px solid var(--border);gap:12px}
.ldsp-ring::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 0%,rgba(139,92,246,.08) 0%,transparent 70%);pointer-events:none}
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
.ldsp-ring-val{font-size:18px;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-.02em}
.ldsp-ring-val.anim{animation:val 1s var(--ease-spring) .5s forwards;opacity:0}
@keyframes val{from{opacity:0;transform:scale(.6)}60%{transform:scale(1.1)}to{opacity:1;transform:scale(1)}}
.ldsp-ring-lbl{font-size:9px;color:var(--txt-mut);margin-top:2px;font-weight:500}
.ldsp-ring-lvl{font-size:12px;font-weight:700;margin-top:8px;padding:4px 14px;border-radius:12px;background-image:linear-gradient(90deg,#64748b 0%,#94a3b8 50%,#64748b 100%);background-size:200% 100%;background-position:0% 50%;color:#fff;box-shadow:0 2px 10px rgba(100,116,139,.35);letter-spacing:.03em;text-shadow:0 1px 2px rgba(0,0,0,.2);cursor:pointer;transition:transform 2s ease;transform-style:preserve-3d;animation:lvl-shimmer 4s ease-in-out infinite}
.ldsp-ring-lvl:hover{transform:rotateY(360deg);animation-play-state:paused}
.ldsp-ring-lvl.lv1{background-image:linear-gradient(90deg,#64748b 0%,#94a3b8 50%,#64748b 100%);box-shadow:0 2px 10px rgba(100,116,139,.35);animation-duration:4s}
.ldsp-ring-lvl.lv2{background-image:linear-gradient(90deg,#3b82f6 0%,#60a5fa 50%,#3b82f6 100%);box-shadow:0 2px 10px rgba(59,130,246,.4);animation-duration:3.5s}
.ldsp-ring-lvl.lv3{background-image:linear-gradient(90deg,#7c3aed 0%,#a78bfa 30%,#06b6d4 70%,#7c3aed 100%);box-shadow:0 2px 12px rgba(139,92,246,.45);animation-duration:3s}
.ldsp-ring-lvl.lv4{background-image:linear-gradient(90deg,#f59e0b 0%,#fbbf24 25%,#f97316 50%,#ef4444 75%,#f59e0b 100%);box-shadow:0 2px 15px rgba(245,158,11,.5),0 0 20px rgba(249,115,22,.3);animation-duration:2.5s;animation-name:lvl-shimmer-gold}
@keyframes lvl-shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes lvl-shimmer-gold{0%,100%{background-position:0% 50%;filter:brightness(1)}50%{background-position:100% 50%;filter:brightness(1.2)}}
.ldsp-confetti{position:absolute;width:100%;height:100%;top:0;left:0;pointer-events:none;overflow:visible;z-index:10}
.ldsp-confetti-piece{position:absolute;font-size:12px;opacity:0;top:42%;left:50%;transform-origin:center center;text-shadow:0 1px 3px rgba(0,0,0,.3)}
.ldsp-ring.complete.anim-done .ldsp-confetti-piece{animation:confetti-burst 2s cubic-bezier(.15,.8,.3,1) forwards}
@keyframes confetti-burst{0%{opacity:1;transform:translate(-50%,-50%) scale(0)}5%{opacity:1;transform:translate(-50%,-50%) scale(1.5)}25%{opacity:1;transform:translate(calc(var(--tx) * 1.2),calc(var(--ty) * 1.2)) rotate(calc(var(--rot) * 0.4)) scale(1.1)}100%{opacity:0;transform:translate(calc(var(--tx) + var(--drift)),calc(var(--ty) + 110px)) rotate(var(--rot)) scale(0.2)}}
.ldsp-ring-tip{font-size:11px;text-align:center;margin:12px 0 16px;padding:8px 14px;border-radius:20px;font-weight:600;letter-spacing:.02em}
.ldsp-ring-tip.ok{color:var(--ok);background:linear-gradient(135deg,var(--ok-bg),rgba(16,185,129,.05));border:1px solid rgba(16,185,129,.2)}
.ldsp-ring-tip.progress{color:var(--accent);background:linear-gradient(135deg,rgba(139,92,246,.1),rgba(6,182,212,.05));border:1px solid rgba(139,92,246,.2)}
.ldsp-ring-tip.max{color:var(--warn);background:linear-gradient(135deg,rgba(251,191,36,.1),rgba(249,115,22,.05));border:1px solid rgba(251,191,36,.25)}
.ldsp-item{display:flex;align-items:center;padding:8px 10px;margin-bottom:6px;background:var(--bg-card);border-radius:var(--r-sm);border-left:3px solid var(--border2);animation:item var(--dur) var(--ease-out) backwards;transition:all .2s var(--ease);border:1px solid var(--border);border-left-width:3px}
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
.ldsp-item-cur{color:var(--txt);transition:all .3s var(--ease)}
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
.ldsp-subtabs{display:flex;align-items:center;gap:6px;padding:1px 0 6px;overflow-x:auto;scrollbar-width:thin;scrollbar-color:var(--accent) transparent}
.ldsp-subtabs::-webkit-scrollbar{height:4px}
.ldsp-subtabs::-webkit-scrollbar-track{background:var(--bg-el);border-radius:2px}
.ldsp-subtabs::-webkit-scrollbar-thumb{background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:2px}
.ldsp-subtab{padding:6px 12px;border:1px solid var(--border2);background:var(--bg-card);color:var(--txt-sec);border-radius:20px;cursor:pointer;font-size:10px;font-weight:600;white-space:nowrap;flex-shrink:0;transition:all .2s var(--ease)}
.ldsp-subtab:hover{border-color:var(--accent);color:var(--accent);background:rgba(139,92,246,.08);transform:translateY(-1px)}
.ldsp-subtab.active{background:var(--grad);border-color:transparent;color:#fff;box-shadow:0 4px 12px rgba(139,92,246,.25)}
.ldsp-chart{background:var(--bg-card);border-radius:var(--r-md);padding:12px;margin-bottom:10px;border:1px solid var(--border);position:relative;overflow:hidden}
.ldsp-chart::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.2}
.ldsp-chart:last-child{margin-bottom:0}
.ldsp-chart-title{font-size:12px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px;color:var(--txt)}
.ldsp-chart-sub{font-size:10px;color:var(--txt-mut);font-weight:500;margin-left:auto}
.ldsp-spark-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.ldsp-spark-row:last-child{margin-bottom:0}
.ldsp-spark-lbl{width:55px;font-size:10px;color:var(--txt-sec);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}
.ldsp-spark-bars{flex:1;display:flex;align-items:flex-end;gap:3px;height:24px}
.ldsp-spark-bar{flex:1;background:linear-gradient(180deg,var(--accent),var(--accent2));border-radius:3px 3px 0 0;min-height:3px;opacity:.35;position:relative;transition:all .2s var(--ease)}
.ldsp-spark-bar:last-child{opacity:1}
.ldsp-spark-bar:hover{opacity:1;transform:scaleY(1.15);box-shadow:0 -4px 12px rgba(139,92,246,.3)}
.ldsp-spark-bar::after{content:attr(data-v);position:absolute;bottom:100%;left:50%;transform:translateX(-50%) translateY(5px);font-size:9px;background:var(--bg-el);padding:3px 6px;border-radius:4px;opacity:0;white-space:nowrap;pointer-events:none;border:1px solid var(--border2);box-shadow:0 4px 12px rgba(0,0,0,.2);transition:all .15s var(--ease)}
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
.ldsp-rd-stats{background:var(--bg-card);border-radius:var(--r-md);padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px;border:1px solid var(--border);position:relative;overflow:hidden}
.ldsp-rd-stats::before{content:'';position:absolute;right:-20px;top:-20px;width:80px;height:80px;background:radial-gradient(circle,var(--accent) 0%,transparent 70%);opacity:.08;pointer-events:none}
.ldsp-rd-stats-icon{font-size:32px;flex-shrink:0;filter:drop-shadow(0 2px 8px rgba(0,0,0,.2))}
.ldsp-rd-stats-info{flex:1}
.ldsp-rd-stats-val{font-size:18px;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-.02em}
.ldsp-rd-stats-lbl{font-size:10px;color:var(--txt-mut);margin-top:3px;font-weight:500}
.ldsp-rd-stats-badge{padding:4px 10px;border-radius:12px;font-size:10px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.1)}
.ldsp-track{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-card);border-radius:var(--r-sm);margin-bottom:10px;font-size:10px;color:var(--txt-mut);border:1px solid var(--border);font-weight:500}
.ldsp-track-dot{width:8px;height:8px;border-radius:50%;background:var(--ok);animation:pulse 2s ease-in-out infinite;box-shadow:0 0 10px rgba(16,185,129,.4)}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1);box-shadow:0 0 10px rgba(16,185,129,.4)}50%{opacity:.6;transform:scale(.85);box-shadow:0 0 5px rgba(16,185,129,.2)}}
.ldsp-rd-prog{background:var(--bg-card);border-radius:var(--r-md);padding:12px;margin-bottom:10px;border:1px solid var(--border)}
.ldsp-rd-prog-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.ldsp-rd-prog-title{font-size:11px;color:var(--txt-sec);font-weight:600}
.ldsp-rd-prog-val{font-size:12px;font-weight:700;color:var(--accent)}
.ldsp-rd-prog-bar{height:8px;background:var(--bg-el);border-radius:4px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.1)}
.ldsp-rd-prog-fill{height:100%;border-radius:4px;transition:width .5s var(--ease);position:relative}
.ldsp-rd-prog-fill::after{content:'';position:absolute;top:0;left:0;right:0;height:50%;background:linear-gradient(180deg,rgba(255,255,255,.2) 0%,transparent 100%);border-radius:4px 4px 0 0}
.ldsp-rd-week{display:flex;justify-content:space-between;align-items:flex-end;height:55px;padding:0 4px;margin:12px 0 8px;gap:4px}
.ldsp-rd-day{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}
.ldsp-rd-day-bar{width:100%;max-width:18px;background:linear-gradient(180deg,var(--accent) 0%,var(--accent2) 100%);border-radius:4px 4px 0 0;min-height:3px;cursor:pointer;position:relative;transition:all .2s var(--ease)}
.ldsp-rd-day-bar:hover{transform:scaleX(1.2);box-shadow:0 -4px 15px rgba(139,92,246,.3)}
.ldsp-rd-day-bar::after{content:attr(data-t);position:absolute;bottom:100%;left:50%;transform:translateX(-50%) translateY(5px);background:var(--bg-el);padding:4px 8px;border-radius:6px;font-size:9px;font-weight:600;white-space:nowrap;opacity:0;pointer-events:none;margin-bottom:4px;border:1px solid var(--border2);box-shadow:0 4px 12px rgba(0,0,0,.2);transition:all .15s var(--ease)}
.ldsp-rd-day-bar:hover::after{opacity:1;transform:translateX(-50%) translateY(0)}
.ldsp-rd-day-lbl{font-size:9px;color:var(--txt-mut);line-height:1;font-weight:500}
.ldsp-today-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px}
.ldsp-today-stat{background:var(--bg-card);border-radius:var(--r-md);padding:12px 10px;text-align:center;border:1px solid var(--border);position:relative;overflow:hidden;transition:all .2s var(--ease)}
.ldsp-today-stat:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.1)}
.ldsp-today-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--grad)}
.ldsp-today-stat-val{font-size:18px;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-.02em}
.ldsp-today-stat-lbl{font-size:10px;color:var(--txt-mut);margin-top:4px;font-weight:500}
.ldsp-time-info{font-size:10px;color:var(--txt-mut);text-align:center;padding:8px 10px;background:var(--bg-card);border-radius:var(--r-sm);margin-bottom:10px;border:1px solid var(--border);font-weight:500}
.ldsp-time-info span{color:var(--accent);font-weight:700}
.ldsp-year-heatmap{padding:10px 14px 10px 0;overflow-x:hidden;overflow-y:auto;max-height:320px}
.ldsp-year-wrap{display:flex;flex-direction:column;gap:3px;width:100%;padding-right:6px}
.ldsp-year-row{display:flex;align-items:center;gap:4px;width:100%;position:relative}
.ldsp-year-month{width:28px;font-size:8px;font-weight:600;color:var(--txt-mut);text-align:right;flex-shrink:0;line-height:1;position:absolute;left:0;top:50%;transform:translateY(-50%)}
.ldsp-year-cells{display:grid;grid-template-columns:repeat(14,minmax(9px,1fr));gap:3px;width:100%;align-items:center;margin-left:32px}
.ldsp-year-cell{width:100%;aspect-ratio:1;border-radius:3px;background:var(--bg-card);border:1px solid var(--border);cursor:pointer;position:relative;transition:all .15s var(--ease)}
.ldsp-year-cell:hover{transform:scale(1.6);box-shadow:0 4px 15px rgba(139,92,246,.4);border-color:var(--accent);z-index:10}
.ldsp-year-cell.l0{background:rgba(139,92,246,.06);border-color:rgba(139,92,246,.12)}
.ldsp-year-cell.l1{background:rgba(139,92,246,.2);border-color:rgba(139,92,246,.3)}
.ldsp-year-cell.l2{background:rgba(139,92,246,.4);border-color:rgba(139,92,246,.5)}
.ldsp-year-cell.l3{background:rgba(139,92,246,.6);border-color:rgba(139,92,246,.7)}
.ldsp-year-cell.l4{background:linear-gradient(135deg,var(--accent),var(--accent2));border-color:var(--accent);box-shadow:0 0 8px rgba(139,92,246,.3)}
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
.ldsp-spinner{width:28px;height:28px;border:3px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 10px}
@keyframes spin{to{transform:rotate(360deg)}}
.ldsp-mini-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50px 20px;color:var(--txt-mut)}
.ldsp-mini-spin{width:32px;height:32px;border:3px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;margin-bottom:14px}
.ldsp-mini-txt{font-size:11px;font-weight:500}
.ldsp-toast{position:absolute;bottom:-55px;left:50%;transform:translateX(-50%) translateY(15px);background:var(--grad);color:#fff;padding:10px 18px;border-radius:20px;font-size:12px;font-weight:600;box-shadow:0 8px 30px rgba(139,92,246,.4);opacity:0;white-space:nowrap;display:flex;align-items:center;gap:8px;z-index:100000;transition:all .3s var(--ease-spring)}
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
.ldsp-modal-btn{flex:1;padding:12px 18px;border:none;border-radius:var(--r-md);font-size:13px;font-weight:600;cursor:pointer;transition:all .2s var(--ease)}
.ldsp-modal-btn.primary{background:var(--grad);color:#fff;box-shadow:0 4px 15px rgba(139,92,246,.3)}
.ldsp-modal-btn.primary:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(139,92,246,.4)}
.ldsp-modal-btn.primary:active{transform:translateY(0)}
.ldsp-modal-btn.secondary{background:var(--bg-el);color:var(--txt-sec);border:1px solid var(--border2)}
.ldsp-modal-btn.secondary:hover{background:var(--bg-hover);border-color:var(--border-accent)}
.ldsp-modal-note{margin-top:14px;font-size:11px;color:var(--txt-mut);text-align:center;font-weight:500}
.ldsp-no-chg{text-align:center;padding:18px;color:var(--txt-mut);font-size:11px;font-weight:500}
.ldsp-lb-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-card);border-radius:var(--r-md);margin-bottom:10px;border:1px solid var(--border)}
.ldsp-lb-status{display:flex;align-items:center;gap:10px}
.ldsp-lb-dot{width:10px;height:10px;border-radius:50%;background:var(--txt-mut);transition:all .3s}
.ldsp-lb-dot.joined{background:var(--ok);box-shadow:0 0 10px rgba(16,185,129,.4)}
.ldsp-lb-btn{padding:8px 14px;border:none;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s var(--ease)}
.ldsp-lb-btn.primary{background:var(--grad);color:#fff;box-shadow:0 4px 12px rgba(139,92,246,.25)}
.ldsp-lb-btn.primary:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(139,92,246,.4)}
.ldsp-lb-btn.primary:active{transform:translateY(0)}
.ldsp-lb-btn.secondary{background:var(--bg-el);color:var(--txt-sec);border:1px solid var(--border2)}
.ldsp-lb-btn.secondary:hover{background:var(--bg-hover);border-color:var(--border-accent)}
.ldsp-lb-btn.danger{background:var(--err-bg);color:var(--err);border:1px solid rgba(244,63,94,.3)}
.ldsp-lb-btn.danger:hover{background:var(--err);color:#fff;box-shadow:0 4px 12px rgba(244,63,94,.3)}
.ldsp-lb-btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
.ldsp-rank-list{display:flex;flex-direction:column;gap:6px}
.ldsp-rank-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-card);border-radius:var(--r-md);animation:item var(--dur) var(--ease-out) backwards;border:1px solid var(--border);transition:all .2s var(--ease)}
.ldsp-rank-item:hover{background:var(--bg-hover);transform:translateX(4px);box-shadow:0 4px 15px rgba(0,0,0,.1)}
.ldsp-rank-item.t1{background:linear-gradient(135deg,rgba(255,215,0,.12) 0%,rgba(255,185,0,.05) 100%);border:1px solid rgba(255,215,0,.35);box-shadow:0 4px 20px rgba(255,215,0,.15)}
.ldsp-rank-item.t2{background:linear-gradient(135deg,rgba(192,192,192,.12) 0%,rgba(160,160,160,.05) 100%);border:1px solid rgba(192,192,192,.35)}
.ldsp-rank-item.t3{background:linear-gradient(135deg,rgba(205,127,50,.12) 0%,rgba(181,101,29,.05) 100%);border:1px solid rgba(205,127,50,.35)}
.ldsp-rank-item.me{border-left:3px solid var(--accent);box-shadow:0 0 15px rgba(139,92,246,.1)}
.ldsp-rank-num{width:28px;height:28px;border-radius:10px;background:var(--bg-el);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--txt-sec);flex-shrink:0}
.ldsp-rank-item.t1 .ldsp-rank-num{background:linear-gradient(135deg,#ffd700 0%,#ffb700 100%);color:#1a1a1a;font-size:14px;box-shadow:0 4px 12px rgba(255,215,0,.4)}
.ldsp-rank-item.t2 .ldsp-rank-num{background:linear-gradient(135deg,#e0e0e0 0%,#b0b0b0 100%);color:#1a1a1a;box-shadow:0 4px 12px rgba(192,192,192,.4)}
.ldsp-rank-item.t3 .ldsp-rank-num{background:linear-gradient(135deg,#cd7f32 0%,#b5651d 100%);color:#fff;box-shadow:0 4px 12px rgba(205,127,50,.4)}
.ldsp-rank-avatar{width:32px;height:32px;border-radius:10px;border:2px solid var(--border2);flex-shrink:0;background:var(--bg-el);transition:all .2s var(--ease)}
.ldsp-rank-item:hover .ldsp-rank-avatar{transform:scale(1.05)}
.ldsp-rank-item.t1 .ldsp-rank-avatar{border-color:#ffd700;box-shadow:0 0 12px rgba(255,215,0,.3)}
.ldsp-rank-item.t2 .ldsp-rank-avatar{border-color:#c0c0c0}
.ldsp-rank-item.t3 .ldsp-rank-avatar{border-color:#cd7f32}
.ldsp-rank-info{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:3px 5px}
.ldsp-rank-name{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldsp-rank-display-name{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:85px}
.ldsp-rank-username{font-size:10px;color:var(--txt-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.ldsp-rank-name-only{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldsp-rank-me-tag{font-size:10px;color:var(--accent);margin-left:3px;font-weight:600;background:rgba(139,92,246,.1);padding:1px 6px;border-radius:8px}
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
.ldsp-lb-refresh{background:var(--bg-el);border:none;cursor:pointer;font-size:11px;padding:4px 8px;border-radius:6px;transition:all .2s var(--ease);opacity:.8}
.ldsp-lb-refresh:hover{opacity:1;background:var(--bg-hover);transform:scale(1.05)}
.ldsp-lb-refresh:active{transform:scale(.95)}
.ldsp-lb-refresh.spinning{animation:ldsp-spin .8s linear infinite}
.ldsp-lb-refresh:disabled{opacity:.4;cursor:not-allowed;transform:none!important}
@keyframes ldsp-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.ldsp-my-rank{display:flex;align-items:center;justify-content:space-between;padding:14px;background:var(--grad);border-radius:var(--r-md);margin-bottom:10px;color:#fff;position:relative;overflow:hidden;box-shadow:0 8px 25px rgba(139,92,246,.3)}
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
@media (prefers-reduced-motion:reduce){#ldsp-panel,#ldsp-panel *{animation-duration:.01ms!important;transition-duration:.01ms!important}}
@media (min-width:1920px){#ldsp-panel{--w:340px;--fs:13px;--pd:16px;--av:50px;--ring:85px}}
@media (max-height:700px){#ldsp-panel{top:60px}.ldsp-content{max-height:calc(100vh - 240px)}}
@media (max-width:1200px){#ldsp-panel{right:10px;left:auto}}
@media (max-width:768px){#ldsp-panel{--w:290px;--fs:12px;--pd:11px;right:8px;left:auto;top:60px}#ldsp-panel.collapsed{width:42px!important;height:42px!important}#ldsp-panel.collapsed .ldsp-toggle{font-size:16px}.ldsp-hdr{padding:8px 10px}.ldsp-site-icon{width:22px;height:22px;border-radius:6px}.ldsp-site-ver{font-size:8px;padding:1px 5px}.ldsp-title{font-size:13px}.ldsp-ver{font-size:9px}.ldsp-hdr-btns{gap:4px}.ldsp-hdr-btns button{width:26px;height:26px;font-size:12px}.ldsp-update-bubble{width:200px;padding:14px 16px}.ldsp-content{max-height:calc(100vh - 240px)}.ldsp-rank-item{padding:10px}.ldsp-rank-num{width:26px;height:26px}.ldsp-rank-avatar{width:30px;height:30px}}
@media (max-width:480px){#ldsp-panel{--w:270px;--av:36px;--ring:68px;right:6px;left:auto;top:55px;border-radius:var(--r-md)}#ldsp-panel.collapsed{width:38px!important;height:38px!important;border-radius:10px}#ldsp-panel.collapsed .ldsp-toggle{font-size:14px}.ldsp-hdr{padding:6px 8px}.ldsp-hdr-info{gap:6px}.ldsp-hdr-btns{gap:3px}.ldsp-hdr-btns button{width:24px;height:24px;font-size:11px;border-radius:6px}.ldsp-site-icon{width:20px;height:20px;border-radius:5px}.ldsp-site-ver{font-size:7px;padding:1px 4px}.ldsp-title{font-size:12px}.ldsp-ver{font-size:8px}.ldsp-user{padding:10px;gap:10px}.ldsp-reading{min-width:65px;padding:6px 8px;margin-bottom:20px}.ldsp-reading-icon{font-size:16px}.ldsp-reading-time{font-size:11px}.ldsp-reading-label{font-size:8px}.ldsp-tabs{padding:8px 10px;gap:6px}.ldsp-tab{padding:6px 10px;font-size:10px;border-radius:var(--r-sm)}.ldsp-section{padding:8px}.ldsp-rank-item{padding:8px 10px}.ldsp-rank-num{width:24px;height:24px;font-size:10px;border-radius:8px}.ldsp-rank-avatar{width:28px;height:28px;border-radius:8px}.ldsp-rank-display-name,.ldsp-rank-name-only{font-size:11px}.ldsp-rank-time{font-size:12px}.ldsp-my-rank{padding:10px}.ldsp-my-rank-val{font-size:16px}.ldsp-subtab{padding:5px 10px;font-size:9px}}
@media (max-height:500px){#ldsp-panel{top:40px}.ldsp-content{max-height:calc(100vh - 180px)}.ldsp-user{padding:8px}.ldsp-reading{display:none}.ldsp-tabs{padding:6px 8px}.ldsp-section{padding:6px}}`;
        }
    };

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
            const currentLevel = level !== null ? level : (this.panel.cachedLevel || 2);
            if (level !== null) this.panel.cachedLevel = level;
            
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

            const confettiColors = ['#7c3aed', '#06b6d4', '#f97316', '#22c55e', '#eab308', '#ec4899', '#f43f5e', '#8b5cf6'];
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
                            <defs><linearGradient id="ldsp-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#7c3aed"/><stop offset="100%" style="stop-color:#06b6d4"/></linearGradient></defs>
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

        // 渲染阅读卡片
        renderReading(minutes, isTracking = true) {
            const lv = Utils.getReadingLevel(minutes);
            const $ = this.panel.$;
            $.readingIcon.textContent = lv.icon;
            $.readingTime.textContent = Utils.formatReadingTime(minutes);
            $.readingLabel.textContent = lv.label;
            // 设置背景色和--rc变量(用于波浪和追踪文字颜色)
            $.reading.style.cssText = `background:${lv.bg};color:${lv.color};--rc:${lv.color}`;
            $.readingTime.style.color = lv.color;
            $.readingLabel.style.color = lv.color;
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

            const changes = reqs.map(r => ({
                name: Utils.simplifyName(r.name),
                diff: r.currentValue - (todayData.startData[r.name] || 0)
            })).filter(c => c.diff !== 0).sort((a, b) => b.diff - a.diff);

            const pos = changes.filter(c => c.diff > 0).length;
            const neg = changes.filter(c => c.diff < 0).length;

            let changeHtml = changes.length > 0
                ? `<div class="ldsp-chart"><div class="ldsp-chart-title">📊 今日变化明细</div><div class="ldsp-changes">${
                    changes.map(c => `<div class="ldsp-chg-row"><span class="ldsp-chg-name">${c.name}</span><span class="ldsp-chg-val ${c.diff > 0 ? 'up' : 'down'}">${c.diff > 0 ? '+' : ''}${c.diff}</span></div>`).join('')
                }</div></div>`
                : `<div class="ldsp-no-chg">今日暂无数据变化</div>`;

            return `
                <div class="ldsp-time-info">今日 00:00 ~ ${nowStr} (首次记录于 ${startStr})</div>
                <div class="ldsp-rd-stats">
                    <div class="ldsp-rd-stats-icon">${lv.icon}</div>
                    <div class="ldsp-rd-stats-info"><div class="ldsp-rd-stats-val">${Utils.formatReadingTime(readingTime)}</div><div class="ldsp-rd-stats-lbl">今日累计阅读</div></div>
                    <div class="ldsp-rd-stats-badge" style="background:${lv.bg};color:${lv.color}">${lv.label}</div>
                </div>
                <div class="ldsp-rd-prog">
                    <div class="ldsp-rd-prog-hdr"><span class="ldsp-rd-prog-title">📖 阅读目标 (10小时)</span><span class="ldsp-rd-prog-val">${Math.round(pct)}%</span></div>
                    <div class="ldsp-rd-prog-bar"><div class="ldsp-rd-prog-fill" style="width:${pct}%;background:${lv.bg.replace('0.15', '1')}"></div></div>
                </div>
                <div class="ldsp-today-stats">
                    <div class="ldsp-today-stat"><div class="ldsp-today-stat-val">${pos}</div><div class="ldsp-today-stat-lbl">📈 增长项</div></div>
                    <div class="ldsp-today-stat"><div class="ldsp-today-stat-val">${neg}</div><div class="ldsp-today-stat-lbl">📉 下降项</div></div>
                </div>
                ${changeHtml}`;
        }

        // 渲染周趋势
        renderWeekTrend(history, reqs, historyMgr, tracker) {
            const weekAgo = Date.now() - 7 * 86400000;
            const recent = history.filter(h => h.ts > weekAgo);
            if (recent.length < 1) {
                return `<div class="ldsp-empty"><div class="ldsp-empty-icon">📅</div><div class="ldsp-empty-txt">本周数据不足<br>每天访问积累数据</div></div>`;
            }

            let html = this._renderWeekChart(tracker);
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

            return html;
        }

        // 渲染月趋势
        renderMonthTrend(history, reqs, historyMgr, tracker) {
            // 只要有数据就尝试显示
            if (history.length < 1) {
                return `<div class="ldsp-empty"><div class="ldsp-empty-icon">📊</div><div class="ldsp-empty-txt">本月数据不足<br>请继续访问积累数据</div></div>`;
            }

            let html = this._renderMonthChart(tracker);
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

            return html;
        }

        // 渲染年趋势
        renderYearTrend(history, reqs, historyMgr, tracker) {
            const yearAgo = Date.now() - 365 * 86400000;
            const recent = history.filter(h => h.ts > yearAgo);
            // 只要有数据就尝试显示
            if (recent.length < 1) {
                return `<div class="ldsp-empty"><div class="ldsp-empty-icon">📈</div><div class="ldsp-empty-txt">本年数据不足<br>请持续使用积累数据</div></div>`;
            }

            let html = this._renderYearChart(tracker);
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

            return html;
        }

        // 渲染全部趋势
        renderAllTrend(history, reqs, tracker) {
            if (history.length < 1) {
                return `<div class="ldsp-empty"><div class="ldsp-empty-icon">🌐</div><div class="ldsp-empty-txt">暂无历史数据<br>继续浏览，数据会自动记录</div></div>`;
            }

            const oldest = history[0], newest = history.at(-1);
            // 计算记录天数（实际有数据的天数）
            const recordDays = history.length;
            // 计算跨度天数（从最早记录到现在的天数）
            const spanDays = Math.ceil((Date.now() - oldest.ts) / 86400000);
            
            const total = tracker.getTotalTime();
            // 使用实际有阅读记录的天数来计算日均
            const readingData = tracker.storage.get('readingTime', null);
            const actualReadingDays = readingData?.dailyData ? Object.keys(readingData.dailyData).length : recordDays;
            const avg = Math.round(total / Math.max(actualReadingDays, 1));
            const lv = Utils.getReadingLevel(avg);

            let html = `<div class="ldsp-time-info">共记录 <span>${recordDays}</span> 天数据${spanDays > recordDays ? ` · 跨度 ${spanDays} 天` : ''}</div>`;

            // 累计阅读时间统计
            if (total > 0) {
                html += `<div class="ldsp-rd-stats">
                    <div class="ldsp-rd-stats-icon">📚</div>
                    <div class="ldsp-rd-stats-info"><div class="ldsp-rd-stats-val">${Utils.formatReadingTime(total)}</div><div class="ldsp-rd-stats-lbl">累计阅读时间 · 日均 ${Utils.formatReadingTime(avg)}</div></div>
                    <div class="ldsp-rd-stats-badge" style="background:${lv.bg};color:${lv.color}">${lv.label}</div>
                </div>`;
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
                // 计算每日平均增量
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
            const bars = days.map(day => {
                const h = max > 0 ? (day.mins > 0 ? Math.max(day.mins / max * 45, 2) : 1) : 1;
                const op = day.isFuture ? 0.35 : (day.isToday ? 1 : 0.75);
                const timeStr = day.isFuture ? '0分钟 (未到)' : Utils.formatReadingTime(day.mins);
                return `<div class="ldsp-rd-day" style="margin:0 1px;flex:1;min-width:2px"><div class="ldsp-rd-day-bar" style="height:${h}px;opacity:${op};background:var(--accent2);width:100%;border-radius:3px 3px 0 0" data-t="${day.d}日: ${timeStr}"></div><div class="ldsp-rd-day-lbl" style="margin-top:3px">${day.d}</div></div>`;
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
            for (let i = 0; i <= 4; i++) html += `<div class="ldsp-heatmap-legend-cell" style="background:${i === 0 ? 'rgba(124,58,237,.08)' : i === 4 ? 'var(--accent)' : `rgba(124,58,237,${0.1 + i * 0.15})`}"></div>`;
            html += `<span>&gt;3小时</span></div></div></div>`;

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
            data.rankings.forEach((user, i) => {
                const rank = i + 1;
                const isMe = userId && user.user_id === userId;
                const cls = [rank <= 3 ? `t${rank}` : '', isMe ? 'me' : ''].filter(Boolean).join(' ');
                const icon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
                const avatar = user.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `https://linux.do${user.avatar_url}`) : '';
                // XSS 防护：转义用户名和显示名称
                const safeUsername = Utils.escapeHtml(Utils.sanitize(user.username, 30));
                const safeName = Utils.escapeHtml(Utils.sanitize(user.name, 100));
                const hasName = safeName && safeName.trim();
                const nameHtml = hasName 
                    ? `<span class="ldsp-rank-display-name">${safeName}</span><span class="ldsp-rank-username">@${safeUsername}</span>`
                    : `<span class="ldsp-rank-name-only">${safeUsername}</span>`;

                html += `<div class="ldsp-rank-item ${cls}" style="animation-delay:${i * 30}ms">
                    <div class="ldsp-rank-num">${rank <= 3 ? icon : rank}</div>
                    ${avatar ? `<img class="ldsp-rank-avatar" src="${avatar}" alt="${safeUsername}" onerror="this.style.display='none'">` : '<div class="ldsp-rank-avatar" style="display:flex;align-items:center;justify-content:center;font-size:12px">👤</div>'}
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
    }

    // ==================== 主面板类 ====================
    class Panel {
        constructor() {
            // 初始化管理器
            this.storage = new Storage();
            this.network = new Network();
            this.historyMgr = new HistoryManager(this.storage);
            this.tracker = new ReadingTracker(this.storage);
            this.notifier = new Notifier(this.storage);

            // 排行榜相关（仅 linux.do）
            this.hasLeaderboard = CURRENT_SITE.supportsLeaderboard;
            if (this.hasLeaderboard) {
                this.oauth = new OAuthManager(this.storage, this.network);
                this.leaderboard = new LeaderboardManager(this.oauth, this.tracker, this.storage);
                this.cloudSync = new CloudSyncManager(this.storage, this.oauth, this.tracker);
                this.cloudSync.setHistoryManager(this.historyMgr);  // 设置历史管理器引用
                this.lbTab = this.storage.getGlobal('leaderboardTab', 'daily');
            }

            // 状态变量
            this.prevReqs = [];
            this.trendTab = this.storage.getGlobal('trendTab', 'today');
            if (['last', '7d'].includes(this.trendTab)) {
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

            // 初始化UI
            Styles.inject();
            this._createPanel();
            this.renderer = new Renderer(this);
            this._bindEvents();
            this._restore();
            this._fetchAvatar();
            this.fetch();

            // 云同步初始化
            if (this.hasLeaderboard) {
                // 注册同步状态回调，更新顶部按钮状态
                this.cloudSync.setSyncStateCallback(syncing => {
                    if (this.$.btnCloudSync) {
                        this.$.btnCloudSync.disabled = syncing;
                        this.$.btnCloudSync.textContent = syncing ? '⏳' : '☁️';
                        this.$.btnCloudSync.title = syncing ? '同步中...' : '云同步';
                    }
                });

                if (this.oauth.isLoggedIn()) {
                    // 确保 storage 使用正确的用户名（从 OAuth 用户信息同步）
                    const oauthUser = this.oauth.getUserInfo();
                    console.log('[CloudSync] OAuth user:', oauthUser?.username);
                    console.log('[CloudSync] Storage user before:', this.storage.getUser());
                    if (oauthUser?.username) {
                        const currentUser = this.storage.getUser();
                        if (currentUser !== oauthUser.username) {
                            console.log('[CloudSync] User mismatch, syncing:', currentUser, '->', oauthUser.username);
                            this.storage.setUser(oauthUser.username);
                            this.storage.invalidateCache();  // 清除缓存确保使用新 key
                            this.storage.migrate(oauthUser.username);
                        }
                        // 使用 OAuth 用户信息更新界面（即使 connect API 失败也能显示用户信息）
                        this._updateUserInfoFromOAuth(oauthUser);
                    }
                    console.log('[CloudSync] Storage user after:', this.storage.getUser());
                    // 串行化同步请求，避免并发压力
                    this.cloudSync.onPageLoad().then(() => {
                        // reading 同步完成后再同步 requirements
                        return this.cloudSync.syncRequirementsOnLoad();
                    }).catch(e => console.warn('[CloudSync] Sync error:', e));
                    this._syncPrefs();
                    if (this.oauth.isJoined()) this.leaderboard.startSync();
                    this._updateLoginUI();
                } else {
                    this._checkLoginPrompt();
                }
            }

            // 事件监听
            window.addEventListener('resize', Utils.debounce(() => this._onResize(), 250));
            setInterval(() => this.fetch(), CONFIG.INTERVALS.REFRESH);
            
            // 自动检查版本更新（首次进入时显示气泡）
            setTimeout(() => this._checkUpdate(true), 2000);
            
            // 加载系统公告（延迟加载，不影响主要功能）
            setTimeout(() => this._loadAnnouncement(), 1500);
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
                        <button class="ldsp-update" title="检查更新">🔍</button>
                        <button class="ldsp-cloud-sync" title="云同步" style="display:none">☁️</button>
                        <button class="ldsp-refresh" title="刷新数据">🔄</button>
                        <button class="ldsp-theme" title="切换主题">🌓</button>
                        <button class="ldsp-toggle" title="折叠">◀</button>
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
                        <div class="ldsp-avatar-wrap"><div class="ldsp-avatar-ph">👤</div></div>
                        <div class="ldsp-user-info">
                            <div class="ldsp-user-display-name">加载中...</div>
                            <div class="ldsp-user-handle"></div>
                        </div>
                        <div class="ldsp-reading">
                            <div class="ldsp-reading-ripple"></div>
                            <span class="ldsp-reading-icon">🌱</span>
                            <span class="ldsp-reading-time">--</span>
                            <span class="ldsp-reading-label">今日阅读</span>
                        </div>
                    </div>
                    <div class="ldsp-tabs">
                        <button class="ldsp-tab active" data-tab="reqs">📋 要求</button>
                        <button class="ldsp-tab" data-tab="trends">📈 趋势</button>
                        ${this.hasLeaderboard ? '<button class="ldsp-tab" data-tab="leaderboard">🏆 排行</button>' : ''}
                    </div>
                    <div class="ldsp-content">
                        <div id="ldsp-reqs" class="ldsp-section active"><div class="ldsp-loading"><div class="ldsp-spinner"></div><div>加载中...</div></div></div>
                        <div id="ldsp-trends" class="ldsp-section"><div class="ldsp-empty"><div class="ldsp-empty-icon">📊</div><div class="ldsp-empty-txt">暂无历史数据</div></div></div>
                        ${this.hasLeaderboard ? '<div id="ldsp-leaderboard" class="ldsp-section"><div class="ldsp-loading"><div class="ldsp-spinner"></div><div>加载中...</div></div></div>' : ''}
                    </div>
                </div>`;

            document.body.appendChild(this.el);

            this.$ = {
                header: this.el.querySelector('.ldsp-hdr'),
                announcement: this.el.querySelector('.ldsp-announcement'),
                announcementText: this.el.querySelector('.ldsp-announcement-text'),
                user: this.el.querySelector('.ldsp-user'),
                userDisplayName: this.el.querySelector('.ldsp-user-display-name'),
                userHandle: this.el.querySelector('.ldsp-user-handle'),
                reading: this.el.querySelector('.ldsp-reading'),
                readingIcon: this.el.querySelector('.ldsp-reading-icon'),
                readingTime: this.el.querySelector('.ldsp-reading-time'),
                readingLabel: this.el.querySelector('.ldsp-reading-label'),
                tabs: this.el.querySelectorAll('.ldsp-tab'),
                sections: this.el.querySelectorAll('.ldsp-section'),
                reqs: this.el.querySelector('#ldsp-reqs'),
                trends: this.el.querySelector('#ldsp-trends'),
                leaderboard: this.el.querySelector('#ldsp-leaderboard'),
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
                endDrag();
                // 触摸未移动且是折叠状态，视为点击展开
                if (wasDragging && !moved && this.el.classList.contains('collapsed')) {
                    this._toggle();
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
            });

            this.$.btnTheme.addEventListener('click', () => this._switchTheme());
            this.$.btnUpdate.addEventListener('click', () => this._checkUpdate());
            
            // 彩蛋：点击头像打开GitHub仓库
            this.$.user.addEventListener('click', e => {
                if (e.target.closest('.ldsp-avatar-wrap')) {
                    window.open('https://github.com/caigg188/LDStatusPro', '_blank');
                }
            });
            
            // 云同步按钮（状态由 CloudSyncManager 的回调自动管理）
            this.$.btnCloudSync?.addEventListener('click', async () => {
                if (!this.hasLeaderboard || !this.oauth?.isLoggedIn()) return;
                if (this.cloudSync.isSyncing()) return;  // 正在同步中，忽略点击
                try {
                    await this.cloudSync.fullSync();
                    this.renderer.showToast('✅ 数据同步完成');
                    this.renderer.renderReading(this.tracker.getTodayTime(), this.tracker.isActive);
                } catch (e) {
                    this.renderer.showToast(`❌ 同步失败: ${e.message || e}`);
                }
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
                console.log('[LDStatus Pro] Token expired, refreshing UI');
                this.renderer.showToast('⚠️ 登录已过期，请重新登录');
                this._renderLeaderboard();
            });
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
                this.$.btnToggle.textContent = '▶';
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
            this._updateExpandDir();
        }

        _toggle() {
            const collapsing = !this.el.classList.contains('collapsed');
            const rect = this.el.getBoundingClientRect();
            const cfg = Screen.getConfig();

            this.el.classList.add('anim');

            if (collapsing) {
                if (this.el.classList.contains('expand-left')) this.el.style.left = (rect.right - 44) + 'px';
                this.$.btnToggle.textContent = '▶';
            } else {
                this._updateExpandDir();
                if (this.el.classList.contains('expand-left')) this.el.style.left = Math.max(0, rect.left - (cfg.width - 44)) + 'px';
                this.$.btnToggle.textContent = '◀';
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

        _fetchAvatar() {
            const el = document.querySelector('.current-user img.avatar');
            if (el) { this._updateAvatar(el.src); return; }
            this.avatar && this.renderer.renderAvatar(this.avatar);
        }

        _updateAvatar(url) {
            if (!url) return;
            if (url.startsWith('/')) url = `https://${CURRENT_SITE.domain}${url}`;
            url = url.replace(PATTERNS.AVATAR_SIZE, '/128/');
            this.avatar = url;
            this.storage.set('userAvatar', url);
            this.renderer.renderAvatar(url);
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
                const html = await this.network.fetch(CURRENT_SITE.apiUrl);
                this._parse(html);
            } catch (e) {
                this._showError(e.message || '网络错误');
            } finally {
                this._setLoading(false);
            }
        }

        _showError(msg) {
            this.$.reqs.innerHTML = `<div class="ldsp-empty"><div class="ldsp-empty-icon">❌</div><div class="ldsp-empty-txt">${msg}</div></div>`;
        }

        _showLowTrustLevelWarning(username, level) {
            const $ = this.$;
            // 显示用户信息（如果有）
            if (username && username !== '未知') {
                $.userDisplayName.textContent = username;
                $.userHandle.textContent = '';
                $.userHandle.style.display = 'none';
            }
            // 显示友好的提示
            this.$.reqs.innerHTML = `
                <div class="ldsp-empty">
                    <div class="ldsp-empty-icon">ℹ️</div>
                    <div class="ldsp-empty-txt">
                        <div style="margin-bottom:8px;">信任等级小于2，暂无法获取升级要求</div>
                        <div style="font-size:12px;color:#6b7280;">阅读时间追踪功能正常运行中</div>
                    </div>
                </div>`;
        }

        _parse(html) {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            
            // 尝试获取用户名（即使没有升级要求数据也可能有用户信息）
            const userSection = doc.querySelector('.bg-white.p-6.rounded-lg');
            const avatarEl = doc.querySelector('img[src*="avatar"]');
            
            // 尝试从页面提取用户名
            let username = null;
            let level = '?';
            
            // 先尝试从头像 alt 或其他元素获取用户名
            if (avatarEl?.alt) {
                username = avatarEl.alt;
            }
            
            // 查找包含信任级别的区块
            const section = [...doc.querySelectorAll('.bg-white.p-6.rounded-lg')].find(d => d.querySelector('h2')?.textContent.includes('信任级别'));
            
            if (section) {
                const heading = section.querySelector('h2').textContent;
                const match = heading.match(PATTERNS.TRUST_LEVEL) || ['', '未知', '?'];
                [, username, level] = match;
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
            
            // 如果没有升级要求数据（信任等级 < 2），显示提示但不阻止其他功能
            if (!section) {
                return this._showLowTrustLevelWarning(username, level);
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
                    }, 50);
                });
                return;
            }

            const fns = {
                today: () => this.renderer.renderTodayTrend(reqs, this.readingTime, this._getTodayData()),
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
                if (!announcement.enabled || !announcement.content) {
                    return;
                }
                
                // 检查是否已关闭过此公告（基于内容hash）
                const contentHash = Utils.hash(announcement.content);
                const dismissedHash = this.storage.getGlobal('dismissedAnnouncement', '');
                if (dismissedHash === contentHash) {
                    return;
                }
                
                // 显示公告
                this._showAnnouncement(announcement);
            } catch (e) {
                console.warn('[Announcement] Load failed:', e.message);
            }
        }

        /**
         * 显示公告栏
         */
        _showAnnouncement(announcement) {
            if (!this.$.announcement || !this.$.announcementText) return;
            
            // 设置公告类型样式
            this.$.announcement.className = 'ldsp-announcement';
            if (announcement.type && announcement.type !== 'info') {
                this.$.announcement.classList.add(announcement.type);
            }
            
            // 设置公告内容
            this.$.announcementText.textContent = announcement.content;
            
            // 根据文字长度设置滚动速度
            const textLength = announcement.content.length;
            const duration = Math.max(10, Math.min(30, textLength * 0.3)); // 10-30秒
            this.$.announcement.style.setProperty('--marquee-duration', `${duration}s`);
            
            // 显示公告栏
            requestAnimationFrame(() => {
                this.$.announcement.classList.add('active');
            });
            
            // 点击关闭公告
            this.$.announcement.onclick = () => {
                const contentHash = Utils.hash(announcement.content);
                this.storage.setGlobalNow('dismissedAnnouncement', contentHash);
                this.$.announcement.classList.remove('active');
            };
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
            if (!this.hasLeaderboard) return;
            const logged = this.oauth.isLoggedIn();
            this.$.user.classList.toggle('not-logged', !logged);

            // 显示/隐藏云同步按钮
            if (this.$.btnCloudSync) {
                this.$.btnCloudSync.style.display = logged ? '' : 'none';
            }

            if (!logged) {
                const hint = this.$.userDisplayName.querySelector('.ldsp-login-hint');
                if (!hint) {
                    const span = document.createElement('span');
                    span.className = 'ldsp-login-hint';
                    span.textContent = '点击登录';
                    this.$.userDisplayName.appendChild(span);
                }
                this._bindUserLogin();
            } else {
                this.$.userDisplayName.querySelector('.ldsp-login-hint')?.remove();
            }
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
        }

        async _doLogin() {
            try {
                this.renderer.showToast('⏳ 正在打开登录窗口...');
                const user = await this.oauth.login();
                this.renderer.showToast('✅ 登录成功');
                // 同步用户名到 storage，确保云同步使用正确的用户键
                if (user?.username) {
                    this.storage.setUser(user.username);
                    this.storage.invalidateCache();  // 清除缓存确保使用新 key
                    this.storage.migrate(user.username);
                    // 使用 OAuth 用户信息更新界面
                    this._updateUserInfoFromOAuth(user);
                }
                this._updateLoginUI();
                await this._syncPrefs();
                this.cloudSync.fullSync().catch(e => console.warn('[CloudSync]', e));
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
                loginBtn.textContent = '⏳ 登录中...';
                try {
                    const user = await this.oauth.login();
                    this.renderer.showToast('✅ 登录成功');
                    // 同步用户名到 storage，确保云同步使用正确的用户键
                    if (user?.username) {
                        this.storage.setUser(user.username);
                        this.storage.invalidateCache();  // 清除缓存确保使用新 key
                        this.storage.migrate(user.username);
                    }
                    close(false);
                    this._updateLoginUI();
                    await this._syncPrefs();
                    this.cloudSync.fullSync().catch(e => console.warn('[CloudSync]', e));
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
                        loginBtn.textContent = '⏳ 登录中...';
                        try {
                            await this.oauth.login();
                            this.renderer.showToast('✅ 登录成功');
                            this._updateLoginUI();
                            await this._syncPrefs();
                            this.cloudSync.fullSync().catch(e => console.warn('[CloudSync]', e));
                            await this._renderLeaderboardContent();
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
            this.tracker.destroy();
            if (this.hasLeaderboard) {
                this.leaderboard.destroy();
                this.cloudSync.destroy();
            }
            this.storage.flush();
            this._readingTimer && clearInterval(this._readingTimer);
            this.el.remove();
        }
    }

    // ==================== 启动 ====================
    async function startup() {
        // 先加载阅读等级配置（不阻塞，但尽早开始）
        Network.loadReadingLevels().catch(e => console.warn('[Startup] ReadingLevels load failed:', e));
        // 创建面板
        new Panel();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startup);
    } else {
        startup();
    }

})();
