#!/usr/bin/env python3
"""
Build the system-architecture.drawio for 锻炼2点零.

FIX (2026-09-04): previous version called html.escape() on a string that
already contained draw.io HTML wrappers (<b>, <br/>, <font style="...">),
which converted them to &lt;b&gt; etc. — draw.io couldn't parse them as
markup. Now `esc()` only escapes & and " so the wrappers survive intact.
"""

import html, os, re

# Canvas ---------------------------------------------------------------
PAGE_W = 2200
PAGE_H = 3000

# Layout ---------------------------------------------------------------
LEFT_PAD   = 60
RIGHT_PAD  = 60
LANE_W     = 200
CONTENT_X  = LEFT_PAD + LANE_W + 30
CONTENT_W  = PAGE_W - CONTENT_X - RIGHT_PAD
ROW_GAP    = 22
NODE_GAP   = 18
NODE_H     = 78
SMALL_NODE_H = 60
LANE_PAD   = 14
SHADOW     = "1"

LAYER_COLORS = {
    "L1":  ("#F3E5F5", "#7B1FA2", "#4A148C"),
    "L2":  ("#EDE7F6", "#5E35B1", "#311B92"),
    "L3":  ("#E3F2FD", "#1976D2", "#0D47A1"),
    "L4":  ("#E0F7FA", "#00838F", "#006064"),
    "L5":  ("#FCE4EC", "#C2185B", "#880E4F"),
    "L6":  ("#FFF3E0", "#EF6C00", "#E65100"),
    "L7":  ("#FBE9E7", "#D84315", "#BF360C"),
    "L8":  ("#E8F5E9", "#388E3C", "#1B5E20"),
    "L9":  ("#DCEDC8", "#558B2F", "#33691E"),
    "L10": ("#C8E6C9", "#2E7D32", "#1B5E20"),
    "L11": ("#ECEFF1", "#455A64", "#263238"),
}

LAYER_TITLES = {
    "L1":  "L1  ·  应用入口",
    "L2":  "L2  ·  Provider 嵌套树",
    "L3":  "L3  ·  导航层 (React Navigation 7)",
    "L4":  "L4  ·  屏幕层 (Screens)",
    "L5":  "L5  ·  UI 基础 (Components / Theme)",
    "L6":  "L6  ·  业务特性 (Features / Hooks)",
    "L7":  "L7  ·  状态管理 (Zustand Stores)",
    "L8":  "L8  ·  数据访问 (Repository Layer)",
    "L9":  "L9  ·  持久化 (DB / Schema / Migrations)",
    "L10": "L10  ·  SQLite 存储 (expo-sqlite)",
    "L11": "L11  ·  平台 / 原生能力 (Native Bridge)",
}

