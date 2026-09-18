import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'

export const SUPPORTED_LANGUAGES = ['en', 'zh', 'ja', 'ko'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

const resources = {
  en: {
    translation: {
      app: {
        badge: 'oai-tts-router',
        kicker: 'OpenAI-compatible TTS',
        title: 'Speech Studio',
        description: 'Route speech requests across multiple providers and inspect the generated audio.',
      },
      language: { label: 'Language' },
      connection: {
        idle: 'Not connected',
        loading: 'Connecting',
        online: 'Online',
        auth: 'API key required',
        offline: 'Offline',
      },
      header: {
        github: 'GitHub repository',
        docs: 'API documentation',
        settings: 'Settings',
        history: 'History',
        settingsTooltip: 'Connection and synthesis settings',
        historyTooltip: 'Recent generations',
      },
      settings: {
        connectionTitle: 'Connection',
        connectionDescription: 'Point the studio at any compatible router.',
        baseUrl: 'Base URL',
        apiKey: 'API key',
        apiKeyPlaceholder: 'Optional Bearer token',
        refresh: 'Refresh models',
        advancedTitle: 'Advanced params',
        advancedDescription: 'Merge provider-specific JSON.',
        advancedHint: 'Merged last, so these values can override standard parameters.',
        invalidJsonObject: 'Must be a JSON object',
        invalidJson: 'Invalid JSON',
        historyTitle: 'History storage',
        historyDescription: 'Stored locally in IndexedDB.',
        historyLimit: 'Maximum entries',
        historyLimitHint: 'Between 1 and 200. Default is 30.',
      },
      sheet: {
        settingsTitle: 'Settings',
        settingsDescription: 'Configure the router connection and synthesis defaults.',
        historyTitle: 'History',
        historyDescription: 'Reopen generated audio stored in this browser.',
      },
      composer: {
        placeholder: 'Describe what you want to hear...',
        model: 'Model',
        voice: 'Voice',
        format: 'Format',
        speed: 'Speed',
        instructions: 'Instructions',
        instructionsPlaceholder: 'Tone, pacing, emotion, style...',
        searchModel: 'Search models',
        searchVoice: 'Search voices',
        chooseModel: 'Choose a model',
        chooseVoice: 'Choose a voice',
        defaultVoice: 'Provider default',
        noResult: 'No result found.',
        generate: 'Generate',
        stop: 'Stop',
        overLimit: 'Over limit',
        enterHint: 'Enter',
        generated: 'Speech generated',
        cancelled: 'Generation cancelled',
        failed: 'Generation failed',
      },
      result: {
        title: 'Output',
        generating: 'Generating',
        decoding: 'Decoding',
        synthesizing: 'Synthesizing audio...',
        emptyTitle: 'No audio generated yet',
        emptyDescription: 'Choose a model, write a prompt, then press Generate.',
        ready: 'Ready',
        play: 'Play audio',
        pause: 'Pause audio',
        rewind: 'Rewind 5 seconds',
        skip: 'Skip 5 seconds',
        mute: 'Toggle mute',
        download: 'Download',
        clear: 'Clear current output',
        autoplay: 'Autoplay new generations',
        request: 'Request',
        copyJson: 'Copy JSON',
        copied: 'Request JSON copied',
        playbackFailed: 'Browser playback failed. The generated file can still be downloaded.',
        audioPosition: 'Audio position',
      },
      history: {
        title: 'History',
        description: 'Persisted generations from IndexedDB.',
        searchPlaceholder: 'Search history',
        clear: 'Clear generation history',
        remove: 'Remove generation',
        emptyTitle: 'No generations yet',
        emptyDescription: 'Generated audio will appear here and persist across reloads.',
        noMatchTitle: 'No matches',
        noMatchDescription: 'Try a model, voice, or text search.',
        defaultVoice: 'default voice',
        justNow: 'just now',
        minutesAgo: '{{count}}m ago',
        hoursAgo: '{{count}}h ago',
        daysAgo: '{{count}}d ago',
        loading: 'Loading history...',
      },
      toast: {
        modelsUpdated: 'Model list updated',
        modelsFailed: 'Failed to load models',
        connectFailed: 'Failed to connect to the TTS router',
      },
      error: {
        emptyInput: 'Enter text to synthesize.',
        invalidExtra: 'Advanced params must be a JSON object.',
      },
    },
  },
  zh: {
    translation: {
      app: {
        badge: 'oai-tts-router',
        kicker: 'OpenAI 兼容 TTS',
        title: '语音工作台',
        description: '跨多个 Provider 路由语音请求，并试听生成的音频。',
      },
      language: { label: '语言' },
      connection: {
        idle: '未连接',
        loading: '连接中',
        online: '在线',
        auth: '需要 API Key',
        offline: '离线',
      },
      header: {
        github: 'GitHub 仓库',
        docs: 'API 文档',
        settings: '设置',
        history: '历史',
        settingsTooltip: '连接与合成设置',
        historyTooltip: '最近生成记录',
      },
      settings: {
        connectionTitle: '连接',
        connectionDescription: '连接任意兼容的 TTS Router。',
        baseUrl: 'Base URL',
        apiKey: 'API Key',
        apiKeyPlaceholder: '可选 Bearer Token',
        refresh: '刷新模型',
        advancedTitle: '高级参数',
        advancedDescription: '合并 Provider 专属 JSON。',
        advancedHint: '最后合并，可覆盖标准参数。',
        invalidJsonObject: '必须是 JSON 对象',
        invalidJson: 'JSON 格式错误',
        historyTitle: '历史存储',
        historyDescription: '保存在浏览器 IndexedDB。',
        historyLimit: '最大记录数',
        historyLimitHint: '范围 1 至 200，默认 30。',
      },
      sheet: {
        settingsTitle: '设置',
        settingsDescription: '配置 Router 连接与合成默认值。',
        historyTitle: '历史',
        historyDescription: '重新打开保存在当前浏览器中的音频。',
      },
      composer: {
        placeholder: '描述你想听到的内容……',
        model: '模型',
        voice: '音色',
        format: '格式',
        speed: '语速',
        instructions: '指令',
        instructionsPlaceholder: '语气、节奏、情绪、风格……',
        searchModel: '搜索模型',
        searchVoice: '搜索音色',
        chooseModel: '选择模型',
        chooseVoice: '选择音色',
        defaultVoice: 'Provider 默认',
        noResult: '无匹配结果。',
        generate: '生成',
        stop: '停止',
        overLimit: '超出限制',
        enterHint: 'Enter',
        generated: '语音生成完成',
        cancelled: '已取消生成',
        failed: '生成失败',
      },
      result: {
        title: '输出',
        generating: '生成中',
        decoding: '解析中',
        synthesizing: '正在合成音频……',
        emptyTitle: '尚未生成音频',
        emptyDescription: '选择模型，输入文本，然后点击生成。',
        ready: '就绪',
        play: '播放音频',
        pause: '暂停音频',
        rewind: '后退 5 秒',
        skip: '前进 5 秒',
        mute: '静音切换',
        download: '下载',
        clear: '清除当前输出',
        autoplay: '自动播放新生成音频',
        request: '请求',
        copyJson: '复制 JSON',
        copied: '请求 JSON 已复制',
        playbackFailed: '浏览器播放失败，但生成的文件仍可下载。',
        audioPosition: '音频位置',
      },
      history: {
        title: '历史',
        description: '来自 IndexedDB 的持久化记录。',
        searchPlaceholder: '搜索历史',
        clear: '清空生成历史',
        remove: '删除记录',
        emptyTitle: '暂无生成记录',
        emptyDescription: '生成的音频会显示在这里，并在刷新后保留。',
        noMatchTitle: '无匹配记录',
        noMatchDescription: '尝试搜索模型、音色或文本。',
        defaultVoice: '默认音色',
        justNow: '刚刚',
        minutesAgo: '{{count}} 分钟前',
        hoursAgo: '{{count}} 小时前',
        daysAgo: '{{count}} 天前',
        loading: '正在加载历史……',
      },
      toast: {
        modelsUpdated: '模型列表已更新',
        modelsFailed: '加载模型失败',
        connectFailed: '连接 TTS Router 失败',
      },
      error: {
        emptyInput: '请输入要合成的文本。',
        invalidExtra: '高级参数必须是 JSON 对象。',
      },
    },
  },
  ja: {
    translation: {
      app: {
        badge: 'oai-tts-router',
        kicker: 'OpenAI 互換 TTS',
        title: 'スピーチスタジオ',
        description: '複数の Provider に音声リクエストをルーティングし、生成音声を確認します。',
      },
      language: { label: '言語' },
      connection: {
        idle: '未接続',
        loading: '接続中',
        online: 'オンライン',
        auth: 'API Key が必要',
        offline: 'オフライン',
      },
      header: {
        github: 'GitHub リポジトリ',
        docs: 'API ドキュメント',
        settings: '設定',
        history: '履歴',
        settingsTooltip: '接続と合成の設定',
        historyTooltip: '最近の生成履歴',
      },
      settings: {
        connectionTitle: '接続',
        connectionDescription: '互換性のある TTS Router に接続します。',
        baseUrl: 'Base URL',
        apiKey: 'API Key',
        apiKeyPlaceholder: '任意の Bearer Token',
        refresh: 'モデルを更新',
        advancedTitle: '詳細パラメータ',
        advancedDescription: 'Provider 固有の JSON をマージします。',
        advancedHint: '最後にマージされ、標準パラメータを上書きできます。',
        invalidJsonObject: 'JSON オブジェクトが必要です',
        invalidJson: 'JSON が不正です',
        historyTitle: '履歴ストレージ',
        historyDescription: 'ブラウザーの IndexedDB に保存します。',
        historyLimit: '最大保存数',
        historyLimitHint: '1 から 200。既定値は 30。',
      },
      sheet: {
        settingsTitle: '設定',
        settingsDescription: 'Router 接続と合成の既定値を設定します。',
        historyTitle: '履歴',
        historyDescription: 'このブラウザーに保存された音声を開きます。',
      },
      composer: {
        placeholder: '聞きたい内容を入力してください……',
        model: 'モデル',
        voice: '音声',
        format: '形式',
        speed: '速度',
        instructions: '指示',
        instructionsPlaceholder: '口調、速度、感情、スタイル……',
        searchModel: 'モデルを検索',
        searchVoice: '音声を検索',
        chooseModel: 'モデルを選択',
        chooseVoice: '音声を選択',
        defaultVoice: 'Provider 既定',
        noResult: '結果がありません。',
        generate: '生成',
        stop: '停止',
        overLimit: '上限超過',
        enterHint: 'Enter',
        generated: '音声を生成しました',
        cancelled: '生成をキャンセルしました',
        failed: '生成に失敗しました',
      },
      result: {
        title: '出力',
        generating: '生成中',
        decoding: '解析中',
        synthesizing: '音声を合成しています……',
        emptyTitle: '音声はまだありません',
        emptyDescription: 'モデルを選び、テキストを入力して生成してください。',
        ready: '準備完了',
        play: '音声を再生',
        pause: '音声を一時停止',
        rewind: '5 秒戻る',
        skip: '5 秒進む',
        mute: 'ミュート切替',
        download: 'ダウンロード',
        clear: '現在の出力を消去',
        autoplay: '新しい音声を自動再生',
        request: 'リクエスト',
        copyJson: 'JSON をコピー',
        copied: 'リクエスト JSON をコピーしました',
        playbackFailed: 'ブラウザーで再生できません。ファイルはダウンロードできます。',
        audioPosition: '音声位置',
      },
      history: {
        title: '履歴',
        description: 'IndexedDB に保存された生成履歴。',
        searchPlaceholder: '履歴を検索',
        clear: '生成履歴を消去',
        remove: '履歴を削除',
        emptyTitle: '履歴はありません',
        emptyDescription: '生成した音声はここに表示され、再読み込み後も保持されます。',
        noMatchTitle: '一致なし',
        noMatchDescription: 'モデル、音声、テキストで検索してください。',
        defaultVoice: '既定の音声',
        justNow: 'たった今',
        minutesAgo: '{{count}} 分前',
        hoursAgo: '{{count}} 時間前',
        daysAgo: '{{count}} 日前',
        loading: '履歴を読み込み中……',
      },
      toast: {
        modelsUpdated: 'モデル一覧を更新しました',
        modelsFailed: 'モデルの読み込みに失敗しました',
        connectFailed: 'TTS Router に接続できません',
      },
      error: {
        emptyInput: '合成するテキストを入力してください。',
        invalidExtra: '詳細パラメータは JSON オブジェクトにしてください。',
      },
    },
  },
  ko: {
    translation: {
      app: {
        badge: 'oai-tts-router',
        kicker: 'OpenAI 호환 TTS',
        title: '음성 스튜디오',
        description: '여러 Provider로 음성 요청을 라우팅하고 생성된 오디오를 확인합니다.',
      },
      language: { label: '언어' },
      connection: {
        idle: '연결 안 됨',
        loading: '연결 중',
        online: '온라인',
        auth: 'API Key 필요',
        offline: '오프라인',
      },
      header: {
        github: 'GitHub 저장소',
        docs: 'API 문서',
        settings: '설정',
        history: '기록',
        settingsTooltip: '연결 및 합성 설정',
        historyTooltip: '최근 생성 기록',
      },
      settings: {
        connectionTitle: '연결',
        connectionDescription: '호환되는 TTS Router에 연결합니다.',
        baseUrl: 'Base URL',
        apiKey: 'API Key',
        apiKeyPlaceholder: '선택적 Bearer Token',
        refresh: '모델 새로고침',
        advancedTitle: '고급 파라미터',
        advancedDescription: 'Provider 전용 JSON을 병합합니다.',
        advancedHint: '마지막에 병합되어 표준 파라미터를 덮어쓸 수 있습니다.',
        invalidJsonObject: 'JSON 객체여야 합니다',
        invalidJson: 'JSON 형식 오류',
        historyTitle: '기록 저장소',
        historyDescription: '브라우저 IndexedDB에 저장합니다.',
        historyLimit: '최대 기록 수',
        historyLimitHint: '1에서 200 사이이며 기본값은 30입니다.',
      },
      sheet: {
        settingsTitle: '설정',
        settingsDescription: 'Router 연결과 합성 기본값을 설정합니다.',
        historyTitle: '기록',
        historyDescription: '이 브라우저에 저장된 생성 음성을 다시 엽니다.',
      },
      composer: {
        placeholder: '듣고 싶은 내용을 입력하세요...',
        model: '모델',
        voice: '음성',
        format: '형식',
        speed: '속도',
        instructions: '지시',
        instructionsPlaceholder: '말투, 속도, 감정, 스타일...',
        searchModel: '모델 검색',
        searchVoice: '음성 검색',
        chooseModel: '모델 선택',
        chooseVoice: '음성 선택',
        defaultVoice: 'Provider 기본',
        noResult: '결과가 없습니다.',
        generate: '생성',
        stop: '중지',
        overLimit: '제한 초과',
        enterHint: 'Enter',
        generated: '음성을 생성했습니다',
        cancelled: '생성을 취소했습니다',
        failed: '생성 실패',
      },
      result: {
        title: '출력',
        generating: '생성 중',
        decoding: '분석 중',
        synthesizing: '오디오 합성 중...',
        emptyTitle: '아직 생성된 오디오가 없습니다',
        emptyDescription: '모델을 선택하고 텍스트를 입력한 뒤 생성하세요.',
        ready: '준비됨',
        play: '오디오 재생',
        pause: '오디오 일시정지',
        rewind: '5초 뒤로',
        skip: '5초 앞으로',
        mute: '음소거 전환',
        download: '다운로드',
        clear: '현재 출력 지우기',
        autoplay: '새 생성 오디오 자동 재생',
        request: '요청',
        copyJson: 'JSON 복사',
        copied: '요청 JSON을 복사했습니다',
        playbackFailed: '브라우저 재생에 실패했습니다. 생성된 파일은 다운로드할 수 있습니다.',
        audioPosition: '오디오 위치',
      },
      history: {
        title: '기록',
        description: 'IndexedDB에 저장된 생성 기록입니다.',
        searchPlaceholder: '기록 검색',
        clear: '생성 기록 지우기',
        remove: '기록 삭제',
        emptyTitle: '기록이 없습니다',
        emptyDescription: '생성한 오디오가 여기에 표시되며 새로고침 후에도 유지됩니다.',
        noMatchTitle: '일치 항목 없음',
        noMatchDescription: '모델, 음성 또는 텍스트로 검색하세요.',
        defaultVoice: '기본 음성',
        justNow: '방금 전',
        minutesAgo: '{{count}}분 전',
        hoursAgo: '{{count}}시간 전',
        daysAgo: '{{count}}일 전',
        loading: '기록 로딩 중...',
      },
      toast: {
        modelsUpdated: '모델 목록을 업데이트했습니다',
        modelsFailed: '모델을 불러오지 못했습니다',
        connectFailed: 'TTS Router 연결 실패',
      },
      error: {
        emptyInput: '합성할 텍스트를 입력하세요.',
        invalidExtra: '고급 파라미터는 JSON 객체여야 합니다.',
      },
    },
  },
} as const

function normalizeLanguage(value: string | null | undefined): SupportedLanguage | undefined {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return undefined
  if (normalized.startsWith('zh')) return 'zh'
  if (normalized.startsWith('ja')) return 'ja'
  if (normalized.startsWith('ko')) return 'ko'
  if (normalized.startsWith('en')) return 'en'
  return undefined
}

function readStoredLanguage(): SupportedLanguage | undefined {
  try {
    return normalizeLanguage(localStorage.getItem('oai-tts-router-language'))
  } catch {
    return undefined
  }
}

function storeLanguage(language: SupportedLanguage): void {
  try {
    localStorage.setItem('oai-tts-router-language', language)
  } catch {
    // URL and runtime language still work when storage is unavailable.
  }
}

function detectLanguage(): SupportedLanguage {
  const queryLanguage = normalizeLanguage(new URLSearchParams(window.location.search).get('lang'))
  if (queryLanguage) return queryLanguage

  const storedLanguage = readStoredLanguage()
  if (storedLanguage) return storedLanguage

  for (const candidate of navigator.languages) {
    const detected = normalizeLanguage(candidate)
    if (detected) return detected
  }

  return 'en'
}

function syncLanguageUrl(language: SupportedLanguage): void {
  const url = new URL(window.location.href)
  url.searchParams.set('lang', language)
  window.history.replaceState({}, '', url)
}

const initialLanguage = detectLanguage()
const i18n = createInstance()

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
})

storeLanguage(initialLanguage)
syncLanguageUrl(initialLanguage)
document.documentElement.lang = initialLanguage

i18n.on('languageChanged', language => {
  const normalized = normalizeLanguage(language) ?? 'en'
  storeLanguage(normalized)
  syncLanguageUrl(normalized)
  document.documentElement.lang = normalized
})

export async function changeLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language)
}

export default i18n
