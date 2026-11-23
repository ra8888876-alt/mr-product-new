/* =========================================
   MR PRODUCT — LUXURY BEAUTY STORE
   Complete Store Application
========================================= */

"use strict";

/* CONFIG */

const CONFIG = window.MR_PRODUCT_CONFIG || {};
const SUPABASE_URL = (CONFIG.supabaseUrl || "").replace(/\/$/, "");
const SUPABASE_KEY = CONFIG.publishableKey || "";

const $ = (selector, parent = document) =>
  parent.querySelector(selector);

const $$ = (selector, parent = document) =>
  [...parent.querySelectorAll(selector)];

const money = amount =>
  "৳" + Number(amount || 0).toLocaleString("en-BD");

const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);

function safeImageURL(value) {
  try {
    const url = new URL(String(value || ""), location.href);

    return ["http:", "https:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

/* APP STATE */

let products = [];
let cart = [];
let isSubmitting = false;

/* LOAD SAVED CART */

try {
  const savedCart = JSON.parse(
    localStorage.getItem("mr_product_cart") || "[]"
  );

  if (Array.isArray(savedCart)) {
    cart = savedCart.filter(item =>
      item &&
      item.id !== undefined &&
      Number(item.qty) > 0
    );
  }
} catch {
  cart = [];
}

/* BASIC ELEMENTS */

if ($("#year")) {
  $("#year").textContent = new Date().getFullYear();
}

/* HELPERS */

function showMessage(message, type = "info") {
  const element = $("#form-message");

  if (!element) return;

  element.textContent = message;
  element.dataset.type = type;
}

function getFieldValue(form, names, ids = []) {
  for (const name of names) {
    const field = form.elements.namedItem(name);

    if (field && field.value !== undefined) {
      return String(field.value).trim();
    }
  }

  for (const id of ids) {
    const field = $("#" + id);

    if (field) {
      return String(field.value || "").trim();
    }
  }

  return "";
}

/* CART STORAGE */

function saveCart() {
  try {
    localStorage.setItem(
      "mr_product_cart",
      JSON.stringify(cart)
    );
  } catch (error) {
    console.error("Cart storage error:", error);
  }
}

function getProductPrice(product) {
  const price = Number(product.price || 0);
  const discount = Number(product.discount_price || 0);

  return discount > 0 && discount < price
    ? discount
    : price;
}

function getCartTotal() {
  return cart.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.qty || 0);
  }, 0);
}

function getCartCount() {
  return cart.reduce((sum, item) => {
    return sum + Number(item.qty || 0);
  }, 0);
}

/* STORE SETTINGS */

async function loadStoreSettings() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/admin-settings`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) return;

    const result = await response.json();

    const settings =
      result.settings ||
      result.data ||
      result;

    if (settings.store_name) {
      $$("[data-store-name], #store-name").forEach(element => {
        element.textContent = settings.store_name;
      });
    }

    if (settings.description && $("#store-description")) {
      $("#store-description").textContent =
        settings.description;
    }

    if (settings.phone && $("#store-phone")) {
      $("#store-phone").textContent = settings.phone;
    }

    if (settings.whatsapp && $("#store-whatsapp")) {
      $("#store-whatsapp").textContent =
        settings.whatsapp;
    }

    if (settings.email && $("#store-email")) {
      $("#store-email").textContent = settings.email;
    }

    if (settings.banner_url && $("#hero-banner-image")) {
      const imageURL = safeImageURL(settings.banner_url);

      if (imageURL) {
        $("#hero-banner-image").src = imageURL;
      }
    }

    if (settings.primary_color) {
      document.documentElement.style.setProperty(
        "--accent",
        settings.primary_color
      );
    }

  } catch (error) {
    console.error("Store settings error:", error);
  }
}

/* PRODUCT LOADING */

async function loadProducts() {
  const grid = $("#product-grid");

  if (!grid) return;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    grid.innerHTML = `
      <p class="loading-products">
        Store database is not configured.
        Please check config.js.
      </p>
    `;
    return;
  }

  grid.innerHTML = `
    <p class="loading-products">
      Discovering your favourites...
    </p>
  `;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,description,price,discount_price,image_url,category,stock,active,created_at&active=eq.true&order=created_at.desc`,
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

    const data = await response.json();

    products = Array.isArray(data)
      ? data.filter(product =>
          product &&
          product.id !== undefined &&
          Number.isFinite(Number(product.price))
        )
      : [];

    renderProducts();

    /* UPDATE SAVED CART */

    cart = cart.map(item => {
      const latest = products.find(product =>
        String(product.id) === String(item.id)
      );

      if (!latest) return null;

      const stock = Math.max(
        0,
        Number(latest.stock || 0)
      );

      const quantity = Math.min(
        Math.max(1, Number(item.qty || 1)),
        stock
      );

      if (quantity <= 0) return null;

      return {
        id: latest.id,
        name: latest.name,
        price: getProductPrice(latest),
        stock,
        qty: quantity
      };

    }).filter(Boolean);

    renderCart();

  } catch (error) {
    console.error("Product loading error:", error);

    grid.innerHTML = `
      <p class="loading-products">
        Products could not be loaded.
        Please try again later.
      </p>
    `;
  }
}

