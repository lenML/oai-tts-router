// @ts-nocheck
// prettier-disable
// prettier-ignore-start
// eslint-disable

// ===================================================================
// TypeScript 代码整洁之道 - 示例文件
// 本文件通过 Bad vs Good 对比，展示书中的核心编码建议。
// 为节省篇幅，相似规范合并展示，注释采用原文核心观点。
// ===================================================================

// ----------------------------- 变量 -----------------------------

// 1. 有意义、可读、可搜索、自解释、避免思维映射、无多余上下文
// Bad
type Car1 = { carMake: string; carModel: string; carColor: string };
function between1<T>(a1: T, a2: T, a3: T): boolean {
  return a2 <= a1 && a1 <= a3;
}
const u1 = getUser(); const s1 = getSubscription(); const t1 = charge(u1, s1);
// Good
type Car = { make: string; model: string; color: string };
function between<T>(value: T, left: T, right: T): boolean {
  return left <= value && value <= right;
}
const user = getUser(); const subscription = getSubscription(); const transaction = charge(user, subscription);

// 2. 便于搜索的名字（常量）+ 默认参数
// Bad
setTimeout(restart, 86400000); // 魔法数字
function loadPages1(count: number) {
  const loadCount = count !== undefined ? count : 10;
}
// Good
const MILLISECONDS_IN_A_DAY = 24 * 60 * 60 * 1000;
setTimeout(restart, MILLISECONDS_IN_A_DAY);
function loadPages(count: number = 10) { /* ... */ }

// 3. 合并功能一致的变量
// Bad
function getUserInfo(): User { /* ... */ }
function getUserDetails(): User { /* ... */ }
function getUserData(): User { /* ... */ }
// Good
function getUser(): User { /* ... */ }

// ----------------------------- 函数 -----------------------------

// 4. 参数越少越好：使用对象参数与类型别名
// Bad
function createMenu1(title: string, body: string, buttonText: string, cancellable: boolean) { /* ... */ }
// Good
type MenuOptions = { title: string; body: string; buttonText: string; cancellable: boolean };
function createMenu(options: MenuOptions) { /* ... */ }

// 5. 只做一件事 + 名副其实
// Bad: 函数内混杂过滤、查找、发送
function emailClients1(clients: Client[]) {
  clients.forEach((client) => {
    const clientRecord = database.lookup(client);
    if (clientRecord.isActive()) { email(client); }
  });
}
// Good: 职责分离，命名清晰
function isActiveClient(client: Client) { return database.lookup(client).isActive(); }
function emailClients(clients: Client[]) { clients.filter(isActiveClient).forEach(email); }

// 6. 删除重复代码：抽象公共逻辑
// Bad: showDeveloperList 与 showManagerList 大量重复
// Good: 抽取公共 render 逻辑，对象提供 getExtraDetails()
class BaseEmployee {
  calculateExpectedSalary() { /* ... */ }
  getExperience() { /* ... */ }
  getExtraDetails(): Record<string, unknown> { return {}; }
}
class Developer extends BaseEmployee {
  getExtraDetails() { return { githubLink: this.githubLink }; }
}
class Manager extends BaseEmployee {
  getExtraDetails() { return { portfolio: this.portfolio }; }
}
function showEmployeeList(employees: (Developer | Manager)[]) {
  employees.forEach(e => {
    const data = { salary: e.calculateExpectedSalary(), experience: e.getExperience(), extra: e.getExtraDetails() };
    render(data);
  });
}

// 7. 使用 Object.assign 或解构设置默认对象（避免副作用，不允许显式 undefined/null）
// Bad: 逐个判断赋值
function createMenuConfig1(config: any) {
  config.title = config.title || 'Foo';
  // ...
}
// Good: 解构默认值
type MenuConfig = { title?: string; body?: string; buttonText?: string; cancellable?: boolean };
function createMenuConfig({ title = 'Foo', body = 'Bar', buttonText = 'Baz', cancellable = true }: MenuConfig) {
  // 直接使用 title ...
}

