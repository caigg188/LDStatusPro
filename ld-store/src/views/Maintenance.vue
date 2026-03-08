<template>
  <div class="maintenance-page">
    <div class="ambient ambient-left" />
    <div class="ambient ambient-right" />

    <section class="maintenance-shell">
      <div class="shell-grid">
        <div class="hero-column">
          <div class="headline-row">
            <span class="maintenance-badge">临时维护通知</span>
            <span class="status-dot">
              <span class="status-dot__pulse" />
              服务异常处理中
            </span>
          </div>

          <h1 class="maintenance-title">{{ title }}</h1>
          <p class="maintenance-message">{{ message }}</p>

          <div class="signal-row">
            <span class="signal-pill">最后更新 {{ updatedAt }}</span>
            <span class="signal-pill signal-pill--warning">后端核心接口维护中</span>
          </div>

          <div class="maintenance-panel">
            <div class="panel-card panel-card--alert">
              <p class="panel-label">当前情况</p>
              <p class="panel-value">
                前端页面仍可访问，但依赖后端云服务器的核心接口已暂时不可用。
              </p>
            </div>

            <div class="panel-card">
              <p class="panel-label">受影响功能</p>
              <p class="panel-value">
                商品、小店、订单、评论、消息、商家服务等数据请求将暂停响应。
              </p>
            </div>

            <div class="panel-card">
              <p class="panel-label">恢复进度</p>
              <p class="panel-value">{{ eta }}</p>
            </div>
          </div>

          <div class="action-row">
            <a
              class="action-btn action-btn--primary"
              :href="statusUrl"
              target="_blank"
              rel="noreferrer"
            >
              查看状态检测页
            </a>
            <button class="action-btn action-btn--secondary" type="button" @click="reloadPage">
              刷新页面
            </button>
          </div>
        </div>

        <aside class="status-board">
          <p class="status-board__eyebrow">服务快照</p>
          <div
            v-for="item in serviceStatus"
            :key="item.name"
            class="service-item"
          >
            <div class="service-copy">
              <p class="service-name">{{ item.name }}</p>
              <p class="service-desc">{{ item.description }}</p>
            </div>
            <span class="service-state" :class="`service-state--${item.tone}`">
              {{ item.state }}
            </span>
          </div>

          <div class="status-board__footer">
            <p class="status-board__footnote">最新可用性与恢复进展请以状态页为准。</p>
            <a :href="statusUrl" target="_blank" rel="noreferrer" class="status-inline-link">
              打开状态检测页
            </a>
          </div>
        </aside>
      </div>

      <div class="notice-block">
        <p class="notice-title">维护说明</p>
        <ul class="notice-list">
          <li>本次维护由后端云服务器异常触发，正在进行排查和恢复。</li>
          <li>维护期间请勿重复提交下单、发帖、编辑或商家相关操作。</li>
          <li>若页面未立即恢复，可稍后刷新或打开状态检测页查看最新进度。</li>
        </ul>
      </div>

      <p class="footer-note">
        状态页：
        <a :href="statusUrl" target="_blank" rel="noreferrer">{{ statusUrl }}</a>
      </p>
    </section>
  </div>
</template>

<script setup>
import {
  MAINTENANCE_ETA,
  MAINTENANCE_MESSAGE,
  MAINTENANCE_STATUS_URL,
  MAINTENANCE_TITLE,
} from '@/config/maintenance';

const title = MAINTENANCE_TITLE;
const message = MAINTENANCE_MESSAGE;
const eta = MAINTENANCE_ETA;
const statusUrl = MAINTENANCE_STATUS_URL;
const updatedAt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

const serviceStatus = [
  {
    name: 'LD士多前端站点',
    description: '公告页可访问，静态资源正常分发。',
    state: '在线',
    tone: 'ok',
  },
  {
    name: 'LD士多后端服务',
    description: '核心业务接口异常，正在维护恢复。',
    state: '维护中',
    tone: 'warning',
  },
  {
    name: '状态检测页',
    description: '可继续查看服务可用性与后续进展。',
    state: '可访问',
    tone: 'info',
  },
];

function reloadPage() {
  window.location.reload();
}
</script>

<style scoped>
.maintenance-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: clamp(24px, 4vw, 48px);
  background:
    radial-gradient(circle at top left, rgba(232, 129, 45, 0.18), transparent 36%),
    radial-gradient(circle at right center, rgba(18, 101, 117, 0.16), transparent 34%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 92%, #fff 8%), var(--bg-primary));
}

.ambient {
  position: absolute;
  inset: auto;
  width: 320px;
  height: 320px;
  border-radius: 999px;
  filter: blur(20px);
  opacity: 0.6;
  pointer-events: none;
}

.ambient-left {
  top: -80px;
  left: -70px;
  background: rgba(234, 179, 8, 0.18);
}

.ambient-right {
  right: -90px;
  bottom: -100px;
  background: rgba(14, 116, 144, 0.18);
}

