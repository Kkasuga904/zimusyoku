import { useMemo } from "react";

export type SupportedLocale = "ja" | "en";

export type Strings = {
  common: {
    appTitle: string;
    loading: string;
    close: string;
    retry: string;
    openGuide: string;
  };
  nav: {
    dashboard: string;
    jobs: string;
    upload: string;
    help: string;
  };
  home: {
    title: string;
    intro: string;
    stepsHeading: string;
    steps: string[];
    startUpload: string;
    openJobs: string;
    guideLink: string;
    guideDescription: string;
  };
  upload: {
    title: string;
    description: string;
    step1: string;
    step2: string;
    step3: string;
    instructions: string;
    helperFormats: string;
    selectButton: string;
    submitButton: string;
    linkToJobs: string;
    noFile: string;
    selectedFile: (name: string) => string;
    selectedFiles: (count: number) => string;
    changeFile: string;
    clearSelection: string;
    jobsShortcut: string;
    tooLarge: string;
    fileTooLarge: (name: string) => string;
    unsupported: string;
    fileUnsupported: (name: string) => string;
    uploading: string;
    uploadingBatch: (current: number, total: number) => string;
    success: (jobId: string) => string;
    successMultiple: (count: number) => string;
    failed: string;
    loginRequired: string;
    tryAgain: string;
    viewJobDetail: string;
    ariaStatus: string;
    selectType: string;
    types: {
      invoice: string;
      receipt: string;
      estimate: string;
    };
    pipeline: {
      uploaded: string;
      ocr: string;
      classify: string;
      posted: string;
    };
  };
  jobs: {
    title: string;
    description: string;
    tableCaption: string;
    columns: {
      id: string;
      fileName: string;
      documentType: string;
      status: string;
      classification: string;
      amount: string;
      submittedAt: string;
      updatedAt: string;
    };
    loading: string;
    empty: string;
    emptyAction: string;
    openUpload: string;
    reload: string;
    error: string;
    pollError: string;
    updatedAt: (time: string) => string;
    statusLabels: Record<string, string>;
    viewDetail: string;
    exportCsv: string;
    exporting: string;
    exportError: string;
    pendingClassification: string;
    amountUnavailable: string;
  };
  jobDetail: {
    title: string;
    intro: string;
    statusQueued: string;
    statusRunning: string;
    statusOk: string;
    statusFailed: string;
    statusDescriptions: Record<string, string>;
    pollingInfo: string;
    stopPolling: string;
    resumePolling: string;
    pollingStopped: string;
    lastChecked: (time: string) => string;
    fileName: string;
    startedAt: string;
    updatedAt: string;
    amountGross: string;
    amountNet: string;
    tax: string;
    amountUnavailable: string;
    backToJobs: string;
    notFound: string;
  };
  help: {
    title: string;
    intro: string;
    featureList: string[];
    stepsTitle: string;
    steps: string[];
    waitingTitle: string;
    waiting: string[];
    issuesTitle: string;
    tips: string[];
    securityTitle: string;
    security: string[];
    diagramTitle: string;
    diagramLines: string[];
    close: string;
  };
  summary: {
    title: string;
    loading: string;
    error: string;
    offline: string;
    totalSpend: string;
    journalCount: string;
    month: string;
    pieTitle: string;
    barTitle: string;
    noData: string;
    breakdownLabel: string;
  };
  auth: {
    title: string;
    email: string;
    password: string;
    submit: string;
    signingIn: string;
    invalid: string;
    sessionExpired: string;
    logout: string;
  };
};

