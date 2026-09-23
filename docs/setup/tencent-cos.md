# 腾讯云 COS bucket 搭建 — workout2-gifs

> **目标**:把 250+ 张 GIF 公开托管,供 G41 CDN 在线加载路径使用。
> **预算**:254 张 × 98KB ≈ 25MB,< 1 元/月(在免费额度内,只产生读请求费 ~0.9 元/月)。
> **耗时**:首次 10-15 分钟(含实名认证),上传 254 张 1-2 分钟(浏览器批量)。

---

## 为什么是 COS 而不是 Cloudflare R2

- G41 原本走 Cloudflare R2,但 Bug 2 拖到 2026-09-17 仍未部署(R2 没绑卡 + 国内访问慢)。
- 用户拍板 G44 改用腾讯云 COS,理由:
  - 国内访问稳定(避免 R2 在大陆经常被墙)
  - 按量计费,**月成本 < 1 元**,根本不需要预购任何资源包
  - 实名一次,长期有效;R2 的卡/PayPal 反而是麻烦

---

## Step 1 — 注册 + 实名认证(5 分钟,首次需要)

1. 打开 https://cloud.tencent.com
2. 用微信 / QQ 扫码注册
3. **实名认证**(必须,否则 COS 创建 bucket 会失败):
   - 个人:身份证 + 人脸识别,1-2 分钟
   - 企业:营业执照 + 对公打款,1-3 个工作日
4. 充值:账户留 ≥ 1 元即可(避免欠费停服)

> 已经注册+实名过跳过这步。

---

## Step 2 — 开通 COS 服务(首次访问)

1. 控制台首页搜「**对象存储**」或直接 https://console.cloud.tencent.com/cos
2. 第一次进入会提示「开通 COS」,点**立即开通** → 勾选同意 → 开通(免费,只是开通服务)

---

## Step 3 — 创建 bucket(2 分钟)

控制台 → 对象存储 → **存储桶列表** → **创建存储桶**:

```
名称:   workout-gifs-cdn-{8位随机}      ← 全局唯一,加随机后缀防重名
地域:   上海(ap-shanghai)               ✅ 已确定
访问权限: 公有读私有写                   ← 关键!只允许自己上传
存储类型: 标准存储
```

> **公有读私有写**:
> - 全球任何人都能 GET 你的 GIF(就是 CDN 的本意)
> - 只有持 SecretId/SecretKey 的人能上传
> - 不需要"所有人可写",那等于拱手送人

---

## Step 4 — 配 CORS(允许 RN / Web fetch)

控制台 → 存储桶 → **安全管理** → **跨域访问 CORS 设置** → **添加规则**:

```
来源 Origin:           *
操作 Methods:          GET, HEAD, OPTIONS
允许 Headers:          *
暴露 Headers:          ETag, Content-Length, Content-Type
超时 Max-Age:          3600
```

- Methods 只开 `GET` + `HEAD` + `OPTIONS`(预检)—— 不需要 POST
- Origin `*` —— 真机没 Origin,放最宽;后续担心被刷可收紧

> 必须在建 bucket 后立即配,否则 RN fetch 会被 CORS 拒掉。

---

## Step 5 — (可选)防盗链

**不绑 CDN 的话盗链防护弱,但 G41 这种小规模没必要做。** 真担心被刷流量再回来配:

```
控制台 → 存储桶 → 安全管理 → 防盗链设置
  Referer 白名单: 空(或填你 App 的 bundle id 之后)
```

暂跳过。

---

## Step 6 — 上传 254 张 GIF(手工 / 拖拽)

控制台 → 存储桶 → **文件列表** → **上传文件** → **上传目录**(不要单文件上传,要支持递归):

1. 选 `.tmp/gifs/` 下全部 GIF(或者你已经单独整理好的目录)
2. 上传路径前缀:`exercises/`(让所有 GIF 落到同一前缀下)
3. 浏览器批量上传一次 ~50-100 张;254 张可能需要 2-3 批

