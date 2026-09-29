// Wysyła powiadomienie e-mail o nowym zamówieniu przez EmailJS (z prywatnym kluczem).
// Wywoływana przez bazę po złożeniu zamówienia w place_order(). Przyjmuje tylko numer
// zamówienia; treść maila pochodzi z bazy, a każde zamówienie jest wysyłane najwyżej raz.
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAILJS_SERVICE_ID = "service_psuou7z";
const EMAILJS_TEMPLATE_ID = "template_1mzt0sy";
const EMAILJS_PUBLIC_KEY = "V4t-nC9pkZvdySwll";

type OrderItem = { title?: string; color?: string | null; qty?: number; unitPrice?: number };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function formatItemName(item: OrderItem) {
  return item.color && item.color !== "Multikolor" ? `${item.title} (${item.color})` : `${item.title}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let orderId: unknown;
  try {
    ({ orderId } = await req.json());
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (typeof orderId !== "string" || !/^[0-9]{1,12}$/.test(orderId)) {
    return json({ error: "Invalid orderId" }, 400);
  }

  const privateKey = Deno.env.get("EMAILJS_PRIVATE_KEY");
  if (!privateKey) return json({ error: "Missing EMAILJS_PRIVATE_KEY secret" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Zajęcie zamówienia do wysyłki: tylko jeśli powiadomienie jeszcze nie wyszło
  const { data: order, error } = await supabase
    .from("orders")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("notified_at", null)
    .select("id, customer, contact, notes, items")
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!order) return json({ skipped: true });

  const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
  const itemsText = items.map((i) => `• ${i.qty}x ${formatItemName(i)}`).join("\n");
  const hasPrices = items.length > 0 && items.every((i) => typeof i.unitPrice === "number");
  const total = hasPrices
    ? items.reduce((sum, i) => sum + (i.unitPrice as number) * (i.qty ?? 0), 0).toFixed(2)
    : "—";
  const notes = order.notes || "";

  const templateParams = {
    order_id: order.id,
    customer_name: order.customer,
    customer_contact: order.contact,
    order_items: itemsText,
    customer_notes: notes || "(brak uwag)",
    order_total: total,
    to_name: "Pracownia",
    name: `${order.customer} (${order.contact})`,
    message:
      `Wpadło nowe zamówienie #ZAM-${order.id}!\n\nKlient: ${order.customer}\nKontakt: ${order.contact}\n` +
      `Do zapłaty: ${total} zł\n\nZamówione pozycje:\n${itemsText}\n\nUwagi:\n${notes || "Brak"}`,
  };

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: privateKey,
      template_params: templateParams,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    // Zwolnij zamówienie, żeby dało się ponowić wysyłkę
    await supabase.from("orders").update({ notified_at: null }).eq("id", orderId);
    console.error(`EmailJS ${res.status}: ${text}`);
    return json({ error: `EmailJS ${res.status}: ${text}` }, 502);
  }

  return json({ sent: true });
});
