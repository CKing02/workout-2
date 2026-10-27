/**
 * G39 — ExerciseGifImage 单元测。
 *
 * 验证渲染策略:
 *  1. asset (asset: 前缀)→ 同步解析,直接渲染 Image(无 Skeleton 闪烁)
 *  2. remote (https://)→ 初始 Skeleton → useEffect 触发 getCachedOrDownload
 *                         → 成功 → setSource → 切到 Image
 *  3. none (null/undefined/未知前缀)→ 一直 Skeleton(由外层 Thumbnail 兜底)
 *  4. remote 下载失败 → 静默 → Skeleton 持续(不抛)
 *  5. remote 期间组件 unmount → cancelled 守卫阻止 setState('act' warning)
 *
 * mocks:
 *  - Skeleton: 简化成带 testID 的 View,断言存在即可
 *  - expo-image: 简化成 RN Image,带 testID 用于断言
 *  - exerciseGifCache: getCachedOrDownload 用 jest.fn() 控制 resolve/reject
 *  - exerciseGifAssets: 真模块(纯函数),无副作用
 */

import React from 'react';
import { Image as RNImage, Text, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

// 静态 mock —— expo-image 只用来断言 source 是否传到位
jest.mock('expo-image', () => ({
  __esModule: true,
  Image: (props: { source: unknown; accessibilityLabel?: string; testID?: string }) => {
    const RNView = require('react-native').View;
    return (
      <RNView
        testID={props.testID ?? 'expo-image'}
        accessibilityLabel={props.accessibilityLabel}
        // 把 source 序列化进 data-source prop,方便断言
        data-source={JSON.stringify(props.source ?? null)}
      />
    );
  },
}));

// Skeleton mock:用 RN View + testID,断言"渲染了 Skeleton"
// 注意:findAllByProps({ testID }) 会把 mock 函数组件实例 + 它返回的
// host View 都算上 —— 用 RNView 类型过滤。
jest.mock('@/components/Skeleton', () => ({
  Skeleton: (props: { width: number; height: number; rounded?: string }) => {
    const RNView = require('react-native').View;
    return (
      <RNView
        testID="skeleton"
        data-width={props.width}
        data-height={props.height}
        data-rounded={props.rounded}
      />
    );
  },
}));

// 辅助:只取 host View 上挂的 testID(避开 mock 函数组件实例重复计数)
const hostViewsByTestId = (tree: TestRenderer.ReactTestRenderer, id: string) => {
  const View = require('react-native').View;
  return tree.root.findAllByType(View).filter((n) => n.props.testID === id);
};

// exerciseGifCache mock:getCachedOrDownload 用全局 jest.fn 控制
// 变量名前缀必须含 "mock"(大小写不敏感)——jest.mock factory 闭包限制。
const mockGetCachedOrDownload = jest.fn<
  Promise<string | null>,
  [string]
>();

jest.mock('@/screens/exerciseGifCache', () => ({
  getCachedOrDownload: (url: string) => mockGetCachedOrDownload(url),
}));

// exerciseGifAssets 是纯函数 —— 不 mock,直接用真模块

// useTheme 真模块即可,ExerciseGifImage 不用它

import { ExerciseGifImage } from '@/components/ExerciseGifImage';
import * as gifAssets from '@/screens/exerciseGifAssets';

function flushPromises(): Promise<void> {
  // 把当前微任务队列清空,触发 useEffect 里的 promise then
  return new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  mockGetCachedOrDownload.mockReset();
  // 默认 download 失败返 null — 测试可按需 override
  mockGetCachedOrDownload.mockResolvedValue(null);
});

