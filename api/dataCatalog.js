// api/dataCatalog.js
(function () {
  if (!window.registerExtension) return;

  const CATALOG_KEY = "ai_dataset_catalog";

  function loadLocalCatalog() {
    try {
      const raw = localStorage.getItem(CATALOG_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("catalog load error", e);
      return [];
    }
  }

  function init(container, brain) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="small">
        /data とローカルカタログから学習データを読み込むツール。<br>
        ・/data/index.json: サーバ配置のデータセット一覧。<br>
        ・localStorage: datasetUploader で追加したローカルデータセット。<br>
        どちらも統合して一覧表示し、学習 or 置き換えができる。
      </div>

      <div style="margin-top:10px;">
        <button id="dc_reload">カタログ再読み込み</button>
      </div>

      <div id="dc_list" style="margin-top:10px;font-size:13px;"></div>
      <div id="dc_status" class="small" style="margin-top:8px;color:#aaa;"></div>
    `;
    container.appendChild(wrapper);

    const listEl   = wrapper.querySelector("#dc_list");
    const statusEl = wrapper.querySelector("#dc_status");
    const reloadBtn= wrapper.querySelector("#dc_reload");

    function setStatus(msg) {
      statusEl.textContent = msg;
      if (window._updateStats) window._updateStats();
    }

    async function loadRemoteCatalog() {
      try {
        const res = await fetch("data/index.json");
        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data)) return [];
        return data.map(item => ({
          ...item,
          storage: item.storage || "remote"
        }));
      } catch (e) {
        console.warn("remote catalog load failed", e);
        return [];
      }
    }

    async function loadCatalogCombined() {
      setStatus("カタログ読み込み中…");
      listEl.innerHTML = "";

      const [remote, local] = await Promise.all([
        loadRemoteCatalog(),
        Promise.resolve(loadLocalCatalog())
      ]);

      const map = new Map();
      for (const r of remote) {
        if (!r || !r.id) continue;
        map.set(r.id, { ...r, storage: r.storage || "remote" });
      }
      for (const l of local) {
        if (!l || !l.id) continue;
        map.set(l.id, { ...l, storage: "local" });
      }
      const catalog = Array.from(map.values());

      renderCatalog(catalog);
      setStatus(`カタログ読み込み完了。${catalog.length} 件。`);
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function renderCatalog(catalog) {
      if (catalog.length === 0) {
        listEl.innerHTML = `<div class="small">登録されたデータセットがない。/data とローカルアップロードを確認しろ。</div>`;
        return;
      }

      listEl.innerHTML = "";
      for (const item of catalog) {
        const row = document.createElement("div");
        row.style.border = "1px solid #444";
        row.style.padding = "8px";
        row.style.marginBottom = "8px";
        row.style.borderRadius = "4px";

        const srcLabel = item.storage === "local" ? "localStorage" : "data ディレクトリ";

        row.innerHTML = `
          <div style="font-weight:600;">${escapeHtml(item.label || item.id || "(no label)")}</div>
          <div class="small">ID: ${escapeHtml(item.id || "")}</div>
          <div class="small">ソース: ${escapeHtml(srcLabel)}</div>
          ${item.file ? `<div class="small">ファイル: data/${escapeHtml(item.file)}</div>` : ""}
          <div class="small" style="margin-top:4px;">
            ${escapeHtml(item.description || "")}
          </div>
          <div style="margin-top:6px;">
            <button data-id="${escapeHtml(item.id || "")}" class="dc_learn">このデータを学習</button>
            <button data-id="${escapeHtml(item.id || "")}" class="dc_replace">このデータで脳を置き換え</button>
          </div>
        `;
        listEl.appendChild(row);
      }

      listEl.querySelectorAll(".dc_learn").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const item = catalog.find(x => x.id === id);
          if (!item) return;
          learnFromItem(item, false);
        });
      });

      listEl.querySelectorAll(".dc_replace").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const item = catalog.find(x => x.id === id);
          if (!item) return;
          learnFromItem(item, true);
        });
      });
    }

    async function learnFromItem(item, replaceWholeBrain) {
      if (item.storage === "local") {
        await learnFromLocal(item, replaceWholeBrain);
      } else {
        await learnFromRemote(item, replaceWholeBrain);
      }
    }

    async function learnFromRemote(item, replaceWholeBrain) {
      if (!item.file) {
        setStatus(`リモートデータ "${item.id}" に file 情報がない。data/index.json を直せ。`);
        return;
      }
      const path = "data/" + item.file;
      setStatus(`リモート data 読み込み中: ${path} …`);
      try {
        const res = await fetch(path);
        if (!res.ok) {
          setStatus(`HTTPエラー: ${res.status}（${path} が読めない）`);
          return;
        }
        const data = await res.json();
        await applyDataset(data, item, replaceWholeBrain);
      } catch (e) {
        console.error(e);
        setStatus(`${path} の取得かパースに失敗。`);
      }
    }

    async function learnFromLocal(item, replaceWholeBrain) {
      const key = "ai_dataset:" + item.id;
      const raw = localStorage.getItem(key);
      if (!raw) {
        setStatus(`ローカルデータ "${item.id}" が見つからない。ストレージを確認しろ。`);
        return;
      }
      try {
        const data = JSON.parse(raw);
        await applyDataset(data, item, replaceWholeBrain);
      } catch (e) {
        console.error(e);
        setStatus(`ローカルデータ "${item.id}" のパースに失敗。`);
      }
    }

    async function applyDataset(data, item, replaceWholeBrain) {
      // フルエクスポート形式
      if (data && typeof data === "object" &&
          "memory" in data && "archive" in data && "nextId" in data) {

        if (!replaceWholeBrain) {
          setStatus(`"${item.label || item.id}" はフルエクスポート形式。追記学習は非対応。置き換えボタンを使え。`);
          return;
        }
        if (!confirm(`"${item.label || item.id}" の内容で現在の脳を丸ごと置き換える。いいな？`)) {
          setStatus("キャンセルした。現状維持。");
          return;
        }
        if (brain.fromDataObject) {
          brain.fromDataObject(data);
        } else {
          brain.memory  = data.memory || [];
          brain.archive = data.archive || { tokenFreq: {}, totalUtterances: 0 };
          brain.nextId  = data.nextId || 1;
          if (brain.save) brain.save();
        }
        setStatus(`フルエクスポート "${item.label || item.id}" を読み込んだ。memory: ${brain.memory.length} 件`);
        return;
      }

      // 対話ペア配列
      if (Array.isArray(data)) {
        let count = 0;
        for (const row of data) {
          if (!row || typeof row !== "object") continue;
          const user = row.user || row.input;
          const bot  = row.bot  || row.output;
          if (typeof user === "string" && typeof bot === "string") {
            brain.learn(user, bot);
            count++;
          }
        }
        setStatus(`"${item.label || item.id}" から ${count} 件を学習した。`);
        return;
      }

      setStatus(`"${item.label || item.id}" の形式が対応外。エクスポート形式か対話配列にしろ。`);
    }

    reloadBtn.addEventListener("click", loadCatalogCombined);

    // 初回読み込み
    loadCatalogCombined();
  }

  window.registerExtension({
    id: "data-catalog",
    title: "data/＋ローカル カタログ",
    init
  });
})();
