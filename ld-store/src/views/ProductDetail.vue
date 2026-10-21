<template>
  <div class="detail-page">
    <div class="page-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <Skeleton type="detail" />
      </div>
      
      <!-- 物品详情 -->
      <template v-else-if="product">
        <!-- 顶部导航：宽屏优先单行，窄屏为返回+按钮组、左对齐标签组；长标签允许继续换行 -->
        <div class="detail-nav">
          <button class="back-btn" @click="goBack">
            <ArrowLeft :size="16" aria-hidden="true" />
            <span>返回</span>
          </button>
          <div class="nav-tags">
            <span class="nav-category">
              <component :is="categoryIconComponent" :size="15" aria-hidden="true" />
              <span>{{ categoryName }}</span>
            </span>
            <span v-if="isCdk" class="nav-type cdk">
              <Ticket :size="14" aria-hidden="true" />
              <span>CDK自动发货</span>
            </span>
            <span v-else-if="isStore" class="nav-type store">
              <Store :size="14" aria-hidden="true" />
              <span>友情小店</span>
            </span>
          </div>
          <div class="nav-actions">
            <ProductInteractionPanel
              :favorited="isFavorited"
              :busy="favoriteSubmitting"
              :reporting="reportSubmitting"
              @favorite="toggleFavorite"
              @block="markNotInterested"
              @report="openReportModal"
            />
          </div>
        </div>
        
        <!-- 主内容区 -->
        <div :class="['detail-main', { 'detail-main--landscape': isLandscapeDetailLayout }]">
          <!-- 左侧：图片 -->
          <ProductMedia
            :product="product"
            :category-icon="categoryIconComponent"
            :cover-style="coverStyle"
            :has-discount="hasDiscount"
            :discount-percent="discountPercent"
            :landscape="isLandscapeDetailLayout"
            @open="openImagePreview"
            @load="handleCoverImageLoad"
            @error="handleImageError"
          />
          
          <!-- 右侧：信息 -->
          <div class="detail-info-panel">
            <!-- 物品名称 -->
            <h1 class="detail-name">{{ product.name }}</h1>
            
            <!-- 价格区域 -->
            <div v-if="!isStore" class="price-section">
              <div :class="['price-main', { discounted: hasDiscount }]">
                {{ finalPrice }} <span class="unit">LDC</span>
              </div>
              <div v-if="hasDiscount" class="price-original">{{ originalPrice }} LDC</div>
            </div>
            
            <!-- 测试模式提示 -->
            <div v-if="isTestMode" class="test-mode-banner detail-test-banner">
              <span class="test-badge">
                <FlaskConical :size="14" aria-hidden="true" />
                测试模式
              </span>
              <span class="test-desc">{{ isSeller ? '只有您可以购买此物品' : '该物品为测试模式，仅卖家可购买' }}</span>
            </div>
            
            <!-- 物品状态信息 -->
            <div class="status-row">
              <ProductStockIndicator v-if="isPlatformOrder" :product="product" />
              <div v-if="isPlatformOrder && soldCount > 0" class="status-item hot">
                <Flame class="status-icon" :size="16" aria-hidden="true" />
                <span class="status-text">已售 {{ soldCount }}</span>
              </div>
              <div class="status-item">
                <Eye class="status-icon" :size="16" aria-hidden="true" />
                <span class="status-text">{{ product.viewCount || 0 }} 浏览</span>
              </div>
              <div class="status-item">
                <CalendarClock class="status-icon" :size="16" aria-hidden="true" />
                <span class="status-text">{{ updateTime }}</span>
              </div>
            </div>

            <div class="detail-side-panel">
            <div v-if="isTestMode" class="test-mode-banner detail-test-banner-landscape">
                <span class="test-badge">
                  <FlaskConical :size="14" aria-hidden="true" />
                  测试模式
                </span>
                <span class="test-desc">{{ isSeller ? '只有您可以购买此物品' : '该物品为测试模式，仅卖家可购买' }}</span>
              </div>

            <div
              :class="['seller-card', { disabled: !product.sellerUsername }]"
              @click="goToSeller"
            >
              <AvatarImage
                :candidates="sellerAvatarCandidates"
                :seed="sellerAvatarSeed"
                :size="128"
                alt=""
                class="seller-avatar"
              />
              <div class="seller-content">
                <div class="seller-meta">
                  <div class="seller-texts">
                    <div v-if="sellerDisplayName" class="seller-display-name">{{ sellerDisplayName }}</div>
                    <div :class="['seller-name', { 'seller-name--secondary': sellerDisplayName }]">
                      @{{ sellerUsernameLabel }}
                    </div>
                  </div>
                  <div class="seller-side">
                    <span
                      v-if="sellerTrustLevelLabel"
                      :class="['seller-trust-badge', sellerTrustBadgeClass]"
                    >
                      {{ sellerTrustLevelLabel }}
                    </span>
                    <div class="seller-hint">点击查看商家主页</div>
                  </div>
                </div>
              </div>
            </div>

            <section
              v-if="isPlatformOrder"
              class="purchase-conditions"
              aria-labelledby="purchase-conditions-title"
            >
              <div class="purchase-conditions-heading">
                <ShieldCheck :size="18" aria-hidden="true" />
                <h2 id="purchase-conditions-title">兑换条件</h2>
              </div>
              <div class="purchase-condition-list">
                <div :class="['purchase-condition-item', { 'is-blocked': isOutOfStock || purchaseLimitReached }]">
                  <span class="purchase-condition-icon" aria-hidden="true"><Package :size="18" /></span>
                  <span class="purchase-condition-copy">
                    <small>兑换限制</small>
                    <strong>{{ exchangeQuantityText }}</strong>
                    <span
                      v-if="purchaseLimitReached && purchaseLimitReleaseText"
                      class="purchase-limit-release-hint"
                    >
                      按当前状态，预计 {{ purchaseLimitReleaseText }} 起逐步恢复额度
                    </span>
                    <router-link
                      v-if="purchaseLimitReservedQuantity > 0"
                      :to="{ name: 'Orders' }"
                      class="purchase-limit-order-link"
                    >
                      待支付订单占用 {{ purchaseLimitReservedQuantity }} 件 · 查看订单
                    </router-link>
                  </span>
                </div>
                <div :class="['purchase-condition-item', purchaseAccountTone]">
                  <span class="purchase-condition-icon" aria-hidden="true"><ShieldCheck :size="18" /></span>
                  <span class="purchase-condition-copy">
                    <small>账号要求</small>
                    <strong>{{ purchaseAccountText }}</strong>
                  </span>
                </div>
                <div class="purchase-condition-item">
                  <span class="purchase-condition-icon" aria-hidden="true">
                    <component :is="deliveryConditionIcon" :size="18" />
                  </span>
                  <span class="purchase-condition-copy">
                    <small>交付方式</small>
                    <strong>{{ deliveryConditionText }}</strong>
                  </span>
                </div>
              </div>
            </section>

            <div v-if="maintenancePurchaseHint" class="maintenance-order-notice">
              {{ maintenancePurchaseHint }}
            </div>
            
            
            
            <div class="action-section desktop-only">
              <ProductPurchasePanel v-bind="purchasePanelProps" @buy="handleBuyProduct" @open-store="handleOpenStore" @subscribe-restock="handleSubscribeRestock" />
            </div>
          </div>
        </div>

        <!-- 物品描述区域 -->
        </div>

        <div class="detail-description">
          <h2 class="section-title">
            <FileText :size="18" aria-hidden="true" />
            <span>物品详情</span>
          </h2>
          <div class="description-content markdown-content" v-html="renderedDescription || '暂无描述'"></div>
        </div>

        <ProductComments v-if="supportsComments" :active="detailInteractionsActive" :loading="commentLoading">
        <div
          class="detail-comment-summary"
        >
          <div class="comment-summary-main">
            <div class="comment-summary-stars">
              <StarRatingDisplay :value="commentSummary.averageRating" size="lg" />
              <strong>{{ hasCommentRatings ? formatRatingLabel(commentSummary.averageRating) : '暂无评分' }}</strong>
            </div>
            <div class="comment-summary-text">
              <span v-if="commentLoading && !hasCommentSummary">正在统计买家评分...</span>
              <span v-else-if="hasCommentRatings">
                平均 {{ formatRatingLabel(commentSummary.averageRating) }}，{{ commentSummary.ratedCount }} 人已打分
              </span>
              <span v-else>暂时还没有买家评分</span>
            </div>
          </div>
          <div class="comment-summary-side">
            <div class="comment-summary-metric">
              <span class="comment-summary-metric-label">收藏数量</span>
              <strong>{{ Number(commentSummary.favoriteCount || 0) }}</strong>
            </div>
            <div class="comment-summary-metric">
              <span class="comment-summary-metric-label">评论与回复</span>
              <strong>{{ commentVisibleCount }}</strong>
            </div>
          </div>
        </div>

        <div id="comments" v-if="supportsComments" class="detail-comments">
          <div class="comment-header">
            <div class="comment-header-title">
              <h2 class="section-title">
                <MessageCircle :size="18" aria-hidden="true" />
                <span>物品评论</span>
              </h2>
              <span class="comment-total-tag">{{ commentVisibleCount }}</span>
            </div>
            <button
              class="comment-refresh-btn"
              :disabled="commentLoading"
              @click="loadComments(commentPagination.page || 1)"
            >
              {{ commentLoading ? '加载中...' : '刷新' }}
            </button>
          </div>

          <div v-if="commentLoading" class="comment-empty">评论加载中...</div>
          <div v-else-if="!commentEnabled" class="comment-empty">{{ commentDisabledReason }}</div>
          <template v-else>
            <div v-if="commentList.length === 0" class="comment-empty">还没有评论，来发表第一条评价吧</div>
            <div v-else class="comment-list">
              <div
                v-for="item in commentList"
                :key="item.id"
                class="comment-item"
              >
                <div class="comment-meta-line">
                  <div class="comment-user">
                    <AvatarImage
                      :candidates="resolveCommentAvatarCandidates(item.user)"
                      :seed="commentAvatarSeed(item.user)"
                      :size="96"
                      alt=""
                      class="comment-avatar"
                    />
                    <span class="comment-name">{{ item.user?.nickname || item.user?.username || '匿名用户' }}</span>
                    <span class="comment-username">@{{ item.user?.username || 'unknown' }}</span>
                    <span v-if="item.isSeller" class="comment-seller-tag">卖家</span>
                    <span v-if="item.isPurchased" class="comment-purchased-tag">已购</span>
                    <span
                      v-if="item.isPurchased && item.ratingValue !== null"
                      class="comment-rating-tag"
                    >
                      <StarRatingDisplay :value="item.ratingValue" size="xs" />
                      <span>{{ formatRatingLabel(item.ratingValue) }}</span>
                    </span>
                  </div>

                  <div class="comment-right">
                    <div v-if="canOpenCommentActionMenu(item)" class="comment-action-wrap">
                      <button
                        class="comment-action-btn"
                        :disabled="commentDeletingId === item.id || commentReportingId === item.id"
                        :aria-expanded="commentActionMenuId === item.id"
                        aria-label="评论操作"
                        @click.stop="toggleCommentActionMenu(item.id)"
                      >
                        <MoreHorizontal :size="18" aria-hidden="true" />
                      </button>
                      <div
                        v-if="commentActionMenuId === item.id"
                        class="comment-action-menu"
                      >
                        <button
                          v-if="isCommentPublicStatus(item.status)"
                          class="comment-action-item"
                          :disabled="commentReportingId === item.id"
                          @click.stop="openCommentReportModal(item)"
                        >
                          {{ commentReportingId === item.id ? '举报中...' : '举报' }}
                        </button>
                        <button
                          v-if="item.canDelete"
                          class="comment-action-item danger"
                          :disabled="commentDeletingId === item.id"
                          @click.stop="deleteComment(item)"
                        >
                          {{ commentDeletingId === item.id ? '删除中...' : '删除' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="comment-content">
                  <span>{{ item.content }}</span>
                  <span
                    v-if="isCommentPendingStatus(item.status)"
                    class="comment-inline-status-tag"
                  >
                    正在审核中，暂时仅自己可见
                  </span>
                  <span
                    v-else-if="isCommentRejectedStatus(item.status)"
                    class="comment-inline-status-tag comment-inline-status-tag--rejected"
                    :title="item.reviewReason || '该评论未通过审核'"
                  >
                    审核未通过，仅自己可见
                  </span>
                </div>
                <div class="comment-footer">
                  <time class="comment-time">{{ formatCommentTime(item.createdAt) }}</time>
                  <div v-if="isCommentPublicStatus(item.status)" class="comment-footer-actions">
                    <button
                      class="comment-footer-btn comment-reply-btn"
                      :class="{ active: isCommentReplyComposerOpen(item.id) }"
                      @click="toggleCommentReplyComposer(item.id)"
                    >
                      {{ isCommentReplyComposerOpen(item.id) ? '收起输入' : '回复' }} {{ Number(item.replyCount || 0) }}
                    </button>
                    <button
                      class="comment-footer-btn comment-vote-btn"
                      :class="{ active: normalizeCommentVoteType(item.viewerVote) === COMMENT_VOTE_UP }"
                      :disabled="isCommentVoting(item.id)"
                      :aria-label="`赞同，当前 ${Number(item.upvoteCount || 0)} 票`"
                      :aria-pressed="normalizeCommentVoteType(item.viewerVote) === COMMENT_VOTE_UP"
                      @click="voteComment(item, COMMENT_VOTE_UP)"
                    >
                      <ThumbsUp class="comment-vote-icon" :size="14" aria-hidden="true" />
                      <span>{{ Number(item.upvoteCount || 0) }}</span>
                    </button>
                    <button
                      class="comment-footer-btn comment-vote-btn"
                      :class="{ active: normalizeCommentVoteType(item.viewerVote) === COMMENT_VOTE_DOWN }"
                      :disabled="isCommentVoting(item.id)"
                      :aria-label="`反对，当前 ${Number(item.downvoteCount || 0)} 票`"
                      :aria-pressed="normalizeCommentVoteType(item.viewerVote) === COMMENT_VOTE_DOWN"
                      @click="voteComment(item, COMMENT_VOTE_DOWN)"
                    >
                      <ThumbsDown class="comment-vote-icon" :size="14" aria-hidden="true" />
                      <span>{{ Number(item.downvoteCount || 0) }}</span>
                    </button>
                  </div>
                </div>
                <div v-if="Number(item.replyCount || 0) > 0 || isCommentReplyComposerOpen(item.id) || isCommentReplyLoading(item.id)" class="comment-reply-panel">
                  <div class="comment-reply-list">
                    <div v-if="isCommentReplyLoading(item.id)" class="comment-reply-empty">回复加载中...</div>
                    <template v-else>
                      <div v-if="getCommentReplies(item.id).length === 0" class="comment-reply-empty">暂无回复，来发表第一条回复吧</div>
                      <div
                        v-for="reply in getCommentReplies(item.id)"
                        :key="reply.id"
                        class="comment-reply-item"
                      >
                        <AvatarImage
                          :candidates="resolveCommentAvatarCandidates(reply.user)"
                          :seed="commentAvatarSeed(reply.user)"
                          :size="96"
                          alt=""
                          class="comment-reply-avatar"
                        />
                        <div class="comment-reply-body">
                          <div class="comment-reply-meta">
                            <span class="comment-reply-name">{{ reply.user?.nickname || reply.user?.username || '匿名用户' }}</span>
                            <span class="comment-reply-username">@{{ reply.user?.username || 'unknown' }}</span>
                            <span v-if="reply.isSeller" class="comment-seller-tag comment-seller-tag--reply">卖家</span>
                            <time class="comment-reply-time">{{ formatCommentTime(reply.createdAt) }}</time>
                          </div>
                          <div class="comment-reply-content">
                            <span>{{ reply.content }}</span>
                            <span
                              v-if="isCommentPendingStatus(reply.status)"
                              class="comment-inline-status-tag"
                            >
                              正在审核中，暂时仅自己可见
                            </span>
                            <span
                              v-else-if="isCommentRejectedStatus(reply.status)"
                              class="comment-inline-status-tag comment-inline-status-tag--rejected"
                              :title="reply.reviewReason || '该回复未通过审核'"
                            >
                              审核未通过，仅自己可见
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        v-if="canLoadMoreCommentReplies(item.id)"
                        class="comment-reply-more-btn"
                        :disabled="isCommentReplyLoading(item.id)"
                        @click="loadMoreCommentReplies(item.id)"
                      >
                        加载更多回复
                      </button>
                    </template>
                  </div>
                  <div v-if="isCommentReplyComposerOpen(item.id)" class="comment-reply-compose">
                    <div v-if="!userStore.isLoggedIn" class="comment-reply-login-tip">
                      回复需要登录后发布
                      <button class="comment-login-btn" @click="goLogin">去登录</button>
                    </div>
                    <template v-else>
                      <textarea
                        v-model="commentReplyDraftMap[item.id]"
                        class="comment-reply-textarea"
                        maxlength="300"
                        placeholder="回复内容需为 2-300 个字符"
                      ></textarea>
                      <div class="comment-reply-compose-footer">
                        <span class="comment-count">{{ getCommentReplyDraftLength(item.id) }}/300</span>
                        <button
                          class="comment-submit-btn"
                          :disabled="isCommentReplySubmitting(item.id) || getCommentReplyDraftLength(item.id) < 2 || getCommentReplyDraftLength(item.id) > 300"
                          @click="submitCommentReply(item)"
                        >
                          {{ isCommentReplySubmitting(item.id) ? '回复中...' : '发布回复' }}
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="commentPagination.totalPages > 1" class="comment-pagination">
              <button
                class="comment-page-btn"
                :disabled="commentLoading || commentPagination.page <= 1"
                @click="changeCommentPage(commentPagination.page - 1)"
              >
                上一页
              </button>
              <button
                v-for="pageNo in commentPageNumbers"
                :key="`comment-page-${pageNo}`"
                class="comment-page-btn"
                :class="{ active: pageNo === commentPagination.page }"
                :disabled="commentLoading || pageNo === commentPagination.page"
                @click="changeCommentPage(pageNo)"
              >
                {{ pageNo }}
              </button>
              <button
                class="comment-page-btn"
                :disabled="commentLoading || commentPagination.page >= commentPagination.totalPages"
                @click="changeCommentPage(commentPagination.page + 1)"
              >
                下一页
              </button>
            </div>

            <div class="comment-compose">
              <div class="comment-compose-title">发布评论</div>
              <div v-if="!userStore.isLoggedIn" class="comment-login-tip">
                评论需要登录后发布
                <button class="comment-login-btn" @click="goLogin">去登录</button>
              </div>
              <template v-else>
                <div v-if="viewerHasPurchased && !viewerHasRated" class="comment-rating-field">
                  <label class="comment-rating-label">买家评分（可选）</label>
                  <StarRatingInput
                    v-model="commentRatingDraft"
                    class="comment-rating-control"
                  />
                  <div class="comment-rating-once-tip">
                    评分仅有一次机会，提交后将无法撤回或修改。
                  </div>
                </div>
                <div
                  v-else-if="viewerHasPurchased && viewerHasRated"
                  class="comment-rating-tip comment-rating-tip-locked"
                >
                  <span>该物品您已评分，本次评论不能重复评分或修改评分。</span>
                  <span v-if="viewerRatingValue !== null" class="comment-rating-tip-value">
                    <StarRatingDisplay :value="viewerRatingValue" size="xs" />
                    <strong>{{ formatRatingLabel(viewerRatingValue) }}</strong>
                  </span>
                </div>
                <div
                  v-else
                  class="comment-rating-tip"
                >
                  购买后可在发表评论时为该物品打分。
                </div>
                <textarea
                  v-model="commentDraft"
                  class="comment-textarea"
                  maxlength="500"
                  placeholder="欢迎分享你对这个物品的真实体验（5-500字）"
                ></textarea>
                <div class="comment-compose-footer">
                  <span class="comment-count">{{ commentDraft.trim().length }}/500</span>
                  <button
                    class="comment-submit-btn"
                    :disabled="commentSubmitting || commentDraft.trim().length < 5 || commentDraft.trim().length > 500"
                    @click="submitComment"
                  >
                    {{ commentSubmitting ? '发布中...' : '发布评论' }}
                  </button>
                </div>
              </template>
            </div>
          </template>
        </div>
        </ProductComments>
        
        <!-- 底部购买按钮（移动端固定底部） -->
        <div class="action-bottom mobile-only">
          <ProductPurchasePanel v-bind="purchasePanelProps" @buy="handleBuyProduct" @open-store="handleOpenStore" @subscribe-restock="handleSubscribeRestock" />
        </div>
      </template>
      
      <!-- 错误状态 -->
      <EmptyState
        v-else
        :icon-component="detailErrorContent.icon"
        :text="detailErrorContent.text"
        :hint="detailErrorContent.hint"
      >
        <template #action>
          <button
            v-if="detailErrorType === 'login_required'"
            class="btn btn-primary mt-4"
            @click="goLogin"
          >
            去登录
          </button>
          <router-link v-else to="/" class="btn btn-primary mt-4">
            返回首页
          </router-link>
        </template>
      </EmptyState>
    </div>
    
    <!-- 图片预览弹窗 -->
    <Teleport to="body">
      <div 
        v-if="showImagePreview && product?.imageUrl"
        class="image-preview-overlay"
        @click.self="closeImagePreview"
      >
        <button class="preview-close" aria-label="关闭图片预览" @click="closeImagePreview">
          <X :size="24" aria-hidden="true" />
        </button>
        <img 
          :src="product.imageUrl"
          :alt="product.name" 
          class="preview-image"
        />
        <div class="preview-hint">点击空白处或按 ESC 关闭</div>
      </div>
    </Teleport>
    <ReportComposer :open="showReportModal" :object-id="normalizeResourceId(product?.id || 0)" :object-name="product?.name || ''" @close="closeReportModal" @busy="reportSubmitting=$event" />
    <ReportComposer :open="showCommentReportModal" target-type="comment" :object-id="normalizeResourceId(commentReportTarget?.id || 0)" :object-name="product?.name || ''" @close="closeCommentReportModal" />
  </div>
</template>

<script setup>
import { normalizeResourceId } from '@/utils/resourceId'
import { ref, computed, watch, onActivated, onDeactivated, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  Eye,
  FileText,
  Flame,
  FlaskConical,
  Gamepad2,
  HardDrive,
  Laptop,
  LockKeyhole,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Package,
  PackageX,
  Server,
  ShieldAlert,
  ShieldCheck,
  Store,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  Wrench,
  X
} from '@lucide/vue'
import { useProductStore } from '@/stores/product'
import { useUserStore } from '@/stores/user'
import { useCheckoutStore } from '@/stores/checkout'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { formatRelativeTime } from '@/utils/format'
import { renderProductDescription } from '@/utils/renderProductDescription'
import { prepareNewTab, openInNewTab, cleanupPreparedTab } from '@/utils/newTab'
import AvatarImage from '@/components/common/AvatarImage.vue'
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue'
import StarRatingInput from '@/components/common/StarRatingInput.vue'
import ProductStockIndicator from '@/components/product/ProductStockIndicator.vue'
import ProductMedia from '@/components/product-detail/ProductMedia.vue'
import ProductInteractionPanel from '@/components/product-detail/ProductInteractionPanel.vue'
import ProductPurchasePanel from '@/components/product-detail/ProductPurchasePanel.vue'
import ProductComments from '@/components/product-detail/ProductComments.vue'
import { useProductDetail } from '@/composables/product-detail/useProductDetail'
import { useProductComments } from '@/composables/product-detail/useProductComments'
import ReportComposer from '@/components/report/ReportComposer.vue'
import { useProductInteractions } from '@/composables/product-detail/useProductInteractions'
import { buildAvatarCandidates } from '@/utils/avatar'
import { fetchExternalProductLinkRequest } from '@/services/shop/catalogService'
import {
  isPlatformOrderProduct
} from '@/utils/shopProduct'
import Skeleton from '@/components/common/Skeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const productStore = useProductStore()
const userStore = useUserStore()
const checkoutStore = useCheckoutStore()
const toast = useToast()
const dialog = useDialog()

defineOptions({ name: 'ProductDetail' })

// 状态
const loading = ref(true)
const product = ref(null)
const detailErrorType = ref('not_found')
const detailErrorMessage = ref('')
const purchasing = ref(false)
const showImagePreview = ref(false)
const showReportModal = ref(false)
const reportSubmitting = ref(false)
const favoriteSubmitting = ref(false)
const restockSubscribed = ref(false)
const restockStatusLoading = ref(false)
const restockSubscribeLoading = ref(false)
const commentController = useProductComments()
const {
  loading: commentLoading,
  commentList,
  commentEnabled,
  commentDisabledReason,
  commentPagination,
  commentSummary,
  viewerHasPurchased,
  viewerHasRated,
  viewerRatingValue,
  commentDraft,
  commentRatingDraft,
  commentSubmitting,
  commentActionMenuId,
  commentDeletingId,
  commentReportingId,
  showCommentReportModal,
  commentReportReason,
  commentReportTarget,
  commentVotingMap,
  commentReplyComposerIdSet,
  commentReplyMap,
  commentReplyPaginationMap,
  commentReplyLoadingMap,
  commentReplySubmittingMap,
  commentReplyDraftMap
} = commentController
const {
  active: detailInteractionsActive,
  activate: activateInteractionListeners,
  deactivate: deactivateInteractionListeners,
  syncModalState: syncInteractionModalState
} = useProductInteractions({
  hasOpenModal: () => showImagePreview.value || showReportModal.value || showCommentReportModal.value,
  onEscape: event => handleEscKey(event),
  onDocumentClick: event => handleDocumentClick(event)
})

const COMMENT_VOTE_UP = 'up'
const COMMENT_VOTE_DOWN = 'down'
const COMMENT_PUBLIC_STATUS_SET = new Set(['ai_approved', 'manual_approved', 'approved'])
const COMMENT_PENDING_STATUS_SET = new Set(['pending_ai', 'pending_manual', 'pending'])
const COMMENT_REJECTED_STATUS_SET = new Set(['ai_rejected', 'manual_rejected', 'rejected'])


const {
  coverAspectRatio,
  isCdk,
  isStore,
  isLegacyLink,
  isPlatformOrder,
  supportsComments,
  isLandscapeDetailLayout,
  isTestMode,
  isSeller,
  hasDiscount,
  discountPercent,
  finalPrice,
  originalPrice,
  isOutOfStock,
  canPurchase,
  soldCount,
  purchaseLimitReached,
  purchaseLimitReservedQuantity,
  purchaseLimitReleaseText,
  purchaseTrustLevel,
  canPurchaseByTrustLevel,
  purchaseTrustBlockMessage,
  exchangeQuantityText,
  purchaseAccountText,
  purchaseAccountTone,
  deliveryConditionText,
  isOwnProductPurchaseBlocked,
  isOrderCreationMaintenanceBlocked,
  canEnterCheckout,
  maintenancePurchaseHint,
  coverStyle,
  setCoverAspectRatio,
  syncCoverAspectRatio,
  stop: stopProductDetail
} = useProductDetail({
  product,
  isLoggedIn: computed(() => userStore.isLoggedIn),
  userId: computed(() => userStore.user?.id),
  trustLevel: computed(() => userStore.trustLevel)
})

// 物品类型
const renderedDescription = computed(() => renderProductDescription(product.value?.description))
const isFavorited = computed(() =>
  !!product.value?.isFavorited
)
const sellerUsernameLabel = computed(() => {
  const username = String(product.value?.sellerUsername || '').trim()
  return username || '未知'
})
const sellerDisplayName = computed(() => {
  const nickname = String(product.value?.sellerName || '').trim()
  if (!nickname || nickname === sellerUsernameLabel.value) return ''
  return nickname
})
const sellerTrustLevelValue = computed(() => {
  const parsed = Number.parseInt(product.value?.sellerTrustLevel, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, 4) : null
})
const sellerTrustLevelLabel = computed(() => (
  sellerTrustLevelValue.value === null ? '' : `TL${sellerTrustLevelValue.value}`
))
const sellerTrustBadgeClass = computed(() => {
  if (sellerTrustLevelValue.value === null) return ''
  return `seller-trust-badge--${sellerTrustLevelValue.value}`
})

const restockButtonText = computed(() => {
  if (restockStatusLoading.value) return '加载中...'
  if (restockSubscribeLoading.value) return '订阅中...'
  if (restockSubscribed.value) return '已订阅'
  return '订阅补货通知'
})
const purchasePanelProps = computed(() => ({
  isStore: isStore.value,
  isPlatformOrder: isPlatformOrder.value,
  isLegacyLink: isLegacyLink.value,
  isCdk: isCdk.value,
  isOutOfStock: isOutOfStock.value,
  isTestMode: isTestMode.value,
  isSeller: isSeller.value,
  maintenanceBlocked: isOrderCreationMaintenanceBlocked.value,
  ownProductBlocked: isOwnProductPurchaseBlocked.value,
  purchaseLimitReached: purchaseLimitReached.value,
  canPurchase: canPurchase.value,
  isLoggedIn: userStore.isLoggedIn,
  trustAllowed: canPurchaseByTrustLevel.value,
  purchaseTrustLevel: purchaseTrustLevel.value,
  purchasing: purchasing.value,
  canEnterCheckout: canEnterCheckout.value,
  restockSubscribed: restockSubscribed.value,
  restockBusy: restockStatusLoading.value || restockSubscribeLoading.value,
  restockButtonText: restockButtonText.value
}))
const deliveryConditionIcon = computed(() => (isCdk.value ? Ticket : MessagesSquare))

const detailErrorContent = computed(() => {
  if (detailErrorType.value === 'login_required') {
    return {
      icon: LockKeyhole,
      text: '请先登录后查看',
      hint: detailErrorMessage.value || '该物品需要更高的账号信任等级，登录后可继续访问当前页面'
    }
  }

  if (detailErrorType.value === 'trust_required') {
    return {
      icon: ShieldAlert,
      text: '信任等级不足',
      hint: detailErrorMessage.value || '当前账号信任等级不足，暂时无法查看该物品'
    }
  }

  return {
    icon: PackageX,
    text: '物品不存在',
    hint: '该物品可能已下架或被删除'
  }
})

const commentPageNumbers = computed(() => {
  const totalPages = Number(commentPagination.value.totalPages || 0)
  const currentPage = Number(commentPagination.value.page || 1)
  if (totalPages <= 1) return []

  const maxButtons = 5
  let start = Math.max(1, currentPage - 2)
  let end = Math.min(totalPages, start + maxButtons - 1)

  if (end - start + 1 < maxButtons) {
    start = Math.max(1, end - maxButtons + 1)
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})
const selectedCommentRating = computed(() => normalizeCommentRatingValue(commentRatingDraft.value, { allowNull: true }))
const commentVisibleCount = computed(() => Math.max(
  Number(commentSummary.value.visibleCommentCount || 0) + Number(commentSummary.value.visibleReplyCount || 0),
  Number(commentPagination.value.total || 0)
))
const hasCommentRatings = computed(() => Number(commentSummary.value.ratedCount || 0) > 0)
const hasCommentSummary = computed(() =>
  hasCommentRatings.value
  || Number(commentSummary.value.favoriteCount || 0) > 0
  || Number(commentSummary.value.visibleCommentCount || 0) > 0
  || Number(commentSummary.value.visibleReplyCount || 0) > 0
)

// 分类
const categoryName = computed(() => product.value?.categoryName || '其他')
const categoryIconComponent = computed(() => {
  const normalizedName = categoryName.value.trim().toLowerCase()

  if (normalizedName === 'ai' || normalizedName.includes('人工智能')) return Bot
  if (normalizedName.includes('公益站')) return Laptop
  if (['存储', '网盘', '云盘'].some((keyword) => normalizedName.includes(keyword))) return HardDrive
  if (['小鸡', '主机', '服务器'].some((keyword) => normalizedName.includes(keyword))) return Server
  if (normalizedName.includes('咨询')) return MessagesSquare
  if (normalizedName.includes('服务')) return Wrench
  if (normalizedName.includes('游戏')) return Gamepad2
  if (['卡券', 'cdk', '优惠券'].some((keyword) => normalizedName.includes(keyword))) return Ticket

  return Package
})

// 卖家
const sellerAvatarSeed = computed(() =>
  product.value?.sellerUsername || product.value?.sellerUserId || product.value?.id || 'seller'
)

const sellerAvatarCandidates = computed(() =>
  buildAvatarCandidates(product.value?.sellerAvatar, 128)
)

function commentAvatarSeed(user) {
  return user?.nickname || user?.username || user?.id || 'user'
}

function resolveCommentAvatarCandidates(user) {
  return buildAvatarCandidates([
    user?.animatedAvatar,
    user?.avatar,
    user?.avatarUrl,
    user?.avatarTemplate
  ], 96)
}

// 时间
const updateTime = computed(() => 
  formatRelativeTime(product.value?.updatedAt || product.value?.createdAt)
)

let latestRestockStatusRequestId = 0

async function refreshRestockSubscriptionStatus() {
  const requestId = ++latestRestockStatusRequestId

  if (!product.value?.id || !isCdk.value || !isOutOfStock.value || !userStore.isLoggedIn) {
    restockSubscribed.value = false
    restockStatusLoading.value = false
    return
  }

  restockStatusLoading.value = true
  try {
    const result = await productStore.getProductRestockSubscriptionStatus(product.value.id)
    if (requestId !== latestRestockStatusRequestId) return

    if (result?.success) {
      restockSubscribed.value = !!result?.data?.subscribed
      return
    }

    restockSubscribed.value = false
  } catch (_) {
    if (requestId !== latestRestockStatusRequestId) return
    restockSubscribed.value = false
  } finally {
    if (requestId === latestRestockStatusRequestId) {
      restockStatusLoading.value = false
    }
  }
}

function resolveDetailErrorType(result) {
  const status = Number(result?.status || 0)
  const errorMessage = String(result?.error || '')

  if (!userStore.isLoggedIn && (status === 401 || /登录/.test(errorMessage))) {
    return 'login_required'
  }

  if (status === 403 || /信任等级|TL\d/.test(errorMessage)) {
    return 'trust_required'
  }

  return 'not_found'
}

// 加载物品
onMounted(async () => {
  activateDetailInteractions()
  const productId = route.params.id
  if (!productId) {
    loading.value = false
    return
  }
  
  // 获取物品详情
  const result = await productStore.fetchProduct(String(productId))
  if (result?.success && result?.data?.product) {
    product.value = result.data.product
    if (String(route.params.id) !== String(product.value.id)) await router.replace({ ...route, params: { ...route.params, id: product.value.id } })
    detailErrorMessage.value = ''
    // 更新页面标题
    document.title = `${product.value.name} - LD士多`
    if (isPlatformOrderProduct(product.value)) {
      await loadComments(1)
    }
  } else {
    detailErrorMessage.value = String(result?.error || '').trim()
    detailErrorType.value = resolveDetailErrorType(result)
  }
  
  loading.value = false
  await restoreCheckoutReturnState()
  if (product.value && route.hash === '#comments') {
    await nextTick()
    document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})

onUnmounted(() => {
  deactivateDetailInteractions()
})

onActivated(() => {
  activateDetailInteractions()
  if (product.value?.name) document.title = `${product.value.name} - LD士多`
  void restoreCheckoutReturnState()
})

onDeactivated(() => {
  deactivateDetailInteractions()
})

function activateDetailInteractions() {
  commentController.activate()
  activateInteractionListeners()
  syncModalState()
}

function deactivateDetailInteractions() {
  commentController.deactivate()
  deactivateInteractionListeners()
  stopProductDetail()
}

async function restoreCheckoutReturnState() {
  if (!product.value?.id) return false
  const draft = checkoutStore.consumeProductReturn(product.value.id)
  if (!draft) return false

  const latestResult = await productStore.fetchProduct(product.value.id)
  if (latestResult.success) {
    product.value = { ...product.value, ...latestResult.data.product }
  }

  await nextTick()
  if (draft) {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: draft.sourceScrollY || 0, behavior: 'auto' })
    })
  }
  return true
}

