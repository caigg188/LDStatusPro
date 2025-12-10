// ==UserScript==
// @name         LDStatus Pro
// @namespace    http://tampermonkey.net/
// @version      2.7.2
// @description  在 Linux.do 和 IDCFlare 页面显示信任级别进度，支持历史趋势、里程碑通知、阅读时间统计
// @author       JackLiii
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
// @updateURL    https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js
// @downloadURL  https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js
// @icon         https://linux.do/uploads/default/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 网站检测 ====================
    const SITE_CONFIG = {
        'linux.do': {
            name: 'Linux.do',
            icon: '🐧',
            apiUrl: 'https://connect.linux.do',
            colorPrimary: '#6366f1',
            colorSecondary: '#0ea5e9'
        },
        'idcflare.com': {
            name: 'IDCFlare',
            icon: '⚡',
            apiUrl: 'https://connect.idcflare.com',
            colorPrimary: '#f97316',
            colorSecondary: '#d97706'
        }
    };

    // 检测当前网站
    function detectCurrentSite() {
        const hostname = window.location.hostname;
        for (const [domain, config] of Object.entries(SITE_CONFIG)) {
            if (hostname === domain || hostname.endsWith('.' + domain)) {
                return { domain, ...config };
            }
        }
        return null;
    }

    const CURRENT_SITE = detectCurrentSite();
    if (!CURRENT_SITE) {
        console.warn('[LDStatus Pro] 不支持的网站，脚本将不运行');
        return;
    }

    // ==================== 配置 ====================
    const CONFIG = {
        STORAGE_KEYS: {
            position: 'ldsp_position',
            collapsed: 'ldsp_collapsed',
            theme: 'ldsp_theme',
            history: 'ldsp_history',
            milestones: 'ldsp_milestones',
            lastNotify: 'ldsp_last_notify',
            lastVisit: 'ldsp_last_visit',
            trendTab: 'ldsp_trend_tab',
            todayData: 'ldsp_today_data',
            userAvatar: 'ldsp_user_avatar',
            readingTime: 'ldsp_reading_time',
            todayReadingStart: 'ldsp_today_reading_start',
            currentUser: 'ldsp_current_user',
            // 新增：用户数据映射表
            userDataMap: 'ldsp_user_data_map'
        },
        // 网站特定的存储键前缀
        SITE_PREFIX: CURRENT_SITE.domain.replace('.', '_'),
        // 需要按用户隔离的存储键
        USER_SPECIFIC_KEYS: [
            'history', 'milestones', 'lastVisit', 'todayData',
            'userAvatar', 'readingTime', 'todayReadingStart'
        ],
        REFRESH_INTERVAL: 300000,
        MAX_HISTORY_DAYS: 90,
        // 阅读时间追踪配置
        READING_TRACK_INTERVAL: 10000,  // 每10秒检测一次活跃状态
        READING_IDLE_THRESHOLD: 60000,  // 60秒无操作视为不活跃
        READING_SAVE_INTERVAL: 30000,   // 每30秒保存一次数据
        MILESTONES: {
            '浏览话题': [100, 500, 1000, 2000, 5000],
            '已读帖子': [500, 1000, 5000, 10000, 20000],
            '获赞': [10, 50, 100, 500, 1000],
            '送出赞': [50, 100, 500, 1000, 2000],
            '回复': [10, 50, 100, 500, 1000]
        },
        // 阅读强度配置（分钟）
        READING_LEVELS: [
            { min: 0, label: '刚起步', icon: '🌱', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
            { min: 10, label: '热身中', icon: '📖', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' },
            { min: 30, label: '渐入佳境', icon: '📚', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)' },
            { min: 60, label: '沉浸阅读', icon: '🔥', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
            { min: 120, label: '深度学习', icon: '⚡', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
            { min: 180, label: 'LD达人', icon: '🏆', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
            { min: 300, label: '超级水怪', icon: '👑', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' }
        ]
    };

    // ==================== 工具函数 ====================
    const Utils = {
        // 当前用户名（延迟初始化）
        _currentUser: null,

        // 获取当前用户名
        getCurrentUser() {
            if (this._currentUser) return this._currentUser;

            // 尝试从页面获取用户名
            const userLink = document.querySelector('.current-user a[href^="/u/"]');
            if (userLink) {
                const match = userLink.getAttribute('href').match(/\/u\/([^/]+)/);
                if (match) {
                    this._currentUser = match[1];
                    GM_setValue(CONFIG.STORAGE_KEYS.currentUser, this._currentUser);
                    return this._currentUser;
                }
            }

            // 尝试从存储获取
            this._currentUser = GM_getValue(CONFIG.STORAGE_KEYS.currentUser, null);
            return this._currentUser;
        },

        // 设置当前用户
        setCurrentUser(username) {
            this._currentUser = username;
            GM_setValue(CONFIG.STORAGE_KEYS.currentUser, username);
        },

        // 获取用户特定的存储键
        getUserKey(key) {
            const user = this.getCurrentUser();
            const baseKey = CONFIG.STORAGE_KEYS[key];
            const sitePrefix = `${CONFIG.SITE_PREFIX}_`;
            
            if (user && CONFIG.USER_SPECIFIC_KEYS.includes(key)) {
                return `${sitePrefix}${baseKey}_${user}`;
            }
            return `${sitePrefix}${baseKey}`;
        },

        // 获取存储值（支持用户隔离）
        get(key, def = null) {
            const storageKey = this.getUserKey(key);
            return GM_getValue(storageKey, def);
        },

        // 设置存储值（支持用户隔离）
        set(key, val) {
            const storageKey = this.getUserKey(key);
            GM_setValue(storageKey, val);
        },

        // 迁移旧数据到新格式
        migrateOldData(username) {
            const oldKeys = CONFIG.USER_SPECIFIC_KEYS;
            const migrationFlag = `ldsp_migrated_${username}`;

            // 检查是否已迁移
            if (GM_getValue(migrationFlag, false)) return;

            oldKeys.forEach(key => {
                const oldKey = CONFIG.STORAGE_KEYS[key];
                const newKey = `${oldKey}_${username}`;
                const oldData = GM_getValue(oldKey, null);

                // 如果旧数据存在且新数据不存在，则迁移
                if (oldData !== null && GM_getValue(newKey, null) === null) {
                    GM_setValue(newKey, oldData);
                    console.log(`[LDStatus Pro] 迁移数据: ${oldKey} -> ${newKey}`);
                }
            });

            // 迁移阅读时间数据格式
            this.migrateReadingTimeData(username);

            // 标记已迁移
            GM_setValue(migrationFlag, true);
        },

        // 迁移阅读时间数据格式
        migrateReadingTimeData(username) {
            const readingKey = `${CONFIG.STORAGE_KEYS.readingTime}_${username}`;
            const oldData = GM_getValue(readingKey, null);

            if (oldData && typeof oldData === 'object') {
                // 检查是否是旧格式（只有 date 和 minutes）
                if (oldData.date && oldData.minutes !== undefined && !oldData.dailyData) {
                    // 转换为新格式
                    const newData = {
                        version: 2,
                        dailyData: {
                            [oldData.date]: {
                                totalMinutes: oldData.minutes || 0,
                                lastActive: oldData.lastActive || Date.now(),
                                sessions: []
                            }
                        }
                    };
                    GM_setValue(readingKey, newData);
                    console.log(`[LDStatus Pro] 迁移阅读时间数据格式: ${readingKey}`);
                }
            }
        },

        compareVersion(v1, v2) {
            const p1 = v1.split('.').map(Number);
            const p2 = v2.split('.').map(Number);
            for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
                const a = p1[i] || 0, b = p2[i] || 0;
                if (a !== b) return a > b ? 1 : -1;
            }
            return 0;
        },

        simplifyName(name) {
            return name
                .replace('已读帖子（所有时间）', '已读帖子')
                .replace('浏览的话题（所有时间）', '浏览话题')
                .replace('获赞：点赞用户数量', '点赞用户')
                .replace('获赞：单日最高数量', '获赞天数')
                .replace('被禁言（过去 6 个月）', '禁言')
                .replace('被封禁（过去 6 个月）', '封禁')
                .replace('发帖数量', '发帖')
                .replace('回复数量', '回复')
                .replace('被举报的帖子（过去 6 个月）', '被举报帖子')
                .replace('发起举报的用户（过去 6 个月）', '发起举报');
        },

        formatDate(ts, format = 'short') {
            const d = new Date(ts);
            const month = d.getMonth() + 1;
            const day = d.getDate();
            if (format === 'short') return `${month}/${day}`;
            if (format === 'time') return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            return `${month}月${day}日`;
        },

        getTodayKey() {
            return new Date().toDateString();
        },

        formatReadingTime(minutes) {
            if (minutes < 1) return '< 1分钟';
            if (minutes < 60) return `${Math.round(minutes)}分钟`;
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`;
        },

        getReadingLevel(minutes) {
            const levels = CONFIG.READING_LEVELS;
            for (let i = levels.length - 1; i >= 0; i--) {
                if (minutes >= levels[i].min) return levels[i];
            }
            return levels[0];
        },

        getHistory() {
            const history = Utils.get('history', []);
            const cutoff = Date.now() - CONFIG.MAX_HISTORY_DAYS * 86400000;
            return history.filter(h => h.ts > cutoff);
        },

        addHistory(data, readingTime = 0) {
            const history = Utils.getHistory();
            const now = Date.now();
            const today = new Date().toDateString();
            const idx = history.findIndex(h => new Date(h.ts).toDateString() === today);
            const record = { ts: now, data, readingTime };
            if (idx >= 0) history[idx] = record;
            else history.push(record);
            Utils.set('history', history);
            return history;
        },

        getLastVisitData() {
            return Utils.get('lastVisit', null);
        },

        setLastVisitData(data, readingTime = 0) {
            Utils.set('lastVisit', { ts: Date.now(), data, readingTime });
        },

        getTodayData() {
            const stored = Utils.get('todayData', null);
            if (stored && stored.date === Utils.getTodayKey()) {
                return stored;
            }
            return null;
        },

        setTodayData(data, readingTime = 0, isStart = false) {
            const today = Utils.getTodayKey();
            const existing = Utils.getTodayData();
            if (isStart || !existing) {
                Utils.set('todayData', {
                    date: today,
                    startData: data,
                    startTs: Date.now(),
                    startReadingTime: readingTime,
                    currentData: data,
                    currentTs: Date.now(),
                    currentReadingTime: readingTime
                });
            } else {
                Utils.set('todayData', {
                    ...existing,
                    currentData: data,
                    currentTs: Date.now(),
                    currentReadingTime: readingTime
                });
            }
        },

        // 重新排序需求列表
        reorderRequirements(reqs) {
            const reportItems = [];
            const otherItems = [];

            reqs.forEach(r => {
                if (r.name.includes('被举报') || r.name.includes('发起举报')) {
                    reportItems.push(r);
                } else {
                    otherItems.push(r);
                }
            });

            // 将举报相关项插入到倒数第四和倒数第三位置
            // 即在禁言和封禁之前
            const banIndex = otherItems.findIndex(r => r.name.includes('禁言'));
            if (banIndex >= 0) {
                otherItems.splice(banIndex, 0, ...reportItems);
            } else {
                // 如果找不到禁言，就放到最后
                otherItems.push(...reportItems);
            }

            return otherItems;
        }
    };

    // ==================== 阅读时间追踪器 ====================
    class ReadingTimeTracker {
        constructor() {
            this.isActive = true;
            this.lastActivityTime = Date.now();
            this.sessionStartTime = Date.now();
            this.accumulatedTime = 0;  // 本次会话累计的秒数
            this.lastSaveTime = Date.now();  // 上次保存的时间戳
            this.trackingInterval = null;
            this.saveInterval = null;
            this.initialized = false;
        }

        // 初始化追踪器（需要用户名）
        init(username) {
            if (this.initialized) return;

            // 迁移旧数据
            Utils.migrateOldData(username);

            this.bindActivityListeners();
            this.startTracking();
            this.startAutoSave();
            this.handleVisibilityChange();
            this.initialized = true;

            console.log(`[LDStatus Pro] 阅读时间追踪器已启动 (用户: ${username})`);
        }

        // 绑定用户活动监听器
        bindActivityListeners() {
            const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

            const throttledActivity = this.throttle(() => {
                this.recordActivity();
            }, 1000);

            activityEvents.forEach(event => {
                document.addEventListener(event, throttledActivity, { passive: true });
            });
        }

        // 节流函数
        throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }

        // 记录活动
        recordActivity() {
            const now = Date.now();
            const timeSinceLastActivity = now - this.lastActivityTime;

            // 如果之前是不活跃状态，现在变为活跃
            if (!this.isActive) {
                this.isActive = true;
                this.sessionStartTime = now;
                console.log('[LDStatus Pro] 用户活跃，继续计时');
            }

            this.lastActivityTime = now;
        }

        // 开始追踪
        startTracking() {
            this.trackingInterval = setInterval(() => {
                this.checkAndAccumulate();
            }, CONFIG.READING_TRACK_INTERVAL);
        }

        // 开始自动保存
        startAutoSave() {
            this.saveInterval = setInterval(() => {
                this.saveReadingTime();
            }, CONFIG.READING_SAVE_INTERVAL);
        }

        // 检查并累计时间
        checkAndAccumulate() {
            const now = Date.now();
            const timeSinceLastActivity = now - this.lastActivityTime;

            if (this.isActive) {
                if (timeSinceLastActivity > CONFIG.READING_IDLE_THRESHOLD) {
                    // 用户变为不活跃，保存这个会话的时间
                    // 注意：不在这里累计，在saveReadingTime里处理
                    this.isActive = false;
                    console.log(`[LDStatus Pro] 用户不活跃，准备保存阅读时间`);
                }
            } else {
                // 如果用户重新活跃，重置会话
                if (timeSinceLastActivity < CONFIG.READING_IDLE_THRESHOLD) {
                    this.isActive = true;
                    this.sessionStartTime = now;
                    console.log('[LDStatus Pro] 用户重新活跃，开始新会话');
                }
            }
        }

        // 处理页面可见性变化
        handleVisibilityChange() {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    // 页面隐藏，立即保存当前时间
                    this.saveReadingTime();
                    // 不再活跃
                    this.isActive = false;
                    console.log('[LDStatus Pro] 页面隐藏，暂停计时');
                } else {
                    // 页面恢复可见，准备继续计时
                    this.lastActivityTime = Date.now();
                    this.isActive = true;
                    console.log('[LDStatus Pro] 页面可见，恢复计时');
                }
            });

            // 页面卸载前保存
            window.addEventListener('beforeunload', () => {
                this.saveReadingTime();
            });
        }

        // 获取当前会话的活跃时间（秒）
        getCurrentSessionTime() {
            if (!this.isActive) {
                return this.accumulatedTime;
            }
            const now = Date.now();
            const currentActiveTime = (now - this.sessionStartTime) / 1000;
            return this.accumulatedTime + currentActiveTime;
        }

        // 保存阅读时间
        saveReadingTime() {
            const user = Utils.getCurrentUser();
            if (!user) return;

            const todayKey = Utils.getTodayKey();
            const now = Date.now();
            
            // 获取存储的数据
            let stored = Utils.get('readingTime', null);

            // 确保数据格式正确
            if (!stored || typeof stored !== 'object' || !stored.dailyData) {
                stored = {
                    version: 2,
                    dailyData: {}
                };
            }

            // 获取今日数据
            let todayData = stored.dailyData[todayKey];
            if (!todayData) {
                todayData = {
                    totalMinutes: 0,
                    lastActive: now,
                    sessions: [],
                    lastSaveTime: now
                };
            }

            // 计算需要新增的时间：从上次保存到现在
            let timeToAddSeconds = 0;
            
            // 只计算从上次保存到现在的时间，避免重复
            const timeSinceLastSave = (now - this.lastSaveTime) / 1000;
            
            if (timeSinceLastSave > 0) {
                // 检查用户在这段时间内是否活跃
                const timeSinceLastActivity = now - this.lastActivityTime;
                
                if (timeSinceLastActivity <= CONFIG.READING_IDLE_THRESHOLD) {
                    // 用户仍然活跃，统计这段时间
                    timeToAddSeconds = timeSinceLastSave;
                } else {
                    // 用户已不活跃，只统计到用户不活跃为止的时间
                    // 即上次活动时间到上次保存时间之间的时间
                    const timeSinceLastActivityAtLastSave = (now - this.lastActivityTime) - CONFIG.READING_IDLE_THRESHOLD;
                    timeToAddSeconds = Math.max(0, timeSinceLastSave - timeSinceLastActivityAtLastSave);
                }
            }
            
            // 将秒数转换为分钟
            const timeToAddMinutes = timeToAddSeconds / 60;
            
            // 只有在有新增时间时才更新（大于0.1分钟，即6秒）
            if (timeToAddMinutes > 0.1) {
                todayData.totalMinutes += timeToAddMinutes;
                todayData.lastActive = now;
                todayData.lastSaveTime = now;
                
                // 记录会话
                if (!todayData.sessions) {
                    todayData.sessions = [];
                }
                todayData.sessions.push({
                    saveTime: now,
                    addedMinutes: timeToAddMinutes,
                    totalMinutes: todayData.totalMinutes
                });

                stored.dailyData[todayKey] = todayData;

                // 清理超过90天的数据
                this.cleanOldData(stored);

                Utils.set('readingTime', stored);
                
                // 更新保存时间
                this.lastSaveTime = now;
                
                console.log(`[LDStatus Pro] 已保存阅读时间: +${timeToAddMinutes.toFixed(2)}分钟，今日总计: ${todayData.totalMinutes.toFixed(2)}分钟`);
            }
        }

        // 清理旧数据
        cleanOldData(stored) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - CONFIG.MAX_HISTORY_DAYS);
            const cutoffKey = cutoffDate.toDateString();

            Object.keys(stored.dailyData).forEach(dateKey => {
                const date = new Date(dateKey);
                if (date < cutoffDate) {
                    delete stored.dailyData[dateKey];
                }
            });
        }

        // 获取今日阅读时间（分钟）
        getTodayReadingTime() {
            const user = Utils.getCurrentUser();
            if (!user) return 0;

            const todayKey = Utils.getTodayKey();
            const stored = Utils.get('readingTime', null);
            const now = Date.now();

            // 获取已保存的时间
            let savedMinutes = 0;
            if (stored && stored.dailyData && stored.dailyData[todayKey]) {
                savedMinutes = stored.dailyData[todayKey].totalMinutes || 0;
            }

            // 计算未保存的时间（从上次保存到现在）
            let unsavedMinutes = 0;
            if (this.lastSaveTime) {
                const timeSinceLastSave = (now - this.lastSaveTime) / 1000;
                const timeSinceLastActivity = now - this.lastActivityTime;
                
                if (timeSinceLastActivity <= CONFIG.READING_IDLE_THRESHOLD) {
                    // 用户仍然活跃，统计这段时间
                    unsavedMinutes = timeSinceLastSave / 60;
                } else {
                    // 用户已不活跃，只统计到用户不活跃为止的时间
                    const timeSinceLastActivityAtLastSave = (now - this.lastActivityTime) - CONFIG.READING_IDLE_THRESHOLD;
                    const activeSeconds = Math.max(0, timeSinceLastSave - timeSinceLastActivityAtLastSave);
                    unsavedMinutes = activeSeconds / 60;
                }
            }

            return savedMinutes + Math.max(0, unsavedMinutes);
        }

        // 获取指定日期的阅读时间
        getReadingTimeForDate(dateKey) {
            const stored = Utils.get('readingTime', null);
            if (!stored || !stored.dailyData || !stored.dailyData[dateKey]) {
                return 0;
            }
            return stored.dailyData[dateKey].totalMinutes || 0;
        }

        // 获取最近N天的阅读时间数据
        getReadingTimeHistory(days = 7) {
            const result = [];
            const now = new Date();

            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                const dateKey = date.toDateString();

                result.push({
                    date: dateKey,
                    label: Utils.formatDate(date.getTime(), 'short'),
                    dayName: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()],
                    minutes: i === 0 ? this.getTodayReadingTime() : this.getReadingTimeForDate(dateKey),
                    isToday: i === 0
                });
            }

            return result;
        }

        // 获取总阅读时间
        getTotalReadingTime() {
            const stored = Utils.get('readingTime', null);
            if (!stored || !stored.dailyData) {
                return this.getTodayReadingTime();
            }

            let total = 0;
            const todayKey = Utils.getTodayKey();

            Object.keys(stored.dailyData).forEach(dateKey => {
                if (dateKey === todayKey) {
                    total += this.getTodayReadingTime();
                } else {
                    total += stored.dailyData[dateKey].totalMinutes || 0;
                }
            });

            return total;
        }

        // 停止追踪
        stop() {
            if (this.trackingInterval) {
                clearInterval(this.trackingInterval);
            }
            if (this.saveInterval) {
                clearInterval(this.saveInterval);
            }
            this.saveReadingTime();
        }
    }

    // 创建全局阅读时间追踪器实例
    const readingTracker = new ReadingTimeTracker();

    // ==================== 通知管理 ====================
    const Notifier = {
        check(requirements) {
            const achieved = Utils.get('milestones', {});
            const newMilestones = [];

            requirements.forEach(req => {
                for (const [key, thresholds] of Object.entries(CONFIG.MILESTONES)) {
                    if (req.name.includes(key)) {
                        thresholds.forEach(t => {
                            const k = `${key}_${t}`;
                            if (req.currentValue >= t && !achieved[k]) {
                                newMilestones.push({ name: key, threshold: t });
                                achieved[k] = true;
                            }
                        });
                    }
                }
                const k = `req_${req.name}`;
                if (req.isSuccess && !achieved[k]) {
                    newMilestones.push({ name: req.name, type: 'req' });
                    achieved[k] = true;
                }
            });

            if (newMilestones.length > 0) {
                Utils.set('milestones', achieved);
                this.notify(newMilestones);
            }
        },

        notify(milestones) {
            const last = Utils.get('lastNotify', 0);
            if (Date.now() - last < 60000) return;
            Utils.set('lastNotify', Date.now());

            const msg = milestones.slice(0, 3).map(m =>
                m.type === 'req' ? `✅ ${m.name}` : `🏆 ${m.name} → ${m.threshold}`
            ).join('\n');

            if (typeof GM_notification !== 'undefined') {
                GM_notification({ title: '🎉 达成里程碑！', text: msg, timeout: 5000 });
            }
            this.showToast(milestones);
        },

        showToast(milestones) {
            const toast = document.createElement('div');
            toast.className = 'ldsp-toast';
            toast.innerHTML = `🎉${milestones.length === 1
                ? milestones[0].name + ' 达成！'
                : `达成 ${milestones.length} 个里程碑！`}`;
            document.getElementById('ldsp-panel')?.appendChild(toast);
            requestAnimationFrame(() => toast.classList.add('show'));
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }
    };

    // ==================== 样式 ====================
    const STYLES = `
        #ldsp-panel {
            --bg-base: #0f0f1a;
            --bg-card: #1a1a2e;
            --bg-card-hover: #252542;
            --bg-elevated: #16213e;
            --bg-input: #0f0f1a;
            --text-primary: #eaeaea;
            --text-secondary: #a0a0b0;
            --text-muted: #6a6a7a;
            --accent-primary: #7c3aed;
            --accent-primary-hover: #8b5cf6;
            --accent-secondary: #06b6d4;
            --accent-gradient: linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%);
            --success: #10b981;
            --success-bg: rgba(16, 185, 129, 0.15);
            --success-border: rgba(16, 185, 129, 0.3);
            --danger: #ef4444;
            --danger-bg: rgba(239, 68, 68, 0.15);
            --danger-border: rgba(239, 68, 68, 0.3);
            --warning: #f59e0b;
            --info: #3b82f6;
            --border-subtle: rgba(255, 255, 255, 0.06);
            --border-default: rgba(255, 255, 255, 0.1);
            --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
            --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.4);
            --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.5);
            --radius-sm: 6px;
            --radius-md: 10px;
            --radius-lg: 14px;

            position: fixed;
            left: 12px;
            top: 80px;
            width: 320px;
            background: var(--bg-base);
            border-radius: var(--radius-lg);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
            font-size: 12px;
            color: var(--text-primary);
            box-shadow: var(--shadow-lg);
            z-index: 99999;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid var(--border-subtle);
        }

        #ldsp-panel.light {
            --bg-base: #ffffff;
            --bg-card: #f8fafc;
            --bg-card-hover: #f1f5f9;
            --bg-elevated: #ffffff;
            --bg-input: #f1f5f9;
            --text-primary: #1e293b;
            --text-secondary: #64748b;
            --text-muted: #94a3b8;
            --accent-primary: #6366f1;
            --accent-primary-hover: #4f46e5;
            --accent-secondary: #0ea5e9;
            --accent-gradient: linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%);
            --success: #059669;
            --success-bg: rgba(5, 150, 105, 0.1);
            --success-border: rgba(5, 150, 105, 0.2);
            --danger: #dc2626;
            --danger-bg: rgba(220, 38, 38, 0.1);
            --danger-border: rgba(220, 38, 38, 0.2);
            --border-subtle: rgba(0, 0, 0, 0.04);
            --border-default: rgba(0, 0, 0, 0.08);
            --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
            --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.12);
        }

        #ldsp-panel {
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                        height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                        border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            transform-origin: left center;
        }

        #ldsp-panel.collapsed {
            width: 44px !important;
            height: 44px !important;
            border-radius: var(--radius-md);
            cursor: move;
            background: var(--accent-gradient);
            border: none;
        }

        #ldsp-panel.collapsed .ldsp-header {
            padding: 0;
            justify-content: center;
            height: 44px;
            background: transparent;
        }

        #ldsp-panel.collapsed .ldsp-header-info,
        #ldsp-panel.collapsed .ldsp-header-btns > button:not(.ldsp-btn-toggle),
        #ldsp-panel.collapsed .ldsp-body {
            display: none !important;
        }

        #ldsp-panel.collapsed .ldsp-btn-toggle {
            width: 44px;
            height: 44px;
            font-size: 18px;
            background: transparent;
            border-radius: var(--radius-md);
            cursor: pointer;
        }

        #ldsp-panel.collapsed .ldsp-btn-toggle:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .ldsp-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 14px;
            background: var(--accent-gradient);
            cursor: move;
            user-select: none;
        }

        .ldsp-header-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .ldsp-title {
            font-weight: 700;
            font-size: 14px;
            color: #fff;
            letter-spacing: 0.3px;
        }

        .ldsp-version {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.8);
            background: rgba(255, 255, 255, 0.2);
            padding: 2px 6px;
            border-radius: 6px;
            font-weight: 500;
        }

        .ldsp-header-btns {
            display: flex;
            gap: 4px;
        }

        .ldsp-header-btns button {
            width: 28px;
            height: 28px;
            border: none;
            background: rgba(255, 255, 255, 0.15);
            color: #fff;
            border-radius: var(--radius-sm);
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .ldsp-header-btns button:hover {
            background: rgba(255, 255, 255, 0.25);
            transform: translateY(-1px);
        }

        .ldsp-header-btns button:active {
            transform: translateY(0);
        }

        .ldsp-body {
            background: var(--bg-base);
        }

        /* 用户信息 - 优化布局 */
        .ldsp-user {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px;
            background: var(--bg-card);
            border-bottom: 1px solid var(--border-subtle);
        }

        .ldsp-avatar {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid var(--accent-primary);
            flex-shrink: 0;
            background: var(--bg-elevated);
        }

        .ldsp-avatar-placeholder {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            background: var(--accent-gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            color: #fff;
            flex-shrink: 0;
        }

        .ldsp-user-info {
            flex: 1;
            min-width: 0;
        }

        .ldsp-user-name {
            font-weight: 600;
            font-size: 14px;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .ldsp-user-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
        }

        .ldsp-user-level {
            font-size: 10px;
            font-weight: 700;
            color: #fff;
            background: var(--accent-gradient);
            padding: 3px 8px;
            border-radius: 12px;
            letter-spacing: 0.3px;
        }

        .ldsp-user-status {
            font-size: 10px;
            color: var(--text-muted);
        }

        /* 今日阅读时间卡片 */
        .ldsp-reading-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 8px 12px;
            border-radius: var(--radius-md);
            min-width: 80px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .ldsp-reading-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            opacity: 0.1;
            transition: opacity 0.3s;
        }

        .ldsp-reading-card:hover::before {
            opacity: 0.2;
        }

        .ldsp-reading-icon {
            font-size: 20px;
            margin-bottom: 2px;
            animation: ldsp-bounce 2s ease-in-out infinite;
        }

        @keyframes ldsp-bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
        }

        .ldsp-reading-time {
            font-size: 13px;
            font-weight: 800;
            letter-spacing: -0.3px;
        }

        .ldsp-reading-label {
            font-size: 9px;
            opacity: 0.8;
            margin-top: 1px;
        }

        /* 阅读强度动画 */
        .ldsp-reading-card.level-high .ldsp-reading-icon {
            animation: ldsp-fire 0.5s ease-in-out infinite;
        }

        @keyframes ldsp-fire {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }

        .ldsp-reading-card.level-max .ldsp-reading-icon {
            animation: ldsp-crown 1s ease-in-out infinite;
        }

        @keyframes ldsp-crown {
            0%, 100% { transform: rotate(-5deg) scale(1); }
            50% { transform: rotate(5deg) scale(1.15); }
        }

        /* 状态栏 */
        .ldsp-status {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            font-size: 12px;
            font-weight: 500;
            background: var(--bg-card);
            border-bottom: 1px solid var(--border-subtle);
        }

        .ldsp-status.success {
            color: var(--success);
            background: var(--success-bg);
        }

        .ldsp-status.fail {
            color: var(--danger);
            background: var(--danger-bg);
        }

        /* 主标签 */
        .ldsp-tabs {
            display: flex;
            padding: 10px 12px;
            gap: 8px;
            background: var(--bg-base);
            border-bottom: 1px solid var(--border-subtle);
        }

        .ldsp-tab {
            flex: 1;
            padding: 8px 12px;
            border: none;
            background: var(--bg-card);
            color: var(--text-secondary);
            border-radius: var(--radius-sm);
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s;
        }

        .ldsp-tab:hover {
            background: var(--bg-card-hover);
            color: var(--text-primary);
        }

        .ldsp-tab.active {
            background: var(--accent-primary);
            color: #fff;
        }

        /* 内容区 */
        .ldsp-content {
            max-height: 380px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: var(--border-default) transparent;
        }

        .ldsp-content::-webkit-scrollbar {
            width: 5px;
        }

        .ldsp-content::-webkit-scrollbar-thumb {
            background: var(--border-default);
            border-radius: 3px;
        }

        .ldsp-panel-section {
            display: none;
            padding: 10px;
        }

        .ldsp-panel-section.active {
            display: block;
        }

        /* 进度环 */
        .ldsp-progress-ring {
            display: flex;
            justify-content: center;
            padding: 14px;
            background: var(--bg-card);
            border-radius: var(--radius-md);
            margin-bottom: 10px;
        }

        .ldsp-ring-wrap {
            position: relative;
            width: 80px;
            height: 80px;
        }

        .ldsp-ring-wrap svg {
            transform: rotate(-90deg);
        }

        .ldsp-ring-bg {
            fill: none;
            stroke: var(--bg-elevated);
            stroke-width: 7;
        }

        .ldsp-ring-fill {
            fill: none;
            stroke: url(#ldsp-gradient);
            stroke-width: 7;
            stroke-linecap: round;
            transition: stroke-dashoffset 0.6s ease;
        }

        .ldsp-ring-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
        }

        .ldsp-ring-value {
            font-size: 20px;
            font-weight: 800;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .ldsp-ring-label {
            font-size: 10px;
            color: var(--text-muted);
            margin-top: 2px;
        }

        /* 需求列表项 */
        .ldsp-item {
            display: flex;
            align-items: center;
            padding: 8px 10px;
            margin-bottom: 6px;
            background: var(--bg-card);
            border-radius: var(--radius-sm);
            border-left: 3px solid var(--border-default);
            transition: all 0.2s;
        }

        .ldsp-item:hover {
            background: var(--bg-card-hover);
            transform: translateX(3px);
        }

        .ldsp-item:last-child {
            margin-bottom: 0;
        }

        .ldsp-item.success {
            border-left-color: var(--success);
            background: var(--success-bg);
        }

        .ldsp-item.fail {
            border-left-color: var(--danger);
            background: var(--danger-bg);
        }

        .ldsp-item-icon {
            font-size: 12px;
            margin-right: 8px;
            opacity: 0.9;
        }

        .ldsp-item-name {
            flex: 1;
            font-size: 11px;
            color: var(--text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .ldsp-item.success .ldsp-item-name {
            color: var(--success);
        }

        .ldsp-item.fail .ldsp-item-name {
            color: var(--text-secondary);
        }

        .ldsp-item-values {
            display: flex;
            align-items: center;
            gap: 3px;
            font-size: 12px;
            font-weight: 700;
            margin-left: 8px;
        }

        .ldsp-item-current {
            color: var(--text-primary);
        }

        .ldsp-item.success .ldsp-item-current {
            color: var(--success);
        }

        .ldsp-item.fail .ldsp-item-current {
            color: var(--danger);
        }

        .ldsp-item-sep {
            color: var(--text-muted);
            font-weight: 400;
        }

        .ldsp-item-required {
            color: var(--text-muted);
            font-weight: 500;
        }

        .ldsp-item-change {
            font-size: 10px;
            padding: 2px 5px;
            border-radius: 4px;
            font-weight: 700;
            margin-left: 6px;
        }

        .ldsp-item-change.up {
            background: var(--success-bg);
            color: var(--success);
        }

        .ldsp-item-change.down {
            background: var(--danger-bg);
            color: var(--danger);
        }

        /* 趋势子标签 - 优化为单行滚动 */
        .ldsp-subtabs {
            display: flex;
            gap: 6px;
            padding: 0 0 12px 0;
            overflow-x: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
        }

        .ldsp-subtabs::-webkit-scrollbar {
            display: none;
        }

        .ldsp-subtab {
            padding: 6px 12px;
            border: 1px solid var(--border-default);
            background: var(--bg-card);
            color: var(--text-secondary);
            border-radius: var(--radius-sm);
            cursor: pointer;
            font-size: 11px;
            font-weight: 600;
            transition: all 0.2s;
            white-space: nowrap;
            flex-shrink: 0;
        }

        .ldsp-subtab:hover {
            border-color: var(--accent-primary);
            color: var(--accent-primary);
            background: var(--bg-card-hover);
        }

        .ldsp-subtab.active {
            background: var(--accent-primary);
            border-color: var(--accent-primary);
            color: #fff;
        }

        /* 图表容器 */
        .ldsp-chart {
            background: var(--bg-card);
            border-radius: var(--radius-md);
            padding: 12px;
            margin-bottom: 10px;
        }

        .ldsp-chart:last-child {
            margin-bottom: 0;
        }

        .ldsp-chart-title {
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 12px;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .ldsp-chart-subtitle {
            font-size: 10px;
            color: var(--text-muted);
            font-weight: 500;
            margin-left: auto;
        }

        /* 日期标签 */
        .ldsp-date-labels {
            display: flex;
            justify-content: space-between;
            padding: 8px 0 0 68px;
            margin-right: 40px;
        }

        .ldsp-date-label {
            font-size: 9px;
            color: var(--text-muted);
            text-align: center;
        }

        /* 迷你图 */
        .ldsp-spark-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
        }

        .ldsp-spark-row:last-child {
            margin-bottom: 0;
        }

        .ldsp-spark-label {
            width: 60px;
            font-size: 10px;
            color: var(--text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-weight: 500;
        }

        .ldsp-spark-bars {
            flex: 1;
            display: flex;
            align-items: flex-end;
            gap: 3px;
            height: 24px;
        }

        .ldsp-spark-bar {
            flex: 1;
            background: var(--accent-primary);
            border-radius: 3px 3px 0 0;
            min-height: 3px;
            opacity: 0.4;
            transition: all 0.2s;
            position: relative;
        }

        .ldsp-spark-bar:last-child {
            opacity: 1;
        }

        .ldsp-spark-bar:hover {
            opacity: 1;
            transform: scaleY(1.1);
        }

        .ldsp-spark-bar::after {
            content: attr(data-value);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            font-size: 9px;
            color: var(--text-primary);
            background: var(--bg-elevated);
            padding: 2px 4px;
            border-radius: 3px;
            opacity: 0;
            transition: opacity 0.2s;
            white-space: nowrap;
            pointer-events: none;
            box-shadow: var(--shadow-sm);
        }

        .ldsp-spark-bar:hover::after {
            opacity: 1;
        }

        /* 阅读时间特殊样式 */
        .ldsp-spark-bar.reading-bar {
            background: linear-gradient(to top, #7c3aed, #06b6d4);
        }

        /* 变化列表 */
        .ldsp-changes {
            margin-top: 8px;
        }

        .ldsp-change-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid var(--border-subtle);
        }

        .ldsp-change-row:last-child {
            border-bottom: none;
        }

        .ldsp-change-name {
            font-size: 11px;
            color: var(--text-secondary);
        }

        .ldsp-change-val {
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
        }

        .ldsp-change-val.up {
            background: var(--success-bg);
            color: var(--success);
        }

        .ldsp-change-val.down {
            background: var(--danger-bg);
            color: var(--danger);
        }

        .ldsp-change-val.neutral {
            background: var(--bg-elevated);
            color: var(--text-muted);
        }

        /* 阅读时间统计卡片 */
        .ldsp-reading-stats {
            background: var(--bg-card);
            border-radius: var(--radius-md);
            padding: 14px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .ldsp-reading-stats-icon {
            font-size: 32px;
            flex-shrink: 0;
        }

        .ldsp-reading-stats-info {
            flex: 1;
        }

        .ldsp-reading-stats-value {
            font-size: 18px;
            font-weight: 800;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .ldsp-reading-stats-label {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 2px;
        }

        .ldsp-reading-stats-badge {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 700;
        }

        /* 空状态 & 加载 */
        .ldsp-empty, .ldsp-loading {
            text-align: center;
            padding: 30px 16px;
            color: var(--text-muted);
        }

        .ldsp-empty-icon {
            font-size: 36px;
            margin-bottom: 10px;
        }

        .ldsp-empty-text {
            font-size: 12px;
            line-height: 1.6;
        }

        .ldsp-spinner {
            width: 28px;
            height: 28px;
            border: 3px solid var(--border-default);
            border-top-color: var(--accent-primary);
            border-radius: 50%;
            animation: ldsp-spin 0.8s linear infinite;
            margin: 0 auto 10px;
        }

        @keyframes ldsp-spin {
            to { transform: rotate(360deg); }
        }

        /* Toast */
        .ldsp-toast {
            position: absolute;
            bottom: -50px;
            left: 50%;
            transform: translateX(-50%) translateY(10px);
            background: var(--accent-gradient);
            color: #fff;
            padding: 10px 16px;
            border-radius: var(--radius-md);
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
            opacity: 0;
            transition: all 0.3s ease;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 100000;
        }

        .ldsp-toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        /* 无数据提示 */
        .ldsp-no-change {
            text-align: center;
            padding: 16px;
            color: var(--text-muted);
            font-size: 11px;
        }

        /* 时间信息 */
        .ldsp-time-info {
            font-size: 10px;
            color: var(--text-muted);
            text-align: center;
            padding: 8px;
            background: var(--bg-card);
            border-radius: var(--radius-sm);
            margin-bottom: 10px;
        }

        .ldsp-time-info span {
            color: var(--accent-primary);
            font-weight: 600;
        }

        /* 今日统计卡片 */
        .ldsp-today-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 10px;
        }

        .ldsp-today-stat {
            background: var(--bg-card);
            border-radius: var(--radius-sm);
            padding: 10px;
            text-align: center;
        }

        .ldsp-today-stat-value {
            font-size: 18px;
            font-weight: 800;
            background: var(--accent-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .ldsp-today-stat-label {
            font-size: 10px;
            color: var(--text-muted);
            margin-top: 2px;
        }

        /* 阅读进度条 */
        .ldsp-reading-progress {
            background: var(--bg-card);
            border-radius: var(--radius-md);
            padding: 12px;
            margin-bottom: 10px;
        }

        .ldsp-reading-progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .ldsp-reading-progress-title {
            font-size: 11px;
            color: var(--text-secondary);
            font-weight: 600;
        }

        .ldsp-reading-progress-value {
            font-size: 12px;
            font-weight: 700;
            color: var(--text-primary);
        }

        .ldsp-reading-progress-bar {
            height: 8px;
            background: var(--bg-elevated);
            border-radius: 4px;
            overflow: hidden;
        }

        .ldsp-reading-progress-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.5s ease;
        }

        /* 7天阅读时间图表 */
        .ldsp-reading-week {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            height: 60px;
            padding: 0 4px;
            margin: 12px 0 8px;
        }

        .ldsp-reading-day {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
        }

        .ldsp-reading-day-bar {
            width: 24px;
            background: linear-gradient(to top, #7c3aed, #06b6d4);
            border-radius: 4px 4px 0 0;
            min-height: 4px;
            transition: all 0.3s ease;
            cursor: pointer;
            position: relative;
        }

        .ldsp-reading-day-bar:hover {
            transform: scaleX(1.1);
            opacity: 0.9;
        }

        .ldsp-reading-day-bar::after {
            content: attr(data-time);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: var(--bg-elevated);
            color: var(--text-primary);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
            box-shadow: var(--shadow-sm);
            margin-bottom: 4px;
        }

        .ldsp-reading-day-bar:hover::after {
            opacity: 1;
        }

        .ldsp-reading-day-label {
            font-size: 9px;
            color: var(--text-muted);
        }

        /* 追踪状态指示器 */
        .ldsp-tracking-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            background: var(--bg-card);
            border-radius: var(--radius-sm);
            margin-bottom: 10px;
            font-size: 10px;
            color: var(--text-muted);
        }

        .ldsp-tracking-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--success);
            animation: ldsp-pulse 2s ease-in-out infinite;
        }

        @keyframes ldsp-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.9); }
        }

        .ldsp-tracking-indicator.paused .ldsp-tracking-dot {
            background: var(--warning);
            animation: none;
        }
    `;

    // ==================== 面板类 ====================
    class Panel {
        constructor() {
            this.prevReqs = [];
            this.currentTrendTab = Utils.get('trendTab', 'today');
            this.userAvatar = Utils.get('userAvatar', null);
            this.currentReadingTime = 0;  // 当前阅读时间（分钟）
            this.currentUsername = null;
            this.readingUpdateInterval = null;

            this.injectStyles();
            this.createPanel();
            this.bindEvents();
            this.restore();
            this.fetchAvatar();
            this.fetch();

            setInterval(() => this.fetch(), CONFIG.REFRESH_INTERVAL);
        }

        injectStyles() {
            const style = document.createElement('style');
            style.textContent = STYLES;
            document.head.appendChild(style);
        }

        createPanel() {
            this.el = document.createElement('div');
            this.el.id = 'ldsp-panel';
            this.el.innerHTML = `
                <div class="ldsp-header">
                    <div class="ldsp-header-info">
                        <span class="ldsp-title">${CURRENT_SITE.icon} ${CURRENT_SITE.name}</span>
                        <span class="ldsp-version">v${GM_info.script.version}</span>
                    </div>
                    <div class="ldsp-header-btns">
                        <button class="ldsp-btn-update" title="检查更新">🔍</button>
                        <button class="ldsp-btn-refresh" title="刷新数据">🔄</button>
                        <button class="ldsp-btn-theme" title="切换主题">🌓</button>
                        <button class="ldsp-btn-toggle" title="折叠">◀</button>
                    </div>
                </div>
                <div class="ldsp-body">
                    <div class="ldsp-user">
                        <div class="ldsp-avatar-placeholder">👤</div>
                        <div class="ldsp-user-info">
                            <div class="ldsp-user-name">加载中...</div>
                            <div class="ldsp-user-meta">
                                <span class="ldsp-user-level">Lv ?</span>
                                <span class="ldsp-user-status">--</span>
                            </div>
                        </div>
                        <div class="ldsp-reading-card">
                            <span class="ldsp-reading-icon">🌱</span>
                            <span class="ldsp-reading-time">--</span>
                            <span class="ldsp-reading-label">今日阅读</span>
                        </div>
                    </div>

                    <div class="ldsp-status">
                        <span>⏳</span><span>获取数据中...</span>
                    </div>

                    <div class="ldsp-tabs">
                        <button class="ldsp-tab active" data-tab="reqs">📋 要求</button>
                        <button class="ldsp-tab" data-tab="trends">📈 趋势</button>
                    </div>

                    <div class="ldsp-content">
                        <div id="ldsp-reqs" class="ldsp-panel-section active">
                            <div class="ldsp-loading">
                                <div class="ldsp-spinner"></div>
                                <div>加载中...</div>
                            </div>
                        </div>
                        <div id="ldsp-trends" class="ldsp-panel-section">
                            <div class="ldsp-empty">
                                <div class="ldsp-empty-icon">📊</div>
                                <div class="ldsp-empty-text">暂无历史数据</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(this.el);

            this.$ = {
                header: this.el.querySelector('.ldsp-header'),
                user: this.el.querySelector('.ldsp-user'),
                userName: this.el.querySelector('.ldsp-user-name'),
                userLevel: this.el.querySelector('.ldsp-user-level'),
                userStatus: this.el.querySelector('.ldsp-user-status'),
                readingCard: this.el.querySelector('.ldsp-reading-card'),
                readingIcon: this.el.querySelector('.ldsp-reading-icon'),
                readingTime: this.el.querySelector('.ldsp-reading-time'),
                readingLabel: this.el.querySelector('.ldsp-reading-label'),
                status: this.el.querySelector('.ldsp-status'),
                tabs: this.el.querySelectorAll('.ldsp-tab'),
                sections: this.el.querySelectorAll('.ldsp-panel-section'),
                reqs: this.el.querySelector('#ldsp-reqs'),
                trends: this.el.querySelector('#ldsp-trends'),
                btnToggle: this.el.querySelector('.ldsp-btn-toggle'),
                btnRefresh: this.el.querySelector('.ldsp-btn-refresh'),
                btnTheme: this.el.querySelector('.ldsp-btn-theme'),
                btnUpdate: this.el.querySelector('.ldsp-btn-update')
            };
        }

        bindEvents() {
            let dragging = false, ox, oy, lastX = 0, lastY = 0;

            // 根据是否处于最小化状态设置拖动目标
            const getDragTarget = () => {
                if (this.el.classList.contains('collapsed')) {
                    return this.el;  // 最小化状态：整个面板都可拖动
                } else {
                    return this.$.header;  // 展开状态：仅header可拖动
                }
            };

            const startDrag = (e) => {
                if (e.target.closest('button')) return;
                dragging = true;
                ox = e.clientX - this.el.offsetLeft;
                oy = e.clientY - this.el.offsetTop;
                lastX = this.el.offsetLeft;
                lastY = this.el.offsetTop;
                this.el.style.transition = 'none';
            };

            const updateDrag = (e) => {
                if (!dragging) return;
                let x = Math.max(0, Math.min(e.clientX - ox, innerWidth - this.el.offsetWidth));
                let y = Math.max(0, Math.min(e.clientY - oy, innerHeight - this.el.offsetHeight));
                this.el.style.left = x + 'px';
                this.el.style.top = y + 'px';
            };

            const endDrag = () => {
                if (!dragging) return;
                dragging = false;
                this.el.style.transition = '';
                Utils.set('position', { left: this.el.style.left, top: this.el.style.top });
            };

            // header 可以随时拖动（展开时）
            this.$.header.addEventListener('mousedown', (e) => {
                if (!this.el.classList.contains('collapsed')) {
                    startDrag(e);
                }
            });

            // 最小化时整个面板可拖动
            this.el.addEventListener('mousedown', (e) => {
                if (this.el.classList.contains('collapsed') && !e.target.closest('button')) {
                    startDrag(e);
                }
            });

            document.addEventListener('mousemove', updateDrag);
            document.addEventListener('mouseup', endDrag);

            this.$.btnToggle.addEventListener('click', () => this.toggle());
            this.$.btnRefresh.addEventListener('click', () => this.fetch());
            this.$.btnTheme.addEventListener('click', () => this.switchTheme());
            this.$.btnUpdate.addEventListener('click', () => this.checkUpdate());

            this.$.tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    this.$.tabs.forEach(t => t.classList.remove('active'));
                    this.$.sections.forEach(s => s.classList.remove('active'));
                    tab.classList.add('active');
                    this.el.querySelector(`#ldsp-${tab.dataset.tab}`).classList.add('active');
                });
            });

            // 最小化状态点击直接展开（不需要额外的点击处理）
        }

        restore() {
            const pos = Utils.get('position');
            if (pos) {
                this.el.style.left = pos.left;
                this.el.style.top = pos.top;
            }

            if (Utils.get('collapsed')) {
                this.el.classList.add('collapsed');
                this.$.btnToggle.textContent = '▶';
            }

            const theme = Utils.get('theme', 'dark');
            if (theme === 'light') this.el.classList.add('light');
            this.$.btnTheme.textContent = theme === 'dark' ? '🌓' : '☀️';
            
            // 初始化展开方向
            requestAnimationFrame(() => this.optimizeExpandDirection());
        }

        toggle() {
            const isCollapsing = !this.el.classList.contains('collapsed');
            
            if (isCollapsing) {
                // 即将最小化，改变按钮方向
                this.$.btnToggle.textContent = '▶';
            } else {
                // 即将展开，改变按钮方向
                this.$.btnToggle.textContent = '◀';
            }
            
            this.el.classList.toggle('collapsed');
            Utils.set('collapsed', !isCollapsing);
            
            // 检测展开/缩小方向：根据面板与视口右边界的距离
            this.optimizeExpandDirection();
        }

        optimizeExpandDirection() {
            const panelRect = this.el.getBoundingClientRect();
            const distanceToRight = window.innerWidth - panelRect.right;
            const distanceToLeft = panelRect.left;
            
            // 如果面板在右侧接近边界，则向左展开
            if (distanceToRight < 100 && distanceToLeft > 300) {
                this.el.style.transformOrigin = 'right center';
            } else {
                this.el.style.transformOrigin = 'left center';
            }
        }

        switchTheme() {
            const isLight = this.el.classList.toggle('light');
            this.$.btnTheme.textContent = isLight ? '☀️' : '🌓';
            Utils.set('theme', isLight ? 'light' : 'dark');
        }

        fetchAvatar() {
            const avatarEl = document.querySelector('.current-user img.avatar');
            if (avatarEl) {
                this.updateAvatar(avatarEl.src);
                return;
            }
            if (this.userAvatar) {
                this.renderAvatar(this.userAvatar);
            }
        }

        updateAvatar(url) {
            if (url) {
                if (url.startsWith('/')) {
                    // 根据当前网站添加域名前缀
                    url = `https://${CURRENT_SITE.domain}${url}`;
                }
                url = url.replace(/\/\d+\//, '/128/');
                this.userAvatar = url;
                Utils.set('userAvatar', url);
                this.renderAvatar(url);
            }
        }

        renderAvatar(url) {
            const container = this.$.user.querySelector('.ldsp-avatar-placeholder, .ldsp-avatar');
            if (container) {
                const img = document.createElement('img');
                img.className = 'ldsp-avatar';
                img.src = url;
                img.alt = 'Avatar';
                img.onerror = () => {
                    img.replaceWith(this.createAvatarPlaceholder());
                };
                container.replaceWith(img);
            }
        }

        createAvatarPlaceholder() {
            const div = document.createElement('div');
            div.className = 'ldsp-avatar-placeholder';
            div.textContent = '👤';
            return div;
        }

        updateReadingCard(minutes) {
            const level = Utils.getReadingLevel(minutes);
            const timeStr = Utils.formatReadingTime(minutes);

            this.$.readingIcon.textContent = level.icon;
            this.$.readingTime.textContent = timeStr;
            this.$.readingLabel.textContent = level.label;

            this.$.readingCard.style.background = level.bg;
            this.$.readingCard.style.color = level.color;
            this.$.readingTime.style.color = level.color;
            this.$.readingLabel.style.color = level.color;

            // 移除所有级别类
            this.$.readingCard.classList.remove('level-high', 'level-max');

            // 添加动画效果
            if (minutes >= 180) {
                this.$.readingCard.classList.add('level-max');
            } else if (minutes >= 60) {
                this.$.readingCard.classList.add('level-high');
            }
        }

        // 启动阅读时间实时更新
        startReadingTimeUpdate() {
            if (this.readingUpdateInterval) return;

            // 每秒更新一次阅读时间显示，以获得更平滑的体验
            this.readingUpdateInterval = setInterval(() => {
                this.currentReadingTime = readingTracker.getTodayReadingTime();
                this.updateReadingCard(this.currentReadingTime);
            }, 1000);
        }

        fetch() {
            this.$.reqs.innerHTML = `<div class="ldsp-loading"><div class="ldsp-spinner"></div><div>加载中...</div></div>`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: CURRENT_SITE.apiUrl,
                timeout: 15000,
                onload: res => {
                    if (res.status === 200) this.parse(res.responseText);
                    else this.showError('请求失败: ' + res.status);
                },
                onerror: () => this.showError('网络错误'),
                ontimeout: () => this.showError('请求超时')
            });
        }

        showError(msg) {
            this.$.reqs.innerHTML = `<div class="ldsp-empty"><div class="ldsp-empty-icon">❌</div><div class="ldsp-empty-text">${msg}</div></div>`;
        }

        parse(html) {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const section = [...doc.querySelectorAll('.bg-white.p-6.rounded-lg')]
                .find(d => d.querySelector('h2')?.textContent.includes('信任级别'));

            if (!section) return this.showError('未找到数据，请登录');

            const heading = section.querySelector('h2').textContent;
            const [, username, level] = heading.match(/(.*) - 信任级别 (\d+)/) || ['', '未知', '?'];

            // 设置当前用户并初始化阅读追踪器
            if (username && username !== '未知') {
                Utils.setCurrentUser(username);
                this.currentUsername = username;

                // 初始化阅读时间追踪器
                readingTracker.init(username);

                // 启动阅读时间实时更新
                this.startReadingTimeUpdate();
            }

            // 尝试获取头像
            const avatarEl = doc.querySelector('img[src*="avatar"]');
            if (avatarEl) {
                this.updateAvatar(avatarEl.src);
            }

            // 获取本地追踪的阅读时间
            this.currentReadingTime = readingTracker.getTodayReadingTime();
            this.updateReadingCard(this.currentReadingTime);

            const rows = section.querySelectorAll('table tr');
            const requirements = [];

            for (let i = 1; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll('td');
                if (cells.length < 3) continue;

                const name = cells[0].textContent.trim();
                const currentMatch = cells[1].textContent.match(/(\d+)/);
                const requiredMatch = cells[2].textContent.match(/(\d+)/);
                const currentValue = currentMatch ? +currentMatch[1] : 0;
                const requiredValue = requiredMatch ? +requiredMatch[1] : 0;
                const isSuccess = cells[1].classList.contains('text-green-500');

                const prev = this.prevReqs.find(p => p.name === name);
                const change = prev ? currentValue - prev.currentValue : 0;

                requirements.push({
                    name,
                    currentValue,
                    requiredValue,
                    isSuccess,
                    change,
                    isReverse: /被举报|发起举报|禁言|封禁/.test(name)
                });
            }

            // 重新排序需求列表
            const reorderedReqs = Utils.reorderRequirements(requirements);
            const isOK = !section.querySelector('p.text-red-500');

            Notifier.check(reorderedReqs);

            const histData = {};
            reorderedReqs.forEach(r => histData[r.name] = r.currentValue);
            const history = Utils.addHistory(histData, this.currentReadingTime);

            // 更新今日数据
            const todayData = Utils.getTodayData();
            if (!todayData) {
                Utils.setTodayData(histData, this.currentReadingTime, true);
            } else {
                Utils.setTodayData(histData, this.currentReadingTime, false);
            }

            // 获取上次访问数据用于对比
            const lastVisit = Utils.getLastVisitData();

            this.renderUser(username, level, isOK, reorderedReqs);
            this.renderReqs(reorderedReqs);
            this.renderTrends(history, reorderedReqs, lastVisit, this.currentReadingTime);

            // 更新上次访问数据
            Utils.setLastVisitData(histData, this.currentReadingTime);

            this.prevReqs = reorderedReqs;
        }

        renderUser(name, level, isOK, reqs) {
            const done = reqs.filter(r => r.isSuccess).length;
            this.$.userName.textContent = name;
            this.$.userLevel.textContent = `Lv ${level}`;
            this.$.userStatus.textContent = `${done}/${reqs.length} 完成`;
            this.$.status.className = `ldsp-status ${isOK ? 'success' : 'fail'}`;
            this.$.status.innerHTML = `<span>${isOK ? '✅' : '⏳'}</span><span>${isOK ? '已' : '未'}满足升级要求</span>`;
        }

        renderReqs(reqs) {
            const done = reqs.filter(r => r.isSuccess).length;
            const pct = Math.round(done / reqs.length * 100);
            const circumference = 2 * Math.PI * 32;

            let html = `
                <div class="ldsp-progress-ring">
                    <div class="ldsp-ring-wrap">
                        <svg width="80" height="80">
                            <defs>
                                <linearGradient id="ldsp-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style="stop-color:#7c3aed"/>
                                    <stop offset="100%" style="stop-color:#06b6d4"/>
                                </linearGradient>
                            </defs>
                            <circle class="ldsp-ring-bg" cx="40" cy="40" r="32"/>
                            <circle class="ldsp-ring-fill" cx="40" cy="40" r="32"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${circumference * (1 - pct / 100)}"/>
                        </svg>
                        <div class="ldsp-ring-text">
                            <div class="ldsp-ring-value">${pct}%</div>
                            <div class="ldsp-ring-label">完成度</div>
                        </div>
                    </div>
                </div>
            `;

            reqs.forEach(r => {
                const name = Utils.simplifyName(r.name);
                const icon = r.isSuccess ? '✓' : '○';
                let changeHtml = '';
                if (r.change !== 0) {
                    const cls = r.change > 0 ? 'up' : 'down';
                    changeHtml = `<span class="ldsp-item-change ${cls}">${r.change > 0 ? '+' : ''}${r.change}</span>`;
                }
                html += `
                    <div class="ldsp-item ${r.isSuccess ? 'success' : 'fail'}">
                        <span class="ldsp-item-icon">${icon}</span>
                        <span class="ldsp-item-name">${name}</span>
                        <div class="ldsp-item-values">
                            <span class="ldsp-item-current">${r.currentValue}</span>
                            <span class="ldsp-item-sep">/</span>
                            <span class="ldsp-item-required">${r.requiredValue}</span>
                        </div>
                        ${changeHtml}
                    </div>
                `;
            });

            this.$.reqs.innerHTML = html;
        }

        renderTrends(history, reqs, lastVisit, currentReadingTime) {
            let html = `
                <div class="ldsp-subtabs">
                    <div class="ldsp-subtab ${this.currentTrendTab === 'last' ? 'active' : ''}" data-trend="last">📍 上次访问</div>
                    <div class="ldsp-subtab ${this.currentTrendTab === 'today' ? 'active' : ''}" data-trend="today">☀️ 今日</div>
                    <div class="ldsp-subtab ${this.currentTrendTab === '7d' ? 'active' : ''}" data-trend="7d">📅 7天</div>
                    <div class="ldsp-subtab ${this.currentTrendTab === 'all' ? 'active' : ''}" data-trend="all">📊 全部</div>
                </div>
                <div class="ldsp-trend-content"></div>
            `;

            this.$.trends.innerHTML = html;

            this.$.trends.querySelectorAll('.ldsp-subtab').forEach(tab => {
                tab.addEventListener('click', () => {
                    this.currentTrendTab = tab.dataset.trend;
                    Utils.set('trendTab', this.currentTrendTab);
                    this.$.trends.querySelectorAll('.ldsp-subtab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this.renderTrendContent(history, reqs, lastVisit, currentReadingTime);
                });
            });

            this.renderTrendContent(history, reqs, lastVisit, currentReadingTime);
        }

        renderTrendContent(history, reqs, lastVisit, currentReadingTime) {
            const container = this.$.trends.querySelector('.ldsp-trend-content');

            switch (this.currentTrendTab) {
                case 'last':
                    container.innerHTML = this.renderLastVisitTrend(reqs, lastVisit);
                    break;
                case 'today':
                    container.innerHTML = this.renderTodayTrend(reqs, currentReadingTime);
                    break;
                case '7d':
                    container.innerHTML = this.render7dTrend(history, reqs);
                    break;
                case 'all':
                    container.innerHTML = this.renderAllTrend(history, reqs);
                    break;
            }
        }

        renderLastVisitTrend(reqs, lastVisit) {
            if (!lastVisit) {
                return `<div class="ldsp-empty"><div class="ldsp-empty-icon">👋</div><div class="ldsp-empty-text">首次访问<br>下次访问时将显示变化</div></div>`;
            }

            const timeDiff = Date.now() - lastVisit.ts;
            const hours = Math.floor(timeDiff / 3600000);
            const minutes = Math.floor((timeDiff % 3600000) / 60000);
            const timeStr = hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;

            let html = `<div class="ldsp-time-info">距上次访问 <span>${timeStr}</span></div>`;

            // 显示阅读时间变化
            if (lastVisit.readingTime !== undefined && this.currentReadingTime > 0) {
                const readingDiff = this.currentReadingTime - lastVisit.readingTime;
                if (readingDiff > 0) {
                    html += `
                        <div class="ldsp-reading-stats">
                            <div class="ldsp-reading-stats-icon">📚</div>
                            <div class="ldsp-reading-stats-info">
                                <div class="ldsp-reading-stats-value">+${Utils.formatReadingTime(readingDiff)}</div>
                                <div class="ldsp-reading-stats-label">阅读时间增加</div>
                            </div>
                        </div>
                    `;
                }
            }

            let changes = '';
            let hasChange = false;

            reqs.forEach(r => {
                const prevVal = lastVisit.data[r.name] || 0;
                const diff = r.currentValue - prevVal;
                if (diff !== 0) {
                    hasChange = true;
                    const name = Utils.simplifyName(r.name);
                    const cls = diff > 0 ? 'up' : 'down';
                    changes += `
                        <div class="ldsp-change-row">
                            <span class="ldsp-change-name">${name}</span>
                            <span class="ldsp-change-val ${cls}">${diff > 0 ? '+' : ''}${diff}</span>
                        </div>
                    `;
                }
            });

            if (hasChange) {
                html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📊 数据变化</div><div class="ldsp-changes">${changes}</div></div>`;
            } else {
                html += `<div class="ldsp-no-change">暂无数据变化</div>`;
            }

            return html;
        }

        renderTodayTrend(reqs, currentReadingTime) {
            const todayData = Utils.getTodayData();
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();

            if (!todayData) {
                return `<div class="ldsp-empty"><div class="ldsp-empty-icon">☀️</div><div class="ldsp-empty-text">今日首次访问<br>数据将从现在开始统计</div></div>`;
            }

            const startTime = new Date(todayData.startTs);
            const startTimeStr = `${startTime.getHours()}:${String(startTime.getMinutes()).padStart(2, '0')}`;
            const currentTimeStr = `${hours}:${String(minutes).padStart(2, '0')}`;

            let html = `<div class="ldsp-time-info">今日 00:00 ~ ${currentTimeStr} (首次记录于 ${startTimeStr})</div>`;

            // 追踪状态指示器
            html += `
                <div class="ldsp-tracking-indicator">
                    <div class="ldsp-tracking-dot"></div>
                    <span>阅读时间追踪中...</span>
                </div>
            `;

            // 今日阅读时间统计
            const todayReadingTime = currentReadingTime;
            const level = Utils.getReadingLevel(todayReadingTime);

            html += `
                <div class="ldsp-reading-stats">
                    <div class="ldsp-reading-stats-icon">${level.icon}</div>
                    <div class="ldsp-reading-stats-info">
                        <div class="ldsp-reading-stats-value">${Utils.formatReadingTime(todayReadingTime)}</div>
                        <div class="ldsp-reading-stats-label">今日累计阅读</div>
                    </div>
                    <div class="ldsp-reading-stats-badge" style="background: ${level.bg}; color: ${level.color};">${level.label}</div>
                </div>
            `;

            // 阅读进度条（以3小时为满）
            const maxMinutes = 180;
            const progressPct = Math.min(todayReadingTime / maxMinutes * 100, 100);

            html += `
                <div class="ldsp-reading-progress">
                    <div class="ldsp-reading-progress-header">
                        <span class="ldsp-reading-progress-title">📖 阅读目标 (3小时)</span>
                        <span class="ldsp-reading-progress-value">${Math.round(progressPct)}%</span>
                    </div>
                    <div class="ldsp-reading-progress-bar">
                        <div class="ldsp-reading-progress-fill" style="width: ${progressPct}%; background: ${level.bg.replace('0.15', '1')};"></div>
                    </div>
                </div>
            `;

            // 计算今日总增量
            let totalChanges = 0;
            const changeList = [];

            reqs.forEach(r => {
                const startVal = todayData.startData[r.name] || 0;
                const diff = r.currentValue - startVal;
                if (diff !== 0) {
                    totalChanges++;
                    changeList.push({ name: Utils.simplifyName(r.name), diff, current: r.currentValue });
                }
            });

            // 今日统计卡片
            const posChanges = changeList.filter(c => c.diff > 0).length;
            const negChanges = changeList.filter(c => c.diff < 0).length;

            html += `
                <div class="ldsp-today-stats">
                    <div class="ldsp-today-stat">
                        <div class="ldsp-today-stat-value">${posChanges}</div>
                        <div class="ldsp-today-stat-label">📈 增长项</div>
                    </div>
                    <div class="ldsp-today-stat">
                        <div class="ldsp-today-stat-value">${negChanges}</div>
                        <div class="ldsp-today-stat-label">📉 下降项</div>
                    </div>
                </div>
            `;

            if (changeList.length > 0) {
                let changes = '';
                changeList.sort((a, b) => b.diff - a.diff).forEach(c => {
                    const cls = c.diff > 0 ? 'up' : 'down';
                    changes += `
                        <div class="ldsp-change-row">
                            <span class="ldsp-change-name">${c.name}</span>
                            <span class="ldsp-change-val ${cls}">${c.diff > 0 ? '+' : ''}${c.diff}</span>
                        </div>
                    `;
                });
                html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📊 今日变化明细</div><div class="ldsp-changes">${changes}</div></div>`;
            } else {
                html += `<div class="ldsp-no-change">今日暂无数据变化</div>`;
            }

            return html;
        }

        render7dTrend(history, reqs) {
            const now = Date.now();
            const d7ago = now - 7 * 24 * 3600000;
            const recent = history.filter(h => h.ts > d7ago);

            if (recent.length < 2) {
                return `<div class="ldsp-empty"><div class="ldsp-empty-icon">📅</div><div class="ldsp-empty-text">7天内数据不足<br>每天访问积累数据</div></div>`;
            }

            // 7天阅读时间趋势
            let html = this.renderReadingWeekChart();

            const keys = ['浏览的话题', '已读帖子', '获赞', '送出赞', '回复'];
            const trends = [];

            keys.forEach(key => {
                const req = reqs.find(r => r.name.includes(key));
                if (!req) return;
                const dailyData = this.aggregateByDay(recent, req.name, 7);
                if (dailyData.values.some(v => v > 0)) {
                    trends.push({ label: key.replace('浏览的话题', '浏览话题'), ...dailyData, current: req.currentValue });
                }
            });

            if (trends.length > 0) {
                html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📈 7天数据趋势<span class="ldsp-chart-subtitle">${Utils.formatDate(recent[0].ts)} - ${Utils.formatDate(recent[recent.length-1].ts)}</span></div>`;

                trends.forEach(t => {
                    const max = Math.max(...t.values, 1);
                    const bars = t.values.map((v, i) => {
                        const height = Math.max(v / max * 22, 3);
                        return `<div class="ldsp-spark-bar" style="height:${height}px" data-value="${v}"></div>`;
                    }).join('');
                    html += `
                        <div class="ldsp-spark-row">
                            <span class="ldsp-spark-label">${t.label}</span>
                            <div class="ldsp-spark-bars">${bars}</div>
                            <span class="ldsp-spark-val">${t.current}</span>
                        </div>
                    `;
                });

                if (trends.length > 0 && trends[0].dates.length > 0) {
                    const dates = trends[0].dates;
                    html += `<div class="ldsp-date-labels">`;
                    dates.forEach(d => {
                        html += `<span class="ldsp-date-label">${d}</span>`;
                    });
                    html += `</div>`;
                }

                html += `</div>`;
            }

            // 添加变化统计
            const oldest = recent[0];
            const newest = recent[recent.length - 1];

            let changes = '';
            reqs.forEach(r => {
                const oldVal = oldest.data[r.name] || 0;
                const newVal = newest.data[r.name] || 0;
                const diff = newVal - oldVal;
                if (diff !== 0) {
                    const name = Utils.simplifyName(r.name);
                    const cls = diff > 0 ? 'up' : 'down';
                    changes += `
                        <div class="ldsp-change-row">
                            <span class="ldsp-change-name">${name}</span>
                            <span class="ldsp-change-val ${cls}">${diff > 0 ? '+' : ''}${diff}</span>
                        </div>
                    `;
                }
            });

            if (changes) {
                html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📊 7天总变化</div><div class="ldsp-changes">${changes}</div></div>`;
            }

            return html;
        }

        renderReadingWeekChart() {
            // 使用阅读追踪器获取7天数据
            const days = readingTracker.getReadingTimeHistory(7);
            const maxTime = Math.max(...days.map(d => d.minutes), 60);

            let barsHtml = days.map(d => {
                const height = Math.max(d.minutes / maxTime * 50, 4);
                const timeStr = Utils.formatReadingTime(d.minutes);
                const opacity = d.isToday ? '1' : '0.7';
                return `
                    <div class="ldsp-reading-day">
                        <div class="ldsp-reading-day-bar" style="height:${height}px; opacity:${opacity}" data-time="${timeStr}"></div>
                        <span class="ldsp-reading-day-label">${d.dayName}</span>
                    </div>
                `;
            }).join('');

            const totalWeekTime = days.reduce((sum, d) => sum + d.minutes, 0);
            const avgTime = Math.round(totalWeekTime / 7);

            return `
                <div class="ldsp-chart">
                    <div class="ldsp-chart-title">
                        ⏱️ 7天阅读时间
                        <span class="ldsp-chart-subtitle">共 ${Utils.formatReadingTime(totalWeekTime)} · 日均 ${Utils.formatReadingTime(avgTime)}</span>
                    </div>
                    <div class="ldsp-reading-week">
                        ${barsHtml}
                    </div>
                </div>
            `;
        }

        renderAllTrend(history, reqs) {
            if (history.length < 2) {
                return `<div class="ldsp-empty"><div class="ldsp-empty-icon">📊</div><div class="ldsp-empty-text">数据不足<br>持续访问积累数据</div></div>`;
            }

            const oldest = history[0];
            const newest = history[history.length - 1];
            const totalDays = Math.ceil((Date.now() - oldest.ts) / 86400000);
            const displayDays = Math.min(history.length, 30);
            const recentHistory = history.slice(-displayDays);

            let html = `<div class="ldsp-time-info">共记录 <span>${totalDays}</span> 天数据，显示最近 <span>${displayDays}</span> 天</div>`;

            // 总阅读时间统计
            const totalReadingTime = readingTracker.getTotalReadingTime();
            const avgReadingTime = Math.round(totalReadingTime / Math.max(totalDays, 1));

            if (totalReadingTime > 0) {
                const level = Utils.getReadingLevel(avgReadingTime);
                html += `
                    <div class="ldsp-reading-stats">
                        <div class="ldsp-reading-stats-icon">📚</div>
                        <div class="ldsp-reading-stats-info">
                            <div class="ldsp-reading-stats-value">${Utils.formatReadingTime(totalReadingTime)}</div>
                            <div class="ldsp-reading-stats-label">累计阅读时间 · 日均 ${Utils.formatReadingTime(avgReadingTime)}</div>
                        </div>
                        <div class="ldsp-reading-stats-badge" style="background: ${level.bg}; color: ${level.color};">${level.label}</div>
                    </div>
                `;
            }

            const keys = ['浏览的话题', '已读帖子', '获赞', '送出赞', '回复'];
            const trends = [];

            keys.forEach(key => {
                const req = reqs.find(r => r.name.includes(key));
                if (!req) return;
                const dailyData = this.aggregateByDay(recentHistory, req.name, displayDays);
                if (dailyData.values.some(v => v > 0)) {
                    trends.push({ label: key.replace('浏览的话题', '浏览话题'), ...dailyData, current: req.currentValue });
                }
            });

            if (trends.length > 0) {
                html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📈 历史趋势</div>`;

                trends.forEach(t => {
                    const max = Math.max(...t.values, 1);
                    const bars = t.values.map((v, i) => {
                        const height = Math.max(v / max * 22, 3);
                        return `<div class="ldsp-spark-bar" style="height:${height}px" data-value="${v}"></div>`;
                    }).join('');
                    html += `
                        <div class="ldsp-spark-row">
                            <span class="ldsp-spark-label">${t.label}</span>
                            <div class="ldsp-spark-bars">${bars}</div>
                            <span class="ldsp-spark-val">${t.current}</span>
                        </div>
                    `;
                });

                if (trends.length > 0 && trends[0].dates.length > 0) {
                    const dates = trends[0].dates;
                    html += `<div class="ldsp-date-labels">`;
                    html += `<span class="ldsp-date-label">${dates[0]}</span>`;
                    if (dates.length > 2) {
                        const mid = Math.floor(dates.length / 2);
                        html += `<span class="ldsp-date-label">${dates[mid]}</span>`;
                    }
                    html += `<span class="ldsp-date-label">${dates[dates.length - 1]}</span>`;
                    html += `</div>`;
                }

                html += `</div>`;
            }

            // 总变化
            let changes = '';
            reqs.forEach(r => {
                const oldVal = oldest.data[r.name] || 0;
                const newVal = newest.data[r.name] || 0;
                const diff = newVal - oldVal;
                if (diff !== 0) {
                    const name = Utils.simplifyName(r.name);
                    const cls = diff > 0 ? 'up' : 'down';
                    changes += `
                        <div class="ldsp-change-row">
                            <span class="ldsp-change-name">${name}</span>
                            <span class="ldsp-change-val ${cls}">${diff > 0 ? '+' : ''}${diff}</span>
                        </div>
                    `;
                }
            });

            if (changes) {
                html += `<div class="ldsp-chart"><div class="ldsp-chart-title">📊 累计变化</div><div class="ldsp-changes">${changes}</div></div>`;
            }

            return html;
        }

        aggregateByDay(history, name, maxDays) {
            const values = [];
            const dates = [];
            const dayMap = new Map();

            history.forEach(h => {
                const day = new Date(h.ts).toDateString();
                dayMap.set(day, h.data[name] || 0);
            });

            dayMap.forEach((val, day) => {
                const d = new Date(day);
                dates.push(Utils.formatDate(d.getTime(), 'short'));
                values.push(val);
            });

            return { values: values.slice(-maxDays), dates: dates.slice(-maxDays) };
        }

        checkUpdate() {
            const url = 'https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js';
            this.$.btnUpdate.textContent = '⏳';

            GM_xmlhttpRequest({
                method: 'GET',
                url,
                timeout: 10000,
                onload: res => {
                    const match = res.responseText.match(/@version\s+([\d.]+)/);
                    if (match) {
                        const remote = match[1];
                        if (Utils.compareVersion(remote, GM_info.script.version) > 0) {
                            this.$.btnUpdate.textContent = '🆕';
                            this.$.btnUpdate.title = `新版本 v${remote}`;
                            this.$.btnUpdate.onclick = () => window.open(url);
                        } else {
                            this.$.btnUpdate.textContent = '✅';
                            setTimeout(() => { this.$.btnUpdate.textContent = '🔍'; }, 2000);
                        }
                    }
                },
                onerror: () => {
                    this.$.btnUpdate.textContent = '❌';
                    setTimeout(() => { this.$.btnUpdate.textContent = '🔍'; }, 2000);
                }
            });
        }
    }

    // ==================== 启动 ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new Panel());
    } else {
        new Panel();
    }

})();