export const ja: Strings = {
  common: {
    appTitle: "Zimusyoku コンソール",
    loading: "読み込み中…",
    close: "閉じる",
    retry: "再試行",
    openGuide: "ガイドを開く",
  },
  nav: {
    dashboard: "ダッシュボード",
    jobs: "ジョブ一覧",
    upload: "アップロード",
    help: "ヘルプ",
  },
  home: {
    title: "はじめに",
    intro: "請求書・領収書をアップロードすると、自動でOCR解析と仕訳登録が行われます。",
    stepsHeading: "処理の流れ",
    steps: [
      "1. ファイルを選択してアップロード",
      "2. OCRで読み取りとAI分類を実行",
      "3. 結果を確認し仕訳データをダウンロード",
    ],
    startUpload: "アップロード画面へ",
    openJobs: "ジョブ一覧を見る",
    guideLink: "ユーザーガイド",
    guideDescription: "詳しい操作手順やトラブルシューティングはガイドをご覧ください。",
  },
  upload: {
    title: "ファイルのアップロード",
    description:
      "請求書・領収書・見積書をアップロードすると、OCR解析とAI分類、仕訳作成まで自動で進みます。",
    step1: "1. ファイルを選択",
    step2: "2. 送信・処理状況を確認",
    step3: "3. 結果を確認",
    instructions: "ファイルを選択し「送信する」を押すと自動で処理が開始されます。",
    helperFormats: "対応形式: PDF / CSV / XLSX / ZIP / JPEG（JPG）（最大 50MB）",
    selectButton: "ファイルを選択",
    submitButton: "送信する",
    linkToJobs: "ジョブ一覧を開く",
    noFile: "ファイルが選択されていません。",
    selectedFile: (name) => `選択中: ${name}`,
    selectedFiles: (count) => `選択中のファイル: ${count}件`,
    changeFile: "別のファイルを選択",
    clearSelection: "選択をクリア",
    jobsShortcut: "送信後はジョブ一覧で進捗が確認できます。",
    tooLarge: "ファイルサイズが大きすぎます（最大 50MB）。",
    fileTooLarge: (name) => `${name} のサイズが大きすぎます（最大 50MB）。`,
    unsupported: "対応していない形式です。PDF / CSV / XLSX / ZIP / JPEG（JPG）をご利用ください。",
    fileUnsupported: (name) => `${name} は対応していない形式です。PDF / CSV / XLSX / ZIP / JPEG（JPG）をご利用ください。`,
    uploading: "送信中...",
    uploadingBatch: (current, total) => `ファイルを送信中 (${current}/${total})`,
    success: (jobId) => `ジョブ ${jobId} を受け付けました。結果はジョブ一覧から確認できます。`,
    successMultiple: (count) => `${count} 件のファイルを送信しました。`,
    failed: "アップロードに失敗しました。ネットワークを確認のうえ再度お試しください。",
    loginRequired: "ログインしてから再度お試しください。",
    tryAgain: "もう一度試す",
    viewJobDetail: "ジョブ詳細を見る",
    ariaStatus: "処理の進捗状況",
    selectType: "書類種別を選択",
    types: {
      invoice: "請求書",
      receipt: "領収書",
      estimate: "見積書",
    },
    pipeline: {
      uploaded: "アップロード完了",
      ocr: "OCR解析中",
      classify: "AI分類中",
      posted: "仕訳登録完了",
    },
  },
  jobs: {
    title: "ジョブ一覧",
    description:
      "アップロード済みのファイルと処理状況を確認します。分類が完了すると勘定科目が表示されます。",
    tableCaption: "送信済みジョブ",
    columns: {
      id: "ジョブID",
      fileName: "ファイル名",
      documentType: "区分",
      status: "ステータス",
      classification: "分類結果",
      amount: "金額（税込）",
      submittedAt: "受付日時",
      updatedAt: "最終更新",
    },
    loading: "ジョブを読み込み中…",
    empty: "まだジョブがありません。ファイルをアップロードしてください。",
    emptyAction: "ファイルをアップロード",
    openUpload: "アップロード画面へ",
    reload: "再読み込み",
    error: "ジョブの取得に失敗しました。時間をおいて再度お試しください。",
    pollError: "最新の状態を取得できませんでした。ネットワークを確認のうえ再試行してください。",
    updatedAt: (time) => `更新: ${time}`,
    statusLabels: {
      Queued: "待機中",
      Running: "処理中",
      Ok: "完了",
      Failed: "失敗",
    },
    viewDetail: "詳細を見る",
    exportCsv: "CSVをダウンロード",
    exporting: "生成中…",
    exportError: "CSVの生成に失敗しました。",
    pendingClassification: "分類待ち",
    amountUnavailable: "金額なし",
  },
  jobDetail: {
    title: "ジョブ詳細",
    intro: "処理状況を確認します。完了すると分類結果がジョブ一覧に反映されます。",
    statusQueued: "待機中",
    statusRunning: "処理中",
    statusOk: "完了",
    statusFailed: "失敗",
    statusDescriptions: {
      Queued: "処理待ちの状態です。まもなく開始します。",
      Running: "OCR と AI 分類を実行中です。しばらくお待ちください。",
      Ok: "処理が完了しました。必要に応じてCSVを出力できます。",
      Failed: "処理に失敗しました。ファイル内容を確認して再送信してください。",
    },
    pollingInfo: "ステータスは5秒ごとに自動更新されます。",
    stopPolling: "自動更新を停止",
    resumePolling: "自動更新を再開",
    pollingStopped: "自動更新を停止しています。再開ボタンを押してください。",
    lastChecked: (time) => `最終確認時刻: ${time}`,
    fileName: "ファイル名",
    startedAt: "受付日時",
    updatedAt: "最終更新",
    amountGross: "金額（税込）",
    amountNet: "金額（税抜）",
    tax: "税額",
    amountUnavailable: "金額情報がありません。",
    backToJobs: "ジョブ一覧へ戻る",
    notFound: "該当するジョブが見つかりませんでした。ジョブ一覧から選び直してください。",
  },
  help: {
    title: "クイックヘルプ",
    intro: "日々の経理作業を自動化するためのポイントをまとめました。",
    featureList: [
      "アップロードしたファイルの処理状況を一目で確認できます。",
      "OCR→AI分類→仕訳登録まで自動で実行されます。",
      "CSVエクスポートで会計システムへの連携も簡単です。",
    ],
    stepsTitle: "基本ステップ",
    steps: ["1. ファイルをアップロード", "2. ジョブ一覧で進捗確認", "3. 完了後に仕訳をダウンロード"],
    waitingTitle: "時間がかかる場合",
    waiting: [
      "混み合っている場合は数分かかることがあります。",
      "ジョブ一覧のリロードで最新の状態を取得できます。",
    ],
    issuesTitle: "エラーが出た場合",
    tips: [
      "50MB超のファイルは分割してアップロードしてください。",
      "対応していない形式の場合はPDFなどへ変換してください。",
      "ネットワークを確認のうえ再送信してください。",
    ],
    securityTitle: "セキュリティの注意",
    security: [
      "社外秘情報は権限のあるメンバーのみ共有してください。",
      "個人情報が含まれる場合は社内ポリシーに従って管理してください。",
      "APIキーやパスワードは必ず環境変数で管理してください。",
    ],
    diagramTitle: "処理イメージ",
    diagramLines: [
      "アップロード → OCR解析 → AI分類 → 仕訳登録 → ダッシュボード反映",
    ],
    close: "閉じる",
  },
  summary: {
    title: "ダッシュボード",
    loading: "集計データを読み込み中…",
    error: "集計データの取得に失敗しました。",
    totalSpend: "月次支出合計",
    journalCount: "仕訳件数",
    month: "対象月",
    pieTitle: "費目別比率",
    barTitle: "費目別支出額",
    noData: "まだ集計データがありません。ジョブを完了させるとここに表示されます。",
    breakdownLabel: "費目別集計",
  },
  auth: {
    title: "ログイン",
    email: "メールアドレス",
    password: "パスワード",
    submit: "サインイン",
    signingIn: "サインイン中…",
    invalid: "認証に失敗しました。メールアドレスとパスワードをご確認ください。",
    sessionExpired: "セッションの有効期限が切れました。再度サインインしてください。",
    logout: "ログアウト",
  },
};

