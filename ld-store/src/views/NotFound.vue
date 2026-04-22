<template>
  <div class="not-found-page">
    <div class="content">
      <div class="icon">🔍</div>
      <h1 class="title">页面未找到</h1>
      <p class="message">您访问的页面不存在或已被移除</p>
      
      <div class="actions">
        <router-link to="/" class="home-btn">
          返回首页
        </router-link>
        <button class="back-btn" @click="goBack">
          返回上页
        </button>
      </div>
      
      <div class="suggestions">
        <p class="suggestions-title">您可以尝试：</p>
        <ul class="suggestions-list">
          <li>检查网址是否正确</li>
          <li>返回首页浏览物品</li>
          <li>使用搜索查找物品</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}
</script>

<style scoped>
.not-found-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.content {
  text-align: center;
  max-width: 400px;
}

.icon {
  font-size: 80px;
  margin-bottom: 24px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.message {
  font-size: 16px;
  color: var(--text-tertiary);
  margin: 0 0 32px;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 40px;
}

.home-btn {
  padding: 14px 28px;
  background: linear-gradient(135deg, #a5b4a3 0%, #95a493 100%);
  color: white;
  border-radius: 12px;
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s;
}

.home-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary);
}

.back-btn {
  padding: 14px 28px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-default);
}

.suggestions {
  padding: 24px;
  background: var(--bg-card);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
}

.suggestions-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0 0 12px;
}

.suggestions-list {
  margin: 0;
  padding: 0 0 0 20px;
  text-align: left;
  color: var(--text-tertiary);
  font-size: 14px;
  line-height: 2;
}
</style>
