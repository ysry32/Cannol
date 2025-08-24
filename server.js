const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const app = express();
const PORT = 3000;

const BOT_TOKEN = "7996639750:AAHZNDzeMnI_C6nddZaMCeToyQ1GtWR9nP4";
const CHAT_ID = "623652532";
const pricePerBox = 55;

app.use(express.json());
app.use(express.static("public"));

const ordersFilePath = path.join(__dirname, "orders.json");

// اقرأ الطلبات
function readOrders() {
  if (fs.existsSync(ordersFilePath)) {
    const data = fs.readFileSync(ordersFilePath, "utf-8");
    return JSON.parse(data);
  }
  return [];
}

// احفظ الطلبات
function saveOrders(orders) {
  fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2));
}

// أنشئ ملخص الطلبات مع الإيموجي لطريقة الدفع
function generateSummary(orders) {
  const totalBoxes = orders.reduce((sum, order) => sum + order.boxes, 0);

  // تجميع عدد البوكسات وطريقة الدفع لكل محل
  const storesMap = {};
  for (let order of orders) {
    if (!storesMap[order.store]) {
      storesMap[order.store] = {
        boxes: 0,
        payments: new Set(),
      };
    }
    storesMap[order.store].boxes += order.boxes;
    storesMap[order.store].payments.add(order.payment);
  }

  let storeLines = "";
  for (let store in storesMap) {
    const storeData = storesMap[store];
    let paymentLabel;
    if (storeData.payments.size === 1) {
      const payment = [...storeData.payments][0];
      paymentLabel = payment === "تحويل" ? "💳 تحويل" : "🔴 الدفع عند الاستلام";
    } else {
      paymentLabel = "⚠️ مختلط"; // إذا كانت طرق دفع مختلفة لنفس المحل
    }

    storeLines += `  - ${store}: ${storeData.boxes} بوكس - ${paymentLabel}\n`;
  }

  return `-------------------\n📦 مجموع البوكسات: ${totalBoxes}\n\n${storeLines}-------------------`;
}

app.post("/submit-order", async (req, res) => {
  const { store, boxes, payment } = req.body;

  if (!store || !boxes || boxes < 1) {
    return res.status(400).json({ error: "بيانات غير صحيحة" });
  }

  const newOrder = { store, boxes, payment };
  const orders = readOrders();
  orders.push(newOrder);
  saveOrders(orders);

  const total = boxes * pricePerBox;

  const newOrderMsg = `🆕 طلب جديد\n🏪 المحل: ${store}\n📦 عدد البوكسات: ${boxes}\n💳 الدفع: ${payment}\n💰 الإجمالي: ${total} ريال`;

  const summaryMsg = generateSummary(orders);

  try {
    // إرسال الطلب الجديد
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: newOrderMsg }),
    });

    // إرسال ملخص الطلبات
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text: summaryMsg }),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Telegram API error:", err);
    res.status(500).json({ error: "فشل في الإرسال لتليجرام" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
