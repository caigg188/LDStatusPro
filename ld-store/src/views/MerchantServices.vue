<template>
  <div class="merchant-services-page">
    <div class="page-shell">
      <section class="hero-card">
        <div class="hero-copy">
          <p class="hero-eyebrow">Merchant Services</p>
          <h1 class="hero-title">商家服务</h1>
          <p class="hero-desc">
            士多服务支持自助购买士多甄选与士多优选。支付成功后立即生效，到期自动释放位置，并同步发送系统提醒。所有付费置顶都会绑定下单时的所属分类，切换到其他分类会暂停展示，切回原分类后在有效期内恢复。
          </p>
        </div>
        <div class="hero-badge">
          <span class="hero-badge-label">当前开放</span>
          <strong>士多甄选 | 士多优选</strong>
          <span>金色传说！额外曝光！物超所值！</span>
        </div>
      </section>

      <section class="content-card">
        <LiquidTabs v-model="activeTab" :tabs="tabs" />

        <div v-if="activeTab === 'service'" class="panel-body">
          <div class="service-grid">
            <div class="config-panel">
              <div class="panel-title-row">
                <div>
                  <h2 class="panel-title">选择服务</h2>
                  <p class="panel-subtitle">先选商品，再选套餐与天数。士多甄选按池管理：进入“全部”的分类共享 4 个甄选名额，入站与卡券各自拥有独立的 6 个甄选名额；士多优选按分类独立管理，入站与卡券为 6 个，其余分类为 4 个。付费服务会绑定下单时的所属分类，管理员手动设置的非有偿置顶不受这条规则影响，也不占用这些付费名额。</p>
                </div>
                <button class="ghost-btn" :disabled="optionsLoading" @click="loadOptions">
                  {{ optionsLoading ? '刷新中...' : '刷新额度' }}
                </button>
              </div>

              <div class="field-block">
                <label class="field-label">要置顶的物品</label>
                <AppSelect
                  v-model="selectedProductId"
                  full-width
                  :options="productOptions"
                  :disabled="showPackageLoading"
                  :placeholder="showPackageLoading ? '正在加载可置顶物品...' : '请选择自己已上架的物品'"
                  @change="handleProductChange"
                />
                <p class="field-hint">只展示你自己发布且当前处于已上架状态的物品。</p>
              </div>

              <div class="package-grid">
                <template v-if="showPackageLoading">
                  <article v-for="index in 2" :key="`loading-${index}`" class="package-card package-card--loading" aria-hidden="true">
                    <div class="package-head">
                      <div class="package-loading-copy">
                        <div class="loading-shimmer package-skeleton package-skeleton-title"></div>
                        <div class="loading-shimmer package-skeleton package-skeleton-desc"></div>
                      </div>
                      <div class="loading-shimmer package-skeleton package-skeleton-pill"></div>
                    </div>

                    <div class="duration-list">
                      <div v-for="optionIndex in 3" :key="optionIndex" class="duration-btn duration-btn--loading">
                        <span class="loading-shimmer package-skeleton package-skeleton-days"></span>
                        <span class="loading-shimmer package-skeleton package-skeleton-price"></span>
                      </div>
                    </div>
                  </article>
                </template>

                <template v-else-if="packages.length > 0">
                  <article
                    v-for="group in packages"
                    :key="group.type"
                    class="package-card"
                    :class="{ disabled: isPackageDisabled(group.type) }"
                  >
                    <div class="package-head">
                      <div>
                        <h3 class="package-title">{{ group.name }}</h3>
                        <p class="package-desc">{{ getPackageDescription(group.type) }}</p>
                      </div>
                      <span class="quota-pill">{{ formatRemaining(group.type) }}</span>
                    </div>
                    <div class="package-quota-list">
                      <div
                        v-for="line in getPackageQuotaLines(group.type)"
                        :key="`${group.type}-${line}`"
                        class="package-quota-line"
                      >
                        {{ line }}
                      </div>
                    </div>

                    <div class="duration-list">
                      <button
                        v-for="option in group.options"
                        :key="`${group.type}-${option.durationDays}`"
                        type="button"
                        class="duration-btn"
                        :class="{ active: selectedPackageType === group.type && selectedDurationDays === option.durationDays }"
                        :disabled="isPackageDisabled(group.type) || !option.isEnabled"
                        @click="selectPackage(group.type, option.durationDays)"
                      >
                        <span class="duration-days">{{ option.durationDays }} 天</span>
                        <span class="duration-price">{{ Number(option.price || 0).toFixed(2) }} LDC</span>
                      </button>
                    </div>
                  </article>
                </template>

                <div v-else class="package-empty-state">
                  <strong>当前暂无可用套餐</strong>
                  <p>可能是额度已满或服务暂未开放，可稍后点击“刷新额度”再试。</p>
                </div>
              </div>

              <button class="submit-btn" :disabled="showPackageLoading || !canSubmit || submitting" @click="submitOrder">
                {{ submitting ? '创建订单中...' : showPackageLoading ? '套餐加载中...' : '确认提交' }}
              </button>
            </div>

            <aside class="summary-panel">
              <h2 class="panel-title">服务说明</h2>
              <div class="summary-card summary-card--intro">
                <div class="summary-intro">
                  <span class="summary-kicker">服务权益</span>
                  <strong>置顶曝光之外，还有专属卡片效果和铭牌</strong>
                  <p>根据你的推广目标选择合适的套餐，页面会同步展示对应的尊享标识和视觉强化。</p>
                </div>
                <div class="summary-points">
                  <div class="summary-point">
                    <span class="summary-point-index">01</span>
                    <div class="summary-point-copy">
                      <strong>优先展示，获得更多曝光</strong>
                      <p>置顶服务生效后，物品会展示在对应的置顶位，更容易被买家看到、点击和咨询。</p>
                    </div>
                  </div>
                  <div class="summary-point">
                    <span class="summary-point-index">02</span>
                    <div class="summary-point-copy">
                      <strong>专属铭牌，提升辨识度</strong>
                      <p>付费士多甄选显示“士多甄选”，付费士多优选显示“士多优选”，并附带额外的物品卡片效果；管理员非有偿置顶仅保留排序能力，不附带专属样式。</p>
                    </div>
                  </div>
                  <div class="summary-point">
                    <span class="summary-point-index">03</span>
                    <div class="summary-point-copy">
                      <strong>支付成功立即生效</strong>
                      <p>请根据预算和推广周期选择套餐与时长。订单支付成功后立即生效，到期自动失效；若中途把物品切到其他分类，付费服务会暂停，切回开通分类后恢复。</p>
                    </div>
                  </div>
                </div>
              </div>
              <div class="summary-card">
                <div class="summary-line">
                  <span>已选商品</span>
                  <strong>{{ selectedProduct?.name || '未选择' }}</strong>
                </div>
                <div class="summary-line">
                  <span>套餐</span>
                  <strong>{{ selectedConfig?.groupName || '未选择' }}</strong>
                </div>
                <div class="summary-line">
                  <span>天数</span>
                  <strong>{{ selectedConfig ? `${selectedConfig.durationDays} 天` : '未选择' }}</strong>
                </div>
                <div class="summary-line">
                  <span>价格</span>
                  <strong>{{ selectedConfig ? `${Number(selectedConfig.price || 0).toFixed(2)} LDC` : '-' }}</strong>
                </div>
              </div>

              <div class="notice-card">
                <h3>购买须知</h3>
                <ul>
                  <li>为保证服务质量，付费置顶套餐名额有限。</li>
                  <li>士多甄选会优先展示在对应甄选位中；进入“全部”的分类共用 4 个共享甄选名额，入站与卡券各自拥有 6 个独立甄选名额。</li>
                  <li>士多优选只在所属分类顶部展示，入站与卡券各自有 6 个优选名额，其余分类各有 4 个优选名额。</li>
                  <li>订单支付成功时间即为置顶服务生效时间。</li>
                  <li>待支付订单在支付超时前也会临时占用名额；页面展示的剩余名额已经包含这部分占位。</li>
                  <li>同一物品同一时间只能有一条生效中或待支付的置顶服务。</li>
                  <li>所有付费置顶都会绑定下单时的所属分类；切换到其他分类后，服务会暂停展示，但仍占用原开通分类的名额；切回原分类后会在剩余有效期内恢复。</li>
                  <li>入站与卡券分类的士多甄选使用各自独立甄选池；即使把物品切换到服务等共享池分类，也不会继承“全部分类共享甄选池”的全站展示资格。</li>
                  <li>置顶到期时会自动失效，并通过系统消息提醒你。</li>
                  <li>管理员手动设置的非有偿置顶不占用付费名额，会排在付费置顶之后、普通物品之前。</li>
                  <li class="notice-card-highlight">「士多优选」支持包年服务，如有需要请联系管理员。</li>
                </ul>
              </div>

              <div
                v-if="selectedProduct?.currentTopOrder"
                class="current-top-card"
                :class="{ 'current-top-card--warning': isCurrentTopOrderSuspended(selectedProduct.currentTopOrder) }"
              >
                <h3>当前状态</h3>
                <p>该物品已存在 {{ selectedProduct.currentTopOrder.packageName }} 订单。</p>
                <p>订单状态：{{ getOrderStatusText(selectedProduct.currentTopOrder.status) }}</p>
                <p v-if="selectedProduct.currentTopOrder.categoryBindingApplies">开通分类：{{ selectedProduct.currentTopOrder.boundCategoryName || '未分类' }}</p>
                <p v-if="selectedProduct.currentTopOrder.categoryBindingApplies">当前分类：{{ selectedProduct.currentTopOrder.currentCategoryName || selectedProduct.categoryName || '未分类' }}</p>
                <p>展示状态：{{ getTopEffectivenessText(selectedProduct.currentTopOrder) }}</p>
                <p>到期：{{ selectedProduct.currentTopOrder.expiredAt || '永久置顶' }}</p>
                <p :class="['current-top-card-highlight', { 'current-top-card-highlight--warning': isCurrentTopOrderSuspended(selectedProduct.currentTopOrder) }]">
                  {{ getTopOrderBindingHint(selectedProduct.currentTopOrder) }}
                </p>
              </div>
            </aside>
          </div>
        </div>

        <div v-else-if="activeTab === 'board'" class="panel-body">
          <div class="board-panel">
            <div class="board-toolbar">
              <div>
                <h2 class="panel-title">名额看板</h2>
                <p class="panel-subtitle">查看各个甄选池与优选池的真实剩余名额。上方名额已包含待支付占位；若付费置顶切换到了非开通分类，它仍占用原名额，但不会出现在下方“生效服务”列表中。</p>
              </div>
              <div class="board-actions">
                <div class="board-filter-select">
                  <AppSelect
                    v-model="quotaBoardCategoryId"
                    full-width
                    :options="quotaBoardCategoryOptions"
                    :disabled="quotaBoardLoading || (!quotaBoardLoaded && !quotaBoardCategories.length)"
                    placeholder="选择要查看的分类"
                  />
                </div>
                <button class="ghost-btn" :disabled="quotaBoardLoading" @click="loadQuotaBoard">
                  {{ quotaBoardLoading ? '刷新中...' : '刷新看板' }}
                </button>
              </div>
            </div>

            <div v-if="showQuotaBoardLoading" class="board-loading">
              <div class="board-summary-grid">
                <article v-for="index in 4" :key="`board-summary-loading-${index}`" class="board-summary-card board-summary-card--loading">
                  <div class="loading-shimmer board-skeleton board-skeleton-kicker"></div>
                  <div class="loading-shimmer board-skeleton board-skeleton-value"></div>
                  <div class="loading-shimmer board-skeleton board-skeleton-copy"></div>
                  <div class="board-summary-meta">
                    <span class="loading-shimmer board-skeleton board-skeleton-meta"></span>
                    <span class="loading-shimmer board-skeleton board-skeleton-meta board-skeleton-meta--wide"></span>
                  </div>
                </article>
              </div>

              <div class="category-quota-grid">
                <article v-for="index in 6" :key="`category-loading-${index}`" class="category-quota-card category-quota-card--loading">
                  <div class="category-quota-head">
                    <div class="loading-shimmer board-skeleton board-skeleton-title"></div>
                    <div class="loading-shimmer board-skeleton board-skeleton-pill"></div>
                  </div>
                  <div class="loading-shimmer board-skeleton board-skeleton-copy"></div>
                  <div class="loading-shimmer board-skeleton board-skeleton-copy board-skeleton-copy--short"></div>
                </article>
              </div>

              <div class="board-records">
                <article v-for="index in 3" :key="`record-loading-${index}`" class="active-service-card active-service-card--loading">
                  <div class="active-service-head">
                    <div class="active-service-main">
                      <div class="active-service-badges">
                        <span class="loading-shimmer board-skeleton board-skeleton-badge"></span>
                        <span class="loading-shimmer board-skeleton board-skeleton-badge board-skeleton-badge--wide"></span>
                      </div>
                      <div class="loading-shimmer board-skeleton board-skeleton-heading"></div>
                    </div>
                    <div class="active-service-remaining">
                      <span class="loading-shimmer board-skeleton board-skeleton-mini"></span>
                      <strong class="loading-shimmer board-skeleton board-skeleton-number"></strong>
                    </div>
                  </div>
                  <div class="active-service-grid">
                    <div v-for="cellIndex in 4" :key="cellIndex">
                      <span class="loading-shimmer board-skeleton board-skeleton-mini"></span>
                      <strong class="loading-shimmer board-skeleton board-skeleton-field"></strong>
                    </div>
                  </div>
                </article>
              </div>
            </div>

            <template v-else>
              <div class="board-summary-grid">
                <article
                  v-for="pool in quotaBoardGlobalPools"
                  :key="pool.key"
                  class="board-summary-card"
                  :class="pool.usesSharedGlobalPool ? 'board-summary-card--global' : 'board-summary-card--special'"
                >
                  <span class="board-summary-kicker">{{ pool.usesSharedGlobalPool ? '共享甄选池' : '独立甄选池' }}</span>
                  <strong class="board-summary-value">{{ pool.remaining }} / {{ pool.limit }}</strong>
                  <p class="board-summary-copy">{{ formatGlobalPoolSummary(pool) }}</p>
                  <div class="board-summary-meta">
                    <span>占用中 {{ pool.used }} 个</span>
                    <span v-if="pool.pendingUsed > 0">待支付占位 {{ pool.pendingUsed }} 个</span>
                    <span>{{ formatQuotaReleaseHint(pool.nextReleaseAt, pool.hasPermanentTop, pool.used, 'global', pool.name) }}</span>
                  </div>
                </article>

                <article class="board-summary-card board-summary-card--focus">
                  <span class="board-summary-kicker">{{ selectedQuotaCategory ? '当前分类优选池' : '优选池说明' }}</span>
                  <strong class="board-summary-value">
                    {{ selectedQuotaCategory ? `${selectedQuotaCategory.categoryRemaining} / ${selectedQuotaCategory.categoryLimit}` : `${quotaBoardCategories.length} 个` }}
                  </strong>
                  <p class="board-summary-copy">
                    {{ selectedQuotaCategory
                      ? `${selectedQuotaCategory.categoryName} 当前优选池剩余名额；本分类的士多甄选走「${selectedQuotaCategory.globalPoolName}」，当前可见 ${selectedQuotaCategory.visibleTotal} 个置顶项（含管理员无偿置顶）。`
                      : '请选择下方分类卡片或右上角筛选器，查看某个分类的优选池与甄选池占用情况。' }}
                  </p>
                  <div class="board-summary-meta">
                    <template v-if="selectedQuotaCategory">
                      <span>优选占用 {{ selectedQuotaCategory.categoryUsed }} 个</span>
                      <span v-if="selectedQuotaCategory.categoryPendingUsed > 0">优选待支付 {{ selectedQuotaCategory.categoryPendingUsed }} 个</span>
                      <span>甄选池 {{ selectedQuotaCategory.globalRemaining }} / {{ selectedQuotaCategory.globalLimit }}</span>
                      <span>{{ formatQuotaReleaseHint(selectedQuotaCategory.nextCategoryReleaseAt, selectedQuotaCategory.hasPermanentCategoryTop, selectedQuotaCategory.categoryUsed, 'category') }}</span>
                    </template>
                    <template v-else>
                      <span>分类总数 {{ quotaBoardCategories.length }} 个</span>
                      <span>共享甄选池 {{ sharedGlobalQuota.remaining }} / {{ sharedGlobalQuota.limit }}</span>
                      <span>更新时间 {{ quotaBoard.generatedAt || '-' }}</span>
                    </template>
                  </div>
                </article>
              </div>

              <div class="category-quota-grid">
                <button
                  type="button"
                  class="category-quota-card category-quota-card--all"
                  :class="{ active: quotaBoardCategoryId === 'all' }"
                  @click="quotaBoardCategoryId = 'all'"
                >
                  <div class="category-quota-head">
                    <span class="category-quota-title">
                      <span class="category-quota-icon">🗂️</span>
                      全部分类
                    </span>
                    <span class="category-quota-pill">{{ quotaBoard.activeRecords?.length || 0 }} 条</span>
                  </div>
                  <p class="category-quota-copy">查看全部分类当前已生效的置顶服务。共享甄选池与独立甄选池的真实剩余名额请以上方总览卡片为准；切到非开通分类而被暂停的付费服务不会显示在这里。</p>
                  <div class="category-quota-meta">
                    <span>分类总数 {{ quotaBoardCategories.length }} 个</span>
                    <span>共享甄选占用 {{ sharedGlobalQuota.used }} 个</span>
                  </div>
                </button>

                <button
                  v-for="category in quotaBoardCategories"
                  :key="category.categoryId"
                  type="button"
                  class="category-quota-card"
                  :class="{ active: String(quotaBoardCategoryId) === String(category.categoryId) }"
                  @click="quotaBoardCategoryId = String(category.categoryId)"
                >
                  <div class="category-quota-head">
                    <span class="category-quota-title">
                      <span class="category-quota-icon">{{ category.categoryIcon || '📦' }}</span>
                      {{ category.categoryName }}
                    </span>
                    <span class="category-quota-pill">优选 {{ category.categoryRemaining }} / {{ category.categoryLimit }}</span>
                  </div>
                  <div class="category-quota-stats">
                    <div class="category-quota-stat">
                      <span class="category-quota-stat-label">优选池</span>
                      <strong class="category-quota-stat-value">{{ category.categoryRemaining }} / {{ category.categoryLimit }}</strong>
                      <p class="category-quota-stat-copy">{{ category.categoryName }} 分类独立优选池</p>
                    </div>
                    <div class="category-quota-stat">
                      <span class="category-quota-stat-label">甄选池</span>
                      <strong class="category-quota-stat-value">{{ category.globalRemaining }} / {{ category.globalLimit }}</strong>
                      <p class="category-quota-stat-copy">{{ category.globalPoolName }}</p>
                    </div>
                  </div>
                  <p class="category-quota-copy">{{ formatCategoryQuotaCopy(category) }}</p>
                  <div class="category-quota-meta">
                    <span>优选占用 {{ category.categoryUsed }} 个</span>
                    <span v-if="category.categoryPendingUsed > 0">优选待支付 {{ category.categoryPendingUsed }} 个</span>
                    <span>甄选展示 {{ category.globalVisibleCount }} 个</span>
                    <span v-if="category.globalPendingUsed > 0">甄选待支付 {{ category.globalPendingUsed }} 个</span>
                    <span>当前可见 {{ category.visibleTotal }} 个置顶项</span>
                    <span>{{ formatQuotaReleaseHint(category.nextCategoryReleaseAt, category.hasPermanentCategoryTop, category.categoryUsed, 'category') }}</span>
                    <span>{{ formatQuotaReleaseHint(category.nextGlobalReleaseAt, category.hasPermanentGlobalTop, category.globalUsed, 'global', category.globalPoolName) }}</span>
                  </div>
                </button>
              </div>

              <div class="board-list-panel">
                <div class="board-list-head">
                  <div>
                    <h3 class="board-list-title">生效服务</h3>
                    <p class="panel-subtitle">
                      {{ selectedQuotaCategory
                        ? `当前展示 ${selectedQuotaCategory.categoryName} 分类下已生效的士多甄选、士多优选与管理员无偿置顶。待支付占位已计入上方名额，不在此列表中展示。`
                        : '当前展示全部分类下已生效的士多甄选、士多优选与管理员无偿置顶。待支付占位已计入上方名额，不在此列表中展示；切到非开通分类而暂停的付费服务也不会出现在这里。' }}
                    </p>
                  </div>
                  <span class="board-generated-at">更新时间：{{ quotaBoard.generatedAt || '-' }}</span>
                </div>

                <div v-if="filteredQuotaRecords.length > 0" class="board-records">
                  <article v-for="record in filteredQuotaRecords" :key="record.id" class="active-service-card">
                    <div class="active-service-head">
                      <div class="active-service-main">
                        <div class="active-service-badges">
                          <span :class="['active-service-type', `type-${record.packageType || 'category'}`]">
                            {{ record.packageType === 'global' ? '士多甄选' : '士多优选' }}
                          </span>
                          <span v-if="!record.isPaidService" class="active-service-source">
                            管理员非有偿
                          </span>
                          <span v-else-if="record.packageType === 'global' && !record.usesSharedGlobalPool" class="active-service-source active-service-source--exempt">
                            {{ record.globalPoolName }}
                          </span>
                          <span class="active-service-category">
                            {{ record.categoryIcon || '📦' }} {{ record.categoryName || '未分类' }}
                          </span>
                        </div>
                        <h3 class="active-service-title">{{ record.productName }}</h3>
                      </div>
                      <div class="active-service-remaining">
                        <span>剩余时长</span>
                        <strong>{{ record.remainingDurationText || '永久置顶' }}</strong>
                      </div>
                    </div>

                    <div class="active-service-grid">
                      <div>
                        <span>服务天数</span>
                        <strong>{{ record.durationDays ? `${record.durationDays} 天` : '永久置顶' }}</strong>
                      </div>
                      <div>
                        <span>生效时间</span>
                        <strong>{{ record.effectiveAt || '-' }}</strong>
                      </div>
                      <div>
                        <span>到期时间</span>
                        <strong>{{ record.expiredAt || '永久置顶' }}</strong>
                      </div>
                      <div>
                        <span>服务类型</span>
                        <strong>{{ record.packageName }}</strong>
                      </div>
                    </div>
                  </article>
                </div>

                <div v-else class="empty-state">
                  当前筛选下暂无生效中的置顶服务
                </div>
              </div>
            </template>
          </div>
        </div>

        <div v-else-if="activeTab === 'orders'" class="panel-body">
          <div class="orders-toolbar">
            <AppSelect v-model="orderFilterStatus" :options="orderStatusOptions" placeholder="全部状态" @change="loadOrders(1)" />
            <button class="ghost-btn" :disabled="ordersLoading" @click="loadOrders(1)">
              {{ ordersLoading ? '刷新中...' : '刷新订单' }}
            </button>
          </div>

          <div class="orders-list">
            <article v-for="order in orders" :key="order.id" class="order-card">
              <div class="order-head">
                <div>
                  <h3>{{ order.productName }}</h3>
                  <p>{{ order.orderNo }}</p>
                </div>
                <span class="order-status" :class="order.status">{{ getOrderStatusText(order.status) }}</span>
              </div>

              <div class="order-meta-grid">
                <div>
                  <span>套餐</span>
                  <strong>{{ order.packageName }}</strong>
                </div>
                <div>
                  <span>时长</span>
                  <strong>{{ order.durationDays ? `${order.durationDays} 天` : '永久置顶' }}</strong>
                </div>
                <div>
                  <span>金额</span>
                  <strong>{{ Number(order.amount || 0).toFixed(2) }} LDC</strong>
                </div>
                <div>
                  <span>创建时间</span>
                  <strong>{{ order.createdAt || '-' }}</strong>
                </div>
                <div>
                  <span>生效时间</span>
                  <strong>{{ order.effectiveAt || '待支付成功' }}</strong>
                </div>
                <div>
                  <span>到期时间</span>
                  <strong>{{ order.expiredAt || '永久置顶' }}</strong>
                </div>
                <div v-if="order.categoryBindingApplies">
                  <span>开通分类</span>
                  <strong>{{ order.boundCategoryName || '未分类' }}</strong>
                </div>
                <div v-if="order.categoryBindingApplies">
                  <span>当前分类</span>
                  <strong>{{ order.currentCategoryName || order.boundCategoryName || '未分类' }}</strong>
                </div>
                <div>
                  <span>展示状态</span>
                  <strong :class="{ 'order-meta-warning': order.isSuspendedForCategory }">{{ getTopEffectivenessText(order) }}</strong>
                </div>
              </div>
              <p v-if="getTopOrderBindingHint(order)" :class="['order-binding-hint', { 'order-binding-hint--warning': order.isSuspendedForCategory }]">
                {{ getTopOrderBindingHint(order) }}
              </p>

              <div class="order-actions">
                <button v-if="order.status === 'pending'" class="action-btn primary" @click="repayOrder(order)">
                  继续支付
                </button>
                <button v-if="order.status === 'pending'" class="action-btn" @click="refreshOrder(order)">
                  刷新状态
                </button>
              </div>
            </article>

            <div v-if="!ordersLoading && !orders.length" class="empty-state">
              暂无置顶服务订单
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LiquidTabs from '@/components/common/LiquidTabs.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import { api } from '@/utils/api'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const dialog = useDialog()

