<template>
  <div class="merchant-profile-page">
    <div class="page-shell">
      <div class="back-row">
        <button class="back-btn" type="button" @click="goBack">← 返回</button>
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
          <div class="merchant-header">
            <AvatarImage
              :candidates="merchantAvatarCandidates"
              :seed="merchantAvatarSeed"
              :size="128"
              alt=""
              class="merchant-avatar"
              loading-mode="eager"
            />
            <div class="merchant-info">
              <h1 class="merchant-username">@{{ merchant.username }}</h1>
              <p v-if="merchantDisplayName" class="merchant-name">{{ merchantDisplayName }}</p>
              <span :class="['trust-chip', trustBadgeClass]">
                {{ trustLevelText }}
              </span>
            </div>
            <div class="merchant-stats">
              <div class="stat-item">
                <strong class="stat-value">{{ stats.onlineCount || 0 }}</strong>
                <span class="stat-label">在售</span>
              </div>
              <div class="stat-item">
                <strong class="stat-value">{{ stats.totalListedCount || 0 }}</strong>
                <span class="stat-label">上架</span>
              </div>
              <div class="stat-item">
                <strong class="stat-value">{{ stats.totalSoldCount || 0 }}</strong>
                <span class="stat-label">销量</span>
              </div>
            </div>
          </div>

          <div class="merchant-actions">
            <button class="action-chip chip-linuxdo" type="button" @click="openLinuxDoProfile">
              <img src="https://img.ldstore.cc.cd/JackyLiii/20260424_logo-new-5_0vbj4s.png" alt="" class="chip-icon chip-icon--img" />
              LinuxDo
            </button>
            <button class="action-chip chip-message" type="button" @click="openStoreMessage">
              <svg class="chip-icon chip-icon--svg" width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M2 4.5L8 8.5L14 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              士多私信
            </button>
          </div>
        </section>

        <section class="products-panel">
          <div class="section-header">
            <h2 class="section-title">在售物品</h2>
            <span class="section-count">{{ products.length }} 件</span>
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
  if (trustLevelValue.value >= 4) return 'trust-chip--4'
  if (trustLevelValue.value >= 3) return 'trust-chip--3'
  if (trustLevelValue.value >= 2) return 'trust-chip--2'
  if (trustLevelValue.value >= 1) return 'trust-chip--1'
  return 'trust-chip--0'
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
  if (route.query.from) {
    router.push(String(route.query.from))
    return
  }
  router.push({ name: 'Home', query: { tab: 'stores' } })
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
  padding: 16px 0 72px;
  background: var(--bg-primary);
  --merchant-card-bg: #fcfaf6;
  --merchant-card-border: #e4dbcf;
  --merchant-card-shadow: 0 2px 12px rgba(61, 61, 61, 0.05);
  --merchant-subtle-bg: #f5f3ef;
  --merchant-subtle-border: #e4dbcf;
  --merchant-hover-border: #cad6cb;
  --merchant-accent: #7f9681;
  --merchant-accent-bg: #eef3ed;
  --merchant-primary: #b5a898;
  --merchant-empty-bg: #f5f3ef;
  --merchant-empty-border: #ddd7ce;
  --product-card-border: #f0ede9;
  --product-card-category-bg: #eef3ed;
  --product-card-discount-bg: #fce8ec;
  --product-card-discount-ring: #f5c6d0;
  --avatar-surface-bg: #dfe3e8;
  --avatar-placeholder-bg: #f2f0ed;
  --skeleton-card-border: #e4dbcf;
}

:global(html.dark .merchant-profile-page) {
  --merchant-card-bg: #22201e;
  --merchant-card-border: #33302c;
  --merchant-card-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  --merchant-subtle-bg: #28261f;
  --merchant-subtle-border: #33302c;
  --merchant-hover-border: #4a5048;
  --merchant-accent: #8faa92;
  --merchant-accent-bg: #2e342a;
  --merchant-primary: #b5a898;
  --merchant-empty-bg: #1e1c1a;
  --merchant-empty-border: #33302c;
  --product-card-border: #33302c;
  --product-card-category-bg: #2e342a;
  --product-card-discount-bg: #3a2225;
  --product-card-discount-ring: #3f282c;
  --avatar-surface-bg: #2c2a26;
  --avatar-placeholder-bg: #2a2521;
  --skeleton-card-border: #33302c;
}

.page-shell {
  max-width: 1200px;
  width: calc(100% - 32px);
  margin: 0 auto;
  display: grid;
  gap: 14px;
}

/* ── Back button ── */
.back-row {
  display: flex;
  align-items: center;
}

