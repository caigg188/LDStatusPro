<template>
  <div class="detail-page">
    <div class="page-container">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <Skeleton type="detail" />
      </div>
      
      <!-- 物品详情 -->
      <template v-else-if="product">
        <!-- 顶部导航 -->
        <div class="detail-nav">
          <button class="back-btn" @click="goBack">
            ← 返回
          </button>
                    <div class="nav-right">
            <div class="nav-tags">
                          <span class="nav-category">{{ categoryIcon }} {{ categoryName }}</span>
                          <span v-if="isCdk" class="nav-type cdk">🎫 CDK自动发货</span>
                          <span v-else-if="isStore" class="nav-type store">🏬 友情小店</span>
                        </div>
            <button
              class="nav-favorite-btn"
              :class="{ active: isFavorited }"
              :disabled="favoriteSubmitting"
              @click="toggleFavorite"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  d="M12 21s-7.2-4.35-9.6-8.4C.4 9.29 1.24 5.9 4.06 4.34A5.43 5.43 0 0 1 12 6.2a5.43 5.43 0 0 1 7.94-1.86c2.82 1.56 3.66 4.95 1.66 8.26C19.2 16.65 12 21 12 21z"
                  :fill="isFavorited ? 'currentColor' : 'none'"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>{{ isFavorited ? '已收藏' : '收藏' }}</span>
            </button>
            <button
              class="nav-report-btn"
              :disabled="reportSubmitting"
              @click="openReportModal"
            >
              &#128680; &#20030;&#25253;
            </button>
          </div>
        </div>
        
        <!-- 主内容区 -->
        <div class="detail-main">
          <!-- 左侧：图片 -->
          <div class="detail-media">
            <div class="media-wrapper" :style="coverStyle" @click="openImagePreview">
              <img
                v-if="product.image_url"
                :src="product.image_url"
                :alt="product.name"
                class="media-image"
                @error="handleImageError"
              />
              <span v-else class="media-placeholder">{{ categoryIcon }}</span>
              <!-- 折扣标签 -->
              <span v-if="hasDiscount" class="discount-tag">
                -{{ discountPercent }}%
              </span>
            </div>
          </div>
          
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
            <div v-if="isTestMode" class="test-mode-banner">
              <span class="test-badge">🧪 测试模式</span>
              <span class="test-desc">{{ isSeller ? '只有您可以购买此物品' : '该物品为测试模式，仅卖家可购买' }}</span>
            </div>
            
            <!-- 物品状态信息 -->
            <div class="status-row">
              <div class="status-item">
                <span class="status-icon">👁</span>
                <span class="status-text">{{ product.view_count || 0 }} 浏览</span>
              </div>
              <div v-if="isCdk" class="status-item">
                <span class="status-icon">📦</span>
                <span :class="['status-text', { low: isOutOfStock }]">库存 {{ stockDisplay }}</span>
              </div>
              <div v-if="isCdk && soldCount > 0" class="status-item hot">
                <span class="status-icon">🔥</span>
                <span class="status-text">已售 {{ soldCount }}</span>
              </div>
              <div v-if="purchaseTrustLevel > 0" class="status-item">
                <span class="status-icon">🔐</span>
                <span :class="['status-text', { low: !canPurchaseByTrustLevel }]">
                  兑换需 TL{{ purchaseTrustLevel }}
                </span>
              </div>
              <div class="status-item">
                <span class="status-icon">📅</span>
                <span class="status-text">{{ updateTime }}</span>
              </div>
            </div>
            
            <div
              v-if="isCdk && !isOutOfStock && canPurchase && (!isTestMode || isSeller)"
              class="quantity-section"
            >
              <div class="quantity-title">购买数量</div>
              <div class="quantity-controls">
                <button type="button" class="qty-btn" @click="decreaseQuantity">-</button>
                <input
                  v-model.number="selectedQuantity"
                  type="number"
                  min="1"
                  :max="maxSelectableQuantity"
                  class="qty-input"
                  @input="handleQuantityInput"
                />
                <button type="button" class="qty-btn" @click="increaseQuantity">+</button>
              </div>
              <div class="quantity-summary">预计支付 {{ totalPrice }} LDC</div>
              <div v-if="quantityHint" class="quantity-hint">{{ quantityHint }}</div>
            </div>

            <div
              :class="['seller-card', { disabled: !product.seller_username }]"
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
                <div class="seller-name">@{{ product.seller_username || '未知' }}</div>
                <div class="seller-hint">点击查看商家主页</div>
              </div>
            </div>
            
            
            
            <div class="action-section desktop-only">
              <template v-if="isStore">
                                            <button
                                              type="button"
                                              class="buy-btn store"
                                              @click="handleOpenStore"
                                            >
                                              🏪 立即前往
                                            </button>
                                          </template>
                                          <template v-else-if="isCdk">
                                            <div v-if="isOutOfStock" class="buy-action-row">
                                              <button
                                                class="buy-btn disabled"
                                                disabled
                                              >
                                                😢 已售罄
                                              </button>
                                              <button
                                                class="buy-btn restock"
                                                :class="{ subscribed: restockSubscribed }"
                                                :disabled="restockStatusLoading || restockSubscribeLoading || restockSubscribed"
                                                @click="handleSubscribeRestock"
                                              >
                                                {{ restockButtonText }}
                                              </button>
                                            </div>
                                            <button
                                              v-else-if="isTestMode && !isSeller"
                                              class="buy-btn disabled test-only"
                                              disabled
                                            >
                                              🧪 测试物品
                                            </button>
                                            <button
                                              v-else-if="!canPurchase"
                                              class="buy-btn disabled"
                                              disabled
                                            >
                                              🚫 暂停销售
                                            </button>
                                            <button
                                              v-else
                                              class="buy-btn"
                                              :class="{ test: isTestMode && isSeller }"
                                              :disabled="purchasing"
                                              @click="handleBuyCdk"
                                            >
                                              {{ purchasing ? '创建订单中...' : buyButtonText }}
                                            </button>
                                          </template>
                                          <template v-else>
                                            <button
                                              class="buy-btn"
                                              @click="handleBuyLink"
                                            >
                                              🛒 立即兑换
                                            </button>
                                          </template>
            </div>
          </div>
        </div>

        <!-- 物品描述区域 -->
        <div class="detail-description">
          <h2 class="section-title">📝 物品详情</h2>
          <div class="description-content">{{ product.description || '暂无描述' }}</div>
        </div>

        <div
          v-if="isCdk"
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

        <div id="comments" v-if="isCdk" class="detail-comments">
          <div class="comment-header">
            <div class="comment-header-title">
              <h2 class="section-title">💬 物品评论</h2>
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
                    <span v-if="item.is_purchased" class="comment-purchased-tag">已购</span>
                    <span
                      v-if="item.is_purchased && item.rating_value !== null"
                      class="comment-rating-tag"
                    >
                      <StarRatingDisplay :value="item.rating_value" size="xs" />
                      <span>{{ formatRatingLabel(item.rating_value) }}</span>
                    </span>
                  </div>

                  <div class="comment-right">
                    <div v-if="canOpenCommentActionMenu(item)" class="comment-action-wrap">
                      <button
                        class="comment-action-btn"
                        :disabled="commentDeletingId === item.id || commentReportingId === item.id"
                        @click.stop="toggleCommentActionMenu(item.id)"
                      >
                        ⋯
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
                          v-if="item.can_delete"
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
                </div>
                <div class="comment-footer">
                  <time class="comment-time">{{ formatCommentTime(item.created_at) }}</time>
                  <div v-if="isCommentPublicStatus(item.status)" class="comment-footer-actions">
                    <button
                      class="comment-footer-btn comment-reply-btn"
                      :class="{ active: isCommentReplyComposerOpen(item.id) }"
                      @click="toggleCommentReplyComposer(item.id)"
                    >
                      {{ isCommentReplyComposerOpen(item.id) ? '收起输入' : '回复' }} {{ Number(item.reply_count || 0) }}
                    </button>
                    <button
                      class="comment-footer-btn comment-vote-btn"
                      :class="{ active: normalizeCommentVoteType(item.viewer_vote) === COMMENT_VOTE_UP }"
                      :disabled="isCommentVoting(item.id)"
                      @click="voteComment(item, COMMENT_VOTE_UP)"
                    >
                      <svg class="comment-vote-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.3l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.82 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                      </svg>
                      <span>{{ Number(item.upvote_count || 0) }}</span>
                    </button>
                    <button
                      class="comment-footer-btn comment-vote-btn"
                      :class="{ active: normalizeCommentVoteType(item.viewer_vote) === COMMENT_VOTE_DOWN }"
                      :disabled="isCommentVoting(item.id)"
                      @click="voteComment(item, COMMENT_VOTE_DOWN)"
                    >
                      <svg class="comment-vote-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <g transform="rotate(180 12 12)">
                          <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.3l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.82 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                        </g>
                      </svg>
                      <span>{{ Number(item.downvote_count || 0) }}</span>
                    </button>
                  </div>
                </div>
                <div v-if="Number(item.reply_count || 0) > 0 || isCommentReplyComposerOpen(item.id) || isCommentReplyLoading(item.id)" class="comment-reply-panel">
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
                            <time class="comment-reply-time">{{ formatCommentTime(reply.created_at) }}</time>
                          </div>
                          <div class="comment-reply-content">
                            <span>{{ reply.content }}</span>
                            <span
                              v-if="isCommentPendingStatus(reply.status)"
                              class="comment-inline-status-tag"
                            >
                              正在审核中，暂时仅自己可见
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
        
        <!-- 底部购买按钮（移动端固定底部） -->
                <div class="action-bottom mobile-only">
          <template v-if="isStore">
                                <button
                                  type="button"
                                  class="buy-btn store"
                                  @click="handleOpenStore"
                                >
                                  🏪 立即前往
                                </button>
                              </template>
                              <template v-else-if="isCdk">
                                <div v-if="isOutOfStock" class="buy-action-row">
                                  <button
                                    class="buy-btn disabled"
                                    disabled
                                  >
                                    😢 已售罄
                                  </button>
                                  <button
                                    class="buy-btn restock"
                                    :class="{ subscribed: restockSubscribed }"
                                    :disabled="restockStatusLoading || restockSubscribeLoading || restockSubscribed"
                                    @click="handleSubscribeRestock"
                                  >
                                    {{ restockButtonText }}
                                  </button>
                                </div>
                                <button
                                  v-else-if="isTestMode && !isSeller"
                                  class="buy-btn disabled test-only"
                                  disabled
                                >
                                  🧪 测试物品
                                </button>
                                <button
                                  v-else-if="!canPurchase"
                                  class="buy-btn disabled"
                                  disabled
                                >
                                  🚫 暂停销售
                                </button>
                                <button
                                  v-else
                                  class="buy-btn"
                                  :class="{ test: isTestMode && isSeller }"
                                  :disabled="purchasing"
                                  @click="handleBuyCdk"
                                >
                                  {{ purchasing ? '创建订单中...' : buyButtonText }}
                                </button>
                              </template>
                              <template v-else>
                                <button
                                  class="buy-btn"
                                  @click="handleBuyLink"
                                >
                                  🛒 立即兑换
                                </button>
                              </template>
        </div>
      </template>
      
      <!-- 错误状态 -->
      <EmptyState
        v-else
        :icon="detailErrorContent.icon"
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
        v-if="showImagePreview && product?.image_url" 
        class="image-preview-overlay"
        @click.self="closeImagePreview"
      >
        <button class="preview-close" @click="closeImagePreview">✕</button>
        <img 
          :src="product.image_url" 
          :alt="product.name" 
          class="preview-image"
        />
        <div class="preview-hint">点击空白处或按 ESC 关闭</div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="showReportModal"
        class="report-modal-overlay"
        @click.self="closeReportModal"
      >
        <div class="report-modal">
          <div class="report-modal-header">
            <h3>举报物品</h3>
            <button class="report-modal-close" @click="closeReportModal">&times;</button>
          </div>
          <p class="report-modal-desc">请描述你遇到的问题（例如收款配置错误、测试模式未关闭、支付链接异常等）。</p>
          <textarea
            v-model="reportReason"
            class="report-textarea"
            maxlength="500"
            placeholder="请填写举报原因（5-500字）"
          ></textarea>
          <div class="report-quick-list">
            <button
              v-for="item in quickReportReasons"
              :key="item"
              class="report-quick-item"
              @click="applyQuickReason(item)"
            >
              {{ item }}
            </button>
          </div>
          <div class="report-modal-footer">
            <span class="report-count">{{ reportReason.trim().length }}/500</span>
            <div class="report-actions">
              <button class="report-cancel-btn" @click="closeReportModal">取消</button>
              <button
                class="report-submit-btn"
                :disabled="reportSubmitting || reportReason.trim().length < 5"
                @click="submitReport"
              >
                {{ reportSubmitting ? '提交中...' : '提交举报' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div
        v-if="showCommentReportModal"
        class="report-modal-overlay"
        @click.self="closeCommentReportModal"
      >
        <div class="report-modal">
          <div class="report-modal-header">
            <h3>举报评论</h3>
            <button class="report-modal-close" @click="closeCommentReportModal">&times;</button>
          </div>
          <p class="report-modal-desc">请描述该评论存在的问题，管理员会尽快处理。</p>
          <textarea
            v-model="commentReportReason"
            class="report-textarea"
            maxlength="500"
            placeholder="请填写举报原因（5-500字）"
          ></textarea>
          <div class="report-modal-footer">
            <span class="report-count">{{ commentReportReason.trim().length }}/500</span>
            <div class="report-actions">
              <button class="report-cancel-btn" @click="closeCommentReportModal">取消</button>
              <button
                class="report-submit-btn"
                :disabled="commentReportSubmitting || commentReportReason.trim().length < 5"
                @click="submitCommentReport"
              >
                {{ commentReportSubmitting ? '提交中...' : '提交举报' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useShopStore } from '@/stores/shop'
import { useUserStore } from '@/stores/user'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { formatRelativeTime, formatPrice } from '@/utils/format'
import { escapeHtml } from '@/utils/security'
import { prepareNewTab, openInNewTab, cleanupPreparedTab } from '@/utils/newTab'
import AvatarImage from '@/components/common/AvatarImage.vue'
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue'
import StarRatingInput from '@/components/common/StarRatingInput.vue'
import { buildAvatarCandidates } from '@/utils/avatar'
import { api } from '@/utils/api'
import Skeleton from '@/components/common/Skeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const shopStore = useShopStore()
const userStore = useUserStore()
const toast = useToast()
const dialog = useDialog()

// 状态
const loading = ref(true)
const product = ref(null)
const detailErrorType = ref('not_found')
const detailErrorMessage = ref('')
const purchasing = ref(false)
const showImagePreview = ref(false)
const showReportModal = ref(false)
const reportReason = ref('')
const reportSubmitting = ref(false)
const favoriteSubmitting = ref(false)
const selectedQuantity = ref(1)
const restockSubscribed = ref(false)
const restockStatusLoading = ref(false)
const restockSubscribeLoading = ref(false)
const commentLoading = ref(false)
const commentList = ref([])
const commentEnabled = ref(false)
const commentDisabledReason = ref('该物品暂未开启评论')
const commentPagination = ref({
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 0
})
const commentSummary = ref({
  averageRating: 0,
  ratedCount: 0,
  favoriteCount: 0,
  visibleCommentCount: 0,
  visibleReplyCount: 0
})
const viewerHasPurchased = ref(false)
const viewerHasRated = ref(false)
const viewerRatingValue = ref(null)
const commentDraft = ref('')
const commentRatingDraft = ref(null)
const commentSubmitting = ref(false)
const commentActionMenuId = ref(null)
const commentDeletingId = ref(null)
const commentReportingId = ref(null)
const showCommentReportModal = ref(false)
const commentReportReason = ref('')
const commentReportSubmitting = ref(false)
const commentReportTarget = ref(null)
const commentVotingMap = ref({})
const commentReplyComposerIdSet = ref(new Set())
const commentReplyMap = ref({})
const commentReplyPaginationMap = ref({})
const commentReplyLoadingMap = ref({})
const commentReplySubmittingMap = ref({})
const commentReplyDraftMap = ref({})

const COMMENT_VOTE_UP = 'up'
const COMMENT_VOTE_DOWN = 'down'
const COMMENT_PUBLIC_STATUS_SET = new Set(['ai_approved', 'manual_approved'])

const quickReportReasons = [
  '收款配置缺失，无法生成支付链接',
  '商品仍处于测试模式，无法正常购买',
  '支付链接无效或跳转异常',
  '价格或描述与实际不符',
  '疑似无法交付或存在欺诈风险'
]

// 物品类型
const productType = computed(() => product.value?.product_type || 'link')
const isCdk = computed(() => productType.value === 'cdk')
const isStore = computed(() => productType.value === 'store')

// 测试模式相关
const isTestMode = computed(() => !!product.value?.is_test_mode || !!product.value?.isTestMode)
const isSeller = computed(() => {
  if (!product.value || !userStore.user) return false
  return String(userStore.user.id) === String(product.value.seller_user_id)
})
const isFavorited = computed(() =>
  !!(product.value?.isFavorited || product.value?.is_favorited)
)
const viewerTrustLevel = computed(() => {
  const raw = userStore.trustLevel
  const parsed = Number.parseInt(raw, 10)
  return Number.isInteger(parsed) ? parsed : 0
})

// 价格计算
const price = computed(() => parseFloat(product.value?.price) || 0)
const discount = computed(() => parseFloat(product.value?.discount) || 1)
const hasDiscount = computed(() => discount.value < 1)
const discountPercent = computed(() => Math.round((1 - discount.value) * 100))
const finalPrice = computed(() => formatPrice(price.value * discount.value))
const originalPrice = computed(() => formatPrice(price.value))

function toSafeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

// 库存
const stock = computed(() => toSafeInt(product.value?.stock, 0))
const cdkAvailableStock = computed(() => {
  if (product.value?.availableStock !== undefined && product.value?.availableStock !== null && product.value?.availableStock !== '') {
    return Math.max(0, toSafeInt(product.value.availableStock, 0))
  }
  if (product.value?.cdkStats?.available !== undefined && product.value?.cdkStats?.available !== null) {
    return Math.max(0, toSafeInt(product.value.cdkStats.available, 0))
  }
  return null
})
const cdkTotalStock = computed(() => {
  if (product.value?.cdkStats?.total !== undefined && product.value?.cdkStats?.total !== null) {
    return Math.max(0, toSafeInt(product.value.cdkStats.total, 0))
  }
  return null
})
const isUnlimitedStock = computed(() => {
  if (isCdk.value && (cdkAvailableStock.value !== null || cdkTotalStock.value !== null)) {
    // CDK 商品如果返回了库存统计，优先以统计为准，避免 0 库存误显示为无限
    return false
  }
  return stock.value === -1
})
const availableStock = computed(() => {
  if (isCdk.value && cdkAvailableStock.value !== null) return cdkAvailableStock.value
  if (isUnlimitedStock.value) return -1
  return Math.max(0, stock.value)
})
const totalStock = computed(() => {
  if (isCdk.value && cdkTotalStock.value !== null) return cdkTotalStock.value
  if (availableStock.value === -1) return -1
  return Math.max(0, stock.value)
})
const isOutOfStock = computed(() => 
  isCdk.value && !isUnlimitedStock.value && availableStock.value <= 0
)
const stockClass = computed(() => isOutOfStock.value ? 'low' : '')
const stockDisplay = computed(() => {
  if (isUnlimitedStock.value) return '∞'
  if (totalStock.value <= 0) return `${Math.max(0, availableStock.value)}`
  return `${availableStock.value}/${totalStock.value}`
})
const restockButtonText = computed(() => {
  if (restockStatusLoading.value) return '加载中...'
  if (restockSubscribeLoading.value) return '订阅中...'
  if (restockSubscribed.value) return '✅ 已订阅'
  return '🔔 订阅补货通知'
})
// canPurchase 逻辑：后端返回明确的 false 时才禁用，未返回或为 undefined/null 时默认可购买
const canPurchase = computed(() => {
  // 如果后端没有返回这个字段（undefined），默认允许购买
  if (product.value?.canPurchase === undefined) return true
  return product.value.canPurchase !== false
})
const soldCount = computed(() => parseInt(product.value?.sold_count) || 0)
const maxPurchaseQuantity = computed(() => {
  const raw = Number(product.value?.max_purchase_quantity ?? product.value?.maxPurchaseQuantity ?? 0)
  if (!Number.isInteger(raw) || raw < 0) return 0
  return raw
})
const purchaseTrustLevel = computed(() => {
  const raw = Number(product.value?.purchase_trust_level ?? product.value?.purchaseTrustLevel ?? 0)
  if (!Number.isInteger(raw) || raw < 0) return 0
  return Math.min(raw, 4)
})
const canPurchaseByTrustLevel = computed(() => viewerTrustLevel.value >= purchaseTrustLevel.value)
const purchaseTrustBlockMessage = computed(() => {
  if (purchaseTrustLevel.value <= 0 || canPurchaseByTrustLevel.value) return ''
  if (!userStore.isLoggedIn) {
    return `该商品需登录且信任等级达到 TL${purchaseTrustLevel.value} 才可兑换`
  }
  return `当前账号信任等级为 TL${viewerTrustLevel.value}，需达到 TL${purchaseTrustLevel.value} 才可兑换`
})

const maxSelectableQuantity = computed(() => {
  const limits = [1000]

  if (maxPurchaseQuantity.value > 0) {
    limits.push(maxPurchaseQuantity.value)
  }

  if (!isUnlimitedStock.value) {
    limits.push(Math.max(0, Number(availableStock.value) || 0))
  } else {
    const available = Number(availableStock.value)
    if (Number.isFinite(available) && available > 0) {
      limits.push(available)
    }
  }

  const minLimit = Math.min(...limits)
  return minLimit > 0 ? minLimit : 1
})

const totalPrice = computed(() =>
  formatPrice(price.value * discount.value * selectedQuantity.value)
)

const buyButtonText = computed(() => {
  if (selectedQuantity.value > 1) {
    return `🛒 立即兑换 ${selectedQuantity.value} 个 (${totalPrice.value} LDC)`
  }
  return `🛒 立即兑换 (${totalPrice.value} LDC)`
})

const detailErrorContent = computed(() => {
  if (detailErrorType.value === 'login_required') {
    return {
      icon: '🔐',
      text: '请先登录后查看',
      hint: detailErrorMessage.value || '该物品需要更高的账号信任等级，登录后可继续访问当前页面'
    }
  }

  if (detailErrorType.value === 'trust_required') {
    return {
      icon: '🔒',
      text: '信任等级不足',
      hint: detailErrorMessage.value || '当前账号信任等级不足，暂时无法查看该物品'
    }
  }

  return {
    icon: '😢',
    text: '物品不存在',
    hint: '该物品可能已下架或被删除'
  }
})

const quantityHint = computed(() => {
  const hints = []

  if (maxPurchaseQuantity.value > 0) {
    hints.push(`单次最多购买 ${maxPurchaseQuantity.value} 个`)
  }

  if (purchaseTrustLevel.value > 0) {
    hints.push(`兑换需信任等级 TL${purchaseTrustLevel.value}`)
  }

  if (!isUnlimitedStock.value) {
    const canBuyNow = Math.max(0, Number(availableStock.value) || 0)
    hints.push(`当前可购买 ${canBuyNow} 个`)
  }

  return hints.join('，')
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
const categoryIcon = computed(() => product.value?.category_icon || '📦')
const categoryName = computed(() => product.value?.category_name || '其他')

// 卖家
const sellerAvatarSeed = computed(() =>
  product.value?.seller_username || product.value?.seller_user_id || product.value?.id || 'seller'
)

const sellerAvatarCandidates = computed(() =>
  buildAvatarCandidates(product.value?.seller_avatar, 128)
)

function commentAvatarSeed(user) {
  return user?.nickname || user?.username || user?.id || 'user'
}

function resolveCommentAvatarCandidates(user) {
  return buildAvatarCandidates([
    user?.animated_avatar,
    user?.avatar,
    user?.avatar_url,
    user?.avatar_template
  ], 96)
}

// 时间
const updateTime = computed(() => 
  formatRelativeTime(product.value?.updated_at || product.value?.created_at)
)

// 封面样式
const colors = [
  'linear-gradient(135deg, #e0f2fe, #bae6fd)',
  'linear-gradient(135deg, #fce7f3, #fbcfe8)',
  'linear-gradient(135deg, #d1fae5, #a7f3d0)',
  'linear-gradient(135deg, #fef3c7, #fde68a)',
  'linear-gradient(135deg, #ede9fe, #ddd6fe)',
  'linear-gradient(135deg, #ffedd5, #fed7aa)'
]
const coverStyle = computed(() => {
  if (product.value?.image_url) return {}
  const id = product.value?.id || 0
  return { background: colors[id % colors.length] }
})

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
    const result = await shopStore.getProductRestockSubscriptionStatus(product.value.id)
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
  document.addEventListener('click', handleDocumentClick)
  const productId = route.params.id
  if (!productId) {
    loading.value = false
    return
  }
  
  // 获取分类
  await shopStore.fetchCategories()
  
  // 获取物品详情
  const result = await api.get(`/api/shop/products/${encodeURIComponent(productId)}`)
  if (result?.success && result?.data?.product) {
    product.value = result.data.product
    detailErrorMessage.value = ''
    // 更新页面标题
    document.title = `${product.value.name} - LD士多`
    if (product.value.product_type === 'cdk') {
      await loadComments(1)
    }
  } else {
    detailErrorMessage.value = String(result?.error || '').trim()
    detailErrorType.value = resolveDetailErrorType(result)
  }
  
  loading.value = false
  if (product.value && route.hash === '#comments') {
    await nextTick()
    document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})

onUnmounted(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', handleEscKey)
  document.removeEventListener('click', handleDocumentClick)
})

watch(
  () => [
    product.value?.id,
    maxSelectableQuantity.value,
    isCdk.value,
    isOutOfStock.value,
    canPurchase.value
  ],
  () => {
    if (!isCdk.value || isOutOfStock.value || !canPurchase.value) {
      selectedQuantity.value = 1
      return
    }
    selectedQuantity.value = clampQuantity(selectedQuantity.value)
  },
  { immediate: true }
)

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
function goLogin() {
  router.push({ name: 'Login', query: { redirect: route.fullPath } })
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
  const safeStatus = String(status || '').trim()
  return safeStatus === 'pending_ai' || safeStatus === 'pending_manual'
}

function canOpenCommentActionMenu(item) {
  return !!item?.can_delete || isCommentPublicStatus(item?.status)
}

function normalizeCommentVoteType(value) {
  const voteType = String(value || '').toLowerCase()
  if (voteType === COMMENT_VOTE_UP) return COMMENT_VOTE_UP
  if (voteType === COMMENT_VOTE_DOWN) return COMMENT_VOTE_DOWN
  return ''
}

function isCommentVoting(commentId) {
  return !!commentVotingMap.value[Number(commentId || 0)]
}

function isCommentReplyComposerOpen(commentId) {
  const safeCommentId = Number(commentId || 0)
  if (!safeCommentId) return false
  return commentReplyComposerIdSet.value.has(safeCommentId)
}

function isCommentReplyLoading(commentId) {
  return !!commentReplyLoadingMap.value[Number(commentId || 0)]
}

function isCommentReplySubmitting(commentId) {
  return !!commentReplySubmittingMap.value[Number(commentId || 0)]
}

function getCommentReplies(commentId) {
  return commentReplyMap.value[Number(commentId || 0)] || []
}

function getCommentReplyPagination(commentId) {
  return commentReplyPaginationMap.value[Number(commentId || 0)] || {
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
  const safeCommentId = Number(commentId || 0)
  return String(commentReplyDraftMap.value[safeCommentId] || '').trim().length
}

function updateCommentListItem(commentId, updater) {
  const safeCommentId = Number(commentId || 0)
  if (!safeCommentId || typeof updater !== 'function') return
  const index = commentList.value.findIndex((item) => Number(item.id || 0) === safeCommentId)
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

  commentLoading.value = true
  try {
    const result = await shopStore.fetchProductComments(product.value.id, { page: targetPage, pageSize: 10 })
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
      averageRating: normalizeCommentRatingValue(summary.averageRating ?? summary.average_rating),
      ratedCount: Number(summary.ratedCount ?? summary.rated_count ?? 0),
      favoriteCount: Number(summary.favoriteCount ?? summary.favorite_count ?? 0),
      visibleCommentCount: Number(summary.visibleCommentCount ?? summary.visible_comment_count ?? pagination.total ?? 0),
      visibleReplyCount: Number(summary.visibleReplyCount ?? summary.visible_reply_count ?? 0)
    }
    const list = Array.isArray(data.comments) ? data.comments : []
    commentList.value = list.map((item) => ({
      ...item,
      status: String(item?.status || '').trim(),
      rating_value: normalizeCommentRatingValue(item?.rating_value ?? item?.ratingValue, { allowNull: true }),
      upvote_count: Number(item?.upvote_count || item?.upvoteCount || 0),
      downvote_count: Number(item?.downvote_count || item?.downvoteCount || 0),
      reply_count: Number(item?.reply_count || item?.replyCount || 0),
      viewer_vote: normalizeCommentVoteType(item?.viewer_vote || item?.viewerVote)
    }))
    commentPagination.value = {
      total: Number(pagination.total || 0),
      page: Number(pagination.page || targetPage),
      pageSize: Number(pagination.pageSize || 10),
      totalPages: Number(pagination.totalPages || 0)
    }
    const validCommentIds = new Set(commentList.value.map((item) => Number(item?.id || 0)).filter((id) => id > 0))
    commentReplyComposerIdSet.value = new Set(
      [...commentReplyComposerIdSet.value].filter((id) => validCommentIds.has(Number(id)))
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
    toast.error(`加载评论失败：${error.message}`)
  } finally {
    commentLoading.value = false
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
  const safeCommentId = Number(comment?.id || 0)
  if (!safeCommentId || ![COMMENT_VOTE_UP, COMMENT_VOTE_DOWN].includes(voteType)) return

  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('点赞需要先登录，是否前往登录？', {
      title: '需要登录',
      icon: '🔐',
      confirmText: '去登录',
      cancelText: '取消'
    })
    if (confirmed) goLogin()
    return
  }

  if (isCommentVoting(safeCommentId)) return
  commentVotingMap.value[safeCommentId] = true

  try {
    const currentVote = normalizeCommentVoteType(comment.viewer_vote)
    const targetVote = currentVote === voteType ? '' : voteType
    const result = await shopStore.voteProductComment(safeCommentId, targetVote)
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
      viewer_vote: normalizeCommentVoteType(data.viewerVote),
      upvote_count: Number(data.upvoteCount ?? current.upvote_count ?? 0),
      downvote_count: Number(data.downvoteCount ?? current.downvote_count ?? 0)
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
      id: Number(item?.id || 0),
      replyCount: Number(item?.reply_count || 0)
    }))
    .filter((item) => item.id > 0 && item.replyCount > 0)

  if (targets.length === 0) return
  await Promise.all(
    targets.map((item) => loadCommentReplies(item.id, 1, { silent: true, force: true }))
  )
}

async function loadCommentReplies(commentId, page = 1, options = {}) {
  const safeCommentId = Number(commentId || 0)
  if (!safeCommentId || isCommentReplyLoading(safeCommentId)) return
  const targetPage = Math.max(Number.parseInt(page, 10) || 1, 1)
  const append = targetPage > 1
  const silent = !!options?.silent
  const force = !!options?.force
  const loadedOnce = !!commentReplyPaginationMap.value[safeCommentId]

  if (!append && loadedOnce && !force) return

  commentReplyLoadingMap.value[safeCommentId] = true
  try {
    const result = await shopStore.fetchProductCommentReplies(safeCommentId, {
      page: targetPage,
      pageSize: 10
    })
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
      status: String(item?.status || '').trim()
    }))
    const currentList = commentReplyMap.value[safeCommentId] || []
    const merged = append
      ? [...currentList, ...normalizedList.filter((item) => !currentList.some((existing) => Number(existing.id) === Number(item.id)))]
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
      reply_count: Number(pagination.total || current.reply_count || merged.length || 0)
    }))
  } catch (error) {
    if (!silent) toast.error(`加载回复失败：${error.message}`)
  } finally {
    commentReplyLoadingMap.value[safeCommentId] = false
  }
}

