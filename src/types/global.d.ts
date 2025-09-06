// 通过 declare global 来扩展全局作用域的类型
declare global {
  // 定义一个名为 tempTokenStore 的全局变量
  // 它的类型是一个 Map，键是字符串，值是一个包含 cookie 和 expires 的对象
  // eslint-disable-next-line no-var
  var tempTokenStore: Map<string, { cookie: string; expires: number }>;
}

// 添加这行 export {}; 是为了让 TypeScript 将这个文件视为一个模块，这是 d.ts 文件的标准做法
export {};