// 8. 不要使用 Flag 参数：拆分为独立函数
// Bad
function createFile1(name: string, temp: boolean) {
  if (temp) fs.create(`./temp/${name}`); else fs.create(name);
}
// Good
function createFile(name: string) { fs.create(name); }
function createTempFile(name: string) { fs.create(`./temp/${name}`); }

// 9. 避免副作用 (纯函数 + 不可变数据)
// Bad: 直接修改全局变量
let name1 = 'Robert C. Martin';
function toBase641() { name1 = btoa(name1); }
// Good: 返回新值，不改变输入
const name = 'Robert C. Martin';
function toBase64(text: string): string { return btoa(text); }
const encodedName = toBase64(name);

// Bad: 直接修改传入的数组
function addItemToCart1(cart: CartItem[], item: Item): void { cart.push({ item, date: Date.now() }); }
// Good: 返回新数组
function addItemToCart(cart: CartItem[], item: Item): CartItem[] {
  return [...cart, { item, date: Date.now() }];
}

// 10. 不要写全局函数：用类扩展代替污染原型
// Bad: 直接扩展 Array.prototype
// Good
class MyArray<T> extends Array<T> {
  diff(other: T[]): T[] {
    const hash = new Set(other);
    return this.filter(elem => !hash.has(elem));
  }
}

// 11. 函数式编程优于命令式编程
// Bad: 手动 for 循环累加
const contributions = [{ linesOfCode: 500 }, { linesOfCode: 1500 }];
let total1 = 0;
for (let i = 0; i < contributions.length; i++) total1 += contributions[i].linesOfCode;
// Good: 使用 reduce
const total = contributions.reduce((sum, c) => sum + c.linesOfCode, 0);

// 12. 封装判断条件 + 避免否定判断
// Bad
if (subscription.isTrial || account.balance > 0) { /* ... */ }
function isEmailNotUsed(email: string) { /* ... */ }
if (isEmailNotUsed(email)) { /* ... */ }
// Good: 封装为具名函数，并保持正向语义
function canActivateService(sub: Subscription, acc: Account): boolean {
  return sub.isTrial || acc.balance > 0;
}
function isEmailUsed(email: string): boolean { /* ... */ }
if (!isEmailUsed(email)) { /* ... */ }

// 13. 避免条件判断（多态） + 避免类型检查
// Bad: switch 判断类型，或 instanceof 检查
class Airplane1 {
  type: string;
  getCruisingAltitude() {
    switch (this.type) {
      case '777': return this.getMaxAltitude() - this.getPassengerCount();
      // ...
    }
  }
}
function travelToTexas1(vehicle: Bicycle | Car) {
  if (vehicle instanceof Bicycle) vehicle.pedal();
  else if (vehicle instanceof Car) vehicle.drive();
}
// Good: 多态，每种子类实现自己的方法；使用统一的接口方法
abstract class Airplane { abstract getCruisingAltitude(): number; }
class Boeing777 extends Airplane { getCruisingAltitude() { return this.getMaxAltitude() - this.getPassengerCount(); } }
class AirForceOne extends Airplane { getCruisingAltitude() { return this.getMaxAltitude(); } }

interface Vehicle { move(origin: Location, dest: Location): void; }
function travelToTexas(vehicle: Vehicle) { vehicle.move(currentLocation, new Location('texas')); }

// 14. 不要过度优化 + 删除无用代码
// Bad: 缓存 length 的微优化
for (let i = 0, len = list.length; i < len; i++) { /* ... */ }
function oldRequestModule(url: string) { /* ... */ } // 无用代码
// Good: 简洁写法，移除废弃函数
for (let i = 0; i < list.length; i++) { /* ... */ }