function toggleCommentReplyComposer(commentId) {
  const safeCommentId = Number(commentId || 0)
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
  const safeCommentId = Number(commentId || 0)
  if (!safeCommentId) return
  const pagination = getCommentReplyPagination(safeCommentId)
  if (Number(pagination.page || 0) >= Number(pagination.totalPages || 0)) return
  await loadCommentReplies(safeCommentId, Number(pagination.page || 1) + 1)
}

async function submitCommentReply(comment) {
  const safeCommentId = Number(comment?.id || 0)
  if (!safeCommentId || isCommentReplySubmitting(safeCommentId)) return

  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('回复需要先登录，是否前往登录？', {
      title: '需要登录',
      icon: '🔐',
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
    const result = await shopStore.createProductCommentReply(safeCommentId, content)
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
      reply_count: Number(data.replyCount ?? current.reply_count ?? 0)
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
      icon: '🔐',
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
    const result = await shopStore.createProductComment(product.value.id, payload)
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
    icon: '🗑️',
    confirmText: '删除',
    cancelText: '取消'
  })
  if (!confirmed) return

  commentDeletingId.value = comment.id
  try {
    const result = await shopStore.deleteProductComment(comment.id)
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
      icon: '🔐',
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

async function submitCommentReport() {
  if (!commentReportTarget.value?.id || commentReportSubmitting.value) return
  const reason = commentReportReason.value.trim()
  if (reason.length < 5 || reason.length > 500) {
    toast.error('举报原因需为 5-500 个字符')
    return
  }

  commentReportSubmitting.value = true
  commentReportingId.value = commentReportTarget.value.id
  try {
    const result = await shopStore.reportProductComment(commentReportTarget.value.id, reason)
    if (!result?.success) {
      const message = typeof result?.error === 'object'
        ? (result.error?.message || result.error?.code || '举报提交失败')
        : (result?.error || result?.message || '举报提交失败')
      toast.error(message)
      return
    }

    toast.success(result?.data?.message || '举报已提交，感谢反馈')
    closeCommentReportModal()
  } catch (error) {
    toast.error(`举报提交失败：${error.message}`)
  } finally {
    commentReportSubmitting.value = false
    commentReportingId.value = null
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

function goToSeller() {
  const username = String(product.value?.seller_username || '').trim()
  if (!username) {
    toast.warning('商家主页暂不可用')
    return
  }
  router.push({
    name: 'MerchantProfile',
    params: { username }
  })
}

async function toggleFavorite() {
  if (!product.value?.id || favoriteSubmitting.value) return

  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('收藏功能需要先登录，是否前往登录？', {
      title: '需要登录',
      icon: '🔐',
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
      ? await shopStore.removeFavorite(product.value.id)
      : await shopStore.addFavorite(product.value.id)

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
      isFavorited: nextState,
      is_favorited: nextState
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

function handleImageError(e) {
  e.target.style.display = 'none'
}

function clampQuantity(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1
  const intValue = Math.floor(parsed)
  if (intValue < 1) return 1
  if (intValue > maxSelectableQuantity.value) return maxSelectableQuantity.value
  return intValue
}

function handleQuantityInput() {
  selectedQuantity.value = clampQuantity(selectedQuantity.value)
}

function increaseQuantity() {
  selectedQuantity.value = clampQuantity(selectedQuantity.value + 1)
}

function decreaseQuantity() {
  selectedQuantity.value = clampQuantity(selectedQuantity.value - 1)
}

// 图片预览
// 图片预览
function openImagePreview() {
  if (product.value?.image_url) {
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
  const opened = showImagePreview.value || showReportModal.value || showCommentReportModal.value
  document.body.style.overflow = opened ? 'hidden' : ''
  document.removeEventListener('keydown', handleEscKey)
  if (opened) {
    document.addEventListener('keydown', handleEscKey)
  }
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
      icon: '🔐',
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
  reportReason.value = ''
  syncModalState()
}

function applyQuickReason(text) {
  const current = reportReason.value.trim()
  if (!current) {
    reportReason.value = text
    return
  }
  if (!current.includes(text)) {
    reportReason.value = `${current}；${text}`
  }
}

async function submitReport() {
  if (!product.value?.id || reportSubmitting.value) return

  const reason = reportReason.value.trim()
  if (reason.length < 5 || reason.length > 500) {
    toast.error('举报原因需为 5-500 个字符')
    return
  }

  reportSubmitting.value = true
  try {
    const result = await shopStore.reportProduct(product.value.id, reason)
    if (result?.success) {
      toast.success('举报已提交，感谢反馈')
      closeReportModal()
      return
    }
    const message = typeof result?.error === 'object'
      ? (result.error.message || result.error.code || '举报提交失败')
      : (result?.error || result?.message || '举报提交失败')
    toast.error(message)
  } catch (error) {
    toast.error(`举报提交失败：${error.message}`)
  } finally {
    reportSubmitting.value = false
  }
}

async function handleSubscribeRestock() {
  if (!product.value?.id || restockSubscribeLoading.value || restockStatusLoading.value || restockSubscribed.value) return
  if (!isCdk.value || !isOutOfStock.value) return

  if (!userStore.isLoggedIn) {
    const confirmed = await dialog.confirm('请先登录后再订阅补货通知', {
      title: '需要登录',
      icon: '🔐',
      confirmText: '去登录'
    })
    if (confirmed) {
      router.push({ name: 'Login', query: { redirect: route.fullPath } })
    }
    return
  }

  restockSubscribeLoading.value = true
  try {
    const result = await shopStore.subscribeProductRestock(product.value.id)
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
      icon: '🔐',
      confirmText: '去登录'
    })
    if (confirmed) {
      router.push({ name: 'Login', query: { redirect: route.fullPath } })
    }
    return true
  }

  await dialog.alert(message, {
    title: '兑换受限',
    icon: '🔒'
  })
  return true
}

async function openExternalProductLink() {
  const preparedWindow = prepareNewTab()

  try {
    const result = await api.get(`/api/shop/products/${encodeURIComponent(product.value?.id)}/external-link`)
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

async function handleBuyCdk() {
  // 检查登录
  if (!userStore.isLoggedIn) {
    if (purchaseTrustLevel.value > 0) {
      await handleBlockedPurchaseByTrustLevel()
      return
    }
    const confirmed = await dialog.confirm('请先登录后再兑换物品', {
      title: '需要登录',
      icon: '🔐',
      confirmText: '去登录'
    })
    if (confirmed) {
      router.push({ name: 'Login', query: { redirect: route.fullPath } })
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

  const quantity = clampQuantity(selectedQuantity.value)
  selectedQuantity.value = quantity
  const totalAmount = formatPrice(price.value * discount.value * quantity)

  // 确认兑换
  const confirmed = await dialog.confirm(
    `确认兑换「${escapeHtml(product.value.name)}」？<br><br>📦 数量：<strong>${quantity}</strong><br>💰 总价：<strong>${totalAmount} LDC</strong><br><br>支付后系统将自动发放 CDK 到您的订单中。`,
    { title: '确认兑换', icon: '🛒' }
  )
  
  if (!confirmed) return
  
  // Pre-open a blank tab to keep navigation tied to the user gesture (better for mobile Safari).
  const preparedWindow = prepareNewTab()
  let paymentOpened = false
  
  purchasing.value = true
  
  try {
    const result = await shopStore.createOrder(product.value.id, quantity)
    
    if (result.success && result.data?.paymentUrl) {
      // 跳转支付
      paymentOpened = openInNewTab(result.data.paymentUrl, preparedWindow)
      if (!paymentOpened) {
        cleanupPreparedTab(preparedWindow)
      }
      
      // 提示用户
      await dialog.alert(
        `订单已创建：<strong>${result.data.orderNo}</strong><br><br>📝 请在新窗口中完成支付<br>⏰ 订单有效期 <strong>5分钟</strong>，请尽快完成支付<br>✅ 支付完成后 CDK 将自动发放<br>📋 可在「我的订单」中查看状态`,
        { title: '订单创建成功', icon: '🎉' }
      )
    } else {
      cleanupPreparedTab(preparedWindow)
      // 提取错误消息，处理对象格式的 error
      const errorMsg = typeof result.error === 'object' 
        ? (result.error.message || result.error.code || '创建订单失败')
        : (result.error || '创建订单失败')
      toast.error(errorMsg)
    }
  } catch (e) {
    cleanupPreparedTab(preparedWindow)
    toast.error('创建订单失败：' + e.message)
  } finally {
    purchasing.value = false
  }
}

// 外链物品兑换
async function handleBuyLink() {
  if (!canPurchaseByTrustLevel.value) {
    await handleBlockedPurchaseByTrustLevel()
    return
  }

  const confirmed = await dialog.confirm(
    `<div style="text-align: left; line-height: 1.8;">
      <p>⚠️ <strong>外链物品提示</strong></p>
      <p style="margin-top: 12px;">此物品为外链物品，点击「继续兑换」后将跳转到卖家设置的支付链接。</p>
      <ul style="margin: 12px 0; padding-left: 20px; color: var(--text-secondary);">
        <li>您将直接向卖家支付 LDC</li>
        <li>交易不会在平台留下支付记录</li>
        <li>兑换后请联系卖家获取服务</li>
      </ul>
      <p style="color: var(--text-tertiary); font-size: 13px;">💡 建议：交易前可先与卖家沟通确认</p>
    </div>`,
    { 
      title: '外链物品提示', 
      icon: '🔗',
      confirmText: '继续兑换',
      cancelText: '取消'
    }
  )
  
  if (confirmed) {
    await openExternalProductLink()
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
  background: var(--bg-primary);
}

.page-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
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

.nav-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.nav-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.nav-favorite-btn {
  padding: 8px 14px;
  border: 1px solid #e4cad0;
  border-radius: 20px;
  background: #fff4f6;
  color: #b16472;
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.nav-favorite-btn:hover {
  background: #feecef;
  border-color: #dbaab5;
}

.nav-favorite-btn.active {
  background: #fce5ea;
  border-color: #d98f9f;
  color: #9f4258;
}

.nav-favorite-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.nav-report-btn {
  padding: 8px 14px;
  border: 1px solid rgba(234, 179, 8, 0.35);
  border-radius: 20px;
  background: rgba(250, 204, 21, 0.16);
  color: #8a6500;
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-report-btn:hover {
  background: rgba(250, 204, 21, 0.24);
  border-color: rgba(234, 179, 8, 0.5);
  color: #6f5200;
}

.nav-report-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.nav-category {
  padding: 8px 14px;
  background: var(--bg-secondary);
  border-radius: 20px;
  font-size: 13px;
  color: var(--text-secondary);
}

.nav-type {
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
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  margin-bottom: 20px;
}

@media (min-width: 768px) {
  .detail-main {
    grid-template-columns: 1fr 1fr;
    padding: 32px;
  }
}

/* 媒体区域 */
.detail-media {
  display: flex;
  justify-content: center;
  align-items: center;
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
  transition: all 0.3s;
}

.media-wrapper:hover {
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.media-wrapper::after {
  content: '🔍 点击查看大图';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
  color: white;
  font-size: 12px;
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.media-wrapper:has(.media-image):hover::after {
  opacity: 1;
}

/* 图片预览弹窗 */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
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
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;
}

.preview-close:hover {
  background: rgba(255, 255, 255, 0.2);
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
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.report-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
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
  border-radius: 16px;
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-md);
  padding: 16px;
}

.report-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.report-modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.report-modal-close {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 22px;
  cursor: pointer;
}

.report-modal-desc {
  margin: 10px 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.report-textarea {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.6;
}

.report-quick-list {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.report-quick-item {
  border: 1px solid var(--border-light);
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.report-quick-item:hover {
  background: var(--bg-tertiary);
}

.report-modal-footer {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.report-count {
  color: var(--text-tertiary);
  font-size: 12px;
}

.report-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-cancel-btn,
.report-submit-btn {
  border: none;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 14px;
  cursor: pointer;
}

.report-cancel-btn {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.report-submit-btn {
  background: #b91c1c;
  color: #fff;
}

.report-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  font-size: 80px;
  opacity: 0.6;
}

.discount-tag {
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(135deg, #ad9090 0%, #937474 100%);
  color: white;
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

.detail-name {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.4;
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
  background: linear-gradient(135deg, #fef9f3 0%, #fdf6ee 100%);
  border-radius: 14px;
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
  flex-wrap: wrap;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-secondary);
}

.status-icon {
  font-size: 16px;
}

.status-text.low {
  color: var(--color-danger);
  font-weight: 500;
}

.status-item.hot .status-text {
  color: var(--color-warning);
  font-weight: 500;
}

/* 数量选择 */
.quantity-section {
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quantity-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qty-btn {
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
}

.qty-btn:hover {
  background: var(--bg-tertiary);
}

.qty-input {
  width: 88px;
  height: 34px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  text-align: center;
  padding: 0 6px;
}

.qty-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.quantity-summary {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-warning);
}

.quantity-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 卖家卡片 */
.seller-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
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

.seller-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.seller-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 0;
}

/* 妗岄潰绔喘涔版寜閽?*/
.action-section {
  margin-top: auto;
  padding-top: 10px;
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
  border: 1px solid rgba(207, 167, 111, 0.22);
  background:
    radial-gradient(circle at top right, rgba(207, 167, 111, 0.16), transparent 34%),
    linear-gradient(135deg, rgba(255, 247, 237, 0.96), rgba(250, 245, 235, 0.92));
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
  color: #8a5a20;
}

.comment-summary-stars strong {
  font-size: 24px;
  font-weight: 700;
  color: #7a4a18;
}

.comment-summary-text {
  font-size: 14px;
  line-height: 1.7;
  color: #86613b;
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
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(207, 167, 111, 0.18);
  color: #7a4a18;
}

.comment-summary-metric strong {
  font-size: 22px;
  font-weight: 700;
}

.comment-summary-metric-label {
  font-size: 12px;
  color: #9c7852;
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
  background: rgba(38, 111, 63, 0.12);
  color: #266f3f;
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

.comment-purchased-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e8f6e8;
  color: #2f855a;
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
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
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
  border-radius: 0;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  line-height: 1;
  font-size: 20px;
  padding: 0 2px 2px;
}

.comment-action-btn:not(:disabled):hover {
  color: var(--text-secondary);
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
  background: rgba(59, 130, 246, 0.1);
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
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
  transition: all 0.2s ease;
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
  background: rgba(38, 111, 63, 0.1);
  color: #266f3f;
  border-color: rgba(38, 111, 63, 0.22);
}

.comment-vote-btn {
  min-width: 56px;
  justify-content: center;
}

.comment-vote-icon {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.comment-vote-btn.active {
  background: rgba(38, 111, 63, 0.12);
  color: #266f3f;
  border-color: rgba(38, 111, 63, 0.25);
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
  color: #fff;
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
  color: #fff;
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
  color: #b45309;
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
  color: #b45309;
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
  background: #266f3f;
  color: #fff;
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
  width: 100%;
  padding: 16px 24px;
  background: linear-gradient(135deg, #cfa76f 0%, #bd8d57 100%);
  color: white;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
}

.buy-btn:hover {
  opacity: 0.92;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(207, 167, 111, 0.3);
}

.buy-btn.store {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
}

.buy-btn.store:hover {
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
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
  background: #999;
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.buy-btn.disabled.test-only {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  opacity: 0.6;
}

.buy-btn.test {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
}

.buy-btn.test:hover {
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
}

/* 测试模式横幅 */
.test-mode-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%);
  border: 1px solid #a5f3fc;
  border-radius: 12px;
  margin-bottom: 16px;
}

.test-badge {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  color: white;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.test-desc {
  font-size: 13px;
  color: #0891b2;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .page-container {
    padding: 12px;
    padding-bottom: 90px;
  }
  
  .detail-main {
    padding: 20px;
  }
  
  .detail-nav {
    margin-bottom: 16px;
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

}
</style>

