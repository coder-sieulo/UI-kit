# PLAN — Multi-platform UI Kit (nhẹ, đẹp, tiêm được, đa ngôn ngữ)

> Mục tiêu: 1 bộ design system + component kit **cực nhẹ**, dùng lại được cho các job
> outsource — mỗi project chỉ cần **tiêm thư viện vào** (CDN hoặc npm) là có UI đẹp,
> có dark mode, có i18n, và port sang Flutter khi khách cần app mobile.
>
> Codename tạm: **`kit`** (đổi sau khi chốt tên thương hiệu riêng).

---

## 0. Nguyên tắc cốt lõi (non-negotiable)

1. **Token-first** — mọi màu/border/shadow/space/font đều đi qua CSS custom property
   từ 1 nguồn sự thật duy nhất (JSON). Không hard-code màu trong component.
2. **Zero-runtime styling** — không CSS-in-JS. CSS thuần + custom property,
   component JS chỉ toggle attribute/class.
3. **Size budget là gate CI** — vượt budget = fail build. "Cực nhẹ" phải được đo,
   không phải cảm nhận.
4. **1 nguồn sự thật cho tokens & locales** — sinh ra CSS, TS, Dart từ cùng JSON.
   Web và Flutter không bao giờ lệch nhau.
5. **Đầu ra là hàng hoá** — mỗi thay đổi phải kèm docs page + visual test,
   để bàn giao cho khách nhanh, không cần giải thích nhiều.

---

## 1. Kiến trúc tổng thể

```
                 ┌─────────────────────────────┐
                 │  tokens/ (DTCG JSON)        │  ← nguồn sự thật duy nhất
                 │  locales/ (JSON per lang)   │
                 └──────────┬──────────────────┘
                            │ Style Dictionary + scripts
        ┌───────────────────┼──────────────────────┐
        ▼                   ▼                      ▼
  tokens.css / tokens.ts              tokens.g.dart (ThemeExtension)
        │
        ▼
  ┌─────────────── core/ ────────────────┐
  │  CSS base (reset + tokens + utils)   │
  │  Vanilla runtime (Web Components)    │────  CDN bundle (inject 1 script)
  │  i18n module (~1KB)                 │────  npm: @scope/kit
  └───────────────┬──────────────────────┘
                  │ class names + data-attrs dùng chung
        ┌─────────┴──────────┐
        ▼                    ▼
  @scope/kit-react      kit_flutter (Dart pkg)
  (adapter mỏng)        (Theme + widget wrap Material 3)
```

**Chiến lược "multi-platform":**
- **Web (vanilla)**: Web Components (`<kit-button>`, `<kit-dialog>`...) — chạy ở mọi
  framework/không framework, tiêm CDN là dùng được ngay.
- **React**: adapter mỏng — mapping props → attribute/class, headless logic,
  **không** viết lại styling. CSS dùng chung 100% với vanilla.
- **Flutter**: cùng bộ tokens sinh ra `ThemeData`/`ThemeExtension`; widget hoặc
  wrap Material 3 hoặc custom (Toast, Skeleton...). Không phụ thuộc web.

---

## 2. Cấu trúc repo (pnpm monorepo)

```
kit/
├── tokens/                 # Nguồn sự thật: primitive/semantic/component JSON (DTCG)
│   ├── base/  (color.json, space.json, radius.json, type.json, shadow.json, motion.json)
│   ├── semantic/ (light.json, dark.json)
│   └── style-dictionary.config.mjs   # output: css, ts, dart
├── locales/                # en.json, vi.json, ... (1 nguồn cho JS + Flutter)
├── packages/
│   ├── core/               # CSS + vanilla runtime + i18n → bundle CDN & npm
│   ├── react/              # @scope/kit-react (peer: react)
│   └── config/             # shared tsconfig/eslint/vite
├── flutter/                # pub package: kit_flutter/ (lib/, test/, example/)
├── docs/                   # docs site (Vite) + component playground
├── scripts/                # build tokens, gen locales, size check, sync flutter
├── .github/workflows/      # CI: test, size-limit, visual regression
└── pnpm-workspace.yaml
```

Tooling: **pnpm workspaces** (không turborepo — solo, tránh thừa),
**tsup** (build ESM+CJS+d.ts), **vitest**, **size-limit**,
docs: **Vite + minimal custom** hoặc **Ladle** (nhẹ hơn Storybook nhiều).

---

## 3. Design tokens

### 3.1 Phân tầng (W3C DTCG format: `$type`, `$value`)