// 15. 使用迭代器和生成器（惰性求值）
// Bad: 一次性生成全部斐波那契数列
function fibonacci1(n: number): number[] {
  const items = [0, 1];
  while (items.length < n) items.push(items[items.length - 2] + items[items.length - 1]);
  return items;
}
// Good: 使用生成器，按需产生
function* fibonacci(): IterableIterator<number> {
  let [a, b] = [0, 1];
  while (true) { yield a; [a, b] = [b, a + b]; }
}
// 调用时用 for-of 或 itiriri 等库进行流式处理
for (const fib of fibonacci()) { if (fib > 100) break; console.log(fib); }

// ----------------------------- 对象与数据结构 -----------------------------

// 16. 使用 getters/setters + private/protected 成员 + 不变性
// Bad: 公共属性，无验证
class BankAccount1 { balance: number = 0; }
const acc1 = new BankAccount1();
acc1.balance = -100; // 直接修改，无保护
// Good: 封装字段，提供 get/set，使用 readonly
class BankAccount {
  private _balance: number = 0;
  get balance(): number { return this._balance; }
  set balance(value: number) {
    if (value < 0) throw new Error('Cannot set negative balance.');
    this._balance = value;
  }
}
class Circle1 { constructor(private readonly radius: number) {} } // 简洁构造即只读

// 17. 类型 vs 接口：联合/交集用 type，扩展/实现用 interface
// Bad: 混用
interface Config1 { /* ... */ }
interface EmailConfig1 extends Config1 { /* ... */ }
type Shape1 = { /* ... */ } // 不恰当，因为之后要实现
// Good
type EmailConfig = { /* ... */ };
type DbConfig = { /* ... */ };
type Config = EmailConfig | DbConfig;  // 联合用 type
interface Shape { area(): number; }
class Circle implements Shape { area() { return 0; } }

// ----------------------------- 类 -----------------------------

// 18. 小类 + 高内聚低耦合 + 组合大于继承 + 方法链
// Bad: 巨型类，职责混杂
class Dashboard1 {
  getLanguage() { /* ... */ }
  setLanguage(l: string) { /* ... */ }
  addUser(u: User) { /* ... */ }
  sendEmail() { /* ... */ }
}
// Good: 拆分为小类，各司其职
class Dashboard {
  disable() { /* ... */ }
  enable() { /* ... */ }
}
class UserService {
  constructor(private db: Database) {}
  async addUser(u: User) { /* ... */ }
}
class UserNotifier {
  constructor(private emailSender: EmailSender) {}
  async sendGreeting() { /* ... */ }
}

// 组合 > 继承
// Bad: EmployeeTaxData extends Employee —— "tax data" 不是 Employee 的子类型
// Good: Employee 持有 EmployeeTaxData 实例
class Employee {
  private taxData: EmployeeTaxData;
  constructor(private name: string, private email: string) {}
  setTaxData(ssn: string, salary: number): this {
    this.taxData = new EmployeeTaxData(ssn, salary); return this;
  }
}

// 方法链：返回 this 使调用连贯
class QueryBuilder {
  private collection: string; private page = 1; private perPage = 100; private orderFields: string[] = [];
  from(collection: string): this { this.collection = collection; return this; }
  page(number: number, itemsPerPage = 100): this { this.page = number; this.perPage = itemsPerPage; return this; }
  orderBy(...fields: string[]): this { this.orderFields = fields; return this; }
  build(): Query { /* ... */ return new Query(); }
}
// 使用: new QueryBuilder().from('users').page(1).orderBy('name').build();

// ----------------------------- SOLID -----------------------------

// 19. 单一职责 (SRP)
// Bad: 一个类既做认证又做设置
class UserSettings1 {
  changeSettings() { if (this.verifyCredentials()) { /* ... */ } }
  verifyCredentials() { /* ... */ }
}
// Good: 分离认证职责
class UserAuth { verifyCredentials() { /* ... */ } }
class UserSettings {
  constructor(private auth: UserAuth) {}
  changeSettings() { if (this.auth.verifyCredentials()) { /* ... */ } }
}