LAYERS = [
    ("L1", [
        ("index.ts", "Expo · registerRootComponent()", "node"),
    ]),
    ("L2", [
        ("GestureHandlerRootView", "react-native-gesture-handler", "node"),
        ("SafeAreaProvider", "react-native-safe-area-context", "node"),
        ("SQLiteProvider", "expo-sqlite · onInit → initDatabase", "node"),
        ("ThemeProvider", "Design tokens (light / dark)", "node"),
        ("ErrorBoundary", "G12 · 渲染错误捕获", "node"),
        ("DatabaseBootstrap", "初始化闸门 (splash)", "node"),
        ("ToastHost", "全局非模态反馈", "node"),
        ("RootNavigator", "@/navigation/RootNavigator", "node"),
    ]),
    ("L3", [
        ("RootNavigator (NativeStack)", "根栈：所有页面", "swimlane"),
        ("Tabs (BottomTab)", "Home · Training · Profile", "swimlane"),
        ("ActiveTraining", "沉浸式 (隐藏 Tab)", "swimlane"),
        ("TrainingComplete", "沉浸式 (隐藏 Tab)", "swimlane"),
        ("ExerciseLibrary", "动作库 · 多选 picker", "swimlane"),
        ("PlanEditor", "新建 / 编辑计划", "swimlane"),
        ("TrainingDetail", "历史只读", "swimlane"),
        ("Settings / Diagnostics / Showcase", "G10 · G13 · G20", "swimlane"),
        ("Data Sub-pages", "G18 · Calendar / Volume / Donut / 1RM", "swimlane"),
    ]),
    ("L4", [
        ("HomeScreen", "首页 · 近期训练 feed", "node"),
        ("TrainingScreen", "锻炼 · 计划列表", "node"),
        ("ProfileScreen", "我的 · 面板入口", "node"),
        ("ActiveTrainingScreen", "训练中 · 全屏", "node"),
        ("TrainingCompleteScreen", "Lottie + 总结", "node"),
        ("ExerciseLibraryScreen", "搜索 + 肌群筛选", "node"),
        ("PlanEditorScreen", "动作列表编辑", "node"),
        ("TrainingDetailScreen", "只读详情", "node"),
        ("SettingsScreen", "单位 / 主题 / 休息 / 震动", "node"),
        ("DiagnosticsScreen", "JS / Promise 错误", "node"),
        ("Showcase", "组件自检 (__DEV__)", "node"),
        ("DataOverview / 子页", "Calendar / Volume / Donut / 1RM", "node"),
    ]),
    ("L5", [
        ("components/", "Button · Card · Dialog · Sheet · Toast · TimerRing · Input · NumberInput · CheckableRow · EmptyState · Badge · Placeholder", "swimlane"),
        ("theme/", "ThemeProvider · colors · spacing · typography · radius · shadows", "swimlane"),
        ("constants/", "muscleGroups · equipment · setTypes · metricTypes", "swimlane"),
        ("utils/", "dateGroups · units · exportData · haptics", "swimlane"),
    ]),
    ("L6", [
        ("features/training/", "useRestTimer · RestTimerOverlay · restTimerStore / Trigger · freeTraining", "swimlane"),
        ("features/data/", "useDataAggregates · aggregations.ts", "swimlane"),
        ("features/data/charts/", "BarChart · DonutChart · HeatmapCalendar", "swimlane"),
        ("hooks/", "useElapsedSeconds · useToast", "swimlane"),
    ]),
    ("L7", [
        ("trainingStore", "activeTraining (内存) · history · currentIdx · lastSetsByExerciseId · completeTraining tx-batch", "node"),
        ("planStore", "plans · 详情缓存", "node"),
        ("exerciseStore", "动作库缓存", "node"),
        ("settingsStore", "kg/lb · theme · default rest · haptics", "node"),
    ]),
    ("L8", [
        ("trainingRepo", "CRUD · list / get · 统计行 update", "node"),
        ("trainingSetRepo", "batchInsert tx · lastSets 查询 (G17)", "node"),
        ("planRepo", "CRUD · 详情 join", "node"),
        ("exerciseRepo", "CRUD · 搜索 / 筛选", "node"),
        ("settingsRepo", "kv 读写", "node"),
        ("errorLogRepo", "G12 · 自动写日志", "node"),
    ]),
    ("L9", [
        ("db/index.ts", "singleton · getDatabase · wipeAllData", "node"),
        ("schema.ts", "7 表 + row→domain · Ex/Plan/Train/...", "node"),
        ("migrations.ts", "增量 DDL", "node"),
        ("seeds/", "内置动作库 seed", "node"),
    ]),
    ("L10", [
        ("exercises", "动作库 (含内置种子)", "node"),
        ("plans", "训练计划", "node"),
        ("plan_exercises", "计划-动作关联", "node"),
        ("trainings", "训练会话 (快照)", "node"),
        ("training_sets", "每组数据 (核心)", "node"),
        ("settings", "kv 用户偏好", "node"),
        ("error_logs", "G12 错误捕获", "node"),
    ]),
    ("L11", [
        ("expo-haptics", "震动反馈", "node"),
        ("expo-keep-awake", "训练中不息屏", "node"),
        ("expo-file-system", "图片 / 导出文件", "node"),
        ("expo-sharing", "分享数据", "node"),
        ("expo-clipboard", "剪贴板", "node"),
        ("expo-status-bar", "状态栏主题", "node"),
        ("react-native-gesture-handler", "滑动 / 手势", "node"),
        ("react-native-reanimated + worklets", "UI 线程动画", "node"),
        ("react-native-svg", "图表 / 图标", "node"),
        ("lottie-react-native", "完成动画", "node"),
    ]),
]


def estimate_node_width(label, subtitle):
    chars = max(len(label), len(subtitle))
    return max(150, min(310, chars * 11 + 28))


