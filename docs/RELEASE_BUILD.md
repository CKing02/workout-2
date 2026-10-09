# 正式版（release APK）出包配方

> 产物形态：**独立 release APK** —— 可直接安装、JS 打进包内不依赖 Metro、可以发人。
> 不是 Play 上架的 AAB（`eas.json` 的 production profile 出的是 AAB，本次没用它）。

## 0. 密钥（唯一需要长期保管的东西）

| 项 | 位置 |
|---|---|
| keystore | `$KEYS_DIR/workout2-release.keystore` -- **故意放在仓库外**，不要 commit |
| 口令 | `$KEYS_DIR/workout2-release.password.txt` |
| alias | `workout2`（**SHA-256 指纹和 alias 别提交公网，自己离线留底**）|

> ⚠️ **丢了这两个文件 = 这个 App 永远无法原地升级**，只能让用户卸载重装（数据全没）。
> 请自行离线备份（U 盘 / 密码管理器）。

`android/` 在 `.gitignore:42` 里、每次 `expo prebuild` 重新生成，所以签名配置没法写死在
`android/app/build.gradle`，改用**每次出包跑一遍**的幂等脚本注入。

## 1. 出包命令

```bash
# ① 生成原生工程（会清空并重建 android/）
npx expo prebuild -p android --clean

# ② 注入正式签名配置（幂等，已有 marker 就跳过）
node scripts/release/patch-android-signing.mjs

# ③ 编译
cd android
# 改成你本机实际 JDK 17 安装路径（Windows / Git Bash 风格）
export JAVA_HOME="/d/Program Files/Eclipse Adoptium/jdk-17"
export CMAKE_BUILD_PARALLEL_LEVEL=2
export WORKOUT2_RELEASE_STORE_FILE="$KEYS_DIR/workout2-release.keystore"
# 密码从密码文件读，路径由 $KEYS_DIR 控制（自己改成实际位置）
export WORKOUT2_RELEASE_STORE_PASSWORD="$(tr -d '\r\n' < "$KEYS_DIR/workout2-release.password.txt")"
export WORKOUT2_RELEASE_KEY_ALIAS="workout2"
export WORKOUT2_RELEASE_KEY_PASSWORD="$WORKOUT2_RELEASE_STORE_PASSWORD"

./gradlew :app:assembleRelease \
  -PreactNativeArchitectures=arm64-v8a \
  --max-workers=2 -Dorg.gradle.workers.max=2 \
  --init-script ../scripts/release/gradle-cn-mirrors.init.gradle \
  -Dorg.gradle.internal.http.socketTimeout=20000 \
  -Dorg.gradle.internal.http.connectionTimeout=20000
```

产物：`android/app/build/outputs/apk/release/app-release.apk`

`patch-android-signing.mjs` 里**故意没有 debug 签名兜底**：缺环境变量时 Gradle 在配置阶段
直接抛 `GradleException`，而不是悄悄拿 debug key 签一个「看着成功」的包。
静默降级是这类构建里最危险的失败模式 —— 那种包装上去之后，等发现要上架时已经换不过来了。

## 2. 三个已踩过的坑（都是环境问题，不是代码问题）

### 坑 1：`dl.google.com` 下载卡死

`Could not download xxx.aar ... Read timed out`。更阴的是第二次：**看起来像卡死，
实际是在等一个已经死掉的 HTTPS 连接** —— 默认 socketTimeout 很大，Gradle 不会主动放弃。
判据：`jstack <daemon-pid>` 看到 Execution worker 是 `RUNNABLE` 但停在
`sun.nio.ch.Net.poll → SSLSocketInputRecord.read`，同时**没 CPU 也没写文件**。

解法 = `gradle-cn-mirrors.init.gradle`（阿里云镜像）+ **短 socketTimeout（20 s）**。
镜像只是兜底（追加在 google()/mavenCentral() 之后，缓存命中的照旧走缓存），
真正救命的是短超时：真卡住时 20 秒就放弃并落到镜像，而不是耗掉一个下午。

### 坑 2：C++ 阶段 `clang++: error: unable to execute command ... 系统资源不足 (0x5AA)`

16 核机器 → ninja 开 ~16 个并行 `clang++`，每个吃 1 GB+，把 26 GB 提交限额吃光。
`0x5AA` = `ERROR_NO_SYSTEM_RESOURCES`，**进程根本没起来，不是代码编译错**。

解法：`--max-workers=2` + `CMAKE_BUILD_PARALLEL_LEVEL=2`。慢一些，但能过。

### 坑 3：OPPO/ColorOS 装机要人工点确认

`adb install` 会**无限挂起**，因为 ColorOS 弹出自己的安装确认页
（`com.oplus.appdetail/.model.guide.ui.InstallGuideActivity`）等人点「继续安装」。
`adb install` 和 `adb shell pm install` 都一样要等这个。

判据：`dumpsys window | grep mFocusedApp` 看到 `InstallGuideActivity`，包却还没装上。
解法：让用户看着手机点一下。