watch(
  () => [
    product.value?.id,
    isCdk.value,
    isOutOfStock.value,
    userStore.isLoggedIn
  ],
  () => {
    void refreshRestockSubscriptionStatus()
  },
  { immediate: true }
)

// 方法
watch(
  () => product.value?.imageUrl || '',
  (imageUrl) => {
    void syncCoverAspectRatio(imageUrl)
  },
  { immediate: true }
)

function goLogin() {
  router.push({ name: 'Login', query: { redirect: route.fullPath } })
}

function handleCoverImageLoad(event) {
  setCoverAspectRatio(event?.target?.naturalWidth, event?.target?.naturalHeight)
}

function formatCommentTime(timestamp) {
  const value = Number(timestamp || 0)
  if (!Number.isFinite(value) || value <= 0) return ''

  const now = Date.now()
  const diffMs = now - value
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs
  const monthMs = 30 * dayMs

  const formatCalendarDate = (targetTs) => {
    const targetDate = new Date(targetTs)
    if (Number.isNaN(targetDate.getTime())) return ''
    const year = targetDate.getFullYear()
    const month = targetDate.getMonth() + 1
    const day = targetDate.getDate()
    return `${year}年${month}月${day}日`
  }

  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return formatCalendarDate(value)
  }
  if (diffMs < hourMs) {
    const minutes = Math.max(1, Math.floor(diffMs / minuteMs))
    return `${minutes}分钟前`
  }
  if (diffMs < dayMs) {
    const hours = Math.max(1, Math.floor(diffMs / hourMs))
    return `${hours}小时前`
  }
  if (diffMs < monthMs) {
    const days = Math.max(1, Math.floor(diffMs / dayMs))
    return `${days}天前`
  }

  return formatCalendarDate(value)
}

