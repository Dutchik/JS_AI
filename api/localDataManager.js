// api/localDataManager.js
(function () {
  if (!window.registerExtension) return;

  function init(container, brain) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="small">
        現在のモデルの脳データをエクスポート／インポートするツール。<br>
        ・エクスポート: JSONをファイルとして保存。<br>
        ・インポート: 保存しておいたJSONで脳を置き換える or 追加学習する。<br>
        モデルごとに別ストレージなので、切り替え後も独立して扱える。
      </div>

      <div style="margin-top:10px;">
        <button id="ldm_export">脳をエクスポート（ダウンロード）</button>
      </div>

      <div style="margin-top:10px;">
        <div class="small">JSONファイルからインポート:</div>
        <input type="file" id="ldm_file" accept="application/json" style="font-size:12px;">
        <div style="margin-top:6px;">
          <button id="ldm_import_replace">このファイルで丸ごと置き換え</button>
          <button id="ldm_import_learn">このファイルから追加学習</button>
        </div>
      </div>

      <div id="ldm_status" class="small" style="margin-top:8px;color:#aaa;"></div>
    `;
    container.appendChild(wrapper);

    const exportBtn  = wrapper.querySelector("#ldm_export");
    const fileInput  = wrapper.querySelector("#ldm_file");
    const importRep  = wrapper.querySelector("#ldm_import_replace");
    const importAdd  = wrapper.querySelector("#ldm_import_learn");
    const statusEl   = wrapper.querySelector("#ldm_status");

    function setStatus(msg) {
      statusEl.textContent = msg;
      if (window._updateStats) window._updateStats();
    }

    exportBtn.addEventListener("click", () => {
      try {
        const data = brain.toDataObject ? brain.toDataObject() : {
          memory: brain.memory || [],
          archive: brain.archive || { tokenFreq: {}, totalUtterances: 0 },
          nextId: brain.nextId || 1
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const now = new Date();
        const ts = now.toISOString().replace(/[:.]/g, "-");
        a.href = url;
        a.download = `brain_export_${ts}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatus("エクスポート完了。JSONを保存した。");
      } catch (e) {
        console.error(e);
        setStatus("エクスポート中にエラー。脳の状態を確認しろ。");
      }
    });

    function handleImport(replaceWhole) {
      const file = fileInput.files[0];
      if (!file) {
        setStatus("JSONファイルを選べ。0バイトからは何も学べない。");
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const text = e.target.result;
          const data = JSON.parse(text);

          if (data && typeof data === "object" &&
              "memory" in data && "archive" in data && "nextId" in data) {

            if (replaceWhole) {
              if (!confirm("現在の脳データをこのファイル内容で丸ごと置き換える。よろしいか。")) {
                setStatus("キャンセルした。何も変えていない。");
                return;
              }
              if (brain.fromDataObject) {
                brain.fromDataObject(data);
              } else {
                brain.memory = data.memory || [];
                brain.archive = data.archive || { tokenFreq: {}, totalUtterances: 0 };
                brain.nextId = data.nextId || 1;
                if (brain.save) brain.save();
              }
              setStatus("フルエクスポートからの置き換え完了。");
            } else {
              // 追加学習：memoryを舐める
              let count = 0;
              if (Array.isArray(data.memory)) {
                for (const m of data.memory) {
                  if (!m || typeof m !== "object") continue;
                  if (typeof m.user === "string" && typeof m.bot === "string") {
                    brain.learn(m.user, m.bot);
                    count++;
                  }
                }
              }
              setStatus(`エクスポートファイルから ${count} 件を追加学習した。`);
            }
          } else if (Array.isArray(data)) {
            // 単純な {user,bot} 配列
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
            setStatus(`${count} 件の対話ペアを追加学習した。`);
          } else {
            setStatus("JSONの形式が対応していない。エクスポート形式か user/bot 配列にしろ。");
          }
        } catch (err) {
          console.error(err);
          setStatus("JSONのパースに失敗。フォーマットを見直せ。");
        }
      };
      reader.readAsText(file, "utf-8");
    }

    importRep.addEventListener("click", () => handleImport(true));
    importAdd.addEventListener("click", () => handleImport(false));
  }

  window.registerExtension({
    id: "local-data-manager",
    title: "脳バックアップ／復元",
    init
  });
})();