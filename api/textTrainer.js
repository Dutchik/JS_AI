// api/textTrainer.js
(function () {
  if (!window.registerExtension) return;

  function splitByLines(raw) {
    return raw
      .split(/\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  function splitBySentences(raw) {
    // 日本語＋記号あたりを適当に区切る
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) return [];

    const parts = text.split(/([。．！？?!])/);
    const out = [];
    let buf = "";

    for (let i = 0; i < parts.length; i += 2) {
      const main = parts[i].trim();
      const punct = parts[i + 1] || "";
      if (!main && !punct) continue;
      const sentence = (main + punct).trim();
      if (sentence) out.push(sentence);
    }
    return out;
  }

  function init(container, brain) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="small">
        テキストを貼り付けて、その内容を丸ごと「知識」として学習させるツール。<br>
        各文を「ユーザー文＝その文」「返答＝同じ文」として登録する。<br>
        あとで似た話題が来たときに、ここで読ませた文を引っ張り出してくるイメージ。
      </div>

      <textarea id="tt_text"
        style="width:100%;min-height:120px;margin-top:8px;
               background:#111;color:#eee;border:1px solid #444;
               padding:6px;font-size:12px;"></textarea>

      <div style="margin-top:6px;">
        <label class="small">分割方法:</label><br>
        <label class="small">
          <input type="radio" name="tt_mode" value="lines" checked>
          1行を1レコードとして学習
        </label><br>
        <label class="small">
          <input type="radio" name="tt_mode" value="sentences">
          文（。！？など）ごとに自動分割して学習
        </label>
      </div>

      <button id="tt_learnBtn"
        style="margin-top:8px;
               background:#333;color:#eee;border:1px solid #555;
               padding:6px 12px;font-size:12px;">
        このテキストを学習させる
      </button>

      <button id="tt_compressBtn"
        style="margin-top:8px;margin-left:4px;
               background:#222;color:#eee;border:1px solid #555;
               padding:6px 12px;font-size:12px;">
        古い学習を圧縮（オプション）
      </button>

      <div id="tt_status" class="small" style="margin-top:8px;color:#aaa;"></div>
    `;
    container.appendChild(wrapper);

    const txt = wrapper.querySelector("#tt_text");
    const btnLearn = wrapper.querySelector("#tt_learnBtn");
    const btnCompress = wrapper.querySelector("#tt_compressBtn");
    const statusEl = wrapper.querySelector("#tt_status");

    function getMode() {
      const r = wrapper.querySelector('input[name="tt_mode"]:checked');
      return r ? r.value : "lines";
    }

    function setStatus(msg) {
      statusEl.textContent = msg;
    }

    btnLearn.addEventListener("click", () => {
      if (!brain) {
        setStatus("モデルが選択されていない。先に上でモデルを選べ。");
        return;
      }
      const raw = txt.value;
      if (!raw.trim()) {
        setStatus("テキストが空だ。何を学習しろと？");
        return;
      }

      const mode = getMode();
      let pieces;
      if (mode === "sentences") {
        pieces = splitBySentences(raw);
      } else {
        pieces = splitByLines(raw);
      }

      if (pieces.length === 0) {
        setStatus("有効な文が見つからない。改行か句点をちゃんと入れてくれ。");
        return;
      }

      let count = 0;
      for (const sentence of pieces) {
        // 「ユーザー文＝その文」「返答＝その文」で登録
        brain.learn(sentence, sentence);
        count++;
      }

      setStatus(`合計 ${count} 件の文を学習した。対話の中で似た話題が来たときに使われる。`);
      txt.value = "";
    });

    btnCompress.addEventListener("click", () => {
      if (!brain || typeof brain.compress !== "function") {
        setStatus("このモデルは圧縮APIを持っていない。");
        return;
      }
      // デフォルトの上限はモデル側任せ
      brain.compress();
      setStatus("古い学習データを圧縮した。頻出単語だけアーカイブに残してメモリを軽くした。");
    });
  }

  window.registerExtension({
    id: "text-trainer",
    title: "テキスト学習",
    init
  });
})();