def layout_layer(layer_id, items, y_top):
    stroke = LAYER_COLORS[layer_id][1]
    widths = [estimate_node_width(lbl, sub) for lbl, sub, _ in items]
    total = sum(widths) + NODE_GAP * (len(items) - 1)
    if total > CONTENT_W:
        scale = (CONTENT_W - NODE_GAP * (len(items) - 1)) / sum(widths)
        widths = [max(130, int(w * scale)) for w in widths]
        total = sum(widths) + NODE_GAP * (len(items) - 1)
    start_x = CONTENT_X + (CONTENT_W - total) // 2

    placed = []
    cursor = start_x
    for (label, subtitle, kind), w in zip(items, widths):
        h = SMALL_NODE_H if kind == "swimlane" else NODE_H
        placed.append({
            "label": label,
            "subtitle": subtitle,
            "kind": kind,
            "x": cursor,
            "y": y_top,
            "w": w,
            "h": h,
            "stroke": stroke,
        })
        cursor += w + NODE_GAP
    return placed


# IMPORTANT: only escape & and " — NOT < and >. draw.io HTML wrappers
# (<b>, <br/>, <font style="...">) must remain as literal tags so the
# diagram parses correctly.
def esc(s):
    if s is None:
        return ""
    # Escape & " < > for XML attribute values. draw.io will
    # decode these entities when rendering, so <b>/<br/>/<font>
    # markup still appears as bold/linebreak/font in the diagram.
    return (s
        .replace("&", "&amp;")
        .replace(chr(60), "&lt;")
        .replace(chr(62), "&gt;")
        .replace(chr(34), "&quot;"))


def vertex_xml(cid, label, x, y, w, h, style):
    return (
        f'<mxCell id="{esc(cid)}" value="{label}" '
        f'style="{style}" vertex="1" parent="1">'
        f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry" />'
        f'</mxCell>'
    )


def edge_xml(cid, src, tgt, style, label=""):
    return (
        f'<mxCell id="{esc(cid)}" value="{esc(label)}" '
        f'style="{esc(style)}" edge="1" parent="1" source="{esc(src)}" '
        f'target="{esc(tgt)}">'
        f'<mxGeometry relative="1" as="geometry"><Array as="points" /></mxGeometry>'
        f'</mxCell>'
    )


STYLE_TITLE = (
    "text;html=1;align=center;verticalAlign=middle;"
    "fontSize=24;fontStyle=1;fontColor=#1A237E;"
    "fillColor=none;strokeColor=none;"
)
STYLE_SUBTITLE = (
    "text;html=1;align=center;verticalAlign=middle;"
    "fontSize=12;fontColor=#546E7A;italic=1;"
    "fillColor=none;strokeColor=none;"
)


def node_style(stroke, kind):
    fill = "#FFFFFF"
    text_color = "#212121"
    font_size = 12
    if kind == "swimlane":
        fill = "#FAFAFA"
        font_size = 11
    return (
        f"rounded=1;whiteSpace=wrap;html=1;"
        f"fillColor={fill};strokeColor={stroke};strokeWidth=1.5;"
        f"fontSize={font_size};"
        f"fontColor={text_color};align=center;verticalAlign=middle;"
        f"shadow={SHADOW};"
    )


def lane_label_style(layer_id):
    stroke = LAYER_COLORS[layer_id][1]
    return (
        f"rounded=1;whiteSpace=wrap;html=1;"
        f"fillColor={stroke};strokeColor={stroke};strokeWidth=1;"
        f"fontColor=#FFFFFF;align=center;verticalAlign=middle;"
        f"fontSize=13;fontStyle=1;shadow={SHADOW};"
    )


def lane_bg_style(layer_id):
    bg, stroke, _ = LAYER_COLORS[layer_id]
    return (
        f"rounded=1;whiteSpace=wrap;html=1;fillColor={bg};strokeColor={stroke};"
        f"strokeWidth=1;dashed=0;opacity=40;fontColor=none;"
    )


def plain_edge_style():
    return (
        "endArrow=classic;html=1;rounded=1;"
        "strokeColor=#90A4AE;strokeWidth=1.2;"
        "fontSize=10;fontColor=#546E7A;labelBackgroundColor=#FFFFFF;"
    )


def colored_arrow_style(color, width=2.5):
    return (
        f"endArrow=classic;startArrow=classic;html=1;rounded=1;"
        f"strokeColor={color};strokeWidth={width};"
        f"fontSize=11;fontColor={color};fontStyle=1;"
        f"labelBackgroundColor=#FFFFFF;edgeStyle=orthogonalEdgeStyle;"
    )


# Build ---------------------------------------------------------------
cells = []
id_counter = [10]

def next_id(prefix):
    id_counter[0] += 1
    return f"{prefix}_{id_counter[0]}"


