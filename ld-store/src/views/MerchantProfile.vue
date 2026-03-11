<template>
  <div class="merchant-profile-page">
    <div class="page-shell">
      <div class="back-row">
        <button class="back-btn" type="button" @click="goBack">
          ← 返回
        </button>
      </div>

      <template v-if="loading">
        <section class="merchant-card loading-card">
          <div class="loading-avatar skeleton-block"></div>
          <div class="loading-body">
            <div class="loading-line w-40 skeleton-block"></div>
            <div class="loading-line w-24 skeleton-block"></div>
            <div class="loading-line w-70 skeleton-block"></div>
          </div>
        </section>
        <section class="products-panel">
          <div class="section-header">
            <h2 class="section-title">在售物品</h2>
          </div>
          <Skeleton type="card" :count="4" :columns="2" />
        </section>
      </template>

      <section v-else-if="error" class="merchant-card error-card">
        <div class="error-icon">😕</div>
        <h1 class="error-title">{{ error }}</h1>
        <p class="error-hint">请检查商家用户名是否正确，或稍后再试。</p>
        <div class="error-actions">
          <button class="action-btn secondary" type="button" @click="goBack">返回</button>
          <button class="action-btn primary" type="button" @click="loadMerchantProfile">重试</button>
        </div>
      </section>

      <template v-else-if="merchant">
        <section class="merchant-card">
          <div class="merchant-main">
            <div class="merchant-identity">
              <AvatarImage
                :candidates="merchantAvatarCandidates"
                :seed="merchantAvatarSeed"
                :size="128"
                alt=""
                class="merchant-avatar"
                loading-mode="eager"
              />

              <div class="merchant-meta">
                <p class="merchant-eyebrow">商家主页</p>
                <h1 class="merchant-username">@{{ merchant.username }}</h1>
                <p v-if="merchantDisplayName" class="merchant-name">{{ merchantDisplayName }}</p>
                <div class="merchant-badges">
                  <span :class="['trust-badge', trustBadgeClass]">
                    信任等级 {{ trustLevelText }}
                  </span>
                </div>
              </div>
            </div>

            <div class="merchant-stats">
              <div class="stat-card">
                <span class="stat-label">在售物品</span>
                <strong class="stat-value">{{ stats.onlineCount || 0 }}</strong>
              </div>
              <div class="stat-card">
                <span class="stat-label">累计上架</span>
                <strong class="stat-value">{{ stats.totalListedCount || 0 }}</strong>
              </div>
              <div class="stat-card">
                <span class="stat-label">累计销量</span>
                <strong class="stat-value">{{ stats.totalSoldCount || 0 }}</strong>
              </div>
            </div>
          </div>

          <div class="contact-grid">
            <button class="contact-card" type="button" @click="openLinuxDoProfile">
              <span class="contact-title">LinuxDo主页</span>
              <span class="contact-desc">点击前往 Linux.do 联系</span>
            </button>
            <button class="contact-card" type="button" @click="openStoreMessage">
              <span class="contact-title">士多私信</span>
              <span class="contact-desc">士多站内信</span>
            </button>
          </div>
        </section>

        <section class="products-panel">
          <div class="section-header">
            <div>
              <h2 class="section-title">在售物品</h2>
              <p class="section-subtitle">
                {{ merchant.username }} 当前共有 {{ products.length }} 件公开在售物品
              </p>
            </div>
          </div>

          <div v-if="products.length > 0" class="products-grid">
            <ProductCard
              v-for="product in products"
              :key="product.id"
              :product="product"
              :categories="categories"
            />
          </div>

          <div v-else class="empty-panel">
            <EmptyState
              icon="📦"
              text="暂无在售物品"
              :hint="emptyHint"
            />
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useUserStore } from '@/stores/user'
import AvatarImage from '@/components/common/AvatarImage.vue'
import { useToast } from '@/composables/useToast'
import { buildAvatarCandidates } from '@/utils/avatar'
import ProductCard from '@/components/product/ProductCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Skeleton from '@/components/common/Skeleton.vue'

defineOptions({ name: 'MerchantProfile' })

const route = useRoute()
const router = useRouter()
const shopStore = useShopStore()
const userStore = useUserStore()
const toast = useToast()

