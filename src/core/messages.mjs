// User-visible core messages shared by the embedded modules.
//
// The plugin injects a translator `t(key, params)` (see src/i18n) so these strings follow the
// selected UI locale. When no translator is injected — standalone use or the existing unit
// tests — the original Chinese text is used, keeping the core modules usable on their own.
export const CORE_TEXT = Object.freeze({
    'core.errors.urlScheme': '地址须以 http:// 或 https:// 开头，例如 http://192.168.1.10:1234/v1',
    'core.errors.urlInvalid': 'API 地址无效，请检查 IP、端口和路径',
    'core.errors.urlCredentials': '地址不能包含用户名、密码或 # 片段',
    'core.errors.api401': '鉴权失败，请检查 API Key',
    'core.errors.api403': '服务拒绝访问，请检查密钥及访问权限',
    'core.errors.api404': '接口不存在，请检查端口和完整路径',
    'core.errors.api429': 'AI 服务限流，请稍后手动重试',
    'core.errors.apiGeneric': 'AI 请求失败（HTTP {status}）',
    'core.errors.apiDetailSeparator': '：',
    'core.errors.apiReturnedError': 'AI 返回错误',
    'core.errors.finishReason': 'AI 输出未正常结束（{reason}）',
    'core.errors.sseMalformed': 'AI 流式响应格式异常，已保留收到的内容',
    'core.errors.sseInterrupted': 'AI 流式连接在结束前中断，已保留收到的内容，可手动重试',
    'core.errors.notSseOrJson': 'AI 未返回有效的 SSE 或 JSON，请检查是否填入了网页地址',
    'core.errors.emptyContent': 'AI 返回了空内容，请检查模型名称及服务日志',
    'core.errors.gmMissing': '脚本管理器未提供 GM_xmlhttpRequest，请检查脚本是否获得运行权限',
    'core.errors.idleTimeout': 'AI 服务两分钟未返回数据，已停止；可检查模型加载状态后重试',
    'core.errors.totalTimeout': 'AI 请求超过十分钟，已停止',
    'core.errors.discontinuousResponse': '脚本管理器返回了不连续的响应，请启用“兼容模式”后重试',
    'core.errors.connectFailed': '无法连接 AI 服务。请检查服务是否启动、地址与端口、篡改猴目标主机授权及浏览器本地网络权限；此错误无法单独判断具体原因',
    'core.errors.requestTimeout': 'AI 请求超时，请检查服务与模型是否已就绪',
    'core.errors.promptTooLong': '自定义提示词过长，请缩短提示词或提高输入预算',
    'core.errors.noContent': '没有可总结的内容',
    'core.errors.truncatedOutput': 'AI 输出达到长度上限，已保留部分内容；请提高输出上限后重试',
    'core.errors.packTooLong': '帖子作者信息超过输入预算，请提高预算',
    'core.errors.digestNotCompressed': '分段摘要未能压缩到输入预算，请增大输入预算或缩短自定义提示词；已保留完成的摘要',
    'core.errors.tooManyLayers': '汇总层级过多，已停止并保留分段结果，请缩小楼层范围',
    'core.progress.segment': '分段汇总 {current}/{total}{layer}；初始预计至少 {calls} 次调用',
    'core.progress.segmentLayer': '（第{layer}层）',
    'core.progress.finalMulti': '正在生成最终总结…',
    'core.progress.finalSingle': '正在总结（预计 1 次调用）…',
    'core.progress.rateLimited': '站点限流，等待后继续…',
    'core.progress.waiting': '正在按间隔读取…',
    'core.progress.waitDetail': '等待约 {seconds} 秒，可随时停止',
    'core.progress.retrying': '读取暂时失败，稍后重试…',
    'core.progress.readingFloors': '正在读取第 {start}—{end} 楼…',
    'core.progress.readingDetail': '楼层空缺保留原编号，只读取当前账户可见的内容',
    'core.errors.foreignTopicPosts': '站点返回了不属于当前话题的帖子',
    'core.errors.topicInfoMalformed': '话题信息格式异常',
    'core.errors.invalidRange': '请输入有效的整数楼层范围',
    'core.errors.postStreamMalformed': '帖子正文格式异常',
    'core.errors.noProgress': '站点未返回后续楼层，请刷新后重试',
    'core.topic.untitled': '未命名话题',
    'core.warnings.imageTooLarge': '图片超过单图 20 MiB 限制',
    'core.warnings.imagesTooLargeTotal': '资源总量超过 100 MiB 限制',
    'core.warnings.imageBudgetTotal': '资源总量达到 100 MiB 限制',
    'core.warnings.crossOriginNeedsGrant': '跨域图片需要脚本管理器授权',
    'core.warnings.notAnImage': '响应不是图片',
    'core.warnings.imageDownloadTimeout': '图片下载超时',
    'core.warnings.imageDownloadFailed': '图片连接失败或目标主机未授权',
    'core.warnings.imageEncodeFailed': '图片编码失败',
    'core.warnings.resourceNotEmbedded': '资源未能嵌入',
    'core.media.coverAlt': '媒体封面',
    'core.media.audioNote': '音频内容需联网查看：',
    'core.media.mediaNote': '媒体内容需联网查看：',
    'core.media.visitOriginal': '请访问原帖',
    'core.media.imageUnavailable': '[图片地址不可用]',
    'core.media.mathSource': '公式源码'
});

function interpolate(text, params) {
    if (!params) return text;
    return String(text).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => (
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
    ));
}

/** Translate a core message through an injected translator, falling back to the built-in text. */
export function tr(t, key, params) {
    const fallback = CORE_TEXT[key] ?? key;
    if (typeof t !== 'function') return interpolate(fallback, params);
    try {
        const value = t(key, params);
        return typeof value === 'string' && value && value !== key ? value : interpolate(fallback, params);
    } catch {
        return interpolate(fallback, params);
    }
}