const tabs = [
  { value: 'service', label: '置顶服务', icon: '🏅' },
  { value: 'board', label: '名额看板', icon: '📡' },
  { value: 'orders', label: '我的订单', icon: '📋' }
]

function normalizeMerchantTab(value = '') {
  return tabs.some((tab) => tab.value === value) ? value : 'service'
}

const activeTab = ref(normalizeMerchantTab(route.query.tab))
const optionsLoading = ref(false)
const submitting = ref(false)
const packages = ref([])
const products = ref([])
const orders = ref([])
const ordersLoading = ref(false)
const quotaBoardLoading = ref(false)
const quotaBoardLoaded = ref(false)
const quotaBoard = ref({
  generatedAt: '',
  globalQuota: null,
  globalPools: [],
  categories: [],
  activeRecords: []
})
const selectedProductId = ref('')
const selectedPackageType = ref('')
const selectedDurationDays = ref(0)
const orderFilterStatus = ref('')
const quotaBoardCategoryId = ref('all')

const orderStatusOptions = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待支付' },
  { value: 'active', label: '生效中' },
  { value: 'expired', label: '已过期' },
  { value: 'cancelled', label: '已取消' }
]

function unwrap(result) {
  return result?.success ? result.data : null
}

const selectedProduct = computed(() => products.value.find(item => String(item.id) === String(selectedProductId.value)) || null)

