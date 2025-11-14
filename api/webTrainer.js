// api/webTrainer.js
(function () {
  if (!window.registerExtension) return;

  function init(container, brain) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="small">
        ネット上のJSONから学習させるツール。<br>
        ・CORSの制限があるので、許可されてないサイトは読めない。<br>
        ・対応形式：<br>
        &nbsp;1) このAIのエクスポートJSON（memory, archive, nextId）<br>
        &nbsp;2) 配列形式: [{ "user": "...", "bot": "..." }, ...] または [{ "input": "...", "output": "..." }, ...]
      </div>

      <div style="margin-top:10px;">
        <label class="small">JSON URL:</label><br>
        <input id="wt_url" type="text"
               style="width:100%;box-sizing:border-box;background:#222;color:#eee;border:1px solid #444;padding:6px;font-size:13px;"
               placeholder="https://example.com/dataset.json">
        <button id="wt_fetchBtn">読み込んで学習</button>
      </div>

      <div id="wt_status" class="small" style="margin-top:8px;color:#aaa;"></div>

      <div style="margin-top:12px;" class="small">
        読み込み方法：<br>
        ・形式1なら「脳みそを丸ごと上書き」。<br>
        ・形式2なら、既存の記憶に「対話ペア」を追加学習。<br>
        自分のデータを吹き飛ばしたくないなら、形式2の方を使え。
      </div>
    `;

    container.appendChild(wrapper);

    const urlInput = wrapper.querySelector("#wt_url");
    const fetchBtn = wrapper.querySelector("#wt_fetchBtn");
    const status = wrapper.querySelector("#wt_status");

    function setStatus(msg) {
      status.textContent = msg;
      if (window._updateStats) window._updateStats();
    }

    fetchBtn.addEventListener("click", async () => {
      const url = urlInput.value.trim();
      if (!url) {
        setStatus("URLを入れろ。空虚は学習できない。");
        return;
      }
      setStatus("取得中…");

      try {
        const res = await fetch(url);
        if (!res.ok) {
          setStatus(`HTTPエラー: ${res.status}`);
          return;
        }
        const data = await res.json();

        // パターン1：エクスポート形式
        if (data && typeof data === "object" &&
            "memory" in data && "archive" in data && "nextId" in data) {
          if (!confirm("これは脳みそ丸ごとのエクスポート形式っぽい。今の記憶を置き換えてもいいか？")) {
            setStatus("キャンセルした。現状維持。");
            return;
          }
          brain.fromDataObject(data);
          setStatus(`エクスポートデータを読み込んだ。memory: ${brain.memory.length}件`);
          return;
        }

        // パターン2：配列形式の対話ペア
        if (Array.isArray(data)) {
          let count = 0;
          for (const item of data) {
            if (!item || typeof item !== "object") continue;
            const user = item.user || item.input;
            const bot  = item.bot  || item.output;
            if (typeof user === "string" && typeof bot === "string") {
              brain.learn(user, bot);
              count++;
            }
          }
          setStatus(`配列形式データから ${count} 件を学習した。`);
          return;
        }

        setStatus("対応していないJSON形式だった。構造を見直せ。");
      } catch (e) {
        console.error(e);
        setStatus("取得かパースに失敗した。CORSかJSONフォーマットを疑え。");
      }
    });
  }

  window.registerExtension({
    id: "web-trainer",
    title: "Web学習（JSON）",
    init
  });
})();