> **腾讯云控制台上传限制**:单次最多 100 个文件 / 5GB。如果一次拖入太多会被截断或失败。

---

## Step 7 — 验证 GET

从文件列表随便挑一个文件 → 右侧 **复制链接**:

```
https://workout-gifs-cdn-XXXXXXXX-1300000000.cos.ap-shanghai.myqcloud.com/exercises/0025-EIeI8Vf.gif
```

**测试**:浏览器直接粘贴这个 URL,能看到图就 OK。

```bash
# 终端验证
curl -I 'https://your-cos-domain.cos.ap-shanghai.myqcloud.com/exercises/0025-EIeI8Vf.gif'
# 应该回 HTTP/1.1 200 + content-type: image/gif
```

---

## Step 8 — 把 COS base URL 告诉我

把下面的值复制粘贴回来(或者口头告诉我也行):

```
COS_BASE_URL=https://workout-gifs-cdn-XXXXXXXX-1300000000.cos.ap-shanghai.myqcloud.com
```

> 我会用这个值替换 `exerciseG35Mapping.ts` 里的 R2 placeholder URL,把 254 个 `cdnUrl` 一次性指向 COS。
>
> 同时更新 6 个测试文件里的 URL 断言,避免 `npm test` 红一片。

---

## 替换完成后的验证

我替换完之后,会拉一条样例 URL 出来给你:

```
$ curl -I https://workout-gifs-cdn-XXX.cos.ap-shanghai.myqcloud.com/exercises/0025-EIeI8Vf.gif
HTTP/1.1 200
content-type: image/gif
content-length: 98234
```

如果你手动验证:
```bash
# 拿 1 张 sample 测试 200
curl -I https://your-cos-domain.cos.ap-shanghai.myqcloud.com/exercises/0025-EIeI8Vf.gif
# 应该回 200 + image/gif
```

---

## 监控 / 费用提醒

**月成本估算**:

| 规模 | 月成本 |
|------|---------|
| 100 用户 × 30 次/天 | **< 1 元** |
| 1000 用户 × 30 次/天 | ~5 元 |
| 10000 用户 × 30 次/天 | ~50 元(此时才考虑流量包) |

控制台 → **费用中心** → **资源包管理**:不建议提前买资源包(用不完也不退);真流量大了再买 100GB 流量包(¥50/6 个月)。

控制台 → **消息订阅** → **费用预警**:建议**设置预算 ¥10/月**,超阈值短信通知,防被刷。

---

## 常见问题

| 问题 | 解决 |
|------|------|
| 创建 bucket 失败 / 实名提示 | 必须先完成实名认证(Step 1) |
| bucket 名已存在 | 全局唯一,加后缀如 `workout-gifs-cdn-2026` |
| CORS 配了 RN 仍报 network error | 1) 检查 URL 拼对没 2) Origin 配 `*` 3) Methods 含 `GET`+`OPTIONS` |
| 浏览器访问返回 403 | 检查 bucket 权限是「公有读私有写」不是「私有读写」 |
| 控制台上传失败 / 卡住 | 单批不要超过 100 个文件;有失败的单独重传 |
| 想要 HTTPS 自定义域名(非默认域名) | 控制台 → 存储桶 → 域名管理 → 自定义域名,需自己买域名 + 配证书 |

---

## 关联

- GOALS.md **G44** — 完整设计 + AC
- GOALS.md **G41** — 原 R2 计划,已被 G44 接手
- `src/screens/exerciseGifCache.ts` — 客户端下载 + LRU 200MB(代码不变,只换 URL)
- `src/components/ExerciseGifImage.tsx` — 三态渲染(asset / remote / none)
- `src/db/seeds/exerciseG35Mapping.ts` — 254 个 cdnUrl 待替换
- `scripts/upload-g41-r2.js` — 已废弃(R2 计划放弃),保留作为历史