title_y = 30
cells.append(vertex_xml(
    "title_main", esc("锻炼 2.0 · 系统架构图 (System Architecture)"),
    LEFT_PAD, title_y, PAGE_W - LEFT_PAD - RIGHT_PAD, 50, STYLE_TITLE
))
cells.append(vertex_xml(
    "title_sub", esc("Expo SDK 57 · React 19.2 · RN 0.86 · React Navigation 7 · Zustand 5 · expo-sqlite 57"),
    LEFT_PAD, title_y + 52, PAGE_W - LEFT_PAD - RIGHT_PAD, 26, STYLE_SUBTITLE
))

y = title_y + 110
for layer_id, items in LAYERS:
    placed = layout_layer(layer_id, items, y)
    lane_h = max(p["h"] for p in placed) + LANE_PAD * 2

    lane_x = CONTENT_X - 16
    lane_w = CONTENT_W + 32
    cells.append(vertex_xml(
        next_id("lane_bg"), "",
        lane_x, y - 8, lane_w, lane_h + 16,
        lane_bg_style(layer_id)
    ))

    label_x = LEFT_PAD
    label_w = LANE_W
    cells.append(vertex_xml(
        next_id("lane_label"), esc(LAYER_TITLES[layer_id]),
        label_x, y - 8, label_w, lane_h + 16,
        lane_label_style(layer_id)
    ))

    for n in placed:
        # Build the rich-text label. The whole string (including the
        # <b>/<br/>/<font> wrappers) gets run through esc() once —
        # XML attribute values must escape <, >, &, and ". draw.io's
        # renderer decodes the entities back, so bold/linebreak/font
        # markup renders normally.
        if n["subtitle"]:
            rich = (
                f'<b>{n["label"]}</b>'
                f'<br/><font style="font-size:10px;color:#546E7A">'
                f'{n["subtitle"]}</font>'
            )
        else:
            rich = f'<b>{n["label"]}</b>'
        full_label = esc(rich)
        cells.append(vertex_xml(
            next_id("n"), full_label, n["x"], n["y"], n["w"], n["h"],
            node_style(n["stroke"], n["kind"])
        ))

    y += lane_h + ROW_GAP


def find_id(substr):
    matches = []
    for c in cells:
        m = re.search(r'<mxCell id="([^"]+)"\s+value="([^"]*)"', c)
        if m and substr in m.group(2):
            matches.append(m.group(1))
    return matches[-1] if matches else ""


flows = [
    ("start_training", "TrainingScreen", "trainingStore", "#C62828", "startTraining()"),
    ("complete_tx", "trainingStore", "trainingRepo", "#C62828", "completeTraining() tx"),
    ("tx_sqlite", "trainingRepo", "training_sets", "#C62828", "batch insert"),
    ("history_reload", "trainingSetRepo", "HomeScreen", "#C62828", "loadHistory()"),

    ("boot_1", "index.ts", "SQLiteProvider", "#1565C0", "registerRoot"),
    ("boot_2", "SQLiteProvider", "SQLiteProvider", "#1565C0", "onInit → initDatabase"),
    ("boot_3", "SQLiteProvider", "schema.ts", "#1565C0", "migrate"),
    ("boot_4", "SQLiteProvider", "seeds/", "#1565C0", "seedExercises"),
    ("boot_5", "DatabaseBootstrap", "RootNavigator (NativeStack)", "#1565C0", "ready"),

    ("settings_theme", "settingsStore", "ThemeProvider", "#6A1B9A", "themeMode"),

    ("err_1", "ErrorBoundary", "errorLogRepo", "#EF6C00", "捕获"),
    ("err_2", "errorLogRepo", "DiagnosticsScreen", "#EF6C00", "G12 日志"),
]

for fid, src_lbl, tgt_lbl, color, label in flows:
    src = find_id(src_lbl)
    tgt = find_id(tgt_lbl)
    if not src or not tgt:
        print(f"WARN: flow {fid} unresolved: {src_lbl} -> {tgt_lbl}  (src={src} tgt={tgt})")
        continue
    cells.append(edge_xml(fid, src, tgt, colored_arrow_style(color), label))


