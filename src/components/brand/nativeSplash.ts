import * as SplashScreen from 'expo-splash-screen';

// Expo 57: 必须在模块作用域调用，不能等组件 effect（那时可能已自动隐藏）。
// 原生只负责首帧交接；淡出由 BootSplash 负责，避免两层同时淡出。
SplashScreen.setOptions({ duration: 0, fade: false });
void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  console.warn('[brand] Unable to retain native splash', error);
});

export function hideNativeSplash(): void {
  SplashScreen.hide();
}
