import { db } from "@/db";
import { aiSalesQa } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export type AiSalesQaItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  updatedBy?: string | null;
};

export const QA_CATEGORIES = [
  { id: "gaming_gadgets", label: "Gaming Gadgets & Gear" },
  { id: "pubg_accounts", label: "PUBG Mobile Accounts" },
  { id: "delivery", label: "Delivery & Royal Express" },
  { id: "payment", label: "Payment & Deposits" },
  { id: "warranty", label: "Warranty & RMA" },
  { id: "general", label: "General Store FAQ" },
] as const;

export const DEFAULT_AI_QA_ITEMS: AiSalesQaItem[] = [
  {
    id: "def-qa-01",
    question: "iPhone 15 Pro Max သို့မဟုတ် Android phone တွေအတွက် ဘယ် phone cooler သုံးသင့်လဲ?",
    answer: "iPhone 12 နဲ့အထက်အတွက် MagSafe magnetic cooler (ဥပမာ Black Shark MagCooler) ကို တိုက်ရိုက်ကပ်သုံးနိုင်ပါတယ်။ Android သို့မဟုတ် အခြားဖုန်းများအတွက် universal back-clip cooler များ အဆင်ပြေပါတယ်။ အားသွင်းရင်း ဂိမ်းဆော့ရင် အပူချိန် 15-20°C ထိ အမြန်လျှော့ချပေးနိုင်ပါတယ်။",
    category: "gaming_gadgets",
    isActive: true,
  },
  {
    id: "def-qa-02",
    question: "PUBG Mobile account ဝယ်ယူပြီးရင် အကောင့်ကို ဘယ်လိုလွှဲပြောင်းပေးပါသလဲ?",
    answer: "PUBG Mobile account များကို 100% full prepayment ရရှိပြီးသည်နှင့် Admin Team မှ customer ၏ social account / email သို့ secure rebind (လွှဲပြောင်းချိတ်ဆက်ခြင်း) ကို တိုက်ရိုက်လုပ်ဆောင်ပေးပါသည်။ Digital asset ဖြစ်၍ delivery fee လုံးဝမရှိပါ။",
    category: "pubg_accounts",
    isActive: true,
  },
  {
    id: "def-qa-03",
    question: "Royal Express နဲ့ ပစ္စည်းပို့ရင် ဘယ်နှစ်ရက်ကြာမလဲ?",
    answer: "Yangon မြို့တွင်းဆိုရင် 1 ရက်မှ 2 ရက်အတွင်း ရောက်ရှိပြီး delivery fee 4,500 MMK ဖြစ်ပါတယ်။ နယ်မြို့များအတွက် 2 ရက်မှ 4 ရက်အတွင်း ရောက်ရှိပြီး မြို့နယ်အလိုက် 5,000 မှ 10,000 MMK ဖြစ်ပါတယ်။ ရခိုင်ပြည်နယ်နှင့် စစ်ရေးတင်းမာသော မြို့နယ် ၆ ခုသို့ ပို့ဆောင်မှု ယာယီရပ်ဆိုင်းထားပါတယ်။",
    category: "delivery",
    isActive: true,
  },
  {
    id: "def-qa-04",
    question: "ငွေပေးချေမှုနဲ့ Deposit ဘယ်လို ပေးရမလဲ?",
    answer: "Gaming gadgets များအတွက် ကနဦး Deposit 10,000 MMK ကို KBZPay, WavePay သို့မဟုတ် KBZ Bank ဖြင့် ကြိုတင်လွှဲပေးရပြီး ကျန်ငွေကို Royal Express COD ဖြင့် ပစ္စည်းရောက်မှ ပေးချေနိုင်ပါတယ်။ PUBG accounts များအတွက် 100% full prepayment ဖြစ်ပါသည်။",
    category: "payment",
    isActive: true,
  },
  {
    id: "def-qa-05",
    question: "Gaming accessories တွေအတွက် အာမခံ (Warranty) ရှိပါသလား?",
    answer: "ပစ္စည်းအမျိုးအစားအလိုက် ၆ လမှ ၁၂ လထိ standard warranty ပါဝင်ပါတယ်။ ရေဝင်ခြင်း၊ ရိုက်ခွဲမိခြင်း၊ power short ဖြစ်ခြင်းနှင့် physical damage များ မပါဝင်ပါ။ Warranty စစ်ဆေးရန် /warranty သို့မဟုတ် /support ဖြင့် ဆက်သွယ်နိုင်ပါတယ်။",
    category: "warranty",
    isActive: true,
  },
];

let inMemoryQaStore: AiSalesQaItem[] = [...DEFAULT_AI_QA_ITEMS];

export async function getAiSalesQaList(): Promise<AiSalesQaItem[]> {
  if (!db) return inMemoryQaStore;
  try {
    const rows = await db
      .select()
      .from(aiSalesQa)
      .orderBy(desc(aiSalesQa.createdAt));

    if (!rows || rows.length === 0) {
      return inMemoryQaStore;
    }

    return rows.map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      category: r.category,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      updatedBy: r.updatedBy,
    }));
  } catch (error) {
    console.warn("[getAiSalesQaList] Falling back to default Q&A items:", error);
    return inMemoryQaStore;
  }
}

