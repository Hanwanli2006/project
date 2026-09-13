/* 统一线性描边图标:24×24 viewBox、currentColor、2px 圆头描边。
   尺寸交给 CSS(.feature-card__icon svg 等),这里只保证默认有值。 */

const Icon = ({ children }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

/* 课程答疑 */
export const IconQa = () => (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </Icon>
)

/* 知识梳理 —— 知识图谱节点 */
export const IconGraph = () => (
  <Icon>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 13.51l6.83 3.98" />
    <path d="M15.41 6.51l-6.82 3.98" />
  </Icon>
)

/* 学术辅助 —— 文稿 */
export const IconDoc = () => (
  <Icon>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </Icon>
)

/* 学生端 —— 学位帽 */
export const IconStudent = () => (
  <Icon>
    <path d="M22 9L12 4 2 9l10 5 10-5z" />
    <path d="M6 11.5V16c0 1.66 2.69 3 6 3s6-1.34 6-3v-4.5" />
    <path d="M22 9v5" />
  </Icon>
)

/* 教师端 —— 讲台 / 白板 */
export const IconTeacher = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M12 16v5" />
    <path d="M8 21h8" />
  </Icon>
)

/* 未登录 */
export const IconLock = () => (
  <Icon>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icon>
)

/* 图片提问 */
export const IconImage = () => (
  <Icon>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </Icon>
)

/* AI 记忆 */
export const IconBrain = () => (
  <Icon>
    <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
    <path d="M16 14H8a4 4 0 0 0-4 4v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2a4 4 0 0 0-4-4z" />
  </Icon>
)

/* 导出 */
export const IconDownload = () => (
  <Icon>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </Icon>
)

/* 提问历史 */
export const IconHistory = () => (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Icon>
)

/* 学科切换 */
export const IconLayers = () => (
  <Icon>
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </Icon>
)

/* 列表项勾选 */
export const IconCheck = () => (
  <Icon>
    <path d="M20 6L9 17l-5-5" />
  </Icon>
)

/* 箭头(链接后缀) */
export const IconChevron = () => (
  <Icon>
    <path d="M9 18l6-6-6-6" />
  </Icon>
)

