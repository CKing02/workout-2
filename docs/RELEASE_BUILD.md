# 正式版（release APK）出包配方

> 产物形态：**独立 release APK** —— 可直接安装、JS 打进包内不依赖 Metro、可以发人。
> 不是 Play 上架的 AAB（`eas.json` 的 production profile 出的是 AAB，本次没用它）。

## 0. 密钥（唯一需要长期保管的东西）

| 项 | 位置 |
|---|---|
| keystore | `<REDACTED-KEYS-PATH>/workout2-release.keystore` —— **故意放在仓库外**，不要 commit |
| 口令 | `<REDACTED-KEYS-PATH>/workout2-release.password.txt` |
| alias | `workout2` |
| 证书 SHA-256 | `<REDACTED-CERT-SHA256>` |

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
export JAVA_HOME="/d/Program Files/Eclipse Adoptium/jdk-17.0.20.101-hotspot"
export CMAKE_BUILD_PARALLEL_LEVEL=2
export WORKOUT2_RELEASE_STORE_FILE="<REDACTED-KEYS-PATH>/workout2-release.keystore"
export WORKOUT2_RELEASE_STORE_PASSWORD="$(tr -d '\r\n' < <REDACTED-KEYS-PATH>/workout2-release.password.txt)"
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
而且该页设了 `FLAG_SECURE` —— `screencap` 截出来是纯白，`uiautomator dump` 也看不全，
**从 adb 这边没法看到它、也没法安全地盲点**。

判据：`dumpsys window | grep mFocusedApp` 看到 `InstallGuideActivity`，包却还没装上。
解法：让用户看着手机点一下。

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

- 签名：v2 scheme ✅，证书 SHA-256 与 keystore 一致 ✅
- `versionCode=1` / `versionName=1.0.0` / `package=com.workout2.app` ✅
- launcher = `com.workout2.app.MainActivity` ✅（不是 dev launcher）
- `native-code: 'arm64-v8a'` 单 ABI ✅
- **无 `CAMERA` / 无 `RECORD_AUDIO`** ✅（`expo-image-picker` 插件配了 `cameraPermission:false`
  + `microphonePermission:false` 才拦得住；见 `app.json`）
- `assets/index.android.bundle` 3,579,940 B 已内嵌 ✅；APK 内 `res/*.gif` 共 **52** 个 ✅
- `:app:lintVitalRelease` 通过 ✅
- 大小 47,006,502 B（47 MB）；sha256 `71a2216624ea798cb62347a449adaccd7260a2b39bf6e7b581f0a8feab9137fd`

> 未装机确认的一条：`READ_MEDIA_IMAGES` 不在权限表里 —— 这是对的，Android 13+ 走系统
> Photo Picker 不需要它；API ≤32 才用 `READ_EXTERNAL_STORAGE`（`maxSdkVersion="32"`）。
