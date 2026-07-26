import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type HermesPlugin from "../main";

export class HermesSettingTab extends PluginSettingTab {
  private plugin: HermesPlugin;

  constructor(app: App, plugin: HermesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("连接")
      .setDesc(
        "默认连接本机 127.0.0.1:8642 上的 Hermes 网关。请先启动网关：启动 Hermes Desktop（会自动拉起网关），或在 CLI/TUI 安装下运行 `hermes gateway`。两种方式插件都能用——只要能访问到网关的 HTTP API 即可。"
      )
      .setHeading();

    new Setting(containerEl)
      .setName("你的名字")
      .setDesc("可选。用于个性化空聊天时的问候语（例如「有什么新鲜事，Jason？」）。")
      .addText((text) =>
        text
          .setPlaceholder("（未设置）")
          .setValue(this.plugin.settings.userName)
          .onChange(async (v) => {
            this.plugin.settings.userName = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("网关地址")
      .setDesc("默认配置为 http://127.0.0.1:8642。结尾的 /v1 会自动去掉。")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:8642")
          .setValue(this.plugin.settings.baseUrl)
          .onChange(async (v) => {
            this.plugin.settings.baseUrl = v;
            await this.plugin.saveSettings();
            this.plugin.reloadModelInViews();
          })
      );

    new Setting(containerEl)
      .setName("API 密钥（API_SERVER_KEY）")
      .setDesc("粘贴 ~/.hermes/.env 里的 API_SERVER_KEY。会话延续和鉴权都需要它。")
      .addText((text) => {
        text
          .setPlaceholder("粘贴 API_SERVER_KEY")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (v) => {
            this.plugin.settings.apiKey = v.trim();
            await this.plugin.saveSettings();
            this.plugin.reloadModelInViews();
          });
        text.inputEl.type = "password";
        return text;
      });

    new Setting(containerEl)
      .setName("模型")
      .setDesc('模型 id，例如 "gpt-5.5"。留空则显示从 Hermes 配置里读到的真实模型。也可以点下面的"测试连接"列出可用模型。')
      .addText((text) =>
        text
          .setPlaceholder("（读取自 Hermes 配置）")
          .setValue(this.plugin.settings.model)
          .onChange(async (v) => {
            this.plugin.settings.model = v.trim();
            await this.plugin.saveSettings();
            this.plugin.reloadModelInViews();
          })
      );

    new Setting(containerEl)
      .setName("Hermes 主目录（用于显示模型名）")
      .setDesc(
        "包含 config.yaml 的文件夹，用来显示真实模型名（例如 gpt-5.5）及其上下文窗口——网关 API 本身只会报告 \"hermes-agent\" 这个统称。留空则自动检测（依次尝试 $HERMES_HOME、~/.hermes）。便携版：指向 exe 旁边的 hermes-data/hermes 文件夹。"
      )
      .addText((text) =>
        text
          .setPlaceholder("（自动检测）")
          .setValue(this.plugin.settings.hermesHome)
          .onChange(async (v) => {
            this.plugin.settings.hermesHome = v.trim();
            await this.plugin.saveSettings();
            this.plugin.reloadModelInViews();
          })
      );

    new Setting(containerEl)
      .setName("Agent 工作区")
      .setDesc("把你的库交给 Hermes 作为工作目录，让它可以读写、搜索并对笔记执行多步骤任务。")
      .setHeading();

    new Setting(containerEl)
      .setName("工作文件夹")
      .setDesc("Agent 的操作范围，相对于库根目录。留空则使用整个库，也支持填绝对路径。小提示：点击聊天面板底部的文件夹图标可以直接可视化选择。")
      .addText((text) =>
        text
          .setPlaceholder("（库根目录）")
          .setValue(this.plugin.settings.workingFolder)
          .onChange(async (v) => {
            this.plugin.settings.workingFolder = v.trim();
            await this.plugin.saveSettings();
            this.plugin.refreshOpenViews();
          })
      );

    new Setting(containerEl)
      .setName("自动批准工具请求")
      .setDesc("让 Agent 无需确认即可使用文件读写、搜索、终端等工具——也就是真正授予它对工作文件夹的读写权限。关闭后只会得到纯文本（不带工具调用）的回复。")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.autoApproveTools).onChange(async (v) => {
          this.plugin.settings.autoApproveTools = v;
          await this.plugin.saveSettings();
          this.plugin.refreshOpenViews();
        })
      );

