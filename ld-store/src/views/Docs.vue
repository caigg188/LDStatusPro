<template>
  <div class="help-page">
    <a class="help-skip" href="#help-article">跳到正文</a>

    <div class="help-mobile-toolbar">
      <button ref="menuButtonRef" type="button" class="help-mobile-toolbar__button" @click="openDrawer(false)">
        <Menu :size="20" aria-hidden="true" />
        <span>目录</span>
      </button>
      <router-link to="/docs" class="help-mobile-toolbar__brand">LD 士多帮助中心</router-link>
      <button type="button" class="help-mobile-toolbar__button help-mobile-toolbar__button--icon" aria-label="搜索帮助" @click="openDrawer(true)">
        <Search :size="20" aria-hidden="true" />
      </button>
    </div>

    <div class="help-layout">
      <aside class="help-sidebar" aria-label="帮助中心目录">
        <router-link to="/docs" class="help-brand">
          <span class="help-brand__mark"><StoreLogo decorative /></span>
          <span><strong>帮助中心</strong><small>LD 士多使用指南</small></span>
        </router-link>

        <HelpSearchBox input-id="help-search-desktop" />

        <nav class="help-nav" aria-label="文章目录">
          <section v-for="group in groupedArticles" :key="group.id" class="help-nav__group">
            <h2>{{ group.title }}</h2>
            <router-link
              v-for="article in group.articles"
              :key="article.id"
              :to="getHelpPath(article.id)"
              :class="['help-nav__item', { 'is-active': article.id === currentArticle.id }]"
              :aria-current="article.id === currentArticle.id ? 'page' : undefined"
            >
              <component :is="iconMap[article.icon]" :size="17" aria-hidden="true" />
              <span>{{ article.title }}</span>
            </router-link>
          </section>
        </nav>

        <div class="help-sidebar__footer">
          <router-link to="/support"><MessageCircleQuestion :size="17" /> 联系与反馈</router-link>
          <router-link to="/"><ArrowLeft :size="17" /> 返回物品广场</router-link>
        </div>
      </aside>

      <main class="help-main">
        <nav class="help-breadcrumb" aria-label="面包屑">
          <router-link to="/">首页</router-link>
          <ChevronRight :size="14" aria-hidden="true" />
          <router-link to="/docs">帮助中心</router-link>
          <template v-if="currentArticle.id !== 'quick-start'">
            <ChevronRight :size="14" aria-hidden="true" />
            <span aria-current="page">{{ currentArticle.title }}</span>
          </template>
        </nav>

        <section v-if="isLanding" class="help-hero" aria-labelledby="help-hero-title">
          <div class="help-hero__copy">
            <p class="help-eyebrow">LD 士多 · 任务式帮助</p>
            <h1 id="help-hero-title">你现在想完成什么？</h1>
            <p>从购买、经营或问题处理开始，跟着页面入口一步步完成。</p>
          </div>
          <HelpSearchBox input-id="help-search-hero" hero />
          <div class="help-routes" aria-label="快速路线">
            <router-link to="/docs/buy-guide" class="help-route help-route--buyer">
              <span class="help-route__icon"><ShoppingBag :size="22" /></span>
              <span><strong>我是买家</strong><small>找物品、用券、查订单</small></span>
              <ArrowUpRight :size="18" aria-hidden="true" />
            </router-link>
            <router-link to="/docs/seller-center" class="help-route help-route--seller">
              <span class="help-route__icon"><Store :size="22" /></span>
              <span><strong>我是卖家</strong><small>配置收款、发布、经营</small></span>
              <ArrowUpRight :size="18" aria-hidden="true" />
            </router-link>
            <router-link to="/docs/faq" class="help-route help-route--support">
              <span class="help-route__icon"><Wrench :size="22" /></span>
              <span><strong>遇到问题</strong><small>按支付、发货和库存排查</small></span>
              <ArrowUpRight :size="18" aria-hidden="true" />
            </router-link>
          </div>
        </section>

        <article id="help-article" ref="articleRef" class="help-article" tabindex="-1">
          <header v-if="!isLanding" class="help-article-header">
            <div class="help-article-header__icon">
              <component :is="iconMap[currentArticle.icon]" :size="26" aria-hidden="true" />
            </div>
            <div>
              <p class="help-eyebrow">{{ currentGroupTitle }}</p>
              <h1>{{ currentArticle.title }}</h1>
              <p class="help-article-header__summary">{{ currentArticle.summary }}</p>
              <div class="help-article-header__meta">
                <span v-for="audience in currentArticle.audience" :key="audience">适用：{{ audience }}</span>
                <span>更新：{{ updatedAtLabel }}</span>
              </div>
            </div>
          </header>

          <Suspense>
            <component :is="currentComponent" />
            <template #fallback>
              <div class="help-loading" role="status">正在加载文章…</div>
            </template>
          </Suspense>
        </article>

        <section v-if="relatedArticles.length" class="help-related" aria-labelledby="related-title">
          <div>
            <p class="help-eyebrow">继续完成任务</p>
            <h2 id="related-title">相关文章</h2>
          </div>
          <div class="help-related__grid">
            <router-link v-for="article in relatedArticles" :key="article.id" :to="getHelpPath(article.id)">
              <component :is="iconMap[article.icon]" :size="19" aria-hidden="true" />
              <span><strong>{{ article.title }}</strong><small>{{ article.summary }}</small></span>
              <ArrowRight :size="17" aria-hidden="true" />
            </router-link>
          </div>
        </section>

        <nav class="help-pagination" aria-label="上一篇和下一篇">
          <router-link v-if="previousArticle" :to="getHelpPath(previousArticle.id)" rel="prev">
            <ArrowLeft :size="17" />
            <span><small>上一篇</small><strong>{{ previousArticle.title }}</strong></span>
          </router-link>
          <span v-else></span>
          <router-link v-if="nextArticle" :to="getHelpPath(nextArticle.id)" rel="next">
            <span><small>下一篇</small><strong>{{ nextArticle.title }}</strong></span>
            <ArrowRight :size="17" />
          </router-link>
        </nav>
      </main>

      <aside v-if="tableOfContents.length" class="help-toc" aria-label="本页目录">
        <p>本页目录</p>
        <nav>
          <a
            v-for="heading in tableOfContents"
            :key="heading.id"
            :href="`#${heading.id}`"
            :class="[`is-level-${heading.level}`, { 'is-active': activeHeading === heading.id }]"
            :aria-current="activeHeading === heading.id ? 'location' : undefined"
            @click="handleTocClick($event, heading.id)"
          >{{ heading.text }}</a>
        </nav>
        <router-link to="/support" class="help-toc__feedback">这篇内容没解决问题？</router-link>
      </aside>
    </div>

    <Teleport to="body">
      <div v-if="drawerOpen" class="help-drawer-layer">
        <button class="help-drawer-backdrop" type="button" aria-label="关闭目录" @click="closeDrawer()" />
        <aside
          ref="drawerRef"
          class="help-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-drawer-title"
          @keydown="handleDrawerKeydown"
        >
          <header class="help-drawer__header">
            <div><small>LD 士多</small><strong id="help-drawer-title">帮助中心目录</strong></div>
            <button type="button" aria-label="关闭目录" @click="closeDrawer()"><X :size="22" /></button>
          </header>
          <HelpSearchBox input-id="help-search-drawer" drawer />
          <nav class="help-nav help-nav--drawer" aria-label="移动端文章目录">
            <section v-for="group in groupedArticles" :key="group.id" class="help-nav__group">
              <h2>{{ group.title }}</h2>
              <router-link
                v-for="article in group.articles"
                :key="article.id"
                :to="getHelpPath(article.id)"
                :class="['help-nav__item', { 'is-active': article.id === currentArticle.id }]"
                @click="closeDrawer()"
              >
                <component :is="iconMap[article.icon]" :size="18" aria-hidden="true" />
                <span>{{ article.title }}</span>
              </router-link>
            </section>
          </nav>
          <div class="help-sidebar__footer">
            <router-link to="/support" @click="closeDrawer()"><MessageCircleQuestion :size="17" /> 联系与反馈</router-link>
            <router-link to="/" @click="closeDrawer()"><ArrowLeft :size="17" /> 返回物品广场</router-link>
          </div>
        </aside>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import StoreLogo from '@/components/common/StoreLogo.vue'
