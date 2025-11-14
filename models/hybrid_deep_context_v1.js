// models/hybrid_deep_context_v1.js
(function () {
  if (!window.registerModel) return;

  class HybridDeepContextBrain {
    constructor(storageKey) {
      this.storageKey = storageKey || "my_ai_brain_hybrid_deep_context_v1";
      /**
       * memory要素:
       * {
       *   id, user, bot, ts, corrected,
       *   vecUser, tokensUser, meta
       * }
       */
      this.memory = [];
      this.archive = {
        tokenFreq: {},
        totalUtterances: 0
      };
      this.nextId = 1;

      this.contextWindowSize = 8;  // 直近何ターンを見るか
    }

    // ====== 基本ユーティリティ ======

    tokenize(text) {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9ぁ-んァ-ン一-龠ー\s？\?]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 0);
    }

    charNgrams(text, n) {
      const raw = text
        .replace(/\s+/g, "")
        .toLowerCase();
      const arr = [];
      for (let i = 0; i <= raw.length - n; i++) {
        arr.push(raw.slice(i, i + n));
      }
      return arr;
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
        risk: 0,
        context_ref: 0,
        length_short: 0
      };

      if (tokens.length <= 3) f.length_short = 1;

      // トピック
      if (contains(["仕事", "職場", "会社", "残業", "出社", "上司", "同僚"])) {
        f.topic_work += 2;
      }
      if (contains(["勉強", "試験", "テスト", "アクチュアリー", "数学", "問題集"])) {
        f.topic_study += 2;
      }
      if (contains(["金", "お金", "給料", "年収", "投資", "fx", "株", "資産", "為替"])) {
        f.topic_money += 2;
      }
      if (contains(["恋", "彼女", "彼氏", "結婚", "失恋", "付き合う", "恋愛"])) {
        f.topic_relation += 2;
      }
      if (contains(["このモデル", "ai", "お前", "システム", "モデル", "学習", "アルゴリズム"])) {
        f.topic_meta += 2;
      }

      // 感情
      if (contains(["楽しい", "嬉しい", "うれしい", "最高", "助かる", "ありがたい"])) {
        f.emo_pos += 1;
      }
      if (contains(["辛い", "つらい", "しんどい", "だるい", "無理", "最悪", "しにたい", "死にたい", "消えたい"])) {
        f.emo_neg += 1;
      }

      // 意図
      if (contains(["？", "?", "どう思う", "どうすれば", "教えて", "なに", "何"])) {
        f.intent_ask += 1;
      }
      if (contains(["疲れた", "しんどい", "ムカつく", "むかつく", "イライラ", "やってられない", "限界"])) {
        f.intent_vent += 1;
      }
      if (contains(["やる", "やってみる", "やめる", "続ける", "計画", "スケジュール", "プラン"])) {
        f.intent_plan += 1;
      }

      // 文脈依存っぽい表現
      if (contains(["さっき", "それ", "あれ", "前のやつ", "さっきのやつ", "さっきの話", "さっきの続き"])) {
        f.context_ref += 2;
      }

      // リスク
      if (contains(["死にたい", "消えたい", "自殺", "終わりたい", "生きたくない"])) {
        f.risk += 3;
      }

      return { tokens, features: f };
    }

    textToVector(text) {
      const { tokens, features: f } = this.analyze(text);
      const vec = {};

      // 単語
      for (const t of tokens) {
        vec[t] = (vec[t] || 0) + 1;
      }

      // 2-gram
      for (let i = 0; i < tokens.length - 1; i++) {
        const bi = tokens[i] + "_" + tokens[i + 1];
        vec[bi] = (vec[bi] || 0) + 1;
      }

      // 文字3-gram
      const c3 = this.charNgrams(text, 3);
      for (const g of c3) {
        const key = "#c3_" + g;
        vec[key] = (vec[key] || 0) + 0.5;
      }

      // 特徴量を次元として追加
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
      addFeat("intent_vent", f.intent_vent, 1.3);
      addFeat("intent_plan", f.intent_plan, 1.0);

      addFeat("context_ref", f.context_ref, 2.0);
      addFeat("length_short", f.length_short, 0.6);

      addFeat("risk", f.risk, 2.5);

      return { vec, tokens, meta: f };
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

    jaccard(tokensA, tokensB) {
      if (!tokensA || !tokensB || tokensA.length === 0 || tokensB.length === 0) return 0;
      const setA = new Set(tokensA);
      const setB = new Set(tokensB);
      let inter = 0;
      for (const x of setA) {
        if (setB.has(x)) inter++;
      }
      const union = setA.size + setB.size - inter;
      if (union === 0) return 0;
      return inter / union;
    }

    // ===== 文脈関連 =====

    getRecentContextVec(maxTurns) {
      const N = typeof maxTurns === "number" ? maxTurns : this.contextWindowSize;
      const start = Math.max(0, this.memory.length - N);
      let acc = {};
      let tokenBag = [];
      let count = 0;

      for (let i = start; i < this.memory.length; i++) {
        const m = this.memory[i];
        if (!m || !m.vecUser) continue;
        count++;
        // ベクトル
        for (const k in m.vecUser) {
          acc[k] = (acc[k] || 0) + m.vecUser[k];
        }
        // トークン
        if (Array.isArray(m.tokensUser)) {
          tokenBag = tokenBag.concat(m.tokensUser);
        }
      }
      if (count === 0) return null;

      for (const k in acc) {
        acc[k] /= count;
      }
      return { vec: acc, tokens: tokenBag };
    }

    isContextDependent(text) {
      const { tokens, features: f } = this.analyze(text);
      if (f.context_ref > 0) return true;
      if (tokens.length <= 3) return true;
      return false;
    }

    // ===== 学習 =====

    learn(userText, botText) {
      const encUser = this.textToVector(userText);
      const item = {
        id: this.nextId++,
        user: userText,
        bot: botText,
        corrected: false,
        ts: Date.now(),
        vecUser: encUser.vec,
        tokensUser: encUser.tokens,
        meta: encUser.meta
      };
      this.memory.push(item);
      this.save();
      return item.id;
    }

    learnCorrection(id, correctedBotText) {
      const item = this.memory.find(m => m.id === id);
      if (!item) return;
      // bot側のベクトルは使ってないが、将来拡張用に計算してもいい
      const encBot = this.textToVector(correctedBotText);
      item.bot = correctedBotText;
      item.corrected = true;
      item.ts = Date.now();
      item.metaBot = encBot.meta;
      this.save();
    }

    // ===== スコアリング＋検索 =====

    findBestReply(userText) {
      if (this.memory.length === 0) return null;

      const encCurr = this.textToVector(userText);
      const isCtxDep = this.isContextDependent(userText);
      const ctx = this.getRecentContextVec(this.contextWindowSize);

      // クエリベクトル = 現在 + 文脈
      let queryVec = {};
      let queryTokens = encCurr.tokens.slice();

      const alpha = isCtxDep ? 0.4 : 0.7;
      const beta  = isCtxDep ? 0.6 : 0.3;

      // 現在発話を足す
      for (const k in encCurr.vec) {
        queryVec[k] = (queryVec[k] || 0) + alpha * encCurr.vec[k];
      }

      // 文脈を足す
      if (ctx && ctx.vec) {
        for (const k in ctx.vec) {
          queryVec[k] = (queryVec[k] || 0) + beta * ctx.vec[k];
        }
        if (Array.isArray(ctx.tokens)) {
          queryTokens = queryTokens.concat(ctx.tokens);
        }
      }

      // トピック類似度用
      const qMeta = encCurr.meta;

      let best = null;
      let bestScore = -1;

      const now = Date.now();

      for (const m of this.memory) {
        // 時間の重み
        const dtHours = (now - m.ts) / (1000 * 60 * 60);
        const timeWeight = 1 / (1 + dtHours / 48); // 2日単位で少しずつ落ちる

        // ベクトル類似度
        const sVec = this.cosineSimilarity(queryVec, m.vecUser);

        // トークンJaccard
        const sJac = this.jaccard(encCurr.tokens, m.tokensUser);

        // トピック方向の一致
        let topicScore = 0;
        if (m.meta && qMeta) {
          const topicKeys = [
            "topic_work",
            "topic_study",
            "topic_money",
            "topic_relation",
            "topic_meta"
          ];
          for (const k of topicKeys) {
            const a = qMeta[k] || 0;
            const b = m.meta[k] || 0;
            if (a > 0 && b > 0) topicScore += 1;
          }
          topicScore = topicScore / topicKeys.length;
        }

        let score =
          0.55 * sVec +
          0.25 * sJac +
          0.10 * topicScore;

        if (m.corrected) score += 0.08;

        score *= (0.7 + 0.3 * timeWeight);

        if (score > bestScore) {
          bestScore = score;
          best = m;
        }
      }

      if (!best || bestScore < 0.18) return null;
      return best.bot;
    }

    // ===== 返答生成 =====

    reply(userText) {
      const enc = this.textToVector(userText);
      const f = enc.meta;

      // 高リスク発言の優先対応
      if (f.risk > 0) {
        return "命を削るほど価値のある仕事も試験もない。今の状態はひとりで抱えるには重すぎる。身近な人間か、メンタルの専門家、相談窓口のどれかに今すぐ話せ。生き延びてから、ゆっくり反撃の準備をすればいい。";
      }

      // 会話内容に特化した一部ハードコード
      if (f.topic_study > 0 && userText.includes("アクチュアリー")) {
        return "アクチュアリーは『全部わかる』前提で挑むと潰れる。取る分野・捨てる分野を決めて、合格点を取りに行く試験だ。完璧主義じゃなく、合格主義で設計しろ。";
      }
      if (f.topic_work > 0 && userText.includes("辞めたい")) {
        return "仕事を辞めたいのは異常じゃない。ただ、感情だけで辞めると次の場所でも同じことを繰り返す。何が一番の毒かを具体化して、それを減らせる転職先か、配置転換か、交渉余地があるかを冷静に洗い出せ。";
      }

      const candidate = this.findBestReply(userText);
      if (candidate) return candidate;

      if (this.isContextDependent(userText)) {
        return "さっきまでの話を指しているなら、もう一段だけ具体的に書いてくれ。キーワードを2〜3個足してくれれば、文脈に合わせて返せる。";
      }

      if (f.topic_meta > 0 && f.intent_ask > 0) {
        return "このモデルは、過去の対話をベクトル化して、現在の入力＋直近の文脈に一番近いものを探して返している。ズレた返答をしたら、理想的な返答をお前が書いて修正学習させれば、その分だけ賢くなる。";
      }

      return "そのパターンはまだ十分なサンプルがない。お前の理想の返答を書いて修正ボタンを押せ。それがこのモデルにとって最良の学習データになる。";
    }

    // ===== 圧縮 =====

    compress(maxKeep = 1200) {
      if (this.memory.length <= maxKeep) return;
      const excess = this.memory.length - maxKeep;
      const old = this.memory.slice(0, excess);
      const keep = this.memory.slice(excess);

      for (const m of old) {
        const tokens = []
          .concat(m.tokensUser || [])
          .concat(this.tokenize(m.bot || ""));
        for (const tok of tokens) {
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
    id: "hybrid_deep_context_v1",
    name: "ハイブリッド深層コンテキスト v1",
    description: "トークン／n-gram／感情・話題ラベル＋文脈ベクトルを組み合わせた高精度類似検索モデル。",
    createInstance(storageKey) {
      const b = new HybridDeepContextBrain(storageKey);
      b.load();
      return b;
    }
  });
})();
