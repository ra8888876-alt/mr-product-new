const CONFIG = window.MR_PRODUCT_CONFIG || {};

const SUPABASE_URL = CONFIG.supabaseUrl || "";
const SUPABASE_KEY = CONFIG.publishableKey || "";

const $ = (selector) => document.querySelector(selector);

const money = (amount) =>
  "৳" + Number(amount || 0).toLocaleString("en-BD");

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);

let products = [];
let cart = [];
let paymentSettings = null;

$("#year").textContent = new Date().getFullYear();

function getProductPrice(product) {
  const price = Number(product.price || 0);
  const discount = Number(product.discount_price || 0);

  return discount > 0 && discount < price
    ? discount
    : price;
}

// =====================================
// LOAD PRODUCTS
// =====================================

async function loadProducts() {
  const grid = $("#product-grid");

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    grid.textContent = "Store database is not configured.";
    return;
  }

  grid.textContent = "Loading products...";

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,description,price,discount_price,image_url,category,stock,active&active=eq.true&order=created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("Could not load products.");
    }

    products = await response.json();

    renderProducts();

  } catch (error) {
    console.error(error);

    grid.textContent =
      "Products could not be loaded. Please try again later.";
  }
}

// =====================================
// DISPLAY PRODUCTS
// =====================================

function renderProducts() {
  const grid = $("#product-grid");

  if (!products.length) {
    grid.textContent = "No products are available right now.";
    return;
  }

  grid.innerHTML = products.map((product) => {
    const oldPrice = Number(product.price || 0);
    const currentPrice = getProductPrice(product);

    const image = product.image_url
      ? `<img src="${escapeHTML(product.image_url)}"
          alt="${escapeHTML(product.name)}"
          loading="lazy">`
      : `<div class="product-image">MR</div>`;

    return `
      <article class="product-card">
        ${image}

        <h3>${escapeHTML(product.name)}</h3>

        <p class="muted small">
          ${escapeHTML(product.description || "")}
        </p>

        <div class="price">
          ${money(currentPrice)}
        </div>

        ${
          currentPrice < oldPrice
            ? `<del class="muted">${money(oldPrice)}</del>`
            : ""
        }

        <button
          class="button gold-button"
          data-add="${escapeHTML(product.id)}"
          type="button"
          ${Number(product.stock) <= 0 ? "disabled" : ""}
        >
          ${
            Number(product.stock) <= 0
              ? "Out of stock"
              : "Add to cart"
          }
        </button>
      </article>
    `;
  }).join("");
}

// =====================================
// LOAD PAYMENT SETTINGS
// =====================================