function formatQuotaValue(remaining = 0, limit = 0) {
  return `${Number(remaining || 0)} / ${Number(limit || 0)}`
}

function getGlobalPoolLabel(poolName = '') {
  return poolName || '甄选池'
}

function normalizeGlobalPool(pool = {}) {
  return {
    ...pool,
    key: pool?.key || 'shared_all',
    name: pool?.name || pool?.globalPoolName || '甄选池',
    categoryName: pool?.categoryName || '',
    limit: Number(pool?.limit ?? pool?.globalLimit ?? 0),
    used: Number(pool?.used ?? pool?.globalUsed ?? 0),
    pendingUsed: Number(pool?.pendingUsed ?? 0),
    remaining: Number(pool?.remaining ?? pool?.globalRemaining ?? 0),
    nextReleaseAt: pool?.nextReleaseAt || pool?.nextGlobalReleaseAt || '',
    hasPermanentTop: Boolean(pool?.hasPermanentTop ?? pool?.hasPermanentGlobalTop),
    usesSharedGlobalPool: pool?.usesSharedGlobalPool !== false
  }
}

function getProductOptionDescription(item = {}) {
  if (item.currentTopOrder) {
    if (item.currentTopOrder.categoryBindingApplies && !item.currentTopOrder.isCategoryMatched) {
      return `当前存在${item.currentTopOrder.packageName} 订单，当前分类与开通分类不一致`
    }
    return `当前存在${item.currentTopOrder.isPaidService ? '' : '管理员非有偿'} ${item.currentTopOrder.packageName} 订单`
  }
  return `${item.categoryName || '未分类'} · 优选 ${formatQuotaValue(item.quota?.categoryRemaining, item.quota?.categoryLimit)} · ${getGlobalPoolLabel(item.quota?.globalPoolName)} ${formatQuotaValue(item.quota?.globalRemaining, item.quota?.globalLimit)}`
}

