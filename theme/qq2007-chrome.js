/* ============================================================================
   QQ 2007 客户端外壳注入脚本（WorkBuddy 5.8.3）
   ----------------------------------------------------------------------------
   由 qq2008-notify.js 动态加载。只创建装饰性的外壳 DOM（标题栏/菜单栏/状态栏/
   右侧好友面板）并同步「原版 / QQ 2008」切换状态，不改动 React 管理的节点。
   ============================================================================ */
(() => {
  "use strict";

  if (window.__QQ7_CHROME_INSTALLED__) return;
  window.__QQ7_CHROME_INSTALLED__ = true;

  const SKIN_LINK_SELECTOR = 'link[href*="qq2008-skin.css"]';
  const MENU = [
    { icon: 1, label: "新建任务", action: "nav:新建任务" },
    { icon: 9, label: "助理", action: "nav:助理" },
    { icon: 3, label: "技能", action: "nav:专家·技能·连接器" },
    { icon: 2, label: "定时任务", action: "nav:定时任务" },
    { icon: 10, label: "资料库", action: "nav:资料库" },
    { icon: 6, label: "聊天", action: "chat" },
    { icon: 8, label: "原版", action: "toggle-skin" }
  ];
  const TOOLS = [
    { icon: 7, label: "消息", action: "messages" },
    { icon: 2, label: "定时", action: "nav:定时任务" },
    { icon: 3, label: "技能", action: "nav:专家·技能·连接器" },
    { icon: 10, label: "资料库", action: "nav:资料库" }
  ];

  const icoStyle = (i) => `background-position:${-16 * i}px 0`;
  const icon = (i, cls = "qq7-ico") => `<span class="${cls}" style="${icoStyle(i)}"></span>`;

  const state = {
    title: "",
    collapsed: false,
    tab: "friends"
  };

  let root = null;
  let titleEl = null;
  let accountNameCache = "";
  /* 换肤令牌的 <style> 元素；在 syncSkin 里会被清空，所以必须早于它声明（避免 TDZ） */
  let themeStyleEl = null;

  function skinEnabled() {
    const link = document.querySelector(SKIN_LINK_SELECTOR);
    if (!link) return true;
    return link.media !== "not all";
  }

  function syncSkin() {
    const on = skinEnabled();
    document.body.classList.toggle("qq7-shell", on);
    document.body.classList.toggle("qq7-off", !on);
    if (root) root.style.display = on ? "" : "none";
    // 皮肤关闭时清掉自选配色令牌，让原生界面完全不受主题配色影响
    if (themeStyleEl) {
      // 关闭：清令牌让原生界面不受影响；重新打开：恢复已保存的自选配色
      if (!on) themeStyleEl.textContent = "";
      else if (themeStyleEl.textContent === "") applyTheme();
    }
    if (!on) {
      // 皮肤关闭时清掉运行态 class，避免残留的「加载中」占位图 / 举牌动画
      document.body.classList.remove("qq7-pet-loading", "qq7-pet-has-options", "qq7-panel-open");
      const sign = document.getElementById("qq7-root")?.querySelector(".qq7-pet-sign");
      if (sign) sign.dataset.show = "0";
    }
  }

  const ACCOUNT_NAME_SELECTORS = [
    ".user-menu-trigger-name",
    "[class*='user-menu-trigger-name']:not(.user-menu-trigger-name-group)",
  ];
  const INVALID_ACCOUNT_NAMES = /^(登录|重新登录|立即登录|请登录|未登录|退出登录|登录\s*\/\s*注册|log ?in|sign ?in|relogin)$/i;

  function getAccountService() {
    const service = window.__genieAccountService;
    return service && typeof service.getAccount === "function" ? service : null;
  }

  /* 返回 {name} / {loggedOut:true}；undefined=账号服务不可用或尚未初始化 */
  function readServiceAccount() {
    const service = getAccountService();
    if (!service) return undefined;
    try {
      const initialized = typeof service.isInitialized === "function" ? service.isInitialized() : true;
      if (!initialized) return undefined;
      const loggedIn = typeof service.isLoggedIn === "function" ? service.isLoggedIn() : true;
      if (!loggedIn) return { loggedOut: true };
      const account = service.getAccount();
      const name = account && (account.nickname || account.displayName || account.enterpriseUserName || account.name);
      return typeof name === "string" && name.trim() ? { name: name.trim() } : undefined;
    } catch (error) {
      return undefined;
    }
  }

  /* 返回账号名：字符串=可用；null=明确的未登录 / 登录过期状态；""=暂时没读到 */
  function readAccountName() {
    const serviceAccount = readServiceAccount();
    if (serviceAccount) {
      if (serviceAccount.loggedOut) return null;
      if (serviceAccount.name) return serviceAccount.name;
    }
    let loginPlaceholder = false;
    for (const selector of ACCOUNT_NAME_SELECTORS) {
      const candidates = [...document.querySelectorAll(selector)];
      // 优先可见节点，避免读到隐藏的旧菜单
      candidates.sort((a, b) => Number(b.getClientRects().length > 0) - Number(a.getClientRects().length > 0));
      for (const el of candidates) {
        const name = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (!name || name.length > 64) continue;
        if (INVALID_ACCOUNT_NAMES.test(name)) { loginPlaceholder = true; continue; }
        return name;
      }
    }
    return loginPlaceholder ? null : "";
  }

  /* WorkBuddy 未登录时用户菜单只渲染头像按钮，class 里没有 --workbuddy；
     菜单还没渲染时无法判断，返回 false 保留缓存 / 占位，等下一轮轮询。 */
  function accountMenuShowsLoggedOut() {
    const serviceAccount = readServiceAccount();
    if (serviceAccount) return Boolean(serviceAccount.loggedOut);
    const triggers = [...document.querySelectorAll(".user-menu-trigger")];
    if (!triggers.length) return false;
    // 优先看可见 trigger：可见节点里有登录态才算登录，避免隐藏的旧登录态掩盖真实登出
    const visible = triggers.filter((t) => t.getClientRects().length > 0);
    const scope = visible.length ? visible : triggers;
    if (scope.some((t) => String(t.className || "").includes("user-menu-trigger--workbuddy"))) return false;
    return scope.some((t) => !t.querySelector(".user-menu-trigger-name") && !(t.textContent || "").trim());
  }

  function displayName() {
    if (accountMenuShowsLoggedOut()) {
      // 明确退出登录（非登录过期文案）：清掉旧账号
      accountNameCache = "";
      return "WorkBuddy 用户";
    }
    const resolved = readAccountName();
    if (resolved === null) {
      // 登录过期 / 退出登录：清掉旧账号，避免继续显示上一个账号
      accountNameCache = "";
      return "WorkBuddy 用户";
    }
    if (resolved) accountNameCache = resolved;
    return accountNameCache || "WorkBuddy 用户";
  }

  /* 账号名是异步加载的：主题注入时可能还没渲染出来，先显示占位，
     之后定时同步到状态栏 / 好友面板，避免把作者名或旧值写死。 */
  function updateAccountName() {
    if (!root || document.body.classList.contains("qq7-off")) return;
    const name = displayName();
    root.querySelectorAll(".qq7-account-name").forEach((el) => {
      if (el.textContent !== name) el.textContent = name;
    });
  }

  function watchAccountName() {
    updateAccountName();
    const service = getAccountService();
    if (service && typeof service.subscribe === "function") {
      try {
        service.subscribe(() => updateAccountName());
      } catch (error) {}
    }
    window.setInterval(updateAccountName, 1500);
  }

  function appTitle() {
    for (const el of document.querySelectorAll(".workbuddy-topbar-title")) {
      const t = el.textContent ? el.textContent.trim() : "";
      if (t) return t;
    }
    const area = document.querySelector(".workbuddy-topbar-title-area");
    if (area && area.textContent && area.textContent.trim()) return area.textContent.trim();
    const topbar = document.querySelector(".workbuddy-topbar");
    if (topbar && topbar.textContent) {
      const t = topbar.textContent.trim();
      if (t && t.length <= 40) return t;
    }
    const doc = document.title && document.title.trim();
    return doc && doc !== "WorkBuddy" ? doc : "WorkBuddy";
  }

  function refreshTitle() {
    if (!titleEl) return;
    const next = `WorkBuddy 2007 — ${appTitle()}`;
    if (state.title === next) return;
    state.title = next;
    titleEl.textContent = next;
  }

  function focusComposer() {
    const editable = document.querySelector('[contenteditable="true"]');
    if (editable) {
      editable.focus();
      return true;
    }
    return false;
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function clickNav(label) {
    // WorkBuddy 左侧导航的真实节点：优先精确匹配，其次前缀匹配（如「助理Beta」）
    const selectors = [
      ".conversation-list-tab-button",
      ".conversation-list-tab-row",
      ".conversation-list-tab-button-box",
      ".sidebar-next button",
      ".sidebar-next a"
    ];
    const candidates = [];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (!visible(el)) continue;
        const text = (el.textContent || "").replace(/\s+/g, "");
        if (!text) continue;
        candidates.push({ el, text });
      }
    }
    const exact = candidates.find((c) => c.text === label);
    if (exact) { exact.el.click(); return true; }
    const prefixed = candidates.find((c) => c.text.startsWith(label));
    if (prefixed) { prefixed.el.click(); return true; }
    // 兜底：按可见文本全局查找
    const all = [...document.querySelectorAll("button, [role='button'], a, div, span")];
    const hit = all.find((el) => visible(el) && (el.textContent || "").replace(/\s+/g, "").startsWith(label));
    if (hit) { hit.click(); return true; }
    return false;
  }

  function openMessages() {
    const bell = document.querySelector(".msg-center-bell-btn");
    if (bell) { bell.click(); return true; }
    return clickNav("消息");
  }

  function openSearch() {
    const btn = [...document.querySelectorAll("button, [role='button']")].find((el) => {
      const label = (el.getAttribute("aria-label") || "") + " " + (typeof el.className === "string" ? el.className : "");
      return visible(el) && /搜索|search/i.test(label);
    });
    if (btn) { btn.click(); return true; }
    return false;
  }

  function clickByText(text) {
    const nodes = [...document.querySelectorAll("button, [role='button'], a, div, span")];
    const target = nodes.find((el) => {
      const label = (el.textContent || "").trim();
      if (label !== text) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (target) {
      target.click();
      return true;
    }
    return false;
  }

  function runAction(action) {
    if (action.startsWith("nav:")) {
      clickNav(action.slice(4));
      return;
    }
    switch (action) {
      case "messages":
        openMessages();
        break;
      case "search":
        openSearch();
        break;
      case "new-task":
        clickByText("新建任务");
        break;
      case "chat":
        focusComposer();
        break;
      case "toggle-skin":
        if (window.__QQ2008_SKIN__ && typeof window.__QQ2008_SKIN__.toggle === "function") {
          window.__QQ2008_SKIN__.toggle();
          setTimeout(syncSkin, 50);
        }
        break;
      default:
        break;
    }
  }

  function pickLocalized(value) {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      return value.zh || value.en || Object.values(value).find((entry) => typeof entry === "string") || "";
    }
    return "";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
    ));
  }

  function normalizeFriendExpert(item, online) {
    if (!item) return null;
    const name = pickLocalized(item.displayName) || pickLocalized(item.name) || item.profession || "";
    if (!name) return null;
    const id = item.marketExpertId || item.id || item.sourceId || name;
    const subtitle = pickLocalized(item.profession) || pickLocalized(item.description) || "WorkBuddy 专家";
    const expert = {
      id: `expert:${id}`,
      rawId: id,
      marketExpertId: item.marketExpertId || id,
      source: item.source || "builtin",
      expertType: item.expertType || "",
      categoryId: item.categoryId || "",
      canSummon: true,
      blockedReason: "",
      blockedLabel: "",
      name,
      subtitle,
      avatar: item.avatarUrl || item.avatar || "",
      kind: "expert",
      online
    };
    applyExpertGuard(expert);
    return expert;
  }

  function applyExpertGuard(expert, raw) {
    if (!expert) return;
    if (raw) {
      expert.expertType = raw.expertType || expert.expertType || "";
      expert.categoryId = raw.categoryId || expert.categoryId || "";
    }
    if (expert.expertType === "team") {
      expert.canSummon = false;
      expert.blockedReason = "团队专家请到专家中心召唤";
      expert.blockedLabel = "团队";
    } else if (expert.categoryId === "08-FinanceInvestment") {
      expert.canSummon = false;
      expert.blockedReason = "金融投资专家请到专家中心确认后召唤";
      expert.blockedLabel = "金融";
    } else {
      expert.canSummon = true;
      expert.blockedReason = "";
      expert.blockedLabel = "";
    }
  }

  function normalizeFriendSkill(item) {
    if (!item) return null;
    const name = pickLocalized(item.displayName) || item.name || "";
    if (!name) return null;
    const id = item.id || item.slug || item.canonicalName || name;
    const subtitle = pickLocalized(item.description_zh) || pickLocalized(item.description) || "已安装技能";
    return {
      id: `skill:${id}`,
      name,
      subtitle,
      avatar: item.iconUrl || "",
      kind: "skill"
    };
  }

  /* 单个分组最多渲染的行数：超出部分截断。
     dataset.rendered = 实际渲染行数（键盘/筛选以此为准，与 DOM 一致）；
     dataset.total = 数据源总行数（仅用于超限时显示「渲染数/总数」）。 */
  const FRIEND_RENDER_CAP = 200;

  /* 分组计数文案：无筛选时，超限显示 (渲染数/总数)，否则 (数量)；
     有筛选时显示 (可见数/渲染数)。 */
  function friendCountText(visible, rendered, total) {
    if (total > rendered) return `(${rendered}/${total})`;
    return `(${visible})`;
  }

  function renderFriendGroup(key, items, emptyText) {
    const list = root && root.querySelector(`.qq7-friend-list[data-list="${key}"]`);
    const count = root && root.querySelector(`.qq7-group-count[data-count="${key}"]`);
    if (!list) return;
    const rendered = Math.min(items.length, FRIEND_RENDER_CAP);
    list.dataset.total = String(items.length);
    list.dataset.rendered = String(rendered);
    const scrollTop = list.scrollTop;
    if (!items.length) {
      list.innerHTML = `<div class="qq7-friend-empty">${escapeHtml(emptyText)}</div>`;
      list.scrollTop = scrollTop;
      applyFriendFilter();
      return;
    }
    list.innerHTML = items.slice(0, FRIEND_RENDER_CAP).map((item, index) => {
      const avatar = item.avatar
        ? `<img src="${escapeHtml(item.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : "";
      const summon = item.kind === "expert" && item.canSummon
        ? `<button class="qq7-friend-summon" type="button" tabindex="-1" data-expert-id="${escapeHtml(item.rawId)}" data-expert-market="${escapeHtml(item.marketExpertId)}" data-expert-source="${escapeHtml(item.source)}" data-expert-name="${escapeHtml(item.name)}" aria-label="召唤${escapeHtml(item.name)}">召唤</button>`
        : "";
      const badge = item.blockedLabel
        ? `<span class="qq7-friend-row-badge" title="${escapeHtml(item.blockedReason)}">${escapeHtml(item.blockedLabel)}</span>`
        : "";
      const search = `${item.name} ${item.subtitle} ${item.blockedReason || ""}`;
      return `<div class="qq7-friend-row" id="qq7-friend-${escapeHtml(key)}-${index}" role="option" aria-selected="false" data-kind="${escapeHtml(item.kind)}" data-search="${escapeHtml(search)}" title="${escapeHtml(item.name + " · " + item.subtitle + (item.blockedReason ? " · " + item.blockedReason : ""))}">
        <span class="qq7-friend-row-avatar">${avatar}</span>
        <span class="qq7-friend-row-text"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.subtitle)}</small></span>
        ${badge}
        ${summon}
        <span class="qq7-friend-row-dot"></span>
      </div>`;
    }).join("");
    list.scrollTop = scrollTop;
    applyFriendFilter();
  }

  let friendRefreshSeq = 0;
  let lastFriendSignature = "";

  function setFriendActive(list, row) {
    if (!list) return;
    list.querySelectorAll(".qq7-friend-row").forEach((item) => {
      item.classList.remove("is-keyboard-active");
      item.setAttribute("aria-selected", "false");
    });
    if (!row) {
      list.removeAttribute("aria-activedescendant");
      return;
    }
    row.classList.add("is-keyboard-active");
    row.setAttribute("aria-selected", "true");
    if (row.id) list.setAttribute("aria-activedescendant", row.id);
  }

  function applyFriendFilter() {
    const input = root && root.querySelector("[data-friend-filter]");
    const query = (input && input.value ? input.value : "").trim().toLowerCase();
    if (!root) return;
    root.querySelectorAll(".qq7-friend-row").forEach((row) => {
      const haystack = (row.dataset.search || row.textContent || "").toLowerCase();
      row.hidden = !!query && !haystack.includes(query);
      if (row.hidden) row.classList.remove("is-keyboard-active");
    });
    root.querySelectorAll(".qq7-friend-list").forEach((list) => {
      const rows = [...list.querySelectorAll(".qq7-friend-row")];
      const visible = rows.filter((row) => !row.hidden);
      // rendered 与实际渲染行数一致；total 是数据源总数（超限截断时两者不同）
      const rendered = Number(list.dataset.rendered || rows.length);
      const total = Number(list.dataset.total || rendered);
      const count = root.querySelector(`.qq7-group-count[data-count="${list.dataset.list}"]`);
      if (count) count.textContent = query ? `(${visible.length}/${rendered})` : friendCountText(visible.length, rendered, total);
      if (document.activeElement !== list || !visible.length) return;
      const current = visible.find((row) => row.classList.contains("is-keyboard-active"));
      setFriendActive(list, current || visible[0]);
    });
  }

  function hasHomeDraft() {
    const editor = document.querySelector(".wb-home-route__input [contenteditable='true']");
    if (!editor) return false;
    const copy = editor.cloneNode(true);
    copy.querySelectorAll("[data-slate-placeholder='true']").forEach((node) => node.remove());
    if ((copy.textContent || "").replace(/\ufeff/g, "").trim()) return true;
    const inputRoot = document.querySelector(".wb-home-route__input");
    return !!(inputRoot && inputRoot.querySelector('img[src], video, audio, [data-slate-void="true"], [class*="attachment"], [class*="file-chip"], [class*="upload-item"], [contenteditable="false"]:not([data-slate-placeholder])'));
  }

  /* 好友列表：专家 = 最近使用 + 自定义/云同步 + 完整专家目录；技能 = 已安装技能 */
  async function refreshFriendData() {
    const seq = ++friendRefreshSeq;
    if (!root || !window.wb) return;
    const experts = new Map();
    const skills = new Map();
    const put = (map, item) => {
      if (item && !map.has(item.id)) map.set(item.id, item);
    };
    const readItems = (result) => (Array.isArray(result) ? result : result && Array.isArray(result.items) ? result.items : []);

    try {
      const recents = await window.wb.experts?.recents?.list?.();
      for (const item of readItems(recents)) put(experts, normalizeFriendExpert(item, true));
    } catch (error) {}
    try {
      const custom = await window.wb.experts?.custom?.list?.();
      for (const item of readItems(custom)) put(experts, normalizeFriendExpert(item, false));
      const cloud = await window.wb.experts?.cloudSync?.list?.({ includeHash: false });
      for (const item of readItems(cloud)) put(experts, normalizeFriendExpert(item, false));
    } catch (error) {}
    try {
      const catalog = await window.wb.experts?.list?.();
      const catalogById = new Map();
      for (const item of readItems(catalog)) {
        const friend = normalizeFriendExpert(item, false);
        if (!friend) continue;
        catalogById.set(friend.rawId, item);
        catalogById.set(friend.marketExpertId, item);
        put(experts, friend);
      }
      for (const friend of experts.values()) {
        const raw = catalogById.get(friend.rawId) || catalogById.get(friend.marketExpertId);
        if (raw) applyExpertGuard(friend, raw);
      }
    } catch (error) {}
    try {
      const installed = await window.wb.skills?.installed?.();
      for (const item of readItems(installed)) put(skills, normalizeFriendSkill(item));
    } catch (error) {}
    if (!skills.size) {
      try {
        const cached = JSON.parse(localStorage.getItem("skills-cache-installed") || "[]");
        for (const item of Array.isArray(cached) ? cached : []) put(skills, normalizeFriendSkill(item));
      } catch (error) {}
    }
    if (seq !== friendRefreshSeq) return;
    // 签名必须覆盖影响渲染的字段：id 之外还有 canSummon / blockedLabel——
    // 否则 catalog 迟到时（如 recents 先渲染了团队专家的召唤按钮），
    // guard 数据更新但签名不变，列表不会重渲染，禁召唤标记不会出现。
    const signature = [...experts.values()].map((e) => `${e.id}:${e.canSummon ? 1 : 0}:${e.blockedLabel || ""}`).join("|")
      + "::" + [...skills.keys()].join("|");
    if (signature === lastFriendSignature) return;
    lastFriendSignature = signature;
    renderFriendGroup("expert", [...experts.values()], "暂无 WorkBuddy 专家");
    renderFriendGroup("skill", [...skills.values()], "暂无已安装的 WorkBuddy 技能");
  }

  async function summonFriendExpert(button) {
    if (!window.wb?.experts || !window.wb?.conversations) return;
    if (button.dataset.summoning === "1") return;
    button.dataset.summoning = "1";
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "召唤中…";
    try {
      const expertId = button.dataset.expertId;
      const marketExpertId = button.dataset.expertMarket || expertId;
      const source = button.dataset.expertSource || "builtin";
      const result = await window.wb.experts.summon({
        expertId,
        marketExpertId,
        source,
        locale: "zh-CN"
      });
      const expert = result && result.expert;
      if (!expert) throw new Error("expert unavailable");
      const selection = {
        id: expert.id,
        name: expert.name,
        profession: expert.profession,
        avatarUrl: expert.avatarUrl,
        prompt: expert.prompt || "",
        defaultInitPrompt: expert.defaultInitPrompt || "",
        pluginName: expert.pluginName,
        marketExpertId: expert.marketExpertId,
        updatedAt: expert.updatedAt,
        version: expert.version,
        expertType: expert.expertType,
        agentName: expert.agentName,
        localPath: expert.localPath,
        marketplace: expert.marketplace,
        locale: "zh-CN",
        summonedAt: Date.now()
      };
      const draft = hasHomeDraft();
      const payload = { target: { type: "new" }, expert: selection };
      if (draft) {
        // 保留用户当前草稿，只切换专家
        payload.contentBlocks = [];
        payload.preserveBlocks = true;
      } else {
        payload.contentBlocks = expert.defaultInitPrompt ? [{ type: "text", text: expert.defaultInitPrompt }] : [];
      }
      await window.wb.conversations.prepareInput(payload);
      if (window.wb.navigation?.goto) window.wb.navigation.goto("/");
      // 成功路径也要复位按钮：refreshFriendData 在列表签名未变时不重建 DOM，
      // 不主动恢复的话按钮会永久停在「召唤中…」并保持 disabled。
      resetSummonButton(button, original, "召唤成功", 600);
      window.setTimeout(refreshFriendData, 800);
    } catch (error) {
      console.warn("[QQ7] summon expert failed", error);
      resetSummonButton(button, original, "召唤失败", 1200);
    }
  }

  /* 把召唤按钮从「召唤中…」恢复为可用：先短暂显示结果文案，再复位；
     按钮若已被列表重建替换（脱离文档）则直接跳过，不影响新按钮。 */
  function resetSummonButton(button, original, doneText, delay) {
    if (!button.isConnected) return;
    button.textContent = doneText;
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.disabled = false;
      button.textContent = original;
      delete button.dataset.summoning;
    }, delay);
  }

  function friendPanelHtml() {
    const name = displayName();
    return `
      <div class="qq7-friend-head">
        <span class="qq7-friend-tab is-active" data-tab="friends">WorkBuddy 好友</span>
        <span class="qq7-friend-tab" data-tab="info">环境信息</span>
        <span class="qq7-friend-collapse" title="收起好友面板">◀</span>
      </div>
      <div class="qq7-friend-body" data-body="friends">
        <div class="qq7-friend-card">
          <div class="qq7-friend-avatar" title="Codex 小蓝 · WorkBuddy 版"></div>
          <div class="qq7-friend-info">
            <div class="qq7-friend-name">WorkBuddy 小蓝 <span class="qq7-friend-lv">LV07</span></div>
            <div class="qq7-friend-sign">代码有问题？找我！</div>
            <div class="qq7-friend-status">${icon(12)} 在线 · 随时为你服务</div>
          </div>
        </div>
        <div class="qq7-friend-tools">
          ${TOOLS.map((t) => `<div class="qq7-friend-tool" data-action="${t.action}" title="${t.label}">${icon(t.icon)}<span>${t.label}</span></div>`).join("")}
        </div>
        <div class="qq7-friend-filter"><input type="search" placeholder="筛选专家 / 技能…" data-friend-filter aria-label="筛选专家或技能"></div>
        <div class="qq7-group" data-group="expert">
          <div class="qq7-group-title"><span class="qq7-caret">▼</span>专家 <span class="qq7-group-count" data-count="expert">(0)</span></div>
          <div class="qq7-friend-list" data-list="expert" tabindex="0" role="listbox" aria-label="专家列表：上下方向键选择，回车召唤">
            <div class="qq7-friend-empty">正在读取 WorkBuddy 专家…</div>
          </div>
        </div>
        <div class="qq7-group" data-group="skill">
          <div class="qq7-group-title"><span class="qq7-caret">▼</span>技能 <span class="qq7-group-count" data-count="skill">(0)</span></div>
          <div class="qq7-friend-list" data-list="skill" tabindex="0" role="listbox" aria-label="技能列表">
            <div class="qq7-friend-empty">正在读取 WorkBuddy 技能…</div>
          </div>
        </div>
        <div class="qq7-qqshow">
          <div class="qq7-qqshow-title">QQ 秀 <small>主题可替换</small></div>
          <div class="qq7-qqshow-img"></div>
        </div>
      </div>
      <div class="qq7-friend-body" data-body="info" hidden>
        <div class="qq7-group">
          <div class="qq7-group-title"><span class="qq7-caret">▼</span>环境信息</div>
          <div class="qq7-info-row"><span>客户端</span><b>WorkBuddy 5.8.3</b></div>
          <div class="qq7-info-row"><span>皮肤</span><b>QQ 2007 (深度仿制)</b></div>
          <div class="qq7-info-row"><span>账号</span><b class="qq7-account-name">${escapeHtml(name)}</b></div>
          <div class="qq7-info-row"><span>状态</span><b>在线</b></div>
        </div>
        <div class="qq7-group">
          <div class="qq7-group-title"><span class="qq7-caret">▼</span>关于</div>
          <div class="qq7-info-row"><span>主题来源</span><b>Codex-QQ-2007</b></div>
          <div class="qq7-info-row"><span>适配</span><b>WorkBuddy 5.8.3</b></div>
        </div>
      </div>
      <div class="qq7-friend-search" title="打开 WorkBuddy 搜索">${icon(11)}<span>查找好友...</span></div>
    `;
  }

  /* macOS 主窗口是 titleBarStyle: hiddenInset，系统标题栏只覆盖顶部约 38px：
     这段保留原生 -webkit-app-region: drag，拖动和双击缩放都由 macOS 处理，最顺滑。
     标题栏下沿（.qq7-titlebar-jszone）和菜单栏收不到系统双击，由这里接管：
     空白处拖动走 startDrag / stopDrag，双击调 maximize（WorkBuddy 内部即
     zoom / unzoom 切换），菜单项保持点击。拖动超过 4px 才真正开始；窗口最大化
     时先还原、等 isMaximized 真正变 false 再拖（拖拽控制器在最大化时会 no-op）。 */
  function setupWindowChrome() {
    if (!/^Mac/.test(navigator.platform || "")) return;
    const desktopWindow = window.workbuddyDesktop?.window?.getCurrentWindow?.();
    if (!desktopWindow || typeof desktopWindow.startDrag !== "function" || typeof desktopWindow.maximize !== "function") return;

    document.body.classList.add("qq7-js-window-chrome");

    const INTERACTIVE = ".qq7-menu-item, .qq7-colorbtn, .qq7-title-btns, .qq7-friend, .qq7-statusbar, button, a, input, textarea, select, [contenteditable='true']";
    const isInteractive = (target) => target instanceof Element && Boolean(target.closest(INTERACTIVE));
    const swallow = (promise) => { if (promise && typeof promise.catch === "function") promise.catch(() => {}); };

    let pointerDown = false;
    let pending = null;
    let dragging = false;
    let restoreTimer = 0;
    let zoomHandled = false;

    const beginDrag = () => {
      if (!pointerDown || dragging) return;
      dragging = true;
      swallow(desktopWindow.startDrag());
    };
    const endDrag = () => {
      pointerDown = false;
      pending = null;
      if (restoreTimer) { window.clearTimeout(restoreTimer); restoreTimer = 0; }
      if (!dragging) return;
      dragging = false;
      if (typeof desktopWindow.stopDrag === "function") swallow(desktopWindow.stopDrag());
    };
    // 双击缩放在第二次按下时立即触发（系统标题栏也是这样），比等 dblclick 更跟手
    const triggerZoom = () => {
      zoomHandled = true;
      endDrag();
      swallow(desktopWindow.maximize());
    };
    const onMouseDown = (event) => {
      if (event.button !== 0 || isInteractive(event.target)) return;
      if (event.detail === 2) {
        event.preventDefault();
        triggerZoom();
        return;
      }
      if (event.detail > 2) return;
      zoomHandled = false;
      pointerDown = true;
      pending = { x: event.clientX, y: event.clientY };
    };
    const onPointerMove = (event) => {
      if (!pending || dragging || !pointerDown) return;
      if (Math.abs(event.clientX - pending.x) < 4 && Math.abs(event.clientY - pending.y) < 4) return;
      pending = null;
      const maximized = typeof desktopWindow.isMaximized === "function" ? desktopWindow.isMaximized() : false;
      Promise.resolve(maximized).then((max) => {
        if (!pointerDown) return;
        if (!max) { beginDrag(); return; }
        // 先还原窗口，轮询到真正非最大化后再开始拖（固定 160ms 在慢机器上会失败）
        swallow(desktopWindow.maximize());
        const deadline = performance.now() + 1200;
        const waitNormal = () => {
          if (!pointerDown) return;
          const check = typeof desktopWindow.isMaximized === "function" ? desktopWindow.isMaximized() : false;
          Promise.resolve(check).then((stillMax) => {
            if (!pointerDown) return;
            if (!stillMax || performance.now() > deadline) { beginDrag(); return; }
            restoreTimer = window.setTimeout(() => { restoreTimer = 0; waitNormal(); }, 60);
          }).catch(() => beginDrag());
        };
        restoreTimer = window.setTimeout(() => { restoreTimer = 0; waitNormal(); }, 60);
      }).catch(() => beginDrag());
    };
    const onDoubleClick = (event) => {
      if (isInteractive(event.target)) return;
      if (zoomHandled) { zoomHandled = false; return; }
      event.preventDefault();
      triggerZoom();
    };

    for (const selector of [".qq7-titlebar-jszone", ".qq7-menubar"]) {
      const el = root.querySelector(selector);
      if (!el) continue;
      el.addEventListener("mousedown", onMouseDown);
      el.addEventListener("dblclick", onDoubleClick);
    }
    // 指针可能移出热区（甚至进入原生 drag 区），尽量在 window 上收 move
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", endDrag);
  }

  function buildChrome() {
    try {
      state.collapsed = localStorage.getItem("qq7-friend-collapsed") === "1";
    } catch (error) {}
    root = document.createElement("div");
    root.id = "qq7-root";
    root.innerHTML = `
      <div class="qq7-frame"></div>
      <div class="qq7-titlebar">
        <span class="qq7-title-ico"></span>
        <span class="qq7-title-text">WorkBuddy 2007</span>
        <div class="qq7-titlebar-jszone"></div>
      </div>
      <div class="qq7-menubar">
        ${MENU.map((m) => `<span class="qq7-menu-item" data-action="${m.action}">${icon(m.icon)}<span>${m.label}</span></span>`).join("")}
        <span class="qq7-colorbtn" role="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" title="更换皮肤配色" aria-label="更换皮肤配色"><i></i></span>
      </div>
      <div class="qq7-friend" id="qq7-friend-panel">${friendPanelHtml()}</div>
      <div class="qq7-statusbar">
        <span class="qq7-status-left">
          ${icon(12)}
          <b class="qq7-account-name">${escapeHtml(displayName())}</b> LV07
          <span>在线</span>
          <span class="qq7-status-quote">别迷恋姐，姐只是个传说。</span>
        </span>
        <span class="qq7-status-right">
          <span class="qq7-status-cell">${icon(13)} 安全</span>
          <span class="qq7-status-cell">本机</span>
        </span>
      </div>
    `;
    document.body.appendChild(root);
    titleEl = root.querySelector(".qq7-title-text");

    // QQ2007 主面板右上角「颜色编辑」按钮：恢复已保存的配色并挂上色板菜单
    const colorBtn = root.querySelector(".qq7-colorbtn");
    if (colorBtn) {
      applyTheme();
      wireColorButton(colorBtn);
    }

    // 菜单
    root.querySelectorAll(".qq7-menu-item").forEach((el) => {
      el.addEventListener("click", () => runAction(el.dataset.action));
    });

    // 好友工具 / 搜索 / 好友行
    root.querySelectorAll(".qq7-friend-tool").forEach((el) => {
      el.addEventListener("click", () => runAction(el.dataset.action || ""));
    });
    const searchBox = root.querySelector(".qq7-friend-search");
    if (searchBox) searchBox.addEventListener("click", () => { if (!openSearch()) searchBox.classList.add("is-miss"); });
    const buddyRow = root.querySelector(".qq7-buddy");
    if (buddyRow) {
      buddyRow.addEventListener("click", () => {
        const card = [...document.querySelectorAll(".conversation-agent-card")].find(visible);
        if (card) card.click();
      });
    }

    // 好友面板 tab / 收起
    root.querySelectorAll(".qq7-friend-tab").forEach((el) => {
      el.addEventListener("click", () => {
        state.tab = el.dataset.tab;
        root.querySelectorAll(".qq7-friend-tab").forEach((t) => t.classList.toggle("is-active", t === el));
        root.querySelectorAll(".qq7-friend-body").forEach((body) => {
          body.hidden = body.dataset.body !== state.tab;
        });
        if (state.tab === "friends") refreshFriendData();
      });
    });
    root.addEventListener("click", (event) => {
      const button = event.target.closest && event.target.closest(".qq7-friend-summon");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      summonFriendExpert(button);
    });

    root.querySelector("[data-friend-filter]")?.addEventListener("input", applyFriendFilter);

    root.addEventListener("focus", (event) => {
      const list = event.target.closest && event.target.closest(".qq7-friend-list");
      if (!list || event.target !== list) return;
      const rows = [...list.querySelectorAll(".qq7-friend-row")].filter((row) => !row.hidden);
      if (!rows.length) return;
      setFriendActive(list, rows[0]);
    }, true);

    root.addEventListener("keydown", (event) => {
      const list = event.target.closest && event.target.closest(".qq7-friend-list");
      if (!list) return;
      // 与 applyFriendFilter 同口径：用 row.hidden 判断可见性，
      // 避免 offsetParent 在 position:fixed 等布局下返回 null 造成误判。
      const rows = [...list.querySelectorAll(".qq7-friend-row")].filter((row) => !row.hidden);
      if (!rows.length) return;
      let active = rows.findIndex((row) => row.classList.contains("is-keyboard-active"));
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (active < 0) active = 0;
        else active = Math.max(0, Math.min(rows.length - 1, active + (event.key === "ArrowDown" ? 1 : -1)));
        setFriendActive(list, rows[active]);
        rows[active].scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter") {
        if (active < 0) active = 0;
        const summon = rows[active] && rows[active].querySelector(".qq7-friend-summon");
        // 无论该行是否可召唤都阻止默认/冒泡：技能行按 Enter 不应再触发
        // App 的全局快捷键（事件会从 list 冒泡到 document）。
        event.preventDefault();
        event.stopPropagation();
        if (summon) summonFriendExpert(summon);
      } else if (event.key === "Escape") {
        list.blur();
      }
    }, true);

    const collapse = root.querySelector(".qq7-friend-collapse");
    if (collapse) {
      const syncCollapseButton = () => {
        document.body.classList.toggle("qq7-friend-collapsed", state.collapsed);
        collapse.textContent = state.collapsed ? "▶" : "◀";
        collapse.title = state.collapsed ? "展开好友面板" : "收起好友面板";
        collapse.setAttribute("aria-label", collapse.title);
        collapse.setAttribute("aria-expanded", String(!state.collapsed));
      };
      const toggleCollapse = () => {
        state.collapsed = !state.collapsed;
        syncCollapseButton();
        try {
          localStorage.setItem("qq7-friend-collapsed", state.collapsed ? "1" : "0");
        } catch (error) {}
      };
      collapse.setAttribute("role", "button");
      collapse.setAttribute("tabindex", "0");
      collapse.setAttribute("aria-controls", "qq7-friend-panel");
      syncCollapseButton();
      collapse.addEventListener("click", toggleCollapse);
      collapse.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleCollapse();
      });
    }

    refreshTitle();
    syncSkin();
    watchLayout();
    beginDragTracking();
    setupWindowChrome();
    watchAccountName();
    refreshFriendData();
    // App 的专家 / 技能服务可能比主题注入晚就绪，前几秒补几次刷新
    for (const delay of [1500, 4000, 8000]) window.setTimeout(refreshFriendData, delay);
    window.setInterval(refreshFriendData, 30000);
  }

  let dragActive = false;

  /* 拖动分隔条时直接按鼠标位置实时更新变量，不依赖 React 的重渲染节奏 */
  function beginDragTracking() {
    const applyFromClientX = (clientX) => {
      const container = document.querySelector(".teams-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      // 与 WorkBuddy 自身限制保持一致：侧栏最大约窗口宽度的 20%
      const max = Math.max(220, Math.round(window.innerWidth * 0.2));
      const sw = Math.max(190, Math.min(max, Math.round(clientX - rect.left)));
      const rootStyle = document.documentElement.style;
      rootStyle.setProperty("--qq7-side", sw + "px");
      rootStyle.setProperty("--qq7-main-w", Math.max(0, Math.round(rect.width) - sw) + "px");
    };

    const onDown = (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      if (!target.closest('[class*="sash"]')) return;
      dragActive = true;
      applyFromClientX(event.clientX);
    };
    const onMove = (event) => {
      if (!dragActive) return;
      applyFromClientX(event.clientX);
    };
    const onUp = () => {
      if (!dragActive) return;
      dragActive = false;
      window.setTimeout(syncLayout, 80);
    };

    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, { capture: true, passive: true });
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("mousemove", onMove, { capture: true, passive: true });
    window.addEventListener("mouseup", onUp, true);
    window.addEventListener("blur", onUp);
  }

  /* 跟随 WorkBuddy 自身的分栏拖拽：读取 sidebar 的内联宽度，换算中间栏宽度 */
  function syncLayout() {
    if (dragActive) return;
    if (!document.body.classList.contains("qq7-shell")) return;
    const container = document.querySelector(".teams-container");
    const sidebar = document.querySelector('[data-view-id="sidebar"]');
    const main = document.querySelector('[data-view-id="main-content"]');
    if (!container || !sidebar || !main) return;
    const cw = Math.round(container.getBoundingClientRect().width);
    if (!cw) return;
    const rawInline = sidebar.style.width;
    const inline = parseFloat(rawInline);
    let sw;
    if (rawInline && Number.isFinite(inline)) {
      sw = Math.max(0, Math.round(inline));
    } else {
      sw = Math.round(sidebar.getBoundingClientRect().width);
    }
    if (sw > cw * 0.8) return;

    const detail = document.querySelector('[data-view-id="detail-panel"]');
    const sources = document.querySelector('[data-view-id="sources-panel"]');
    const inlineWidth = (el) => {
      if (!el) return 0;
      const value = parseFloat(el.style.width);
      if (Number.isFinite(value)) return Math.max(0, value);
      return Math.max(0, el.getBoundingClientRect().width);
    };
    const detailWidth = inlineWidth(detail);
    const sourcesWidth = inlineWidth(sources);
    const panelOpen = detailWidth > 40 || sourcesWidth > 40;
    document.body.classList.toggle("qq7-panel-open", panelOpen);

    const mainInline = main ? parseFloat(main.style.width) : NaN;
    const mainWidth = panelOpen && Number.isFinite(mainInline)
      ? Math.round(mainInline)
      : Math.max(0, cw - sw);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--qq7-side", sw + "px");
    rootStyle.setProperty("--qq7-main-w", mainWidth + "px");
    rootStyle.setProperty("--qq7-detail-w", Math.round(detailWidth) + "px");
    rootStyle.setProperty("--qq7-sources-w", Math.round(sourcesWidth) + "px");
  }

  let layoutQueued = false;

  /* 窗口缩放 / 最大化会连续触发 resize 与 ResizeObserver，
     合并到下一帧执行，减少布局读写抖动 */
  function queueSyncLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    window.requestAnimationFrame(() => {
      layoutQueued = false;
      syncLayout();
    });
  }

  function watchLayout() {
    const sidebar = document.querySelector('[data-view-id="sidebar"]');
    const main = document.querySelector('[data-view-id="main-content"]');
    const container = document.querySelector(".teams-container");
    const mo = new MutationObserver(queueSyncLayout);
    if (sidebar) mo.observe(sidebar, { attributes: true, attributeFilter: ["style"] });
    if (main) mo.observe(main, { attributes: true, attributeFilter: ["style"] });
    if (container && typeof ResizeObserver === "function") {
      new ResizeObserver(queueSyncLayout).observe(container);
    }
    if (sidebar && typeof ResizeObserver === "function") {
      new ResizeObserver(queueSyncLayout).observe(sidebar);
    }
    window.addEventListener("resize", queueSyncLayout);
    window.setInterval(syncLayout, 500);
    syncLayout();
  }

  /* ---------- QQ 宠物：会跑的企鹅 ---------- */
  function initPet() {
    const PET_SELECTOR = ".conversation-input__growth-buddy, .wb-home-route__growth-buddy";
    const PLAY_CLASSES = ["qq7-pet-hop", "qq7-pet-wiggle", "qq7-pet-spin"];
    let pet = null;
    let playingTimer = 0;
    let peekTimer = 0;
    let runTimer = 0;
    let lastTitle = "";
    let drift = 0;

    function isVisible(el) {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }


    const PET_ACTION_FILES = {
      idle: ["Stand.swf", "Stand-happy.swf", "Stand-peaceful.swf"],
      play: ["P1.swf", "P2.swf", "P5.swf", "P13.swf", "P17.swf", "P22.swf", "P27.swf"],
      speak: ["Speak.swf", "Speak-peaceful.swf"],
      touch: ["H1.swf", "H2.swf", "H3.swf", "LF1.swf", "BE1.swf", "BE2.swf", "BE3.swf"],
    };
    let ruffleLoading = null;
    let rufflePlayer = null;
    let actionTimer = 0;
    let warmHost = null;

    function pickAction(kind) {
      const list = PET_ACTION_FILES[kind];
      if (!list) return PET_ACTION_FILES.idle[0];
      if (typeof list === "string") return list;
      return list[Math.floor(Math.random() * list.length)];
    }

    function petAssetBase() {
      try {
        const src = document.currentScript && document.currentScript.src;
        if (src) return new URL("./qq7pet/", src).href;
      } catch (error) {}
      return "file:///Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/renderer/assets/qq7pet/";
    }

    let petBootAt = 0;

    function preloadPetAssets() {
      try {
        const base = petAssetBase();
        const add = (href, as) => {
          const link = document.createElement("link");
          link.rel = "preload";
          link.as = as;
          link.href = href;
          document.head.appendChild(link);
        };
        add(base + "ruffle.js", "script");
        add(base + "172de42e6619eac8f371.wasm", "fetch");
      } catch (error) {}
    }

    function loadRuffle() {
      if (ruffleLoading) return ruffleLoading;
      petBootAt = petBootAt || performance.now();
      try { const t = window.__qq7Timing || (window.__qq7Timing = {}); t.ruffleStart = Math.round(petBootAt); localStorage.setItem("qq7pet-timings", JSON.stringify(t)); } catch (e) {}
      try { localStorage.setItem("qq7pet-boot-start", String(Math.round(petBootAt))); } catch (error) {}
      const base = petAssetBase();
      ruffleLoading = new Promise((resolve, reject) => {
        const boot = async () => {
          try {
            if (!window.RufflePlayer) {
              window.RufflePlayer = window.RufflePlayer || {};
              Object.assign(window.RufflePlayer, {
                config: {
                  publicPath: base,
                  wmode: "transparent",
                  backgroundColor: null,
                  autoplay: "on",
                  unmuteOverlay: "hidden",
                  splashScreen: false,
                  letterbox: "on",
                  scale: "showAll",
                  quality: "low",
                  logLevel: "error",
                  openUrlMode: "deny",
                  allowScriptAccess: false,
                },
              });
              await new Promise((res, rej) => {
                const script = document.createElement("script");
                script.src = base + "ruffle.js";
                script.onload = res;
                script.onerror = () => rej(new Error("ruffle.js load failed"));
                document.head.appendChild(script);
              });
            }
            const ruffle = window.RufflePlayer.newest();
            if (!ruffle) throw new Error("no ruffle factory");
            // 用一个离屏的临时播放器提前编译 wasm / 初始化内核；
            // 正式播放器等宠物元素出现后创建在可见舞台里（移动 ruffle-player 会丢渲染，不能复用）。
            const warm = ruffle.createPlayer();
            warm.style.width = "100%";
            warm.style.height = "100%";
            warm.style.background = "transparent";
            warm.style.pointerEvents = "none";
            warmHost = document.createElement("div");
            warmHost.style.cssText = "position:fixed;left:-9999px;top:0;width:244px;height:244px;opacity:.01;pointer-events:none;";
            warmHost.appendChild(warm);
            document.body.appendChild(warmHost);
            await warm.load({ url: base + pickAction("idle") });
            try { warm.volume = 0; } catch (error) {}
            try { if (typeof warm.setVolume === "function") warm.setVolume(0); } catch (error) {}
            try { warm.remove(); } catch (error) {}
            if (warmHost && warmHost.isConnected) warmHost.remove();
            warmHost = null;
            const bootMs = Math.round(performance.now() - petBootAt);
            try { const t = window.__qq7Timing || (window.__qq7Timing = {}); t.ruffleReady = Math.round(performance.now()); localStorage.setItem("qq7pet-timings", JSON.stringify(t)); } catch (e) {}
            console.info("[QQ7 pet] Ruffle ready in " + bootMs + "ms");
            try {
              localStorage.setItem("qq7pet-boot-ms", String(bootMs));
              localStorage.setItem("qq7pet-boot-at", String(Date.now()));
            } catch (error) {}
            resolve(true);
          } catch (error) {
            reject(error);
          }
        };
        boot();
      }).catch((error) => {
        console.warn("[QQ 2007 pet] Ruffle 初始化失败，回退静态图", error);
        return null;
      });
      return ruffleLoading;
    }

    function ensurePuppet(el) {
      if (!el || el.querySelector(".qq7-pet-stage")) return;
      const stage = document.createElement("div");
      stage.className = "qq7-pet-stage";
      stage.style.display = "none";
      el.appendChild(stage);
      document.body.classList.add("qq7-pet-loading");
      loadRuffle().then(async (ready) => {
        if (!ready || !stage.isConnected) {
          document.body.classList.remove("qq7-pet-loading");
          return;
        }
        try {
          const base = petAssetBase();
          const ruffle = window.RufflePlayer.newest();
          const player = ruffle.createPlayer();
          player.style.width = "100%";
          player.style.height = "100%";
          player.style.background = "transparent";
          player.style.pointerEvents = "none";
          stage.appendChild(player);
          await player.load({ url: base + pickAction("idle") });
          try { player.volume = 0; } catch (error) {}
          try { if (typeof player.setVolume === "function") player.setVolume(0); } catch (error) {}
          rufflePlayer = player;
          stage.dataset.ready = "1";
        } catch (error) {
          console.warn("[QQ 2007 pet] 舞台播放器创建失败", error);
        }
        document.body.classList.remove("qq7-pet-loading");
      });
    }

    function playSwf(kind, duration) {
      if (!rufflePlayer) return false;
      const base = petAssetBase();
      const file = pickAction(kind);
      window.clearTimeout(actionTimer);
      try {
        rufflePlayer.load({ url: base + file });
      } catch (error) { return false; }
      if (duration) {
        actionTimer = window.setTimeout(() => {
          try { rufflePlayer.load({ url: base + pickAction("idle") }); } catch (error) {}
        }, duration);
      }
      return true;
    }

    let signEl = null;
    let signTick = 0;
    let manualUntil = 0;

    function ensureSign() {
      if (signEl && signEl.isConnected) return signEl;
      const host = document.getElementById("qq7-root") || document.body;
      signEl = document.createElement("div");
      signEl.className = "qq7-pet-sign";
      signEl.innerHTML =
        '<div class="qq7-pet-sign-board">' +
        '<div class="qq7-pet-sign-title">选一个吧</div>' +
        '<div class="qq7-pet-sign-list"></div>' +
        "</div>" +
        '<div class="qq7-pet-sign-stick"></div>';
      host.appendChild(signEl);
      return signEl;
    }

    function placeSign() {
      if (!signEl || signEl.dataset.show !== "1" || !pet) return;
      const rect = pet.getBoundingClientRect();
      if (!rect.width) { signEl.dataset.show = "0"; return; }
      const width = signEl.offsetWidth || 120;
      const height = signEl.offsetHeight || 90;
      const left = Math.max(6, Math.min(window.innerWidth - width - 8, rect.left - width + 46));
      const top = Math.max(6, rect.top - height - 8);
      signEl.style.left = Math.round(left) + "px";
      signEl.style.top = Math.round(top) + "px";
    }

    function showSign(show) {
      const el = ensureSign();
      el.dataset.show = show ? "1" : "0";
      if (show) {
        placeSign();
        window.clearInterval(signTick);
        signTick = window.setInterval(placeSign, 120);
      } else {
        window.clearInterval(signTick);
      }
    }

    function ensurePet() {
      const el = [...document.querySelectorAll(PET_SELECTOR)].find(isVisible) || null;
      if (el) { try { const t = window.__qq7Timing || (window.__qq7Timing = {}); t.petFound = Math.round(performance.now()); localStorage.setItem("qq7pet-timings", JSON.stringify(t)); } catch (e) {} }
      if (el && el !== pet) {
        pet = el;
        ensurePuppet(pet);
        ensureSign();
        pet.style.setProperty("--qq7-pet-drift", drift + "px");
      }
      return pet;
    }

    function setDrift(next) {
      drift = Math.max(-46, Math.min(46, next));
      if (pet) pet.style.setProperty("--qq7-pet-drift", drift + "px");
    }

    function run() {
      const el = ensurePet();
      if (!el) return;
      el.classList.remove("qq7-pet-run");
      void el.offsetWidth;
      const host = el.closest(".conversation-input-area") ||
        el.closest(".conversation-page-chrome") ||
        el.parentElement;
      const width = host ? host.getBoundingClientRect().width : Math.max(420, window.innerWidth * 0.5);
      el.style.setProperty("--qq7-run-from", (-Math.max(240, Math.round(width - 180))) + "px");
      el.classList.remove(...PLAY_CLASSES);
      el.classList.add("qq7-pet-run");
      window.clearTimeout(runTimer);
      runTimer = window.setTimeout(() => {
        if (pet) pet.classList.remove("qq7-pet-run");
      }, 1650);
    }

    function peek() {
      const el = ensurePet();
      if (!el) return;
      el.classList.add("qq7-pet-peek");
      window.clearTimeout(peekTimer);
      peekTimer = window.setTimeout(() => {
        if (pet) pet.classList.remove("qq7-pet-peek");
      }, 1300);
    }

    function play() {
      const el = ensurePet();
      if (!el || el.classList.contains("qq7-pet-run") || el.classList.contains("qq7-pet-peek")) return;
      const cls = PLAY_CLASSES[Math.floor(Math.random() * PLAY_CLASSES.length)];
      el.classList.remove(...PLAY_CLASSES);
      void el.offsetWidth;
      el.classList.add(cls);
      window.setTimeout(() => {
        if (pet) pet.classList.remove(cls);
      }, 1900);
      if (Math.random() < 0.5) setDrift(drift + (Math.random() < 0.5 ? -18 : 18));
    }

    function showHeart() {
      const el = ensurePet();
      if (!el) return;
      const host = document.getElementById("qq7-root") || document.body;
      const heart = document.createElement("span");
      heart.className = "qq7-pet-heart";
      heart.textContent = "❤";
      const rect = el.getBoundingClientRect();
      heart.style.left = Math.round(rect.left + rect.width * 0.62) + "px";
      heart.style.top = Math.round(rect.top + rect.height * 0.08) + "px";
      host.appendChild(heart);
      window.setTimeout(() => heart.remove(), 1200);
    }

    function clickPet() {
      const el = ensurePet();
      if (!el) return;
      el.classList.remove("qq7-pet-bounce");
      void el.offsetWidth;
      el.classList.add("qq7-pet-bounce");
      window.setTimeout(() => {
        if (pet) pet.classList.remove("qq7-pet-bounce");
      }, 700);
      showHeart();
      playSwf("touch", 3000);
    }

    function schedulePlay() {
      window.clearTimeout(playingTimer);
      playingTimer = window.setTimeout(() => {
        play();
        if (Math.random() < 0.7) playSwf("play", 4200);
        schedulePlay();
      }, 8000 + Math.random() * 8000);
    }

    function detectOptions() {
      const list = document.querySelector(".cr-message-list");
      if (!list) return [];
      const buttons = [...list.querySelectorAll("button, [role='button'], [class*='option-item'], [class*='choice-item']")]
        .filter((button) => {
          if (!isVisible(button)) return false;
          const text = (button.innerText || "").replace(/\s+/g, " ").trim();
          if (!text || text.length > 60) return false;
          if (button.querySelector("svg") && text.length <= 2) return false;
          if (button.closest("[class*='toolbar'], [class*='Toolbar'], [class*='actions'], [class*='Actions']")) return false;
          const cls = String(button.className || "");
          if (/copy|like|dislike|share|retry|regenerate|feedback/i.test(cls)) return false;
          return true;
        });
      const groups = new Map();
      for (const button of buttons) {
        const parent = button.parentElement;
        if (!parent) continue;
        if (!groups.has(parent)) groups.set(parent, []);
        groups.get(parent).push(button);
      }
      let best = null;
      for (const [, group] of groups) {
        if (group.length < 2) continue;
        const rect = group[0].parentElement.getBoundingClientRect();
        if (!best || rect.top > best.top) best = { top: rect.top, group };
      }
      return best ? best.group.slice(0, 4) : [];
    }

    function refreshOptions() {
      const el = ensurePet();
      if (!el || !document.body.classList.contains("qq7-shell")) return;
      const options = detectOptions();
      const sign = ensureSign();
      const listNode = sign.querySelector(".qq7-pet-sign-list");
      if (!listNode) return;
      if (options.length) {
        listNode.innerHTML = "";
        options.forEach((button, index) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "qq7-pet-sign-item";
          item.textContent = (index + 1) + ". " + (button.innerText || "").replace(/\s+/g, " ").trim().slice(0, 22);
          item.addEventListener("click", (event) => {
            event.stopPropagation();
            try { button.click(); } catch (error) {}
          });
          listNode.appendChild(item);
        });
        el.classList.add("qq7-pet-has-options");
        showSign(true);
        playSwf("speak", 6000);
      } else if (Date.now() > manualUntil) {
        el.classList.remove("qq7-pet-has-options");
        showSign(false);
      }
    }

    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest(".conversation-input-area, .cr-input-container, .cr-input, .conversation-input__composer")) {
        peek();
      } else if (target.getAttribute && target.getAttribute("contenteditable") === "true") {
        peek();
      }
    }, true);

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      if (event.key.length === 1 || event.key === "Backspace" || event.key === "Enter") {
        if (target.closest(".conversation-input-area, .cr-input-container, .cr-input")) peek();
      }
    }, true);

    document.addEventListener("click", (event) => {
      const el = ensurePet();
      if (!el || !(event.target === el || el.contains(event.target))) return;
      if (event.target.closest && event.target.closest(".qq7-pet-sign-item")) return;
      // 阻止事件继续冒泡到 WorkBuddy 自己的成长伙伴/个人中心点击逻辑
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      clickPet();
    }, true);

    document.addEventListener("pointerdown", (event) => {
      const el = ensurePet();
      if (!el || !(event.target === el || el.contains(event.target))) return;
      event.stopPropagation();
    }, true);

    let optionDebounce = 0;
    let optionObserver = null;
    let observedList = null;

    function attachOptionObserver() {
      const list = document.querySelector(".cr-message-list");
      if (!list || list === observedList) return;
      observedList = list;
      if (optionObserver) optionObserver.disconnect();
      optionObserver = new MutationObserver(() => {
        if (document.hidden) return;
        window.clearTimeout(optionDebounce);
        optionDebounce = window.setTimeout(refreshOptions, 350);
      });
      optionObserver.observe(list, { childList: true, subtree: true, characterData: true });
    }

    attachOptionObserver();
    window.setInterval(() => {
      attachOptionObserver();
      refreshOptions();
    }, 2500);

    window.setInterval(() => {
      ensurePet();
      const titleNode = document.querySelector(".workbuddy-topbar-title");
      const title = titleNode ? (titleNode.textContent || "").trim() : "";
      if (title && title !== lastTitle) {
        lastTitle = title;
        run();
      }
    }, 700);

    document.addEventListener("visibilitychange", () => {
      try {
        if (!rufflePlayer) return;
        if (document.hidden) rufflePlayer.pause();
        else rufflePlayer.play();
      } catch (error) {}
    });
    window.addEventListener("blur", () => {
      try { if (rufflePlayer && document.hidden) rufflePlayer.pause(); } catch (error) {}
    });
    window.addEventListener("focus", () => {
      try { if (rufflePlayer) rufflePlayer.play(); } catch (error) {}
    });

    preloadPetAssets();
    loadRuffle();
    schedulePlay();
    ensurePet();
    ensurePuppet(pet);
    refreshOptions();

    window.__QQ7_PET__ = {
      run,
      peek,
      play,
      showOptions(labels) {
        const el = ensurePet();
        if (!el) return false;
        manualUntil = Date.now() + 20000;
        const sign = ensureSign();
        const listNode = sign.querySelector(".qq7-pet-sign-list");
        listNode.innerHTML = "";
        (labels || []).slice(0, 4).forEach((label, index) => {
          const item = document.createElement("div");
          item.className = "qq7-pet-sign-item";
          item.textContent = (index + 1) + ". " + label;
          listNode.appendChild(item);
        });
        el.classList.add("qq7-pet-has-options");
        showSign(true);
        playSwf("speak", 6000);
        return true;
      },
      hideOptions() {
        manualUntil = 0;
        if (pet) pet.classList.remove("qq7-pet-has-options");
        showSign(false);
      },
      pet: () => pet,
      swf: (kind, duration) => playSwf(kind, duration),
      refresh: refreshOptions,
    };
  }

  const QQ7_ASSET_BASE = (() => {
    try {
      const script = document.currentScript;
      if (script && script.src) return new URL("./", script.src).href;
    } catch (error) {}
    return "file:///Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/renderer/assets/";
  })();

  // 加粗标题在 Tahoma/合成粗体下会发虚：强制用系统中黑体中等字重
  function refineTitleTypography() {
    const selects = [
      ".workbuddy-topbar-title",
      ".cb-agent-card [class*=\"_title\"]",
      ".cb-agent-card [class*=\"_titleStatic\"]",
    ];
    let changed = 0;
    for (const sel of selects) {
      document.querySelectorAll(sel).forEach((el) => {
        if (el.dataset.qq7Sharp === "1") return;
        el.dataset.qq7Sharp = "1";
        el.style.setProperty("font-family", '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif', "important");
        el.style.setProperty("font-weight", "500", "important");
        el.style.setProperty("text-shadow", "none", "important");
        el.style.setProperty("-webkit-font-smoothing", "antialiased", "important");
        changed += 1;
      });
    }
    return changed;
  }

  function watchTitles() {
    refineTitleTypography();
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refineTitleTypography, 250);
    };
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.setInterval(refineTitleTypography, 2000);
  }

  function isMainRendererWindow() {
    const params = new URLSearchParams(location.search);
    return params.has("wbSeedToken") || params.has("accountSnapshot");
  }

  function disableSkinForSecondaryWindow() {
    const link = document.querySelector(SKIN_LINK_SELECTOR);
    if (link) {
      link.media = "not all";
      link.disabled = true;
    }
    const toggle = document.getElementById("qq2008-skin-toggle");
    if (toggle) toggle.remove();
    const root = document.getElementById("qq7-root");
    if (root) root.remove();
    document.body.classList.remove("qq7-shell");
    document.body.classList.add("qq7-off");
  }

    // 经典 QQ 签名库（互联网经典文案整理，随机轮播）
    const QQ_SIGNATURES = [
        "别迷恋姐，姐只是个传说。",
        "哥抽的不是烟，是寂寞。",
        "你喜欢我这件事，我早就知道了。",
        "你若安好，便是晴天。",
        "叶的离开，是风的追求，还是树的不挽留。",
        "我喜欢四十五度角仰望天空，因为那样我的眼泪就不会掉下来。",
        "生如夏花之绚烂，死若秋叶之静美。",
        "一个人并不孤单，想一个人才孤单。",
        "生，容易；活，容易；生活不容易。",
        "人生最大的遗憾，莫过于错误地坚持了不该坚持的，轻易地放弃了不该放弃的。",
        "怀才就像怀孕，时间久了才能让人看出来。",
        "站得更高，尿得更远。",
        "水能载舟，亦能煮粥。",
        "早起的鸟儿有虫吃，早起的虫儿被鸟吃。",
        "不怕虎一样的敌人，就怕猪一样的队友。",
        "水至清则无鱼，人至贱则无敌。",
        "我不是随便的人，我随便起来不是人。",
        "骑白马的不一定是王子，他可能是唐僧。",
        "带翅膀的也不一定是天使，他可能是鸟人。",
        "不要在一棵树上吊死，在附近几棵树上多试几次。",
        "穿别人的鞋，走自己的路，让他们打的找去吧。",
        "我以为我很颓废，今天我才知道，原来我早报废了。",
        "我喝酒是想把痛苦溺死，但这该死的痛苦却学会了游泳。",
        "别人都在假装正经，那我就只有假装不正经啦。",
        "思想有多远，你就给我滚多远。",
        "流氓不可怕，就怕流氓有文化。",
        "出问题先从自己身上找原因，别一便秘就怪地球没引力。",
        "生活真他妈好玩，因为生活老他妈玩我。",
        "我想早恋，但是已经晚了……",
        "天哪！我的衣服又瘦了。",
        "以后不要在我面前说英文，OK？",
        "人生就是一场游戏，遇到的障碍就是各种关卡。",
        "男人的谎言可以骗女人一夜，女人的谎言可以骗男人一生。",
        "我以为爱情可以填满人生的遗憾，然而制造更多遗憾的，偏偏是爱情。",
        "有些事，我们明知道是错的，也要去坚持，因为不甘心。",
        "有些人，我们明知道是爱的，也要去放弃，因为没结局。",
        "有时候，我们明知道没路了，却还在前行，因为习惯了。",
        "青春是一道明媚的忧伤。",
        "时间是贼，偷走一切。",
        "回得了过去，回不了当初。",
        "我们再也回不去了，对不对？",
        "谁的青春没有浅浅的淤青。",
        "下辈子我要做你的一颗牙，至少我不在的时候你会疼。",
        "把你的名字写在烟上，吸进肺里，留在离心脏最近的地方。",
        "你若折断她半边翅膀，我便毁了你整个天堂。",
        "我颠覆整个世界，只为了摆正你的倒影。",
        "哑巴说，聋子听到瞎子看见了爱情。",
        "都怪姐姐太年轻，是人是狗看不清。",
        "你的酒窝没有酒，我却醉得像条狗。",
        "别在我的坟前哭，弄脏了我的轮回路。",
        "本人已死，有事烧纸，小事敲门，大事挖坟。",
        "心里有座坟，埋着未亡人。",
        "鱼哭了水知道，我哭了谁知道。",
        "寂寞不是一个人待着，而是心里没有人。",
        "我以为我不在乎，其实我一直在等。",
        "总有一天，你会明白，有些人，走了就不回来了。",
        "全世界如果有一千个人爱你，那么我就是其中之一。",
        "全世界如果只有一个人爱你，那么那个人就是我。",
        "全世界如果没有人爱你，那么我已经死了。",
        "我对你掏心掏肺，你对我狼心狗肺。",
        "爱情就像两个拉橡皮筋的人，受伤的总是不愿放手的那一个。",
        "幸福就是猫吃鱼，狗吃肉，奥特曼打小怪兽。",
        "在哪里跌倒，就在哪里躺下。",
        "不要和我比懒，我懒得和你比。",
        "我当年也是个痴情的种子，结果下了场雨，淹死了。",
        "我本将心向明月，奈何明月照沟渠。",
        "人怕出名猪怕壮，我既怕出名又怕壮。",
        "人生如戏，全靠演技。",
        "我不是天桥上算命的，唠不出那么多你爱听的嗑。",
        "你说你有点难追，想让我知难而退。",
        "你是我猜不到的不知所措，我是你想不到的无关痛痒。",
        "有些人不属于自己，但是遇见了也很好。",
        "我们总在最不懂爱情的年代，遇见最美好的爱情。",
        "青春就是用来怀念的。",
        "那些被允许任性的年代，叫做青春。",
        "我想谈一场永不分手的恋爱。",
        "等待，是一生最初的苍老。",
        "时间不是让人忘了痛，而是让人习惯了痛。",
        "你永远看不见我眼里的泪，因为你不在时我才会哭泣。",
        "如果爱，请深爱；如果不爱，请离开。",
        "宁愿笑着流泪，也不哭着说后悔。",
        "喜欢一个人，会卑微到尘埃里，然后开出花来。",
        "我用尽一生一世来将你供养。",
        "你若不离不弃，我便生死相依。",
        "执子之手，与子偕老。",
        "山有木兮木有枝，心悦君兮君不知。",
        "向来缘浅，奈何情深。",
        "人生若只如初见。",
        "等闲变却故人心，却道故人心易变。",
        "此情可待成追忆，只是当时已惘然。",
        "十年生死两茫茫，不思量，自难忘。",
        "愿得一心人，白头不相离。",
        "结发为夫妻，恩爱两不疑。",
        "天不老，情难绝。心似双丝网，中有千千结。",
        "无情不似多情苦，一寸还成千万缕。",
        "天涯地角有穷时，只有相思无尽处。",
        "落花有意随流水，流水无心恋落花。",
        "人生得意须尽欢，莫使金樽空对月。",
        "天生我材必有用，千金散尽还复来。",
        "长风破浪会有时，直挂云帆济沧海。",
        "面朝大海，春暖花开。",
        "黑夜给了我一双黑色的眼睛，我却用它来寻找光明。",
        "卑鄙是卑鄙者的通行证，高尚是高尚者的墓志铭。",
        "世界以痛吻我，要我报之以歌。",
        "天空不留下鸟的痕迹，但我已飞过。",
        "你站在桥上看风景，看风景的人在楼上看你。",
        "心若没有栖息的地方，到哪里都是在流浪。",
        "身体和灵魂，总有一个在路上。",
        "生活不止眼前的苟且，还有诗和远方。",
        "所有的酒，都不如你。",
        "我有故事，你有酒吗？",
        "后来，终于在眼泪中明白，有些人一旦错过就不在。",
        "最初不相识，最终不相认。",
        "我们笑着说再见，却深知再见遥遥无期。",
        "我怀念的是无话不说，我怀念的是一起做梦。",
        "最怕空气突然安静，最怕朋友突然的关心。",
        "有些人说不出哪里好，但就是谁都替代不了。",
        "得不到的永远在骚动，被偏爱的都有恃无恐。",
        "十年之前，我不认识你，你不属于我。",
        "可惜不是你，陪我到最后。",
        "如果当时我们能不那么倔强，现在也不那么遗憾。",
        "你都如何回忆我，带着笑或是很沉默。",
        "我们的爱，过了就不再回来。",
        "我多想一个不小心，就和你白头到老。",
        "你是我这辈子最想拥有的人，也是我最不想打扰的人。",
        "喜欢你，是我做过最勇敢的事。",
        "暗恋是一个人的兵荒马乱。",
        "我为你翻山越岭，却无心看风景。",
        "你的名字，是我见过最短的情诗。",
        "我攒了一整个青春的勇气，只为对你说一句喜欢。",
        "愿你余生，都有良人相伴。",
        "祝你岁月无波澜，敬我余生不悲欢。",
        "山水有相逢，来日皆可期。",
        "聚散终有时，后会暂无期。",
        "一别两宽，各生欢喜。",
        "往事清零，爱恨随意。",
        "凡是过往，皆为序章。",
        "不乱于心，不困于情，不畏将来，不念过往。",
        "岁月静好，现世安稳。",
        "愿岁月可回首，且以深情共白头。",
        "此去经年，应是良辰好景虚设。",
        "人生天地间，忽如远行客。",
        "浮生若梦，为欢几何。",
        "人生苦短，及时行乐。",
        "今朝有酒今朝醉，明日愁来明日愁。",
        "莫愁前路无知己，天下谁人不识君。",
        "海内存知己，天涯若比邻。",
        "劝君更尽一杯酒，西出阳关无故人。",
        "桃花潭水深千尺，不及汪伦送我情。",
        "曾经沧海难为水，除却巫山不是云。",
        "身无彩凤双飞翼，心有灵犀一点通。",
        "两情若是久长时，又岂在朝朝暮暮。",
        "问世间情为何物，直教人生死相许。",
        "只愿君心似我心，定不负相思意。",
        "衣带渐宽终不悔，为伊消得人憔悴。",
        "众里寻他千百度，蓦然回首，那人却在灯火阑珊处。",
        "昨夜西风凋碧树，独上高楼，望尽天涯路。",
        "无可奈何花落去，似曾相识燕归来。",
        "流水落花春去也，天上人间。",
        "问君能有几多愁，恰似一江春水向东流。",
        "剪不断，理还乱，是离愁，别是一般滋味在心头。",
        "无言独上西楼，月如钩。寂寞梧桐深院锁清秋。",
        "人生自是有情痴，此恨不关风与月。",
        "多情自古伤离别，更那堪冷落清秋节。",
        "今宵酒醒何处？杨柳岸，晓风残月。",
        "此去经年，应是良辰好景虚设。便纵有千种风情，更与何人说？",
        "明月楼高休独倚，酒入愁肠，化作相思泪。",
        "浊酒一杯家万里，燕然未勒归无计。",
        "醉里挑灯看剑，梦回吹角连营。",
        "了却君王天下事，赢得生前身后名。可怜白发生！",
        "三十功名尘与土，八千里路云和月。",
        "莫等闲，白了少年头，空悲切。",
        "人生自古谁无死，留取丹心照汗青。",
        "我自横刀向天笑，去留肝胆两昆仑。",
        "苟利国家生死以，岂因祸福避趋之。",
        "无边落木萧萧下，不尽长江滚滚来。",
        "风急天高猿啸哀，渚清沙白鸟飞回。",
        "两个黄鹂鸣翠柳，一行白鹭上青天。",
        "窗含西岭千秋雪，门泊东吴万里船。",
        "停车坐爱枫林晚，霜叶红于二月花。",
        "落霞与孤鹜齐飞，秋水共长天一色。",
        "先天下之忧而忧，后天下之乐而乐。",
        "醉翁之意不在酒，在乎山水之间也。",
        "山不在高，有仙则名；水不在深，有龙则灵。",
        "斯是陋室，惟吾德馨。",
        "出淤泥而不染，濯清涟而不妖。",
        "予独爱莲之出淤泥而不染。",
        "宝剑锋从磨砺出，梅花香自苦寒来。",
        "不经一番寒彻骨，怎得梅花扑鼻香。",
        "只要功夫深，铁杵磨成针。",
        "书山有路勤为径，学海无涯苦作舟。",
        "少壮不努力，老大徒伤悲。",
        "黑发不知勤学早，白首方悔读书迟。",
        "一寸光阴一寸金，寸金难买寸光阴。",
        "明日复明日，明日何其多。",
        "我生待明日，万事成蹉跎。",
        "花有重开日，人无再少年。",
        "莫等闲，白了少年头。",
        "人生得意须尽欢。",
        "今朝有酒今朝醉。",
        "路漫漫其修远兮，吾将上下而求索。",
        "长风破浪会有时。",
        "直挂云帆济沧海。",
        "天生我材必有用。",
        "千金散尽还复来。",
        "天生一对，地设一双。",
        "有缘千里来相会，无缘对面不相逢。",
        "百年修得同船渡，千年修得共枕眠。",
        "众里寻他千百度。",
        "蓦然回首，那人却在灯火阑珊处。",
        "十年修得同船渡，百年修得共枕眠。",
        "有情人终成眷属。",
        "愿天下有情人终成眷属。",
        "祝自己幸福。",
        "我很好，不吵不闹不炫耀。",
        "现世安稳，岁月静好。",
        "从明天起，做一个幸福的人。",
        "喂马、劈柴，周游世界。",
        "我只愿面朝大海，春暖花开。",
        "黑夜给了我黑色的眼睛。",
        "卑鄙是卑鄙者的通行证。",
        "高尚是高尚者的墓志铭。",
        "世界以痛吻我。",
        "我要报之以歌。",
        "天空不留下鸟的痕迹。",
        "但我已飞过。",
        "你站在桥上看风景。",
        "看风景的人在楼上看你。",
        "明月装饰了你的窗子。",
        "你装饰了别人的梦。",
        "心若没有栖息的地方。",
        "到哪里都是在流浪。",
        "生活不止眼前的苟且。",
        "还有诗和远方。",
        "后来，终于在眼泪中明白。",
        "有些人一旦错过就不在。",
        "我们笑着说再见。",
        "却深知再见遥遥无期。",
        "我怀念的是无话不说。",
        "我怀念的是一起做梦。",
        "最怕空气突然安静。",
        "最怕朋友突然的关心。",
        "有些人说不出哪里好。",
        "但就是谁都替代不了。",
        "得不到的永远在骚动。",
        "被偏爱的都有恃无恐。",
        "十年之前，我不认识你。",
        "十年之后，我们是朋友。",
        "如果当时我们能不那么倔强。",
        "现在也不那么遗憾。",
        "你都如何回忆我。",
        "带着笑或是很沉默。",
        "你是我这辈子最想拥有的人。",
        "也是我最不想打扰的人。",
        "我为你翻山越岭。",
        "却无心看风景。",
        "祝你岁月无波澜。",
        "敬我余生不悲欢。",
        "不乱于心，不困于情。",
        "不畏将来，不念过往。",
        "愿岁月可回首。",
        "且以深情共白头。",
        "明日愁来明日愁。",
        "莫愁前路无知己。",
        "天下谁人不识君。",
        "劝君更尽一杯酒。",
        "西出阳关无故人。",
        "桃花潭水深千尺。",
        "不及汪伦送我情。",
        "曾经沧海难为水。",
        "除却巫山不是云。",
        "身无彩凤双飞翼。",
        "心有灵犀一点通。",
        "两情若是久长时。",
        "又岂在朝朝暮暮。",
        "问世间情为何物。",
        "直教人生死相许。",
        "只愿君心似我心。",
        "定不负相思意。",
        "衣带渐宽终不悔。",
        "为伊消得人憔悴。",
        "昨夜西风凋碧树。",
        "独上高楼，望尽天涯路。",
        "无可奈何花落去。",
        "似曾相识燕归来。",
        "流水落花春去也。",
        "天上人间。",
        "问君能有几多愁。",
        "恰似一江春水向东流。",
        "剪不断，理还乱。",
        "别是一般滋味在心头。",
        "无言独上西楼。",
        "寂寞梧桐深院锁清秋。",
        "人生自是有情痴。",
        "此恨不关风与月。",
        "多情自古伤离别。",
        "今宵酒醒何处。",
        "杨柳岸，晓风残月。",
        "便纵有千种风情，更与何人说。",
        "明月楼高休独倚。",
        "酒入愁肠，化作相思泪。",
        "浊酒一杯家万里。",
        "燕然未勒归无计。",
        "醉里挑灯看剑。",
        "梦回吹角连营。",
        "了却君王天下事。",
        "赢得生前身后名。",
        "三十功名尘与土。",
        "八千里路云和月。",
        "人生自古谁无死。",
        "留取丹心照汗青。",
        "我自横刀向天笑。",
        "去留肝胆两昆仑。",
        "苟利国家生死以。",
        "岂因祸福避趋之。",
        "无边落木萧萧下。",
        "不尽长江滚滚来。",
        "风急天高猿啸哀。",
        "渚清沙白鸟飞回。",
        "两个黄鹂鸣翠柳。",
        "一行白鹭上青天。",
        "窗含西岭千秋雪。",
        "门泊东吴万里船。",
        "停车坐爱枫林晚。",
        "霜叶红于二月花。",
        "落霞与孤鹜齐飞。",
        "秋水共长天一色。",
        "先天下之忧而忧。",
        "后天下之乐而乐。",
        "醉翁之意不在酒。",
        "在乎山水之间也。",
        "山不在高，有仙则名。",
        "水不在深，有龙则灵。",
        "出淤泥而不染。",
        "濯清涟而不妖。",
        "宝剑锋从磨砺出。",
        "梅花香自苦寒来。",
        "不经一番寒彻骨。",
        "怎得梅花扑鼻香。",
        "只要功夫深。",
        "铁杵磨成针。",
        "书山有路勤为径。",
        "学海无涯苦作舟。",
        "少壮不努力。",
        "老大徒伤悲。",
        "黑发不知勤学早。",
        "白首方悔读书迟。",
        "一寸光阴一寸金。",
        "寸金难买寸光阴。",
        "明日复明日。",
        "明日何其多。",
        "我生待明日。",
        "万事成蹉跎。",
        "花有重开日。",
        "人无再少年。",
        "路漫漫其修远兮。",
        "吾将上下而求索。",
        "有缘千里来相会。",
        "无缘对面不相逢。",
        "百年修得同船渡。",
        "千年修得共枕眠。",
        "黑夜给了我黑色的眼睛，我却用它寻找光明。",
        "便纵有千种风情，更与何人说？",
        "了却君王天下事，赢得生前身后名。",
        "明月装饰了你的窗子，你装饰了别人的梦。",
        "莪們嘟媞單翅の天使，祗有擁菢才宬飛翔。",
        "侽亽，請記住莪們の約定。",
        "①個亽の寂寞，兩①個亽の錯。",
        "吥矢望，洅絕望。",
        "莪苡後吥會在愛上任何人。",
        "誰能給莪①份安穩の幸福。",
        "荭顏彈指老，刹那芳華。",
        "侽亽如衣服，姐妹如手足。"
      ];

    function pickSignature() {
      if (!QQ_SIGNATURES.length) return "";
      let idx = Math.floor(Math.random() * QQ_SIGNATURES.length);
      if (QQ_SIGNATURES.length > 1) {
        try {
          const last = Number(localStorage.getItem("qq7-sign-last"));
          if (Number.isFinite(last) && idx === last) idx = (idx + 1) % QQ_SIGNATURES.length;
        } catch (error) {}
      }
      try { localStorage.setItem("qq7-sign-last", String(idx)); } catch (error) {}
      return QQ_SIGNATURES[idx];
    }

    function applySignature(text, animate) {
      const el = document.querySelector(".qq7-status-quote");
      if (!el) return;
      if (!animate) {
        el.textContent = text;
        return;
      }
      el.classList.add("is-fading");
      window.setTimeout(() => {
        el.textContent = text;
        el.classList.remove("is-fading");
      }, 260);
    }

    function initSignatures() {
      const el = document.querySelector(".qq7-status-quote");
      if (!el) return;
      applySignature(pickSignature(), false);
      el.title = "点一下换一条经典签名";
      el.style.cursor = "pointer";
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        applySignature(pickSignature(), true);
        scheduleSignature();
      });

      let timer = 0;
      function rotate() {
        if (document.hidden) {
          scheduleSignature();
          return;
        }
        applySignature(pickSignature(), true);
        scheduleSignature();
      }
      function scheduleSignature() {
        window.clearTimeout(timer);
        timer = window.setTimeout(rotate, 20000 + Math.random() * 40000);
      }
      scheduleSignature();
      window.__QQ7_SIG__ = {
        next: () => { applySignature(pickSignature(), true); scheduleSignature(); },
        current: () => el.textContent,
        count: QQ_SIGNATURES.length,
      };
    }

    // 把 WorkBuddy 的通知音（app.asar/renderer/assets/sounds/*.wav）替换成经典 QQ 滴滴声
  function installNotificationSound() {
    if (window.__qq7NotifySoundHooked) return;
    window.__qq7NotifySoundHooked = true;
    const APP_SOUND = /\/sounds\/[^/]+\.wav(?:[?#]|$)/i;
    // 必须先于 new Audio(QQ_SOUND_URL) 声明，否则 TDZ ReferenceError 会被
    // 下面的 catch 吞掉，qqNotify 恒为 null，整个通知音替换静默失效。
    const QQ_SOUND_URL = new URL("qq-message.wav", QQ7_ASSET_BASE).href;
    let qqNotify = null;
    // 与 qq2008-notify.js 的任务音量保持同源：读取同一 localStorage 键，
    // 皮肤开关关闭时两个声音系统一起静音，音量设置对两者同时生效。
    const readNotifyVolume = () => {
      try {
        if (localStorage.getItem("WORKBUDDY_QQ2008_SKIN_ENABLED") === "false") return -1;
        if (localStorage.getItem("WORKBUDDY_QQ2008_TASK_SOUND_ENABLED") === "false") return -1;
        const raw = Number(localStorage.getItem("WORKBUDDY_QQ2008_TASK_SOUND_VOLUME"));
        return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.9;
      } catch (error) {
        return 0.9;
      }
    };
    try {
      qqNotify = new Audio(QQ_SOUND_URL);
      qqNotify.dataset.qq7Own = "1";
      qqNotify.preload = "auto";
      qqNotify.volume = 0.9;
    } catch (error) {
      qqNotify = null;
    }
    let lastQQAt = 0;
    const playQQ = (force) => {
      if (!qqNotify) return false;
      const now = Date.now();
      if (!force && now - lastQQAt < 900) return false;
      try {
        const volume = readNotifyVolume();
        if (volume < 0) return false; // 皮肤或声音开关已关闭；不消耗 900ms 去重窗口
        qqNotify.volume = volume;
        qqNotify.currentTime = 0;
        qqNotify.play().catch(() => {});
        lastQQAt = now; // 只在真正发声时更新，静音期间不占用去重窗口
        return true;
      } catch (error) {
        return false;
      }
    };
    // 应用可能用 autoplay 播放而不调用 play()：拦截 src 赋值 / Audio 构造 / setAttribute / fetch
    const SOUND_URL = /\/sounds\/[^/]+\.wav(?:[?#]|$)/i;
    const QQ_URL = QQ_SOUND_URL;

    try {
      const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
      if (srcDescriptor && srcDescriptor.set && srcDescriptor.get) {
        Object.defineProperty(HTMLMediaElement.prototype, "src", {
          configurable: true,
          enumerable: srcDescriptor.enumerable,
          get() { return srcDescriptor.get.call(this); },
          set(value) {
            try {
              if (SOUND_URL.test(String(value))) {
                window.__qq7SuppressThemeSoundUntil = Date.now() + 1500;
                playQQ();
                return srcDescriptor.set.call(this, QQ_URL);
              }
            } catch (error) {}
            return srcDescriptor.set.call(this, value);
          },
        });
      }
    } catch (error) {}

    try {
      const setAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function (name, value) {
        try {
          if (this instanceof HTMLMediaElement && String(name).toLowerCase() === "src" && SOUND_URL.test(String(value))) {
            window.__qq7SuppressThemeSoundUntil = Date.now() + 1500;
            playQQ();
            return setAttribute.call(this, name, QQ_URL);
          }
        } catch (error) {}
        return setAttribute.call(this, name, value);
      };
    } catch (error) {}

    try {
      const NativeAudio = window.Audio;
      if (NativeAudio) {
        const WrappedAudio = function (src, ...rest) {
          try {
            if (src && SOUND_URL.test(String(src))) {
              window.__qq7SuppressThemeSoundUntil = Date.now() + 1500;
              playQQ();
              src = QQ_URL;
            }
          } catch (error) {}
          return new NativeAudio(src, ...rest);
        };
        WrappedAudio.prototype = NativeAudio.prototype;
        Object.setPrototypeOf(WrappedAudio, NativeAudio);
        window.Audio = WrappedAudio;
      }
    } catch (error) {}

    try {
      const nativeFetch = window.fetch;
      if (nativeFetch && !window.__qq7FetchHooked) {
        window.__qq7FetchHooked = true;
        window.fetch = function (input, init) {
          try {
            const url = typeof input === "string" ? input : (input && input.url) || "";
            if (SOUND_URL.test(url)) {
              return nativeFetch.call(this, QQ_URL, init);
            }
          } catch (error) {}
          return nativeFetch.apply(this, arguments);
        };
      }
    } catch (error) {}

    const TEMPLATE_SOUND = /\/assets\/qq-(?:message|failure)\.wav(?:[?#]|$)/i;
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      try {
        const src = String(this.currentSrc || this.src || "");
        if (APP_SOUND.test(src)) {
          try {
            this.pause();
            this.currentTime = 0;
            this.volume = 0;
          } catch (error) {}
          window.__qq7SuppressThemeSoundUntil = Date.now() + 1500;
          playQQ();
          return Promise.resolve();
        }
        if (this.dataset && this.dataset.qq7Own === "1") {
          return originalPlay.apply(this, args);
        }
        if (TEMPLATE_SOUND.test(src) && Date.now() - lastQQAt < 900) {
          try { this.pause(); } catch (error) {}
          return Promise.resolve();
        }
      } catch (error) {}
      return originalPlay.apply(this, args);
    };
    // 关掉 macOS 原生通知默认提示音，只保留 QQ 滴滴
    try {
      const NativeNotification = window.Notification;
      if (NativeNotification) {
        const WrappedNotification = function (title, options) {
          try {
            return new NativeNotification(title, Object.assign({}, options, { silent: true }));
          } catch (error) {
            return new NativeNotification(title, options);
          }
        };
        WrappedNotification.prototype = NativeNotification.prototype;
        Object.setPrototypeOf(WrappedNotification, NativeNotification);
        // 保留静态属性/方法（permission / requestPermission / maxActions），
        // 否则 App 调 Notification.requestPermission() 会直接 TypeError。
        for (const key of ["permission", "maxActions"]) {
          try {
            const desc = Object.getOwnPropertyDescriptor(NativeNotification, key);
            if (desc) Object.defineProperty(WrappedNotification, key, desc);
          } catch (error) {}
        }
        if (typeof NativeNotification.requestPermission === "function") {
          WrappedNotification.requestPermission = NativeNotification.requestPermission;
        }
        window.Notification = WrappedNotification;
      }
    } catch (error) {}

    const rewriteExisting = () => {
      document.querySelectorAll('audio[src]').forEach((el) => {
        try {
          const src = el.getAttribute("src") || "";
          if (SOUND_URL.test(src)) {
            window.__qq7SuppressThemeSoundUntil = Date.now() + 1500;
            playQQ();
            el.setAttribute("src", QQ_URL);
          }
        } catch (error) {}
      });
    };
    window.setTimeout(rewriteExisting, 1200);
    window.setInterval(rewriteExisting, 5000);

    // replay 保持 playQQ 的原签名；但绕过播放开关只保留诊断用途时，
    // 应尊重配置——封装为带配置检查的版本，禁用时静默跳过。
    window.__QQ7_NOTIFY_SOUND__ = { replay: () => playQQ(true) };
  }

  /* ---------------------------------------------------------------------------
     QQ 2007 换肤配色引擎
     ---------------------------------------------------------------------------
     QQ2007 正式版的「颜色编辑」不替换整套皮肤位图，而是对默认皮肤做整体色相旋转
     （低饱和像素保持不变），并可再调亮度。预设色相从 QQ2007 正式版 QQ.exe 逆向得到
     （.rdata，文件偏移 1318162 / VA 0x541D12）：

       DWORD 序列 0x00410037, 0x0041007F, 0x004100CA,
                  0x00410112, 0x0041015A, 0x0041019F
       高字节    55°, 127°, 202°, 274°, 346°, 415°(=55°+360° 环绕插值)
       低字节    0x41 为常量标记

     菜单文字取自 QQRes.dll 字符串表：
       颜色恢复 | 贵族紫 | 水晶蓝 | 天际蓝 | 苹果绿 | 沙漠黄 | 玫瑰红 | 自定义

     「天际蓝」即皮肤自身默认色相（HUE_BASE = 210°），「颜色恢复」回到同一默认。

     三张样式表的皮肤色值已统一令牌化为 var(--qq7-c-XXXXXX, #XXXXXX)，令牌名即原始
     色值。运行时按 (目标色相 - 210) 旋转令牌的 H、保持 S/L，汇总成一条 <style> 写入
     :root，一次 DOM 操作完成整屏换色。任何一步失败都只退回 var() 的原始色值。
  --------------------------------------------------------------------------- */
  const HUE_BASE = 210;              // 本主题皮肤自身的色相（天际蓝）
  const HUE_KEY = "WORKBUDDY_QQ7_SKIN_HUE";
  const LIGHT_KEY = "WORKBUDDY_QQ7_SKIN_LIGHT";
  const HUE_MAX = 359;
  const LIGHT_MAX = 45;             // 亮度偏移上限 ±45%（对应 QQ2007 亮度滑条）
  const COLOR_ITEMS = [
    { id: "restore", label: "颜色恢复", hue: HUE_BASE },
    { id: "noble", label: "贵族紫", hue: 274 },
    { id: "crystal", label: "水晶蓝", hue: 202 },
    { id: "sky", label: "天际蓝", hue: HUE_BASE },
    { id: "apple", label: "苹果绿", hue: 127 },
    { id: "desert", label: "沙漠黄", hue: 55 },
    { id: "rose", label: "玫瑰红", hue: 346 }
  ];
  // 皮肤色令牌（名字即原始 RRGGBB，不含 #）
  const SKIN_TOKENS = [
    "0054E3", "04131C", "061923", "061C2B", "071E81", "071F31", "07558F", "09151E", "0A1720", "0A4FC0",
    "0A5FCE", "0A62F0", "0B1822", "0B1923", "0B3A5B", "0B6EFB", "0C202D", "0C2534", "0C4A94", "0C5F9F",
    "0D202B", "0D2635", "0D4C8C", "0E2330", "0F202C", "0F4E82", "0F5D9B", "102531", "102532", "102631",
    "102A3A", "102B3B", "102C3C", "122834", "12395C", "123C63", "125171", "1265AA", "126DB4", "132733",
    "133448", "135F9D", "142936", "142B38", "142C39", "145C84", "145D99", "1476C3", "152C3A", "15578A",
    "155F9F", "163E5C", "17303D", "173352", "173B50", "173D53", "173F5D", "17436B", "17649E", "176AA9",
    "1777C3", "183441", "18384A", "183A54", "18567C", "1878C5", "193340", "193846", "194B67", "1A3B4D",
    "1A3C4E", "1A5AA6", "1A7DFF", "1B3948", "1C5672", "1C78AA", "1D78A9", "1F73B5", "203C50", "203D4D",
    "20506B", "20516B", "223F54", "22496F", "2274B5", "234B67", "234C70", "244760", "244B5E", "245B81",
    "246F9C", "257EAA", "263D50", "2677B6", "278DBF", "286888", "2878B3", "287EBE", "29475C", "294B5D",
    "2A6491", "2A6FC0", "2C5970", "2C5C73", "2D83C6", "2E607A", "2E83C5", "2F688D", "2F8ED2", "2F90FF",
    "315B71", "315F76", "315F78", "315F7F", "3187C7", "3292D7", "338AC7", "3491D4", "35677E", "356981",
    "36566C", "36576E", "365F72", "37677D", "376D86", "396A80", "396B82", "39769F", "397FB4", "3A7895",
    "3B82CF", "3B86A9", "3C98DA", "3D6F91", "3D6F96", "3D8BD6", "3D99DC", "3D9BDE", "3E83A5", "3F97FF",
    "405F74", "425F74", "42677F", "47758D", "48677D", "49A9DE", "4A84B8", "4A87A4", "4B87A2", "4B8CD4",
    "4B94C5", "4B98CE", "4B9ED8", "4C8FBD", "4E7691", "526F83", "5798C4", "587899", "5A9DE8", "5B7590",
    "5CABE1", "5D9BC7", "5F7789", "5F7F95", "607989", "617B8E", "61B8E8", "667F92", "668291", "6CA3C6",
    "6F9FBE", "6FA6CA", "718B9A", "75B7E2", "75C1EE", "76C3F0", "77A9CA", "7890A0", "7899AA", "78ACD0",
    "79ADD1", "79C4F1", "7A94AA", "7B91A1", "7EADD0", "7EAFD0", "7F9DB9", "7FAECA", "7FB2D9", "82B3D2",
    "83A7BA", "85C0E5", "86B8D7", "8AB4D6", "8AB5D1", "8BA0AF", "8BB5D0", "8CA9B8", "8DB8D5", "8DB9D4",
    "8DB9D5", "8EB4C7", "8EB9D6", "8FA9B9", "8FB4D0", "8FB5C8", "8FB9D4", "8FC9EC", "91A3B1", "91ABBA",
    "91B7CB", "91D7FA", "9AA9B6", "9AB7CF", "9ABBD0", "9BBFD7", "9EC8E0", "9FB3C4", "9FBED2", "9FBFD8",
    "9FCFEE", "A3C0D8", "A7C8DC", "A7C9DA", "A9C4D2", "A9C7DD", "A9D3EF", "A9D7F2", "AAC6DD", "AAC9DC",
    "AFD9F1", "B4CEDF", "B5D2E4", "B6D2E6", "B7C9D8", "B7CEDB", "B7D2E2", "B7D9F0", "B8D7E9", "B9CFE2",
    "B9D9E9", "B9DFF5", "BCDCF4", "BFD6E2", "BFD7E3", "BFE4FF", "C3D8E8", "C4E1F3", "C5E2F3", "C6E4F5",
    "C8DBEA", "C9E3F3", "C9E7FA", "CBE6F6", "CCE9FA", "CCECFF", "CFE6F8", "CFE6FB", "CFE7F5", "CFE7F8",
    "D0E2ED", "D0E6F4", "D3E9FA", "D3EAF8", "D5EAFA", "D6EAF7", "D6EBFB", "D7EAF6", "D7ECF8", "D8E9F3",
    "D8ECFB", "D8EDF7", "D8F0FD", "D9EBF6", "D9ECFB", "D9EFFC", "DBEAF4", "DCEEF9", "DCEEFC", "DCF4FF",
    "DDF0FD", "DFEAF7", "DFEEFB", "DFF3FF", "DFF5FF", "E0EBF2", "E2F0F8", "E2F1FC", "E3F0F8", "E3F2FB",
    "E3F2FD", "E4F0F7", "E4F3FB", "E5F3FB", "E6F3FD", "E6F4FC", "E7F2F8", "E7F3FD", "E7F4FA", "E8F3FA",
    "E8F4FE", "E8F4FF", "E9F5FF", "E9F6FD", "EAF3F9", "EAF5FF", "EAF6FE", "EAF6FF", "EAF7FF", "EDF5FA",
    "EDF7FF", "EDF8FF", "EEF5FB", "EEF6FC", "EEF8FD", "EEF8FF", "EFF9FF", "EFFAFF", "F0F9FF", "F1F7FB",
    "F1FAFF", "F2F8FC", "F2F9FF", "F4F9FD", "F4FBFF", "F6FBFE", "F6FCFF", "F7FBFE", "F7FCFF", "F8FDFF",
    "F9FDFF", "FBFDFF"
  
  ];

  const hexToRgb = (hex) => {
    const h = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return [h * 360, s, l];
  }

  function hueToRgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  function hslToHex(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hueToRgb(p, q, h + 1 / 3);
      g = hueToRgb(p, q, h);
      b = hueToRgb(p, q, h - 1 / 3);
    }
    const to = (v) => Math.min(255, Math.max(0, Math.round(v * 255)));
    return ("000000" + ((to(r) << 16) | (to(g) << 8) | to(b)).toString(16).toUpperCase()).slice(-6);
  }

  /* 按目标色相旋转单个令牌：只改 H，保持 S/L；低饱和（灰白）保持原值 */
  function rotateToken(hex, targetHue, lightShift) {
    const [r, g, b] = hexToRgb(hex);
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.15) return "#" + hex;
    const nl = Math.min(0.99, Math.max(0.02, l + lightShift));
    return "#" + hslToHex(h + (targetHue - HUE_BASE), s, nl);
  }

  /* 读取主题设置：{hue, light, custom}；custom=false 表示使用皮肤默认天际蓝 */
  function readTheme() {
    let hue = HUE_BASE;
    let light = 0;
    let custom = false;
    try {
      const rawHue = localStorage.getItem(HUE_KEY);
      if (rawHue !== null) {
        const parsed = Number(rawHue);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= HUE_MAX) { hue = parsed; custom = true; }
      }
      const rawLight = localStorage.getItem(LIGHT_KEY);
      if (rawLight !== null) {
        const parsed = Number(rawLight);
        if (Number.isFinite(parsed)) light = Math.min(LIGHT_MAX, Math.max(-LIGHT_MAX, parsed));
      }
    } catch (error) {}
    return { hue, light, custom };
  }

  function saveTheme(theme) {
    try {
      if (theme && theme.custom) {
        localStorage.setItem(HUE_KEY, String(Math.round(theme.hue)));
        localStorage.setItem(LIGHT_KEY, String(Math.round(theme.light || 0)));
      } else {
        localStorage.removeItem(HUE_KEY);
        localStorage.removeItem(LIGHT_KEY);
      }
    } catch (error) {}
  }


  function applyTheme(theme) {
    const t = theme || readTheme();
    const delta = t.custom ? (t.hue - HUE_BASE) : 0;
    const light = t.custom ? (t.light || 0) / 100 : 0;
    if (!themeStyleEl) {
      themeStyleEl = document.createElement("style");
      themeStyleEl.id = "qq7-theme-vars";
      document.head.appendChild(themeStyleEl);
    }
    if (!delta && !light) {
      themeStyleEl.textContent = "";
      return t;
    }
    const rules = [];
    for (const token of SKIN_TOKENS) {
      rules.push("--qq7-c-" + token + ":" + rotateToken(token, t.hue, light));
    }
    themeStyleEl.textContent = ":root{" + rules.join(";") + "}";
    return t;
  }

  /* 当前配色对应的色板小方块颜色（用于菜单左侧色块） */
  function swatchFor(hue) {
    return rotateToken("0A62F0", hue, 0);
  }

  function colorMenuHtml() {
    const theme = readTheme();
    const isDefault = !theme.custom;
    const rows = COLOR_ITEMS.map((item) => {
      const current = isDefault ? item.id === "restore" : (item.id === "sky" && theme.hue === HUE_BASE);
      const chip = item.id === "restore" ? "linear-gradient(135deg,#ff7e00,#0a62f0)"
        : swatchFor(item.hue);
      return `<div class="qq7-colormenu-item${current ? " is-current" : ""}" data-color="${item.id}" role="menuitem" tabindex="-1">`
        + `<span class="qq7-colormenu-chip" style="background:${chip}"></span>`
        + `<span>${item.label}</span></div>`;
    }).join("");
    return rows
      + `<div class="qq7-colormenu-sep"></div>`
      + `<div class="qq7-colormenu-item${isDefault ? "" : " is-current"}" data-color="custom" role="menuitem" tabindex="-1">`
      + `<span class="qq7-colormenu-chip" style="background:linear-gradient(135deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f)"></span>`
      + `<span>自定义</span><span class="qq7-colormenu-hint">色调/亮度</span></div>`;
  }

  function pickerHtml() {
    const theme = readTheme();
    const hue = theme.custom ? Math.round(theme.hue) : HUE_BASE;
    const light = Math.round(theme.custom ? (theme.light || 0) : 0);
    return `
      <div class="qq7-picker-row">
        <span class="qq7-picker-label">色调</span>
        <input class="qq7-hue" type="range" min="0" max="${HUE_MAX}" step="1" value="${hue}" aria-label="色调">
        <span class="qq7-picker-value" data-hue-val>${hue}°</span>
      </div>
      <div class="qq7-picker-row">
        <span class="qq7-picker-label">亮度</span>
        <input class="qq7-light" type="range" min="-${LIGHT_MAX}" max="${LIGHT_MAX}" step="1" value="${light}" aria-label="亮度">
        <span class="qq7-picker-value" data-light-val>${light > 0 ? "+" : ""}${light}%</span>
      </div>
      <div class="qq7-picker-actions">
        <button class="qq7-picker-btn" type="button" data-picker="cancel">取消</button>
        <button class="qq7-picker-btn" type="button" data-picker="ok">确定</button>
      </div>`;
  }

  let colorMenuEl = null;
  let colorBtnEl = null;
  let pickerDraft = null;

  function closeColorMenu() {
    if (colorMenuEl) colorMenuEl.hidden = true;
    if (colorBtnEl) colorBtnEl.setAttribute("aria-expanded", "false");
    if (pickerDraft) {
      const picker = colorMenuEl && colorMenuEl.querySelector(".qq7-picker");
      if (picker) picker.hidden = true;
      pickerDraft = null;
      applyTheme();   // 丢弃未确认的自定义预览
      return;
    }
    pickerDraft = null;
  }

  function openColorMenu() {
    if (!colorMenuEl) return;
    // 每次打开都回到已保存的配色，避免上一次「自定义」的未确认预览残留
    applyTheme();
    const picker = colorMenuEl.querySelector(".qq7-picker");
    if (picker) picker.hidden = true;
    pickerDraft = null;
    syncColorMenuState();
    colorMenuEl.hidden = false;
    if (colorBtnEl) colorBtnEl.setAttribute("aria-expanded", "true");
    // 菜单跟随按钮位置弹出（按钮在菜单栏中段，不能写死在右侧）
    if (colorBtnEl && colorMenuEl) {
      const btn = colorBtnEl.getBoundingClientRect();
      const host = root.getBoundingClientRect();
      const menuWidth = colorMenuEl.offsetWidth || 140;
      let left = btn.left - host.left;
      // 防止菜单超出窗口右边缘
      if (left + menuWidth > host.width - 6) left = Math.max(6, host.width - menuWidth - 6);
      colorMenuEl.style.setProperty("--qq7-colormenu-x", Math.round(left) + "px");
    }
    // 打开后把焦点交给当前配色项，键盘用户可直接用方向键选择
    const items = [...colorMenuEl.querySelectorAll(".qq7-colormenu-item")];
    const active = items.find((item) => item.classList.contains("is-current")) || items[0];
    if (active) {
      items.forEach((item) => { item.tabIndex = item === active ? 0 : -1; });
      active.focus();
    }
  }

  function selectPreset(id) {
    if (id === "custom") {
      const picker = colorMenuEl && colorMenuEl.querySelector(".qq7-picker");
      if (picker) {
        picker.hidden = false;
        picker.innerHTML = pickerHtml();
        pickerDraft = { hue: readTheme().custom ? readTheme().hue : HUE_BASE, light: readTheme().custom ? (readTheme().light || 0) : 0 };
      }
      return;
    }
    const item = COLOR_ITEMS.find((entry) => entry.id === id);
    if (!item) return;
    const theme = id === "restore" || id === "sky"
      ? { hue: HUE_BASE, light: 0, custom: false }
      : { hue: item.hue, light: 0, custom: true };
    saveTheme(theme);
    applyTheme(theme);
    syncColorMenuState();
    closeColorMenu();
  }

  function syncColorMenuState() {
    if (!colorMenuEl) return;
    const list = colorMenuEl.querySelector(".qq7-colormenu-list");
    if (!list) return;
    list.innerHTML = colorMenuHtml();
  }

  function wireColorButton(host) {
    colorBtnEl = host;
    colorMenuEl = document.createElement("div");
    colorMenuEl.className = "qq7-colormenu";
    colorMenuEl.hidden = true;
    colorMenuEl.setAttribute("role", "menu");
    colorMenuEl.innerHTML = `<div class="qq7-colormenu-list">${colorMenuHtml()}</div><div class="qq7-picker" hidden></div>`;
    root.appendChild(colorMenuEl);

    colorBtnEl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (colorMenuEl.hidden) openColorMenu(); else closeColorMenu();
    });
    colorBtnEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        openColorMenu();
      }
    });

    colorMenuEl.addEventListener("click", (event) => {
      const item = event.target.closest && event.target.closest("[data-color]");
      if (item) { selectPreset(item.dataset.color); return; }
      const action = event.target.closest && event.target.closest("[data-picker]");
      if (!action) return;
      event.preventDefault();
      if (action.dataset.picker === "cancel") {
        const picker = colorMenuEl.querySelector(".qq7-picker");
        if (picker) picker.hidden = true;
        pickerDraft = null;
        // 取消必须把实时预览退回到已保存的配色，否则界面会停在未确认的颜色上
        applyTheme();
        return;
      }
      if (action.dataset.picker === "ok" && pickerDraft) {
        saveTheme({ hue: pickerDraft.hue, light: pickerDraft.light, custom: true });
        applyTheme({ hue: pickerDraft.hue, light: pickerDraft.light, custom: true });
        syncColorMenuState();
        closeColorMenu();
      }
    });

    colorMenuEl.addEventListener("input", (event) => {
      const input = event.target;
      if (!input || !input.classList) return;
      if (!pickerDraft) return;
      if (input.classList.contains("qq7-hue")) {
        pickerDraft.hue = Number(input.value);
        const tag = colorMenuEl.querySelector("[data-hue-val]");
        if (tag) tag.textContent = pickerDraft.hue + "°";
      } else if (input.classList.contains("qq7-light")) {
        pickerDraft.light = Number(input.value);
        const tag = colorMenuEl.querySelector("[data-light-val]");
        if (tag) tag.textContent = (pickerDraft.light > 0 ? "+" : "") + pickerDraft.light + "%";
      }
      // 实时预览（不落盘，取消即丢弃）
      if (themeStyleEl) {
        const delta = pickerDraft.hue - HUE_BASE;
        if (!delta && !pickerDraft.light) themeStyleEl.textContent = "";
        else {
          const rules = [];
          const light = pickerDraft.light / 100;
          for (const token of SKIN_TOKENS) rules.push("--qq7-c-" + token + ":" + rotateToken(token, pickerDraft.hue, light));
          themeStyleEl.textContent = ":root{" + rules.join(";") + "}";
        }
      }
    });

    colorMenuEl.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeColorMenu();
        if (colorBtnEl) colorBtnEl.focus();
        return;
      }
      const items = [...colorMenuEl.querySelectorAll(".qq7-colormenu-item")];
      if (!items.length) return;
      const current = items.indexOf(document.activeElement);
      const focusItem = (index) => {
        const target = items[(index + items.length) % items.length];
        items.forEach((item) => { item.tabIndex = -1; });
        target.tabIndex = 0;
        target.focus();
      };
      switch (event.key) {
        case "ArrowDown":
        case "Down":
          event.preventDefault();
          focusItem(current < 0 ? 0 : current + 1);
          break;
        case "ArrowUp":
        case "Up":
          event.preventDefault();
          focusItem(current < 0 ? items.length - 1 : current - 1);
          break;
        case "Home":
          event.preventDefault();
          focusItem(0);
          break;
        case "End":
          event.preventDefault();
          focusItem(items.length - 1);
          break;
        case "Enter":
        case " ":
          if (current >= 0) {
            event.preventDefault();
            event.stopPropagation();
            selectPreset(items[current].dataset.color);
          }
          break;
        default:
          break;
      }
    });
    // 点击取色滑条等控件时不要让焦点被外层抢走
    colorMenuEl.addEventListener("focusin", (event) => {
      const item = event.target.closest && event.target.closest(".qq7-colormenu-item");
      if (!item) return;
      colorMenuEl.querySelectorAll(".qq7-colormenu-item").forEach((el) => { el.tabIndex = el === item ? 0 : -1; });
    });
    colorMenuEl.addEventListener("mousedown", (event) => event.stopPropagation());
    // 点空白处关闭（QQ2007 菜单也是点别处收起）
    document.addEventListener("pointerdown", (event) => {
      if (colorMenuEl.hidden) return;
      if (colorMenuEl.contains(event.target) || colorBtnEl.contains(event.target)) return;
      closeColorMenu();
    }, true);
  }

  function start() {
    if (!document.body) return;
    if (!isMainRendererWindow()) {
      window.__qq7Timing = window.__qq7Timing || {};
      window.__qq7Timing.start = Math.round(performance.now());
      disableSkinForSecondaryWindow();
      return;
    }
    window.__qq7Timing = window.__qq7Timing || {};
    window.__qq7Timing.start = Math.round(performance.now());
try { const t = window.__qq7Timing || (window.__qq7Timing = {}); t.start = Math.round(performance.now()); localStorage.setItem("qq7pet-timings", JSON.stringify(t)); } catch (e) {}
    installNotificationSound();
    buildChrome();
    initSignatures();
    watchTitles();

    // 标题跟随当前会话/项目变化
    const titleObserver = new MutationObserver(() => refreshTitle());
    titleObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.setInterval(refreshTitle, 1500);

    // 皮肤开关状态同步
    const link = document.querySelector(SKIN_LINK_SELECTOR);
    if (link) {
      new MutationObserver(syncSkin).observe(link, { attributes: true, attributeFilter: ["media", "disabled"] });
    }
    window.setInterval(syncSkin, 1200);

    initPet();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