const merchant = ref(null)
const stats = ref({
  onlineCount: 0,
  totalListedCount: 0,
  totalSoldCount: 0
})
const products = ref([])
const loading = ref(true)
const error = ref('')

const categories = computed(() => shopStore.categories || [])
const routeUsername = computed(() => String(route.params.username || '').trim())
const merchantAvatarSeed = computed(() =>
  merchant.value?.name || merchant.value?.username || merchant.value?.userId || 'merchant'
)
const merchantAvatarCandidates = computed(() =>
  buildAvatarCandidates([
    merchant.value?.animated_avatar,
    merchant.value?.avatar,
    merchant.value?.avatar_url,
    merchant.value?.avatar_template
  ], 128)
)
const merchantDisplayName = computed(() => {
  const name = String(merchant.value?.name || '').trim()
  const username = String(merchant.value?.username || '').trim()
  if (!name || name === username) return ''
  return name
})
const trustLevelValue = computed(() => Number(merchant.value?.trustLevel || 0))
const trustLevelText = computed(() => `TL${trustLevelValue.value}`)
const trustBadgeClass = computed(() => {
  if (trustLevelValue.value >= 4) return 'trust-badge--4'
  if (trustLevelValue.value >= 3) return 'trust-badge--3'
  if (trustLevelValue.value >= 2) return 'trust-badge--2'
  if (trustLevelValue.value >= 1) return 'trust-badge--1'
  return 'trust-badge--0'
})
const emptyHint = computed(() => {
  if (!userStore.isLoggedIn && Number(stats.value.onlineCount || 0) > products.value.length) {
    return '该商家还有更高信任等级可见的在售物品，登录并提升账号信任等级后可查看更多。'
  }
  if (userStore.isLoggedIn && Number(stats.value.onlineCount || 0) > products.value.length) {
    return '该商家还有更高信任等级可见的在售物品，提升账号信任等级后可查看更多。'
  }
  return '该商家当前没有公开在售物品。'
})

watch(
  () => merchant.value?.username,
  (username) => {
    document.title = username ? `@${username} 的商家主页 - LD士多` : '商家主页 - LD士多'
  },
  { immediate: true }
)

watch(
  () => route.params.username,
  () => {
    loadMerchantProfile()
  },
  { immediate: true }
)

async function loadMerchantProfile() {
  const username = routeUsername.value
  merchant.value = null
  products.value = []
  stats.value = {
    onlineCount: 0,
    totalListedCount: 0,
    totalSoldCount: 0
  }
  error.value = ''

  if (!username) {
    loading.value = false
    error.value = '商家用户名无效'
    return
  }

  loading.value = true
  try {
    const [profileResult] = await Promise.all([
      shopStore.fetchMerchantProfile(username),
      shopStore.fetchCategories().catch(() => [])
    ])

    if (!profileResult?.success || !profileResult.data?.merchant) {
      error.value = profileResult?.error || '商家不存在或暂未开放主页'
      return
    }

    merchant.value = profileResult.data.merchant
    stats.value = {
      onlineCount: Number(profileResult.data.stats?.onlineCount || 0),
      totalListedCount: Number(profileResult.data.stats?.totalListedCount || 0),
      totalSoldCount: Number(profileResult.data.stats?.totalSoldCount || 0)
    }
    products.value = Array.isArray(profileResult.data.products) ? profileResult.data.products : []
  } catch (loadError) {
    console.error('Load merchant profile failed:', loadError)
    error.value = '加载商家主页失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push('/')
}

function openLinuxDoProfile() {
  const target = String(merchant.value?.linuxdoUrl || '').trim()
  if (!target) {
    toast.warning('商家 Linux.do 主页暂不可用')
    return
  }
  window.open(target, '_blank', 'noopener')
}

function openStoreMessage() {
  toast.warning('该功能暂未开放')
}

</script>

<style scoped>
.merchant-profile-page {
  min-height: 100vh;
  padding: 20px 0 72px;
}

.page-shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  display: grid;
  gap: 18px;
}

.back-row {
  display: flex;
  align-items: center;
}