// 20. 开闭原则 (OCP)：对扩展开放，对修改封闭
// Bad: 每次新增适配器都需修改 HttpRequester.fetch 内的 if/else
class HttpRequester1 {
  constructor(private adapter: Adapter1) {}
  async fetch(url: string) {
    if (this.adapter instanceof AjaxAdapter) { /* ... */ }
    else if (this.adapter instanceof NodeAdapter) { /* ... */ }
  }
}
// Good: 抽象方法，子类实现
abstract class Adapter { abstract request<T>(url: string): Promise<T>; }
class AjaxAdapter extends Adapter { async request<T>(url: string): Promise<T> { /* ... */ return {} as T; } }
class NodeAdapter extends Adapter { async request<T>(url: string): Promise<T> { /* ... */ return {} as T; } }
class HttpRequester {
  constructor(private adapter: Adapter) {}
  async fetch<T>(url: string): Promise<T> { return this.adapter.request<T>(url); }
}

// 21. 里氏替换 (LSP)：子类应可替换父类而不破坏程序
// Bad: Square 继承 Rectangle 并改写 setWidth/setHeight 违反预期
class Rectangle1 {
  setWidth(w: number) { this.width = w; }
  setHeight(h: number) { this.height = h; }
  getArea() { return this.width * this.height; }
}
class Square1 extends Rectangle1 {
  setWidth(w: number) { this.width = w; this.height = w; }
  setHeight(h: number) { this.width = h; this.height = h; }
}
// Good: 各自实现 Shape，不强制继承
abstract class Shape { abstract getArea(): number; }
class Rectangle extends Shape { constructor(private w: number, private h: number) { super(); } getArea() { return this.w * this.h; } }
class Square extends Shape { constructor(private side: number) { super(); } getArea() { return this.side * this.side; } }

// 22. 接口隔离 (ISP)：不应强迫客户依赖不使用的方法
// Bad: 单一接口包含打印、传真、扫描，经济打印机被迫抛出异常
interface AllInOnePrinter { print(): void; fax(): void; scan(): void; }
class EconomicPrinter1 implements AllInOnePrinter {
  print() {}
  fax() { throw new Error('Not supported'); }
  scan() { throw new Error('Not supported'); }
}
// Good: 拆分为小接口，按需实现
interface Printer { print(): void; }
interface Fax { fax(): void; }
interface Scanner { scan(): void; }
class EconomicPrinter implements Printer { print() {} }

// 23. 依赖反转 (DIP)：高层模块不应依赖低层模块，应依赖抽象
// Bad: ReportReader 直接依赖具体 XmlFormatter
class ReportReader1 {
  private formatter = new XmlFormatter();
  async read(path: string) { const text = await readFile(path, 'utf8'); return this.formatter.parse(text); }
}
// Good: 依赖接口，可通过依赖注入切换实现
interface Formatter { parse<T>(content: string): T; }
class XmlFormatter implements Formatter { parse<T>(content: string): T { /* ... */ return {} as T; } }
class JsonFormatter implements Formatter { parse<T>(content: string): T { /* ... */ return {} as T; } }
class ReportReader {
  constructor(private formatter: Formatter) {}
  async read(path: string) { const text = await readFile(path, 'utf8'); return this.formatter.parse(text); }
}
// 使用: new ReportReader(new XmlFormatter()) 或 new ReportReader(new JsonFormatter())

// ----------------------------- 测试 -----------------------------

// 24. 每个测试一个概念 + 用例名称显示意图
// Bad: 一个 test 包含多个断言且名称模糊
describe('AwesomeDate', () => {
  it('handles date boundaries', () => {
    // 多个 assert，失败难以定位
  });
});
// Good: 一个测试只验证一种场景，名称具体
describe('AwesomeDate', () => {
  it('should handle 30-day months', () => { /* single assert */ });
  it('should handle leap year', () => { /* ... */ });
});

// ----------------------------- 并发 -----------------------------