    new Setting(containerEl)
      .setName("传输方式")
      .setDesc("auto：通过 /v1/capabilities 自动探测（优先使用更强的 Runs 传输），否则可强制指定一种。")
      .addDropdown((dd) =>
        dd
          .addOption("auto", "自动（推荐）")
          .addOption("runs", "Runs")
          .addOption("chat", "Chat Completions")
          .setValue(this.plugin.settings.transport)
          .onChange(async (v) => {
            this.plugin.settings.transport = v as "auto" | "runs" | "chat";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("推理强度")
      .setDesc("发给网关的可选提示。留空则使用服务端默认值。")
      .addDropdown((dd) =>
        dd
          .addOption("", "（服务端默认）")
          .addOption("minimal", "最低")
          .addOption("low", "低")
          .addOption("medium", "中")
          .addOption("high", "高")
          .addOption("xhigh", "极高")
          .setValue(this.plugin.settings.reasoningEffort)
          .onChange(async (v) => {
            this.plugin.settings.reasoningEffort = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("附带完整笔记内容")
      .setDesc('当消息上勾选了"当前笔记"时，发送笔记正文（而不只是路径）。')
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.includeNoteContent).onChange(async (v) => {
          this.plugin.settings.includeNoteContent = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("请求超时（毫秒）")
      .setDesc("单次请求的流式超时时间，默认 120000（120 秒）。")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.requestTimeoutMs))
          .onChange(async (v) => {
            const n = parseInt(v, 10);
            if (!Number.isNaN(n) && n > 0) {
              this.plugin.settings.requestTimeoutMs = n;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("最大标签页数")
      .setDesc("同时打开的聊天标签页数量上限。")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.maxTabs))
          .onChange(async (v) => {
            const n = parseInt(v, 10);
            if (!Number.isNaN(n) && n >= 1 && n <= 10) {
              this.plugin.settings.maxTabs = n;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("系统提示词")
      .setDesc("每轮对话都会附带的指令，与工作文件夹上下文一起发送。")
      .setHeading();

    new Setting(containerEl)
      .setName("Markdown 格式提示")
      .setDesc("内置指令，告诉 Hermes 它的回复会在窄边栏里按 Markdown 渲染（代码块要加围栏、用真正的表格、标题不超过 ##，等等）。如果和你下面的自定义提示词冲突，可以关掉。")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.markdownFormattingPromptEnabled).onChange(async (v) => {
          this.plugin.settings.markdownFormattingPromptEnabled = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("自定义系统提示词")
      .setDesc("可选。会追加到每轮对话的系统消息里——人设、语气、行文风格，任何你希望 Hermes 在这个库里始终遵守的内容。")
      .addTextArea((ta) => {
        ta.setPlaceholder("例如：始终用中文回答。给出答案前先引用你参考的笔记标题。")
          .setValue(this.plugin.settings.customSystemPrompt)
          .onChange(async (v) => {
            this.plugin.settings.customSystemPrompt = v;
            await this.plugin.saveSettings();
          });
        ta.inputEl.rows = 5;
        ta.inputEl.addClass("hermes-settings-textarea");
        return ta;
      });

    new Setting(containerEl)
      .setName("知识图谱")
      .setDesc('由 Agent 构建的关系图谱：Hermes 读取你的笔记，挖掘出显式 [[wikilink]] 之外的语义关联（共同主题、延伸阐述、前置知识）。可从左侧功能区图标或"打开知识图谱"命令打开，然后点击"分析当前库"。')
      .setHeading();

    new Setting(containerEl)
      .setName("最大分析笔记数")
      .setDesc("每次分析发给 Hermes 的笔记数量上限。库更大时会按此上限采样，默认 150。")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.graphMaxNotes))
          .onChange(async (v) => {
            const n = parseInt(v, 10);
            if (!Number.isNaN(n) && n >= 5 && n <= 1000) {
              this.plugin.settings.graphMaxNotes = n;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("最小关联强度")
      .setDesc("低于此强度的推断（语义）关联会被隐藏。0 = 全部显示，1 = 只显示最强的。默认 0.3。")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.graphMinEdgeWeight))
          .onChange(async (v) => {
            const n = parseFloat(v);
            if (!Number.isNaN(n) && n >= 0 && n <= 1) {
              this.plugin.settings.graphMinEdgeWeight = n;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("显示 wikilink 连线")
      .setDesc("在推断出的语义连线之外，也画出显式的 [[wikilink]] 连接（用较浅的颜色区分）。")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.graphIncludeWikilinks).onChange(async (v) => {
          this.plugin.settings.graphIncludeWikilinks = v;
          await this.plugin.saveSettings();
        })
      );

    const testSetting = new Setting(containerEl)
      .setName("测试连接")
      .setDesc("探测网关状态，并报告传输方式和可用模型。");
    const resultEl = containerEl.createDiv({ cls: "setting-item-description hermes-test-result" });
    testSetting.addButton((btn) =>
      btn
        .setButtonText("测试连接")
        .setCta()
        .onClick(async () => {
          btn.setDisabled(true);
          resultEl.setText("正在测试…");
          const result = await this.plugin.client.testConnection();
          resultEl.setText(result.detail);
          resultEl.toggleClass("hermes-test-ok", result.ok);
          resultEl.toggleClass("hermes-test-fail", !result.ok);
          if (result.ok && result.models && result.models.length > 0) {
            new Notice(`Hermes 可用模型：${result.models.slice(0, 8).join(", ")}`);
          }
          btn.setDisabled(false);
        })
    );
  }
}