/* SEARCH AND SORT */

function getVisibleProducts() {
  let list = [...products];

  const search = (
    $("#product-search")?.value || ""
  ).trim().toLowerCase();

  const sort = $("#product-sort")?.value || "newest";

  if (search) {
    list = list.filter(product => {
      const searchable = [
        product.name,
        product.description,
        product.category
      ].join(" ").toLowerCase();

      return searchable.includes(search);
    });
  }

  if (sort === "price-low") {
    list.sort((a, b) =>
      getProductPrice(a) - getProductPrice(b)
    );

  } else if (sort === "price-high") {
    list.sort((a, b) =>
      getProductPrice(b) - getProductPrice(a)
    );

  } else {
    list.sort((a, b) =>
      new Date(b.created_at || 0) -
      new Date(a.created_at || 0)
    );
  }

  return list;
}

/* PRODUCT DISPLAY */

function renderProducts() {
  const grid = $("#product-grid");

  if (!grid) return;

  const list = getVisibleProducts();

  if (!list.length) {
    grid.innerHTML = `
      <p class="loading-products">
        No products found.
      </p>
    `;
    return;
  }

  grid.innerHTML = list.map(product => {
    const oldPrice = Number(product.price || 0);
    const currentPrice = getProductPrice(product);
    const stock = Math.max(0, Number(product.stock || 0));

    const imageURL = safeImageURL(product.image_url);

    const image = imageURL
      ? `
        <img
          src="${escapeHTML(imageURL)}"
          alt="${escapeHTML(product.name)}"
          loading="lazy"
          onerror="this.style.display='none';this.nextElementSibling.style.display='grid';"
        >
        <div class="product-image-fallback" style="display:none">
          MR PRODUCT
        </div>
      `
      : `
        <div class="product-image-fallback">
          MR PRODUCT
        </div>
      `;

    const discount = currentPrice < oldPrice;

    return `
      <article class="product-card">

        <div class="product-image-wrap">

          ${discount
            ? `<span class="product-badge">SALE</span>`
            : ""
          }

          ${image}

        </div>

        <div class="product-card-content">

          <span class="product-category">
            ${escapeHTML(product.category || "BEAUTY")}
          </span>

          <h3>${escapeHTML(product.name)}</h3>

          <p class="product-description">
            ${escapeHTML(product.description || "")}
          </p>

          <div class="price product-price">

            <strong>${money(currentPrice)}</strong>

            ${
              discount
                ? `<del>${money(oldPrice)}</del>`
                : ""
            }

          </div>

          <p class="product-stock">
            ${
              stock > 0
                ? `In stock: ${stock}`
                : "Out of stock"
            }
          </p>

          <button
            class="button button-dark"
            data-add="${escapeHTML(product.id)}"
            type="button"
            ${stock <= 0 ? "disabled" : ""}
          >
            ${stock <= 0 ? "Out of stock" : "Add to bag"}
          </button>

        </div>

      </article>
    `;
  }).join("");
}

