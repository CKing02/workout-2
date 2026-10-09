#!/usr/bin/env node
/**
 * 给 `expo prebuild` 生成的 android 工程注入**正式签名配置**。
 *
 * ## 为什么需要这个脚本
 *
 * `android/` 在 `.gitignore:42` 里，**每次构建都由 `npx expo prebuild` 重新生成**，
 * 所以手改 `android/app/build.gradle` 是一次性的 —— 下次 prebuild 就没了。
 * 项目文档里那条「app.json 才是唯一的杠杆」说的就是这个。签名配置又没法写在
 * app.json 里，于是折中成一个**每次构建后跑一遍**的幂等脚本。
 *
 * ## 做法：追加而不是改写
 *
 * 不用正则去手术改造原文件（Gradle 文件的缩进/顺序会随 Expo 模板版本变，
 * 文本改写非常脆）。**追加**第二个 `android { }` 块即可 —— Groovy DSL 里
 * 同一个 build script 出现多个 `android {}` 是合法的，配置是**累加**的。
 * 这样无论模板怎么变，本脚本都不会把 build.gradle 改坏。
 *
 * ## 默认行为提醒
 *
 * Expo/RN 模板给 release buildType 的默认值是 `signingConfig signingConfigs.debug`
 * —— 也就是说**不加这个脚本，`assembleRelease` 会拿 debug key 签名**。
 * 那样的包能装，但和正式签名是两个不同的 App 身份，以后换不过来。
 *
 * ## 用法
 *
 *   npx expo prebuild -p android --clean
 *   node scripts/release/patch-android-signing.mjs
 *   WORKOUT2_RELEASE_STORE_FILE=... \
 *   WORKOUT2_RELEASE_STORE_PASSWORD=... \
 *   WORKOUT2_RELEASE_KEY_ALIAS=... \
 *   WORKOUT2_RELEASE_KEY_PASSWORD=... \
 *   ./gradlew :app:assembleRelease
 *
 * 缺任一环境变量时 **Gradle 在配置阶段就会报错**（见下面的 requireEnv），
 * 而不是悄悄退回 debug 签名 —— 静默降级是这类构建里最危险的失败模式。
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MARKER = '// === injected by scripts/release/patch-android-signing.mjs ===';
const GRADLE_FILE = resolve(process.cwd(), 'android/app/build.gradle');

if (!existsSync(GRADLE_FILE)) {
  console.error(`[signing] 找不到 ${GRADLE_FILE}`);
  console.error('[signing] 先跑 `npx expo prebuild -p android --clean`。');
  process.exit(1);
}

const source = readFileSync(GRADLE_FILE, 'utf8');

if (source.includes(MARKER)) {
  console.log('[signing] 已经注入过，跳过（幂等）。');
  process.exit(0);
}

/**
 * 每个变量都必填。**故意不用 `?: 'debug'` 之类的兜底** ——
 * 这里宁可构建失败，也不要产出一个「看起来成功了、其实是 debug 签名」的正式包。
 * 那种包装上之后，等发现要上架时已经没法覆盖升级了。
 */
const INJECTION = `

${MARKER}
android {
    signingConfigs {
        release {
            // 从环境变量读，密钥文件本身不在仓库里
            // （keystore 放在仓库外的 $KEYS_DIR/ 下，路径由环境变量 WORKOUT2_RELEASE_STORE_FILE 注入）。
            def requireEnv = { name ->
                def v = System.getenv(name)
                if (v == null || v.isEmpty()) {
                    throw new GradleException(
                        "[signing] 环境变量 \${name} 未设置 —— 正式包必须用 release keystore 签名，" +
                        "拒绝退回 debug 签名。见 scripts/release/patch-android-signing.mjs"
                    )
                }
                return v
            }
            storeFile file(requireEnv('WORKOUT2_RELEASE_STORE_FILE'))
            storePassword requireEnv('WORKOUT2_RELEASE_STORE_PASSWORD')
            keyAlias requireEnv('WORKOUT2_RELEASE_KEY_ALIAS')
            keyPassword requireEnv('WORKOUT2_RELEASE_KEY_PASSWORD')
        }
    }
    buildTypes {
        release {
            // 覆盖模板默认的 signingConfigs.debug
            signingConfig signingConfigs.release
        }
    }
}
`;

writeFileSync(GRADLE_FILE, source + INJECTION, 'utf8');
console.log(`[signing] 已注入 release 签名配置 → ${GRADLE_FILE}`);
