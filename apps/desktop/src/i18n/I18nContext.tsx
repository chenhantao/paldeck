import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./en";

export type LanguagePreference = "system" | "zh-CN" | "en";
export type AppLocale = "zh-CN" | "en";

const STORAGE_KEY = "paldeck.language.v1";

interface I18nValue {
  preference: LanguagePreference;
  locale: AppLocale;
  setPreference: (preference: LanguagePreference) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  errorMessage: (cause: unknown) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function systemLocale(): AppLocale {
  return navigator.languages.some((language) =>
    language.toLowerCase().startsWith("zh"),
  )
    ? "zh-CN"
    : "en";
}

function loadPreference(): LanguagePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "zh-CN" || stored === "en" || stored === "system"
      ? stored
      : "system";
  } catch {
    return "system";
  }
}

function translate(
  locale: AppLocale,
  key: string,
  values?: Record<string, string | number>,
): string {
  let result = locale === "en" ? (en[key] ?? key) : key;
  for (const [name, value] of Object.entries(values ?? {})) {
    result = result.replaceAll(`{${name}}`, String(value));
  }
  return result;
}

const backendEnglishReplacements: Array<[string, string]> = [
  ["服务器主机密钥与已信任记录不一致", "The server host key differs from the trusted key"],
  ["目录不是由 Paldeck 创建或管理标记无效", "The directory is not managed by Paldeck or its marker is invalid"],
  ["compose.yaml 与 Paldeck 初始化记录不一致，已拒绝执行", "compose.yaml differs from the recorded Paldeck deployment; operation refused"],
  ["PALWORLD_DATA_DIR 必须是部署目录内的安全相对子目录，且不能经过符号链接", "PALWORLD_DATA_DIR must be a safe relative subdirectory without symbolic links"],
  ["游戏数据目录必须是以 ./ 开头的非空相对子目录", "The game-data directory must be a non-empty relative subdirectory starting with ./"],
  ["游戏数据目录只能包含字母、数字、点、横线、下划线和斜杠", "The game-data directory may contain only letters, numbers, dots, hyphens, underscores, and slashes"],
  ["游戏数据目录不能包含空段、. 或 ..", "The game-data directory cannot contain empty segments, . or .."],
  ["远程目录必须是 ~/ 下的目录或非根绝对路径", "The remote directory must be inside ~/ or be a non-root absolute path"],
  ["远程目录必须使用规范的 Linux 路径", "The remote directory must use a canonical Linux path"],
  ["远程目录不能包含空段、. 或 ..", "The remote directory cannot contain empty segments, . or .."],
  ["远程目录包含无效字符", "The remote directory contains invalid characters"],
  ["SSH Host 只能包含字母、数字、点、横线和下划线", "The SSH host may contain only letters, numbers, dots, hyphens, and underscores"],
  ["SSH Host 必须以字母或数字开头", "The SSH host must start with a letter or number"],
  ["SSH Host 不能为空", "The SSH host cannot be empty"],
  ["SSH Host 长度无效", "The SSH host length is invalid"],
  ["SSH 端口必须在 1 到 65535 之间", "The SSH port must be between 1 and 65535"],
  ["服务器地址没有可用的网络端点", "The server address has no usable network endpoint"],
  ["服务器地址无效", "The server address is invalid"],
  ["服务器名称长度无效", "The server name length is invalid"],
  ["服务器密码不能超过 128 个字符", "The server password cannot exceed 128 characters"],
  ["管理员密码必须为 8 到 128 个字符", "The admin password must be between 8 and 128 characters"],
  ["玩家数量必须在 1 到 32 之间", "The player limit must be between 1 and 32"],
  ["初始化配置不能包含换行或空字符", "Setup values cannot contain line breaks or null characters"],
  [".env 文件包含无效的空字符", "The .env file contains an invalid null character"],
  [".env 文件超过 128 KiB 限制", "The .env file exceeds the 128 KiB limit"],
  ["环境模板缺少变量", "The environment template is missing variable"],
  ["请确认服务器主机密钥指纹", "Confirm the server host-key fingerprint"],
  ["请先确认服务器主机密钥指纹", "Confirm the server host-key fingerprint first"],
  ["服务器没有提供 SSH 主机密钥", "The server did not provide an SSH host key"],
  ["账号或密码验证失败", "Username or password authentication failed"],
  ["账号密码验证成功", "Username and password authentication succeeded"],
  ["登录方式不是 OpenSSH", "The authentication method is not OpenSSH"],
  ["登录方式不是账号密码", "The authentication method is not username and password"],
  ["SSH 用户名无效", "The SSH username is invalid"],
  ["请输入 SSH 私钥口令", "Enter the SSH private-key passphrase"],
  ["SSH 私钥口令无效", "The SSH private-key passphrase is invalid"],
  ["SSH 密码无效", "The SSH password is invalid"],
  ["SSH 后台任务失败", "The SSH background task failed"],
  ["SSH 命令通道关闭失败", "Failed to close the SSH command channel"],
  ["SSH 握手失败", "SSH handshake failed"],
  ["无法创建 SSH 命令通道", "Unable to create an SSH command channel"],
  ["无法创建 SSH 会话", "Unable to create an SSH session"],
  ["无法启动系统 SSH", "Unable to start system SSH"],
  ["无法执行远程命令", "Unable to run the remote command"],
  ["无法读取 SSH 错误输出", "Unable to read SSH error output"],
  ["无法读取 SSH 输出", "Unable to read SSH output"],
  ["无法解析服务器地址", "Unable to resolve the server address"],
  ["无法连接服务器", "Unable to connect to the server"],
  ["无法检查远程环境", "Unable to inspect the remote environment"],
  ["SSH 操作超时", "SSH operation timed out"],
  ["不支持的 Compose 操作", "Unsupported Compose operation"],
  ["不支持的服务器操作", "Unsupported server operation"],
  ["无法读取服务器状态", "Unable to read server status"],
  ["无法读取在线玩家", "Unable to read online players"],
  ["玩家接口返回了无效数据", "The player API returned invalid data"],
  ["玩家接口缺少 players 数组", "The player API response is missing the players array"],
  ["无法读取备份列表", "Unable to read backups"],
  ["备份目录不是安全的普通目录", "The backup directory is not a safe regular directory"],
  ["无法读取世界配置", "Unable to read world settings"],
  ["无法读取现有世界配置", "Unable to read existing world settings"],
  ["无法升级 Paldeck Compose 模板", "Unable to upgrade the Paldeck Compose template"],
  ["Compose 备份路径是符号链接，已拒绝升级", "The Compose backup path is a symbolic link; upgrade refused"],
  ["REST API 已接受保存请求，但未检测到 Level.sav 更新", "The REST API accepted the save request, but Level.sav did not change"],
  ["世界配置变量数量不正确", "The world-setting variable count is incorrect"],
  ["世界配置包含不受支持的变量", "World settings contain an unsupported variable"],
  ["世界配置缺少变量", "World settings are missing variable"],
  ["世界配置变量", "World-setting variable"],
  ["必须为 true 或 false", "must be true or false"],
  ["必须为非负整数", "must be a non-negative integer"],
  ["必须为数字", "must be a number"],
  ["超出允许范围", "is outside the allowed range"],
  ["每个基地的帕鲁数量必须在 1 到 50 之间", "Pals per base must be between 1 and 50"],
  ["每个公会的基地数量必须在 1 到 10 之间", "Bases per guild must be between 1 and 10"],
  ["难度配置无效", "The difficulty setting is invalid"],
  ["停服广播消息不能为空", "The lifecycle broadcast message cannot be empty"],
  ["停服倒计时必须在 0 到 300 秒之间", "The lifecycle countdown must be between 0 and 300 seconds"],
  ["不支持的安全停服操作", "Unsupported safe server lifecycle operation"],
  ["服务器当前未运行", "The server is not currently running"],
  ["随机化配置无效", "The randomizer setting is invalid"],
  ["跨平台配置无效", "The crossplay-platform setting is invalid"],
  ["世界倍率必须在 0 到 10 之间", "World rates must be between 0 and 10"],
  ["死亡惩罚配置无效", "The death penalty setting is invalid"],
  ["远程初始化失败", "Remote initialization failed"],
  ["Preview：连接检查已模拟完成", "Preview: connection check simulated"],
  ["Preview：远程初始化已模拟完成", "Preview: remote setup simulated"],
];

export function I18nProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(loadPreference);
  const [detectedLocale, setDetectedLocale] = useState(systemLocale);
  const locale = preference === "system" ? detectedLocale : preference;

  useEffect(() => {
    const update = () => setDetectedLocale(systemLocale());
    window.addEventListener("languagechange", update);
    return () => window.removeEventListener("languagechange", update);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setPreference = useCallback((next: LanguagePreference) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Keep the in-memory preference when WebView storage is unavailable.
    }
    setPreferenceState(next);
  }, []);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      translate(locale, key, values),
    [locale],
  );

  const errorMessage = useCallback(
    (cause: unknown) => {
      let message = cause instanceof Error ? cause.message : String(cause);
      if (locale === "zh-CN") return message;
      for (const [source, target] of backendEnglishReplacements) {
        message = message.replaceAll(source, target);
      }
      return en[message] ?? message;
    },
    [locale],
  );

  const value = useMemo(
    () => ({ preference, locale, setPreference, t, errorMessage }),
    [preference, locale, setPreference, t, errorMessage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