| Tầng | Ví dụ | Được dùng ở |
|---|---|---|
| Primitive | `blue.500 #4F65F1`, `gray.50` | chỉ bởi semantic |
| Semantic | `color.bg.surface`, `color.fg.muted`, `color.accent` | component |
| Component | `button.bg.hover`, `input.border.focus` | 1 component cụ thể |

### 3.2 Nhóm token
- **Color** (light + dark), **Space** (4px scale), **Radius** (sm/md/lg/full),
  **Typography** (font stack hệ thống — không tải webfont → giữ "cực nhẹ";
  client có thể override bằng token `font.sans`), **Shadow/elevation**,
  **Motion** (duration + easing, tôn trọng `prefers-reduced-motion`),
  **Z-index** (scale có tên, không number lung tung).

### 3.3 Đầu ra sinh ra (1 lần build)
- `tokens.css` → `:root { --kit-... }` + `[data-theme="dark"]`
- `tokens.ts` → typed object cho runtime (`kit.applyTheme()`)
- `tokens.g.dart` → `ThemeExtension<KitTokens>` cho Flutter

### 3.4 Theme engine
- `data-theme="light|dark"` trên `<html>`, auto theo `prefers-color-scheme`,
  override được bằng `kit.setTheme()`.
- **Client branding**: `kit.applyTheme({ '--kit-accent': '#xx' })` — customer
  đổi brand trong 1 dòng, không fork repo.
- Sinh sẵn **2 theme thương hiệu mặc định** (neutral + 1 accent) để giao hàng nhanh.

---

## 4. Core web (phần "tiêm vào")

### 4.1 CDN inject — 1 dòng là dùng
```html
<script type="module" src="https://cdn.<domain>/kit/v1/kit.min.js"></script>
<kit-button variant="primary">Bấm tôi</kit-button>
```
- JS tự inject `<style id="kit-styles">` 1 lần (không cần thêm thẻ `<link>`).
- Also ship `kit.min.css` riêng cho ai muốn control cache/tích hợp build.
- **Tự host được**: 2 file `kit.min.js` + `kit.min.css` copy vào project khách
  → không phụ thuộc CDN của mình, bàn giao outsource cực dễ.
- ESM + IIFE 2 bản (IIFE cho trang không dùng `type="module"`).

### 4.2 Vanilla runtime
- Web Components, `shadowDOM: 'open'` cho widget phức tạp (dialog, dropdown, tooltip)
  để tách biệt; component dạng tĩnh (button, card, badge) là custom element thường
  **không** shadow → style overridden bằng CSS dễ dàng.
- Styling xuyên shadow DOM: **CSS custom property kế thừa tự nhiên qua shadow root** —
  đây là lý do token-first song song với mục tiêu nhẹ.
- A11y mặc định: focus ring, `aria-*`, trap focus trong dialog, Esc đóng,
  arrow-key navigation cho menu/tabs, trỏ chuột/keyboard đều dùng được.

### 4.3 i18n module (~1KB gzip)
- API: `kit.setLocale('vi')`, `kit.setMessages({ vi: {...} })`,
  fallback chain `vi → en`.
- Features: dot-path lookup (`dialog.close`), interpolation (`{count}`),
  plural qua `Intl.PluralRules` (có sẵn trên nền tảng — không bundle bảng plural),
  sync `<html lang>`/`dir` (RTL: dùng logical property `margin-inline-start` từ đầu).
- Text mặc định của component đọc từ registry → client override được từng key.
- **Helper cho app**: export luôn `t()`, `createI18n()` để các job outsource
  dùng chung module i18n này (nhẹ hơn i18next ~40KB).

### 4.4 Ship locales sẵn
`en`, `vi` (base). Thêm locale = thêm 1 file JSON, build tự sinh vào bundle
và vào Flutter.

---

## 5. React adapter

- ESM, tree-shakeable, **peer dependency react/react-dom**, zero runtime deps.
- Component wrap Web Component (dùng `createComponent` pattern) **hoặc**
  render element + attribute — chọn hướng: **render attribute/class thuần**
  (SSR-friendly, không cần custom element registration khi build React).
- Hỗ trợ `className`, `style`, `as` prop, ref forwarding.
- Không style trong JS — CSS dùng chung với core.

---

## 6. Flutter adapter (`kit_flutter`)

- `ThemeExtension<KitTokens>` mang đúng các token semantic (color/space/radius/type).
- `KitTheme.light()/dark()/fromTokens()` + `kitAppTheme(brightness)`.
- Widget v1: wrap/copy tối giản — `KitButton`, `KitInput`, `KitCard`,
  `KitBadge`, `KitDialog`, `KitToast`, `KitSkeleton`, `KitTabs`, `KitSwitch`.
- i18n: load **cùng file JSON locales** (gen thành `Map` Dart trong build script)
  → cùng key, cùng fallback, 1 nơi sửa.