.back-btn {
  border: none;
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 10px 16px;
  font-size: 14px;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.merchant-card,
.products-panel {
  border: 1px solid var(--glass-border-light, var(--border-light));
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(247, 210, 139, 0.24), transparent 34%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(250, 245, 236, 0.96));
  box-shadow: 0 22px 54px var(--glass-shadow-light, rgba(15, 23, 42, 0.08));
}

.merchant-card {
  padding: 26px;
  display: grid;
  gap: 22px;
}

.merchant-main {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.9fr);
  gap: 20px;
  align-items: center;
}

.merchant-identity {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.merchant-avatar {
  width: 92px;
  height: 92px;
  border-radius: 28px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(148, 112, 33, 0.16);
  box-shadow: 0 18px 40px rgba(145, 106, 31, 0.16);
}

.merchant-meta {
  min-width: 0;
  display: grid;
  gap: 8px;
}

.merchant-eyebrow {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #9b6c13;
}

.merchant-username {
  margin: 0;
  font-size: clamp(28px, 5vw, 40px);
  line-height: 1.05;
  color: #2c1d0a;
  word-break: break-word;
}

.merchant-name {
  margin: 0;
  font-size: 15px;
  color: var(--text-secondary);
}

.merchant-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.trust-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
}

.trust-badge--0 {
  background: rgba(107, 114, 128, 0.12);
  color: #596172;
}

.trust-badge--1 {
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
}

.trust-badge--2 {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.trust-badge--3 {
  background: rgba(202, 138, 4, 0.14);
  color: #a16207;
}

.trust-badge--4 {
  background: rgba(185, 28, 28, 0.12);
  color: #b91c1c;
}

.merchant-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  padding: 18px 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(148, 112, 33, 0.12);
  display: grid;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.stat-value {
  font-size: clamp(24px, 4vw, 32px);
  color: #2f2515;
  line-height: 1;
}

.contact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.contact-card {
  border: 1px solid rgba(148, 112, 33, 0.12);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.82);
  padding: 18px 20px;
  text-align: left;
  cursor: pointer;
  display: grid;
  gap: 6px;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.contact-card:hover {
  transform: translateY(-1px);
  border-color: rgba(193, 138, 25, 0.36);
  box-shadow: 0 16px 30px rgba(193, 138, 25, 0.14);
}

.contact-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.contact-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.products-panel {
  padding: 24px;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.section-title {
  margin: 0;
  font-size: 24px;
  color: #2f2515;
}

.section-subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.empty-panel {
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px dashed rgba(148, 112, 33, 0.18);
}

.error-card {
  justify-items: center;
  text-align: center;
  padding: 48px 24px;
}

.error-icon {
  font-size: 44px;
}

.error-title {
  margin: 0;
  font-size: 24px;
  color: var(--text-primary);
}

.error-hint {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.action-btn {
  border-radius: 999px;
  padding: 11px 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.action-btn.primary {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #c78d1e, #8a5a15);
}

.action-btn.secondary {
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.92);
}

.loading-card {
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
}

.loading-avatar {
  width: 92px;
  height: 92px;
  border-radius: 28px;
}

.loading-body {
  display: grid;
  gap: 10px;
}

.loading-line {
  height: 18px;
  border-radius: 999px;
}

.w-24 {
  width: 24%;
}

.w-40 {
  width: 40%;
}

.w-70 {
  width: 70%;
}

.skeleton-block {
  background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--bg-tertiary) 50%, var(--skeleton-base) 75%);
  background-size: 200% 100%;
  animation: merchant-shimmer 1.5s infinite;
}

@keyframes merchant-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (max-width: 960px) {
  .merchant-main,
  .contact-grid {
    grid-template-columns: 1fr;
  }

  .merchant-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .merchant-profile-page {
    padding-top: 14px;
  }

  .page-shell {
    width: min(100% - 20px, 1120px);
  }

  .merchant-card,
  .products-panel {
    border-radius: 22px;
    padding: 18px;
  }

  .merchant-identity {
    align-items: flex-start;
  }

  .merchant-avatar,
  .loading-avatar {
    width: 76px;
    height: 76px;
    border-radius: 22px;
  }

  .merchant-stats {
    grid-template-columns: 1fr;
  }

  .products-grid {
    grid-template-columns: 1fr;
  }
}
</style>
