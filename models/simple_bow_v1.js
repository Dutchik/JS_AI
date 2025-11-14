// models/simple_bow_v1.js
(function () {
  if (!window.registerModel) return;

  class SimpleBowBrain {
    constructor(storageKey) {
      this.storageKey = storageKey || "my_ai_brain_simple_v1";
      this.memory = [];
      this.archive = {
        tokenFreq: {},
        totalUtterances: 0
      };
      this.nextId = 1;
    }

    tokenize(text) {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9ぁ-んァ-ン一-龠ー\s]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 0);
    }

    textToVector(text) {
      const tokens = this.tokenize(text);
      const vec = {};
      for (const t of tokens) {
        vec[t] = (vec[t] || 0) + 1;
      }
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

    learn(userText, botText) {
      const vec = this.textToVector(userText);
      const item = {
        id: this.nextId++,
        user: userText,
        bot: botText,
        corrected: false,
        ts: Date.now(),
        vec
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
      this.save();
    }

    findNearestReply(userText) {
      if (this.memory.length === 0) return null;
      const v = this.textToVector(userText);
      let best = null;
      let bestScore = -1;

      for (const m of this.memory) {
        const sim = this.cosineSimilarity(v, m.vec);
        let score = sim;
        if (m.corrected) score += 0.1;
        if (score > bestScore) {
          bestScore = score;
          best = m;
        }
      }

      if (bestScore < 0.2) return null;
      return best.bot;
    }

    reply(userText) {
      if (userText.includes("疲れた")) {
        return "疲れたのは分かるが、何もせずに寝ると自己嫌悪がセットで付いてくる。5分だけ何かやってから倒れろ。";
      }
      if (userText.includes("やる気")) {
        return "やる気は行動の結果として生まれる。まず1行やれ。それすらやらないなら、やる気の話をする資格もない。";
      }

      const learned = this.findNearestReply(userText);
      if (learned) return learned;

      return "まだそのパターンは学習してない。お前が修正してくれれば、次からは覚える。";
    }

    compress(maxKeep = 500) {
      if (this.memory.length <= maxKeep) return;

      const excess = this.memory.length - maxKeep;
      const old = this.memory.slice(0, excess);
      const keep = this.memory.slice(excess);

      for (const m of old) {
        const tokensUser = this.tokenize(m.user);
        const tokensBot  = this.tokenize(m.bot);
        const tokens = tokensUser.concat(tokensBot);
        for (const tok of tokens) {
          this.archive.tokenFreq[tok] = (this.archive.tokenFreq[tok] || 0) + 1;
        }
        this.archive.totalUtterances += 1;
      }

      this.memory = keep;
      this.save();
    }

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
        localStorage.setItem(this.storageKey, JSON.stringify(this.toDataObject()));
      } catch (e) {
        console.error("保存エラー：", e);
      }
    }

    load() {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        this.fromDataObject(data);
      } catch (e) {
        console.error("ロードエラー：", e);
      }
    }
  }

  window.registerModel({
    id: "simple_bow_v1",
    name: "シンプルBoWモデル v1",
    description: "Bag-of-Words＋コサイン類似度の素朴モデル。挙動は一番分かりやすい。",
    createInstance(storageKey) {
      const b = new SimpleBowBrain(storageKey);
      b.load();
      return b;
    }
  });
})();