const productOptions = computed(() => products.value.map((item) => ({
  value: String(item.id),
  label: item.name,
  description: getProductOptionDescription(item),
  icon: item.categoryIcon || '📦',
  disabled: false
})))
const showPackageLoading = computed(() => optionsLoading.value && packages.value.length === 0)
const showQuotaBoardLoading = computed(() => quotaBoardLoading.value && !quotaBoardLoaded.value)
const quotaBoardCategories = computed(() => Array.isArray(quotaBoard.value.categories) ? quotaBoard.value.categories : [])
const quotaBoardGlobalPools = computed(() => {
  if (Array.isArray(quotaBoard.value.globalPools) && quotaBoard.value.globalPools.length > 0) {
    return quotaBoard.value.globalPools.map((item) => normalizeGlobalPool(item))
  }
  return quotaBoard.value.globalQuota ? [normalizeGlobalPool(quotaBoard.value.globalQuota)] : []
})
const sharedGlobalQuota = computed(() => (
  quotaBoardGlobalPools.value.find((item) => item.usesSharedGlobalPool)
  || normalizeGlobalPool(quotaBoard.value.globalQuota || {
    key: 'shared_all',
    name: '全部分类共享甄选池',
    limit: 4,
    used: 0,
    pendingUsed: 0,
    remaining: 4,
    nextReleaseAt: '',
    hasPermanentTop: false
  })
))
const quotaBoardCategoryOptions = computed(() => [
  {
    value: 'all',
    label: '全部分类',
    description: `查看全部分类的 ${Array.isArray(quotaBoard.value.activeRecords) ? quotaBoard.value.activeRecords.length : 0} 条生效服务`,
    icon: '🗂️'
  },
  ...quotaBoardCategories.value.map((item) => ({
    value: String(item.categoryId),
    label: item.categoryName || '未分类',
    description: `优选 ${formatQuotaValue(item.categoryRemaining, item.categoryLimit)} · ${getGlobalPoolLabel(item.globalPoolName)} ${formatQuotaValue(item.globalRemaining, item.globalLimit)}`,
    icon: item.categoryIcon || '📦'
  }))
])
const selectedQuotaCategory = computed(() => (
  quotaBoardCategories.value.find((item) => String(item.categoryId) === String(quotaBoardCategoryId.value)) || null
))
const filteredQuotaRecords = computed(() => {
  const records = Array.isArray(quotaBoard.value.activeRecords) ? quotaBoard.value.activeRecords : []
  if (String(quotaBoardCategoryId.value) === 'all') return records
  return records.filter((item) => String(item.categoryId) === String(quotaBoardCategoryId.value))
})

const selectedConfig = computed(() => {
  const group = packages.value.find(item => item.type === selectedPackageType.value)
  const option = group?.options?.find(item => Number(item.durationDays) === Number(selectedDurationDays.value))
  if (!group || !option) return null
  return {
    groupName: group.name,
    packageType: group.type,
    durationDays: option.durationDays,
    price: option.price
  }
})

const canSubmit = computed(() => {
  if (!selectedProduct.value || !selectedConfig.value) return false
  if (selectedProduct.value.currentTopOrder) return false
  const remaining = selectedConfig.value.packageType === 'global'
    ? selectedProduct.value.quota?.globalRemaining
    : selectedProduct.value.quota?.categoryRemaining
  return Number(remaining || 0) > 0
})

watch(
  () => route.query.tab,
  (value) => {
    activeTab.value = normalizeMerchantTab(value)
  }
)

watch(activeTab, async (value) => {
  router.replace({
    query: {
      ...route.query,
      tab: normalizeMerchantTab(value)
    }
  })
  if (value === 'orders') {
    await loadOrders(1)
  }
  if (value === 'board') {
    await loadQuotaBoard()
  }
})

function handleProductChange() {
  selectedPackageType.value = ''
  selectedDurationDays.value = 0
}

function getPackageDescription(type) {
  const quota = selectedProduct.value?.quota || null
  if (type !== 'global') {
    return '【士多优选】仅在下单时所属分类顶部展示，占用当前分类独立优选池，不会占用任何甄选池名额；切换到其他分类会暂停展示，切回原分类后恢复。'
  }
  if (!quota) {
    return '【士多甄选】按甄选池管理：进入“全部”的分类共享 4 个名额，入站与卡券分别拥有独立的 6 个甄选名额；服务绑定下单时的所属分类，切换分类会暂停展示。'
  }
  if (quota.usesSharedGlobalPool) {
    return `【士多甄选】会同步展示在所属分类和“全部”分类，占用「${getGlobalPoolLabel(quota.globalPoolName)}」名额，但不占用当前分类优选池；服务绑定当前分类，切换到其他分类会暂停展示。`
  }
  return `【士多甄选】仅在 ${selectedProduct.value?.categoryName || '当前分类'} 的甄选位展示，占用「${getGlobalPoolLabel(quota.globalPoolName)}」名额，不占用“全部分类共享甄选池”；切换到其他分类不会继承全站展示资格，切回后恢复。`
}

function formatRemaining(type) {
  if (!selectedProduct.value) return '先选物品'
  const remaining = type === 'global'
    ? selectedProduct.value.quota?.globalRemaining
    : selectedProduct.value.quota?.categoryRemaining
  const limit = type === 'global'
    ? selectedProduct.value.quota?.globalLimit
    : selectedProduct.value.quota?.categoryLimit
  return `${type === 'global' ? '甄选余量' : '优选余量'} ${formatQuotaValue(remaining, limit)}`
}

function getPackageQuotaLines(type) {
  if (!selectedProduct.value) return ['请选择物品后查看对应名额池']

  if (type === 'global') {
    const lines = [
      `当前池：${getGlobalPoolLabel(selectedProduct.value.quota?.globalPoolName)}`,
      `剩余：${formatQuotaValue(selectedProduct.value.quota?.globalRemaining, selectedProduct.value.quota?.globalLimit)}`,
      `开通后绑定：${selectedProduct.value.categoryName || '当前分类'}`
    ]
    if (Number(selectedProduct.value.quota?.globalPendingUsed || 0) > 0) {
      lines.push(`待支付占位：${Number(selectedProduct.value.quota?.globalPendingUsed || 0)} 个`)
    }
    if (!selectedProduct.value.quota?.usesSharedGlobalPool) {
      lines.push('该池不占用“全部分类共享甄选池”')
    }
    lines.push('切换到其他分类会暂停展示，切回本分类后恢复')
    return lines
  }

  const lines = [
    `当前池：${selectedProduct.value.categoryName || '当前分类'} 优选池`,
    `剩余：${formatQuotaValue(selectedProduct.value.quota?.categoryRemaining, selectedProduct.value.quota?.categoryLimit)}`,
    `开通后绑定：${selectedProduct.value.categoryName || '当前分类'}`
  ]
  if (Number(selectedProduct.value.quota?.categoryPendingUsed || 0) > 0) {
    lines.push(`待支付占位：${Number(selectedProduct.value.quota?.categoryPendingUsed || 0)} 个`)
  }
  lines.push('切换到其他分类会暂停展示，切回本分类后恢复')
  return lines
}

function isPackageDisabled(type) {
  if (!selectedProduct.value) return true
  const remaining = type === 'global'
    ? selectedProduct.value.quota?.globalRemaining
    : selectedProduct.value.quota?.categoryRemaining
  return Number(remaining || 0) <= 0
}

function selectPackage(type, durationDays) {
  if (isPackageDisabled(type)) return
  selectedPackageType.value = type
  selectedDurationDays.value = Number(durationDays || 0)
}

function getOrderStatusText(status = '') {
  return {
    pending: '待支付',
    active: '生效中',
    expired: '已过期',
    cancelled: '已取消'
  }[status] || status
}

function isCurrentTopOrderSuspended(order = null) {
  return Boolean(order?.isSuspendedForCategory)
}

function getTopEffectivenessText(order = null) {
  if (!order) return '-'
  if (!order.categoryBindingApplies) {
    return order.status === 'active' ? '正常生效' : getOrderStatusText(order.status)
  }
  if (order.isSuspendedForCategory) {
    return '当前分类不匹配，已暂停展示'
  }
  if (order.status === 'active') {
    return '当前分类匹配，正常生效'
  }
  if (order.status === 'pending') {
    return order.isCategoryMatched ? '待支付成功后生效' : '待支付，且当前分类不匹配'
  }
  return getOrderStatusText(order.status)
}

