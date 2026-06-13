<template>
  <div class="maintenance-page">
    <div class="ambient ambient-left" />
    <div class="ambient ambient-right" />

    <section class="maintenance-shell">
      <div class="shell-grid">
        <div class="hero-column">
          <div class="headline-row">
            <span class="maintenance-badge">{{ isRestricted ? '受限维护通知' : '临时维护通知' }}</span>
            <span class="status-dot">
              <span class="status-dot__pulse" />
              {{ isRestricted ? '积分服务受限中' : '站点维护中' }}
            </span>
          </div>

          <h1 class="maintenance-title">{{ title }}</h1>
          <p class="maintenance-message">{{ message }}</p>

          <div class="signal-row">
            <span class="signal-pill">最后更新：{{ updatedAt }}</span>
            <span class="signal-pill signal-pill--warning">
              {{ isRestricted ? 'LinuxDo Credit 积分服务受限中' : '全站维护中' }}
            </span>
          </div>

          <div class="maintenance-panel">
            <div class="panel-card panel-card--alert">
              <p class="panel-label">当前情况</p>
              <p class="panel-value">{{ reason }}</p>
            </div>

            <div class="panel-card">
              <p class="panel-label">{{ isRestricted ? '当前仍可使用' : '当前开放范围' }}</p>
              <ul class="panel-list">
                <li v-for="item in allowedActions" :key="`allow-${item}`">{{ item }}</li>
              </ul>
            </div>

            <div class="panel-card">
              <p class="panel-label">{{ isRestricted ? '当前暂不可用' : '恢复进度' }}</p>
              <ul v-if="isRestricted" class="panel-list panel-list--warning">
                <li v-for="item in blockedActions" :key="`block-${item}`">{{ item }}</li>
              </ul>
              <p v-else class="panel-value">{{ eta }}</p>
            </div>
          </div>

          <div class="action-row">
            <router-link
              v-if="userStore.isLoggedIn && isRestricted"
              class="action-btn action-btn--primary"
              to="/user/orders"
            >
              查看我的订单
            </router-link>
            <router-link
              v-if="userStore.isLoggedIn && isRestricted"
              class="action-btn action-btn--secondary"
              to="/user/products"
            >
              管理商品 CDK
            </router-link>
            <a
              class="action-btn action-btn--secondary"
              :href="statusUrl"
              target="_blank"
              rel="noreferrer"
            >
              查看状态页
            </a>
            <button class="action-btn action-btn--ghost" type="button" @click="reloadPage">
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
            <p class="status-board__footnote">恢复进度与可用性以状态页为准。</p>
            <a :href="statusUrl" target="_blank" rel="noreferrer" class="status-inline-link">
              打开状态页
            </a>
          </div>
        </aside>
      </div>

      <div class="notice-block">
        <p class="notice-title">维护说明</p>
        <ul class="notice-list">
          <li v-for="item in noticeItems" :key="item">{{ item }}</li>
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
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { MAINTENANCE_STATE, isRestrictedMaintenanceMode } from '@/config/maintenance'

const userStore = useUserStore()

const isRestricted = computed(() => isRestrictedMaintenanceMode())
const title = computed(() => MAINTENANCE_STATE.title)
const message = computed(() => MAINTENANCE_STATE.message)
const reason = computed(() => MAINTENANCE_STATE.reason)
const eta = computed(() => MAINTENANCE_STATE.eta)
const statusUrl = computed(() => MAINTENANCE_STATE.statusUrl)
const allowedActions = computed(() => MAINTENANCE_STATE.allowedActions || [])
const blockedActions = computed(() => MAINTENANCE_STATE.blockedActions || [])
const updatedAt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date())

const serviceStatus = computed(() => {
  if (isRestricted.value) {
    return [
      {
        name: 'LD士多站点',
        description: '商品浏览、订单查看与商品 CDK 管理保持可用。',
        state: '受限开放',
        tone: 'ok',
      },
      {
        name: 'LinuxDo Credit 积分服务',
        description: '积分支付与结算能力暂时不可用，恢复时间待定。',
        state: '维护中',
        tone: 'warning',
      },
      {
        name: '创建订单与求购交易',
        description: '所有依赖 LDC 支付的新交易链路已暂时关闭。',
        state: '已暂停',
        tone: 'warning',
      },
    ]
  }

  return [
    {
      name: 'LD士多站点',
      description: '当前处于全站维护状态，仅保留公告与状态信息。',
      state: '维护中',
      tone: 'warning',
    },
    {
      name: 'LinuxDo Credit 积分服务',
      description: '上游能力状态请以 LinuxDo 与状态页通知为准。',
      state: '待恢复',
      tone: 'info',
    },
    {
      name: '恢复通知',
      description: '恢复后会第一时间切回正常模式。',
      state: '关注中',
      tone: 'info',
    },
  ]
})