export async function getActiveAiSalesQa(): Promise<AiSalesQaItem[]> {
  const all = await getAiSalesQaList();
  return all.filter((item) => item.isActive);
}

export async function createAiSalesQa(
  input: { question: string; answer: string; category?: string },
  author = "admin",
): Promise<AiSalesQaItem> {
  const question = input.question.trim();
  const answer = input.answer.trim();
  const category = input.category?.trim() || "general";

  if (!question || !answer) {
    throw new Error("Question and Answer cannot be empty");
  }

  if (db) {
    try {
      const [inserted] = await db
        .insert(aiSalesQa)
        .values({
          question,
          answer,
          category,
          isActive: true,
          updatedBy: author,
        })
        .returning();

      if (inserted) {
        const item: AiSalesQaItem = {
          id: inserted.id,
          question: inserted.question,
          answer: inserted.answer,
          category: inserted.category,
          isActive: inserted.isActive,
          createdAt: inserted.createdAt,
          updatedAt: inserted.updatedAt,
          updatedBy: inserted.updatedBy,
        };
        inMemoryQaStore.unshift(item);
        return item;
      }
    } catch (error) {
      console.error("[createAiSalesQa] DB error, storing in memory:", error);
    }
  }

  const newItem: AiSalesQaItem = {
    id: `qa-${Date.now()}`,
    question,
    answer,
    category,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    updatedBy: author,
  };
  inMemoryQaStore.unshift(newItem);
  return newItem;
}

export async function updateAiSalesQa(
  id: string,
  input: Partial<{ question: string; answer: string; category: string; isActive: boolean }>,
  author = "admin",
): Promise<AiSalesQaItem> {
  if (db) {
    try {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
        updatedBy: author,
      };
      if (input.question !== undefined) updateData.question = input.question.trim();
      if (input.answer !== undefined) updateData.answer = input.answer.trim();
      if (input.category !== undefined) updateData.category = input.category.trim();
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      const [updated] = await db
        .update(aiSalesQa)
        .set(updateData)
        .where(eq(aiSalesQa.id, id))
        .returning();

      if (updated) {
        const item: AiSalesQaItem = {
          id: updated.id,
          question: updated.question,
          answer: updated.answer,
          category: updated.category,
          isActive: updated.isActive,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          updatedBy: updated.updatedBy,
        };
        inMemoryQaStore = inMemoryQaStore.map((x) => (x.id === id ? item : x));
        return item;
      }
    } catch (error) {
      console.error("[updateAiSalesQa] DB error:", error);
    }
  }

  const idx = inMemoryQaStore.findIndex((x) => x.id === id);
  if (idx !== -1) {
    const updated = {
      ...inMemoryQaStore[idx],
      ...input,
      updatedAt: new Date(),
      updatedBy: author,
    };
    inMemoryQaStore[idx] = updated;
    return updated;
  }
  throw new Error(`Q&A item ${id} not found`);
}

export async function deleteAiSalesQa(id: string): Promise<boolean> {
  if (db) {
    try {
      await db.delete(aiSalesQa).where(eq(aiSalesQa.id, id));
    } catch (error) {
      console.error("[deleteAiSalesQa] DB error:", error);
    }
  }
  inMemoryQaStore = inMemoryQaStore.filter((x) => x.id !== id);
  return true;
}

/**
 * Formats active Q&As into structured context for the AI prompt
 */
export function formatQaForPrompt(qaList: AiSalesQaItem[]): string {
  if (!qaList || qaList.length === 0) return "No custom Q&A fed yet.";
  return qaList
    .map(
      (item, idx) =>
        `[Q&A ${idx + 1}] (${item.category.toUpperCase()})\nQ: ${item.question}\nA: ${item.answer}`,
    )
    .join("\n\n");
}

/**
 * Tokenizes text for Burmese and English keyword matching
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u1000-\u109f]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

const STOP_WORDS = new Set([
  "to", "the", "a", "an", "is", "in", "for", "of", "and", "or", "on", "at", "by", "with",
  "ဒီ", "နဲ့", "ကို", "မှာ", "သည်", "၏", "မှ", "ပါ", "လဲ", "လား", "ဖြစ်", "ပြီး",
]);

/**
 * Matches customer inquiry against fed Q&A database for fallback response
 */
export function findMatchingQa(
  question: string,
  qaList: AiSalesQaItem[],
): AiSalesQaItem | null {
  const queryTokens = tokenize(question);
  const informativeTokens = queryTokens.filter(
    (t) => !STOP_WORDS.has(t) && t.length >= 3,
  );
  if (!informativeTokens.length) return null;

  let bestMatch: AiSalesQaItem | null = null;
  let highestScore = 0;

  for (const item of qaList) {
    if (!item.isActive) continue;
    const qaTokens = new Set([
      ...tokenize(item.question),
      ...tokenize(item.category),
      ...tokenize(item.answer),
    ]);

    let hits = 0;
    for (const token of informativeTokens) {
      if (qaTokens.has(token)) {
        hits += 1;
      }
    }

    const score = hits / informativeTokens.length;
    if (hits >= 2 || (hits === 1 && informativeTokens.length <= 2)) {
      if (score > highestScore && score >= 0.3) {
        highestScore = score;
        bestMatch = item;
      }
    }
  }

  return bestMatch;
}
