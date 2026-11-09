// Wysyła powiadomienia e-mail o nowym zamówieniu przez EmailJS (z prywatnym kluczem):
// 1) do pracowni, 2) potwierdzenie do klienta, jeśli podał e-mail (osobny szablon EmailJS;
//    sekret EMAILJS_CUSTOMER_TEMPLATE_ID może go nadpisać).
// Wywoływana przez bazę po złożeniu zamówienia w place_order(). Przyjmuje tylko numer
// zamówienia; treść maili pochodzi z bazy, a każdy mail jest wysyłany najwyżej raz.
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAILJS_SERVICE_ID = "service_psuou7z";
const EMAILJS_TEMPLATE_ID = "template_1mzt0sy";
const EMAILJS_PUBLIC_KEY = "V4t-nC9pkZvdySwll";
// Szablon „Potwierdzenie dla klienta”: To {{to_email}}, Subject {{subject}}, Reply To {{reply_to}}, treść {{{message_html}}}
const EMAILJS_CUSTOMER_TEMPLATE_ID = "template_szv564o";

const SHOP_URL = "https://sezonowe3d.pl";

type OrderItem = { title?: string; color?: string | null; qty?: number; unitPrice?: number; custom?: unknown };

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function pln(n: number) {
  return `${n.toFixed(2).replace(".", ",")} zł`;
}

async function sendEmailJs(templateId: string, privateKey: string, templateParams: Record<string, unknown>) {
  return await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: privateKey,
      template_params: templateParams,
    }),
  });
}

// Potwierdzenie dla klienta: podsumowanie, odbiór, płatność, prawo odstąpienia, dane sprzedawcy
function customerEmail(order: { id: string; customer: string; contact: string; notes: string | null; created_at: string }, items: OrderItem[], total: number | null) {
  const date = new Date(order.created_at).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "long", timeStyle: "short" });
  const hasCustom = items.some((i) => i.custom);
  const rows = items.map((i) => {
    const price = typeof i.unitPrice === "number" ? pln(i.unitPrice * (i.qty ?? 0)) : "";
    return `<tr><td style="padding:6px 0;border-bottom:1px solid #e7e5e4">${escapeHtml(i.qty)} × ${escapeHtml(formatItemName(i))}</td>` +
      `<td style="padding:6px 0;border-bottom:1px solid #e7e5e4;text-align:right;white-space:nowrap">${price}</td></tr>`;
  }).join("");
  const totalText = total === null ? "—" : pln(total);
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1c1917;max-width:560px">
  <p>Dzień dobry ${escapeHtml(order.customer)},</p>
  <p>dziękujemy za zamówienie w pracowni <strong>sezonowe3d.pl</strong>! Poniżej jego podsumowanie.</p>
  <p style="margin:16px 0 4px"><strong>Zamówienie #ZAM-${escapeHtml(order.id)}</strong><br><span style="color:#78716c">złożone ${escapeHtml(date)}</span></p>
  <table style="width:100%;border-collapse:collapse">${rows}
    <tr><td style="padding:8px 0;font-weight:bold">Razem do zapłaty</td><td style="padding:8px 0;text-align:right;font-weight:bold;white-space:nowrap">${totalText}</td></tr>
  </table>
  ${order.notes ? `<p><strong>Twoje uwagi:</strong> ${escapeHtml(order.notes)}</p>` : ""}
  <p><strong>Odbiór:</strong> osobisty w Kruszewni, ul. Husarska 1D/5 (bez wysyłki). Skontaktujemy się z Tobą
  (${escapeHtml(order.contact)}), żeby potwierdzić zamówienie i ustalić termin odbioru – zwykle do 14 dni.</p>
  <p><strong>Płatność:</strong> przy odbiorze – gotówką, BLIKiem lub przelewem.</p>
  <p style="font-size:12px;color:#57534e">Możesz odstąpić od umowy bez podania przyczyny w ciągu 14 dni od odbioru
  (<a href="${SHOP_URL}/formularz-odstapienia.html">formularz odstąpienia</a>)${hasCustom ? "; nie dotyczy to produktów wykonanych na wymiar" : ""}.
  Szczegóły w <a href="${SHOP_URL}/regulamin.html">regulaminie sklepu</a>.</p>
  <p style="font-size:12px;color:#57534e">Sprzedawca: Natalia Chróścik, ul. Husarska 1D/5, Kruszewnia ·
  tel. 665 532 647 · sezonowe3d@gmail.com. Masz pytania? Po prostu odpowiedz na tę wiadomość.</p>
</div>`;
  const text =
    `Dzień dobry ${order.customer},\n\ndziękujemy za zamówienie #ZAM-${order.id} (${date}).\n\n` +
    items.map((i) => `• ${i.qty}x ${formatItemName(i)}`).join("\n") +
    `\n\nRazem do zapłaty: ${totalText}\nOdbiór osobisty w Kruszewni, ul. Husarska 1D/5 – skontaktujemy się, żeby ustalić termin.\n` +
    `Płatność przy odbiorze. Regulamin: ${SHOP_URL}/regulamin.html\n\nsezonowe3d.pl · tel. 665 532 647`;
  return { html, text };
}

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
    .select("id, customer, contact, email, notes, items, created_at")
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
    customer_contact: order.email ? `${order.contact}, ${order.email}` : order.contact,
    order_items: itemsText,
    customer_notes: notes || "(brak uwag)",
    order_total: total,
    to_name: "Pracownia",
    name: `${order.customer} (${order.contact})`,
    message:
      `Wpadło nowe zamówienie #ZAM-${order.id}!\n\nKlient: ${order.customer}\nKontakt: ${order.contact}${order.email ? `, ${order.email}` : ""}\n` +
      `Do zapłaty: ${total} zł\n\nZamówione pozycje:\n${itemsText}\n\nUwagi:\n${notes || "Brak"}`,
  };

  const res = await sendEmailJs(EMAILJS_TEMPLATE_ID, privateKey, templateParams);

  if (!res.ok) {
    const text = await res.text();
    // Zwolnij zamówienie, żeby dało się ponowić wysyłkę
    await supabase.from("orders").update({ notified_at: null }).eq("id", orderId);
    console.error(`EmailJS ${res.status}: ${text}`);
    return json({ error: `EmailJS ${res.status}: ${text}` }, 502);
  }

  // Potwierdzenie dla klienta (osobno; błąd tutaj nie cofa maila do pracowni)
  const customerTemplate = Deno.env.get("EMAILJS_CUSTOMER_TEMPLATE_ID") || EMAILJS_CUSTOMER_TEMPLATE_ID;
  let customer: string = "skipped";
  if (order.email && customerTemplate) {
    const { data: claimed } = await supabase
      .from("orders")
      .update({ customer_notified_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("customer_notified_at", null)
      .select("id")
      .maybeSingle();
    if (claimed) {
      const { html, text } = customerEmail(order, items, hasPrices ? Number(total) : null);
      const r = await sendEmailJs(customerTemplate, privateKey, {
        to_email: order.email,
        to_name: order.customer,
        reply_to: "sezonowe3d@gmail.com",
        subject: `Potwierdzenie zamówienia #ZAM-${order.id} – sezonowe3d.pl`,
        order_id: order.id,
        message_html: html,
        message: text,
      });
      if (r.ok) customer = "sent";
      else {
        customer = `error ${r.status}`;
        console.error(`EmailJS (klient) ${r.status}: ${await r.text()}`);
        await supabase.from("orders").update({ customer_notified_at: null }).eq("id", orderId);
      }
    }
  }

  return json({ sent: true, customer });
});