$("#product-search")?.addEventListener(
  "input",
  renderProducts
);

$("#product-sort")?.addEventListener(
  "change",
  renderProducts
);

/* CART DISPLAY */

function renderCart() {
  const count = getCartCount();

  $$("[id='cart-count']").forEach(element => {
    element.textContent = count;
  });

  const cartItems = $("#cart-items");

  if (cartItems) {
    cartItems.innerHTML = cart.length
      ? cart.map(item => `
          <div class="cart-line">

            <div class="cart-line-info">

              <b>${escapeHTML(item.name)}</b>

              <div class="muted small">
                ${money(item.price)} × ${item.qty}
              </div>

            </div>

            <div class="qty">

              <button
                type="button"
                data-dec="${escapeHTML(item.id)}"
                aria-label="Decrease quantity"
              >−</button>

              <span>${item.qty}</span>

              <button
                type="button"
                data-inc="${escapeHTML(item.id)}"
                aria-label="Increase quantity"
              >+</button>

            </div>

          </div>
        `).join("")
      : `
        <p class="muted">
          Your bag is empty.
        </p>
      `;
  }

  const total = money(getCartTotal());

  if ($("#cart-total")) {
    $("#cart-total").textContent = total;
  }

  if ($("#dialog-total")) {
    $("#dialog-total").textContent = total;
  }

  saveCart();
}

/* CART OPEN AND CLOSE */

function openCart() {
  if ($("#overlay")) {
    $("#overlay").hidden = false;
  }

  $("#cart-drawer")?.classList.add("open");

  $("#cart-drawer")?.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.style.overflow = "hidden";
}

function closeCart() {
  if ($("#overlay")) {
    $("#overlay").hidden = true;
  }

  $("#cart-drawer")?.classList.remove("open");

  $("#cart-drawer")?.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.style.overflow = "";
}

$("#cart-open")?.addEventListener("click", openCart);

$("#cart-close")?.addEventListener("click", closeCart);

$("#overlay")?.addEventListener("click", closeCart);

/* ADD TO CART */

$("#product-grid")?.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");

  if (!button) return;

  const id = button.dataset.add;

  const product = products.find(item =>
    String(item.id) === String(id)
  );

  if (!product) return;

  const stock = Math.max(
    0,
    Number(product.stock || 0)
  );

  if (stock <= 0) {
    alert("This product is out of stock.");
    return;
  }

  const item = cart.find(entry =>
    String(entry.id) === String(id)
  );

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

  const originalText = button.textContent;

  button.textContent = "Added ✓";

  button.disabled = true;

  setTimeout(() => {
    if (button.isConnected) {
      button.textContent = originalText;
      button.disabled = false;
    }
  }, 1000);
});

/* CART QUANTITY CONTROL */

$("#cart-items")?.addEventListener("click", event => {
  const button = event.target.closest("[data-inc], [data-dec]");

  if (!button) return;

  const id = button.dataset.inc || button.dataset.dec;

  const item = cart.find(entry =>
    String(entry.id) === String(id)
  );

  if (!item) return;

  if (button.dataset.inc !== undefined) {
    if (item.qty >= item.stock) {
      alert("Maximum available stock reached.");
      return;
    }

    item.qty++;

  } else {
    item.qty--;

    if (item.qty <= 0) {
      cart = cart.filter(entry =>
        String(entry.id) !== String(id)
      );
    }
  }

  renderCart();
});

/* CHECKOUT OPEN */