# Light "imports" edges (subtle gray)
import_edges = [
    ("features/training/", "trainingStore"),
    ("trainingStore", "trainingRepo"),
    ("trainingStore", "trainingSetRepo"),
    ("planStore", "planRepo"),
    ("exerciseStore", "exerciseRepo"),
    ("settingsStore", "settingsRepo"),
    ("trainingRepo", "db/index.ts"),
    ("planRepo", "db/index.ts"),
    ("exerciseRepo", "db/index.ts"),
    ("db/index.ts", "schema.ts"),
    ("db/index.ts", "migrations.ts"),
    ("features/training/", "expo-haptics"),
    ("ActiveTrainingScreen", "expo-keep-awake"),
    ("TrainingCompleteScreen", "lottie-react-native"),
    ("features/data/charts/", "react-native-svg"),
    ("index.ts", "GestureHandlerRootView"),
    ("RootNavigator (NativeStack)", "Tabs (BottomTab)"),
    ("ActiveTraining", "ActiveTrainingScreen"),
    ("TrainingComplete", "TrainingCompleteScreen"),
    ("ErrorBoundary", "ToastHost"),
]
for src_lbl, tgt_lbl in import_edges:
    src = find_id(src_lbl)
    tgt = find_id(tgt_lbl)
    if not src or not tgt:
        print(f"WARN: import unresolved: {src_lbl} -> {tgt_lbl}")
        continue
    cells.append(edge_xml(
        next_id("imp"), src, tgt, plain_edge_style()
    ))


# Legend ---------------------------------------------------------------
legend_y = y + 10
legend_h = 240
cells.append(vertex_xml(
    "legend_box", "",
    LEFT_PAD, legend_y, PAGE_W - LEFT_PAD - RIGHT_PAD, legend_h,
    "rounded=1;whiteSpace=wrap;html=1;fillColor=#FAFAFA;strokeColor=#B0BEC5;"
    "strokeWidth=1;fontColor=#37474F;"
))
cells.append(vertex_xml(
    "legend_title", esc("图例 · Legend"),
    LEFT_PAD + 20, legend_y + 12, 300, 26,
    "text;html=1;align=left;verticalAlign=middle;fontSize=14;"
    "fontStyle=1;fontColor=#263238;"
))

swatch_y = legend_y + 50
row_x = LEFT_PAD + 20
for layer_id in ("L3","L5","L7","L8","L9","L11"):
    bg, stroke, label_color = LAYER_COLORS[layer_id]
    cells.append(vertex_xml(
        f"sw_{layer_id}", esc(LAYER_TITLES[layer_id].split("  ·  ")[1].strip()),
        row_x, swatch_y, 280, 22,
        f"rounded=1;whiteSpace=wrap;html=1;fillColor={bg};strokeColor={stroke};"
        f"strokeWidth=1;fontSize=11;fontColor={label_color};"
        f"align=left;verticalAlign=middle;spacingLeft=24;"
    ))
    cells.append(vertex_xml(
        f"sw_box_{layer_id}", "",
        row_x + 4, swatch_y + 4, 14, 14,
        f"rounded=1;fillColor={stroke};strokeColor={stroke};"
    ))
    swatch_y += 26

