/**
 * ProfileEditSheet — 「头像 + 用户名」编辑抽屉（「我的」页与「设置」页共用）。
 *
 * 抽这个组件的原因：改头像之前，这个抽屉在两处各写了一遍，几乎逐字相同
 * （`ProfileScreen.tsx:281-314`、`SettingsScreen.tsx:467-500`，唯一差别是保存
 * 按钮的 `paddingVertical`）。加了头像入口之后如果还各写一份，就变成两处
 * 都要改、两处都可能漏 —— 直接抽成一个。
 *
 * **完全自包含**：props 只有 `visible` / `onClose`，用户名从 settingsStore 读、
 * 头像从 avatarStore 读，草稿态、toast 都在内部。这样两个屏各自只需要一行
 * 调用。副作用是它不能放 `@/components`（那是纯 design system 的 barrel，
 * 不放连 store 的组件），所以落在 `features/profile/`。
 *
 * 交互约定：头像动作**立即生效**（选完预览就变），不需要点保存；
 * 「保存」只负责用户名并关闭抽屉。
 */

import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, Input, MenuRow, Sheet } from '@/components';
import { toast } from '@/hooks/useToast';
import { useAvatarStore } from '@/store/avatarStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

export interface ProfileEditSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function ProfileEditSheet({ visible, onClose }: ProfileEditSheetProps) {
  const { colors, typography, spacing } = useTheme();

  const username = useSettingsStore((s) => s.username);
  const avatarUri = useAvatarStore((s) => s.uri);

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  /**
   * 每次打开都重新播种草稿。
   *
   * **这是整个抽取里最容易踩的回归**：原来的两份代码在打开时都显式
   * `setUsernameDraft(username)`，换成组件内部的 `useState` 之后如果不重新播种，
   * 用户「改了 → 取消 → 再打开」会看到上次那份没保存的陈旧草稿。
   * 依赖数组带上 username，这样别的入口改了名字再打开也是新的。
   */
  useEffect(() => {
    if (visible) setDraft(username);
  }, [visible, username]);

  const handleSave = async () => {
    await useSettingsStore.getState().setUsername(draft.trim());
    onClose();
    // G12: 轻量反馈 —— 保持原有行为（空名不 toast）
    if (draft.trim()) {
      toast.show('用户名已保存', 'success');
    }
  };

  const handlePick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await useAvatarStore.getState().pickFromLibrary();
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await useAvatarStore.getState().clear();
      toast.show('已恢复默认头像', 'success');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="编辑资料">
      <View style={{ gap: spacing.lg }}>
        {/* 头像：预览 + 动作 */}
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Avatar uri={avatarUri} text={username} size={72} />
          <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
            <MenuRow
              label="从相册选择"
              hint={busy ? '已打开相册…' : '选一张方形照片作为头像'}
              onPress={handlePick}
            />
            {avatarUri ? (
              <MenuRow
                label="恢复默认头像"
                hint="改回用户名首字母"
                danger
                onPress={handleRemoveAvatar}
              />
            ) : null}
          </View>
        </View>

        {/* 用户名 */}
        <View style={{ gap: spacing.md }}>
          {/*
            刻意**不**加 `autoFocus`（2026-09-30 真机验收发现）：
            这个抽屉在只有用户名输入框的年代是 autoFocus 的，抽成「头像 + 用户名」之后
            它变成了「一进来就弹键盘」，而键盘恰好盖住头像预览和「从相册选择」——
            也就是点头像改头像这个入口的**主操作**。而且 `Sheet` 是 RN `Modal`，
            真机上返回键会**整个关掉抽屉**（不是只收键盘），用户没有「只收键盘」的出口。
            用户名只是次要操作，点一下输入框再弹键盘完全可接受。
          */}
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder="请输入用户名"
            maxLength={20}
            accessibilityLabel="用户名输入"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="保存用户名"
            accessibilityHint="保存并关闭抽屉"
            onPress={handleSave}
            hitSlop={8}
            style={({ pressed }) => ({
              alignSelf: 'flex-end',
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[typography.label, { color: colors.primary }]}>保存</Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}