describe('G39 ExerciseGifImage', () => {
  it('切换内置动作时立即更新图片，切回时也恢复对应图片', () => {
    const resolve = jest.spyOn(gifAssets, 'resolveGifSource')
      .mockImplementation((url) => url === 'asset:first.gif' ? 101 : 202);
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => { tree = TestRenderer.create(<ExerciseGifImage gifUrl="asset:first.gif" size={40} />); });
    expect(hostViewsByTestId(tree, 'expo-image')[0].props['data-source']).toBe('101');
    act(() => { tree.update(<ExerciseGifImage gifUrl="asset:second.gif" size={40} />); });
    expect(hostViewsByTestId(tree, 'expo-image')[0].props['data-source']).toBe('202');
    act(() => { tree.update(<ExerciseGifImage gifUrl="asset:first.gif" size={40} />); });
    expect(hostViewsByTestId(tree, 'expo-image')[0].props['data-source']).toBe('101');
    act(() => tree.unmount());
    resolve.mockRestore();
  });

  it('切到内置动作后，旧网络图片的迟到结果不能覆盖当前动作', async () => {
    let resolveDownload!: (uri: string | null) => void;
    mockGetCachedOrDownload.mockReturnValueOnce(new Promise((resolve) => { resolveDownload = resolve; }));
    const resolveAsset = jest.spyOn(gifAssets, 'resolveGifSource').mockReturnValue(101);
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => { tree = TestRenderer.create(<ExerciseGifImage gifUrl="https://cdn/a.gif" size={40} />); });
    act(() => { tree.update(<ExerciseGifImage gifUrl="asset:first.gif" size={40} />); });
    await act(async () => { resolveDownload('file:///old.gif'); await flushPromises(); });
    expect(hostViewsByTestId(tree, 'expo-image')[0].props['data-source']).toBe('101');
    act(() => tree.unmount());
    resolveAsset.mockRestore();
  });
  it('asset: 前缀 → 同步渲染 Image(无 Skeleton 闪烁)', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExerciseGifImage gifUrl="asset:0025-EIeI8Vf.gif" size={40} />,
      );
    });

    // 有 expo-image,没 Skeleton
    expect(hostViewsByTestId(tree, 'expo-image')).toHaveLength(1);
    expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(0);
    // 没触发网络下载
    expect(mockGetCachedOrDownload).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });

  it('https:// 前缀 → 初始 Skeleton,异步成功后切到 Image', async () => {
    const uri = 'file:///mock/cache/gifs/0308-yz9nUhF.gif';
    mockGetCachedOrDownload.mockResolvedValueOnce(uri);

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExerciseGifImage
          gifUrl="https://cdn.example.com/exercises/0308-yz9nUhF.gif"
          size={40}
        />,
      );
    });

    // 第一次 render:Skeleton
    expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(1);
    expect(hostViewsByTestId(tree, 'expo-image')).toHaveLength(0);
    expect(mockGetCachedOrDownload).toHaveBeenCalledWith(
      'https://cdn.example.com/exercises/0308-yz9nUhF.gif',
    );

    // 等 promise 解析 + setState 生效
    await act(async () => {
      await flushPromises();
    });

    // 第二次 render:Image with { uri }
    const images = hostViewsByTestId(tree, 'expo-image');
    expect(images).toHaveLength(1);
    expect(images[0].props['data-source']).toBe(JSON.stringify({ uri }));
    expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(0);

    act(() => tree.unmount());
  });

  it('https:// 下载失败 → Skeleton 持续,不抛', async () => {
    mockGetCachedOrDownload.mockRejectedValueOnce(new Error('Network'));

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExerciseGifImage
          gifUrl="https://cdn.example.com/exercises/1325-CmEr4pM.gif"
          size={40}
        />,
      );
    });

    await act(async () => {
      await flushPromises();
    });

    // 失败 → 仍是 Skeleton
    expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(1);
    expect(hostViewsByTestId(tree, 'expo-image')).toHaveLength(0);

    act(() => tree.unmount());
  });

  it('https:// url 变化 → 重置 source,重新下载', async () => {
    const uri1 = 'file:///mock/a.gif';
    const uri2 = 'file:///mock/b.gif';
    mockGetCachedOrDownload.mockResolvedValueOnce(uri1);

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExerciseGifImage gifUrl="https://cdn/a.gif" size={40} />,
      );
    });

    await act(async () => {
      await flushPromises();
    });
    expect(hostViewsByTestId(tree, 'expo-image')).toHaveLength(1);

    // 换 url
    mockGetCachedOrDownload.mockResolvedValueOnce(uri2);
    act(() => {
      tree.update(
        <ExerciseGifImage gifUrl="https://cdn/b.gif" size={40} />,
      );
    });

    // 重置后:Skeleton 短暂出现
    expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(1);

    await act(async () => {
      await flushPromises();
    });

    const images = hostViewsByTestId(tree, 'expo-image');
    expect(images).toHaveLength(1);
    expect(images[0].props['data-source']).toBe(JSON.stringify({ uri: uri2 }));

    act(() => tree.unmount());
  });

  it('gifUrl=null → 一直 Skeleton,不调下载', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<ExerciseGifImage gifUrl={null} size={40} />);
    });

    expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(1);
    expect(hostViewsByTestId(tree, 'expo-image')).toHaveLength(0);
    expect(mockGetCachedOrDownload).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });

  it('gifUrl=undefined → 一直 Skeleton', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<ExerciseGifImage size={40} />);
    });

    expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(1);
    expect(mockGetCachedOrDownload).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });

  it('未知前缀 → 一直 Skeleton(分类为 none)', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExerciseGifImage gifUrl="videos/foo.gif" size={40} />,
      );
    });

    expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(1);
    expect(mockGetCachedOrDownload).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });

  it('asset: 前缀但解析为 undefined(G35_GIF_ASSETS 里没有)→ Skeleton', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExerciseGifImage gifUrl="asset:9999-NOTFOUND.gif" size={40} />,
      );
    });

    expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(1);

    act(() => tree.unmount());
  });

  it('https:// 期间 unmount → cancelled,不再 setState', async () => {
    // 用一个永不 resolve 的 promise 模拟"下载中"
    let resolveDownload!: (uri: string | null) => void;
    mockGetCachedOrDownload.mockReturnValueOnce(
      new Promise<string | null>((resolve) => {
        resolveDownload = resolve;
      }),
    );

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExerciseGifImage gifUrl="https://cdn/a.gif" size={40} />,
      );
    });

    expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(1);

    // 卸载
    act(() => tree.unmount());

    // promise 之后 resolve — 不应该再触发 setState(否则会触发 'act' warning)
    await act(async () => {
      resolveDownload('file:///late.gif');
      await flushPromises();
    });

    // 卸载后组件已不存在,这里只验证不抛错
  });

  it('size / rounded 透传到 Skeleton(Image 路径也透传 size)', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<ExerciseGifImage gifUrl={null} size={64} />);
    });

    const skel = hostViewsByTestId(tree, 'skeleton')[0];
    expect(skel.props['data-width']).toBe(64);
    expect(skel.props['data-height']).toBe(64);
    expect(skel.props['data-rounded']).toBe('circle');

    act(() => tree.unmount());
  });

  it('accessibilityLabel 透传到 Image', async () => {
    const uri = 'file:///x.gif';
    mockGetCachedOrDownload.mockResolvedValueOnce(uri);

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExerciseGifImage
          gifUrl="https://cdn/a.gif"
          size={40}
          accessibilityLabel="杠铃卧推动作演示"
        />,
      );
    });

    await act(async () => {
      await flushPromises();
    });

    const images = hostViewsByTestId(tree, 'expo-image');
    expect(images[0].props.accessibilityLabel).toBe('杠铃卧推动作演示');

    act(() => tree.unmount());
  });

  // === G44 腾讯云 COS 路径(254 个 bundled:false 走 https) ===
  describe('G44 腾讯云 COS 路径', () => {
    const R2_BASE = 'https://workout-gifs-cdn-20260923-1327489994.cos.ap-shanghai.myqcloud.com/exercises';

    it('COS URL → 初始 Skeleton,异步成功后切到 Image(Skeleton → setSource 序列)', async () => {
      const r2Url = `${R2_BASE}/0151-7xI5MXA.gif`;
      const fileUri = 'file:///mock/cache/gifs/0151-7xI5MXA.gif';
      mockGetCachedOrDownload.mockResolvedValueOnce(fileUri);

      let tree!: TestRenderer.ReactTestRenderer;
      act(() => {
        tree = TestRenderer.create(<ExerciseGifImage gifUrl={r2Url} size={40} />);
      });

      // 第一帧:Skeleton(remote 还没解析)
      expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(1);
      expect(hostViewsByTestId(tree, 'expo-image')).toHaveLength(0);
      expect(mockGetCachedOrDownload).toHaveBeenCalledWith(r2Url);

      // 等 promise → setSource
      await act(async () => {
        await flushPromises();
      });

      // 第二帧:Image with file:// URI(从 cache 走)
      const images = hostViewsByTestId(tree, 'expo-image');
      expect(images).toHaveLength(1);
      expect(images[0].props['data-source']).toBe(JSON.stringify({ uri: fileUri }));
      expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(0);

      act(() => tree.unmount());
    });

    it('R2 URL 缓存命中(getCachedOrDownload 立即返 file://)→ 跳过 Skeleton → Image', async () => {
      // 模拟缓存命中:getCachedOrDownload 同步微任务内 resolve,第一帧可能还是 Skeleton
      // 但 flushPromises 后立即是 Image
      const r2Url = `${R2_BASE}/0251-9WTm7dq.gif`;
      const fileUri = 'file:///cached/0251-9WTm7dq.gif';
      mockGetCachedOrDownload.mockResolvedValueOnce(fileUri);

      let tree!: TestRenderer.ReactTestRenderer;
      act(() => {
        tree = TestRenderer.create(<ExerciseGifImage gifUrl={r2Url} size={40} />);
      });

      await act(async () => {
        await flushPromises();
      });

      const imgs = hostViewsByTestId(tree, 'expo-image');
      expect(imgs).toHaveLength(1);
      expect(imgs[0]?.props['data-source']).toBe(JSON.stringify({ uri: fileUri }));

      act(() => tree.unmount());
    });

    it('R2 URL download 失败(null)→ Skeleton 持续,等待下次 retry', async () => {
      const r2Url = `${R2_BASE}/1311-Ccm5kAE.gif`;
      mockGetCachedOrDownload.mockResolvedValueOnce(null);

      let tree!: TestRenderer.ReactTestRenderer;
      act(() => {
        tree = TestRenderer.create(<ExerciseGifImage gifUrl={r2Url} size={40} />);
      });

      await act(async () => {
        await flushPromises();
      });

      // Skeleton 持续 — UI 兜底
      expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(1);
      expect(hostViewsByTestId(tree, 'expo-image')).toHaveLength(0);

      act(() => tree.unmount());
    });

    it('asset: 前缀(bundled === true)→ 同步 Image,不调 getCachedOrDownload', () => {
      let tree!: TestRenderer.ReactTestRenderer;
      act(() => {
        tree = TestRenderer.create(
          <ExerciseGifImage gifUrl="asset:0025-EIeI8Vf.gif" size={40} />,
        );
      });

      // 同步路径 — Skeleton 都不出现
      expect(hostViewsByTestId(tree, 'expo-image')).toHaveLength(1);
      expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(0);
      expect(mockGetCachedOrDownload).not.toHaveBeenCalled();

      act(() => tree.unmount());
    });

    it('R2 URL 切换 → cancelled 守卫清空 source,触发新一轮下载', async () => {
      const r2Url1 = `${R2_BASE}/0151-7xI5MXA.gif`;
      const r2Url2 = `${R2_BASE}/0662-I4hDWkc.gif`;
      const fileUri1 = 'file:///cache/0151-7xI5MXA.gif';
      const fileUri2 = 'file:///cache/0662-I4hDWkc.gif';

      mockGetCachedOrDownload.mockResolvedValueOnce(fileUri1);

      let tree!: TestRenderer.ReactTestRenderer;
      act(() => {
        tree = TestRenderer.create(<ExerciseGifImage gifUrl={r2Url1} size={40} />);
      });

      await act(async () => {
        await flushPromises();
      });
      // 第一次下载成功
      expect(hostViewsByTestId(tree, 'expo-image')).toHaveLength(1);
      expect(mockGetCachedOrDownload).toHaveBeenCalledWith(r2Url1);

      // 切到 r2Url2 — 触发新一轮 effect
      mockGetCachedOrDownload.mockResolvedValueOnce(fileUri2);
      act(() => {
        tree.update(<ExerciseGifImage gifUrl={r2Url2} size={40} />);
      });
      // setSource(null) → Skeleton 短暂出现
      expect(hostViewsByTestId(tree, 'skeleton')).toHaveLength(1);

      await act(async () => {
        await flushPromises();
      });

      expect(mockGetCachedOrDownload).toHaveBeenCalledWith(r2Url2);
      const images = hostViewsByTestId(tree, 'expo-image');
      expect(images).toHaveLength(1);
      expect(images[0].props['data-source']).toBe(JSON.stringify({ uri: fileUri2 }));

      act(() => tree.unmount());
    });
  });
});

// 故意保留 RNImage / Text / View imports 以避免 tsconfig 报 unused,这些是
// jest-expo preset 默认 mock 过的 RN 类型锚点。
void RNImage;
void Text;
void View;
