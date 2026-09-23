# Cloudflare R2 bucket 搭建 — workout2-gifs

> **目标**:把 250+ 张 GIF 公开托管,供 G41 CDN 在线加载路径使用。
> **预算**:1,324 × 98KB ≈ 130MB,本次 G41 上传 250 张 ≈ 25MB,$0.0004/月(几乎免费)。
> **耗时**:首次 10-15 分钟(含开通 R2),上传 250 张 1-2 分钟。

---

## Step 1 — 开通 R2(首次访问需绑卡)

1. 打开 https://dash.cloudflare.com/
2. 左侧栏找到 **R2 Object Storage** → 点开
3. 若提示「Set up R2」,选 **Pay-as-you-go**(信用卡 / 银联 / PayPal 都行,免费额度 10GB 存储 + 1000 万次 read/月,够用到 1 万用户)
4. 绑卡完成后回到 R2 主页面

> 已经开通过 R2 跳过这步。

---

## Step 2 — 创建 bucket

1. R2 主页 → **Create bucket**
2. **Bucket name**: `workout2-gifs`(全小写、连字符)
3. **Location**: `Asia-Pacific`(亚太用户访问更快;留 default `Eastern North America` 也行)
4. 点 **Create bucket**

---

## Step 3 — 公开访问(让客户端能直 GET)

1. 进 `workout2-gifs` bucket → 右侧 **Settings**
2. 找到 **Public access** 区块 → 点 **Allow Access** → 选 **Public bucket** → 点 **Save**
   - 警告会跳一次「public access 有数据泄露风险」,确认打勾
3. 页面会显示一个 **Public bucket URL**,格式像:
   ```
   https://pub-abc123def456.r2.dev
   ```
   **复制这个 URL** — Step 6 要用

> R2 公开 URL 走的是 Cloudflare 的 CDN,Asia-Pacific 区域首次访问 < 500ms,海外用户走 closest PoP。

---

## Step 4 — 配 CORS(允许 RN / Web fetch)

1. 同 Settings 页面,找到 **CORS Policy** 区块
2. 点 **Add CORS Policy** → 把下面 JSON 粘进去 → 保存:

   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   - `AllowedMethods` 只开 `GET` + `HEAD` — 我们不需要 POST(只读)
   - `AllowedOrigins: *` — 真机/模拟器没 Origin,放最宽;后续如担心被刷可收紧

> 必须在建 bucket 后立即配,否则 RN fetch 会被 CORS 拒掉。

---

## Step 5 — 生成 API token(给上传脚本用)

1. 右上角头像 → **My Profile** → 左侧 **API Tokens** → **Create Token**
2. 模板选 **Edit Cloudflare R2** → 下一步
3. **Permissions** 留默认 `Object Read & Write`
4. **Bucket Resources** 选 `Specific buckets` → 选 `workout2-gifs`
5. **TTL** 选 1 day(G41 跑一次上传脚本就够;后续要再加 token 即可)
6. **Continue to summary** → **Create Token**
7. 复制两个值(只在创建时显示一次,关掉就看不到了):
   - **Access Key ID**(像 `abc123def456`)
   - **Secret Access Key**(像 `很长一串 32+ 字符`)
8. 还需要一个值:**Account ID**
   - 右上角头像 → **My Profile** → 右侧栏 **Account ID** 就是

---

## Step 6 — 把 4 个值告诉我

把下面这 4 个值复制粘贴回来(或者你直接告诉我也行):

```
R2_PUBLIC_URL=          # Step 3 拿到的 pub-xxx.r2.dev
R2_ACCOUNT_ID=          # Step 5 拿到的 Account ID
R2_ACCESS_KEY_ID=       # Step 5 拿到的 Access Key ID
R2_SECRET_ACCESS_KEY=   # Step 5 拿到的 Secret Access Key
```

> 我会用这 4 个值配 `.env.local`(不 commit)+ 跑 `node scripts/upload-g41-r2.js`。

---

## 上传完成后验证

我跑完上传脚本后,会拉一条样例 URL 出来给你:

```
$ curl -I https://pub-xxx.r2.dev/workout2-gifs/exercises/0001-3-4-sit-up.gif
HTTP/2 200
content-type: image/gif
content-length: 98234
```

如果你手动验证:
```bash
# 拿 1 张 sample 测试 200
curl -I https://pub-xxx.r2.dev/workout2-gifs/exercises/0025-EIeI8Vf.gif
# 应该回 200 + image/gif
```

---

## 常见问题

| 问题 | 解决 |
|------|------|
| bucket 名已存在 | Cloudflare R2 bucket 名跨 account 全局唯一,加后缀如 `workout2-gifs-v2` |
| 创建时绑卡报错 | 部分国内信用卡不支持,试 PayPal / 海外卡 / 银联 credit |
| Public access 按钮灰的 | 检查 account 是否 Verify 邮箱 + Phone |
| CORS 配了 RN 仍报 network error | 1) 检查 URL 拼对没 2) `AllowedOrigins` 配 `*` 3) `AllowedMethods` 含 `GET` 4) 浏览器开 devtools 看 Network/Headers 的 CORS section |
| API token 创建后找不到 | 创建时只显示一次;没复制只能 Delete 重来 |
| 上传 250 张很慢 | 脚本默认 8 路并发,500KB/s 单连接,理论 1-2 分钟;若慢先检查 npm 网络 |

---

## 关联

- GOALS.md **G41** — 完整设计 + AC
- `scripts/upload-g41-r2.js` — 上传脚本(待 R2 就绪后写)
- `src/screens/exerciseGifCache.ts` — 客户端下载 + LRU 200MB
- `src/components/ExerciseGifImage.tsx` — 三态渲染(asset / remote / none)
