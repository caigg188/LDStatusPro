<template>
  <section v-if="visible" class="account-sanction" role="alert" aria-live="assertive">
    <div class="account-sanction__icon" aria-hidden="true">
      <ShieldAlert :size="22" />
    </div>
    <div class="account-sanction__body">
      <p class="account-sanction__eyebrow">{{ isLoginBan ? '账号已被平台封禁' : '账号功能受限' }}</p>
      <h2 class="account-sanction__title">
        {{ isLoginBan ? `封禁至 ${untilText}` : `评论功能限制至 ${untilText}` }}
      </h2>
      <p class="account-sanction__message">
        原因：{{ accountSanction.reason || '平台规则限制' }}
      </p>
      <p class="account-sanction__hint">
        <template v-if="isLoginBan">
          已付款订单会按平台规则处理，你无需再操作；如需申诉请联系平台管理员。
        </template>
        <template v-else>
          仍可正常浏览与购买，但暂时无法发布评论、回复、点赞或举报。
        </template>
      </p>
    </div>
    <div class="account-sanction__actions">
      <a
        class="account-sanction__link"
        :href="supportUrl"
        target="_blank"
        rel="noreferrer noopener"
      >
        联系管理员
      </a>
      <router-link v-if="isLoginBan" to="/user/orders" class="account-sanction__link secondary">
        我的订单
      </router-link>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { ShieldAlert } from '@lucide/vue'
import {
  accountSanction,
  formatSanctionUntil,
  isAccountSuspended,
  isCommentRestricted
} from '@/utils/accountSanction'

const SUPPORT_URL = 'https://ldspro.qzz.io/support'

const isLoginBan = computed(() => isAccountSuspended())
const visible = computed(() => isLoginBan.value || isCommentRestricted())
const untilText = computed(() => formatSanctionUntil(accountSanction.until))
const supportUrl = SUPPORT_URL
</script>

<style scoped>
.account-sanction {
  width: min(100% - 24px, 1180px);
  margin: 14px auto 0;
  padding: 18px 22px;
  display: flex;
  gap: 18px;
  align-items: flex-start;
  border: 1px solid color-mix(in srgb, var(--color-danger) 26%, var(--border-color));
  border-radius: 22px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-danger-bg) 88%, var(--bg-card)),
    var(--bg-card)
  );
  box-shadow: 0 14px 34px color-mix(in srgb, var(--color-danger) 12%, transparent);
}

.account-sanction__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 999px;
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
}

.account-sanction__body {
  flex: 1 1 auto;
  min-width: 0;
}

.account-sanction__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-danger);
}

.account-sanction__title {
  margin: 4px 0 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
}

.account-sanction__message {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.account-sanction__hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary);
}

.account-sanction__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  flex-wrap: wrap;
}

.account-sanction__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  color: var(--bg-card);
  background: var(--color-danger);
}

.account-sanction__link.secondary {
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border-medium);
}

.account-sanction__link:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-danger) 45%, transparent);
  outline-offset: 2px;
}

@media (max-width: 767px) {
  .account-sanction {
    width: min(100% - 20px, 1180px);
    margin-top: 10px;
    padding: 16px 16px;
    flex-direction: column;
    gap: 12px;
  }

  .account-sanction__actions {
    width: 100%;
  }

  .account-sanction__link {
    flex: 1 1 0;
  }
}
</style>