const noticeItems = computed(() => {
  if (isRestricted.value) {
    return [
      '本次受限维护原因为 LinuxDo 暂时下线 Credit 积分服务，恢复时间待定。',
      '维护期间可以继续查看订单、查看已完成订单中的 CDK，并在“我的商品”中管理 CDK。',
      '创建订单、拉起支付、求购交易、图床上传、商品发布编辑与置顶服务购买已临时关闭。',
      '积分服务恢复后，只需切回正常维护模式即可一键恢复全部支付链路。',
    ]
  }

  return [
    '当前处于全站维护模式，请稍后再试。',
    '恢复时间与可用性将通过状态页同步。',
    '维护完成后将自动恢复正常访问。',
  ]
})

function reloadPage() {
  window.location.reload()
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
  width: min(100%, 1120px);
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
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.maintenance-badge {
  color: #92400e;
  background: rgba(251, 191, 36, 0.18);
}

.status-dot {
  color: #0f766e;
  background: rgba(20, 184, 166, 0.14);
}

.status-dot__pulse {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0 6px rgba(20, 184, 166, 0.12);
}

.maintenance-title {
  margin: 0;
  font-size: clamp(32px, 5vw, 48px);
  line-height: 1.05;
  color: var(--text-primary);
}

.maintenance-message {
  margin: 16px 0 0;
  font-size: 16px;
  line-height: 1.75;
  color: var(--text-secondary);
}

.signal-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.signal-pill {
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-secondary) 82%, #fff 18%);
}

.signal-pill--warning {
  color: #b45309;
  background: rgba(245, 158, 11, 0.16);
}

.maintenance-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 26px;
}

.panel-card {
  min-height: 160px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--border-color) 90%, #ffffff 10%);
  background: color-mix(in srgb, var(--bg-secondary) 74%, #fff 26%);
}

.panel-card--alert {
  background:
    linear-gradient(165deg, rgba(251, 191, 36, 0.16), rgba(255, 255, 255, 0.82));
  border-color: rgba(245, 158, 11, 0.22);
}

.panel-label {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.panel-value {
  margin: 0;
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary);
}

.panel-list {
  margin: 0;
  padding-left: 18px;
  color: var(--text-primary);
  line-height: 1.7;
}

.panel-list--warning {
  color: #92400e;
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
  min-width: 150px;
  padding: 12px 18px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-weight: 700;
  text-decoration: none;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  cursor: pointer;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.action-btn--primary {
  color: #ffffff;
  background: linear-gradient(135deg, #111827, #1f2937);
  box-shadow: 0 16px 30px rgba(17, 24, 39, 0.18);
}

.action-btn--secondary {
  color: #b45309;
  background: rgba(255, 255, 255, 0.82);
  border-color: rgba(245, 158, 11, 0.24);
}

.action-btn--ghost {
  color: var(--text-secondary);
  background: transparent;
  border-color: rgba(148, 163, 184, 0.36);
}

.status-board {
  padding: 20px;
  border-radius: 26px;
  border: 1px solid color-mix(in srgb, var(--border-color) 90%, #ffffff 10%);
  background: linear-gradient(160deg, rgba(17, 24, 39, 0.04), rgba(255, 255, 255, 0.72));
}

.status-board__eyebrow {
  margin: 0 0 16px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.service-item + .service-item {
  margin-top: 14px;
}

.service-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.74);
}

.service-copy {
  min-width: 0;
}

.service-name {
  margin: 0;
  font-weight: 700;
  color: var(--text-primary);
}

.service-desc {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.service-state {
  flex-shrink: 0;
}

.service-state--ok {
  color: #0f766e;
  background: rgba(45, 212, 191, 0.18);
}

.service-state--warning {
  color: #b45309;
  background: rgba(251, 191, 36, 0.18);
}

.service-state--info {
  color: #1d4ed8;
  background: rgba(96, 165, 250, 0.16);
}

.status-board__footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed rgba(148, 163, 184, 0.4);
}

.status-board__footnote,
.footer-note {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.status-inline-link,
.footer-note a {
  color: #b45309;
  text-decoration: none;
}

.notice-block {
  margin-top: 22px;
  padding: 20px 22px;
  border-radius: 24px;
  background: color-mix(in srgb, var(--bg-secondary) 80%, #fff 20%);
}

.notice-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.notice-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
  color: var(--text-secondary);
}

.footer-note {
  margin-top: 18px;
  text-align: center;
}

@media (max-width: 920px) {
  .shell-grid {
    grid-template-columns: 1fr;
  }

  .maintenance-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .maintenance-page {
    padding: 16px;
  }

  .maintenance-shell {
    border-radius: 26px;
    padding: 20px;
  }

  .maintenance-title {
    font-size: 30px;
  }

  .action-row {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }

  .status-board,
  .notice-block {
    border-radius: 20px;
  }
}
</style>