async function loadPaymentSettings() {
  const detailsBox = $("#payment-details");
  const infoText = $("#payment-info-text");

  if (!detailsBox || !infoText) return;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/admin-settings`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("Could not load payment information.");
    }

    const result = await response.json();

    paymentSettings = result.settings || null;

  } catch (error) {
    console.error("Payment settings error:", error);
    paymentSettings = null;
  }
}

// =====================================
// SHOW PAYMENT DETAILS
// =====================================

function showPaymentDetails() {
  const detailsBox = $("#payment-details");
  const infoText = $("#payment-info-text");
  const paymentSelect = $('select[name="payment"]');

  if (!detailsBox || !infoText || !paymentSelect) {
    return;
  }

  const method = paymentSelect.value;

  if (!method) {
    detailsBox.hidden = true;
    infoText.textContent = "";
    return;
  }

  if (!paymentSettings) {
    detailsBox.hidden = false;
    infoText.textContent =
      "Payment information is currently unavailable. Please contact the store.";
    return;
  }

  let details = "";

  if (method === "bkash") {
    details = paymentSettings.bkash_number || "";
  }

  if (method === "nagad") {
    details = paymentSettings.nagad_number || "";
  }

  if (method === "bank") {
    details = paymentSettings.bank_details || "";
  }

  const instructions =
    paymentSettings.payment_instructions || "";

  if (!details && !instructions) {
    detailsBox.hidden = false;

    infoText.textContent =
      "Payment details have not been added yet.";

    return;
  }

  const lines = [];

  if (method === "bkash") {
    lines.push("bKash Payment Details");
  }

  if (method === "nagad") {
    lines.push("Nagad Payment Details");
  }

  if (method === "bank") {
    lines.push("Bank Transfer Details");
  }

  if (details) {
    lines.push(details);
  }

  if (instructions) {
    lines.push("");
    lines.push("Payment Instructions:");
    lines.push(instructions);
  }

  detailsBox.hidden = false;
  infoText.textContent = lines.join("\n");
}

// =====================================
// CART
// =====================================

function renderCart() {
  $("#cart-count").textContent =
    cart.reduce((total, item) => total + item.qty, 0);

  $("#cart-items").innerHTML = cart.length
    ? cart.map((item) => `
        <div class="cart-line">
          <div>
            <b>${escapeHTML(item.name)}</b>

            <div class="muted small">
              ${money(item.price)} × ${item.qty}
            </div>
          </div>

          <div class="qty">
            <button
              type="button"
              data-dec="${escapeHTML(item.id)}"
            >−</button>

            ${item.qty}

            <button
              type="button"
              data-inc="${escapeHTML(item.id)}"
            >+</button>
          </div>
        </div>
      `).join("")
    : '<p class="muted">Your cart is empty.</p>';

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  $("#cart-total").textContent = money(total);
  $("#dialog-total").textContent = money(total);
}

function openCart() {
  $("#overlay").hidden = false;

  $("#cart-drawer").classList.add("open");

  $("#cart-drawer").setAttribute(
    "aria-hidden",
    "false"
  );
}

function closeCart() {
  $("#overlay").hidden = true;

  $("#cart-drawer").classList.remove("open");

  $("#cart-drawer").setAttribute(
    "aria-hidden",
    "true"
  );
}

// =====================================
// ADD TO CART
// =====================================

$("#product-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");

  if (!button) return;

  const id = button.dataset.add;

  const product = products.find(
    (item) => item.id === id
  );

  if (!product) return;

  const item = cart.find(
    (entry) => entry.id === id
  );

  const stock = Number(product.stock || 0);

  if (stock <= 0) {
    alert("This product is out of stock.");
    return;
  }

  if (item) {
    if (item.qty >= stock) {
      alert("Maximum available stock reached.");
      return;
    }

    item.qty++;

  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: getProductPrice(product),
      qty: 1,
      stock
    });
  }

  renderCart();
});

// =====================================
// CART QUANTITY
// =====================================

$("#cart-items").addEventListener("click", (event) => {
  const button = event.target.closest(
    "[data-inc], [data-dec]"
  );

  if (!button) return;

  const id =
    button.dataset.inc || button.dataset.dec;

  const item = cart.find(
    (entry) => entry.id === id
  );

  if (!item) return;

  if (button.dataset.inc) {
    if (item.qty >= item.stock) {
      alert("Maximum available stock reached.");
      return;
    }

    item.qty++;

  } else {
    item.qty--;
  }

  if (item.qty <= 0) {
    cart = cart.filter(
      (entry) => entry.id !== id
    );
  }

  renderCart();
});

// =====================================
// CART BUTTONS
// =====================================

$("#cart-open").addEventListener(
  "click",
  openCart
);

$("#cart-close").addEventListener(
  "click",
  closeCart
);

$("#overlay").addEventListener(
  "click",
  closeCart
);

// =====================================
// CHECKOUT
// =====================================

$("#checkout-open").addEventListener("click", () => {
  if (!cart.length) {
    alert("Your cart is empty.");
    return;
  }

  closeCart();

  $("#order-dialog").showModal();

  showPaymentDetails();
});

$("#order-close").addEventListener("click", () => {
  $("#order-dialog").close();
});

// =====================================
// PAYMENT METHOD CHANGE
// =====================================

$('select[name="payment"]').addEventListener(
  "change",
  showPaymentDetails
);

// =====================================
// PLACE ORDER
// =====================================

$("#order-form").addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    const form = event.currentTarget;

    const message = $("#form-message");

    const submitButton = form.querySelector(
      '[type="submit"]'
    );

    if (!cart.length) {
      message.textContent = "Your cart is empty.";
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      message.textContent =
        "Store database is not configured.";
      return;
    }

    const formData = new FormData(form);

    const customer = {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      whatsapp: String(formData.get("whatsapp") || "").trim(),
      district: String(formData.get("district") || "").trim(),
      area: String(formData.get("area") || "").trim(),
      address: String(formData.get("address") || "").trim()
    };

    const paymentMethod = String(
      formData.get("payment") || ""
    );

    const note = String(
      formData.get("note") || ""
    ).trim();

    if (
      !customer.name ||
      !customer.phone ||
      !customer.district ||
      !customer.area ||
      !customer.address
    ) {
      message.textContent =
        "Please complete all required fields.";

      return;
    }

    if (
      !["bkash", "nagad", "bank"].includes(paymentMethod)
    ) {
      message.textContent =
        "Please select a valid payment method.";

      return;
    }

    submitButton.disabled = true;

    message.textContent = "Submitting your order...";

    try {

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/place-order`,
        {
          method: "POST",

          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            customer,

            payment_method: paymentMethod,

            items: cart.map((item) => ({
              product_id: item.id,
              quantity: item.qty
            })),

            note
          })
        }
      );

      const result = await response.json();

      if (!response.ok || result.ok !== true) {
        throw new Error(
          result.error || "Order could not be completed."
        );
      }

      cart = [];

      renderCart();

      form.reset();

      showPaymentDetails();

      message.textContent =
        `Order successful! Order number: ${result.order_number}. Total: ${money(result.total)}.`;

    } catch (error) {

      console.error(
        "Order submission error:",
        error
      );

      message.textContent =
        error.message ||
        "Something went wrong. Please try again.";

    } finally {

      submitButton.disabled = false;

    }
  }
);

// =====================================
// START STORE
// =====================================

renderCart();

loadProducts();

loadPaymentSettings();
