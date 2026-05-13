# TypeScript 编码规范

## 一、命名规则

| 类别                           | 命名风格                                             | 示例                                         |
| ------------------------------ | ---------------------------------------------------- | -------------------------------------------- |
| 类型（interface, type, class） | PascalCase                                           | `UserInfo`, `ApiResponse`                    |
| 接口名                         | 不加 `I` 前缀                                        | ✔ `User` ❌ `IUser`                          |
| 枚举类型名                     | PascalCase                                           | `HttpStatus`                                 |
| **枚举值**                     | snake_case                                           | `not_found`, `internal_error`                |
| **函数、方法**                 | snake_case                                           | `get_user_data`, `validate_form`             |
| **变量、参数、属性**           | snake_case                                           | `user_name`, `is_loading`, `max_retry_count` |
| **私有属性/方法**              | snake*case（不加 `*` 前缀）                          | `private value` / `private get_value()`      |
| **常量（真正的常量）**         | snake_case 或 SCREAMING_SNAKE_CASE（任选，团队统一） | `max_retry_count` 或 `MAX_RETRY_COUNT`       |
| **文件名**                     | snake_case（推荐）或 kebab-case                      | `user_profile.ts`, `api_client.ts`           |

**核心原则**

- 除类型/类名外，**所有标识符使用全小写单词 + 下划线分隔**。
- 使用全名，避免缩写（除 `id`, `url`, `http` 等通用缩写）。
- 布尔值使用 `is_` / `has_` / `can_` 前缀，例如 `is_active`。
- 避免使用 `any` 类型，必要时用 `unknown`。

---

## 二、风格

### 缩进 & 大括号

- 使用 **2 个空格** 缩进（可按团队习惯改为 4 个空格，需统一）。
- 开大括号放在同一行末尾，`else` / `catch` 另起一行。

```typescript
if (condition) {
  do_something();
} else {
  do_other();
}
```

- **强制使用大括号**包裹循环体和条件体。

### 空格与分号

- 圆括号内侧**不留空格**，括号内的逗号、冒号、分号后**留一个空格**。

```typescript
for (let i = 0, n = arr.length; i < n; i++) {}
if (x < 10) {
}
function f(x: number, y: string): void {}
```

- **必须使用分号**结尾。
- 每个变量/常量使用单独的 `let` 或 `const` 声明，不允许链式声明。

### 箭头函数

- 使用箭头函数代替匿名函数。
- 参数列表括号规则：
  - 单参数无类型 → 省略括号：`x => x * 2`
  - 多参/默认参数/解构/类型标注 → 保留括号：`(x, y) => x + y`，`(x: number) => x * 2`
  - 泛型箭头函数：`<T>(x: T) => x`

### 字符串

- **统一使用单引号**，模板字符串使用反引号。

### 每行最大长度

- 建议 **100 ～ 120** 字符，按团队配置。

---

## 三、变量与类型

### 变量声明

- 默认使用 `const`，需要重新赋值时用 `let`。**禁止使用 `var`**。
- `const` 声明的对象/数组内部可修改，但不应替换整个对象。

### 类型

- **优先使用 `interface`** 定义对象形状，需要联合/映射类型时使用 `type`。
- **不要导出**仅在当前文件内部使用的类型/函数。
- 类型定义放在文件顶部。
- 显式标注函数返回类型。

### 数组 & 对象（推荐不可变）

- 创建后尽量不修改，使用 `map`/`filter`/`spread` 代替 `push`/`splice`。
- 若需表示只读，使用 `ReadonlyArray` 或 `as const`。

---

## 四、null 与 undefined

- **优先使用 `undefined`**，除非与后端约定必须用 `null`。
- 可选属性/参数直接使用 `?`，不要显式赋值 `undefined`。
- 判断非空：`value != null`（同时检查 null 和 undefined）。

---

## 五、标志位（Flags）

当有两个及以上互相关联的布尔状态时，合并为枚举（枚举值使用 snake_case）：

```typescript
// ❌
let is_ready = false;
let is_complete = false;

// ✔
enum ProgressState {
  pending,
  ready,
  complete,
}
```

---

## 六、注释与文档

- 对外 API 必须使用 **JSDoc / TSDoc** 注释。

```typescript
/**
 * 计算两个数的和。
 * @param a - 第一个数
 * @param b - 第二个数
 * @returns 两数之和
 */
function add(a: number, b: number): number { ... }
```

- 内部复杂逻辑使用 `//` 注释解释 **why**，而非重复代码。
- 禁用代码用 `// TODO:` 或 `// FIXME:` 标记，附带说明。

---

## 七、错误处理与日志

- 不要吞没异常，至少记录日志或重新抛出。
- 自定义错误：`class CustomError extends Error` 并设置 `name`。
- 控制台日志消息以句号结尾，使用现在时和单数主语：  
  `"User data cannot be loaded."`

---

## 八、模块与导入

- 使用 ES 模块语法（`import`/`export`）。
- 仅导入所需内容：`import { fn } from './util'`。
- 类型导入使用 `import type`。
- 禁止循环依赖。

---

## 九、其他推荐规则

- 使用 `===` / `!==`（除了 `== null` 用于同时检查 null/undefined）。
- 不要依赖 `this` 隐式绑定，使用箭头函数或 `bind`。
- 禁止 `@ts-ignore`，使用 `@ts-expect-error` 并附说明。
- 枚举优先使用 `const enum` 或联合类型（`type Status = 'pending' | 'ready'`）。

---

## 十、工具链

- ESLint + `@typescript-eslint`（可自定义命名规则：`@typescript-eslint/naming-convention`）
- Prettier
- TypeScript `strict: true`
- husky + lint-staged

---

## 命名配置示例（ESLint）

若要强制 snake_case 变量/函数，可在 ESLint 配置中添加：

```json
"@typescript-eslint/naming-convention": [
  "error",
  { "selector": "default", "format": ["snake_case"] },
  { "selector": "typeLike", "format": ["PascalCase"] }
]
```

> 注意：默认选择器会覆盖变量、函数、参数、属性等，类型（typeLike）单独保留 PascalCase。