function getTopOrderBindingHint(order = null) {
  if (!order) return ''
  if (!order.isPaidService) {
    return '说明：这是管理员手动设置的非有偿置顶，不占用付费名额，也不受分类绑定规则影响。'
  }
  if (order.categoryBindingMessage) {
    return order.categoryBindingMessage
  }
  if (order.packageType === 'global' && !order.boundUsesSharedGlobalPool) {
    return `该订单占用「${getGlobalPoolLabel(order.boundGlobalPoolName)}」，不会占用“全部分类共享甄选池”；若切换到其他分类，服务会暂停，切回开通分类后恢复。`
  }
  return `该付费${order.packageName || '置顶服务'}绑定在「${order.boundCategoryName || '当前分类'}」分类，切换到其他分类会暂停展示，切回后会在剩余有效期内恢复。`
}

function formatQuotaReleaseHint(nextReleaseAt = '', hasPermanent = false, used = 0, scope = 'category', poolName = '') {
  if (used <= 0) {
    return scope === 'global'
      ? `${poolName || '甄选池'} 当前名额充足`
      : '当前分类优选池名额充足'
  }
  if (nextReleaseAt) {
    return `最早释放：${nextReleaseAt}`
  }
  if (hasPermanent) {
    return '含永久生效服务'
  }
  return '当前暂无预计释放时间'
}

function formatCategoryQuotaCopy(category = {}) {
  const globalPoolText = `${getGlobalPoolLabel(category.globalPoolName)} ${formatQuotaValue(category.globalRemaining, category.globalLimit)}`
  if (category.usesSharedGlobalPool) {
    return `优选池剩余 ${formatQuotaValue(category.categoryRemaining, category.categoryLimit)}；甄选走共享池，当前池余量 ${globalPoolText}。`
  }
  return `优选池剩余 ${formatQuotaValue(category.categoryRemaining, category.categoryLimit)}；甄选走独立池，当前池余量 ${globalPoolText}，不占用“全部”共享池。`
}

function formatGlobalPoolSummary(pool = {}) {
  if (pool.usesSharedGlobalPool) {
    return `所有会进入“全部”分类的商品共用这 ${Number(pool.limit || 0)} 个士多甄选名额。`
  }
  return `${pool.categoryName || '当前分类'} 专属士多甄选池，不占用“全部分类共享甄选池”。`
}

async function loadOptions() {
  optionsLoading.value = true
  try {
    const result = unwrap(await api.get('/api/shop/top-service/options'))
    packages.value = Array.isArray(result?.packages) ? result.packages : []
    products.value = Array.isArray(result?.products) ? result.products : []
    if (selectedProductId.value && !products.value.some(item => String(item.id) === String(selectedProductId.value))) {
      selectedProductId.value = ''
      selectedPackageType.value = ''
      selectedDurationDays.value = 0
    }
  } catch (error) {
    console.error('Load merchant services options failed:', error)
    toast.error('加载置顶服务信息失败')
  } finally {
    optionsLoading.value = false
  }
}

async function loadOrders(page = 1) {
  ordersLoading.value = true
  try {
    const result = unwrap(await api.get(`/api/shop/top-service/orders?status=${encodeURIComponent(orderFilterStatus.value)}&page=${page}&pageSize=20`))
    orders.value = Array.isArray(result?.orders) ? result.orders : []
  } catch (error) {
    console.error('Load merchant service orders failed:', error)
    toast.error('加载置顶订单失败')
  } finally {
    ordersLoading.value = false
  }
}

async function loadQuotaBoard() {
  quotaBoardLoading.value = true
  try {
    const result = unwrap(await api.get('/api/shop/top-service/board'))
    quotaBoard.value = {
      generatedAt: result?.generatedAt || '',
      globalQuota: result?.globalQuota || null,
      globalPools: Array.isArray(result?.globalPools) ? result.globalPools : [],
      categories: Array.isArray(result?.categories) ? result.categories : [],
      activeRecords: Array.isArray(result?.activeRecords) ? result.activeRecords : []
    }
    quotaBoardLoaded.value = true
    if (
      String(quotaBoardCategoryId.value) !== 'all'
      && !quotaBoard.value.categories.some((item) => String(item.categoryId) === String(quotaBoardCategoryId.value))
    ) {
      quotaBoardCategoryId.value = 'all'
    }
  } catch (error) {
    console.error('Load top service quota board failed:', error)
    toast.error('加载名额看板失败')
  } finally {
    quotaBoardLoading.value = false
  }
}

async function submitOrder() {
  if (!canSubmit.value || !selectedProduct.value || !selectedConfig.value) return

  const confirmed = await dialog.confirm(
    [
      '<div style="line-height:1.8;text-align:left">',
      `<div><strong>套餐：</strong>${selectedConfig.value.groupName}</div>`,
      `<div><strong>天数：</strong>${selectedConfig.value.durationDays} 天</div>`,
      `<div><strong>物品：</strong>${selectedProduct.value.name}</div>`,
      `<div><strong>绑定分类：</strong>${selectedProduct.value.categoryName || '当前分类'}</div>`,
      '<div><strong>生效时间：</strong>订单支付成功时间</div>',
      `<div><strong>金额：</strong>${Number(selectedConfig.value.price || 0).toFixed(2)} LDC</div>`,
      '<div style="margin-top:8px;color:#9b6c13">付费置顶会绑定当前分类；若后续切换到其他分类，服务会暂停展示，切回原分类后恢复，过期时间不变。</div>',
      '</div>'
    ].join(''),
    {
      title: '确认服务信息',
      confirmText: '立即支付',
      cancelText: '返回修改'
    }
  )
  if (!confirmed) return

  submitting.value = true
  try {
    const result = unwrap(await api.post('/api/shop/top-service/orders', {
      productId: Number(selectedProduct.value.id),
      packageType: selectedConfig.value.packageType,
      durationDays: Number(selectedConfig.value.durationDays)
    }))
    if (!result?.paymentUrl) {
      toast.error('支付链接生成失败')
      return
    }
    await loadOptions()
    await loadOrders(1)
    window.location.href = result.paymentUrl
  } catch (error) {
    console.error('Create top service order failed:', error)
    toast.error(error?.message || '创建置顶订单失败')
  } finally {
    submitting.value = false
  }
}

async function repayOrder(order) {
  try {
    const result = unwrap(await api.get(`/api/shop/top-service/orders/${encodeURIComponent(order.orderNo)}/payment-url`))
    if (!result?.paymentUrl) {
      toast.error('支付链接不存在')
      return
    }
    window.location.href = result.paymentUrl
  } catch (error) {
    console.error('Repay top order failed:', error)
    toast.error(error?.message || '获取支付链接失败')
  }
}

async function refreshOrder(order) {
  try {
    const result = unwrap(await api.post(`/api/shop/top-service/orders/${encodeURIComponent(order.orderNo)}/refresh`))
    toast.success(result?.message || '订单状态已刷新')
    await loadOptions()
    await loadOrders(1)
  } catch (error) {
    console.error('Refresh top order failed:', error)
    toast.error(error?.message || '刷新订单状态失败')
  }
}

onMounted(async () => {
  const tasks = [loadOptions()]
  if (activeTab.value === 'orders') {
    tasks.push(loadOrders(1))
  }
  if (activeTab.value === 'board') {
    tasks.push(loadQuotaBoard())
  }
  await Promise.all(tasks)
})
</script>

