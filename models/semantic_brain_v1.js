// models/semantic_brain_v1.js
(function () {
  if (!window.registerModel) return;

  class SemanticBrain {
    constructor(storageKey) {
      this.storageKey = storageKey || "my_ai_brain_semantic_v1";
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
        neg: 0,
        desire: 0,
        emo_pos: 0,
        emo_neg: 0,
        stress: 0,
        anger: 0,
        risk: 0,
        first: 0,
        second: 0,
        third: 0,
        tense_past: 0,
        tense_future: 0,
        tense_present: 0,
        intensity: 0,
        intent_ask: 0,
        intent_vent: 0,
        intent_want: 0,
        intent_action: 0,
        topic_work: 0,
        topic_study: 0,
        topic_money: 0,
        topic_relation: 0
      };

      // 否定・欲求
      if (contains(["辞めたい", "やめたい", "やめてしまいたい", "やめよ", "やめるの", "やめるか"])) {
        f.desire += 2;
        f.neg += 1;
      }
      if (contains(["したくない", "やりたくない", "無理", "嫌だ", "いやだ", "やだ"])) {
        f.neg += 2;
      }
      if (contains(["したい", "やりたい", "なりたい", "欲しい"])) {
        f.desire += 1;
      }

      // 感情
      if (contains(["疲れた", "つかれた", "しんどい", "きつい", "辛い", "つらい", "限界"])) {
        f.emo_neg += 1;
        f.stress += 2;
      }
      if (contains(["ムカつく", "むかつく", "腹立つ", "キレそう", "ぶちギレ"])) {
        f.emo_neg += 1;
        f.anger += 2;
      }
      if (contains(["嬉しい", "うれしい", "楽しい", "最高", "助かる", "ありがたい"])) {
        f.emo_pos += 2;
      }

      // リスク
      if (contains(["死にたい", "消えたい", "終わりたい", "自殺", "殺したい"])) {
        f.risk += 3;
        f.emo_neg += 2;
      }

      // 主体
      if (contains(["俺", "おれ", "私", "わたし", "僕", "ぼく"])) {
        f.first += 1;
      }
      if (contains(["お前", "君", "きみ", "あなた"])) {
        f.second += 1;
      }
      if (contains(["あいつ", "やつ", "上司", "同僚", "先輩", "後輩", "親", "家族", "友達"])) {
        f.third += 1;
      }

      // 時制
      if (contains(["した", "やった", "だった", "してた", "やめた"])) {
        f.tense_past += 1;
      }
      if (contains(["するつもり", "する予定", "しよう", "してみる", "やめる", "辞める"])) {
        f.tense_future += 1;
      }
      if (contains(["してる", "している", "やってる", "やっている", "今"])) {
        f.tense_present += 1;
      }

      // 強度
      if (contains(["超", "ちょう", "めちゃ", "めっちゃ", "ガチ", "本気", "マジ", "まじ", "クソ", "鬼"])) {
        f.intensity += 1;
      }

      // 意図
      if (contains(["？", "?", "どう思う", "どうすれば", "なに", "何", "教えて"])) {
        f.intent_ask += 1;
      }
      if (contains(["疲れた", "しんどい", "つらい", "辛い", "やばい", "無理", "だるい"])) {
        f.intent_vent += 1;
      }
      if (contains(["助けて", "相談", "アドバイス", "どうしたら", "手伝って"])) {
        f.intent_want += 1;
      }
      if (contains(["辞める", "やめる", "やめよ", "退職", "転職", "出す", "出そう"])) {
        f.intent_action += 1;
      }

      // トピック
      if (contains(["仕事", "職場", "会社", "残業", "出社", "上司"])) {
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

      function addFeat(name, value, scale = 1) {
        if (!value) return;
        const key = "__" + name.toUpperCase() + "__";
        vec[key] = (vec[key] || 0) + value * scale;
      }

      addFeat("neg", f.neg, 1.5);
      addFeat("desire", f.desire, 1.5);
      addFeat("emo_pos", f.emo_pos, 1.2);
      addFeat("emo_neg", f.emo_neg, 1.2);
      addFeat("stress", f.stress, 1.5);
      addFeat("anger", f.anger, 1.5);
      addFeat("risk", f.risk, 2.0);

      addFeat("first", f.first, 1.0);
      addFeat("second", f.second, 1.0);
      addFeat("third", f.third, 1.0);

      addFeat("tense_past", f.tense_past, 0.8);
      addFeat("tense_future", f.tense_future, 0.8);
      addFeat("tense_present", f.tense_present, 0.8);

      addFeat("intensity", f.intensity, 1.0);

      addFeat("intent_ask", f.intent_ask, 1.0);
      addFeat("intent_vent", f.intent_vent, 1.2);
      addFeat("intent_want", f.intent_want, 1.2);
      addFeat("intent_action", f.intent_action, 1.0);

      addFeat("topic_work", f.topic_work, 1.5);
      addFeat("topic_study", f.topic_study, 1.5);
      addFeat("topic_money", f.topic_money, 1.5);
      addFeat("topic_relation", f.topic_relation, 1.5);

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
      const { features: f } = this.analyze(userText);

      if (f.risk > 0) {
        return "命を捨てるほど価値のある仕事も試験もない。今の状態はひとりで抱える領域を超えている。専門の窓口や信頼できる人間に、今すぐ相談しろ。生き延びてから反撃しろ。";
      }

      if (f.topic_work > 0 && (f.desire > 0 || f.neg > 0)) {
        return "仕事を辞めたくなるのは異常じゃない。ただ、感情だけで辞めると次の人生の難易度がハードモードになる。1) 何が一番ストレスか具体化 2) それが会社の構造要因か、自分の戦略不足かを分解 3) 辞める前提で、資金と逃げ道だけ冷静に設計しろ。怒りは武器、ただし冷蔵して使え。";
      }

      if (f.stress > 0 && f.topic_study > 0) {
        return "勉強で潰れそうなら、『毎日死ぬほど』じゃなくて『毎日でも続く』ペースに変えろ。1日全力で燃え尽きる炎より、毎日くすぶり続ける炭の方が強い。これは逃げじゃなく設計だ。";
      }

      if (f.stress > 0 && f.topic_work > 0) {
        return "仕事で疲れた時は、『全部』を真面目に扱うのをやめろ。守るべきものを3つだけ決めて、それ以外は薄笑いで流せ。真面目なやつから先に壊れる。";
      }

      if (userText.includes("疲れた")) {
        return "疲れたなら倒れていい。ただし何もせずに倒れると、自己嫌悪という追加ダメージが乗る。5分だけ何か進めてから沈め。それで明日の自分への言い訳が立つ。";
      }
      if (userText.includes("やる気")) {
        return "やる気が湧いたら動く、は一生動かない人間の台詞だ。行動 → 微妙な達成感 → やる気、この順番。1問、1行、1ページ、それだけやれ。やってから文句言え。";
      }

      const learned = this.findNearestReply(userText);
      if (learned) return learned;

      return "そのパターンはまだ学習してない。お前が修正してくれれば、次からはちゃんと覚える。";
    }

    compress(maxKeep = 500) {
      if (this.memory.length <= maxKeep) return;

      const excess = this.memory.length - maxKeep;
      const old = this.memory.slice(0, excess);
      const keep = this.memory.slice(excess);

      for (const m of old) {
        const { tokens: tUser } = this.analyze(m.user);
        const { tokens: tBot }  = this.analyze(m.bot);
        const tokensAll = tUser.concat(tBot);
        for (const tok of tokensAll) {
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
    id: "semantic_v1",
    name: "意味拡張モデル v1",
    description: "否定・感情・意図・トピックを特徴量にしたベクトルモデル。",
    createInstance(storageKey) {
      const b = new SemanticBrain(storageKey);
      b.load();
      return b;
    }
  });
})();