// 25. 用 Promises 替代回调，用 async/await 替代 Promise 链
// Bad: 回调地狱
import { get } from 'request';
function downloadPage1(url: string, saveTo: string, cb: (err: Error, content?: string) => void) {
  get(url, (err, res) => { /* ... */ });
}
// Good: Promise + async/await
import { promisify } from 'util';
const writeFileAsync = promisify(require('fs').writeFile);
async function downloadPage(url: string, saveTo: string): Promise<string> {
  const response = await getAsync(url);  // 假设 getAsync 返回 Promise
  await writeFileAsync(saveTo, response);
  return response;
}

// ----------------------------- 错误处理 -----------------------------

// 26. 抛出 Error 对象 + 捕获并记录，不忽略
// Bad: 抛出字符串，或吞掉异常
function calculateTotal1(): number { throw 'Not implemented'; }
try { riskyOp(); } catch (e) { console.log(e); } // 仅打印
getUser().catch(e => console.log(e)); // 未处理
// Good: 抛出 Error，捕获后使用 logger，并向上传递或恰当处理
function calculateTotal(): number { throw new Error('Not implemented'); }
try { riskyOp(); } catch (e) { logger.error(e); }
getUser().catch(e => { logger.error(e); });

// ----------------------------- 格式化 -----------------------------

// 27. 大小写一致 + 调用函数靠近 + 导入组织 + 别名
// Bad: 混乱的命名风格
const DAYS_IN_WEEK1 = 7; const daysInMonth1 = 30;
const songs1 = []; const Artists1 = [];
function erase_database1() {} function RestoreDatabase() {}
// Good: 常量大写蛇形，变量/函数驼峰，类帕斯卡
const DAYS_IN_WEEK = 7; const DAYS_IN_MONTH = 30;
const songs = []; const artists = [];
function eraseDatabase() {} function restoreDatabase() {}
class Animal {} class Container {}

// 调用顺序：先写公开方法，内部调用的私有方法紧随其后
class PerformanceReview {
  review() { this.getPeerReviews(); this.getManagerReview(); }
  private getPeerReviews() { this.lookupPeers(); }
  private lookupPeers() { /* ... */ }
  private getManagerReview() { this.lookupManager(); }
  private lookupManager() { /* ... */ }
}

// 导入分组与别名（需 tsconfig 配置 paths）
// Bad: 顺序混乱
import { TypeDefinition } from '../types/typeDefinition';
import fs from 'fs';
import { BindingScopeEnum } from 'inversify';
import 'reflect-metadata';
// Good: 分组有序（polyfill -> node -> 外部 -> 内部 -> 相对）
import 'reflect-metadata';
import fs from 'fs';
import { BindingScopeEnum } from 'inversify';
import { TypeDefinition } from '@types/typeDefinition';  // 使用别名代替长路径

// ----------------------------- 注释 -----------------------------

// 28. 代码自解释 + 删除注释掉代码 + 不用日记注释 + 避免位置标记 + TODO
// Bad: 用注释解释代码，并保留废弃代码
// Check if subscription is active.
if (subscription.endDate > Date.now) { /* ... */ }
class UserBad {
  name: string;
  // age: number;  // 注释掉的无用代码
}
/** 
 * 2016-12-20: Removed monads (RM)
 * 2015-03-14: Implemented combine (JR)
 */
function combineBad(a: number, b: number) { return a + b; }
// Good: 用有意义的变量替代注释，移除死代码，历史用 Git
const isSubscriptionActive = subscription.endDate > Date.now;
if (isSubscriptionActive) { /* ... */ }
class UserGood { name: string; email: string; }
function combine(a: number, b: number) { return a + b; }

// TODO 注释应标记改进点而非坏代码借口
function getActiveSubscriptions(): Promise<Subscription[]> {
  // TODO: ensure `dueDate` is indexed.
  return db.subscriptions.find({ dueDate: { $lte: new Date() } });
}