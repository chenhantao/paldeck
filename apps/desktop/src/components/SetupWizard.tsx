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

type SetupStep = "connection" | "environment" | "configuration" | "complete";

interface SetupWizardProps {
  initialProfile?: ServerProfile;
  onComplete: (profile: ServerProfile) => void;
}

const defaultOptions: InitializationOptions = {
  serverName: "My Palworld Server",
  serverPassword: "",
  adminPassword: "",
  players: 8,
  startAfterInstall: false,
};

export function SetupWizard({
  initialProfile,
  onComplete,
}: SetupWizardProps) {
  const [step, setStep] = useState<SetupStep>("connection");
  const [profile, setProfile] = useState(
    initialProfile ?? createDefaultProfile(),
  );
  const [inspection, setInspection] =
    useState<EnvironmentInspection | null>(null);
  const [options, setOptions] =
    useState<InitializationOptions>(defaultOptions);
  const [trust, setTrust] = useState<ConnectionProbe | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError(probe.message || "连接服务器失败");
        return;
      }
      setTrust(null);
      const environment = await inspectEnvironment(candidate);
      setProfile(candidate);
      setInspection(environment);
      setStep("environment");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
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
        if (refreshed.composeExists && refreshed.envExists) {
          setInspection(refreshed);
          setStep("environment");
          setError(
            `部署文件已写入，但后续启动失败：${result.stderr || "请检查远程 Docker 日志"}`,
          );
        } else {
          setError(result.stderr || "远程初始化失败");
        }
        return;
      }
      setStep("complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const existingDeployment = Boolean(
    inspection?.composeExists &&
      inspection.envExists &&
      inspection.deploymentValid,
  );
  const environmentReady = isEnvironmentReady(inspection);

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
              <small>首次使用向导</small>
            </div>
          </div>
          <ol className="setup-steps" aria-label="初始化进度">
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
                {label}
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
                  <h1>连接你的服务器</h1>
                  <p>
                    可复用 OpenSSH 配置，也可直接填写账号密码。底层连接始终使用
                    SSH 加密。
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
                    <strong>首次连接：核对主机密钥</strong>
                    <p>
                      请通过服务器控制台核对指纹。Paldeck 保存的是公开主机密钥，
                      不是登录密码。
                    </p>
                    <code>{trust.fingerprint}</code>
                  </div>
                  <button
                    className="button button--secondary"
                    onClick={trustAndContinue}
                    disabled={busy}
                  >
                    指纹一致，信任
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
                  <h1>远程环境检查</h1>
                  <p>
                    Paldeck 不会自动执行 sudo 安装 Docker；缺失项目需要先在服务器
                    上处理。
                  </p>
                </div>
              </div>

              <div className="check-grid">
                <CheckItem
                  label="操作系统"
                  value={inspection.os}
                  ok={inspection.os.toLowerCase() === "linux"}
                />
                <CheckItem
                  label="处理器架构"
                  value={inspection.arch}
                  ok={["x86_64", "amd64"].includes(
                    inspection.arch.toLowerCase(),
                  )}
                />
                <CheckItem
                  label="Docker"
                  value={inspection.dockerInstalled ? "已安装" : "未安装"}
                  ok={inspection.dockerInstalled}
                />
                <CheckItem
                  label="Docker 权限"
                  value={inspection.dockerUsable ? "可直接使用" : "不可用"}
                  ok={inspection.dockerUsable}
                />
                <CheckItem
                  label="Docker Compose"
                  value={inspection.composeInstalled ? "可用" : "不可用"}
                  ok={inspection.composeInstalled}
                />
                <CheckItem
                  label="部署目录"
                  value={
                    inspection.directoryExists
                      ? `${profile.remotePath} 已存在`
                      : "将自动创建"
                  }
                  ok
                />
              </div>

              {(inspection.composeExists || inspection.envExists) && (
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
                        ? "发现有效的 Paldeck 部署"
                        : inspection.composeExists && inspection.envExists
                          ? "部署文件存在，但配置验证失败"
                          : "目录中只有部分部署文件"}
                    </strong>
                    <p>
                      {existingDeployment
                        ? "可以直接接管，现有 compose.yaml 和 .env 不会被覆盖。"
                        : "为防止数据损坏，Paldeck 不会自动覆盖。请检查远程目录中的 Compose 配置。"}
                    </p>
                  </div>
                </div>
              )}

              {!environmentReady && (
                <div className="setup-callout setup-callout--warning">
                  <CircleAlert size={20} />
                  <div>
                    <strong>环境尚未满足部署要求</strong>
                    <p>
                      需要 Linux x86_64、可由当前账号使用的 Docker，以及 Docker
                      Compose 插件。
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
                  <h1>创建服务器配置</h1>
                  <p>
                    初始化会上传仓库内置的 Compose 模板，在远程目录生成权限为
                    600 的 `.env`。
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <label className="field field--wide">
                  <span>服务器名称</span>
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
                  <span>管理员密码</span>
                  <input
                    type="password"
                    value={options.adminPassword}
                    onChange={(event) =>
                      setOptions({
                        ...options,
                        adminPassword: event.target.value,
                      })
                    }
                    placeholder="至少 8 个字符"
                    autoComplete="new-password"
                    disabled={busy}
                  />
                </label>
                <label className="field">
                  <span>加入密码</span>
                  <input
                    type="password"
                    value={options.serverPassword}
                    onChange={(event) =>
                      setOptions({
                        ...options,
                        serverPassword: event.target.value,
                      })
                    }
                    placeholder="留空表示无需密码"
                    disabled={busy}
                  />
                </label>
                <label className="field">
                  <span>最大玩家数</span>
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
                    <strong>初始化完成后立即启动</strong>
                    <small>首次拉取镜像和安装游戏可能需要较长时间。</small>
                  </span>
                </label>
              </div>

              <div className="setup-summary">
                <Container size={20} />
                <div>
                  <span>部署位置</span>
                  <strong>{profile.remotePath}</strong>
                </div>
                <div>
                  <span>运行平台</span>
                  <strong>linux/amd64</strong>
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
                <h1>Paldeck 已准备完成</h1>
                <p>
                  连接信息已经保存。账号密码仅保留在当前会话，重新打开应用时需要
                  再次输入。
                </p>
              </div>
              <div className="setup-summary">
                <Server size={20} />
                <div>
                  <span>服务器</span>
                  <strong>{profile.name}</strong>
                </div>
                <div>
                  <span>远程目录</span>
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
            登录密码不会写入磁盘
          </div>
          <div className="setup-actions">
            {step === "environment" && (
              <button
                className="button button--ghost"
                onClick={() => {
                  setStep("connection");
                  setError(null);
                }}
                disabled={busy}
              >
                <ChevronLeft size={17} />
                返回
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
                返回
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
                {busy ? "正在连接…" : "连接并检查"}
              </button>
            )}
            {step === "environment" &&
              existingDeployment &&
              environmentReady && (
                <button
                  className="button button--primary"
                  onClick={() => setStep("complete")}
                >
                  接管现有部署
                  <ChevronRight size={17} />
                </button>
              )}
            {step === "environment" &&
              !inspection?.composeExists &&
              !inspection?.envExists &&
              environmentReady && (
                <button
                  className="button button--primary"
                  onClick={() => setStep("configuration")}
                >
                  创建新部署
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
                  options.players < 1 ||
                  options.players > 32
                }
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Container size={17} />
                )}
                {busy ? "正在初始化…" : "开始初始化"}
              </button>
            )}
            {step === "complete" && (
              <button
                className="button button--primary"
                onClick={() => onComplete(profile)}
              >
                进入控制台
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
    return Boolean(profile.auth.sshHost.trim());
  }
  return Boolean(
    profile.auth.host.trim() &&
      profile.auth.username.trim() &&
      profile.auth.password &&
      profile.auth.port >= 1 &&
      profile.auth.port <= 65535,
  );
}

function setupStepIndex(step: SetupStep): number {
  return ["connection", "environment", "configuration", "complete"].indexOf(
    step,
  );
}