> ⚠️ **更正（2026-10-01 二次装机时发现）**：第一次排障时把「`screencap` 截出来是纯白」
> 归因成了这个页面的 `FLAG_SECURE`，**这是错的**。真正原因是**手机当时锁着屏**
> （`dumpsys window` 的 `showing=true` + `mWakefulness=Dozing`），锁屏界面截出来就是纯白。
> 解锁后同一张截图 192 KB、内容完整，我也就此点到了「继续安装」。
> **筛查安装卡住的第一件事是看锁屏状态，不是怀疑 FLAG_SECURE。**
>
> 二次装机（同签名 `-r` 升级）时设备已解锁，`adb install -r` 直接返回 `Success`，
> **没有弹确认页** —— 所以这条坑的真实触发条件还没完全摸清，不确定是 ColorOS
> 记住了确认，还是 `-r` 升级路径本就不弹。

（另：`adb install` 的**传输**是快的 —— 47 MB 用 1.7 s。挂的永远是在设备端。）
如果 `adb install` 挂住，改用 `adb push` + `adb shell pm install -r <path>` 更好排查。

## 3. 包产出后逐条核实（离线，不用装机）

```bash
BT=/e/dev/android-sdk/build-tools/36.0.0
APK=android/app/build/outputs/apk/release/app-release.apk

"$BT/apksigner.bat" verify --print-certs "$APK"      # 签名指纹必须等于第 0 节那个 SHA-256
"$BT/aapt2.exe" dump badging "$APK" | head -5        # package/versionCode/versionName
"$BT/aapt2.exe" dump badging "$APK" | grep -E "launchable-activity|native-code"
"$BT/aapt2.exe" dump permissions "$APK" | grep -i -e camera -e record_audio   # 应当无输出
unzip -l "$APK" | grep index.android.bundle          # JS 内嵌，才不依赖 Metro
unzip -l "$APK" | grep -c "\.gif$"                   # 内置动作 GIF 数量
```

`launchable-activity` 必须是 `com.workout2.app.MainActivity`。
装了 `expo-dev-client` 时这条尤其要查 —— dev launcher 抢 launcher 的话，正式包会开成开发器。

## 4. 装机的两条硬约束

1. **换签名必须卸载重装。** 签名不同的包是**两个 App 身份**，`-r` 覆盖安装会报
   `INSTALL_FAILED_UPDATE_INCOMPATIBLE`。所以从 debug 版（CI 出的 dev-client APK）切到正式版，
   **设备上的数据会全没** —— 先让用户走「设置 → 导出备份」，装完再导入。
2. **升 versionCode。** 同一个签名下升级只认 `versionCode`（在 `app.json` 的 `android.versionCode`），
   `versionName` 只是给人看的。每次出正式包记得把它 +1，否则老用户装不上新的。

## 5. 本次（1.0.0 / versionCode 1）的核实结果

出过两个包，**第二个才是最终产物**：第一个（commit `d0e41b4`）装到真机后发现「我的」页
页脚写着 `v0.1.0` —— 三处硬编码版本号从没更新过（修于 `22c002b`，见 `src/utils/appVersion.ts`）。

**最终包** —— sha256 `2021f99c6b07b1bc970aa6d5a7edf0c14eaf1d7be61bfc51867e6caf7a72ff3a`，47,006,810 B：

- 签名：v2 scheme ✅（v1/v3 关，因为 `minSdk 24`），证书 SHA-256 与 keystore 一致 ✅
- `versionCode=1` / `versionName=1.0.0` / `package=com.workout2.app` ✅
- launcher = `com.workout2.app.MainActivity` ✅（不是 dev launcher）
- `native-code: 'arm64-v8a'` 单 ABI ✅
- `aapt2 dump permissions | grep -icE "CAMERA|RECORD_AUDIO"` → **0** ✅
  （`expo-image-picker` 插件配了 `cameraPermission:false` + `microphonePermission:false`
  才拦得住；见 `app.json`）
- `assets/index.android.bundle` 已内嵌 ✅；APK 内 `res/*.gif` 共 **52** 个 ✅
- `assets/app.config` 里 `version: "1.0.0"` / `versionCode: 1` ✅
  —— 这就是 `Constants.expoConfig` 的数据源，`getAppVersion()` 读的是它
- `:app:lintVitalRelease` 通过 ✅

### 装机核实（OPPO PBEM00 / Android 10 / API 29，`3c66de59`）

| # | 操作 | 结果 |
|---|---|---|
| 1 | `adb install -r`（同签名升级） | `Success`，**没卸载、没丢数据** —— 原地升级路径成立 ✅ |
| 2 | 冷启动（无 Metro、`adb reverse --list` 为空） | 正常进首页 ✅ |
| 3 | 我的 Tab | 页脚 **`锻炼2点零 · v1.0.0`** ✅（第一个包这里是 `v0.1.0`） |
| 4 | 升级后用户名 | 仍是 `alice`，证明 `-r` 保住了数据 ✅ |

> `READ_MEDIA_IMAGES` 不在权限表里 —— 这是对的，Android 13+ 走系统 Photo Picker
> 不需要它；API ≤32 才用 `READ_EXTERNAL_STORAGE`（`maxSdkVersion="32"`）。

> 备份 JSON 里的 `appVersion` 走的是同一个 `getAppVersion()`（`utils/exportData.ts`），
> 但 release 包**不是 debuggable**，`run-as` 读不到导出文件，所以**没有单独抽查过 JSON 内容** ——
> 那一环只有单测覆盖（`utils/__tests__/appVersion.test.ts`）。