<style scoped>
.merchant-services-page {
  min-height: 100vh;
  padding: 24px 0 72px;
  color-scheme: light;
  background: linear-gradient(180deg, #f8f2e7 0%, #f1e9dd 100%);
  --services-panel-border: var(--glass-border-light);
  --services-panel-bg:
    radial-gradient(circle at top left, rgba(255, 220, 145, 0.35), transparent 42%),
    linear-gradient(155deg, rgba(255, 255, 255, 0.92), rgba(251, 244, 231, 0.96));
  --services-panel-shadow: 0 24px 60px var(--glass-shadow);
  --services-card-border: var(--glass-border-light);
  --services-card-bg: rgba(255, 255, 255, 0.84);
  --services-card-bg-strong: rgba(255, 255, 255, 0.92);
  --services-card-shadow: 0 14px 36px var(--glass-shadow-light);
  --services-title: #30210d;
  --services-title-strong: #34240f;
  --services-copy-strong: #5d4c2d;
  --services-copy: #6d5731;
  --services-accent: #9b6c13;
  --services-accent-strong: #c78d1e;
  --services-accent-deep: #8a5a15;
  --services-success-bg: rgba(49, 158, 97, 0.12);
  --services-success-text: #1f7b4b;
  --services-muted-chip-bg: rgba(113, 113, 122, 0.12);
  --services-muted-chip-text: #5f6470;
  --services-category-chip-bg: rgba(98, 113, 81, 0.1);
  --services-category-chip-text: #5c6650;
  --services-category-type-bg: rgba(89, 119, 64, 0.12);
  --services-category-type-text: #52643a;
  --services-accent-soft: rgba(203, 153, 33, 0.12);
  --services-accent-soft-strong: rgba(191, 139, 31, 0.14);
  --services-accent-border: rgba(191, 139, 31, 0.24);
  --services-accent-border-soft: rgba(191, 139, 31, 0.12);
  --services-accent-shadow: rgba(193, 138, 25, 0.16);
  --services-badge-bg:
    radial-gradient(circle at top, rgba(255, 248, 210, 0.28), transparent 45%),
    linear-gradient(145deg, #b88624, #6f4a14);
  --services-badge-color: #fff7e3;
  --services-btn-bg: linear-gradient(135deg, #c78d1e, #8a5a15);
  --services-btn-shadow: 0 18px 34px rgba(151, 98, 18, 0.24);
  --services-hover-border: rgba(193, 138, 25, 0.4);
  --services-hover-shadow: 0 18px 34px rgba(193, 138, 25, 0.16);
  --services-muted-bg: rgba(255, 250, 239, 0.72);
  --services-muted-border: rgba(191, 139, 31, 0.28);
  --services-highlight-bg:
    radial-gradient(circle at top right, rgba(255, 223, 150, 0.4), transparent 36%),
    linear-gradient(160deg, rgba(255, 251, 242, 0.98), rgba(248, 239, 216, 0.94));
  --services-highlight-shadow:
    0 18px 42px rgba(145, 105, 24, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  --services-highlight-overlay: linear-gradient(135deg, rgba(255, 255, 255, 0.26), rgba(255, 248, 233, 0.08) 58%, transparent 76%);
  --app-select-trigger-border: var(--services-card-border);
  --app-select-trigger-bg: var(--services-card-bg-strong);
  --app-select-trigger-shadow: var(--services-card-shadow);
  --app-select-trigger-hover-border: var(--services-hover-border);
  --app-select-trigger-hover-shadow: 0 14px 30px var(--services-accent-shadow);
  --app-select-panel-border: var(--services-card-border);
  --app-select-panel-bg: rgba(255, 250, 242, 0.98);
  --app-select-panel-shadow: 0 20px 40px rgba(145, 105, 24, 0.12);
  --app-select-option-divider: rgba(191, 139, 31, 0.12);
  --app-select-option-hover-bg: var(--services-accent-soft);
  --liquid-tabs-shell-bg: rgba(255, 251, 244, 0.92);
  --liquid-tabs-shell-border: var(--services-card-border);
  --liquid-tabs-shell-shadow:
    0 14px 30px rgba(145, 105, 24, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.62);
  --liquid-indicator-bg: rgba(255, 255, 255, 0.96);
  --liquid-indicator-border: rgba(191, 139, 31, 0.16);
  --liquid-indicator-shadow:
    0 10px 20px rgba(145, 105, 24, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  --liquid-shine-bg: linear-gradient(180deg, rgba(255, 255, 255, 0.64) 0%, rgba(255, 255, 255, 0.18) 50%, transparent 100%);
  --liquid-tab-hover-overlay: linear-gradient(135deg, rgba(244, 201, 109, 0.16) 0%, transparent 58%);
}

:global(html.dark .merchant-services-page) {
  color-scheme: dark;
  background: linear-gradient(180deg, #15120e 0%, #0e0b08 100%);
  --services-panel-border: rgba(255, 236, 196, 0.08);
  --services-panel-bg:
    radial-gradient(circle at top left, rgba(218, 164, 61, 0.18), transparent 42%),
    linear-gradient(155deg, rgba(31, 26, 20, 0.96), rgba(18, 15, 11, 0.98));
  --services-panel-shadow: 0 24px 60px rgba(0, 0, 0, 0.38);
  --services-card-border: rgba(255, 223, 164, 0.09);
  --services-card-bg: rgba(42, 35, 27, 0.82);
  --services-card-bg-strong: rgba(48, 40, 31, 0.92);
  --services-card-shadow: 0 14px 36px rgba(0, 0, 0, 0.26);
  --services-title: #f3e6cf;
  --services-title-strong: #f7ead3;
  --services-copy-strong: #d7c1a0;
  --services-copy: #c5b18f;
  --services-accent: #f2c15f;
  --services-accent-strong: #f4c96d;
  --services-accent-deep: #d6a446;
  --services-success-bg: rgba(74, 222, 128, 0.16);
  --services-success-text: #86efac;
  --services-muted-chip-bg: rgba(148, 163, 184, 0.14);
  --services-muted-chip-text: #cbd5e1;
  --services-category-chip-bg: rgba(244, 201, 109, 0.1);
  --services-category-chip-text: #e8d7b4;
  --services-category-type-bg: rgba(124, 175, 118, 0.16);
  --services-category-type-text: #b9e2b4;
  --services-accent-soft: rgba(244, 201, 109, 0.18);
  --services-accent-soft-strong: rgba(244, 201, 109, 0.2);
  --services-accent-border: rgba(244, 201, 109, 0.18);
  --services-accent-border-soft: rgba(244, 201, 109, 0.12);
  --services-accent-shadow: rgba(216, 163, 60, 0.18);
  --services-badge-bg:
    radial-gradient(circle at top, rgba(255, 228, 157, 0.18), transparent 45%),
    linear-gradient(145deg, #8f661a, #51340f);
  --services-badge-color: #fff0cf;
  --services-btn-bg: linear-gradient(135deg, #d8a33c, #8f661a);
  --services-btn-shadow: 0 18px 34px rgba(216, 163, 60, 0.2);
  --services-hover-border: rgba(244, 201, 109, 0.34);
  --services-hover-shadow: 0 18px 34px rgba(216, 163, 60, 0.16);
  --services-muted-bg: rgba(54, 43, 32, 0.76);
  --services-muted-border: rgba(244, 201, 109, 0.18);
  --services-highlight-bg:
    radial-gradient(circle at top right, rgba(244, 201, 109, 0.16), transparent 36%),
    linear-gradient(160deg, rgba(55, 44, 33, 0.96), rgba(37, 29, 22, 0.94));
  --services-highlight-shadow:
    0 18px 42px rgba(0, 0, 0, 0.26),
    inset 0 1px 0 rgba(255, 240, 214, 0.06);
  --services-highlight-overlay: linear-gradient(135deg, rgba(255, 240, 214, 0.08), rgba(255, 240, 214, 0) 58%, transparent 76%);
  --app-select-trigger-border: var(--services-card-border);
  --app-select-trigger-bg: rgba(46, 38, 30, 0.96);
  --app-select-trigger-shadow: 0 16px 30px rgba(0, 0, 0, 0.22);
  --app-select-trigger-hover-border: var(--services-hover-border);
  --app-select-trigger-hover-shadow: 0 14px 30px rgba(0, 0, 0, 0.24);
  --app-select-panel-border: var(--services-card-border);
  --app-select-panel-bg: rgba(36, 29, 23, 0.98);
  --app-select-panel-shadow: 0 24px 44px rgba(0, 0, 0, 0.32);
  --app-select-option-divider: rgba(244, 201, 109, 0.08);
  --app-select-option-hover-bg: rgba(244, 201, 109, 0.16);
  --liquid-tabs-shell-bg: rgba(44, 36, 29, 0.92);
  --liquid-tabs-shell-border: var(--services-card-border);
  --liquid-tabs-shell-shadow:
    0 16px 34px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 240, 214, 0.05);
  --liquid-indicator-bg: rgba(55, 45, 36, 0.96);
  --liquid-indicator-border: rgba(244, 201, 109, 0.12);
  --liquid-indicator-shadow:
    0 12px 24px rgba(0, 0, 0, 0.24),
    inset 0 1px 0 rgba(255, 240, 214, 0.08);
  --liquid-shine-bg: linear-gradient(180deg, rgba(255, 240, 214, 0.16) 0%, rgba(255, 255, 255, 0.04) 50%, transparent 100%);
  --liquid-tab-hover-overlay: linear-gradient(135deg, rgba(244, 201, 109, 0.1) 0%, transparent 60%);
}

.page-shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  display: grid;
  gap: 20px;
}

.hero-card,
.content-card {
  border: 1px solid var(--services-panel-border);
  border-radius: 30px;
  background: var(--services-panel-bg);
  box-shadow: var(--services-panel-shadow);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.hero-card {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 18px;
  padding: 28px;
}

.hero-eyebrow {
  margin: 0 0 10px;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--services-accent);
}

.hero-title {
  margin: 0;
  font-size: clamp(32px, 5vw, 48px);
  line-height: 1.02;
  color: var(--services-title-strong);
}

.hero-desc {
  margin: 14px 0 0;
  max-width: 640px;
  font-size: 15px;
  line-height: 1.8;
  color: var(--services-copy-strong);
}

.hero-badge {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 22px;
  border-radius: 24px;
  color: var(--services-badge-color);
  background: var(--services-badge-bg);
}

.hero-badge-label {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.82;
}

.hero-badge strong {
  font-size: 28px;
}

.content-card {
  padding: 22px;
}

.panel-body {
  margin-top: 18px;
}

.service-grid {
  display: grid;
  grid-template-columns: 1.6fr 0.95fr;
  gap: 18px;
  align-items: start;
}

.config-panel,
.summary-panel {
  display: grid;
  gap: 18px;
}

.panel-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.panel-title {
  margin: 0;
  font-size: 22px;
  color: var(--services-title);
}

.panel-subtitle,
.field-hint {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.field-block {
  display: grid;
  gap: 8px;
}

.field-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.package-grid {
  display: grid;
  gap: 14px;
}

.package-card,
.summary-card,
.notice-card,
.current-top-card,
.order-card,
.board-summary-card,
.category-quota-card,
.active-service-card {
  border: 1px solid var(--services-card-border);
  border-radius: 22px;
  background: var(--services-card-bg);
  box-shadow: var(--services-card-shadow);
}

.package-card {
  padding: 18px;
}

.package-card.disabled {
  opacity: 0.72;
}

.package-card--loading {
  pointer-events: none;
}

.package-loading-copy {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 10px;
}

.package-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.package-title {
  margin: 0;
  font-size: 18px;
  color: var(--services-title);
}

.package-desc {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.loading-shimmer {
  background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--bg-tertiary) 50%, var(--skeleton-base) 75%);
  background-size: 200% 100%;
  animation: merchant-services-shimmer 1.5s infinite;
}

.package-skeleton {
  border-radius: 999px;
}

.package-skeleton-title {
  width: 140px;
  height: 18px;
  border-radius: 10px;
}

.package-skeleton-desc {
  width: min(100%, 260px);
  height: 12px;
  border-radius: 8px;
}

.package-skeleton-pill {
  flex-shrink: 0;
  width: 98px;
  height: 30px;
}

.quota-pill {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--services-accent-soft);
  color: var(--services-accent);
  font-size: 12px;
  font-weight: 700;
}

.package-quota-list {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.package-quota-line {
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--services-panel-bg);
  border: 1px solid var(--services-accent-border-soft);
  font-size: 12px;
  line-height: 1.6;
  color: var(--services-copy);
}

.duration-list {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.duration-btn {
  width: 100%;
  border: 1px solid var(--services-card-border);
  border-radius: 16px;
  background: var(--services-card-bg-strong);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  color: var(--text-primary);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.duration-btn--loading {
  cursor: default;
}

.package-skeleton-days {
  width: 54px;
  height: 14px;
}

.package-skeleton-price {
  width: 84px;
  height: 14px;
}

.duration-btn:hover:not(:disabled),
.duration-btn.active {
  transform: translateY(-1px);
  border-color: var(--services-hover-border);
  box-shadow: 0 14px 30px var(--services-accent-shadow);
}

.duration-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.package-empty-state {
  padding: 20px 18px;
  border: 1px dashed var(--services-muted-border);
  border-radius: 18px;
  background: var(--services-muted-bg);
  text-align: center;
}

.package-empty-state strong {
  display: block;
  font-size: 14px;
  color: var(--services-accent-deep);
}

.package-empty-state p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.duration-days {
  font-size: 15px;
  font-weight: 700;
}

.duration-price {
  font-size: 13px;
  color: var(--services-accent-deep);
}

.submit-btn,
.ghost-btn,
.action-btn {
  border-radius: 999px;
  font-weight: 700;
}

.submit-btn {
  border: none;
  padding: 16px 22px;
  color: #fff;
  background: var(--services-btn-bg);
  box-shadow: var(--services-btn-shadow);
}

.submit-btn:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.ghost-btn,
.action-btn {
  border: 1px solid var(--services-card-border);
  background: var(--services-card-bg-strong);
  color: var(--text-primary);
  padding: 11px 16px;
}

.action-btn.primary {
  border-color: transparent;
  background: var(--services-btn-bg);
  color: #fff;
}

.summary-card,
.notice-card,
.current-top-card {
  padding: 18px;
}

.summary-card--intro {
  position: relative;
  overflow: hidden;
  border-color: var(--services-accent-border);
  background: var(--services-highlight-bg);
  box-shadow: var(--services-highlight-shadow);
}

.summary-card--intro::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--services-highlight-overlay);
  pointer-events: none;
}

.summary-card--intro > * {
  position: relative;
  z-index: 1;
}

.summary-intro {
  display: grid;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--services-accent-border);
}

.summary-kicker {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--services-accent-soft);
  color: var(--services-accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.summary-intro strong {
  font-size: 18px;
  line-height: 1.5;
  color: var(--services-title-strong);
}

.summary-intro p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--services-copy);
}

.summary-points {
  display: grid;
  gap: 2px;
  margin-top: 14px;
}

.summary-point {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 12px;
  align-items: flex-start;
  padding: 12px 0;
}

.summary-point + .summary-point {
  border-top: 1px dashed var(--services-accent-border);
}

.summary-point-index {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: var(--services-btn-bg);
  color: #fff8e6;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
  box-shadow: 0 10px 18px var(--services-accent-shadow);
}

.summary-point-copy strong {
  display: block;
  font-size: 14px;
  line-height: 1.5;
  color: var(--services-title);
}

.summary-point-copy p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--services-copy);
}

.summary-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 0;
  border-bottom: 1px solid var(--glass-border-light);
}

