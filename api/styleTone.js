// api/styleTone.js
(function () {
  if (!window.registerExtension) return;

  // デフォルト保証
  if (!window.aiStyle) {
    window.aiStyle = {
      mode: "normal",
      suffix: "",
      apply(text) { return text; }
    };
  }

  // ====== フィルタ生成 ======
  function makeSuffixFilter(suffix) {
    return function (text) {
      if (!text || !suffix) return text;

      return text
        .split(/\n+/)
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          // すでに語尾がついてたら重複回避
          if (trimmed.endsWith(suffix)) return line;

          // 文末記号抽出
          const m = trimmed.match(/^(.*?)([。．\.！!？\?」']*)$/);
          if (!m) return trimmed + suffix;
          const body = m[1];
          const tail = m[2] || "";
          return body + suffix + tail;
        })
        .join("\n");
    };
  }

  function makeNormalFilter() {
    return function (text) {
      return text;
    };
  }

  function applyMode(mode, suffix) {
    window.aiStyle.mode = mode;
    window.aiStyle.suffix = suffix || "";

    if (mode === "suffix" && suffix) {
      window.aiStyle.apply = makeSuffixFilter(suffix);
    } else {
      window.aiStyle.apply = makeNormalFilter();
    }
  }

  // ====== UI構築 ======
  function init(container, brain) {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div class="small">
        AI返答の語尾を自由に変更できるフィルタ。<br>
        ・学習には素の返答だけ使うため、学習データは汚れない。<br>
        ・表示時のみ語尾を合成する。
      </div>

      <div style="margin-top:10px;">
        <label class="small">モード選択</label><br>
        <select id="st_mode"
          style="background:#222;color:#eee;border:1px solid #444;padding:4px;font-size:12px;">
          <option value="normal">ノーマル</option>
          <option value="suffix">語尾カスタム</option>
        </select>
      </div>

      <div style="margin-top:8px;">
        <label class="small">語尾を入力（例：にゃん / ですわ / っす / だワン）</label>
        <input id="st_suffix" type="text"
               style="width:180px;background:#222;color:#eee;border:1px solid #444;padding:4px;font-size:12px;" />
      </div>

      <button id="st_applyBtn"
        style="margin-top:8px;background:#333;color:#eee;border:1px solid #555;padding:6px 12px;font-size:12px;">
        設定を反映
      </button>

      <div style="margin-top:8px;">
        <label class="small">プリセット</label><br>
        <button class="st_preset" data-suffix="にゃん"
          style="background:#222;color:#eee;border:1px solid #444;padding:4px;font-size:11px;">にゃん</button>
        <button class="st_preset" data-suffix="だぜ"
          style="background:#222;color:#eee;border:1px solid #444;padding:4px;font-size:11px;">だぜ</button>
        <button class="st_preset" data-suffix="ですわ"
          style="background:#222;color:#eee;border:1px solid #444;padding:4px;font-size:11px;">ですわ</button>
      </div>

      <div id="st_status" class="small" style="margin-top:8px;color:#aaa;"></div>
    `;
    container.appendChild(wrapper);

    const modeSelect = wrapper.querySelector("#st_mode");
    const suffixInput = wrapper.querySelector("#st_suffix");
    const applyBtn = wrapper.querySelector("#st_applyBtn");
    const statusEl = wrapper.querySelector("#st_status");

    function setStatus(t) {
      statusEl.textContent = t;
    }

    // 現在設定反映
    modeSelect.value = window.aiStyle.mode === "suffix" ? "suffix" : "normal";
    suffixInput.value = window.aiStyle.suffix || "";

    function applyCurrent() {
      const m = modeSelect.value;
      const suf = suffixInput.value.trim();

      if (m === "suffix" && suf.length === 0) {
        setStatus("語尾が空だ。何を付ける気だ？");
        return;
      }

      applyMode(m, suf);

      if (m === "normal") {
        setStatus("ノーマルモード。語尾変更なし。");
      } else {
        setStatus(`語尾「${suf}」モード有効。内容が真面目でも容赦なく付くぞ。`);
      }
    }

    applyBtn.addEventListener("click", applyCurrent);

    // プリセット
    wrapper.querySelectorAll(".st_preset").forEach(btn => {
      btn.addEventListener("click", () => {
        suffixInput.value = btn.dataset.suffix;
        modeSelect.value = "suffix";
        applyCurrent();
      });
    });

    // 初期適用
    applyCurrent();
  }

  window.registerExtension({
    id: "style-tone",
    title: "口調フィルタ（語尾カスタム）",
    init
  });
})();