function normalizeCommentRatingValue(value, options = {}) {
  const allowNull = !!options.allowNull
  if (value === '' || value === null || value === undefined) {
    return allowNull ? null : 0
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return allowNull ? null : 0
  }

  const rounded = Math.round(numeric * 2) / 2
  const clamped = Math.min(5, Math.max(0, rounded))
  return Number.isFinite(clamped) ? clamped : (allowNull ? null : 0)
}

function formatRatingValue(value) {
  const normalized = normalizeCommentRatingValue(value)
  return Number.isInteger(normalized) ? normalized.toFixed(0) : normalized.toFixed(1)
}

function formatRatingLabel(value) {
  return `${formatRatingValue(value)} 星`
}

function isCommentPublicStatus(status) {
  return COMMENT_PUBLIC_STATUS_SET.has(String(status || '').trim())
}

function isCommentPendingStatus(status) {
  return COMMENT_PENDING_STATUS_SET.has(String(status || '').trim())
}

function isCommentRejectedStatus(status) {
  return COMMENT_REJECTED_STATUS_SET.has(String(status || '').trim())
}

function canOpenCommentActionMenu(item) {
  return !!item?.canDelete || isCommentPublicStatus(item?.status)
}

function normalizeCommentVoteType(value) {
  const voteType = String(value || '').toLowerCase()
  if (voteType === COMMENT_VOTE_UP) return COMMENT_VOTE_UP
  if (voteType === COMMENT_VOTE_DOWN) return COMMENT_VOTE_DOWN
  return ''
}