import {
  computed,
  defineAsyncComponent,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  BellRing,
  Boxes,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Compass,
  CreditCard,
  EyeOff,
  Image,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  MessageCircleQuestion,
  MessagesSquare,
  PackagePlus,
  PackageSearch,
  RotateCcw,
  ScrollText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  TicketPercent,
  TimerReset,
  Wrench,
  X
} from '@lucide/vue'
import {
  HELP_ARTICLES,
  HELP_GROUPS,
  HELP_UPDATED_AT,
  getHelpArticle,
  getHelpArticlesByGroup,
  getHelpPath,
  resolveHelpArticleId,
  searchHelpCenter
} from '@/config/helpCenter'
import { isMobileNav } from '@/config/breakpoints'

const route = useRoute()
const router = useRouter()

const iconMap = {
  BadgePercent,
  BellRing,
  Boxes,
  CircleHelp,
  ClipboardCheck,
  Compass,
  CreditCard,
  EyeOff,
  Image,
  LayoutDashboard,
  Map: MapIcon,
  MessagesSquare,
  PackagePlus,
  PackageSearch,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Store,
  TicketPercent,
  TimerReset
}

const componentMap = new Map(HELP_ARTICLES.map(article => [article.id, defineAsyncComponent(article.loader)]))
const groupedArticles = HELP_GROUPS.map(group => ({ ...group, articles: getHelpArticlesByGroup(group.id) }))
const searchQuery = ref(String(route.query.q || ''))
const searchOpen = ref(false)
const activeResultIndex = ref(0)
const drawerOpen = ref(false)
const drawerRef = ref(null)
const drawerSearchRequested = ref(false)
const menuButtonRef = ref(null)
const articleRef = ref(null)
const tableOfContents = ref([])
const activeHeading = ref('')
let searchTimer
let headingObserver
let mutationObserver
let previousBodyOverflow = ''
let drawerReturnFocus = null