$("#checkout-open")?.addEventListener("click", () => {
  if (!cart.length) {
    alert("Your bag is empty.");
    return;
  }

  closeCart();

  showMessage("");

  const dialog = $("#order-dialog");

  if (dialog && typeof dialog.showModal === "function") {
    dialog.showModal();
    document.body.style.overflow = "hidden";
  }
});

/* CHECKOUT CLOSE */

$("#order-close")?.addEventListener("click", () => {
  $("#order-dialog")?.close();
  document.body.style.overflow = "";
});

$("#order-dialog")?.addEventListener("close", () => {
  document.body.style.overflow = "";
});

/* ORDER SUBMISSION */

$("#order-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (isSubmitting) return;

  const form = event.currentTarget;

  const message = $("#form-message");

  const submitButton = form.querySelector(
    'button[type="submit"]'
  );

  if (!cart.length) {
    showMessage("Your bag is empty.", "error");
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    showMessage(
      "Store checkout is not configured yet.",
      "error"
    );
    return;
  }

  /* CUSTOMER DETAILS */

  const customer = {
    name: getFieldValue(form, ["name"], ["customer-name"]),
    phone: getFieldValue(form, ["phone"], ["customer-phone"]),
    whatsapp: getFieldValue(form, ["whatsapp"], ["customer-whatsapp"]),
    district: getFieldValue(form, ["district"], ["district"]),
    area: getFieldValue(form, ["area"], ["area"]),
    address: getFieldValue(form, ["address"], ["address"])
  };

  /* PAYMENT METHOD */

  const paymentMethod = getFieldValue(
    form,
    ["payment", "payment_method", "payment-method"],
    ["payment-method"]
  ).toLowerCase();

  /* ORDER NOTE */

  const note = getFieldValue(
    form,
    ["note", "order_note", "order-note"],
    ["order-note"]
  );

  if (
    !customer.name ||
    !customer.phone ||
    !customer.district ||
    !customer.area ||
    !customer.address
  ) {
    showMessage(
      "Please complete all required delivery details.",
      "error"
    );
    return;
  }

  if (!["bkash", "nagad", "bank"].includes(paymentMethod)) {
    showMessage(
      "Please select a valid payment method.",
      "error"
    );
    return;
  }

  /* ORDER PAYLOAD */

  const orderPayload = {
    customer,

    payment_method: paymentMethod,

    items: cart.map(item => ({
      product_id: item.id,
      quantity: item.qty
    })),

    note
  };

  const originalButtonText = submitButton?.textContent || "Place order";

  isSubmitting = true;

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting order...";
  }

  showMessage(
    "Please wait. Your order is being submitted...",
    "info"
  );

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

        body: JSON.stringify(orderPayload)
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.ok !== true) {
      throw new Error(
        result.error ||
        "Your order could not be submitted. Please try again."
      );
    }

    const orderNumber =
      result.order_number ||
      result.order_id ||
      "Received";

    cart = [];

    renderCart();

    form.reset();

    showMessage(
      `Order successful! Order number: ${orderNumber}.`,
      "success"
    );

  } catch (error) {
    console.error("Order submission failed:", error);

    showMessage(
      error.message ||
      "Something went wrong. Please try again.",
      "error"
    );

  } finally {
    isSubmitting = false;

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
});

/* MOBILE MENU */

function openMobileMenu() {
  $("#mobile-menu")?.classList.add("open");

  document.body.style.overflow = "hidden";
}

function closeMobileMenu() {
  $("#mobile-menu")?.classList.remove("open");

  document.body.style.overflow = "";
}

$("#mobile-menu-toggle")?.addEventListener(
  "click",
  openMobileMenu
);

$("#mobile-menu-close")?.addEventListener(
  "click",
  closeMobileMenu
);

$("#mobile-menu")?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", closeMobileMenu);
});

/* ESCAPE KEY */

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeMobileMenu();

    if (!$("#order-dialog")?.open) {
      closeCart();
    }
  }
});

/* INITIALIZE */

renderCart();

loadStoreSettings();

loadProducts();
