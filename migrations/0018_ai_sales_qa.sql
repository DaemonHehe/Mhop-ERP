-- Migration 0018: AI Sales Agent Knowledge Base (Q&A Feed)
-- Allows admins to feed questions, answers, and advice directly to the 24/7 AI Sales Agent

CREATE TABLE IF NOT EXISTS ai_sales_qa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category varchar(80) NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar(120)
);

CREATE INDEX IF NOT EXISTS ai_sales_qa_created_idx ON ai_sales_qa(created_at);
CREATE INDEX IF NOT EXISTS ai_sales_qa_category_idx ON ai_sales_qa(category);

-- Clean up any legacy template record for ai_sales_agent from bot_message_templates
DELETE FROM bot_message_templates WHERE key = 'ai_sales_agent';

-- Seed default high-utility store Q&As for mobile gaming accessories & PUBG accounts
INSERT INTO ai_sales_qa (question, answer, category, is_active, updated_by)
VALUES
  (
    'iPhone 15 Pro Max သို့မဟုတ် Android phone တွေအတွက် ဘယ် phone cooler သုံးသင့်လဲ?',
    'iPhone 12 နဲ့အထက်အတွက် MagSafe magnetic cooler (ဥပမာ Black Shark MagCooler) ကို တိုက်ရိုက်ကပ်သုံးနိုင်ပါတယ်။ Android သို့မဟုတ် အခြားဖုန်းများအတွက် universal back-clip cooler များ အဆင်ပြေပါတယ်။ အားသွင်းရင်း ဂိမ်းဆော့ရင် အပူချိန် 15-20°C ထိ အမြန်လျှော့ချပေးနိုင်ပါတယ်။',
    'gaming_gadgets',
    true,
    'system'
  ),
  (
    'PUBG Mobile account ဝယ်ယူပြီးရင် အကောင့်ကို ဘယ်လိုလွှဲပြောင်းပေးပါသလဲ?',
    'PUBG Mobile account များကို 100% full prepayment ရရှိပြီးသည်နှင့် Admin Team မှ customer ၏ social account / email သို့ secure rebind (လွှဲပြောင်းချိတ်ဆက်ခြင်း) ကို တိုက်ရိုက်လုပ်ဆောင်ပေးပါသည်။ Digital asset ဖြစ်၍ delivery fee လုံးဝမရှိပါ။',
    'pubg_accounts',
    true,
    'system'
  ),
  (
    'Royal Express နဲ့ ပစ္စည်းပို့ရင် ဘယ်နှစ်ရက်ကြာမလဲ?',
    'Yangon မြို့တွင်းဆိုရင် 1 ရက်မှ 2 ရက်အတွင်း ရောက်ရှိပြီး delivery fee 4,500 MMK ဖြစ်ပါတယ်။ နယ်မြို့များအတွက် 2 ရက်မှ 4 ရက်အတွင်း ရောက်ရှိပြီး မြို့နယ်အလိုက် 5,000 မှ 10,000 MMK ဖြစ်ပါတယ်။ ရခိုင်ပြည်နယ်နှင့် စစ်ရေးတင်းမာသော မြို့နယ် ၆ ခုသို့ ပို့ဆောင်မှု ယာယီရပ်ဆိုင်းထားပါတယ်။',
    'delivery',
    true,
    'system'
  ),
  (
    'ငွေပေးချေမှုနဲ့ Deposit ဘယ်လို ပေးရမလဲ?',
    'Gaming gadgets များအတွက် ကနဦး Deposit 10,000 MMK ကို KBZPay, WavePay သို့မဟုတ် KBZ Bank ဖြင့် ကြိုတင်လွှဲပေးရပြီး ကျန်ငွေကို Royal Express COD ဖြင့် ပစ္စည်းရောက်မှ ပေးချေနိုင်ပါတယ်။ PUBG accounts များအတွက် 100% full prepayment ဖြစ်ပါသည်။',
    'payment',
    true,
    'system'
  ),
  (
    'Gaming accessories တွေအတွက် အာမခံ (Warranty) ရှိပါသလား?',
    'ပစ္စည်းအမျိုးအစားအလိုက် ၆ လမှ ၁၂ လထိ standard warranty ပါဝင်ပါတယ်။ ရေဝင်ခြင်း၊ ရိုက်ခွဲမိခြင်း၊ power short ဖြစ်ခြင်းနှင့် physical damage များ မပါဝင်ပါ။ Warranty စစ်ဆေးရန် /warranty သို့မဟုတ် /support ဖြင့် ဆက်သွယ်နိုင်ပါတယ်။',
    'warranty',
    true,
    'system'
  );