const currentArticleId = computed(() => resolveHelpArticleId(route.params.section))
const currentArticle = computed(() => getHelpArticle(currentArticleId.value))
const currentComponent = computed(() => componentMap.get(currentArticleId.value))
const isLanding = computed(() => currentArticleId.value === 'quick-start')
const currentGroupTitle = computed(() => HELP_GROUPS.find(group => group.id === currentArticle.value.group)?.title || '帮助中心')
const updatedAtLabel = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${HELP_UPDATED_AT}T00:00:00`))
const searchResults = computed(() => searchHelpCenter(searchQuery.value, 8))
const relatedArticles = computed(() => currentArticle.value.related.map(getHelpArticle).filter(Boolean))
const currentIndex = computed(() => HELP_ARTICLES.findIndex(article => article.id === currentArticleId.value))
const previousArticle = computed(() => HELP_ARTICLES[currentIndex.value - 1] || null)
const nextArticle = computed(() => HELP_ARTICLES[currentIndex.value + 1] || null)

const HelpSearchBox = defineComponent({
  name: 'HelpSearchBox',
  props: {
    inputId: { type: String, required: true },
    hero: Boolean,
    drawer: Boolean
  },
  setup(props) {
    const inputRef = ref(null)
    if (props.drawer) {
      watch(drawerSearchRequested, async requested => {
        if (requested) {
          await nextTick()
          inputRef.value?.focus()
          drawerSearchRequested.value = false
        }
      }, { immediate: true })
    }

    return () => h('div', {
      class: ['help-search', { 'help-search--hero': props.hero }]
    }, [
      h('label', { class: 'sr-only', for: props.inputId }, '搜索帮助文章'),
      h('div', { class: 'help-search__field' }, [
        h(Search, { size: props.hero ? 22 : 18, 'aria-hidden': 'true' }),
        h('input', {
          ref: inputRef,
          id: props.inputId,
          value: searchQuery.value,
          type: 'search',
          placeholder: '搜索共享库存、优惠券占用、待发货…',
          autocomplete: 'off',
          role: 'combobox',
          'aria-autocomplete': 'list',
          'aria-controls': `${props.inputId}-results`,
          'aria-expanded': searchOpen.value && Boolean(searchQuery.value),
          'aria-activedescendant': searchResults.value[activeResultIndex.value]?.key ? `${props.inputId}-${searchResults.value[activeResultIndex.value].key}` : undefined,
          onInput: event => {
            searchQuery.value = event.target.value
            searchOpen.value = true
            activeResultIndex.value = 0
          },
          onFocus: () => { searchOpen.value = true },
          onKeydown: handleSearchKeydown
        }),
        searchQuery.value ? h('button', {
          type: 'button',
          class: 'help-search__clear',
          'aria-label': '清除搜索',
          onClick: () => { searchQuery.value = ''; inputRef.value?.focus() }
        }, [h(X, { size: 17 })]) : h('kbd', '⌘ K')
      ]),
      searchOpen.value && searchQuery.value ? h('div', {
        id: `${props.inputId}-results`,
        class: 'help-search__results',
        role: 'listbox'
      }, searchResults.value.length ? searchResults.value.map((result, index) => h('button', {
        id: `${props.inputId}-${result.key}`,
        key: result.key,
        type: 'button',
        role: 'option',
        'aria-selected': index === activeResultIndex.value,
        class: { 'is-active': index === activeResultIndex.value },
        onMouseenter: () => { activeResultIndex.value = index },
        onMousedown: event => event.preventDefault(),
        onClick: () => navigateToResult(result)
      }, [
        h(Search, { size: 16, 'aria-hidden': 'true' }),
        h('span', [h('strong', result.title), h('small', result.kind === 'section' ? `位于「${result.articleTitle}」` : result.summary)]),
        h(ArrowRight, { size: 15, 'aria-hidden': 'true' })
      ])) : [
        h('div', { class: 'help-search__empty' }, [
          h('strong', `没有找到“${searchQuery.value}”`),
          h('p', '试试“共享卡密”“优惠券占用”“收款配置”或“待发货”。'),
          h('div', [
            h('a', { href: '/docs/faq', onClick: handleInternalLink }, '查看常见问题'),
            h('a', { href: '/support', onClick: handleInternalLink }, '提交反馈')
          ])
        ])
      ]) : null
    ])
  }
})

function handleInternalLink(event) {
  event.preventDefault()
  searchOpen.value = false
  router.push(event.currentTarget.getAttribute('href'))
}

function handleSearchKeydown(event) {
  if (event.key === 'Escape') {
    searchOpen.value = false
    event.currentTarget.blur()
    return
  }
  if (!searchResults.value.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    searchOpen.value = true
    activeResultIndex.value = (activeResultIndex.value + 1) % searchResults.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeResultIndex.value = (activeResultIndex.value - 1 + searchResults.value.length) % searchResults.value.length
  } else if (event.key === 'Enter') {
    event.preventDefault()
    navigateToResult(searchResults.value[activeResultIndex.value])
  }
}

function navigateToResult(result) {
  if (!result) return
  searchOpen.value = false
  if (drawerOpen.value) closeDrawer(false)
  router.push(result.path)
}

function openDrawer(focusSearch = false) {
  drawerReturnFocus = document.activeElement
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  drawerOpen.value = true
  drawerSearchRequested.value = focusSearch
  nextTick(() => {
    if (!focusSearch) drawerRef.value?.querySelector('button')?.focus()
  })
}

function closeDrawer(restoreFocus = true) {
  drawerOpen.value = false
  document.body.style.overflow = previousBodyOverflow
  if (restoreFocus) nextTick(() => drawerReturnFocus?.focus?.())
}

function handleDrawerKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDrawer()
    return
  }
  if (event.key !== 'Tab') return
  const focusables = Array.from(drawerRef.value?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])') || [])
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function rebuildTableOfContents() {
  if (!articleRef.value) return
  const headings = Array.from(articleRef.value.querySelectorAll('.doc-content h2[id], .doc-content h3[id]'))
  tableOfContents.value = headings.map(heading => ({ id: heading.id, text: heading.textContent.trim(), level: heading.tagName === 'H2' ? 2 : 3 }))
  activeHeading.value = headings[0]?.id || ''
  headingObserver?.disconnect()
  headingObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
    if (visible[0]) activeHeading.value = visible[0].target.id
  }, { rootMargin: '-96px 0px -68% 0px', threshold: [0, 1] })
  headings.forEach(heading => headingObserver.observe(heading))
}

function handleTocClick(event, id) {
  event.preventDefault()
  document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  history.replaceState(history.state, '', `${route.path}${route.query.q ? `?q=${encodeURIComponent(route.query.q)}` : ''}#${id}`)
  activeHeading.value = id
}

