# Kit

Bộ UI kit đa nền tảng, siêu nhẹ — CSS thuần, tiêm 1 script là dùng, token-first,
i18n sẵn (en/vi). Được thiết kế để nhúng lại được vào các dự án outsource:
mỗi project chỉ cần tiêm thư viện vào là có giao diện chỉnh, dark mode,
đa ngôn ngữ, accessible.

- Web (vanilla HTML/CSS/JS): tiêm CDN hoặc self-host
- React: adapter mỏng dùng chung CSS (đang phát triển)
- Flutter: bộ token sinh `ThemeExtension` từ cùng nguồn JSON (đang phát triển)

Toàn bộ quyết định thiết kế nằm trong [PLAN.md](PLAN.md).

## Đặc điểm

- CSS thuần, zero CSS-in-JS: styling chạy đúng cả khi tắt JavaScript
- Tiêm 2 dạng: 1 file JS tự inject CSS, hoặc thẻ `<link>` riêng để control cache
- Token-first: một nguồn sự thật (JSON theo chuẩn WTCG DTCG) sinh ra CSS,
  TypeScript và Dart — Web và Flutter không bao giờ lệch nhau
- Dark mode: chọn theo hệ thống (`prefers-color-scheme`), theo localStorage,
  hoặc đổi theo brand bằng 1 dòng CSS variable
- i18n siêu nhỏ (0.8 KB gzip): dot-path, interpolation, plural qua
  `Intl.PluralRules`, tự đồng bộ `lang`/`dir`, hỗ trợ RTL — kèm sẵn `en` và `vi`
- Accessibility: focus ring thống nhất, focus trap của native `<dialog>`, phím mũi tên
  cho tabs, ARIA đúng chuẩn
- Size budget là gate: chạy `npm run size`, vượt mức là exit 1

## Bắt đầu nhanh

### Cách 1 — tiêm 1 script (nhẹ nhất)

```html
<script type="module" src="./kit.min.js"></script>

<button class="kit-btn kit-btn--primary">Bấm tôi</button>
```

File JS tự chèn thẻ `<style id="kit-styles">` một lần khi tải.

### Cách 2 — tách CSS và JS (control cache tốt hơn)

```html
<link id="kit-styles" rel="stylesheet" href="./kit.min.css">
<script type="module" src="./kit.min.js"></script>
```

Id `kit-styles` trên thẻ `<link>` để script không inject trùng.
Nếu chỉ cần styling, bỏ hẳn thẻ `<script>` vẫn chạy đủ.

Còn bản không dùng module:

```html
<script src="./kit.iife.min.js"></script>
<!-- toàn bộ API nằm dưới biến toàn cục window.kit -->
```

### Cách 3 — qua npm

```bash
npm install @kit/core   # chưa public: dùng npm link hoặc copy thư mục dist
```

```js
import '@kit/core/css';   // hoặc: '@kit/core/base.css' cho bản rút gọn
import { toast, setTheme, setLocale, t } from '@kit/core';

setTheme('dark');
setLocale('vi');
toast({ title: t('demo.saved'), variant: 'success' });
```

## Component (mốc P0)

Button, Input/Textarea/Select, FormField (label/hint/error), Checkbox,
Radio, Switch, Badge, Card, Avatar, Dialog, Toast, Tabs, Spinner, Skeleton.

Ví dụ:

```html
<div class="kit-field">
  <label class="kit-field__label" for="email">Email</label>
  <input class="kit-input" id="email" placeholder="you@example.com">
  <span class="kit-field__hint">Không chia sẻ email của bạn.</span>
</div>

<button class="kit-btn kit-btn--danger" data-kit-open="confirm">Xóa</button>
<dialog class="kit-dialog" id="confirm">
  <div class="kit-dialog__header">
    Xác nhận
    <button class="kit-dialog__close" data-kit-close aria-label="Đóng">x</button>
  </div>
  <div class="kit-dialog__body">Hành động này không thể hoàn tác.</div>
  <div class="kit-dialog__footer">
    <button class="kit-btn kit-btn--ghost" data-kit-close>Hủy</button>
    <button class="kit-btn kit-btn--danger" data-kit-close>Xóa</button>
  </div>
</dialog>
```

## Theme

```js
import { setTheme, getTheme } from '@kit/core';

setTheme('dark');   // 'light' | 'dark' | 'system'
getTheme();         // đọc preference hiện tại (localStorage 'kit-theme')
```

Đổi màu brand không cần fork repo — mọi màu đều đi qua CSS variable:

```js
document.documentElement.style.setProperty('--kit-color-accent-default', '#059669');
```

## i18n

```js
import { setLocale, t, registerMessages, getLocale } from '@kit/core';

setLocale('vi');                       // tự set <html lang="vi"> + dir
t('dialog.close');                     // 'Đóng'

registerMessages('vi', {
  order: { shipped: 'Đơn {id} đã được gửi' },
});
t('order.shipped', { id: 'A-12' });    // 'Đơn A-12 đã được gửi'

// số nhiều dùng Intl.PluralRules, không cần bảng dịch
registerMessages('en', { items: { one: '{count} item', other: '{count} items' } });
t('items', { count: 3 });              // '3 items'
```

Key thiếu ở locale hiện tại sẽ tự rơi về `en`; thiếu cả hai thì trả về chính key.

## Kích thước (gzip)

| File | Thật | Budget |
|---|---|---|
| `kit.base.css` (token + reset + utility) | 2.37 KB | 6 KB |
| `kit.min.css` (đầy đủ component) | 4.99 KB | 20 KB |
| `kit.min.js` (ESM, gồm CSS nhúng) | 7.46 KB | 8 KB |
| `kit.iife.min.js` (bản IIFE) | 7.71 KB | 8 KB |
| module i18n | 0.83 KB | 1.5 KB |

## Development

```bash
npm install
npm run build        # sinh token + CSS + JS (ESM/IIFE) + bản khai báo types
npm run build:tokens # chỉ sinh token (CSS/TS/Dart)
npm run typecheck    # tsc strict
npm test             # vitest: i18n, token, artifact (22 test)
npm run size         # gate budget, vượt là exit 1
npm run verify       # typecheck + build + test + size
npm run demo         # server tĩnh, mở /docs/demo/index.html (cổng 4173)
```

## Cấu trúc repo

```
tokens/        nguồn sự thật: JSON 3 tầng (primitive -> semantic -> component)
packages/
  core/        CSS + runtime + i18n  ->  dist/kit.min.js, kit.min.css, ...
scripts/       build-tokens, build, size, serve (zero dependency)
test/          vitest
docs/demo/     trang demo đầy đủ component
flutter/       tokens.g.dart sinh từ cùng bộ token (cần Flutter SDK để build)
PLAN.md        kế hoạch chi tiết + roadmap
```

## Trạng thái

- P0 web core: hoàn tất (xác minh qua test + trình duyệt)
- Tiếp theo: React adapter, Flutter widget package, docs site,
  visual regression (Playwright), CI

Lưu ý: `flutter/lib/src/tokens.g.dart` là file sinh tự động — môi trường dev
hiện chưa có Flutter SDK nên phần Dart mới sinh ra, chưa compile kiểm chứng.