function isCommentVoting(commentId) {
  return !!commentVotingMap.value[normalizeResourceId(commentId || 0)]
}

function isCommentReplyComposerOpen(commentId) {
  const safeCommentId = normalizeResourceId(commentId || 0)
  if (!safeCommentId) return false
  return commentReplyComposerIdSet.value.has(safeCommentId)
}

function isCommentReplyLoading(commentId) {
  return !!commentReplyLoadingMap.value[normalizeResourceId(commentId || 0)]
}

function isCommentReplySubmitting(commentId) {
  return !!commentReplySubmittingMap.value[normalizeResourceId(commentId || 0)]
}

function getCommentReplies(commentId) {
  return commentReplyMap.value[normalizeResourceId(commentId || 0)] || []
}

function getCommentReplyPagination(commentId) {
  return commentReplyPaginationMap.value[normalizeResourceId(commentId || 0)] || {
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0
  }
}

function canLoadMoreCommentReplies(commentId) {
  const pagination = getCommentReplyPagination(commentId)
  return Number(pagination.page || 0) < Number(pagination.totalPages || 0)
}

function getCommentReplyDraftLength(commentId) {
  const safeCommentId = normalizeResourceId(commentId || 0)
  return String(commentReplyDraftMap.value[safeCommentId] || '').trim().length
}

function updateCommentListItem(commentId, updater) {
  const safeCommentId = normalizeResourceId(commentId || 0)
  if (!safeCommentId || typeof updater !== 'function') return
  const index = commentList.value.findIndex((item) => normalizeResourceId(item.id || 0) === safeCommentId)
  if (index < 0) return
  const current = commentList.value[index]
  commentList.value[index] = updater(current)
}

function handleDocumentClick(event) {
  const target = event?.target
  if (!(target instanceof Element)) return
  if (!target.closest('.comment-action-wrap')) {
    commentActionMenuId.value = null
  }
}

async function loadComments(page = 1) {
  if (!product.value?.id) return
  const targetPage = Math.max(Number.parseInt(page, 10) || 1, 1)
  const request = commentController.beginRequest('comments')

  try {
    const result = await productStore.fetchProductComments(product.value.id, {
      page: targetPage,
      pageSize: 10,
      signal: request.signal
    })
    if (!commentController.isCurrent('comments', request)) return
    if (!result?.success) {
      const message = typeof result?.error === 'object'
        ? (result.error?.message || result.error?.code || '加载评论失败')
        : (result?.error || result?.message || '加载评论失败')
      toast.error(message)
      return
    }

    const data = result.data || {}
    const pagination = data.pagination || {}
    commentEnabled.value = !!data.commentEnabled
    commentDisabledReason.value = data.disabledReason || '该物品暂未开启评论'
    viewerHasPurchased.value = !!data.viewerHasPurchased
    const viewerRating = data.viewerRating || {}
    viewerHasRated.value = !!viewerRating.hasRated
    viewerRatingValue.value = normalizeCommentRatingValue(
      viewerRating.value ?? viewerRating.ratingValue,
      { allowNull: true }
    )
    if (!viewerHasPurchased.value || viewerHasRated.value) {
      commentRatingDraft.value = null
    }
    const summary = data.summary || {}
    commentSummary.value = {
      averageRating: normalizeCommentRatingValue(summary.averageRating),
      ratedCount: Number(summary.ratedCount ?? 0),
      favoriteCount: Number(summary.favoriteCount ?? 0),
      visibleCommentCount: Number(summary.visibleCommentCount ?? pagination.total ?? 0),
      visibleReplyCount: Number(summary.visibleReplyCount ?? 0)
    }
    const list = Array.isArray(data.comments) ? data.comments : []
    commentList.value = list.map((item) => ({
      ...item,
      status: String(item?.status || '').trim(),
      isSeller: !!item?.isSeller,
      ratingValue: normalizeCommentRatingValue(item?.ratingValue, { allowNull: true }),
      upvoteCount: Number(item?.upvoteCount || 0),
      downvoteCount: Number(item?.downvoteCount || 0),
      replyCount: Number(item?.replyCount || 0),
      viewerVote: normalizeCommentVoteType(item?.viewerVote)
    }))
    commentPagination.value = {
      total: Number(pagination.total || 0),
      page: Number(pagination.page || targetPage),
      pageSize: Number(pagination.pageSize || 10),
      totalPages: Number(pagination.totalPages || 0)
    }
    const validCommentIds = new Set(commentList.value.map((item) => normalizeResourceId(item?.id || 0)).filter((id) => !!id))
    commentReplyComposerIdSet.value = new Set(
      [...commentReplyComposerIdSet.value].filter((id) => validCommentIds.has(normalizeResourceId(id)))
    )
    for (const mapRef of [
      commentVotingMap,
      commentReplyMap,
      commentReplyPaginationMap,
      commentReplyLoadingMap,
      commentReplySubmittingMap,
      commentReplyDraftMap
    ]) {
      Object.keys(mapRef.value).forEach((rawKey) => {
        const safeId = Number(rawKey || 0)
        if (!validCommentIds.has(safeId)) {
          delete mapRef.value[rawKey]
        }
      })
    }
    commentActionMenuId.value = null
    void preloadCommentRepliesForVisibleComments()
  } catch (error) {
    if (!request.signal.aborted) toast.error(`加载评论失败：${error.message}`)
  } finally {
    commentController.finishRequest('comments', request)
  }
}

function changeCommentPage(pageNo) {
  if (commentLoading.value) return
  const targetPage = Math.max(Number.parseInt(pageNo, 10) || 1, 1)
  if (targetPage === commentPagination.value.page) return
  loadComments(targetPage)
}

function toggleCommentActionMenu(commentId) {
  commentActionMenuId.value = commentActionMenuId.value === commentId ? null : commentId
}

async function voteComment(comment, voteType) {
  const safeCommentId = normalizeResourceId(comment?.id || 0)
  if (!safeCommentId || ![COMMENT_VOTE_UP, COMMENT_VOTE_DOWN].includes(voteType)) return

  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('点赞需要先登录，是否前往登录？', {
      title: '需要登录',
      icon: 'lock-keyhole',
      confirmText: '去登录',
      cancelText: '取消'
    })
    if (confirmed) goLogin()
    return
  }

  if (isCommentVoting(safeCommentId)) return
  commentVotingMap.value[safeCommentId] = true

  try {
    const currentVote = normalizeCommentVoteType(comment.viewerVote)
    const targetVote = currentVote === voteType ? '' : voteType
    const result = await productStore.voteProductComment(safeCommentId, targetVote)
    if (!result?.success) {
      const message = typeof result?.error === 'object'
        ? (result.error?.message || result.error?.code || '点赞操作失败')
        : (result?.error || result?.message || '点赞操作失败')
      toast.error(message)
      return
    }

    const data = result?.data || {}
    updateCommentListItem(safeCommentId, (current) => ({
      ...current,
      viewerVote: normalizeCommentVoteType(data.viewerVote),
      upvoteCount: Number(data.upvoteCount ?? current.upvoteCount ?? 0),
      downvoteCount: Number(data.downvoteCount ?? current.downvoteCount ?? 0)
    }))
  } catch (error) {
    toast.error(`点赞操作失败：${error.message}`)
  } finally {
    commentVotingMap.value[safeCommentId] = false
  }
}

async function preloadCommentRepliesForVisibleComments() {
  const targets = commentList.value
    .map((item) => ({
      id: normalizeResourceId(item?.id || 0),
      replyCount: Number(item?.replyCount || 0)
    }))
    .filter((item) => !!item.id && item.replyCount > 0)

  if (targets.length === 0) return
  await Promise.all(
    targets.map((item) => loadCommentReplies(item.id, 1, { silent: true, force: true }))
  )
}