function scrollToRouteHash() {
  if (!route.hash) return
  window.setTimeout(() => document.getElementById(route.hash.slice(1))?.scrollIntoView({ block: 'start' }), 80)
}

watch(searchQuery, value => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    const query = { ...route.query }
    if (value.trim()) query.q = value.trim()
    else delete query.q
    if (String(route.query.q || '') !== String(query.q || '')) router.replace({ query, hash: route.hash })
  }, 180)
})

watch(() => route.query.q, value => {
  if (String(value || '') !== searchQuery.value) searchQuery.value = String(value || '')
})

watch(() => [route.params.section, route.hash], async () => {
  if (drawerOpen.value) closeDrawer(false)
  document.title = `${currentArticle.value.title} - LD 士多帮助中心`
  await nextTick()
  rebuildTableOfContents()
  scrollToRouteHash()
}, { immediate: true })

function handleGlobalKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    const target = isMobileNav(window.innerWidth) ? document.getElementById('help-search-drawer') : document.getElementById(isLanding.value ? 'help-search-hero' : 'help-search-desktop')
    if (target) target.focus()
    else openDrawer(true)
  }
}

function handleDocumentPointer(event) {
  if (!event.target.closest('.help-search')) searchOpen.value = false
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('pointerdown', handleDocumentPointer)
  mutationObserver = new MutationObserver(() => rebuildTableOfContents())
  if (articleRef.value) mutationObserver.observe(articleRef.value, { childList: true, subtree: true })
  rebuildTableOfContents()
  scrollToRouteHash()
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
  document.removeEventListener('keydown', handleGlobalKeydown)
  document.removeEventListener('pointerdown', handleDocumentPointer)
  headingObserver?.disconnect()
  mutationObserver?.disconnect()
  if (drawerOpen.value) document.body.style.overflow = previousBodyOverflow
})
</script>

<style src="@/components/docs/doc-styles.css"></style>
