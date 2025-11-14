// api/webTrainer.js
(function () {
  if (!window.registerExtension) return;

  function init(container, brain) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="small">
        テキストをまとめて貼り付けて、簡易ルールで学習させるツール。<br>
        ・1行を「ユーザー発話」として登録し、応答は自動生成 or 手動テンプレ。<br>
        ・すでに対話ペア形式(user\tbot)なら、そのまま学習に使う。<br>
        Webからコピペしてぶち込む用途向け。
      </div>

      <div style="margin-top:10px;">
        <textarea id="wt_text" rows="10"
          style="width:100%;background:#222;color:#eee;border:1px solid #444;padding:8px;font-size:12px;"
          placeholder="1行1サンプルで貼り付け。&#10;・形式1: ユーザ発話のみの行&#10;・形式2: ユーザ発話[TAB]Bot応答 の行"></textarea>
      </div>

      <div style="margin-top:6px;">
        <label class="small">
          Bot応答が書かれていない行のデフォルト応答テンプレ（{user} がユーザー発話に置換される）:
        </label><br>
        <input id="wt_template" type="text"
          style="width:100%;background:#222;color:#eee;border:1px solid:#444;padding:4px;font-size:12px;"
          value="『{user}』についてはまだちゃんと学習してないが、お前がそう入力したことだけは覚えた。">
      </div>

      <div style="margin-top:8px;">
        <button id="wt_learn">このテキストから学習</button>
      </div>

      <div id="wt_status" class="small" style="margin-top:8px;color:#aaa;"></div>
    `;
    container.appendChild(wrapper);

    const textArea  = wrapper.querySelector("#wt_text");
    const tmplInput = wrapper.querySelector("#wt_template");
    const learnBtn  = wrapper.querySelector("#wt_learn");
    const statusEl  = wrapper.querySelector("#wt_status");

    function setStatus(msg) {
      statusEl.textContent = msg;
      if (window._updateStats) window._updateStats();
    }

    learnBtn.addEventListener("click", () => {
      const raw = textArea.value;
      if (!raw.trim()) {
        setStatus("テキストが空だ。まず何か貼れ。");
        return;
      }
      const tmpl = tmplInput.value || "『{user}』を覚えた。";

      const lines = raw.split(/\r?\n/);
      let count = 0;

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // user[TAB]bot 形式
        const tabIdx = line.indexOf("\t");
        let user, bot;
        if (tabIdx >= 0) {
          user = line.slice(0, tabIdx).trim();
          bot  = line.slice(tabIdx + 1).trim();
        } else {
          user = line;
          bot  = tmpl.replace("{user}", user);
        }
        if (!user || !bot) continue;

        brain.learn(user, bot);
        count++;
      }

      setStatus(`${count} 件のサンプルを学習した。`);
    });
  }

  window.registerExtension({
    id: "web-trainer",
    title: "テキスト一括学習",
    init
  });
})();