.summary-line:last-child {
  border-bottom: none;
}

.summary-line span,
.notice-card li,
.current-top-card p {
  font-size: 13px;
  color: var(--text-secondary);
}

.summary-line strong,
.notice-card h3,
.current-top-card h3 {
  color: var(--text-primary);
}

.notice-card ul {
  margin: 12px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 10px;
}

.current-top-card p {
  margin: 10px 0 0;
}

.current-top-card--warning {
  border-color: rgba(207, 105, 123, 0.28);
  background: linear-gradient(180deg, rgba(255, 243, 244, 0.96) 0%, var(--services-card-bg) 100%);
}

.current-top-card-highlight {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--services-muted-bg);
  border: 1px solid var(--services-muted-border);
  color: var(--text-secondary);
  line-height: 1.7;
}

.current-top-card-highlight--warning {
  background: rgba(207, 105, 123, 0.1);
  border-color: rgba(207, 105, 123, 0.22);
  color: #b3495d;
}

.board-panel {
  display: grid;
  gap: 18px;
}

.board-toolbar,
.board-list-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.board-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.board-filter-select {
  min-width: 280px;
}

.board-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.board-summary-card,
.active-service-card {
  padding: 20px;
}

.board-summary-card {
  display: grid;
  gap: 10px;
}

.board-summary-card--global {
  border-color: var(--services-accent-border);
  background: var(--services-highlight-bg);
}

.board-summary-card--special {
  background: linear-gradient(180deg, rgba(249, 237, 214, 0.72) 0%, var(--services-card-bg) 100%);
  border-color: rgba(198, 146, 68, 0.22);
}

.board-summary-card--focus {
  background: var(--services-panel-bg);
}

.board-summary-kicker {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--services-accent);
}

.board-summary-value {
  font-size: clamp(28px, 4vw, 38px);
  line-height: 1;
  color: var(--services-title);
}

.board-summary-copy {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--services-copy);
}

.board-summary-meta,
.category-quota-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.board-summary-meta span,
.category-quota-meta span {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--services-accent-soft);
  font-size: 12px;
  color: var(--services-accent);
}

.category-quota-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.category-quota-card {
  width: 100%;
  padding: 18px;
  text-align: left;
  border-color: var(--services-accent-border-soft);
  background: var(--services-panel-bg);
  cursor: pointer;
  appearance: none;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.category-quota-card:hover,
.category-quota-card.active {
  transform: translateY(-1px);
  border-color: var(--services-hover-border);
  box-shadow: var(--services-hover-shadow);
}

.category-quota-card--all {
  background: var(--services-highlight-bg);
}

.category-quota-card--loading,
.active-service-card--loading,
.board-summary-card--loading {
  pointer-events: none;
}

.category-quota-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.category-quota-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--services-title);
}

.category-quota-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--services-accent-soft);
  flex-shrink: 0;
}

.category-quota-pill {
  flex-shrink: 0;
  padding: 7px 10px;
  border-radius: 999px;
  background: var(--services-accent-soft-strong);
  font-size: 12px;
  font-weight: 800;
  color: var(--services-accent);
}

.category-quota-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.category-quota-stat {
  min-width: 0;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid var(--services-accent-border-soft);
  background: var(--services-card-bg-strong);
  display: grid;
  gap: 6px;
}

.category-quota-stat-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--services-accent);
}

.category-quota-stat-value {
  font-size: 18px;
  line-height: 1.1;
  color: var(--services-title);
}

