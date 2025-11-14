// api/datasetUploader.js
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

  function saveLocalCatalog(catalog) {
    try {
      localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
    } catch (e) {
      console.error("catalog save error", e);
    }
  }

  function upsertDatasetMeta(meta) {
    const catalog = loadLocalCatalog();
    const idx = catalog.findIndex(x => x.id === meta.id);
    if (idx >= 0) catalog[idx] = meta;
    else catalog.push(meta);
    saveLocalCatalog(catalog);
  }

  function init(container, brain) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="small">
        JSONファイルをアップロードして「データセット」として登録する拡張。<br>
        ・実データは localStorage に保存。<br>
        ・カタログは dataCatalog 拡張と共有され、そこから学習に使える。<br>
        形式はエクスポート形式 or user/bot 配列のどちらか。
      </div>

      <div style="margin-top:10px;">
        <input type="file" id="du_file" accept="application/json" style="font-size:12px;">
      </div>

      <div style="margin-top:10px;">
        <label class="small">ID（省略時はファイル名から自動）</label><br>
        <input type="text" id="du_id"
               style="width:220px;background:#222;color:#eee;border:1px solid #444;padding:4px;font-size:12px;">
      </div>

      <div style="margin-top:10px;">
        <label class="small">ラベル（メニュー表示名）</label><br>
        <input type="text" id="du_label"
               style="width:100%;background:#222;color:#eee;border:1px solid #444;padding:4px;font-size:12px;">
      </div>

      <div style="margin-top:10px;">
        <label class="small">説明（任意）</label><br>
        <textarea id="du_desc" rows="2"
                  style="width:100%;background:#222;color:#eee;border:1px solid #444;padding:4px;font-size:12px;"></textarea>
      </div>

      <div style="margin-top:10px;">
        <button id="du_store">アップロードして登録</button>
      </div>

      <div id="du_status" class="small" style="margin-top:8px;color:#aaa;"></div>
    `;
    container.appendChild(wrapper);

    const fileInput = wrapper.querySelector("#du_file");
    const idInput   = wrapper.querySelector("#du_id");
    const labelInput= wrapper.querySelector("#du_label");
    const descInput = wrapper.querySelector("#du_desc");
    const statusEl  = wrapper.querySelector("#du_status");
    const storeBtn  = wrapper.querySelector("#du_store");

    function setStatus(msg) {
      statusEl.textContent = msg;
      if (window._updateStats) window._updateStats();
    }

    storeBtn.addEventListener("click", () => {
      const file = fileInput.files[0];
      if (!file) {
        setStatus("JSONファイルを選べ。空気は学習できない。");
        return;
      }

      const reader = new FileReader();
      reader.onload = e => {
        try {
          const text = e.target.result;
          const data = JSON.parse(text);

          let id = idInput.value.trim();
          if (!id) {
            const name = file.name || "dataset";
            id = name.replace(/\.json$/i, "");
          }
          const label = labelInput.value.trim() || id;
          const desc  = descInput.value.trim();

          const datasetKey = "ai_dataset:" + id;
          localStorage.setItem(datasetKey, JSON.stringify(data));

          upsertDatasetMeta({
            id,
            label,
            description: desc,
            storage: "local"
          });

          setStatus(`ローカルデータセット "${label}" を登録した（ID: ${id}）。`);
        } catch (err) {
          console.error(err);
          setStatus("JSONのパースに失敗。フォーマットを確認しろ。");
        }
      };
      reader.readAsText(file, "utf-8");
    });
  }

  window.registerExtension({
    id: "dataset-uploader",
    title: "ローカルデータセット追加",
    init
  });
})();
