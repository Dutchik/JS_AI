// models/contextual_brain_v1.js
(function () {
  if (!window.registerModel) return;

  class ContextualBrain {
    constructor(storageKey) {
      this.storageKey = storageKey || "my_ai_brain_contextual_v1";
      this.memory = [];   // { id, user, bot, vecUser, vecBot, ts, corrected }
      this.archive = {
        tokenFreq: {},
        totalUtterances: 0
      };
      this.nextId = 1;

      // 文脈用
      this.contextWindowSize = 6;  // 直近何ターン見るか
    }

    // ===== 基本ユーティリティ =====
    tokenize(text) {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9ぁ-んァ-ン一-龠ー\s？\?]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 0);
    }

    analyze(text) {
      const raw = text;
      const lower = raw.toLowerCase();
      const tokens = this.tokenize(raw);

      const contains = arr => arr.some(w => raw.includes(w) || lower.includes(w));

      const f = {
        topic_work: 0,
        topic_study: 0,
        topic_money: 0,
        topic_relation: 0,
        topic_meta: 0,
        emo_pos: 0,
        emo_neg: 0,
        intent_ask: 0,
        intent_vent: 0,
        intent_plan: 0,
        context_ref: 0,   // 「それ」「さっき」みたいな文脈依存っぽいフラグ
        length_short: 0
      };

      if (tokens.length <= 4) f.length_short = 1;

      if (contains(["仕事", "職場", "会社", "残業", "出社", "上司", "同僚"])) {
        f.topic_work += 2;
      }
      if (contains(["勉強", "試験", "テスト", "アクチュアリー", "数学", "問題集"])) {
        f.topic_study += 2;
      }
      if (contains(["金", "お金", "給料", "年収", "投資", "fx", "株", "資産"])) {
        f.topic_money += 2;
      }
      if (contains(["恋", "彼女", "彼氏", "結婚", "失恋", "付き合う"])) {
        f.topic_relation += 2;
      }
      if (contains(["さっき", "それ", "あれ", "前のやつ", "さっきのやつ", "さっきの話"])) {
        f.context_ref += 2;
      }

      if (contains(["楽しい", "うれしい", "嬉しい", "最高", "助かる", "ありがたい"])) {
        f.emo_pos += 1;
      }
      if (contains(["辛い", "つらい", "しんどい", "だるい", "無理", "最悪"])) {
        f.emo_neg += 1;
      }

      if (contains(["？", "?", "どう思う", "どうすれば", "教えて", "なに", "何"])) {
        f.intent_ask += 1;
      }
      if (contains(["疲れた", "しんどい", "ムカつく", "むかつく", "イライラ", "やってられない"])) {
        f.intent_vent += 1;
      }
      if (contains(["やる", "やってみる", "やめる", "続ける", "計画", "スケジュール"])) {
        f.intent_plan += 1;
      }

      if (contains(["このモデル", "AI", "お前", "システム", "モデル", "学習"])) {
        f.topic_meta += 2;
      }

      return { tokens, features: f };
    }

    textToVector(text) {
      const { tokens, features: f } = this.analyze(text);
      const vec = {};

      for (const t of tokens) {
        vec[t] = (vec[t] || 0) + 1;
      }

      // 2-gram（少しだけ文脈）
      for (let i = 0; i < tokens.length - 1; i++) {
        const bi = tokens[i] + "_" + tokens[i + 1];
        vec[bi] = (vec[bi] || 0) + 1;
      }

      function addFeat(name, value, scale) {
        if (!value) return;
        const key = "__" + name.toUpperCase() + "__";
        vec[key] = (vec[key] || 0) + value * scale;
      }

      addFeat("topic_work", f.topic_work, 1.5);
      addFeat("topic_study", f.topic_study, 1.5);
      addFeat("topic_money", f.topic_money, 1.5);
      addFeat("topic_relation", f.topic_relation, 1.5);
      addFeat("topic_meta", f.topic_meta, 1.2);

      addFeat("emo_pos", f.emo_pos, 1.0);
      addFeat("emo_neg", f.emo_neg, 1.0);

      addFeat("intent_ask", f.intent_ask, 1.0);
      addFeat("intent_vent", f.intent_vent, 1.2);
      addFeat("intent_plan", f.intent_plan, 1.0);

      addFeat("context_ref", f.context_ref, 1.8);
      addFeat("length_short", f.length_short, 0.8);

      return vec;
    }

    cosineSimilarity(a, b) {
      let dot = 0;
      let na = 0;
      let nb = 0;
      for (const k in a) {
        const x = a[k];
        na += x * x;
        if (k in b) dot += x * b[k];
      }
      for (const k in b) {
        const y = b[k];
        nb += y * y;
      }
      if (na === 0 || nb === 0) return 0;
      return dot / (Math.sqrt(na) * Math.sqrt(nb));
    }

    // ===== 文脈関連 =====

    getRecentContextVec(maxTurns) {
      const N = typeof maxTurns === "number" ? maxTurns : this.contextWindowSize;
      const start = Math.max(0, this.memory.length - N);
      let acc = {};
      let count = 0;

      for (let i = start; i < this.memory.length; i++) {
        const m = this.memory[i];
        if (!m || !m.vecUser) continue;
        count++;
        for (const k in m.vecUser) {
          acc[k] = (acc[k] || 0) + m.vecUser[k];
        }
      }
      if (count === 0) return null;

      // 平均
      for (const k in acc) {
        acc[k] /= count;
      }
      return acc;
    }

    isContextDependent(text) {
      const { tokens, features: f } = this.analyze(text);
      if (f.context_ref > 0) return true;
      if (tokens.length <= 3) return true;
      return false;
    }

    // ===== 学習 =====
    learn(userText, botText) {
      const vecUser = this.textToVector(userText);
      const vecBot  = this.textToVector(botText);
      const item = {
        id: this.nextId++,
        user: userText,
        bot: botText,
        corrected: false,
        ts: Date.now(),
        vecUser,
        vecBot
      };
      this.memory.push(item);
      this.save();
      return item.id;
    }

    learnCorrection(id, correctedBotText) {
      const item = this.memory.find(m => m.id === id);
      if (!item) return;
      item.bot = correctedBotText;
      item.corrected = true;
      item.ts = Date.now();
      item.vecBot = this.textToVector(correctedBotText);
      this.save();
    }

    // ===== 返答生成 =====
    findBestReply(userText) {
      if (this.memory.length === 0) return null;

      const currVec = this.textToVector(userText);
      const ctxVec  = this.getRecentContextVec(this.contextWindowSize);
      const contextMode = this.isContextDependent(userText);

      let best = null;
      let bestScore = -1;

      const now = Date.now();

      for (const m of this.memory) {
        // 時間減衰（新しい方を少し優遇）
        const dtHours = (now - m.ts) / (1000 * 60 * 60);
        const timeWeight = 1 / (1 + dtHours / 24); // 1日ごとにちょっとずつ落ちる

        // 1) 現在入力と過去ユーザ発話の類似度
        const sCurr = this.cosineSimilarity(currVec, m.vecUser);

        // 2) 文脈ベクトルと過去ユーザ発話の類似度
        let sCtx = 0;
        if (ctxVec) {
          sCtx = this.cosineSimilarity(ctxVec, m.vecUser);
        }

        // 文脈依存度で重みを変える
        let score;
        if (contextMode) {
          // 「それさ」「さっきの」みたいなときは文脈寄り
          score = 0.3 * sCurr + 0.7 * sCtx;
        } else {
          // 普通は現在発話メイン
          score = 0.7 * sCurr + 0.3 * sCtx;
        }

        // 修正済みは少し優遇
        if (m.corrected) score += 0.1;

        // 時間減衰をかける
        score *= (0.7 + 0.3 * timeWeight);

        if (score > bestScore) {
          bestScore = score;
          best = m;
        }
      }

      if (bestScore < 0.15) return null;
      return best.bot;
    }

    reply(userText) {
      // まず文脈込みの類似検索
      const candidate = this.findBestReply(userText);
      if (candidate) return candidate;

      // 文脈で拾えなかった時の最低限の汎用返答
      if (this.isContextDependent(userText)) {
        return "直前までの話を踏まえたコメントなら、もう少しだけ具体的に言葉を足してくれ。そうすれば文脈に沿って返せる。";
      }

      // それでもダメならデフォルト
      return "この文脈のパターンはまだ十分学習できていない。お前の方で理想的な返答を書いて、修正学習させてくれ。";
    }

    // ===== 圧縮 =====
    compress(maxKeep = 800) {
      if (this.memory.length <= maxKeep) return;
      const excess = this.memory.length - maxKeep;
      const old = this.memory.slice(0, excess);
      const keep = this.memory.slice(excess);

      for (const m of old) {
        const { tokens: tUser } = this.analyze(m.user);
        const { tokens: tBot }  = this.analyze(m.bot);
        const all = tUser.concat(tBot);
        for (const tok of all) {
          this.archive.tokenFreq[tok] = (this.archive.tokenFreq[tok] || 0) + 1;
        }
        this.archive.totalUtterances += 1;
      }

      this.memory = keep;
      this.save();
    }

    // ===== 保存／復元 =====
    toDataObject() {
      return {
        memory: this.memory,
        archive: this.archive,
        nextId: this.nextId
      };
    }

    fromDataObject(data) {
      this.memory  = Array.isArray(data.memory) ? data.memory : [];
      this.archive = data.archive || { tokenFreq: {}, totalUtterances: 0 };
      this.nextId  = typeof data.nextId === "number" ? data.nextId : 1;
      this.save();
    }

    save() {
      try {
        const data = this.toDataObject();
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      } catch (e) {
        console.error("保存エラー:", e);
      }
    }

    load() {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        this.fromDataObject(data);
      } catch (e) {
        console.error("ロードエラー:", e);
      }
    }
  }

  window.registerModel({
    id: "contextual_v1",
    name: "コンテキストモデル v1",
    description: "直近の会話履歴をベクトル化して重み付けし、文脈込みで類似検索するモデル。",
    createInstance(storageKey) {
      const b = new ContextualBrain(storageKey);
      b.load();
      return b;
    }
  });
})();