.category-quota-stat-copy {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.category-quota-copy {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.board-list-panel {
  display: grid;
  gap: 16px;
}

.board-list-title {
  margin: 0;
  font-size: 20px;
  color: var(--services-title);
}

.board-generated-at {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--services-accent-soft);
  font-size: 12px;
  color: var(--services-accent);
}

.board-records {
  display: grid;
  gap: 14px;
}

.active-service-card {
  display: grid;
  gap: 16px;
}

.active-service-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.active-service-main {
  min-width: 0;
}

.active-service-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.active-service-type,
.active-service-source,
.active-service-category {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.active-service-type.type-global {
  background: var(--services-accent-soft-strong);
  color: var(--services-accent-deep);
}

.active-service-type.type-category {
  background: var(--services-category-type-bg);
  color: var(--services-category-type-text);
}

.active-service-source {
  background: var(--services-muted-chip-bg);
  color: var(--services-muted-chip-text);
}

.active-service-category {
  background: var(--services-category-chip-bg);
  color: var(--services-category-chip-text);
}

.active-service-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.5;
  color: var(--services-title);
}

.active-service-remaining {
  min-width: 120px;
  display: grid;
  gap: 6px;
  text-align: right;
}

.active-service-remaining span,
.active-service-grid span {
  font-size: 12px;
  color: var(--text-secondary);
}

.active-service-remaining strong {
  font-size: 18px;
  color: var(--services-accent-deep);
}

.active-service-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.active-service-grid strong {
  display: block;
  margin-top: 6px;
  font-size: 14px;
  color: var(--text-primary);
}

.board-loading {
  display: grid;
  gap: 18px;
}

.board-skeleton {
  display: block;
  border-radius: 999px;
}

.board-skeleton-kicker {
  width: 84px;
  height: 12px;
}

.board-skeleton-value {
  width: 140px;
  height: 34px;
  border-radius: 12px;
}

.board-skeleton-copy {
  width: 100%;
  height: 12px;
  border-radius: 8px;
}

.board-skeleton-copy--short {
  width: 70%;
}

.board-skeleton-meta {
  width: 90px;
  height: 26px;
}

.board-skeleton-meta--wide {
  width: 140px;
}

.board-skeleton-title {
  width: 110px;
  height: 16px;
  border-radius: 10px;
}

.board-skeleton-pill {
  width: 58px;
  height: 28px;
}

.board-skeleton-badge {
  width: 76px;
  height: 26px;
}

.board-skeleton-badge--wide {
  width: 120px;
}

.board-skeleton-heading {
  width: 220px;
  height: 18px;
  border-radius: 10px;
}

.board-skeleton-mini {
  width: 72px;
  height: 12px;
  border-radius: 8px;
}

.board-skeleton-number {
  width: 84px;
  height: 18px;
  justify-self: end;
  border-radius: 10px;
}

.board-skeleton-field {
  width: 100%;
  height: 16px;
  margin-top: 8px;
  border-radius: 8px;
}

.orders-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.orders-list {
  margin-top: 18px;
  display: grid;
  gap: 14px;
}

.order-card {
  padding: 18px;
}

.order-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.order-head h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.order-head p {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.order-status {
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.order-status.pending {
  background: var(--services-accent-soft);
  color: var(--services-accent);
}

.order-status.active {
  background: var(--services-success-bg);
  color: var(--services-success-text);
}

.order-status.expired,
.order-status.cancelled {
  background: var(--services-muted-chip-bg);
  color: var(--services-muted-chip-text);
}

.order-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.order-meta-grid span {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
}

.order-meta-grid strong {
  display: block;
  margin-top: 6px;
  font-size: 14px;
  color: var(--text-primary);
}

.order-meta-warning {
  color: #b3495d !important;
}

.order-binding-hint {
  margin: 14px 0 0;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--services-muted-bg);
  border: 1px solid var(--services-muted-border);
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.order-binding-hint--warning {
  background: rgba(207, 105, 123, 0.1);
  border-color: rgba(207, 105, 123, 0.22);
  color: #b3495d;
}

.order-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.empty-state {
  padding: 48px 12px;
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);
}

.notice-card-highlight {
  color: #cf697b;
}

:global(html.dark .merchant-services-page .notice-card-highlight) {
  color: #ff8fa3;
}

:global(html.dark .merchant-services-page .current-top-card--warning) {
  border-color: rgba(255, 143, 163, 0.24);
  background: linear-gradient(180deg, rgba(74, 34, 40, 0.82) 0%, var(--services-card-bg) 100%);
}

:global(html.dark .merchant-services-page .current-top-card-highlight--warning),
:global(html.dark .merchant-services-page .order-binding-hint--warning),
:global(html.dark .merchant-services-page .order-meta-warning) {
  color: #ff9cae !important;
}

.active-service-source--exempt {
  background: var(--services-accent-soft-strong);
  color: var(--services-accent-deep);
}

@keyframes merchant-services-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@media (max-width: 960px) {
  .hero-card,
  .service-grid {
    grid-template-columns: 1fr;
  }

  .board-toolbar,
  .board-list-head {
    flex-direction: column;
  }

  .board-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .board-filter-select {
    min-width: 0;
    width: 100%;
  }

  .board-summary-grid,
  .active-service-grid {
    grid-template-columns: 1fr 1fr;
  }

  .orders-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .order-meta-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .merchant-services-page {
    padding-top: 12px;
    padding-bottom: 64px;
  }

  .page-shell {
    width: min(100% - 16px, 1120px);
    gap: 14px;
  }

  .hero-card,
  .content-card {
    border-radius: 22px;
    padding: 14px;
  }

  .hero-card {
    gap: 14px;
  }

  .hero-title {
    font-size: clamp(28px, 9vw, 34px);
  }

  .hero-desc {
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.65;
  }

  .hero-badge {
    gap: 8px;
    padding: 16px;
    border-radius: 18px;
  }

  .hero-badge strong {
    font-size: clamp(20px, 6.6vw, 24px);
  }

  .panel-body {
    margin-top: 14px;
  }

  .config-panel,
  .summary-panel,
  .board-panel,
  .board-loading,
  .board-list-panel {
    gap: 14px;
  }

  .panel-title-row,
  .board-toolbar,
  .board-list-head,
  .orders-toolbar {
    gap: 10px;
  }

  .panel-title-row {
    flex-direction: column;
  }

  .panel-title {
    font-size: 20px;
  }

  .panel-subtitle,
  .field-hint,
  .package-desc,
  .summary-intro p,
  .summary-point-copy p,
  .board-summary-copy,
  .category-quota-copy,
  .package-empty-state p,
  .current-top-card p,
  .notice-card li {
    font-size: 12px;
    line-height: 1.6;
  }

  .field-block {
    gap: 6px;
  }

  .field-label {
    font-size: 13px;
  }

  .package-grid {
    gap: 10px;
  }

  .package-card,
  .summary-card,
  .notice-card,
  .current-top-card,
  .order-card,
  .board-summary-card,
  .category-quota-card,
  .active-service-card {
    border-radius: 18px;
  }

  .package-card,
  .summary-card,
  .notice-card,
  .current-top-card,
  .order-card,
  .board-summary-card,
  .active-service-card {
    padding: 14px;
  }

  .category-quota-card {
    padding: 14px;
  }

  .package-head,
  .order-head,
  .category-quota-head,
  .active-service-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: flex-start;
  }

  .package-title,
  .active-service-title,
  .board-list-title {
    font-size: 16px;
  }

  .quota-pill,
  .order-status,
  .board-generated-at,
  .board-summary-meta span,
  .category-quota-meta span,
  .active-service-type,
  .active-service-source,
  .active-service-category {
    padding: 6px 9px;
    font-size: 11px;
  }

  .duration-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 12px;
  }

  .duration-btn {
    min-height: 72px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: 6px;
    padding: 12px;
  }

  .duration-days {
    font-size: 14px;
  }

  .duration-price {
    font-size: 12px;
  }

  .submit-btn {
    padding: 14px 18px;
  }

  .ghost-btn,
  .action-btn {
    padding: 10px 14px;
    font-size: 13px;
  }

  .summary-intro {
    gap: 6px;
    padding-bottom: 14px;
  }

  .summary-intro strong {
    font-size: 16px;
  }

  .summary-kicker {
    padding: 5px 10px;
    font-size: 10px;
  }

  .summary-points {
    margin-top: 10px;
  }

  .summary-point {
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 10px;
    padding: 10px 0;
  }

  .summary-point-index {
    width: 30px;
    height: 30px;
    border-radius: 10px;
  }

  .summary-point-copy strong {
    font-size: 13px;
  }

  .summary-line {
    display: grid;
    grid-template-columns: 70px minmax(0, 1fr);
    align-items: start;
    gap: 8px;
    padding: 8px 0;
  }

  .summary-line strong {
    text-align: right;
    font-size: 13px;
  }

  .notice-card ul {
    gap: 8px;
    padding-left: 16px;
  }

  .current-top-card p {
    margin-top: 8px;
  }

  .board-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .board-filter-select {
    min-width: 0;
    width: 100%;
  }

  .board-summary-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .board-summary-value {
    font-size: clamp(24px, 8vw, 30px);
  }

  .category-quota-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .category-quota-stats {
    grid-template-columns: 1fr;
  }

  .category-quota-title {
    gap: 6px;
    font-size: 14px;
  }

  .category-quota-icon {
    width: 24px;
    height: 24px;
    border-radius: 8px;
  }

  .board-records {
    gap: 10px;
  }

  .active-service-main {
    display: grid;
    gap: 8px;
  }

  .active-service-badges {
    gap: 6px;
    margin-bottom: 0;
  }

  .active-service-remaining {
    min-width: 0;
    gap: 4px;
    text-align: right;
  }

  .active-service-remaining strong {
    font-size: 16px;
  }

  .active-service-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .active-service-grid strong {
    margin-top: 4px;
    font-size: 13px;
  }

  .order-head h3 {
    font-size: 16px;
  }

  .order-head p {
    margin-top: 4px;
    font-size: 11px;
  }

  .order-meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
  }

  .order-meta-grid strong {
    margin-top: 4px;
    font-size: 13px;
  }

  .order-actions {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
}

@media (max-width: 420px) {
  .merchant-services-page {
    padding-bottom: 56px;
  }

  .page-shell {
    width: min(100% - 12px, 1120px);
  }

  .hero-card,
  .content-card {
    border-radius: 18px;
    padding: 12px;
  }

  .package-card,
  .summary-card,
  .notice-card,
  .current-top-card,
  .order-card,
  .board-summary-card,
  .category-quota-card,
  .active-service-card {
    border-radius: 16px;
  }

  .package-card,
  .summary-card,
  .notice-card,
  .current-top-card,
  .order-card,
  .board-summary-card,
  .category-quota-card,
  .active-service-card {
    padding: 12px;
  }

  .package-head,
  .order-head,
  .category-quota-head,
  .active-service-head,
  .summary-line {
    grid-template-columns: 1fr;
  }

  .summary-line strong,
  .active-service-remaining {
    text-align: left;
  }

  .duration-list,
  .category-quota-grid,
  .active-service-grid,
  .order-meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
