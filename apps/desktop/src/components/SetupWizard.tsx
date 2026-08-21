import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Container,
  Cpu,
  FolderCog,
  LoaderCircle,
  MonitorCog,
  Server,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import {
  importExistingDeployment,
  initializeRemoteServer,
  inspectEnvironment,
  probeConnection,
} from "../lib/backend";
import { createDefaultProfile } from "../lib/profile";
import type {
  ConnectionProbe,
  EnvironmentInspection,
  InitializationOptions,
  ServerProfile,
} from "../types/server";
import { ConnectionFields } from "./ConnectionFields";
import { LanguageSelector } from "./LanguageSelector";
import { useI18n } from "../i18n/I18nContext";

type SetupStep = "connection" | "environment" | "configuration" | "complete";

interface SetupWizardProps {
  initialProfile?: ServerProfile;
  onComplete: (profile: ServerProfile) => void;
  onCancel?: () => void;
}

const defaultOptions: InitializationOptions = {
  serverName: "My Palworld Server",
  serverPassword: "",
  adminPassword: "",
  dataDirectory: "./palworld",
  players: 8,
  startAfterInstall: true,
};

export function SetupWizard({
  initialProfile,
  onComplete,
  onCancel,
}: SetupWizardProps) {
  const { t, errorMessage } = useI18n();
  const [step, setStep] = useState<SetupStep>("connection");
  const [profile, setProfile] = useState(
    initialProfile ?? createDefaultProfile(t("我的帕鲁服务器")),
  );
  const [inspection, setInspection] =
    useState<EnvironmentInspection | null>(null);
  const [options, setOptions] =
    useState<InitializationOptions>(defaultOptions);
  const [trust, setTrust] = useState<ConnectionProbe | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importConfirmed, setImportConfirmed] = useState(false);

  const checkConnectionAndEnvironment = async (candidate: ServerProfile) => {
    setBusy(true);
    setError(null);
    try {
      const probe = await probeConnection(candidate);
      if (probe.requiresTrust) {
        setTrust(probe);
        return;
      }
      if (!probe.success) {
        setError(errorMessage(probe.message || t("连接服务器失败")));
        return;
      }
      setTrust(null);
      const environment = await inspectEnvironment(candidate);
      setProfile(candidate);
      setInspection(environment);
      setImportConfirmed(false);
      setStep("environment");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const importDeployment = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await importExistingDeployment(profile);
      const refreshed = await inspectEnvironment(profile);
      setInspection(refreshed);
      if (
        !result.success ||
        !refreshed.managedDirectory ||
        !refreshed.deploymentValid
      ) {
        setError(
          errorMessage(
            result.stderr || t("导入完成后未能验证受管部署，请检查远程目录。"),
          ),
        );
        return;
      }
      setStep("complete");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const trustAndContinue = () => {
    if (
      profile.auth.kind !== "password" ||
      !trust?.hostKey
    ) {
      return;
    }
    const trusted: ServerProfile = {
      ...profile,
      auth: {
        ...profile.auth,
        trustedHostKey: trust.hostKey,
      },
    };
    setProfile(trusted);
    void checkConnectionAndEnvironment(trusted);
  };

  const initialize = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await initializeRemoteServer(profile, options);
      if (!result.success) {
        const refreshed = await inspectEnvironment(profile);
        if (
          refreshed.managedDirectory &&
          refreshed.composeExists &&
          refreshed.envExists
        ) {
          setInspection(refreshed);
          setStep("environment");
          setError(
            t("部署文件已写入，但后续启动失败：{detail}", {
              detail: errorMessage(result.stderr || t("请检查远程 Docker 日志")),
            }),
          );
        } else {
          setError(errorMessage(result.stderr || t("远程初始化失败")));
        }
        return;
      }
      setStep("complete");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const existingDeployment = Boolean(
    inspection?.managedDirectory &&
      inspection.composeExists &&
      inspection.envExists &&
      inspection.deploymentValid,
  );
  const environmentReady = isEnvironmentReady(inspection);
  const canInitialize = Boolean(
    inspection?.pathSafe &&
      (!inspection.directoryExists || inspection.directoryEmpty),
  );
  const canImport = Boolean(inspection?.importCandidate && inspection.importCompatible);

  return (
    <div className="setup-screen">
      <div className="setup-glow" />
      <main className="setup-panel">
        <header className="setup-header">
          <div className="setup-brand">
            <span className="setup-brand__mark">
              <MonitorCog size={22} />
            </span>
            <div>
              <strong>Paldeck</strong>
              <small>{t("首次使用向导")}</small>
            </div>
          </div>
          <LanguageSelector />
          <ol className="setup-steps" aria-label={t("初始化进度")}>
            {[
              ["connection", "连接"],
              ["environment", "检查"],
              ["configuration", "配置"],
              ["complete", "完成"],
            ].map(([id, label], index) => (
              <li
                key={id}
                className={
                  setupStepIndex(step) >= index
                    ? "setup-step setup-step--active"
                    : "setup-step"
                }
              >
                <span>{setupStepIndex(step) > index ? <Check size={13} /> : index + 1}</span>
                {t(label)}
              </li>
            ))}
          </ol>
        </header>

        <section className="setup-content">
          {step === "connection" && (
            <>
              <div className="setup-title">
                <span className="setup-title__icon">
                  <Server size={22} />
                </span>
                <div>
                  <span className="eyebrow">REMOTE SERVER</span>
                  <h1>{t("连接你的服务器")}</h1>
                  <p>
                    {t(
                      "可复用 OpenSSH 配置，也可直接填写账号密码。底层连接始终使用 SSH 加密。",
                    )}
                  </p>
                </div>
              </div>

              <ConnectionFields
                profile={profile}
                onChange={(next) => {
                  setProfile(next);
                  setTrust(null);
                  setError(null);
                }}
                disabled={busy}
              />

              {trust?.requiresTrust && (
                <div className="trust-card">
                  <ShieldCheck size={21} />
                  <div>
                    <strong>{t("首次连接：核对主机密钥")}</strong>
                    <p>
                      {t(
                        "请通过服务器控制台核对指纹。Paldeck 保存的是公开主机密钥，不是登录密码。",
                      )}
                    </p>
                    <code>{trust.fingerprint}</code>
                  </div>
                  <button
                    className="button button--secondary"
                    onClick={trustAndContinue}
                    disabled={busy}
                  >
                    {t("指纹一致，信任")}
                  </button>
                </div>
              )}
            </>
          )}

          {step === "environment" && inspection && (
            <>
              <div className="setup-title">
                <span className="setup-title__icon">
                  <Cpu size={22} />
                </span>
                <div>
                  <span className="eyebrow">ENVIRONMENT CHECK</span>
                  <h1>{t("远程环境检查")}</h1>
                  <p>
                    {t(
                      "Paldeck 不会自动执行 sudo 安装 Docker；缺失项目需要先在服务器上处理。",
                    )}
                  </p>
                </div>
              </div>

              <div className="check-grid">
                <CheckItem
                  label={t("操作系统")}
                  value={inspection.os}
                  ok={inspection.os.toLowerCase() === "linux"}
                />
                <CheckItem
                  label={t("处理器架构")}
                  value={inspection.arch}
                  ok={["x86_64", "amd64"].includes(
                    inspection.arch.toLowerCase(),
                  )}
                />
                <CheckItem
                  label="Docker"
                  value={t(inspection.dockerInstalled ? "已安装" : "未安装")}
                  ok={inspection.dockerInstalled}
                />
                <CheckItem
                  label={t("Docker 权限")}
                  value={t(inspection.dockerUsable ? "可直接使用" : "不可用")}
                  ok={inspection.dockerUsable}
                />
                <CheckItem
                  label="Docker Compose"
                  value={t(inspection.composeInstalled ? "可用" : "不可用")}
                  ok={inspection.composeInstalled}
                />
                <CheckItem
                  label={t("部署目录")}
                  value={
                    !inspection.pathSafe
                      ? t("路径不安全")
                      : inspection.managedDirectory
                        ? t("由 Paldeck 管理")
                        : inspection.importCompatible
                          ? t("可安全导入")
                        : inspection.directoryExists
                          ? inspection.directoryEmpty
                            ? t("已存在且为空")
                            : t("非空且不受管理")
                          : t("不存在，将安全创建")
                  }
                  ok={Boolean(
                    inspection.pathSafe &&
                      (inspection.managedDirectory ||
                        inspection.importCompatible ||
                        !inspection.directoryExists ||
                        inspection.directoryEmpty),
                  )}
                />
              </div>

              {inspection.managedDirectory && (
                <div
                  className={
                    existingDeployment
                      ? "setup-callout setup-callout--success"
                      : "setup-callout setup-callout--warning"
                  }
                >
                  {existingDeployment ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <CircleAlert size={20} />
                  )}
                  <div>
                    <strong>
                      {existingDeployment
                        ? t("发现有效的 Paldeck 部署")
                        : t("Paldeck 管理目录不完整或配置无效")}
                    </strong>
                    <p>
                      {existingDeployment
                        ? t("管理标记、compose.yaml 和 .env 均已验证，可以继续使用。")
                        : t("Paldeck 不会自动覆盖或重建该目录。请先检查远程目录中的管理标记和部署文件。")}
                    </p>
                  </div>
                </div>
              )}

              {inspection.directoryExists &&
                !inspection.directoryEmpty &&
                !inspection.managedDirectory &&
                !inspection.importCandidate && (
                  <div className="setup-callout setup-callout--warning">
                    <CircleAlert size={20} />
                    <div>
                      <strong>{t("目录非空且没有 Paldeck 管理标记")}</strong>
                      <p>
                        {t(
                          "为避免碰到同名目录中的其他文件，Paldeck 拒绝初始化，也不会接管、移动或删除其中的任何内容。请改用不存在的目录或空目录。",
                        )}
                      </p>
                    </div>
                  </div>
                )}

              {inspection.importCandidate && !inspection.managedDirectory && (
                <>
                  <div
                    className={
                      inspection.importCompatible
                        ? "setup-callout setup-callout--success"
                        : "setup-callout setup-callout--warning"
                    }
                  >
                    {inspection.importCompatible ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <CircleAlert size={20} />
                    )}
                    <div>
                      <strong>
                        {t(
                          inspection.importCompatible
                            ? "发现可导入的现有部署"
                            : "现有部署暂时无法导入",
                        )}
                      </strong>
                      <p>
                        {t(
                          inspection.importCompatible
                            ? "Paldeck 将保留现有 Compose、环境配置、容器和存档，先创建受保护的配置备份，再写入管理标记。"
                            : "至少一项兼容性检查未通过。Paldeck 不会修改、移动或删除现有文件。",
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="check-grid">
                    <CheckItem
                      label={t("Compose 配置")}
                      value={t(inspection.importComposeValid ? "有效" : "无效")}
                      ok={inspection.importComposeValid}
                    />
                    <CheckItem
                      label={t("Compose 服务")}
                      value={t(
                        inspection.importServiceCompatible
                          ? "仅包含 palworld"
                          : "必须仅包含 palworld",
                      )}
                      ok={inspection.importServiceCompatible}
                    />
                    <CheckItem
                      label={t("容器镜像")}
                      value={
                        inspection.importImage ?? t("无法识别或版本不受支持")
                      }
                      ok={inspection.importImageCompatible}
                    />
                    <CheckItem
                      label={t("数据目录")}
                      value={
                        inspection.importDataDirectory ?? t("路径无效或缺失")
                      }
                      ok={inspection.importDataDirectorySafe}
                    />
                    <CheckItem
                      label={t("数据卷映射")}
                      value={t(
                        inspection.importVolumeCompatible
                          ? "安全映射到 /palworld"
                          : "未匹配安全数据目录",
                      )}
                      ok={inspection.importVolumeCompatible}
                    />
                    <CheckItem
                      label={t("导入备份")}
                      value={t(
                        inspection.importBackupAvailable
                          ? "将创建 .paldeck-import-backup"
                          : "备份目录已存在，拒绝覆盖",
                      )}
                      ok={inspection.importBackupAvailable}
                    />
                  </div>

                  {inspection.importCompatible && (
                    <label className="setup-checkbox setup-checkbox--confirmation">
                      <input
                        type="checkbox"
                        checked={importConfirmed}
                        onChange={(event) =>
                          setImportConfirmed(event.target.checked)
                        }
                        disabled={busy}
                      />
                      <span>
                        <strong>{t("我确认让 Paldeck 管理这个现有部署")}</strong>
                        <small>
                          {t(
                            "导入不会停止或重建容器，也不会改写 compose.yaml、.env、游戏存档或目录中的其他文件。",
                          )}
                        </small>
                      </span>
                    </label>
                  )}
                </>
              )}

              {inspection.managedDirectory && inspection.unexpectedEntries && (
                <div className="setup-callout setup-callout--warning">
                  <CircleAlert size={20} />
                  <div>
                    <strong>{t("管理目录中存在额外文件")}</strong>
                    <p>
                      {t(
                        "Paldeck 只管理标记文件、compose.yaml、.env、配置备份和游戏数据目录；额外文件会原样保留。",
                      )}
                    </p>
                  </div>
                </div>
              )}

              {!environmentReady && (
                <div className="setup-callout setup-callout--warning">
                  <CircleAlert size={20} />
                  <div>
                    <strong>{t("环境尚未满足部署要求")}</strong>
                    <p>
                      {t(
                        "需要 Linux x86_64、可由当前账号使用的 Docker，以及 Docker Compose 插件。",
                      )}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {step === "configuration" && (
            <>
              <div className="setup-title">
                <span className="setup-title__icon">
                  <FolderCog size={22} />
                </span>
                <div>
                  <span className="eyebrow">SERVER CONFIGURATION</span>
                  <h1>{t("创建服务器配置")}</h1>
                  <p>
                    {t(
                      "初始化只允许使用不存在或完全为空的目录，并会写入 Paldeck 管理标记、内置 Compose 模板和权限为 600 的 .env。游戏数据只能保存在部署目录内由你指定的安全子目录。",
                    )}
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <label className="field field--wide">
                  <span>{t("服务器名称")}</span>
                  <input
                    value={options.serverName}
                    onChange={(event) =>
                      setOptions({
                        ...options,
                        serverName: event.target.value,
                      })
                    }
                    disabled={busy}
                  />
                </label>
                <label className="field">
                  <span>{t("管理员密码")}</span>
                  <input
                    type="password"
                    value={options.adminPassword}
                    onChange={(event) =>
                      setOptions({
                        ...options,
                        adminPassword: event.target.value,
                      })
                    }
                    placeholder={t("至少 8 个字符")}
                    autoComplete="new-password"
                    disabled={busy}
                  />
                </label>
                <label className="field">
                  <span>{t("加入密码")}</span>
                  <input
                    type="password"
                    value={options.serverPassword}
                    onChange={(event) =>
                      setOptions({
                        ...options,
                        serverPassword: event.target.value,
                      })
                    }
                    placeholder={t("留空表示无需密码")}
                    disabled={busy}
                  />
                </label>
                <label className="field">
                  <span>{t("最大玩家数")}</span>
                  <input
                    type="number"
                    min={1}
                    max={32}
                    value={options.players}
                    onChange={(event) =>
                      setOptions({
                        ...options,
                        players: Number(event.target.value),
                      })
                    }
                    disabled={busy}
                  />
                </label>
                <label className="field">
                  <span>{t("游戏数据子目录")}</span>
                  <input
                    value={options.dataDirectory}
                    onChange={(event) =>
                      setOptions({
                        ...options,
                        dataDirectory: event.target.value,
                      })
                    }
                    placeholder="./palworld"
                    spellCheck={false}
                    disabled={busy}
                  />
                  <small className="field__hint">
                    {t(
                      "必须以 ./ 开头，仅允许字母、数字、点、横线、下划线和斜杠；不允许绝对路径、空格、.. 或符号链接。",
                    )}
                  </small>
                </label>
                <label className="setup-checkbox">
                  <input
                    type="checkbox"
                    checked={options.startAfterInstall}
                    onChange={(event) =>
                      setOptions({
                        ...options,
                        startAfterInstall: event.target.checked,
                      })
                    }
                    disabled={busy}
                  />
                  <span>
                    <strong>{t("初始化完成后立即启动")}</strong>
                    <small>{t("首次拉取镜像和安装游戏可能需要较长时间。")}</small>
                  </span>
                </label>
              </div>

              <div className="setup-summary">
                <Container size={20} />
                <div>
                  <span>{t("部署位置")}</span>
                  <strong>{profile.remotePath}</strong>
                </div>
                <div>
                  <span>{t("运行平台")}</span>
                  <strong>linux/amd64</strong>
                </div>
                <div>
                  <span>{t("数据子目录")}</span>
                  <strong>{options.dataDirectory}</strong>
                </div>
              </div>
            </>
          )}

          {step === "complete" && (
            <div className="setup-complete">
              <span>
                <CheckCircle2 size={34} />
              </span>
              <div>
                <span className="eyebrow">READY</span>
                <h1>{t("Paldeck 已准备完成")}</h1>
                <p>
                  {t(
                    "连接信息已经保存。账号密码仅保留在当前会话，重新打开应用时需要再次输入。",
                  )}
                </p>
              </div>
              <div className="setup-summary">
                <Server size={20} />
                <div>
                  <span>{t("服务器")}</span>
                  <strong>{profile.name}</strong>
                </div>
                <div>
                  <span>{t("远程目录")}</span>
                  <strong>{profile.remotePath}</strong>
                </div>
              </div>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}
        </section>

        <footer className="setup-footer">
          <div className="setup-security">
            <ShieldCheck size={16} />
            {t("登录密码不会写入磁盘")}
          </div>
          <div className="setup-actions">
            {onCancel && step !== "complete" && (
              <button
                className="button button--ghost"
                onClick={onCancel}
                disabled={busy}
              >
                {t("取消添加")}
              </button>
            )}
            {step === "environment" && (
              <button
                className="button button--ghost"
                onClick={() => {
                  setStep("connection");
                  setError(null);
                  setImportConfirmed(false);
                }}
                disabled={busy}
              >
                <ChevronLeft size={17} />
                {t("返回")}
              </button>
            )}
            {step === "configuration" && (
              <button
                className="button button--ghost"
                onClick={() => {
                  setStep("environment");
                  setError(null);
                }}
                disabled={busy}
              >
                <ChevronLeft size={17} />
                {t("返回")}
              </button>
            )}

            {step === "connection" && (
              <button
                className="button button--primary"
                onClick={() => void checkConnectionAndEnvironment(profile)}
                disabled={busy || !isConnectionComplete(profile)}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <ChevronRight size={17} />
                )}
                {t(busy ? "正在连接…" : "连接并检查")}
              </button>
            )}
            {step === "environment" &&
              canImport &&
              environmentReady && (
                <button
                  className="button button--primary"
                  onClick={() => void importDeployment()}
                  disabled={busy || !importConfirmed}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <FolderCog size={17} />
                  )}
                  {t(busy ? "正在导入…" : "导入现有部署")}
                </button>
              )}
            {step === "environment" &&
              existingDeployment &&
              environmentReady && (
                <button
                  className="button button--primary"
                  onClick={() => setStep("complete")}
                >
                  {t("使用现有 Paldeck 部署")}
                  <ChevronRight size={17} />
                </button>
              )}
            {step === "environment" &&
              canInitialize &&
              environmentReady && (
                <button
                  className="button button--primary"
                  onClick={() => setStep("configuration")}
                >
                  {t("创建新部署")}
                  <ChevronRight size={17} />
                </button>
              )}
            {step === "configuration" && (
              <button
                className="button button--primary"
                onClick={() => void initialize()}
                disabled={
                  busy ||
                  options.adminPassword.length < 8 ||
                  !options.serverName.trim() ||
                  !isSafeDataDirectory(options.dataDirectory) ||
                  options.players < 1 ||
                  options.players > 32
                }
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Container size={17} />
                )}
                {t(busy ? "正在初始化…" : "开始初始化")}
              </button>
            )}
            {step === "complete" && (
              <button
                className="button button--primary"
                onClick={() => onComplete(profile)}
              >
                {t("进入控制台")}
                <ChevronRight size={17} />
              </button>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}

function CheckItem({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className={ok ? "check-item check-item--ok" : "check-item"}>
      {ok ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function isEnvironmentReady(
  inspection: EnvironmentInspection | null,
): boolean {
  if (!inspection) return false;
  return (
    inspection.os.toLowerCase() === "linux" &&
    ["x86_64", "amd64"].includes(inspection.arch.toLowerCase()) &&
    inspection.dockerInstalled &&
    inspection.dockerUsable &&
    inspection.composeInstalled
  );
}

function isConnectionComplete(profile: ServerProfile): boolean {
  if (!profile.name.trim() || !profile.remotePath.trim()) return false;
  if (profile.auth.kind === "openssh") {
    return Boolean(profile.auth.host.trim() && profile.auth.username.trim());
  }
  return Boolean(
    profile.auth.host.trim() &&
      profile.auth.username.trim() &&
      profile.auth.password &&
      profile.auth.port >= 1 &&
      profile.auth.port <= 65535,
  );
}

function isSafeDataDirectory(path: string): boolean {
  if (!path.startsWith("./") || path.length <= 2 || path.endsWith("/")) {
    return false;
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(path)) return false;
  return path
    .slice(2)
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function setupStepIndex(step: SetupStep): number {
  return ["connection", "environment", "configuration", "complete"].indexOf(
    step,
  );
}