.back-btn {
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

/* ── Merchant card ── */
.merchant-card,
.products-panel {
  border: 1px solid var(--merchant-card-border);
  border-radius: 20px;
  background: var(--merchant-card-bg);
  box-shadow: var(--merchant-card-shadow);
  isolation: isolate;
}

.merchant-card {
  padding: 20px;
}

.merchant-header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.merchant-avatar {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid var(--merchant-accent-bg);
  box-shadow: 0 2px 8px rgba(127, 150, 129, 0.15);
}

.merchant-info {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.merchant-username {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
  color: var(--text-primary);
  word-break: break-word;
  font-weight: 700;
}

.merchant-name {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.trust-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.trust-chip--0 { background: #eef1f5; color: #596172; }
.trust-chip--1 { background: #e8eef8; color: #1d4ed8; }
.trust-chip--2 { background: #e8f3eb; color: #15803d; }
.trust-chip--3 { background: #f5eee3; color: #a16207; }
.trust-chip--4 { background: #f5eaea; color: #b91c1c; }

:global(html.dark .merchant-profile-page .trust-chip--0) { background: #2f3134; color: #d5d9e1; }
:global(html.dark .merchant-profile-page .trust-chip--1) { background: #2a3040; color: #bfdbfe; }
:global(html.dark .merchant-profile-page .trust-chip--2) { background: #2a3530; color: #bbf7d0; }
:global(html.dark .merchant-profile-page .trust-chip--3) { background: #363024; color: #fde68a; }
:global(html.dark .merchant-profile-page .trust-chip--4) { background: #3a2225; color: #fecaca; }

/* ── Stats ── */
.merchant-stats {
  display: flex;
  gap: 8px;
  margin-left: auto;
  flex-shrink: 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  border-radius: 12px;
  background: var(--merchant-subtle-bg);
  border: 1px solid var(--merchant-subtle-border);
  gap: 2px;
  min-width: 64px;
  transition: border-color 0.15s;
}

.stat-item:hover {
  border-color: var(--merchant-hover-border);
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--merchant-accent);
  line-height: 1.1;
}

.stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 500;
}

/* ── Action chips ── */
.merchant-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--merchant-subtle-border);
}

.action-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--merchant-subtle-border);
  border-radius: 10px;
  background: var(--merchant-subtle-bg);
  color: var(--text-secondary);
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s;
}

.action-chip:hover {
  background: var(--merchant-accent-bg);
  border-color: var(--merchant-hover-border);
  color: var(--merchant-accent);
  box-shadow: 0 2px 8px rgba(127, 150, 129, 0.12);
}

.chip-icon {
  flex-shrink: 0;
}

.chip-icon--img {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  object-fit: contain;
}

.chip-icon--svg {
  color: inherit;
}

.chip-linuxdo:hover .chip-icon--img {
  filter: brightness(1.1);
}

/* ── Products panel ── */
.products-panel {
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 14px;
}

.section-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.section-count {
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--merchant-subtle-bg);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 500;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.empty-panel {
  border-radius: 12px;
  background: var(--merchant-empty-bg);
  border: 1px dashed var(--merchant-empty-border);
  padding: 24px;
}

/* ── Error state ── */
.error-card {
  justify-items: center;
  text-align: center;
  padding: 40px 20px;
}

.error-icon { font-size: 32px; }

.error-title {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.error-hint {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 16px;
}

.action-btn {
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.action-btn.primary {
  border: none;
  color: #fff;
  background: var(--merchant-accent);
}

.action-btn.secondary {
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  background: var(--bg-card);
}

/* ── Loading skeleton ── */
.loading-card {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}

.loading-avatar {
  width: 56px;
  height: 56px;
  border-radius: 16px;
}

.loading-body {
  display: grid;
  gap: 8px;
}

.loading-line {
  height: 14px;
  border-radius: 6px;
}

.w-24 { width: 24%; }
.w-40 { width: 40%; }
.w-70 { width: 70%; }

.skeleton-block {
  background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--bg-tertiary) 50%, var(--skeleton-base) 75%);
  background-size: 200% 100%;
  animation: merchant-shimmer 1.5s infinite;
}

@keyframes merchant-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* ── Responsive: Tablet ── */
@media (max-width: 768px) {
  .merchant-header {
    flex-wrap: wrap;
  }

  .merchant-stats {
    margin-left: 0;
    width: 100%;
  }

  .stat-item {
    flex: 1;
  }

  .products-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* ── Responsive: Mobile ── */
@media (max-width: 520px) {
  .merchant-profile-page {
    padding-top: 8px;
    padding-bottom: 64px;
  }

  .page-shell {
    width: calc(100% - 16px);
    gap: 10px;
  }

  .back-btn {
    padding: 8px 12px;
    font-size: 13px;
    border-radius: 10px;
  }

  .merchant-card {
    padding: 14px;
    border-radius: 16px;
  }

  .merchant-header {
    gap: 12px;
  }

  .merchant-avatar,
  .loading-avatar {
    width: 44px;
    height: 44px;
    border-radius: 14px;
  }

  .merchant-info {
    gap: 4px;
  }

  .merchant-username {
    font-size: 18px;
  }

  .merchant-name {
    font-size: 12px;
  }

  .trust-chip {
    padding: 1px 6px;
    font-size: 10px;
  }

  .merchant-stats {
    gap: 6px;
    margin-top: 2px;
  }

  .stat-item {
    padding: 6px 10px;
    border-radius: 10px;
    min-width: 0;
  }

  .stat-value {
    font-size: 16px;
  }

  .stat-label {
    font-size: 10px;
  }

  .merchant-actions {
    margin-top: 12px;
    padding-top: 12px;
    gap: 8px;
  }

  .action-chip {
    padding: 6px 10px;
    font-size: 12px;
    gap: 4px;
    border-radius: 8px;
  }

  .chip-icon--img {
    width: 14px;
    height: 14px;
  }

  .chip-icon--svg {
    width: 13px;
    height: 13px;
  }

  .products-panel {
    padding: 14px;
    border-radius: 16px;
  }

  .section-header {
    margin-bottom: 10px;
  }

  .section-title {
    font-size: 15px;
  }

  .section-count {
    font-size: 11px;
  }

  .products-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .empty-panel {
    padding: 20px;
    border-radius: 10px;
  }
}

/* ── Responsive: Narrow ── */
@media (max-width: 380px) {
  .merchant-card {
    padding: 12px;
    border-radius: 14px;
  }

  .merchant-avatar,
  .loading-avatar {
    width: 38px;
    height: 38px;
    border-radius: 12px;
  }

  .merchant-username {
    font-size: 16px;
  }

  .stat-item {
    padding: 5px 8px;
  }

  .stat-value {
    font-size: 14px;
  }

  .products-panel {
    padding: 12px;
    border-radius: 14px;
  }

  .products-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>
