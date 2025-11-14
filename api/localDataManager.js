// api/localDataManager.js
(function () {
  if (!window.registerExtension) return;

  function init(container, brain) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="small">
        ローカルの学習データ管理。<br>
        ・学習データのダウンロード（JSON）<br>
        ・学習データのアップロード（上書き）<br>
        ・メモリ圧縮（古いログを統計に畳み込み）
      </div>

      <div style="margin-top:10px;">
        <button id="ldm_download">学習データをダウンロード</button>
      </div>

      <div style="margin-top:10px;">
        <input type="file" id="ldm_uploadFile" accept="application/json"
               style="font-size:12px;">
        <button id="ldm_upload">学習データを読み込む（現在の記憶を置き換え）</button>
      </div>

      <div style="margin-top:10px;">
        <label class="small">詳細ログの最大保持件数:</label><br>
        <input type="number" id="ldm_maxKeep" value="500"
               style="width:80px;background:#222;color:#eee;border:1px solid #444;padding:4px;font-size:12px;">
        <button id="ldm_compress">メモリ圧縮を実行</button>
      </div>

      <div style="margin-top:10px;">
        <button id="ldm_clearAll" style="border-color:#a33;color:#f88;">
          全データ削除（memory＋archive）
        </button>
      </div>

      <div id="ldm_status" class="small" style="margin-top:8px;color:#aaa;"></div>
    `;
    container.appendChild(wrapper);

    const status = wrapper.querySelector("#ldm_status");
    const uploadFile = wrapper.querySelector("#ldm_uploadFile");

    function setStatus(msg) {
      status.textContent = msg;
      if (window._updateStats) window._updateStats();
    }

    // ダウンロード
    wrapper.querySelector("#ldm_download").addEventListener("click", () => {
      const data = brain.toDataObject();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `ai_brain_${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("学習データを書き出した。バックアップは裏切らない。");
    });

    // アップロード（置き換え）
    wrapper.querySelector("#ldm_upload").addEventListener("click", () => {
      const file = uploadFile.files[0];
      if (!file) {
        setStatus("JSONファイルを選べ。何もないものは読み込めない。");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const data = JSON.parse(text);
          if (!("memory" in data) || !("archive" in data) || !("nextId" in data)) {
            setStatus("このJSONは期待している形式ではない。memory/archive/nextIdが必要。");
            return;
          }
          if (!confirm("現在の記憶をすべてこのファイルで置き換える。いいな？")) {
            setStatus("キャンセルした。現状維持。");
            return;
          }
          brain.fromDataObject(data);
          setStatus(`学習データを読み込んだ。memory: ${brain.memory.length}件`);
        } catch (err) {
          console.error(err);
          setStatus("JSONのパースに失敗した。中身を確認しろ。");
        }
      };
      reader.readAsText(file, "utf-8");
    });

    // メモリ圧縮
    wrapper.querySelector("#ldm_compress").addEventListener("click", () => {
      const maxKeepInput = wrapper.querySelector("#ldm_maxKeep");
      let maxKeep = parseInt(maxKeepInput.value, 10);
      if (!Number.isFinite(maxKeep) || maxKeep < 0) {
        maxKeep = 500;
        maxKeepInput.value = "500";
      }
      const before = brain.memory.length;
      brain.compress(maxKeep);
      const after = brain.memory.length;
      setStatus(`メモリ圧縮完了。${before}件 → ${after}件。古い会話は統計に畳み込まれた。`);
    });

    // 全削除
    wrapper.querySelector("#ldm_clearAll").addEventListener("click", () => {
      if (!confirm("本当に全部消すぞ？脳みそ初期化だぞ？")) {
        setStatus("キャンセルした。まだ生き延びたいらしい。");
        return;
      }
      brain.memory = [];
      brain.archive = { tokenFreq: {}, totalUtterances: 0 };
      brain.nextId = 1;
      brain.save();
      setStatus("すべての学習データを削除した。真っさらな脳に戻った。");
    });
  }

  window.registerExtension({
    id: "local-data-manager",
    title: "ローカル学習データ管理",
    init
  });
})();
