/**
 * DiagnosticsScreen — 查看应用自动捕获的错误日志（G13）
 *
 * 数据来源:`installErrorHandlers()` 落库的 JS render/unhandled 错误 +
 * 未处理 Promise 拒绝。
 *
 * 主要功能:
 *  - FlatList 倒序列出最近 100 条;每行展示相对时间、source Badge、message 摘要
 *  - 点击行展开完整 stack,行内 "复制这条" 按钮可把单条 JSON 写入剪贴板
 *  - headerRight 提供 "刷新" + "复制全部" 按钮,JSON 化整张表给用户粘贴
 *  - "清空" 按钮触发二次 Dialog 确认后 `errorLogRepo.clear()`
 *  - 仅在复制 / 清空成功时给 toast;不主动通知用户有错误(静默原则)
 *
 * 不做的事:
 *  - 不订阅实时刷新 — 进入屏 / 点刷新按钮才 reload(简化 v1)
 *  - 不做错误聚合 / 去重 / 分组
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Badge, type BadgeVariant } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { EmptyState } from '@/components/EmptyState';
import { toast } from '@/hooks/useToast';
import { getDatabase } from '@/db';
import { errorLogRepo } from '@/db/repositories/errorLogRepo';
import type { ErrorLog } from '@/db/schema';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { getAppVersion } from '@/utils/appVersion';

type Props = NativeStackScreenProps<RootStackParamList, 'Diagnostics'>;

const PREVIEW_MAX = 80;

export function DiagnosticsScreen({ navigation }: Props) {
  const { colors, spacing, typography, radius } = useTheme();

  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const db = await getDatabase();
      const rows = await errorLogRepo.list(db, 100);
      setLogs(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show(`加载日志失败：${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ----------------------------------------------------------------
  // Header right: 刷新 + 复制全部
  // ----------------------------------------------------------------
  const handleCopyAll = useCallback(async () => {
    if (logs.length === 0) {
      toast.show('暂无日志可复制', 'info');
      return;
    }
    try {
      const json = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          appVersion: getAppVersion(),
          count: logs.length,
          logs,
        },
        null,
        2,
      );
      await Clipboard.setStringAsync(json);
      toast.show(`已复制 ${logs.length} 条日志到剪贴板`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show(`复制失败：${msg}`, 'error');
    }
  }, [logs]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="刷新日志"
            onPress={() => {
              setLoading(true);
              void load();
            }}
            hitSlop={12}
          >
            <Text style={[typography.label, { color: colors.primary }]}>刷新</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="复制全部日志到剪贴板"
            onPress={handleCopyAll}
            hitSlop={12}
          >
            <Text style={[typography.label, { color: colors.primary }]}>复制</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, load, handleCopyAll, colors.primary, typography.label]);

  // ----------------------------------------------------------------
  // Clear
  // ----------------------------------------------------------------
  const handleClearConfirm = useCallback(async () => {
    setClearOpen(false);
    try {
      const db = await getDatabase();
      await errorLogRepo.clear(db);
      setLogs([]);
      setExpandedId(null);
      toast.show('日志已清空', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show(`清空失败：${msg}`, 'error');
    }
  }, []);

  // ----------------------------------------------------------------
  // Per-row actions
  // ----------------------------------------------------------------
  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const copyOne = useCallback(async (log: ErrorLog) => {
    try {
      const json = JSON.stringify(log, null, 2);
      await Clipboard.setStringAsync(json);
      toast.show('已复制这条日志', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.show(`复制失败：${msg}`, 'error');
    }
  }, []);

  const renderItem: ListRenderItem<ErrorLog> = useCallback(
    ({ item }) => (
      <LogRow
        log={item}
        expanded={expandedId === item.id}
        onToggle={() => toggleExpand(item.id)}
        onCopy={() => void copyOne(item)}
      />
    ),
    [expandedId, toggleExpand, copyOne],
  );

  const isEmpty = !loading && logs.length === 0;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxxxl,
        }}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          logs.length > 0 ? (
            <View style={{ marginBottom: spacing.md, gap: spacing.xs }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                共 {logs.length} 条日志（仅展示最近 100 条）
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                静默捕获 JS 错误与未处理 Promise 拒绝;不会上传至任何服务器。
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          isEmpty ? (
            <View style={{ marginTop: spacing.xxxl }}>
              <EmptyState
                icon="🩹"
                title="暂无错误日志"
                description="应用运行良好,没有记录到错误。"
              />
            </View>
          ) : null
        }
      />

      {/* 清空按钮(列表非空时显示在底部) */}
      {logs.length > 0 ? (
        <View
          style={[
            styles.footer,
            {
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderTopColor: colors.divider,
              backgroundColor: colors.surfaceElevated,
            },
          ]}
        >
          <Button variant="danger" onPress={() => setClearOpen(true)}>
            清空日志
          </Button>
        </View>
      ) : null}

      <Dialog
        visible={clearOpen}
        variant="danger"
        title="清空全部错误日志？"
        message="所有已捕获的错误记录将被永久删除,无法恢复。"
        confirmText="清空"
        cancelText="取消"
        onCancel={() => setClearOpen(false)}
        onConfirm={handleClearConfirm}
      />
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* 子组件                                                                    */
/* -------------------------------------------------------------------------- */

interface LogRowProps {
  log: ErrorLog;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
}

function LogRow({ log, expanded, onToggle, onCopy }: LogRowProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const variant: BadgeVariant = log.source === 'promise' ? 'warning' : 'danger';
  const badgeLabel = log.source === 'promise' ? 'Promise' : 'JS';
  const preview = useMemo(() => {
    const msg = log.message || '(无消息)';
    return msg.length > PREVIEW_MAX ? msg.slice(0, PREVIEW_MAX) + '…' : msg;
  }, [log.message]);

  return (
    <View
      style={{
        backgroundColor: colors.surfaceElevated,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${log.source === 'js' ? 'JS' : 'Promise'} 错误:${log.message}`}
        accessibilityHint={expanded ? '点击折叠' : '点击展开堆栈'}
        onPress={onToggle}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginBottom: spacing.xs,
          }}
        >
          <Badge label={badgeLabel} variant={variant} size="sm" />
          {log.isFatal ? <Badge label="FATAL" variant="danger" size="sm" /> : null}
          <Text
            style={[
              typography.caption,
              { color: colors.textTertiary, marginLeft: 'auto' },
            ]}
          >
            {formatRelative(log.occurredAt)}
          </Text>
        </View>
        {log.name ? (
          <Text style={[typography.label, { color: colors.textTertiary }]}>
            {log.name}
          </Text>
        ) : null}
        <Text
          style={[typography.body, { color: colors.text, marginTop: 2 }]}
          numberOfLines={expanded ? undefined : 2}
        >
          {preview}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          {log.stack ? (
            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: radius.sm,
                padding: spacing.sm,
              }}
            >
              <Text
                selectable
                style={[
                  typography.caption,
                  {
                    color: colors.textSecondary,
                    fontFamily: 'Menlo',
                  },
                ]}
              >
                {log.stack}
              </Text>
            </View>
          ) : (
            <Text style={[typography.caption, { color: colors.textTertiary }]}>
              无堆栈信息
            </Text>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" onPress={onCopy}>
              复制这条
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Separator() {
  const { spacing } = useTheme();
  return <View style={{ height: spacing.sm }} />;
}

/** Human-readable relative time. Falls back to a date string for >7 days. */
function formatRelative(ms: number): string {
  const now = Date.now();
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
