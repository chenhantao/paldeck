export type WorldSettingGroup =
  | "server"
  | "world"
  | "player"
  | "pal"
  | "combat"
  | "resource"
  | "base"
  | "advanced";

export interface WorldSettingOption {
  value: string;
  label: string;
}

export interface WorldSettingField {
  key: string;
  label: string;
  group: WorldSettingGroup;
  type: "text" | "password" | "number" | "boolean" | "select";
  defaultValue: string;
  min?: number;
  max?: number;
  step?: number;
  options?: WorldSettingOption[];
  wide?: boolean;
}

const bool = (
  key: string,
  label: string,
  group: WorldSettingGroup,
  defaultValue: boolean,
): WorldSettingField => ({ key, label, group, type: "boolean", defaultValue: String(defaultValue) });

const number = (
  key: string,
  label: string,
  group: WorldSettingGroup,
  defaultValue: number,
  options: Pick<WorldSettingField, "min" | "max" | "step"> = {},
): WorldSettingField => ({ key, label, group, type: "number", defaultValue: String(defaultValue), ...options });

export const worldSettingGroups: Array<{ id: WorldSettingGroup; label: string }> = [
  { id: "server", label: "服务器" },
  { id: "world", label: "世界与倍率" },
  { id: "player", label: "玩家" },
  { id: "pal", label: "帕鲁" },
  { id: "combat", label: "战斗规则" },
  { id: "resource", label: "资源与建筑" },
  { id: "base", label: "基地与公会" },
  { id: "advanced", label: "高级设置" },
];

