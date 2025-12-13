// ==UserScript==
// @name         LDStatus Pro
// @namespace    http://tampermonkey.net/
// @version      3.1.1
// @description  在 Linux.do 和 IDCFlare 页面显示信任级别进度，支持历史趋势、里程碑通知、阅读时间统计。Linux.do 站点支持排行榜和云同步功能
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
            supportsLeaderboard: false
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
        // 时间间隔（毫秒）
        INTERVALS: {
            REFRESH: 300000,           // 数据刷新间隔
            READING_TRACK: 10000,      // 阅读追踪间隔
            READING_SAVE: 30000,       // 阅读保存间隔
            READING_IDLE: 60000,       // 空闲阈值
            STORAGE_DEBOUNCE: 1000,    // 存储防抖
            READING_UPDATE: 1000,      // 阅读时间UI更新
            LEADERBOARD_SYNC: 600000,  // 排行榜同步（10分钟）
            CLOUD_UPLOAD: 1800000,     // 云同步上传（30分钟）
            CLOUD_DOWNLOAD: 21600000,  // 云同步下载（6小时）
            CLOUD_CHECK: 300000        // 云同步检查（5分钟）
        },
        // 缓存配置
        CACHE: {
            MAX_HISTORY_DAYS: 365,
            LRU_SIZE: 50,
            VALUE_TTL: 5000,
            SCREEN_TTL: 100,
            YEAR_DATA_TTL: 5000,
            HISTORY_TTL: 1000,
            LEADERBOARD_DAILY_TTL: 300000,     // 日榜缓存 5 分钟
            LEADERBOARD_WEEKLY_TTL: 3600000,   // 周榜缓存 60 分钟
            LEADERBOARD_MONTHLY_TTL: 10800000  // 月榜缓存 3 小时
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
        // 阅读等级配置
        READING_LEVELS: [
            { min: 0, label: '刚起步', icon: '🌱', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
            { min: 30, label: '热身中', icon: '📖', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
            { min: 90, label: '渐入佳境', icon: '📚', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
            { min: 180, label: '沉浸阅读', icon: '🔥', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
            { min: 300, label: '深度学习', icon: '⚡', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
            { min: 450, label: 'LD达人', icon: '🏆', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
            { min: 600, label: '超级水怪', icon: '👑', color: '#ec4899', bg: 'rgba(236,72,153,0.15)' }
        ],
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
            leaderboardTab: 'leaderboard_tab'
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

        // 获取阅读等级
        getReadingLevel(minutes) {
            const levels = CONFIG.READING_LEVELS;
            for (let i = levels.length - 1; i >= 0; i--) {
                if (minutes >= levels[i].min) return levels[i];
            }
            return levels[0];
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
                small: { width: 280, maxHeight: Math.min(innerHeight - 100, 450), fontSize: 11, padding: 10, avatarSize: 38, ringSize: 70 },
                medium: { width: 300, maxHeight: Math.min(innerHeight - 100, 520), fontSize: 12, padding: 12, avatarSize: 42, ringSize: 76 },
                large: { width: 320, maxHeight: 580, fontSize: 12, padding: 14, avatarSize: 46, ringSize: 80 }
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

        // API 请求（带认证）
        async api(endpoint, options = {}) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: options.method || 'GET',
                    url: `${CONFIG.LEADERBOARD_API}${endpoint}`,
                    headers: {
                        'Content-Type': 'application/json',
                        ...(options.token ? { 'Authorization': `Bearer ${options.token}` } : {})
                    },
                    data: options.body ? JSON.stringify(options.body) : undefined,
                    timeout: CONFIG.NETWORK.TIMEOUT,
                    onload: res => {
                        try {
                            const data = JSON.parse(res.responseText);
                            res.status >= 200 && res.status < 300 
                                ? resolve(data) 
                                : reject(new Error(data.error || `HTTP ${res.status}`));
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
        
        isLoggedIn() { return !!(this.getToken() && this.getUserInfo()); }
        
        isJoined() { return this.storage.getGlobal('leaderboardJoined', false); }
        setJoined(v) { this.storage.setGlobalNow('leaderboardJoined', v); }

        async login() {
            const authWindow = window.open('about:blank', 'oauth_login', 'width=600,height=700');
            if (!authWindow) throw new Error('弹窗被拦截');

            return new Promise((resolve, reject) => {
                this.network.api('/api/auth/init').then(result => {
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
            const check = setInterval(() => {
                if (win.closed) {
                    clearInterval(check);
                    setTimeout(() => {
                        this.isLoggedIn() ? resolve(this.getUserInfo()) : reject(new Error('登录已取消'));
                    }, 500);
                }
            }, 500);

            const handler = (e) => {
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

        async api(endpoint, options = {}) {
            return this.network.api(endpoint, { ...options, token: this.getToken() });
        }
    }

    // ==================== 排行榜管理器 ====================
    class LeaderboardManager {
        constructor(oauth, readingTracker) {
            this.oauth = oauth;
            this.tracker = readingTracker;
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
                await this.oauth.api('/api/reading/sync', {
                    method: 'POST',
                    body: { 
                        date: today,
                        minutes: this.tracker.getTodayTime(),
                        client_timestamp: Date.now()
                    }
                });
                this._lastSync = Date.now();
            } catch (e) {
                console.warn('[Leaderboard] Sync failed:', e.message || e);
            }
        }

        startSync() {
            if (this._syncTimer) return;
            this.syncReadingTime();
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

            try {
                const result = await this.oauth.api('/api/reading/history?days=365');
                console.log('[CloudSync] Download result:', result);
                if (!result.success) return null;

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
                return null;
            }
        }

        async upload() {
            if (!this.oauth.isLoggedIn() || this._syncing) return null;

            try {
                this._setSyncing(true);
                const local = this.storage.get('readingTime', null);
                if (!local?.dailyData) {
                    this._setSyncing(false);
                    return null;
                }

                const result = await this.oauth.api('/api/reading/sync-full', {
                    method: 'POST',
                    body: { dailyData: local.dailyData, lastSyncTime: Date.now() }
                });

                if (result.success) {
                    this._lastUpload = Date.now();
                    this.storage.setGlobalNow('lastCloudSync', this._lastUpload);
                    return result.data;
                }
                throw new Error(result.error || '上传失败');
            } catch (e) {
                console.error('[CloudSync] Upload failed:', e);
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

            // 下载检查
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

            // 上传检查
            const hash = this._getDataHash();
            if (hash && hash !== this._lastHash) {
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

                const now = Date.now();
                const hash = this._getDataHash();

                if (hash !== this._lastHash && (now - this._lastUpload) > CONFIG.INTERVALS.CLOUD_UPLOAD) {
                    const result = await this.upload();
                    if (result) {
                        this._lastHash = hash;
                        this.storage.setGlobalNow('lastUploadHash', hash);
                    }
                }

                if ((now - this._lastDownload) > CONFIG.INTERVALS.CLOUD_DOWNLOAD) {
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
            this._reqLastUpload = this.storage.getGlobal('lastReqSync', 0);
            this._reqLastDownload = this.storage.getGlobal('lastReqDownload', 0);
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

            try {
                const result = await this.oauth.api('/api/requirements/history?days=100');
                console.log('[CloudSync] Requirements download result:', result);
                
                if (!result.success) {
                    // 权限不足（trust_level < 2）是正常情况，不报错
                    if (result.error?.code === 'INSUFFICIENT_TRUST_LEVEL') {
                        console.log('[CloudSync] Requirements sync requires trust_level >= 2');
                        return null;
                    }
                    return null;
                }

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
                return null;
            }
        }

        /**
         * 上传升级要求历史数据
         */
        async uploadRequirements() {
            if (!this.oauth.isLoggedIn() || !this._historyMgr || this._syncing) return null;

            try {
                const history = this._historyMgr.getHistory();
                if (!history.length) return null;

                const result = await this.oauth.api('/api/requirements/sync-full', {
                    method: 'POST',
                    body: { history, lastSyncTime: Date.now() }
                });

                if (result.success) {
                    this._reqLastUpload = Date.now();
                    this.storage.setGlobalNow('lastReqSync', this._reqLastUpload);
                    console.log('[CloudSync] Requirements uploaded:', result.data);
                    return result.data;
                }
                
                // 权限不足是正常情况
                if (result.error?.code === 'INSUFFICIENT_TRUST_LEVEL') {
                    console.log('[CloudSync] Requirements sync requires trust_level >= 2');
                    return null;
                }
                
                throw new Error(result.error?.message || '上传失败');
            } catch (e) {
                console.error('[CloudSync] Requirements upload failed:', e);
                return null;
            }
        }

        /**
         * 页面加载时同步升级要求数据
         */
        async syncRequirementsOnLoad() {
            if (!this.oauth.isLoggedIn() || !this._historyMgr) return;

            const now = Date.now();
            const SYNC_INTERVAL = 30 * 60 * 1000; // 30 分钟同步一次

            // 下载检查
            if (this._reqLastDownload === 0 || (now - this._reqLastDownload) > SYNC_INTERVAL) {
                const result = await this.downloadRequirements();
                if (result) {
                    this._reqLastDownload = now;
                    this.storage.setGlobalNow('lastReqDownload', now);
                }
            }

            // 上传检查
            const hash = this._getReqHash();
            const lastHash = this.storage.getGlobal('lastReqHash', '');
            if (hash && hash !== lastHash) {
                const result = await this.uploadRequirements();
                if (result) {
                    this.storage.setGlobalNow('lastReqHash', hash);
                }
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
#ldsp-panel{--dur-fast:150ms;--dur:250ms;--dur-slow:400ms;--ease:cubic-bezier(.16,1,.3,1);--ease-circ:cubic-bezier(.85,0,.15,1);--ease-spring:cubic-bezier(.34,1.56,.64,1);--bg:#0f0f1a;--bg-card:#1a1a2e;--bg-hover:#252542;--bg-el:#16213e;--txt:#eaeaea;--txt-sec:#a0a0b0;--txt-mut:#6a6a7a;--accent:#7c3aed;--accent2:#06b6d4;--grad:linear-gradient(135deg,#7c3aed,#06b6d4);--ok:#22c55e;--ok-bg:rgba(34,197,94,.15);--err:#ef4444;--err-bg:rgba(239,68,68,.15);--warn:#f59e0b;--border:rgba(255,255,255,.06);--border2:rgba(255,255,255,.1);--shadow:0 16px 48px rgba(0,0,0,.5);--r-sm:6px;--r-md:10px;--r-lg:14px;--w:${c.width}px;--h:${c.maxHeight}px;--fs:${c.fontSize}px;--pd:${c.padding}px;--av:${c.avatarSize}px;--ring:${c.ringSize}px;position:fixed;left:12px;top:80px;width:var(--w);background:var(--bg);border-radius:var(--r-lg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;font-size:var(--fs);color:var(--txt);box-shadow:var(--shadow);z-index:99999;overflow:hidden;border:1px solid var(--border)}
#ldsp-panel,#ldsp-panel *{transition:background-color var(--dur),color var(--dur),border-color var(--dur),opacity var(--dur),transform var(--dur)}
#ldsp-panel.no-trans,#ldsp-panel.no-trans *{transition:none!important}
#ldsp-panel.anim{transition:width var(--dur-slow) var(--ease),height var(--dur-slow) var(--ease),left var(--dur-slow) var(--ease),top var(--dur-slow) var(--ease)}
#ldsp-panel.light{--bg:#fff;--bg-card:#f8fafc;--bg-hover:#f1f5f9;--bg-el:#fff;--txt:#1e293b;--txt-sec:#64748b;--txt-mut:#94a3b8;--accent:#6366f1;--accent2:#0ea5e9;--ok:#16a34a;--ok-bg:rgba(22,163,74,.1);--err:#dc2626;--err-bg:rgba(220,38,38,.1);--border:rgba(0,0,0,.04);--border2:rgba(0,0,0,.08);--shadow:0 16px 48px rgba(0,0,0,.12)}
#ldsp-panel.collapsed{width:44px!important;height:44px!important;border-radius:var(--r-md);cursor:move;background:var(--grad);border:none}
#ldsp-panel.collapsed .ldsp-hdr{padding:0;justify-content:center;height:44px;background:0 0}
#ldsp-panel.collapsed .ldsp-hdr-info,#ldsp-panel.collapsed .ldsp-hdr-btns>button:not(.ldsp-toggle),#ldsp-panel.collapsed .ldsp-body{display:none!important}
#ldsp-panel.collapsed .ldsp-toggle{width:44px;height:44px;font-size:18px;background:0 0}
.ldsp-hdr{display:flex;align-items:center;justify-content:space-between;padding:var(--pd);background:var(--grad);cursor:move;user-select:none}
.ldsp-hdr-info{display:flex;align-items:center;gap:8px}
.ldsp-site-icon{width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,.3)}
.ldsp-title{font-weight:700;font-size:13px;color:#fff}
.ldsp-ver{font-size:9px;color:rgba(255,255,255,.8);background:rgba(255,255,255,.2);padding:2px 5px;border-radius:6px}
.ldsp-hdr-btns{display:flex;gap:4px}
.ldsp-hdr-btns button{width:26px;height:26px;border:none;background:rgba(255,255,255,.15);color:#fff;border-radius:var(--r-sm);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center}
.ldsp-hdr-btns button:hover{background:rgba(255,255,255,.25);transform:translateY(-1px)}
.ldsp-hdr-btns button:disabled{opacity:.6;cursor:not-allowed;transform:none}
.ldsp-hdr-btns button.has-update{background:var(--ok);animation:pulse-update 2s ease-in-out infinite}
@keyframes pulse-update{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
.ldsp-update-bubble{position:absolute;top:50px;left:50%;transform:translateX(-50%) scale(0.9);background:var(--bg-card);border:2px solid var(--accent);border-radius:var(--r-lg);padding:16px;text-align:center;z-index:100;box-shadow:0 8px 32px rgba(0,0,0,.3);opacity:0;transition:all .3s ease}
.ldsp-update-bubble.show{opacity:1;transform:translateX(-50%) scale(1)}
.ldsp-update-bubble-close{position:absolute;top:8px;right:10px;font-size:16px;cursor:pointer;color:var(--txt-mut);transition:color .2s}
.ldsp-update-bubble-close:hover{color:var(--txt)}
.ldsp-update-bubble-icon{font-size:32px;margin-bottom:8px}
.ldsp-update-bubble-title{font-size:14px;font-weight:700;margin-bottom:6px;color:var(--txt)}
.ldsp-update-bubble-ver{font-size:12px;margin-bottom:12px}
.ldsp-update-bubble-btn{background:var(--grad);color:#fff;border:none;padding:8px 20px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}
.ldsp-update-bubble-btn:hover{transform:scale(1.05);box-shadow:0 4px 12px rgba(124,58,237,.4)}
.ldsp-update-bubble-btn:disabled{opacity:.7;cursor:not-allowed;transform:none}
.ldsp-body{background:var(--bg)}
.ldsp-user{display:flex;align-items:center;gap:10px;padding:var(--pd);background:var(--bg-card);border-bottom:1px solid var(--border)}
.ldsp-avatar{width:var(--av);height:var(--av);border-radius:50%;border:2px solid var(--accent);flex-shrink:0;background:var(--bg-el);position:relative}
.ldsp-avatar:hover{transform:scale(1.1);border-color:var(--accent);box-shadow:0 0 8px var(--accent);cursor:pointer}
.ldsp-avatar-ph{width:var(--av);height:var(--av);border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;flex-shrink:0;cursor:pointer;transition:transform .2s,box-shadow .2s;position:relative}
.ldsp-avatar-ph:hover{transform:scale(1.1);box-shadow:0 0 8px var(--accent)}
.ldsp-avatar-wrap{position:relative;flex-shrink:0}
.ldsp-avatar-wrap::after{content:'查看';position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);background:var(--bg-el);color:var(--txt-sec);padding:2px 6px;border-radius:4px;font-size:8px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s;border:1px solid var(--border)}
.ldsp-avatar-wrap:hover::after{opacity:1}
.ldsp-user-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.ldsp-user-display-name{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2}
.ldsp-user-handle{font-size:11px;color:var(--txt-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldsp-user.not-logged .ldsp-avatar,.ldsp-user.not-logged .ldsp-avatar-ph{border:2px dashed var(--warn);cursor:pointer}
.ldsp-user.not-logged .ldsp-user-display-name{color:var(--warn);cursor:pointer}
.ldsp-login-hint{font-size:8px;color:var(--warn);margin-left:4px;animation:blink 1.5s ease-in-out infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.5}}
.ldsp-user-meta{display:flex;align-items:center;gap:6px;margin-top:2px}
.ldsp-user-lv{font-size:9px;font-weight:700;color:#fff;background:var(--grad);padding:2px 6px;border-radius:10px}
.ldsp-user-st{font-size:9px;color:var(--txt-mut)}
.ldsp-reading{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 10px;border-radius:var(--r-md);min-width:70px}
.ldsp-reading-icon{font-size:18px;margin-bottom:2px;animation:bounce 2s ease-in-out infinite}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.ldsp-reading-time{font-size:12px;font-weight:800}
.ldsp-reading-label{font-size:8px;opacity:.8;margin-top:1px}
.ldsp-reading.hi .ldsp-reading-icon{animation:fire .5s ease-in-out infinite}
@keyframes fire{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
.ldsp-reading.max .ldsp-reading-icon{animation:crown 1s ease-in-out infinite}
@keyframes crown{0%,100%{transform:rotate(-5deg) scale(1)}50%{transform:rotate(5deg) scale(1.15)}}
.ldsp-status{display:flex;align-items:center;gap:6px;padding:8px var(--pd);font-size:11px;font-weight:500;background:var(--bg-card);border-bottom:1px solid var(--border)}
.ldsp-status.ok{color:var(--ok);background:var(--ok-bg)}
.ldsp-status.fail{color:var(--err);background:var(--err-bg)}
.ldsp-tabs{display:flex;padding:8px 10px;gap:6px;background:var(--bg);border-bottom:1px solid var(--border)}
.ldsp-tab{flex:1;padding:6px 10px;border:none;background:var(--bg-card);color:var(--txt-sec);border-radius:var(--r-sm);cursor:pointer;font-size:11px;font-weight:600}
.ldsp-tab:hover{background:var(--bg-hover);color:var(--txt)}
.ldsp-tab.active{background:var(--accent);color:#fff}
.ldsp-content{max-height:calc(var(--h) - 180px);overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--border2) transparent}
.ldsp-content::-webkit-scrollbar{width:5px}
.ldsp-content::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
.ldsp-section{display:none;padding:8px}
.ldsp-section.active{display:block;animation:enter var(--dur) var(--ease)}
@keyframes enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.ldsp-ring{display:flex;justify-content:center;padding:10px;background:var(--bg-card);border-radius:var(--r-md);margin-bottom:8px}
.ldsp-ring-wrap{position:relative;width:var(--ring);height:var(--ring)}
.ldsp-ring-wrap svg{transform:rotate(-90deg);width:100%;height:100%}
.ldsp-ring-bg{fill:none;stroke:var(--bg-el);stroke-width:6}
.ldsp-ring-fill{fill:none;stroke:url(#ldsp-grad);stroke-width:6;stroke-linecap:round;transition:stroke-dashoffset .8s var(--ease)}
.ldsp-ring-fill.anim{animation:ring 1.2s var(--ease) forwards}
@keyframes ring{from{stroke-dashoffset:var(--circ)}50%{filter:brightness(1.3) drop-shadow(0 0 8px var(--accent))}to{stroke-dashoffset:var(--off)}}
.ldsp-ring-txt{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
.ldsp-ring-val{font-size:18px;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.ldsp-ring-val.anim{animation:val .8s var(--ease) .4s forwards;opacity:0}
@keyframes val{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
.ldsp-ring-lbl{font-size:9px;color:var(--txt-mut);margin-top:2px}
.ldsp-item{display:flex;align-items:center;padding:6px 8px;margin-bottom:4px;background:var(--bg-card);border-radius:var(--r-sm);border-left:3px solid var(--border2);animation:item var(--dur) var(--ease) backwards}
.ldsp-item:nth-child(1){animation-delay:0ms}.ldsp-item:nth-child(2){animation-delay:30ms}.ldsp-item:nth-child(3){animation-delay:60ms}.ldsp-item:nth-child(4){animation-delay:90ms}.ldsp-item:nth-child(5){animation-delay:120ms}.ldsp-item:nth-child(6){animation-delay:150ms}.ldsp-item:nth-child(7){animation-delay:180ms}.ldsp-item:nth-child(8){animation-delay:210ms}.ldsp-item:nth-child(9){animation-delay:240ms}.ldsp-item:nth-child(10){animation-delay:270ms}.ldsp-item:nth-child(11){animation-delay:300ms}.ldsp-item:nth-child(12){animation-delay:330ms}
@keyframes item{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
.ldsp-item:hover{background:var(--bg-hover);transform:translateX(3px)}
.ldsp-item.ok{border-left-color:var(--ok);background:var(--ok-bg)}
.ldsp-item.fail{border-left-color:var(--err);background:var(--err-bg)}
.ldsp-item-icon{font-size:11px;margin-right:6px;opacity:.9}
.ldsp-item-name{flex:1;font-size:10px;color:var(--txt-sec);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldsp-item.ok .ldsp-item-name{color:var(--ok)}
.ldsp-item-vals{display:flex;align-items:center;gap:2px;font-size:11px;font-weight:700;margin-left:6px}
.ldsp-item-cur{color:var(--txt)}
.ldsp-item-cur.upd{animation:upd .6s var(--ease)}
@keyframes upd{0%{transform:scale(1)}30%{transform:scale(1.2);background:var(--accent);color:#fff;border-radius:4px}100%{transform:scale(1)}}
.ldsp-item.ok .ldsp-item-cur{color:var(--ok)}
.ldsp-item.fail .ldsp-item-cur{color:var(--err)}
.ldsp-item-sep{color:var(--txt-mut);font-weight:400}
.ldsp-item-req{color:var(--txt-mut);font-weight:500}
.ldsp-item-chg{font-size:9px;padding:1px 4px;border-radius:4px;font-weight:700;margin-left:4px;animation:pop var(--dur) var(--ease-spring)}
@keyframes pop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
.ldsp-item-chg.up{background:var(--ok-bg);color:var(--ok)}
.ldsp-item-chg.down{background:var(--err-bg);color:var(--err)}
.ldsp-subtabs{display:flex;gap:4px;padding:0 0 10px;overflow-x:auto;scrollbar-width:thin}
.ldsp-subtab{padding:5px 10px;border:1px solid var(--border2);background:var(--bg-card);color:var(--txt-sec);border-radius:var(--r-sm);cursor:pointer;font-size:10px;font-weight:600;white-space:nowrap;flex-shrink:0}
.ldsp-subtab:hover{border-color:var(--accent);color:var(--accent)}
.ldsp-subtab.active{background:var(--accent);border-color:var(--accent);color:#fff}
.ldsp-chart{background:var(--bg-card);border-radius:var(--r-md);padding:10px;margin-bottom:8px}
.ldsp-chart:last-child{margin-bottom:0}
.ldsp-chart-title{font-size:11px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:5px}
.ldsp-chart-sub{font-size:9px;color:var(--txt-mut);font-weight:500;margin-left:auto}
.ldsp-spark-row{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.ldsp-spark-row:last-child{margin-bottom:0}
.ldsp-spark-lbl{width:55px;font-size:9px;color:var(--txt-sec);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.ldsp-spark-bars{flex:1;display:flex;align-items:flex-end;gap:2px;height:22px}
.ldsp-spark-bar{flex:1;background:var(--accent);border-radius:2px 2px 0 0;min-height:2px;opacity:.4;position:relative}
.ldsp-spark-bar:last-child{opacity:1}
.ldsp-spark-bar:hover{opacity:1;transform:scaleY(1.1)}
.ldsp-spark-bar::after{content:attr(data-v);position:absolute;bottom:100%;left:50%;transform:translateX(-50%);font-size:8px;background:var(--bg-el);padding:2px 3px;border-radius:2px;opacity:0;white-space:nowrap;pointer-events:none}
.ldsp-spark-bar:hover::after{opacity:1}
.ldsp-spark-val{font-size:10px;font-weight:700;min-width:30px;text-align:right}
.ldsp-date-labels{display:flex;justify-content:space-between;padding:6px 0 0 60px;margin-right:35px}
.ldsp-date-lbl{font-size:8px;color:var(--txt-mut);text-align:center}
.ldsp-changes{margin-top:6px}
.ldsp-chg-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)}
.ldsp-chg-row:last-child{border-bottom:none}
.ldsp-chg-name{font-size:10px;color:var(--txt-sec)}
.ldsp-chg-val{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px}
.ldsp-chg-val.up{background:var(--ok-bg);color:var(--ok)}
.ldsp-chg-val.down{background:var(--err-bg);color:var(--err)}
.ldsp-chg-val.neu{background:var(--bg-el);color:var(--txt-mut)}
.ldsp-rd-stats{background:var(--bg-card);border-radius:var(--r-md);padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:10px}
.ldsp-rd-stats-icon{font-size:28px;flex-shrink:0}
.ldsp-rd-stats-info{flex:1}
.ldsp-rd-stats-val{font-size:16px;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.ldsp-rd-stats-lbl{font-size:10px;color:var(--txt-mut);margin-top:2px}
.ldsp-rd-stats-badge{padding:3px 8px;border-radius:10px;font-size:9px;font-weight:700}
.ldsp-track{display:flex;align-items:center;gap:5px;padding:5px 8px;background:var(--bg-card);border-radius:var(--r-sm);margin-bottom:8px;font-size:9px;color:var(--txt-mut)}
.ldsp-track-dot{width:6px;height:6px;border-radius:50%;background:var(--ok);animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.9)}}
.ldsp-rd-prog{background:var(--bg-card);border-radius:var(--r-md);padding:10px;margin-bottom:8px}
.ldsp-rd-prog-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.ldsp-rd-prog-title{font-size:10px;color:var(--txt-sec);font-weight:600}
.ldsp-rd-prog-val{font-size:11px;font-weight:700}
.ldsp-rd-prog-bar{height:6px;background:var(--bg-el);border-radius:3px;overflow:hidden}
.ldsp-rd-prog-fill{height:100%;border-radius:3px}
.ldsp-rd-week{display:flex;justify-content:space-between;align-items:flex-end;height:50px;padding:0 2px;margin:10px 0 6px;gap:2px}
.ldsp-rd-day{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0}
.ldsp-rd-day-bar{width:100%;max-width:16px;background:linear-gradient(to top,#7c3aed,#06b6d4);border-radius:2px 2px 0 0;min-height:2px;cursor:pointer;position:relative}
.ldsp-rd-day-bar:hover{transform:scaleX(1.15);opacity:.9}
.ldsp-rd-day-bar::after{content:attr(data-t);position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:var(--bg-el);padding:2px 4px;border-radius:2px;font-size:7px;font-weight:600;white-space:nowrap;opacity:0;pointer-events:none;margin-bottom:3px}
.ldsp-rd-day-bar:hover::after{opacity:1}
.ldsp-rd-day-lbl{font-size:7px;color:var(--txt-mut);line-height:1}
.ldsp-today-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px}
.ldsp-today-stat{background:var(--bg-card);border-radius:var(--r-sm);padding:8px;text-align:center}
.ldsp-today-stat-val{font-size:16px;font-weight:800;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.ldsp-today-stat-lbl{font-size:9px;color:var(--txt-mut);margin-top:2px}
.ldsp-time-info{font-size:9px;color:var(--txt-mut);text-align:center;padding:6px;background:var(--bg-card);border-radius:var(--r-sm);margin-bottom:8px}
.ldsp-time-info span{color:var(--accent);font-weight:600}
.ldsp-year-heatmap{padding:8px 12px 8px 0;overflow-x:hidden;overflow-y:auto;max-height:300px}
.ldsp-year-wrap{display:flex;flex-direction:column;gap:2px;width:100%;padding-right:4px}
.ldsp-year-row{display:flex;align-items:center;gap:4px;width:100%;position:relative}
.ldsp-year-month{width:26px;font-size:7px;font-weight:600;color:var(--txt-mut);text-align:right;flex-shrink:0;line-height:1;position:absolute;left:0;top:50%;transform:translateY(-50%)}
.ldsp-year-cells{display:grid;grid-template-columns:repeat(14,minmax(8px,1fr));gap:3px;width:100%;align-items:center;margin-left:30px}
.ldsp-year-cell{width:100%;aspect-ratio:1;border-radius:2px;background:var(--bg-card);border:.5px solid var(--border);cursor:pointer;position:relative}
.ldsp-year-cell:hover{transform:scale(1.5);box-shadow:0 0 6px rgba(124,58,237,.4);border-color:var(--accent);z-index:10}
.ldsp-year-cell.l0{background:rgba(124,58,237,.08);border-color:rgba(124,58,237,.15)}
.ldsp-year-cell.l1{background:rgba(124,58,237,.25);border-color:rgba(124,58,237,.35)}
.ldsp-year-cell.l2{background:rgba(124,58,237,.45);border-color:rgba(124,58,237,.55)}
.ldsp-year-cell.l3{background:rgba(124,58,237,.65);border-color:rgba(124,58,237,.75)}
.ldsp-year-cell.l4{background:var(--accent);border-color:var(--accent)}
.ldsp-year-cell.empty{background:0 0;border-color:transparent;cursor:default}
.ldsp-year-cell.empty:hover{transform:none;box-shadow:none}
.ldsp-year-tip{position:absolute;left:50%;transform:translateX(-50%);background:var(--bg-el);padding:4px 7px;border-radius:2px;font-size:7px;white-space:nowrap;opacity:0;pointer-events:none;border:1px solid var(--border2);z-index:1000;line-height:1.2}
.ldsp-year-cell:hover .ldsp-year-tip{opacity:1}
.ldsp-year-cell .ldsp-year-tip{bottom:100%;margin-bottom:2px}
.ldsp-year-row:nth-child(-n+3) .ldsp-year-tip{bottom:auto;top:100%;margin-top:2px;margin-bottom:0}
.ldsp-year-cell:nth-child(13) .ldsp-year-tip,.ldsp-year-cell:nth-child(14) .ldsp-year-tip{left:auto;right:0;transform:translateX(0)}
.ldsp-heatmap-legend{display:flex;align-items:center;gap:4px;justify-content:center;font-size:7px;color:var(--txt-mut);padding:4px 0}
.ldsp-heatmap-legend-cell{width:7px;height:7px;border-radius:1px;border:.5px solid var(--border)}
.ldsp-empty,.ldsp-loading{text-align:center;padding:24px 14px;color:var(--txt-mut)}
.ldsp-empty-icon{font-size:32px;margin-bottom:8px}
.ldsp-empty-txt{font-size:11px;line-height:1.6}
.ldsp-spinner{width:24px;height:24px;border:3px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 8px}
@keyframes spin{to{transform:rotate(360deg)}}
.ldsp-mini-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;color:var(--txt-mut)}
.ldsp-mini-spin{width:28px;height:28px;border:3px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin-bottom:12px}
.ldsp-mini-txt{font-size:10px}
.ldsp-toast{position:absolute;bottom:-50px;left:50%;transform:translateX(-50%) translateY(10px);background:var(--grad);color:#fff;padding:8px 14px;border-radius:var(--r-md);font-size:11px;font-weight:600;box-shadow:0 4px 20px rgba(124,58,237,.4);opacity:0;white-space:nowrap;display:flex;align-items:center;gap:6px;z-index:100000}
.ldsp-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.ldsp-modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:100001;opacity:0;transition:opacity var(--dur)}
.ldsp-modal-overlay.show{opacity:1}
.ldsp-modal{background:var(--bg-card);border-radius:var(--r-lg);padding:20px;max-width:320px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.5);transform:scale(.9) translateY(20px);transition:transform var(--dur) var(--ease-spring)}
.ldsp-modal-overlay.show .ldsp-modal{transform:scale(1) translateY(0)}
.ldsp-modal-hdr{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.ldsp-modal-icon{font-size:24px}
.ldsp-modal-title{font-size:16px;font-weight:700}
.ldsp-modal-body{font-size:12px;color:var(--txt-sec);line-height:1.6;margin-bottom:16px}
.ldsp-modal-body p{margin:0 0 8px}
.ldsp-modal-body ul{margin:8px 0;padding-left:20px}
.ldsp-modal-body li{margin:4px 0}
.ldsp-modal-body strong{color:var(--accent)}
.ldsp-modal-footer{display:flex;gap:10px}
.ldsp-modal-btn{flex:1;padding:10px 16px;border:none;border-radius:var(--r-md);font-size:12px;font-weight:600;cursor:pointer}
.ldsp-modal-btn.primary{background:var(--grad);color:#fff}
.ldsp-modal-btn.primary:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(124,58,237,.4)}
.ldsp-modal-btn.secondary{background:var(--bg-el);color:var(--txt-sec);border:1px solid var(--border2)}
.ldsp-modal-note{margin-top:12px;font-size:10px;color:var(--txt-mut);text-align:center}
.ldsp-no-chg{text-align:center;padding:14px;color:var(--txt-mut);font-size:10px}
.ldsp-lb-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg-card);border-radius:var(--r-md);margin-bottom:8px}
.ldsp-lb-status{display:flex;align-items:center;gap:8px}
.ldsp-lb-dot{width:8px;height:8px;border-radius:50%;background:var(--txt-mut)}
.ldsp-lb-dot.joined{background:var(--ok)}
.ldsp-lb-btn{padding:5px 10px;border:none;border-radius:var(--r-sm);font-size:10px;font-weight:600;cursor:pointer}
.ldsp-lb-btn.primary{background:var(--grad);color:#fff}
.ldsp-lb-btn.primary:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(124,58,237,.4)}
.ldsp-lb-btn.secondary{background:var(--bg-el);color:var(--txt-sec);border:1px solid var(--border2)}
.ldsp-lb-btn.danger{background:var(--err-bg);color:var(--err);border:1px solid rgba(239,68,68,.3)}
.ldsp-lb-btn.danger:hover{background:var(--err);color:#fff}
.ldsp-lb-btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
.ldsp-rank-list{display:flex;flex-direction:column;gap:4px}
.ldsp-rank-item{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-card);border-radius:var(--r-sm);animation:item var(--dur) var(--ease) backwards}
.ldsp-rank-item:hover{background:var(--bg-hover);transform:translateX(3px)}
.ldsp-rank-item.t1{background:linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,215,0,.05));border:1px solid rgba(255,215,0,.3)}
.ldsp-rank-item.t2{background:linear-gradient(135deg,rgba(192,192,192,.15),rgba(192,192,192,.05));border:1px solid rgba(192,192,192,.3)}
.ldsp-rank-item.t3{background:linear-gradient(135deg,rgba(205,127,50,.15),rgba(205,127,50,.05));border:1px solid rgba(205,127,50,.3)}
.ldsp-rank-item.me{border-left:3px solid var(--accent)}
.ldsp-rank-num{width:24px;height:24px;border-radius:50%;background:var(--bg-el);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--txt-sec);flex-shrink:0}
.ldsp-rank-item.t1 .ldsp-rank-num{background:linear-gradient(135deg,#ffd700,#ffb700);color:#fff;font-size:12px}
.ldsp-rank-item.t2 .ldsp-rank-num{background:linear-gradient(135deg,#c0c0c0,#a0a0a0);color:#fff}
.ldsp-rank-item.t3 .ldsp-rank-num{background:linear-gradient(135deg,#cd7f32,#b5651d);color:#fff}
.ldsp-rank-avatar{width:28px;height:28px;border-radius:50%;border:2px solid var(--border2);flex-shrink:0;background:var(--bg-el)}
.ldsp-rank-item.t1 .ldsp-rank-avatar{border-color:#ffd700}
.ldsp-rank-item.t2 .ldsp-rank-avatar{border-color:#c0c0c0}
.ldsp-rank-item.t3 .ldsp-rank-avatar{border-color:#cd7f32}
.ldsp-rank-info{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 4px}
.ldsp-rank-name{font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldsp-rank-display-name{font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px}
.ldsp-rank-username{font-size:9px;color:var(--txt-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldsp-rank-name-only{font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ldsp-rank-me-tag{font-size:9px;color:var(--accent);margin-left:2px}
.ldsp-rank-time{font-size:12px;font-weight:700;color:var(--accent);white-space:nowrap}
.ldsp-rank-item.t1 .ldsp-rank-time{color:#ffd700}
.ldsp-rank-item.t2 .ldsp-rank-time{color:#c0c0c0}
.ldsp-rank-item.t3 .ldsp-rank-time{color:#cd7f32}
.ldsp-lb-empty{text-align:center;padding:30px 20px;color:var(--txt-mut)}
.ldsp-lb-empty-icon{font-size:40px;margin-bottom:10px}
.ldsp-lb-empty-txt{font-size:11px;line-height:1.6}
.ldsp-lb-login{text-align:center;padding:30px 20px}
.ldsp-lb-login-icon{font-size:48px;margin-bottom:12px}
.ldsp-lb-login-title{font-size:13px;font-weight:600;margin-bottom:6px}
.ldsp-lb-login-desc{font-size:10px;color:var(--txt-mut);margin-bottom:16px;line-height:1.5}
.ldsp-lb-period{font-size:9px;color:var(--txt-mut);text-align:center;padding:6px;background:var(--bg-card);border-radius:var(--r-sm);margin-bottom:8px;display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap}
.ldsp-lb-period span{color:var(--accent);font-weight:600}
.ldsp-lb-period .ldsp-update-rule{font-size:8px;opacity:.8}
.ldsp-lb-refresh{background:none;border:none;cursor:pointer;font-size:10px;padding:2px 5px;border-radius:4px;transition:all .2s;opacity:.7}
.ldsp-lb-refresh:hover{opacity:1;background:var(--bg-el)}
.ldsp-lb-refresh:active{transform:scale(.95)}
.ldsp-lb-refresh.spinning{animation:ldsp-spin 1s linear infinite}
.ldsp-lb-refresh:disabled{opacity:.4;cursor:not-allowed}
@keyframes ldsp-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.ldsp-my-rank{display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--grad);border-radius:var(--r-md);margin-bottom:8px;color:#fff}
.ldsp-my-rank-lbl{font-size:10px;opacity:.9}
.ldsp-my-rank-val{font-size:16px;font-weight:800}
.ldsp-my-rank-time{font-size:11px;opacity:.9}
.ldsp-join-prompt{background:var(--bg-card);border-radius:var(--r-md);padding:16px;text-align:center;margin-bottom:8px}
.ldsp-join-prompt-icon{font-size:36px;margin-bottom:8px}
.ldsp-join-prompt-title{font-size:12px;font-weight:600;margin-bottom:4px}
.ldsp-join-prompt-desc{font-size:10px;color:var(--txt-mut);line-height:1.5;margin-bottom:12px}
.ldsp-privacy-note{font-size:8px;color:var(--txt-mut);margin-top:8px;display:flex;align-items:center;justify-content:center;gap:4px}
@media (prefers-reduced-motion:reduce){#ldsp-panel,#ldsp-panel *{animation-duration:.01ms!important;transition-duration:.01ms!important}}
@media (max-height:700px){#ldsp-panel{top:60px}.ldsp-content{max-height:calc(100vh - 240px)}}
@media (max-width:1200px){#ldsp-panel{left:8px}}`;
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
            // 如果有 displayName 则显示 displayName + @username，否则只显示 username
            if (displayName && displayName !== name) {
                $.userDisplayName.textContent = displayName;
                $.userHandle.textContent = `@${name}`;
                $.userHandle.style.display = '';
            } else {
                $.userDisplayName.textContent = name;
                $.userHandle.textContent = '';
                $.userHandle.style.display = 'none';
            }
            $.userLevel.textContent = `Lv ${level}`;
            $.userStatus.textContent = `${done}/${reqs.length} 完成`;
            $.status.className = `ldsp-status ${isOK ? 'ok' : 'fail'}`;
            $.status.innerHTML = `<span>${isOK ? '✅' : '⏳'}</span><span>${isOK ? '已' : '未'}满足升级要求</span>`;
        }

        // 渲染需求列表
        renderReqs(reqs) {
            const done = reqs.filter(r => r.isSuccess).length;
            const pct = Math.round(done / reqs.length * 100);
            const cfg = Screen.getConfig();
            const r = (cfg.ringSize / 2) - 8;
            const circ = 2 * Math.PI * r;
            const off = circ * (1 - pct / 100);
            const anim = this.lastPct === -1 || this.lastPct !== pct || this.panel.animRing;
            this.lastPct = pct;
            this.panel.animRing = false;

            let html = `<div class="ldsp-ring"><div class="ldsp-ring-wrap">
                <svg width="${cfg.ringSize}" height="${cfg.ringSize}" viewBox="0 0 ${cfg.ringSize} ${cfg.ringSize}">
                    <defs><linearGradient id="ldsp-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#7c3aed"/><stop offset="100%" style="stop-color:#06b6d4"/></linearGradient></defs>
                    <circle class="ldsp-ring-bg" cx="${cfg.ringSize/2}" cy="${cfg.ringSize/2}" r="${r}"/>
                    <circle class="ldsp-ring-fill${anim ? ' anim' : ''}" cx="${cfg.ringSize/2}" cy="${cfg.ringSize/2}" r="${r}" stroke-dasharray="${circ}" stroke-dashoffset="${anim ? circ : off}" style="--circ:${circ};--off:${off}"/>
                </svg>
                <div class="ldsp-ring-txt"><div class="ldsp-ring-val${anim ? ' anim' : ''}">${pct}%</div><div class="ldsp-ring-lbl">完成度</div></div>
            </div></div>`;

            for (const r of reqs) {
                const name = Utils.simplifyName(r.name);
                const prev = this.prevValues.get(r.name);
                const upd = prev !== undefined && prev !== r.currentValue;
                html += `<div class="ldsp-item ${r.isSuccess ? 'ok' : 'fail'}">
                    <span class="ldsp-item-icon">${r.isSuccess ? '✓' : '○'}</span>
                    <span class="ldsp-item-name">${name}</span>
                    <div class="ldsp-item-vals">
                        <span class="ldsp-item-cur${upd ? ' upd' : ''}">${r.currentValue}</span>
                        <span class="ldsp-item-sep">/</span>
                        <span class="ldsp-item-req">${r.requiredValue}</span>
                    </div>
                    ${r.change ? `<span class="ldsp-item-chg ${r.change > 0 ? 'up' : 'down'}">${r.change > 0 ? '+' : ''}${r.change}</span>` : ''}
                </div>`;
                this.prevValues.set(r.name, r.currentValue);
            }

            this.panel.$.reqs.innerHTML = html;
        }

        // 渲染阅读卡片
        renderReading(minutes) {
            const lv = Utils.getReadingLevel(minutes);
            const $ = this.panel.$;
            $.readingIcon.textContent = lv.icon;
            $.readingTime.textContent = Utils.formatReadingTime(minutes);
            $.readingLabel.textContent = lv.label;
            $.reading.style.cssText = `background:${lv.bg};color:${lv.color}`;
            $.readingTime.style.color = lv.color;
            $.readingLabel.style.color = lv.color;
            $.reading.classList.toggle('hi', minutes >= 180 && minutes < 450);
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
                <div class="ldsp-track"><div class="ldsp-track-dot"></div><span>阅读时间追踪中...</span></div>
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
                return `<div class="ldsp-empty"><div class="ldsp-empty-icon">🌐</div><div class="ldsp-empty-txt">数据不足<br>至少需要 2 天数据</div></div>`;
            }

            const oldest = history[0], newest = history.at(-1);
            const days = Math.ceil((Date.now() - oldest.ts) / 86400000);
            const total = tracker.getTotalTime();
            const avg = Math.round(total / Math.max(days, 1));
            const lv = Utils.getReadingLevel(avg);

            let html = `<div class="ldsp-time-info">共记录 <span>${days}</span> 天数据</div>`;

            if (total > 0) {
                html += `<div class="ldsp-rd-stats">
                    <div class="ldsp-rd-stats-icon">📚</div>
                    <div class="ldsp-rd-stats-info"><div class="ldsp-rd-stats-val">${Utils.formatReadingTime(total)}</div><div class="ldsp-rd-stats-lbl">累计阅读时间 · 日均 ${Utils.formatReadingTime(avg)}</div></div>
                    <div class="ldsp-rd-stats-badge" style="background:${lv.bg};color:${lv.color}">${lv.label}</div>
                </div>`;
            }

            const changes = reqs.map(r => ({
                name: Utils.simplifyName(r.name),
                diff: (newest.data[r.name] || 0) - (oldest.data[r.name] || 0)
            })).filter(c => c.diff !== 0);

            if (changes.length > 0) {
                html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📊 累计变化</div><div class="ldsp-changes">${
                    changes.map(c => `<div class="ldsp-chg-row"><span class="ldsp-chg-name">${c.name}</span><span class="ldsp-chg-val ${c.diff > 0 ? 'up' : 'down'}">${c.diff > 0 ? '+' : ''}${c.diff}</span></div>`).join('')
                }</div></div>`;
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
                html += `<div class="ldsp-my-rank"><div><div class="ldsp-my-rank-lbl">我的排名</div><div class="ldsp-my-rank-val">#${data.myRank.rank}</div></div><div class="ldsp-my-rank-time">${Utils.formatReadingTime(data.myRank.minutes)}</div></div>`;
            }

            html += '<div class="ldsp-rank-list">';
            data.rankings.forEach((user, i) => {
                const rank = i + 1;
                const isMe = userId && user.user_id === userId;
                const cls = [rank <= 3 ? `t${rank}` : '', isMe ? 'me' : ''].filter(Boolean).join(' ');
                const icon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
                const avatar = user.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `https://linux.do${user.avatar_url}`) : '';
                const hasName = user.name && user.name.trim();
                const nameHtml = hasName 
                    ? `<span class="ldsp-rank-display-name">${user.name}</span><span class="ldsp-rank-username">@${user.username}</span>`
                    : `<span class="ldsp-rank-name-only">${user.username}</span>`;

                html += `<div class="ldsp-rank-item ${cls}" style="animation-delay:${i * 30}ms">
                    <div class="ldsp-rank-num">${rank <= 3 ? icon : rank}</div>
                    ${avatar ? `<img class="ldsp-rank-avatar" src="${avatar}" alt="${user.username}" onerror="this.style.display='none'">` : '<div class="ldsp-rank-avatar" style="display:flex;align-items:center;justify-content:center;font-size:12px">👤</div>'}
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
                this.leaderboard = new LeaderboardManager(this.oauth, this.tracker);
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
                    this.cloudSync.onPageLoad();
                    this.cloudSync.syncRequirementsOnLoad();  // 同步升级要求数据（trust_level >= 2）
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
        }

        _createPanel() {
            this.el = document.createElement('div');
            this.el.id = 'ldsp-panel';
            this.el.setAttribute('role', 'complementary');
            this.el.setAttribute('aria-label', `${CURRENT_SITE.name} 信任级别面板`);

            this.el.innerHTML = `
                <div class="ldsp-hdr">
                    <div class="ldsp-hdr-info">
                        <img class="ldsp-site-icon" src="${CURRENT_SITE.icon}" alt="${CURRENT_SITE.name}">
                        <span class="ldsp-title">${CURRENT_SITE.name}</span>
                        <span class="ldsp-ver">v${GM_info.script.version}</span>
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
                    <div class="ldsp-user">
                        <div class="ldsp-avatar-wrap"><div class="ldsp-avatar-ph">👤</div></div>
                        <div class="ldsp-user-info">
                            <div class="ldsp-user-display-name">加载中...</div>
                            <div class="ldsp-user-handle"></div>
                            <div class="ldsp-user-meta">
                                <span class="ldsp-user-lv">Lv ?</span>
                                <span class="ldsp-user-st">--</span>
                            </div>
                        </div>
                        <div class="ldsp-reading">
                            <span class="ldsp-reading-icon">🌱</span>
                            <span class="ldsp-reading-time">--</span>
                            <span class="ldsp-reading-label">今日阅读</span>
                        </div>
                    </div>
                    <div class="ldsp-status"><span>⏳</span><span>获取数据中...</span></div>
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
                user: this.el.querySelector('.ldsp-user'),
                userDisplayName: this.el.querySelector('.ldsp-user-display-name'),
                userHandle: this.el.querySelector('.ldsp-user-handle'),
                userLevel: this.el.querySelector('.ldsp-user-lv'),
                userStatus: this.el.querySelector('.ldsp-user-st'),
                reading: this.el.querySelector('.ldsp-reading'),
                readingIcon: this.el.querySelector('.ldsp-reading-icon'),
                readingTime: this.el.querySelector('.ldsp-reading-time'),
                readingLabel: this.el.querySelector('.ldsp-reading-label'),
                status: this.el.querySelector('.ldsp-status'),
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
            // 拖拽
            let dragging = false, ox, oy, moved = false, sx, sy;
            const THRESHOLD = 5;

            const startDrag = e => {
                if (!this.el.classList.contains('collapsed') && e.target.closest('button')) return;
                dragging = true;
                moved = false;
                ox = e.clientX - this.el.offsetLeft;
                oy = e.clientY - this.el.offsetTop;
                sx = e.clientX;
                sy = e.clientY;
                this.el.classList.add('no-trans');
                e.preventDefault();
            };

            const updateDrag = e => {
                if (!dragging) return;
                if (Math.abs(e.clientX - sx) > THRESHOLD || Math.abs(e.clientY - sy) > THRESHOLD) moved = true;
                this.el.style.left = Math.max(0, Math.min(e.clientX - ox, innerWidth - this.el.offsetWidth)) + 'px';
                this.el.style.top = Math.max(0, Math.min(e.clientY - oy, innerHeight - this.el.offsetHeight)) + 'px';
            };

            const endDrag = () => {
                if (!dragging) return;
                dragging = false;
                this.el.classList.remove('no-trans');
                this.storage.setGlobalNow('position', { left: this.el.style.left, top: this.el.style.top });
                this._updateExpandDir();
            };

            this.$.header.addEventListener('mousedown', e => !this.el.classList.contains('collapsed') && startDrag(e));
            this.el.addEventListener('mousedown', e => this.el.classList.contains('collapsed') && startDrag(e));
            document.addEventListener('mousemove', updateDrag);
            document.addEventListener('mouseup', endDrag);

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
                    this.renderer.renderReading(this.tracker.getTodayTime());
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
        }

        _restore() {
            const pos = this.storage.getGlobal('position');
            if (pos) { this.el.style.left = pos.left; this.el.style.top = pos.top; }

            if (this.storage.getGlobal('collapsed', false)) {
                this.el.classList.add('collapsed');
                this.$.btnToggle.textContent = '▶';
            }

            const theme = this.storage.getGlobal('theme', 'dark');
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
                this.renderer.renderReading(this.readingTime);
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
                $.userLevel.textContent = `Lv ${level}`;
                $.userStatus.textContent = '信任等级 < 2';
                $.status.className = 'ldsp-status';
                $.status.innerHTML = '<span>ℹ️</span><span>暂无升级要求</span>';
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
            this.renderer.renderReading(this.readingTime);
            
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
            this.renderer.renderReqs(orderedReqs);

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
            // 显示信任等级（如果有）
            if (user.trust_level !== undefined) {
                $.userLevel.textContent = `Lv ${user.trust_level}`;
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
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new Panel());
    } else {
        new Panel();
    }

})();