- Tests: `flutter test` + **golden tests** cho visual.

---

## 7. Scope component (v1)

**P0 — MVP (làm đủ trước khi nhận job đầu tiên):**
Button, Input/Textarea, Checkbox, Radio, Switch, Badge, Card, Avatar,
Modal/Dialog, Toast, Tabs, Spinner, Skeleton, FormField (label/error/hint).

**P1:** Select/Combobox, Dropdown menu, Tooltip, Accordion, Table,
Pagination, Empty state, Alert/Banner.

**P2 (khi cần):** Navbar, Stepper, DatePicker (dùng native input),
Command palette, Data grid.

> Nguyên tắc: **ít component, làm đúng làm sâu** (state, a11y, RTL, dark mode,
> token override) hơn là nhiều component hời hợt.

---

## 8. Chất lượng & size budget

| Artifact | Budget (gzip) | Gate |
|---|---|---|
| `tokens.css` + base CSS | ≤ 6 KB | size-limit CI |
| CSS full (mọi component) | ≤ 20 KB | size-limit CI |
| Vanilla JS runtime | ≤ 8 KB | size-limit CI |
| i18n module | ≤ 1.5 KB | size-limit CI |
| `@scope/kit-react` (tree-shaken 1 component) | ≤ 10 KB | size-limit CI |
| Flutter AOT (theo widget dùng) | đo bằng `flutter build`, track | manual/CI |

Kiểm tra bắt buộc:
- **Unit**: vitest (i18n, token transform, utils) · `flutter test`
- **Visual regression**: Playwright screenshot trên docs pages (chromium)
  → soi được lỗi styling khi refactor
- **A11y**: axe-core trong test + keyboard walkthrough thủ công
- **RTL + dark mode** là 2 matrix test mặc định cho mọi component
- **Cross-browser**: Chrome, Firefox, Safari (Web Components + custom property)

---

## 9. Roadmap

### Phase 0 — Bootstrap (½–1 ngày)
Repo, pnpm workspace, tsconfig/eslint/format, CI cơ bản, build pipeline.

### Phase 1 — Tokens + theme engine (2–3 ngày)
Token JSON 3 tầng, Style Dictionary → CSS/TS/Dart, light/dark, `applyTheme`,
docs page xem token.

### Phase 2 — i18n module (1 ngày)
`t()`, plural, interpolation, locale registry, `en` + `vi`,
sync lang/dir. Unit test đầy đủ.

### Phase 3 — Core CSS + P0 components (vanilla) (4–6 ngày)
Base CSS, 14 component P0, a11y, dark/RTL, bundle CDN (ESM+IIFE),
size-limit gate.

### Phase 4 — React adapter (2–3 ngày)
Component wrapper, playground React, SSR smoke test.

### Phase 5 — Flutter (4–6 ngày)
`tokens.g.dart`, ThemeExtension, 8 widget P0, golden tests, i18n load JSON.

### Phase 6 — Docs + playground + visual regression (2–3 ngày)
Docs site (copy-paste snippet cho từng component), demo app 2 framework,
Playwright visual tests.

### Phase 7 — Polish & v1.0 (2–3 ngày)
Cross-browser pass, perf audit, README/guide bàn giao,
cách nhúng vào 1 project outsource (checklist 10 phút).

**Tổng ước tính: ~3–4 tuần** làm full-stack.
**MVP dùng thật cho job đầu tiên (Phase 0–4): ~2 tuần.**

---

## 10. Phân phối & bàn giao (outsource workflow)

- **npm**: publish `@scope/kit`, `@scope/kit-react` (public hoặc private registry
  tùy khách); versioning semver + changesets.
- **CDN self-host**: mỗi job outsource = copy `dist/kit.min.js` + `kit.min.css`
  vào repo khách → không phụ thuộc mình, không lộ source.
- **Flutter**: pub.dev (private/hoặc path dependency bàn giao kèm).
- **Guide bàn giao** gồm: cách inject, cách đổi theme theo brand,
  cách thêm locale, checklist nghiệm thu (dark/RTL/a11y).

---

## 11. Quyết định mở (chốt khi bắt tay vào)

1. **Tên thương hiệu + scope npm** (`@yourname/kit`?) — chặn publish, không chặn code.
2. Hosting CDN (Cloudflare Pages/R2) + domain.
3. Có cần SSR/Next.js adapter riêng không? (MVP: attribute-based → chạy tốt
   trên RSC/SSR vì không phụ thuộc runtime JS để hiển thị styling.)
4. Số locale tối thiểu ngoài `en`/`vi` (khách Nhật/Bài...?).