arrow_y = legend_y + 50
cells.append(vertex_xml(
    "arrow_red", "",
    LEFT_PAD + 360, arrow_y, 24, 14,
    "endArrow=classic;startArrow=classic;html=1;strokeColor=#C62828;strokeWidth=2.5;"
))
cells.append(vertex_xml(
    "arrow_red_lbl", esc("训练核心闭环 (StartTraining → tx → loadHistory)"),
    LEFT_PAD + 390, arrow_y - 4, 520, 22,
    "text;html=1;align=left;verticalAlign=middle;fontSize=11;fontColor=#C62828;"
    "fillColor=none;strokeColor=none;"
))
cells.append(vertex_xml(
    "arrow_blue", "",
    LEFT_PAD + 360, arrow_y + 30, 24, 14,
    "endArrow=classic;startArrow=classic;html=1;strokeColor=#1565C0;strokeWidth=2.5;"
))
cells.append(vertex_xml(
    "arrow_blue_lbl", esc("启动序列 (index → SQLiteProvider → DB init → Nav)"),
    LEFT_PAD + 390, arrow_y + 26, 520, 22,
    "text;html=1;align=left;verticalAlign=middle;fontSize=11;fontColor=#1565C0;"
    "fillColor=none;strokeColor=none;"
))
cells.append(vertex_xml(
    "arrow_orange", "",
    LEFT_PAD + 360, arrow_y + 60, 24, 14,
    "endArrow=classic;startArrow=classic;html=1;strokeColor=#EF6C00;strokeWidth=2.5;"
))
cells.append(vertex_xml(
    "arrow_orange_lbl", esc("错误流 (ErrorBoundary → error_logs → Diagnostics)"),
    LEFT_PAD + 390, arrow_y + 56, 520, 22,
    "text;html=1;align=left;verticalAlign=middle;fontSize=11;fontColor=#EF6C00;"
    "fillColor=none;strokeColor=none;"
))
cells.append(vertex_xml(
    "arrow_purple", "",
    LEFT_PAD + 360, arrow_y + 90, 24, 14,
    "endArrow=classic;startArrow=classic;html=1;strokeColor=#6A1B9A;strokeWidth=2.5;"
))
cells.append(vertex_xml(
    "arrow_purple_lbl", esc("主题同步 (settingsStore.themeMode → ThemeProvider)"),
    LEFT_PAD + 390, arrow_y + 86, 520, 22,
    "text;html=1;align=left;verticalAlign=middle;fontSize=11;fontColor=#6A1B9A;"
    "fillColor=none;strokeColor=none;"
))
cells.append(vertex_xml(
    "arrow_gray", "",
    LEFT_PAD + 360, arrow_y + 120, 24, 14,
    "endArrow=classic;html=1;strokeColor=#90A4AE;strokeWidth=1.2;"
))
cells.append(vertex_xml(
    "arrow_gray_lbl", esc("普通依赖 / 调用 (imports · composition)"),
    LEFT_PAD + 390, arrow_y + 116, 520, 22,
    "text;html=1;align=left;verticalAlign=middle;fontSize=11;fontColor=#546E7A;"
    "fillColor=none;strokeColor=none;"
))

notes_x = LEFT_PAD + 920
cells.append(vertex_xml(
    "notes_title", esc("关键设计要点 · Key Design Notes"),
    notes_x, legend_y + 50, 540, 26,
    "text;html=1;align=left;verticalAlign=middle;fontSize=13;fontStyle=1;"
    "fontColor=#263238;fillColor=none;strokeColor=none;"
))
notes = [
    "1. 训练中只在内存操作 set 数组，<b>完成时一次性 batch insert</b> (PRD 风险评估)",
    "2. completeTraining 用 <b>withTransactionAsync</b> 保证 training 行 + set 行原子写入",
    "3. <b>plan_name_snapshot / exercise_name_snapshot</b> 删除 / 重命名不影响历史展示",
    "4. <b>lastSetsByExerciseId</b> (G17) 缓存最近 3 组，训练页一次性预查",
    "5. <b>ActiveTraining / TrainingComplete</b> 是 RootStack 同级，Tab 栏隐藏 (IMMERSIVE_ROUTES)",
    "6. <b>ErrorBoundary + Toast + error_logs</b> 三件套保证 G12 永不白屏",
    "7. SQLite 启用 <b>PRAGMA foreign_keys = ON</b>，cascade 删除依赖此配置",
    "8. SQLiteProvider.onInit 桥接到 <b>setDatabaseInstance</b> 单例，所有 repository 共享同一连接",
]
ny = legend_y + 80
for note in notes:
    cells.append(vertex_xml(
        f"note_{ny}", esc(note),
        notes_x, ny, 540, 18,
        "text;html=1;align=left;verticalAlign=middle;fontSize=11;fontColor=#37474F;"
        "fillColor=none;strokeColor=none;"
    ))
    ny += 18


xml_body = "\n  ".join(cells)
output = (
    '<mxfile host="app.diagrams.net" modified="2026-09-04T17:00:00.000Z" agent="Codex" version="24.7.5" type="device">\n'
    '  <diagram name="System Architecture" id="workout2-arch-1">\n'
    f'    <mxGraphModel dx="2200" dy="3000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{PAGE_W}" pageHeight="{PAGE_H}" math="0" shadow="0">\n'
    '      <root>\n'
    '        <mxCell id="0" />\n'
    '        <mxCell id="1" parent="0" />\n'
    f'        {xml_body}\n'
    '      </root>\n'
    '    </mxGraphModel>\n'
    '  </diagram>\n'
    '</mxfile>\n'
)

OUT_PATH = r"E:\\私人DIV\\idea项目\\锻炼2点零\\docs\\architecture\\system-architecture.drawio"
with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write(output)

print(f"Wrote {OUT_PATH}")
print(f"Cells: {len(cells)}")
print(f"Size : {os.path.getsize(OUT_PATH):,} bytes")