export const worldSettingFields: WorldSettingField[] = [
  { key: "SERVER_NAME", label: "服务器名称", group: "server", type: "text", defaultValue: "My Palworld Server" },
  { key: "SERVER_DESCRIPTION", label: "服务器描述", group: "server", type: "text", defaultValue: "Private Palworld dedicated server", wide: true },
  { key: "SERVER_PASSWORD", label: "加入密码", group: "server", type: "password", defaultValue: "", wide: true },
  number("PLAYERS", "最大玩家数", "server", 8, { min: 1, max: 32, step: 1 }),
  { key: "REGION", label: "服务器地区", group: "server", type: "text", defaultValue: "" },
  { key: "CROSSPLAY_PLATFORMS", label: "允许连接的平台", group: "server", type: "text", defaultValue: "(Steam,Xbox,PS5,Mac)", wide: true },
  bool("SHOW_PLAYER_LIST", "显示在线玩家列表", "server", true),
  bool("ALLOW_CLIENT_MOD", "允许客户端模组", "server", true),
  bool("USEAUTH", "启用服务器认证", "server", true),
  { key: "BAN_LIST_URL", label: "封禁列表地址", group: "server", type: "text", defaultValue: "https://api.palworldgame.com/api/banlist.txt", wide: true },

  { key: "DIFFICULTY", label: "难度预设", group: "world", type: "select", defaultValue: "None", options: [
    { value: "None", label: "自定义" }, { value: "Normal", label: "普通" }, { value: "Difficult", label: "困难" },
  ] },
  { key: "RANDOMIZER_TYPE", label: "帕鲁随机化模式", group: "world", type: "select", defaultValue: "", options: [
    { value: "", label: "禁用" }, { value: "None", label: "禁用" }, { value: "Region", label: "按区域随机" }, { value: "All", label: "完全随机" },
  ] },
  { key: "RANDOMIZER_SEED", label: "随机化种子", group: "world", type: "text", defaultValue: "none" },
  number("DAYTIME_SPEEDRATE", "白天流逝速度", "world", 1, { min: 0, max: 10, step: 0.1 }),
  number("NIGHTTIME_SPEEDRATE", "夜晚流逝速度", "world", 1, { min: 0, max: 10, step: 0.1 }),
  number("EXP_RATE", "经验倍率", "world", 1, { min: 0, max: 20, step: 0.1 }),
  number("PAL_CAPTURE_RATE", "捕获概率倍率", "world", 1, { min: 0, max: 20, step: 0.1 }),
  number("PAL_SPAWN_NUM_RATE", "帕鲁生成数量倍率", "world", 1, { min: 0, max: 10, step: 0.1 }),
  number("AUTO_SAVE_SPAN", "自动保存间隔（秒）", "world", 30, { min: 1, max: 3600, step: 1 }),
  bool("USE_BACKUP_SAVE_DATA", "启用游戏原生备份", "world", true),

  number("PLAYER_DAMAGE_RATE_ATTACK", "玩家造成伤害倍率", "player", 1, { min: 0, max: 10, step: 0.1 }),
  number("PLAYER_DAMAGE_RATE_DEFENSE", "玩家受到伤害倍率", "player", 1, { min: 0, max: 10, step: 0.1 }),
  number("PLAYER_STOMACH_DECREASE_RATE", "玩家饥饿消耗倍率", "player", 1, { min: 0, max: 10, step: 0.1 }),
  number("PLAYER_STAMINA_DECREASE_RATE", "玩家耐力消耗倍率", "player", 1, { min: 0, max: 10, step: 0.1 }),
  number("PLAYER_AUTO_HP_REGEN_RATE", "玩家生命恢复倍率", "player", 1, { min: 0, max: 10, step: 0.1 }),
  number("PLAYER_AUTO_HP_REGEN_RATE_IN_SLEEP", "玩家睡眠恢复倍率", "player", 1, { min: 0, max: 10, step: 0.1 }),
  { key: "DEATH_PENALTY", label: "死亡惩罚", group: "player", type: "select", defaultValue: "Item", options: [
    { value: "None", label: "无" }, { value: "Item", label: "掉落物品" }, { value: "ItemAndEquipment", label: "掉落物品和装备" }, { value: "All", label: "全部掉落" },
  ] },
  bool("HARDCORE", "硬核模式", "player", false),
  bool("PAL_LOST", "死亡时永久失去帕鲁", "player", false),
  bool("ENABLE_NON_LOGIN_PENALTY", "启用长期未登录惩罚", "player", true),
  bool("ENABLE_FAST_TRAVEL", "允许快速旅行", "player", true),
  bool("IS_START_LOCATION_SELECT_BY_MAP", "允许在地图选择出生点", "player", true),
  bool("EXIST_PLAYER_AFTER_LOGOUT", "退出后角色留在世界", "player", false),
  number("ITEM_WEIGHT_RATE", "物品重量倍率", "player", 1, { min: 0, max: 10, step: 0.1 }),

  number("PAL_DAMAGE_RATE_ATTACK", "帕鲁造成伤害倍率", "pal", 1, { min: 0, max: 10, step: 0.1 }),
  number("PAL_DAMAGE_RATE_DEFENSE", "帕鲁受到伤害倍率", "pal", 1, { min: 0, max: 10, step: 0.1 }),
  number("PAL_STOMACH_DECREASE_RATE", "帕鲁饥饿消耗倍率", "pal", 1, { min: 0, max: 10, step: 0.1 }),
  number("PAL_STAMINA_DECREASE_RATE", "帕鲁耐力消耗倍率", "pal", 1, { min: 0, max: 10, step: 0.1 }),
  number("PAL_AUTO_HP_REGEN_RATE", "帕鲁生命恢复倍率", "pal", 1, { min: 0, max: 10, step: 0.1 }),
  number("PAL_AUTO_HP_REGEN_RATE_IN_SLEEP", "帕鲁盒内恢复倍率", "pal", 1, { min: 0, max: 10, step: 0.1 }),
  number("PAL_EGG_DEFAULT_HATCHING_TIME", "巨大蛋孵化时间（小时）", "pal", 1, { min: 0, max: 240, step: 0.5 }),
  number("WORK_SPEED_RATE", "工作速度倍率", "pal", 1, { min: 0, max: 10, step: 0.1 }),
  bool("ENABLE_PREDATOR_BOSS_PAL", "启用掠食者首领帕鲁", "pal", true),
  bool("ALLOW_GLOBAL_PALBOX_EXPORT", "允许导出至全局帕鲁终端", "pal", true),
  bool("ALLOW_GLOBAL_PALBOX_IMPORT", "允许从全局帕鲁终端导入", "pal", false),

  bool("IS_MULTIPLAY", "启用多人游戏", "combat", true),
  bool("IS_PVP", "启用 PvP", "combat", false),
  bool("ENABLE_PLAYER_TO_PLAYER_DAMAGE", "允许玩家互相造成伤害", "combat", false),
  bool("ENABLE_FRIENDLY_FIRE", "启用友军伤害", "combat", false),
  bool("ENABLE_INVADER_ENEMY", "启用敌人入侵", "combat", true),
  bool("ACTIVE_UNKO", "启用 UNKO 规则", "combat", false),
  bool("ENABLE_AIM_ASSIST_PAD", "手柄辅助瞄准", "combat", true),
  bool("ENABLE_AIM_ASSIST_KEYBOARD", "键鼠辅助瞄准", "combat", false),
  bool("CAN_PICKUP_OTHER_GUILD_DEATH_PENALTY_DROP", "允许拾取其他公会死亡掉落", "combat", false),
  number("EQUIPMENT_DURABILITY_DAMAGE_RATE", "装备耐久损耗倍率", "combat", 1, { min: 0, max: 10, step: 0.1 }),

  number("BUILD_OBJECT_HP_RATE", "建筑生命值倍率", "resource", 1, { min: 0, max: 10, step: 0.1 }),
  number("BUILD_OBJECT_DAMAGE_RATE", "建筑受到伤害倍率", "resource", 1, { min: 0, max: 10, step: 0.1 }),
  number("BUILD_OBJECT_DETERIORATION_DAMAGE_RATE", "建筑自然腐坏倍率", "resource", 1, { min: 0, max: 10, step: 0.1 }),
  number("COLLECTION_DROP_RATE", "采集掉落倍率", "resource", 1, { min: 0, max: 20, step: 0.1 }),
  number("COLLECTION_OBJECT_HP_RATE", "采集物生命值倍率", "resource", 1, { min: 0, max: 10, step: 0.1 }),
  number("COLLECTION_OBJECT_RESPAWN_SPEED_RATE", "采集物重生间隔倍率", "resource", 1, { min: 0, max: 10, step: 0.1 }),
  number("ENEMY_DROP_ITEM_RATE", "敌人掉落倍率", "resource", 1, { min: 0, max: 20, step: 0.1 }),
  number("DROP_ITEM_MAX_NUM", "地图掉落物上限", "resource", 3000, { min: 0, max: 100000, step: 1 }),
  number("DROP_ITEM_MAX_NUM_UNKO", "未加载区域掉落物上限", "resource", 100, { min: 0, max: 100000, step: 1 }),
  number("DROP_ITEM_ALIVE_MAX_HOURS", "掉落物保留时间（小时）", "resource", 1, { min: 0, max: 720, step: 0.5 }),
  bool("BUILD_AREA_LIMIT", "限制特殊地点附近建造", "resource", false),
  number("MAX_BUILDING_LIMIT_NUM", "单个玩家建筑上限（0 为无限）", "resource", 0, { min: 0, max: 1000000, step: 1 }),

  number("BASE_CAMP_MAX_NUM", "服务器基地总数上限", "base", 128, { min: 1, max: 10000, step: 1 }),
  number("BASE_CAMP_WORKER_MAX_NUM", "每个基地工作帕鲁上限", "base", 15, { min: 1, max: 50, step: 1 }),
  number("BASE_CAMP_MAX_NUM_IN_GUILD", "每个公会基地上限", "base", 4, { min: 1, max: 10, step: 1 }),
  number("GUILD_PLAYER_MAX_NUM", "公会成员上限", "base", 20, { min: 1, max: 1000, step: 1 }),
  number("COOP_PLAYER_MAX_NUM", "合作小队人数上限", "base", 4, { min: 1, max: 32, step: 1 }),
  bool("AUTO_RESET_GUILD_NO_ONLINE_PLAYERS", "自动清理长期无人公会", "base", false),
  number("AUTO_RESET_GUILD_TIME_NO_ONLINE_PLAYERS", "无人公会清理等待时间（小时）", "base", 72, { min: 0, max: 10000, step: 1 }),
  bool("ENABLE_DEFENSE_OTHER_GUILD_PLAYER", "允许防御其他公会玩家", "base", false),
  bool("INVISIBLE_OTHER_GUILD_BASE_CAMP_AREA_FX", "隐藏其他公会基地范围", "base", false),

  number("SERVER_REPLICATE_PAWN_CULL_DISTANCE", "帕鲁同步距离（厘米）", "advanced", 15000, { min: 5000, max: 15000, step: 100 }),
  number("SERVER_REPLICATE_PAWN_CULL_DISTANCE_IN_BASE_CAMP", "基地内帕鲁同步距离（厘米）", "advanced", 5000, { min: 0, max: 15000, step: 100 }),
  number("ITEM_CONTAINER_FORCE_MARK_DIRTY_INTERVAL", "容器强制同步间隔（秒）", "advanced", 1, { min: 0, max: 3600, step: 0.1 }),
];

export function defaultWorldSettingValues(): Record<string, string> {
  return Object.fromEntries(worldSettingFields.map((field) => [field.key, field.defaultValue]));
}
