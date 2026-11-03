import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const clean = (v: unknown, max = 500) => typeof v === "string" ? v.trim().slice(0, max) : "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply({ error: "Order service is not configured." }, 503);
  try {
    const body = await req.json();
    const c = body.customer ?? {};
    const customer = {
      name: clean(c.name, 100), phone: clean(c.phone, 30), whatsapp: clean(c.whatsapp, 30) || null,
      district: clean(c.district, 80), area: clean(c.area, 80), address: clean(c.address, 500),
    };
    if (!customer.name || !customer.phone || !customer.district || !customer.area || !customer.address) return reply({ error: "Please complete all required delivery details." }, 400);
    if (!["bkash", "nagad", "bank"].includes(body.payment_method)) return reply({ error: "Choose a supported payment method." }, 400);
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) return reply({ error: "Your cart is empty or contains too many items." }, 400);
    const items = body.items.map((x: any) => ({ product_id: clean(x.product_id, 50), quantity: Number(x.quantity) }));
    if (items.some((x: any) => !/^[0-9a-f-]{36}$/i.test(x.product_id) || !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 50)) return reply({ error: "Invalid cart item." }, 400);
    const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    const ids = [...new Set(items.map((x: any) => x.product_id))].join(",");
    const pRes = await fetch(`${url}/rest/v1/products?id=in.(${ids})&active=eq.true&select=id,name,price,stock`, { headers });
    if (!pRes.ok) throw new Error("Could not validate products.");
    const products = await pRes.json();
    if (products.length !== ids.split(",").length) return reply({ error: "A product is unavailable. Refresh and try again." }, 409);
    let subtotal = 0;
    const rows = items.map((item: any) => {
      const p = products.find((x: any) => x.id === item.product_id);
      if (!p || p.stock < item.quantity) throw new Error(`${p?.name ?? "A product"} is out of stock.`);
      const unit = Number(p.price); subtotal += unit * item.quantity;
      return { product_id: p.id, product_name: p.name, unit_price: unit, quantity: item.quantity, line_total: unit * item.quantity };
    });
    // Match returning customers only on exact normalized phone + address; never merge on name alone.
    const phone = customer.phone.replace(/\s+/g, "");
    const addressKey = encodeURIComponent(customer.address);
    const cRes = await fetch(`${url}/rest/v1/customers?phone=eq.${encodeURIComponent(phone)}&address=eq.${addressKey}&district=eq.${encodeURIComponent(customer.district)}&area=eq.${encodeURIComponent(customer.area)}&select=id,total_orders,total_spend&limit=1`, { headers });
    if (!cRes.ok) throw new Error("Could not save customer details.");
    const found = await cRes.json();
    let customerId: string;
    if (found.length) customerId = found[0].id;
    else {
      const create = await fetch(`${url}/rest/v1/customers`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ ...customer, phone }) });
      if (!create.ok) throw new Error("Could not create customer record.");
      customerId = (await create.json())[0].id;
    }
    const orderNumber = `MR${Date.now().toString().slice(-9)}`;
    const orderRes = await fetch(`${url}/rest/v1/orders`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ order_number: orderNumber, customer_id: customerId, payment_method: body.payment_method, subtotal, delivery_charge: 0, total: subtotal, note: clean(body.note, 1000) || null }) });
    if (!orderRes.ok) throw new Error("Could not create order.");
    const order = (await orderRes.json())[0];
    const itemRes = await fetch(`${url}/rest/v1/order_items`, { method: "POST", headers, body: JSON.stringify(rows.map((r: any) => ({ ...r, order_id: order.id }))) });
    if (!itemRes.ok) throw new Error("Order was created but item details could not be saved. Contact store support with order number " + orderNumber);
    await fetch(`${url}/rest/v1/customers?id=eq.${customerId}`, { method: "PATCH", headers, body: JSON.stringify({ total_orders: (found[0]?.total_orders ?? 0) + 1, total_spend: Number(found[0]?.total_spend ?? 0) + subtotal, updated_at: new Date().toISOString() }) });
    return reply({ ok: true, order_number: orderNumber, total: subtotal });
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : "Unexpected order error." }, 400);
  }
});