async function loadCommentReplies(commentId, page = 1, options = {}) {
  const safeCommentId = normalizeResourceId(commentId || 0)
  if (!safeCommentId || isCommentReplyLoading(safeCommentId)) return
  const targetPage = Math.max(Number.parseInt(page, 10) || 1, 1)
  const append = targetPage > 1
  const silent = !!options?.silent
  const force = !!options?.force
  const loadedOnce = !!commentReplyPaginationMap.value[safeCommentId]
  const requestScope = `replies:${safeCommentId}`

  if (!append && loadedOnce && !force) return

  commentReplyLoadingMap.value[safeCommentId] = true
  const request = commentController.beginRequest(requestScope)
  try {
    const result = await productStore.fetchProductCommentReplies(safeCommentId, {
      page: targetPage,
      pageSize: 10,
      signal: request.signal
    })
    if (!commentController.isCurrent(requestScope, request)) return
    if (!result?.success) {
      const message = typeof result?.error === 'object'
        ? (result.error?.message || result.error?.code || '加载回复失败')
        : (result?.error || result?.message || '加载回复失败')
      if (!silent) toast.error(message)
      return
    }

    const data = result?.data || {}
    const list = Array.isArray(data.replies) ? data.replies : []
    const normalizedList = list.map((item) => ({
      ...item,
      isSeller: !!item?.isSeller,
      status: String(item?.status || '').trim()
    }))
    const currentList = commentReplyMap.value[safeCommentId] || []
    const merged = append
      ? [...currentList, ...normalizedList.filter((item) => !currentList.some((existing) => normalizeResourceId(existing.id) === normalizeResourceId(item.id)))]
      : normalizedList
    commentReplyMap.value[safeCommentId] = merged

    const pagination = data.pagination || {}
    commentReplyPaginationMap.value[safeCommentId] = {
      total: Number(pagination.total || merged.length || 0),
      page: Number(pagination.page || targetPage),
      pageSize: Number(pagination.pageSize || 10),
      totalPages: Number(pagination.totalPages || 0)
    }

    updateCommentListItem(safeCommentId, (current) => ({
      ...current,
      replyCount: Number(pagination.total || current.replyCount || merged.length || 0)
    }))
  } catch (error) {
    if (!silent && !request.signal.aborted) toast.error(`加载回复失败：${error.message}`)
  } finally {
    if (commentController.ownsRequest(requestScope, request)) commentReplyLoadingMap.value[safeCommentId] = false
    commentController.finishRequest(requestScope, request)
  }
}

function toggleCommentReplyComposer(commentId) {
  const safeCommentId = normalizeResourceId(commentId || 0)
  if (!safeCommentId) return
  const nextSet = new Set(commentReplyComposerIdSet.value)
  if (nextSet.has(safeCommentId)) {
    nextSet.delete(safeCommentId)
    commentReplyComposerIdSet.value = nextSet
    return
  }

  nextSet.add(safeCommentId)
  commentReplyComposerIdSet.value = nextSet
  if (!commentReplyPaginationMap.value[safeCommentId]) {
    void loadCommentReplies(safeCommentId, 1, { silent: true })
  }
}

async function loadMoreCommentReplies(commentId) {
  const safeCommentId = normalizeResourceId(commentId || 0)
  if (!safeCommentId) return
  const pagination = getCommentReplyPagination(safeCommentId)
  if (Number(pagination.page || 0) >= Number(pagination.totalPages || 0)) return
  await loadCommentReplies(safeCommentId, Number(pagination.page || 1) + 1)
}

async function submitCommentReply(comment) {
  const safeCommentId = normalizeResourceId(comment?.id || 0)
  if (!safeCommentId || isCommentReplySubmitting(safeCommentId)) return

  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('回复需要先登录，是否前往登录？', {
      title: '需要登录',
      icon: 'lock-keyhole',
      confirmText: '去登录',
      cancelText: '取消'
    })
    if (confirmed) goLogin()
    return
  }

  const content = String(commentReplyDraftMap.value[safeCommentId] || '').trim()
  if (content.length < 2 || content.length > 300) {
    toast.error('回复内容需为 2-300 个字符')
    return
  }

  commentReplySubmittingMap.value[safeCommentId] = true
  try {
    const result = await productStore.createProductCommentReply(safeCommentId, content)
    if (!result?.success) {
      const message = typeof result?.error === 'object'
        ? (result.error?.message || result.error?.code || '回复发布失败')
        : (result?.error || result?.message || '回复发布失败')
      toast.error(message)
      return
    }

    commentReplyDraftMap.value[safeCommentId] = ''
    const data = result?.data || {}
    updateCommentListItem(safeCommentId, (current) => ({
      ...current,
      replyCount: Number(data.replyCount ?? current.replyCount ?? 0)
    }))
    await loadCommentReplies(safeCommentId, 1, { force: true })
    toast.success(data.message || '回复已发布')
  } catch (error) {
    toast.error(`回复发布失败：${error.message}`)
  } finally {
    commentReplySubmittingMap.value[safeCommentId] = false
  }
}

async function submitComment() {
  if (!product.value?.id || commentSubmitting.value) return
  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('发布评论需要先登录，是否前往登录？', {
      title: '需要登录',
      icon: 'lock-keyhole',
      confirmText: '去登录',
      cancelText: '取消'
    })
    if (confirmed) goLogin()
    return
  }

  const content = commentDraft.value.trim()
  if (content.length < 5 || content.length > 500) {
    toast.error('评论内容需为 5-500 个字符')
    return
  }

  commentSubmitting.value = true
  try {
    const payload = { content }
    if (viewerHasPurchased.value && !viewerHasRated.value && selectedCommentRating.value !== null) {
      payload.rating = selectedCommentRating.value
    }
    const result = await productStore.createProductComment(product.value.id, payload)
    if (!result?.success) {
      const message = typeof result?.error === 'object'
        ? (result.error?.message || result.error?.code || '评论发布失败')
        : (result?.error || result?.message || '评论发布失败')
      toast.error(message)
      return
    }

    commentDraft.value = ''
    commentRatingDraft.value = null
    const tip = result?.data?.message || '评论已提交'
    toast.success(tip)
    await loadComments(1)
  } catch (error) {
    toast.error(`评论发布失败：${error.message}`)
  } finally {
    commentSubmitting.value = false
  }
}

async function deleteComment(comment) {
  if (!comment?.id || commentDeletingId.value) return
  const confirmed = await dialog.confirm('确定删除这条评论吗？删除后不可恢复。', {
    title: '删除评论',
    icon: 'trash-2',
    confirmText: '删除',
    cancelText: '取消'
  })
  if (!confirmed) return

  commentDeletingId.value = comment.id
  try {
    const result = await productStore.deleteProductComment(comment.id)
    if (!result?.success) {
      const message = typeof result?.error === 'object'
        ? (result.error?.message || result.error?.code || '删除评论失败')
        : (result?.error || result?.message || '删除评论失败')
      toast.error(message)
      return
    }
    toast.success(result?.data?.message || '评论已删除')
    const currentPage = Number(commentPagination.value.page || 1)
    const targetPage = commentList.value.length === 1 ? Math.max(1, currentPage - 1) : currentPage
    await loadComments(targetPage)
  } catch (error) {
    toast.error(`删除评论失败：${error.message}`)
  } finally {
    commentDeletingId.value = null
    commentActionMenuId.value = null
  }
}

async function openCommentReportModal(comment) {
  if (!comment?.id) return
  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('举报评论需要先登录，是否前往登录？', {
      title: '需要登录',
      icon: 'lock-keyhole',
      confirmText: '去登录',
      cancelText: '取消'
    })
    if (confirmed) goLogin()
    return
  }
  commentReportTarget.value = comment
  commentReportReason.value = ''
  commentActionMenuId.value = null
  showCommentReportModal.value = true
  syncModalState()
}

function closeCommentReportModal() {
  showCommentReportModal.value = false
  commentReportReason.value = ''
  commentReportTarget.value = null
  syncModalState()
}


function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else if (route.query.from) {
    router.push(String(route.query.from))
  } else {
    router.push({ name: 'Home' })
  }
}

function goToSeller() {
  const username = String(product.value?.sellerUsername || '').trim()
  if (!username) {
    toast.warning('商家主页暂不可用')
    return
  }
  router.push({
    name: 'MerchantProfile',
    params: { username },
    query: { site: product.value?.sellerSite || 'linux.do', userId: String(product.value?.sellerUserId || '') }
  })
}

async function toggleFavorite() {
  if (!product.value?.id || favoriteSubmitting.value) return

  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('收藏功能需要先登录，是否前往登录？', {
      title: '需要登录',
      icon: 'lock-keyhole',
      confirmText: '去登录',
      cancelText: '取消'
    })
    if (confirmed) {
      router.push({ name: 'Login', query: { redirect: route.fullPath } })
    }
    return
  }

  favoriteSubmitting.value = true
  try {
    const result = isFavorited.value
      ? await productStore.removeFavorite(product.value.id)
      : await productStore.addFavorite(product.value.id)

    if (!result?.success) {
      const message = typeof result?.error === 'object'
        ? (result.error?.message || result.error?.code || '操作失败，请稍后重试')
        : (result?.error || '操作失败，请稍后重试')
      toast.error(message)
      return
    }

    const nextState = !isFavorited.value
    product.value = {
      ...product.value,
      isFavorited: nextState
    }
    commentSummary.value = {
      ...commentSummary.value,
      favoriteCount: Math.max(0, Number(commentSummary.value.favoriteCount || 0) + (nextState ? 1 : -1))
    }

    toast.success(result?.data?.message || (nextState ? '收藏成功' : '已取消收藏'))
  } catch (error) {
    toast.error(error.message || '操作失败，请稍后重试')
  } finally {
    favoriteSubmitting.value = false
  }
}

async function markNotInterested() {
  if (!product.value?.id || favoriteSubmitting.value) return

  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('登录后才能管理不感兴趣的商品，是否前往登录？', {
      title: '需要登录',
      icon: 'lock-keyhole',
      confirmText: '去登录',
      cancelText: '取消'
    })
    if (confirmed) {
      router.push({ name: 'Login', query: { redirect: route.fullPath } })
    }
    return
  }

  const confirmed = await dialog.confirmDanger(
    '确认将这件商品标记为不感兴趣吗？<br><strong>确认后，它会从商品广场、搜索、分类、商家主页和热榜中隐藏；如已收藏也会同时取消。</strong>',
    {
      title: '标记为不感兴趣',
      confirmText: '确认隐藏',
      cancelText: '暂不处理'
    }
  )
  if (!confirmed) return

  favoriteSubmitting.value = true
  try {
    const result = await productStore.blockProduct(product.value.id)
    if (!result?.success) {
      const message = typeof result?.error === 'object'
        ? (result.error?.message || result.error?.code || '设置不感兴趣失败，请稍后重试')
        : (result?.error || '设置不感兴趣失败，请稍后重试')
      toast.error(message)
      return
    }

    toast.success(result?.message || result?.data?.message || '已标记为不感兴趣')
    await router.replace({ name: 'Home' })
  } catch (error) {
    toast.error(error.message || '设置不感兴趣失败，请稍后重试')
  } finally {
    favoriteSubmitting.value = false
  }
}

function handleImageError(e) {
  coverAspectRatio.value = null
  e.target.style.display = 'none'
}

// 图片预览
// 图片预览
function openImagePreview() {
  if (product.value?.imageUrl) {
    showImagePreview.value = true
    syncModalState()
  }
}

function closeImagePreview() {
  showImagePreview.value = false
  syncModalState()
}

function handleEscKey(e) {
  if (e.key === 'Escape') {
    if (showCommentReportModal.value) {
      closeCommentReportModal()
      return
    }
    if (showReportModal.value) {
      closeReportModal()
      return
    }
    if (showImagePreview.value) {
      closeImagePreview()
    }
  }
}