.maintenance-shell {
  position: relative;
  width: min(100%, 1080px);
  border: 1px solid color-mix(in srgb, var(--border-color) 88%, #ffffff 12%);
  border-radius: 34px;
  padding: clamp(28px, 4vw, 44px);
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--bg-card) 92%, #fff 8%), var(--bg-card));
  box-shadow:
    0 28px 80px rgba(27, 32, 40, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.shell-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
  gap: 22px;
  align-items: start;
}

.hero-column {
  min-width: 0;
}

.headline-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.maintenance-badge,
.status-dot,
.signal-pill,
.service-state {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.maintenance-badge {
  color: #8a3b12;
  background: rgba(249, 115, 22, 0.16);
  border: 1px solid rgba(249, 115, 22, 0.16);
}

.status-dot {
  color: #0f766e;
  background: rgba(45, 212, 191, 0.12);
  border: 1px solid rgba(45, 212, 191, 0.18);
}

.status-dot__pulse {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0 rgba(15, 118, 110, 0.35);
  animation: pulse 1.8s ease-out infinite;
}

.maintenance-title {
  margin: 0;
  max-width: none;
  width: fit-content;
  white-space: nowrap;
  font-size: clamp(2.35rem, 5vw, 4.6rem);
  line-height: 0.98;
  letter-spacing: -0.045em;
  color: var(--text-primary);
}

.maintenance-message {
  margin: 18px 0 0;
  max-width: 720px;
  font-size: clamp(1rem, 1.8vw, 1.18rem);
  line-height: 1.82;
  color: var(--text-secondary);
  text-wrap: balance;
}

.signal-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.signal-pill {
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-secondary) 86%, #ffffff 14%);
  border: 1px solid color-mix(in srgb, var(--border-color) 84%, #ffffff 16%);
}

.signal-pill--warning {
  color: #b45309;
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.18);
}

.maintenance-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 24px;
}

.panel-card {
  min-height: 154px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--border-color) 84%, #ffffff 16%);
  background: color-mix(in srgb, var(--bg-secondary) 80%, #ffffff 20%);
}

.panel-card--alert {
  background:
    linear-gradient(180deg, rgba(249, 115, 22, 0.12), rgba(249, 115, 22, 0.04)),
    color-mix(in srgb, var(--bg-secondary) 84%, #ffffff 16%);
}

.panel-label {
  margin: 0 0 10px;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.panel-value {
  margin: 0;
  font-size: 1rem;
  line-height: 1.8;
  color: var(--text-primary);
}

.status-board {
  padding: 22px;
  border-radius: 28px;
  border: 1px solid color-mix(in srgb, var(--border-color) 84%, #ffffff 16%);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 82%, #ffffff 18%), var(--bg-card));
}

.status-board__eyebrow {
  margin: 0 0 14px;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.service-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 0;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 82%, #ffffff 18%);
}

.service-item:first-of-type {
  border-top: none;
  padding-top: 0;
}

.service-copy {
  min-width: 0;
}

.service-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.service-desc {
  margin: 8px 0 0;
  font-size: 0.93rem;
  line-height: 1.7;
  color: var(--text-secondary);
}

.service-state {
  flex-shrink: 0;
  min-height: 32px;
  padding-inline: 12px;
}

.service-state--ok {
  color: #0f766e;
  background: rgba(45, 212, 191, 0.12);
}

.service-state--warning {
  color: #b45309;
  background: rgba(245, 158, 11, 0.12);
}

.service-state--info {
  color: #1d4ed8;
  background: rgba(59, 130, 246, 0.12);
}

.status-board__footer {
  margin-top: 12px;
  padding-top: 18px;
  border-top: 1px dashed color-mix(in srgb, var(--border-color) 80%, #ffffff 20%);
}

.status-board__footnote {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.status-inline-link {
  display: inline-flex;
  margin-top: 12px;
  color: var(--text-primary);
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--text-primary) 28%, transparent);
  text-underline-offset: 4px;
}

.notice-block {
  margin-top: 22px;
  padding: 20px 22px;
  border-radius: 24px;
  border: 1px dashed color-mix(in srgb, var(--border-color) 80%, #ffffff 20%);
  background: color-mix(in srgb, var(--bg-primary) 76%, #ffffff 24%);
}

.notice-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.notice-list {
  margin: 12px 0 0;
  padding-left: 18px;
  color: var(--text-secondary);
  line-height: 1.9;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 20px;
  border-radius: 16px;
  font-weight: 700;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.action-btn--primary {
  color: #ffffff;
  background: linear-gradient(135deg, #f97316, #ea580c);
  box-shadow: 0 14px 30px rgba(234, 88, 12, 0.22);
}

.action-btn--secondary {
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-card) 88%, #ffffff 12%);
}

.footer-note {
  margin: 18px 0 0;
  color: var(--text-tertiary);
  font-size: 0.94rem;
}

.footer-note a {
  color: var(--text-primary);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--text-primary) 28%, transparent);
  text-underline-offset: 4px;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(15, 118, 110, 0.3);
  }

  70% {
    box-shadow: 0 0 0 12px rgba(15, 118, 110, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(15, 118, 110, 0);
  }
}

@media (max-width: 960px) {
  .shell-grid {
    grid-template-columns: 1fr;
  }

  .maintenance-panel {
    grid-template-columns: 1fr;
  }

  .panel-card {
    min-height: auto;
  }
}

@media (max-width: 640px) {
  .maintenance-shell {
    border-radius: 24px;
    padding: 24px 18px;
  }

  .maintenance-title {
    width: 100%;
    white-space: normal;
    font-size: clamp(2rem, 10vw, 3rem);
  }

  .status-board {
    padding: 18px;
    border-radius: 22px;
  }

  .service-item {
    flex-direction: column;
  }

  .action-row {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }
}
</style>