export const en: Strings = {
  common: {
    appTitle: "Zimusyoku Console",
    loading: "Loading…",
    close: "Close",
    retry: "Try again",
    openGuide: "Open guide",
  },
  nav: {
    dashboard: "Dashboard",
    jobs: "Jobs",
    upload: "Upload",
    help: "Help",
  },
  home: {
    title: "Getting started",
    intro: "Upload invoices or receipts and the platform will handle OCR, classification, and journal registration automatically.",
    stepsHeading: "Workflow",
    steps: [
      "1. Upload the document",
      "2. OCR & AI classification run automatically",
      "3. Review the job result and export the journal",
    ],
    startUpload: "Go to upload",
    openJobs: "Open jobs list",
    guideLink: "User guide",
    guideDescription: "See the guide for detailed steps and troubleshooting tips.",
  },
  upload: {
    title: "File upload",
    description:
      "Upload invoices, receipts, or estimates to automatically run OCR, AI classification, and journal posting.",
    step1: "1. Choose files",
    step2: "2. Send & track progress",
    step3: "3. Review the results",
    instructions:
      'Select one or more files and press "Send" to start processing automatically.',
    helperFormats: "Supported formats: PDF / CSV / XLSX / ZIP / JPEG (JPG) (up to 50MB)",
    selectButton: "Choose a file",
    submitButton: "Send",
    linkToJobs: "Open jobs list",
    noFile: "No file selected.",
    selectedFile: (name) => `Selected: ${name}`,
    selectedFiles: (count) => `Selected files (${count})`,
    changeFile: "Choose different files",
    clearSelection: "Clear selection",
    jobsShortcut: "After sending you can monitor progress on the Jobs page.",
    tooLarge: "File size is too large (max 50MB).",
    fileTooLarge: (name) => `${name} is too large (max 50MB).`,
    unsupported: "Unsupported format. Please use PDF, CSV, XLSX, ZIP, or JPEG (JPG).",
    fileUnsupported: (name) => `${name} is not a supported format. Use PDF, CSV, XLSX, ZIP, or JPEG (JPG).`,
    uploading: "Sending...",
    uploadingBatch: (current, total) => `Uploading file ${current} of ${total}...`,
    success: (jobId) => `Job ${jobId} has been submitted. Check the Jobs page for updates.`,
    successMultiple: (count) => `Uploaded ${count} files successfully.`,
    failed: "Upload failed. Please check your connection and try again.",
    loginRequired: "Please sign in and try again.",
    tryAgain: "Try again",
    viewJobDetail: "View job detail",
    ariaStatus: "Upload progress status",
    selectType: "Choose document type",
    types: {
      invoice: "Invoice",
      receipt: "Receipt",
      estimate: "Estimate",
    },
    pipeline: {
      uploaded: "Upload complete",
      ocr: "OCR in progress",
      classify: "AI classification",
      posted: "Journal posted",
    },
  },
  jobs: {
    title: "Jobs",
    description:
      "See the processing state for each uploaded file. Once classification is done the expense category appears here.",
    tableCaption: "Submitted jobs",
    columns: {
      id: "Job ID",
      fileName: "File name",
      documentType: "Type",
      status: "Status",
      classification: "Category",
      amount: "Amount (gross)",
      submittedAt: "Submitted",
      updatedAt: "Last update",
    },
    loading: "Loading jobs…",
    empty: "No jobs yet. Upload a file to get started.",
    emptyAction: "Upload a file to begin",
    openUpload: "Open upload screen",
    reload: "Reload",
    error: "Failed to load jobs. Please try again.",
    pollError:
      "Could not refresh the latest status. Check your connection and retry.",
    updatedAt: (time) => `Last updated: ${time}`,
    statusLabels: {
      Queued: "Queued",
      Running: "Running",
      Ok: "Complete",
      Failed: "Failed",
    },
    viewDetail: "View details",
    exportCsv: "Export CSV",
    exporting: "Preparing…",
    exportError: "Export failed. Please retry later.",
    pendingClassification: "Pending",
    amountUnavailable: "Not available",
  },
  jobDetail: {
    title: "Job detail",
    intro:
      "Follow the current processing status. When complete the classification result is reflected on the Jobs page.",
    statusQueued: "Queued",
    statusRunning: "In progress",
    statusOk: "Complete",
    statusFailed: "Failed",
    statusDescriptions: {
      Queued: "Processing will start shortly.",
      Running: "Running OCR and classification. Please wait a moment.",
      Ok: "Completed successfully. Export the journal if required.",
      Failed: "Processing failed. Review the file and upload again.",
    },
    pollingInfo: "Status refreshes every 5 seconds.",
    stopPolling: "Pause auto refresh",
    resumePolling: "Resume auto refresh",
    pollingStopped: "Auto refresh is paused. Press resume to check again.",
    lastChecked: (time) => `Last checked: ${time}`,
    fileName: "File name",
    startedAt: "Submitted",
    updatedAt: "Last update",
    amountGross: "Amount (gross)",
    amountNet: "Amount (net)",
    tax: "Tax",
    amountUnavailable: "Not available",
    backToJobs: "Back to jobs",
    notFound:
      "We could not find that job. Please return to the jobs list and choose another entry.",
  },
  help: {
    title: "Quick help",
    intro:
      "Automate back-office routines with three simple steps. Keep these points in mind.",
    featureList: [
      "Monitor every uploaded file and its progress at a glance.",
      "OCR, AI classification, and journal posting are handled automatically.",
      "Export CSV files to connect with accounting tools such as Freee or Yayoi.",
    ],
    stepsTitle: "Steps",
    steps: ["1. Upload a file", "2. Track the job", "3. Export the journal"],
    waitingTitle: "If it takes time",
    waiting: [
      "During busy hours the job may take a few minutes.",
      "Use the reload button on the Jobs page whenever you need fresh data.",
    ],
    issuesTitle: "If something fails",
    tips: [
      "Split files larger than 50MB before uploading.",
      "Make sure the file format is supported.",
      "Retry after checking your network connection.",
    ],
    securityTitle: "Security reminders",
    security: [
      "Share confidential documents only with authorised teammates.",
      "Handle personal data carefully in line with company policy.",
      "Manage API keys and passwords via environment variables.",
    ],
    diagramTitle: "Flow",
    diagramLines: ["Upload → OCR → Classification → Journal → Dashboard"],
    close: "Close",
  },
  summary: {
    title: "Dashboard",
    loading: "Loading summary…",
    error: "Failed to load summary data.",
    offline: "Cannot reach the API. Please make sure the backend is running.",
    totalSpend: "Monthly total spend",
    journalCount: "Journal entries",
    month: "Period",
    pieTitle: "Expense ratio",
    barTitle: "Expense by category",
    noData: "No summary data yet. Once jobs are completed the chart will be populated.",
    breakdownLabel: "Breakdown",
  },
  auth: {
    title: "Sign in",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    signingIn: "Signing in…",
    invalid: "Sign-in failed. Check your email and password.",
    sessionExpired: "Session expired. Please sign in again.",
    logout: "Sign out",
  },
};

const dictionaries: Record<SupportedLocale, Strings> = {
  ja,
  en,
};

export const useStrings = (locale: SupportedLocale = "ja") =>
  useMemo(() => dictionaries[locale], [locale]);