function syncModalState() {
  syncInteractionModalState()
}

async function openReportModal() {
  if (!product.value) return

  if (isSeller.value) {
    toast.error('不能举报自己的商品')
    return
  }

  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('举报商品需要先登录，是否前往登录？', {
      title: '需要登录',
      icon: 'lock-keyhole',
      confirmText: '去登录',
      cancelText: '取消'
    })
    if (confirmed) {
      router.push({ name: 'Login', query: { redirect: route.fullPath } })
    }
    return
  }

  showReportModal.value = true
  syncModalState()
}

function closeReportModal() {
  showReportModal.value = false
  syncModalState()
}


async function handleSubscribeRestock() {
  if (!product.value?.id || restockSubscribeLoading.value || restockStatusLoading.value || restockSubscribed.value) return
  if (!isCdk.value || !isOutOfStock.value) return

  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('请先登录后再订阅补货通知', {
      title: '需要登录',
      icon: 'lock-keyhole',
      confirmText: '去登录'
    })
    if (confirmed) {
      router.push({ name: 'Login', query: { redirect: route.fullPath } })
    }
    return
  }

  restockSubscribeLoading.value = true
  try {
    const result = await productStore.subscribeProductRestock(product.value.id)
    if (result?.success) {
      restockSubscribed.value = true
      toast.success(result?.data?.message || '订阅成功，补货后将通过系统消息通知你')
      return
    }

    const message = typeof result?.error === 'object'
      ? (result.error.message || result.error.code || '订阅失败')
      : (result?.error || '订阅失败')
    toast.error(message)
    await refreshRestockSubscriptionStatus()
  } catch (error) {
    toast.error(`订阅失败：${error.message}`)
  } finally {
    restockSubscribeLoading.value = false
  }
}

async function handleBlockedPurchaseByTrustLevel() {
  const message = purchaseTrustBlockMessage.value
  if (!message) return false

  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm(message, {
      title: '需要登录',
      icon: 'lock-keyhole',
      confirmText: '去登录'
    })
    if (confirmed) {
      router.push({ name: 'Login', query: { redirect: route.fullPath } })
    }
    return true
  }

  await dialog.alert(message, {
    title: '兑换受限',
    icon: 'shield-alert'
  })
  return true
}

async function openExternalProductLink() {
  const preparedWindow = prepareNewTab()

  try {
    const result = await fetchExternalProductLinkRequest(product.value?.id)
    if (result?.success && result.data?.paymentLink) {
      const opened = openInNewTab(result.data.paymentLink, preparedWindow)
      if (!opened) {
        cleanupPreparedTab(preparedWindow)
      }
      return
    }

    cleanupPreparedTab(preparedWindow)
    toast.error(result?.error || '打开外链失败')
  } catch (error) {
    cleanupPreparedTab(preparedWindow)
    toast.error(`打开外链失败：${error.message}`)
  }
}

async function handleBuyProduct() {
  if (isOrderCreationMaintenanceBlocked.value) {
    toast.warning(maintenancePurchaseHint.value || '当前暂不支持创建新订单')
    return
  }

  if (purchaseLimitReached.value) {
    toast.warning(exchangeQuantityText.value)
    return
  }

  const existingDraft = checkoutStore.getDraft(product.value.id)
  const quantity = existingDraft?.quantity || 1
  const checkoutLocation = {
    name: 'OrderConfirm',
    params: { productId: product.value.id }
  }
  checkoutStore.startCheckout({
    productId: product.value.id,
    quantity,
    sourceFullPath: route.fullPath,
    sourceScrollY: window.scrollY || 0
  })

  // 检查登录；登录成功后直接回到确认订单页，不让用户重复点击。
  if (!userStore.isLoggedIn) {
    const message = purchaseTrustLevel.value > 0
      ? `该商品需登录且信任等级达到 TL${purchaseTrustLevel.value} 才可兑换`
      : '请先登录后再兑换物品'
    const confirmed = await dialog.confirm(message, {
      title: '需要登录',
      icon: 'lock-keyhole',
      confirmText: '去登录'
    })
    if (confirmed) {
      router.push({
        name: 'Login',
        query: { redirect: router.resolve(checkoutLocation).fullPath }
      })
    }
    return
  }

  if (!canPurchaseByTrustLevel.value) {
    await handleBlockedPurchaseByTrustLevel()
    return
  }
  
  if (isOutOfStock.value || !canPurchase.value) {
    toast.error('当前商品暂不可购买')
    return
  }

  purchasing.value = true
  try {
    await router.push(checkoutLocation)
  } finally {
    purchasing.value = false
  }
}

async function handleOpenStore() {
  if (!canPurchaseByTrustLevel.value) {
    await handleBlockedPurchaseByTrustLevel()
    return
  }
  await openExternalProductLink()
}

</script>

<style scoped>
.detail-page {
  min-height: 100vh;
}

.page-container {
  max-width: 900px;
  padding-bottom: 100px;
}

.loading-state {
  padding: 40px 0;
}

/* 顶部导航 */
.detail-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.back-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

/* 宽屏徽章组靠右、位于按钮组左侧；空间不足时标签可换行，操作按钮保持一组 */
.nav-tags {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
}

/* 窄屏第一行返回+按钮组靠右，后续类别徽章左对齐；
   flex-basis 100% 强制徽章组换行，避免临界宽度时挤回单行 */
@media (max-width: 767px) {
  .nav-actions {
    order: 1;
    margin-left: auto;
  }

  .nav-tags {
    order: 2;
    margin-left: 0;
    flex-basis: 100%;
  }
}

.nav-favorite-btn,
.nav-block-btn,
.nav-report-btn {
  min-height: 34px;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.nav-favorite-btn {
  border: 1px solid var(--palette-hex-e4cad0);
  background: var(--palette-hex-fff4f6);
  color: var(--palette-hex-b16472);
}

.nav-favorite-btn:hover {
  background: var(--palette-hex-feecef);
  border-color: var(--palette-hex-dbaab5);
}

.nav-favorite-btn.active {
  background: var(--palette-hex-fce5ea);
  border-color: var(--palette-hex-d98f9f);
  color: var(--palette-hex-9f4258);
}

.nav-favorite-btn:disabled,
.nav-block-btn:disabled,
.nav-report-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.nav-block-btn {
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-tertiary);
}

.nav-block-btn:hover {
  background: var(--palette-rgba-220-38-38-0p08);
  border-color: var(--palette-rgba-220-38-38-0p3);
  color: var(--color-danger);
}

.nav-favorite-btn:focus-visible,
.nav-block-btn:focus-visible,
.nav-report-btn:focus-visible {
  outline: 3px solid var(--palette-rgba-99-102-241-0p2);
  outline-offset: 2px;
}

.nav-report-btn {
  border: 1px solid var(--palette-rgba-234-179-8-0p35);
  background: var(--palette-rgba-250-204-21-0p16);
  color: var(--palette-hex-8a6500);
}

.nav-report-btn:hover {
  background: var(--palette-rgba-250-204-21-0p24);
  border-color: var(--palette-rgba-234-179-8-0p5);
  color: var(--palette-hex-6f5200);
}

.nav-category {
  max-width: 100%;
  overflow-wrap: anywhere;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border-radius: 20px;
  font-size: 13px;
  color: var(--text-secondary);
}

.nav-type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.nav-type.cdk {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.nav-type.store {
  background: var(--color-success-bg);
  color: var(--color-success);
}

/* 主内容区 - 桌面端左右布局 */
.detail-main {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  background: var(--bg-card);
  border-radius: var(--card-radius);
  padding: var(--detail-pad);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  margin-bottom: 20px;
}

.detail-main--landscape {
  grid-template-areas:
    'name'
    'price'
    'status'
    'media'
    'side';
}

@media (min-width: 768px) {
  .detail-main {
    grid-template-columns: 1fr 1fr;
  }

  .detail-main--landscape {
    grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.9fr);
    grid-template-areas:
      'name name'
      'price price'
      'status status'
      'media side';
    align-items: start;
  }
}

/* 媒体区域 */
.detail-media {
  display: flex;
  justify-content: center;
  align-items: center;
}

.detail-main--landscape .detail-media {
  grid-area: media;
  align-self: start;
  justify-content: flex-start;
  align-items: flex-start;
}

.media-wrapper {
  position: relative;
  width: 100%;
  max-width: 400px;
  min-height: 200px;
  max-height: 500px;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: color var(--motion-duration-standard) var(--motion-ease-standard), background-color var(--motion-duration-standard) var(--motion-ease-standard), border-color var(--motion-duration-standard) var(--motion-ease-standard), box-shadow var(--motion-duration-standard) var(--motion-ease-standard), opacity var(--motion-duration-standard) var(--motion-ease-standard), transform var(--motion-duration-standard) var(--motion-ease-standard);
}

.detail-main--landscape .media-wrapper {
  max-width: 100%;
}

.media-wrapper:hover {
  transform: scale(1.02);
  box-shadow: 0 8px 24px var(--palette-rgba-0-0-0-0p1);
}

.media-zoom-hint {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
  background: linear-gradient(transparent, var(--palette-rgba-0-0-0-0p5));
  color: var(--palette-hex-ffffff);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.3s;
}

.media-wrapper:has(.media-image):hover .media-zoom-hint {
  opacity: 1;
}

/* 图片预览弹窗 */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: var(--palette-rgba-0-0-0-0p9);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.preview-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  background: var(--palette-rgba-255-255-255-0p1);
  border: none;
  border-radius: 50%;
  color: var(--palette-hex-ffffff);
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
  z-index: 10;
}

.preview-close:hover {
  background: var(--palette-rgba-255-255-255-0p2);
  transform: scale(1.1);
}

.preview-image {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  animation: zoomIn 0.3s ease;
}

@keyframes zoomIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.preview-hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: var(--palette-rgba-255-255-255-0p6);
  font-size: 13px;
}

.report-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--palette-rgba-0-0-0-0p55);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

 .report-modal {
  width: min(640px, 96vw);
  max-height: 90vh;
  overflow: auto;
  background: var(--bg-card);
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--border-light) 75%, transparent);
  box-shadow: 0 24px 80px var(--palette-rgba-0-0-0-0p22);
  padding: 20px;
}

.report-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.report-modal-header h3 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.report-modal-close {
  width: 44px;
  height: 44px;
  border: 1px solid var(--border-light);
  border-radius: 50%;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.report-modal-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.report-modal-desc {
  margin: 12px 0 16px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.report-form-card {
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--border-light) 80%, transparent);
  border-radius: 16px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 92%, var(--palette-hex-ffffff) 8%) 0%, var(--bg-primary) 100%);
  box-shadow: inset 0 1px 0 var(--palette-rgba-255-255-255-0p05);
}

.report-field-label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.report-select-wrap {
  margin-bottom: 14px;
}

.report-textarea-wrap {
  display: flex;
  flex-direction: column;
}

.report-select-shell {
  position: relative;
}

.report-select-shell::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 14px;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--text-tertiary);
  border-bottom: 2px solid var(--text-tertiary);
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
}

.report-select {
  width: 100%;
  padding: 12px 40px 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-light);
  background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-primary) 100%);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  box-shadow: inset 0 1px 0 var(--palette-rgba-255-255-255-0p04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.report-select:hover {
  border-color: color-mix(in srgb, var(--color-primary, var(--palette-hex-c4612f)) 35%, var(--border-light));
}

.report-select:focus {
  outline: none;
  border-color: var(--color-primary, var(--palette-hex-c4612f));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, var(--palette-hex-c4612f)) 18%, transparent);
}

.report-textarea {
  width: 100%;
  min-height: 136px;
  resize: vertical;
  padding: 14px 15px;
  border-radius: 14px;
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.7;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.report-textarea::placeholder {
  color: var(--text-tertiary);
}

.report-textarea:hover {
  border-color: color-mix(in srgb, var(--color-primary, var(--palette-hex-c4612f)) 24%, var(--border-light));
}

.report-textarea:focus {
  outline: none;
  border-color: var(--color-primary, var(--palette-hex-c4612f));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, var(--palette-hex-c4612f)) 14%, transparent);
}

.report-quick-section {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-secondary) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-light) 70%, transparent);
}

.report-quick-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.report-quick-list {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.report-quick-item {
  border: 1px solid color-mix(in srgb, var(--border-light) 75%, transparent);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.report-quick-item:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--color-primary, var(--palette-hex-c4612f)) 28%, var(--border-light));
  background: color-mix(in srgb, var(--color-primary, var(--palette-hex-c4612f)) 8%, var(--bg-card));
  color: var(--text-primary);
  box-shadow: 0 6px 18px var(--palette-rgba-0-0-0-0p08);
}

.report-modal-footer {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--border-light) 78%, transparent);
}

.report-count {
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.6;
}

.report-count.is-invalid {
  color: var(--palette-hex-c4612f);
}

.report-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.report-cancel-btn,
.report-submit-btn {
  min-width: 92px;
  border-radius: 12px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease, opacity 0.2s ease;
}

.report-cancel-btn {
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.report-cancel-btn:hover {
  transform: translateY(-1px);
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.report-submit-btn {
  border: 1px solid transparent;
  background: linear-gradient(135deg, var(--palette-hex-c4612f) 0%, var(--palette-hex-991b1b) 100%);
  color: var(--palette-hex-ffffff);
  box-shadow: 0 10px 24px var(--palette-rgba-185-28-28-0p24);
}

.report-submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 14px 28px var(--palette-rgba-185-28-28-0p28);
}

.report-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

@media (max-width: 639px) {
  .report-modal {
    padding: 16px;
    border-radius: 18px;
  }

  .report-form-card,
  .report-quick-section {
    padding: 14px;
  }

  .report-modal-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .report-actions {
    width: 100%;
    justify-content: stretch;
  }

  .report-cancel-btn,
  .report-submit-btn {
    flex: 1;
  }
}

/* 没有图片时使用正方形占位 */
.media-wrapper:has(.media-placeholder) {
  aspect-ratio: 1 / 1;
}

.media-image {
  width: 100%;
  height: auto;
  max-height: 500px;
  object-fit: contain;
  background: var(--bg-secondary);
}

.media-placeholder {
  color: var(--text-tertiary);
  opacity: 0.6;
}

.discount-tag {
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(135deg, var(--palette-hex-ad9090) 0%, var(--palette-hex-937474) 100%);
  color: var(--palette-hex-ffffff);
  font-size: 13px;
  font-weight: 700;
  padding: 8px 12px;
  border-radius: 10px;
}

/* 信息面板 */
.detail-info-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-side-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-main--landscape .detail-info-panel {
  display: contents;
}

.detail-name {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.4;
}

.detail-main--landscape .detail-name {
  grid-area: name;
}

@media (min-width: 768px) {
  .detail-name {
    font-size: 26px;
  }
}

/* 价格区域 */
.price-section {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--palette-hex-fef9f3) 0%, var(--palette-hex-fdf6ee) 100%);
  border-radius: 14px;
}

.detail-main--landscape .price-section {
  grid-area: price;
  justify-self: stretch;
  width: 100%;
  max-width: none;
}

.price-main {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-warning);
}

.price-main .unit {
  font-size: 16px;
  font-weight: 500;
}

.price-main.discounted {
  color: var(--color-danger);
}

.price-original {
  font-size: 16px;
  color: var(--text-tertiary);
  text-decoration: line-through;
}

/* 状态信息 */
.status-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 16px;
}

.detail-main--landscape .status-row {
  grid-area: status;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-secondary);
}

.status-icon {
  flex: 0 0 auto;
}

.status-text.low {
  color: var(--color-danger);
  font-weight: 500;
}

.status-item.hot .status-text {
  color: var(--color-warning);
  font-weight: 500;
}

/* 兑换条件 */
.purchase-conditions {
  padding: 13px;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--glass-bg-medium);
}

.purchase-conditions-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--color-primary-hover);
}

.purchase-conditions-heading h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.4;
}

.purchase-condition-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.purchase-condition-item {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 7px;
  min-height: 92px;
  padding: 9px 8px;
  border-radius: 12px;
  background: var(--bg-secondary);
}

.purchase-condition-icon {
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--color-primary-light);
  color: var(--color-primary-hover);
}

.purchase-condition-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.purchase-condition-copy small {
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.3;
}

.purchase-condition-copy strong {
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.purchase-limit-order-link {
  width: fit-content;
  margin-top: 3px;
  color: var(--color-info);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  text-decoration: none;
}

.purchase-limit-release-hint {
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.45;
}

.purchase-limit-order-link:hover,
.purchase-limit-order-link:focus-visible {
  text-decoration: underline;
}

.purchase-condition-item.is-satisfied .purchase-condition-icon {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.purchase-condition-item.is-blocked .purchase-condition-icon,
.purchase-condition-item.is-blocked .purchase-condition-copy strong {
  color: var(--color-danger);
}

.purchase-condition-item.is-blocked .purchase-condition-icon {
  background: var(--color-danger-bg);
}

.maintenance-order-notice {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--palette-rgba-245-158-11-0p12);
  border: 1px solid var(--palette-rgba-245-158-11-0p24);
  color: var(--palette-hex-b45309);
  font-size: 13px;
  line-height: 1.6;
}

/* 卖家卡片 */
.seller-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 15px;
  background: var(--bg-secondary);
  border-radius: 14px;
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.seller-card:hover {
  background: var(--bg-tertiary);
  transform: translateY(-1px);
}

.seller-card.disabled {
  cursor: default;
}

.seller-card.disabled:hover {
  background: var(--bg-secondary);
  transform: none;
}

.seller-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.seller-content {
  flex: 1;
  min-width: 0;
}

.seller-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.seller-texts {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  padding: 1px 0;
}

.seller-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 6px;
  align-self: stretch;
  flex-shrink: 0;
  padding: 1px 0;
}

.seller-display-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.seller-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.seller-name--secondary {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.seller-trust-badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-end;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
  box-shadow: inset 0 0 0 1px var(--palette-rgba-255-255-255-0p28);
}

.seller-trust-badge--0 { background: linear-gradient(135deg, var(--palette-hex-eef1f5), var(--palette-hex-e4e8ed)); color: var(--palette-hex-596172); }
.seller-trust-badge--1 { background: linear-gradient(135deg, var(--palette-hex-edf4ff), var(--palette-hex-dbeafe)); color: var(--palette-hex-1d4ed8); }
.seller-trust-badge--2 { background: linear-gradient(135deg, var(--palette-hex-edf9f1), var(--palette-hex-dcfce7)); color: var(--palette-hex-15803d); }
.seller-trust-badge--3 { background: linear-gradient(135deg, var(--palette-hex-fbf4e6), var(--palette-hex-fef3c7)); color: var(--palette-hex-a16207); }
.seller-trust-badge--4 { background: linear-gradient(135deg, var(--palette-hex-fbecec), var(--palette-hex-fee2e2)); color: var(--palette-hex-c4612f); }

:global(html.dark .detail-page .seller-trust-badge) {
  box-shadow: inset 0 0 0 1px var(--palette-rgba-255-255-255-0p08);
}

:global(html.dark .detail-page .seller-trust-badge--0) { background: linear-gradient(135deg, var(--palette-hex-2f3134), var(--palette-hex-3a3d42)); color: var(--palette-hex-d5d9e1); }
:global(html.dark .detail-page .seller-trust-badge--1) { background: linear-gradient(135deg, var(--palette-hex-243149), var(--palette-hex-1e3a5f)); color: var(--palette-hex-bfdbfe); }
:global(html.dark .detail-page .seller-trust-badge--2) { background: linear-gradient(135deg, var(--palette-hex-21352c), var(--palette-hex-1f4d34)); color: var(--palette-hex-bbf7d0); }
:global(html.dark .detail-page .seller-trust-badge--3) { background: linear-gradient(135deg, var(--palette-hex-3a3123), var(--palette-hex-57441c)); color: var(--palette-hex-fde68a); }
:global(html.dark .detail-page .seller-trust-badge--4) { background: linear-gradient(135deg, var(--palette-hex-3d2428), var(--palette-hex-5b1d22)); color: var(--palette-hex-fecaca); }

.seller-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: auto;
  line-height: 1.2;
  text-align: right;
}

/* 妗岄潰绔喘涔版寜閽?*/
.action-section {
  margin-top: auto;
  padding-top: 10px;
}

.purchase-next-step-hint {
  margin: 9px 0 0;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
}

.detail-main--landscape .detail-side-panel {
  grid-area: side;
  min-width: 0;
  gap: 16px;
}

.buy-action-row {
  display: flex;
  align-items: stretch;
  gap: 10px;
}

.buy-action-row .buy-btn {
  flex: 1;
  width: auto;
  min-width: 0;
}

.desktop-only {
  display: none;
}

@media (min-width: 768px) {
  .desktop-only {
    display: block;
  }
}

/* 描述区域 */
.detail-description {
  background: var(--bg-card);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.description-content {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

/* markdown 渲染：换行由 <br>/块级元素承担，不再依赖 pre-wrap */
.description-content.markdown-content {
  white-space: normal;
}

.detail-comments {
  margin-top: 20px;
  background: var(--bg-card);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}

.detail-comment-summary {
  margin-top: 20px;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 20px;
  border: 1px solid var(--palette-rgba-207-167-111-0p22);
  background:
    radial-gradient(circle at top right, var(--palette-rgba-207-167-111-0p16), transparent 34%),
    linear-gradient(135deg, var(--palette-rgba-255-247-237-0p96), var(--palette-rgba-250-245-235-0p92));
  box-shadow: var(--shadow-sm);
}

.comment-summary-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-summary-stars {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--palette-hex-8a5a20);
}

.comment-summary-stars strong {
  font-size: 24px;
  font-weight: 700;
  color: var(--palette-hex-7a4a18);
}

.comment-summary-text {
  font-size: 14px;
  line-height: 1.7;
  color: var(--palette-hex-86613b);
}

.comment-summary-side {
  display: flex;
  gap: 12px;
}

.comment-summary-metric {
  min-width: 108px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--palette-rgba-255-255-255-0p7);
  border: 1px solid var(--palette-rgba-207-167-111-0p18);
  color: var(--palette-hex-7a4a18);
}

.comment-summary-metric strong {
  font-size: 22px;
  font-weight: 700;
}

.comment-summary-metric-label {
  font-size: 12px;
  color: var(--palette-hex-9c7852);
}

.comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.comment-header-title {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.comment-header .section-title {
  margin-bottom: 0;
  border-bottom: none;
  padding-bottom: 0;
}

.comment-total-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--palette-rgba-38-111-63-0p12);
  color: var(--palette-hex-266f3f);
  font-size: 12px;
  font-weight: 700;
}

.comment-refresh-btn {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.comment-refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.comment-empty {
  margin-top: 16px;
  border: 1px dashed var(--border-light);
  border-radius: 12px;
  padding: 18px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

.comment-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comment-item {
  position: relative;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--bg-secondary);
  padding: 12px;
}

.comment-meta-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.comment-user {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.comment-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.comment-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.comment-username {
  font-size: 12px;
  color: var(--text-tertiary);
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.comment-seller-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--palette-hex-ffe1ea);
  color: var(--palette-hex-d85d7f);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.comment-seller-tag--reply {
  font-size: 10px;
}

.comment-purchased-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--palette-hex-e8f6e8);
  color: var(--palette-hex-2f855a);
  font-size: 11px;
  font-weight: 600;
}

.comment-rating-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.comment-rating-tag {
  background: var(--palette-rgba-245-158-11-0p12);
  color: var(--palette-hex-b45309);
}

.comment-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}

.comment-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.comment-action-wrap {
  position: relative;
}

.comment-action-btn {
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  line-height: 1;
  width: 36px;
  height: 36px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.comment-action-btn:not(:disabled):hover {
  color: var(--text-secondary);
  background: var(--bg-secondary);
}

.comment-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.comment-action-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  min-width: 96px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  box-shadow: var(--shadow-md);
  z-index: 20;
  overflow: hidden;
}

.comment-action-item {
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

.comment-action-item:hover {
  background: var(--bg-secondary);
}

.comment-action-item.danger {
  color: var(--color-danger);
}

.comment-action-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.comment-content {
  margin-top: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.comment-inline-status-tag {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--palette-rgba-59-130-246-0p1);
  color: var(--palette-hex-1d4ed8);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.comment-inline-status-tag--rejected {
  background: var(--palette-rgba-220-38-38-0p1);
  color: var(--palette-hex-c4612f);
}

.comment-footer {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.comment-footer-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.comment-footer-btn {
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--text-tertiary);
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.comment-footer-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.comment-footer-btn:not(:disabled):hover {
  color: var(--text-secondary);
  background: var(--bg-secondary);
}

.comment-reply-btn {
  border-color: var(--border-light);
}

.comment-reply-btn.active {
  background: var(--palette-rgba-38-111-63-0p1);
  color: var(--palette-hex-266f3f);
  border-color: var(--palette-rgba-38-111-63-0p22);
}

.comment-vote-btn {
  min-width: 56px;
  justify-content: center;
}

.comment-vote-icon {
  flex: 0 0 auto;
}

.comment-vote-btn.active {
  background: var(--palette-rgba-38-111-63-0p12);
  color: var(--palette-hex-266f3f);
  border-color: var(--palette-rgba-38-111-63-0p25);
}

.comment-reply-panel {
  margin-top: 10px;
  border-top: 1px dashed var(--border-light);
  padding-top: 10px;
}

.comment-reply-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-reply-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-card);
  padding: 8px 10px;
}

.comment-reply-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.comment-reply-body {
  min-width: 0;
  flex: 1;
}

.comment-reply-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.comment-reply-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.comment-reply-username,
.comment-reply-time {
  font-size: 11px;
  color: var(--text-tertiary);
}

.comment-reply-content {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.comment-reply-empty {
  border: 1px dashed var(--border-light);
  border-radius: 10px;
  padding: 10px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

.comment-reply-more-btn {
  border: none;
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  padding: 2px 0;
  cursor: pointer;
  text-align: left;
}

.comment-reply-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.comment-reply-compose {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-light);
}

.comment-reply-login-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.comment-reply-textarea {
  width: 100%;
  min-height: 72px;
  resize: vertical;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.6;
}

.comment-reply-compose-footer {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.comment-pagination {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.comment-page-btn {
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: 9px;
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  font-size: 13px;
  cursor: pointer;
}

.comment-page-btn.active {
  background: var(--color-primary);
  color: var(--palette-hex-ffffff);
  border-color: var(--color-primary);
}

.comment-page-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.comment-compose {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.comment-compose-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.comment-login-tip {
  font-size: 13px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 10px;
}

.comment-login-btn {
  border: none;
  border-radius: 8px;
  background: var(--color-primary);
  color: var(--palette-hex-ffffff);
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
}

.comment-rating-field {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-rating-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.comment-rating-control {
  width: fit-content;
  max-width: 100%;
  align-self: flex-start;
}

.comment-rating-once-tip {
  font-size: 12px;
  line-height: 1.6;
  color: var(--palette-hex-b45309);
}

.comment-rating-tip {
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary);
}

.comment-rating-tip-locked {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.comment-rating-tip-value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--palette-hex-b45309);
}

.comment-rating-tip-value strong {
  font-size: 12px;
  font-weight: 700;
}

.comment-textarea {
  width: 100%;
  min-height: 100px;
  resize: vertical;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.6;
}

.comment-compose-footer {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.comment-count {
  font-size: 12px;
  color: var(--text-tertiary);
}

.comment-submit-btn {
  border: none;
  border-radius: 10px;
  background: var(--palette-hex-266f3f);
  color: var(--palette-hex-ffffff);
  padding: 10px 14px;
  font-size: 14px;
  cursor: pointer;
}

.comment-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 移动端底部按钮 */
.action-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0));
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--border-light);
  z-index: 100;
}

.action-bottom .purchase-next-step-hint {
  margin: 8px 0 0;
}

.mobile-only {
  display: block;
}

@media (min-width: 768px) {
  .mobile-only {
    display: none;
  }
  
  .page-container {
    padding-bottom: 40px;
  }
}

/* 购买按钮 */
.buy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 16px 24px;
  background: linear-gradient(135deg, var(--palette-hex-cfa76f) 0%, var(--palette-hex-bd8d57) 100%);
  color: var(--palette-hex-ffffff);
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  text-decoration: none;
  transition: color var(--motion-duration-fast) var(--motion-ease-standard), background-color var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-fast) var(--motion-ease-standard), opacity var(--motion-duration-fast) var(--motion-ease-standard), transform var(--motion-duration-fast) var(--motion-ease-standard);
}

.buy-btn:hover {
  opacity: 0.92;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--palette-rgba-207-167-111-0p3);
}

.buy-btn.store {
  background: linear-gradient(135deg, var(--palette-hex-06b6d4) 0%, var(--palette-hex-0891b2) 100%);
}

.buy-btn.store:hover {
  box-shadow: 0 4px 12px var(--palette-rgba-6-182-212-0p3);
}

.buy-btn.restock {
  background: var(--publish-btn-bg);
  color: var(--publish-btn-color);
  border: 1px solid transparent;
  box-shadow: var(--publish-btn-shadow);
}

.buy-btn.restock:hover {
  opacity: 1;
  background: var(--publish-btn-hover-bg);
  box-shadow: var(--publish-btn-hover-shadow);
}

.buy-btn.restock.subscribed {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-color: var(--border-medium);
  box-shadow: none;
}

.buy-btn.restock:disabled {
  transform: none;
}

.buy-btn.restock.subscribed:disabled {
  opacity: 1;
  cursor: default;
}

.buy-btn.disabled {
  background: var(--palette-hex-999999);
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.buy-btn.disabled.test-only {
  background: linear-gradient(135deg, var(--palette-hex-06b6d4) 0%, var(--palette-hex-0891b2) 100%);
  opacity: 0.6;
}

.buy-btn.test {
  background: linear-gradient(135deg, var(--palette-hex-06b6d4) 0%, var(--palette-hex-0891b2) 100%);
}

.buy-btn.test:hover {
  box-shadow: 0 4px 12px var(--palette-rgba-6-182-212-0p3);
}

/* 测试模式横幅 */
.test-mode-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--palette-hex-ecfeff) 0%, var(--palette-hex-cffafe) 100%);
  border: 1px solid var(--palette-hex-a5f3fc);
  border-radius: 12px;
  margin-bottom: 0;
}

.detail-test-banner-landscape {
  display: none;
}

.detail-main--landscape .detail-test-banner {
  display: none;
}

.detail-main--landscape .detail-test-banner-landscape {
  display: flex;
}

.test-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(135deg, var(--palette-hex-06b6d4) 0%, var(--palette-hex-0891b2) 100%);
  color: var(--palette-hex-ffffff);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.test-desc {
  font-size: 13px;
  color: var(--palette-hex-0891b2);
}

/* 移动端适配 */
@media (max-width: 639px) {
  .page-container {
    padding-bottom: 116px;
  }
  
  .detail-nav {
    margin-bottom: 16px;
  }

  .back-btn {
    align-self: flex-start;
    padding: 12px 14px;
    min-height: 44px;
  }

  /* 手机端仅展示图标，文字改用 sr-only 保留给屏幕阅读器 */
  .back-btn span {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .nav-favorite-btn,
  .nav-block-btn,
  .nav-report-btn {
    min-height: 44px;
  }

  .detail-name {
    font-size: 20px;
  }

  .price-main {
    font-size: 28px;
  }
  
  .media-wrapper {
    max-width: 100%;
    max-height: 350px;
  }
  
  .media-image {
    max-height: 350px;
  }
  
  .detail-description {
    padding: 20px;
  }

  .detail-comments {
    margin-top: 16px;
    padding: 14px;
    border-radius: 16px;
  }

  .detail-comment-summary {
    margin-top: 16px;
    padding: 14px;
    border-radius: 16px;
    flex-direction: column;
    gap: 12px;
  }

  .comment-summary-stars strong {
    font-size: 20px;
  }

  .comment-summary-side {
    width: 100%;
  }

  .comment-summary-metric {
    flex: 1;
    min-width: 0;
    padding: 10px 12px;
  }

  .comment-header .section-title {
    font-size: 18px;
  }

  .comment-header-title {
    gap: 8px;
  }

  .comment-total-tag {
    min-width: 28px;
    height: 22px;
    padding: 0 8px;
    font-size: 11px;
  }

  .comment-refresh-btn {
    padding: 6px 10px;
    min-height: 32px;
    border-radius: 8px;
  }

  .comment-list {
    margin-top: 12px;
    gap: 10px;
  }

  .comment-item {
    padding: 10px;
    border-radius: 12px;
  }

  .comment-meta-line {
    align-items: flex-start;
    gap: 8px;
  }

  .comment-user {
    flex: 1;
    flex-wrap: wrap;
    gap: 6px;
  }

  .comment-avatar {
    width: 26px;
    height: 26px;
  }

  .comment-name,
  .comment-username {
    max-width: none;
  }

  .comment-name {
    font-size: 12px;
  }

  .comment-username {
    font-size: 11px;
  }

  .comment-purchased-tag {
    padding: 2px 6px;
    font-size: 10px;
  }

  .comment-rating-tag {
    padding: 2px 6px;
    font-size: 10px;
  }

  .comment-right {
    padding-top: 2px;
  }

  .comment-action-btn {
    min-width: 30px;
    min-height: 30px;
    padding: 4px 6px;
    font-size: 18px;
  }

  .comment-content {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.65;
  }

  .comment-inline-status-tag {
    margin-left: 6px;
    padding: 2px 6px;
    font-size: 11px;
  }

  .comment-footer {
    margin-top: 8px;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .comment-time {
    font-size: 11px;
  }

  .comment-footer-actions {
    width: 100%;
    flex-wrap: wrap;
    gap: 6px;
  }

  .comment-footer-btn {
    min-height: 30px;
    padding: 0 10px;
    font-size: 12px;
  }

  .comment-reply-btn {
    flex: 1 1 auto;
    justify-content: center;
  }

  .comment-vote-btn {
    min-width: 64px;
    justify-content: center;
  }

  .comment-reply-panel {
    margin-top: 8px;
    padding-top: 8px;
  }

  .comment-reply-list {
    gap: 6px;
  }

  .comment-reply-item {
    padding: 8px;
    gap: 6px;
  }

  .comment-reply-avatar {
    width: 22px;
    height: 22px;
  }

  .comment-reply-content {
    font-size: 12px;
  }

  .comment-reply-textarea {
    min-height: 64px;
    font-size: 12px;
  }

  .comment-compose {
    margin-top: 14px;
    padding-top: 14px;
  }

  .comment-compose-title {
    font-size: 13px;
  }

  .comment-textarea {
    min-height: 88px;
    font-size: 13px;
  }

  .comment-rating-field {
    margin-bottom: 10px;
  }

  .comment-submit-btn,
  .comment-login-btn {
    min-height: 34px;
  }

  .purchase-conditions {
    padding: 12px;
  }

  .purchase-condition-list {
    gap: 6px;
  }

  .purchase-condition-item {
    min-height: 88px;
    padding: 8px 6px;
  }

  .purchase-condition-copy strong {
    font-size: 11px;
  }

}
</style>
