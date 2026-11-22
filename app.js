"use strict";

const CONFIG = window.MR_PRODUCT_CONFIG || {};

const SUPABASE_URL = (CONFIG.supabaseUrl || "").replace(/\/$/, "");
const SUPABASE_KEY = CONFIG.publishableKey || CONFIG.anonKey || "";

const money = (amount) =>
  "৳" + Number(amount || 0).toLocaleString("en-BD", {
    maximumFractionDigits: 2
  });

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [...document.querySelectorAll(selector)];

const CART_KEY = "mr_product_cart";
const WISHLIST_KEY = "mr_product_wishlist";

let products = [];
let cart = loadJSON(CART_KEY, []);
let wishlist = loadJSON(WISHLIST_KEY, []);
let activeCategory = "all";
let searchTerm = "";
let couponData = null;
let repeatDiscountData = null;
let paymentSettings = {};
let storeSettings = {};

function loadJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function saveWishlist() {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
}

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`
  };
}

async function postOrderAction(payload) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Store connection is not configured.");
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/place-order`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.error) {
    throw new Error(result.error || result.message || "Request failed.");
  }

  return result;
}

async function fetchFunction(name, options = {}) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/${name}`,
    {
      ...options,
      headers: {
        ...getHeaders(),
        ...(options.headers || {})
      }
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || result.message || "Request failed.");
  }

  return result;
}

function getProductPrice(product) {
  const original = Number(product.price || 0);
  const discounted = Number(product.discount_price || 0);

  if (discounted > 0 && discounted < original) {
    return discounted;
  }

  return original;
}

function getProductImage(product) {
  return product.image_url ||
    "https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?auto=format&fit=crop&w=700&q=80";
}

function getProductStock(product) {
  return Number(product.stock ?? 0);
}

function isProductAvailable(product) {
  return product.active !== false && getProductStock(product) > 0;
}

function calculateSubtotal() {
  return cart.reduce((total, item) => {
    const product = products.find(
      (p) => String(p.id) === String(item.id)
    );

    const price = product ? getProductPrice(product) : Number(item.price || 0);

    return total + price * Number(item.quantity || 0);
  }, 0);
}

function getCouponDiscount() {
  return Number(
    couponData?.discount_amount ??
    couponData?.discount ??
    couponData?.amount ??
    0
  );
}

function getRepeatDiscount() {
  return Number(
    repeatDiscountData?.discount_amount ??
    repeatDiscountData?.discount ??
    0
  );
}

function getGrandTotal() {
  return Math.max(
    0,
    calculateSubtotal() - getCouponDiscount() - getRepeatDiscount()
  );
}

/* STORE SETTINGS */

async function loadStoreSettings() {
  try {
    const result = await fetchFunction("admin-settings", {
      method: "GET"
    });

    storeSettings = result.settings || result.store_settings || result || {};

    applyStoreSettings();
  } catch (error) {
    console.warn("Store settings:", error.message);
  }
}

function applyStoreSettings() {
  const settings = storeSettings;

  const storeName = settings.store_name || "MR PRODUCT";

  $$(".brand-name").forEach((element) => {
    element.textContent = storeName;
  });

  document.title = `${storeName} — Premium Shopping`;

  const description = settings.description;

  if (description) {
    const aboutText = $(".about-copy > p");
    if (aboutText) aboutText.textContent = description;
  }

  if (settings.logo_url) {
    $$(".brand-mark").forEach((element) => {
      element.innerHTML = `<img src="${escapeHTML(settings.logo_url)}" alt="${escapeHTML(storeName)} logo">`;
      element.style.background = "transparent";
    });
  }

  if (settings.banner_url) {
    const banner = $("#hero-banner-image");
    if (banner) banner.src = settings.banner_url;
  }

  if (settings.primary_color) {
    document.documentElement.style.setProperty(
      "--accent",
      settings.primary_color
    );
  }

  if (settings.phone) {
    const phone = $("#contact-phone");
    if (phone) {
      phone.href = `tel:${settings.phone}`;
      phone.innerHTML = `Phone: <span>${escapeHTML(settings.phone)}</span>`;
    }
  }

  if (settings.whatsapp) {
    const whatsapp = $("#contact-whatsapp");
    if (whatsapp) {
      const number = String(settings.whatsapp).replace(/\D/g, "");
      whatsapp.href = `https://wa.me/${number}`;
      whatsapp.innerHTML = `WhatsApp: <span>${escapeHTML(settings.whatsapp)}</span>`;
    }
  }

  if (settings.email) {
    const email = $("#contact-email");
    if (email) {
      email.href = `mailto:${settings.email}`;
      email.innerHTML = `Email: <span>${escapeHTML(settings.email)}</span>`;
    }
  }
}

/* PRODUCTS */

async function loadProducts() {
  const grid = $("#product-grid");

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (grid) {
      grid.innerHTML = `<div class="empty-state">Store connection is not configured.</div>`;
    }
    return;
  }

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

    products = await response.json();

    renderProducts();
    renderCategories();
    renderWishlist();
  } catch (error) {
    console.error(error);

    if (grid) {
      grid.innerHTML = `<div class="empty-state">Products could not be loaded. Please refresh the page.</div>`;
    }
  }
}

function getFilteredProducts() {
  let list = [...products];

  if (activeCategory === "sale") {
    list = list.filter((product) => {
      const original = Number(product.price || 0);
      const discounted = Number(product.discount_price || 0);
      return discounted > 0 && discounted < original;
    });
  } else if (activeCategory === "new") {
    list = list.slice(0, 8);
  } else if (activeCategory === "popular") {
    list = list.filter((product) => getProductStock(product) > 0);
  } else if (
    activeCategory !== "all" &&
    activeCategory !== "new" &&
    activeCategory !== "popular"
  ) {
    list = list.filter((product) =>
      String(product.category || "").toLowerCase() ===
      activeCategory.toLowerCase()
    );
  }

  if (searchTerm) {
    list = list.filter((product) => {
      const text = `${product.name || ""} ${product.category || ""} ${product.description || ""}`.toLowerCase();
      return text.includes(searchTerm);
    });
  }

  return list;
}

function renderProducts() {
  const grid = $("#product-grid");
  if (!grid) return;

  const list = getFilteredProducts();

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state">No products found.</div>`;
    return;
  }

  grid.innerHTML = list.map((product) => {
    const price = getProductPrice(product);
    const original = Number(product.price || 0);
    const discounted = price < original;
    const stock = getProductStock(product);
    const isSaved = wishlist.some(
      (id) => String(id) === String(product.id)
    );

    return `
      <article class="product-card">
        <div class="product-image">
          ${discounted ? `<span class="product-badge sale">SPECIAL PRICE</span>` : ""}
          ${stock <= 0 ? `<span class="product-badge">SOLD OUT</span>` : ""}
          <button
            class="wishlist-toggle ${isSaved ? "active" : ""}"
            type="button"
            data-wishlist="${escapeHTML(product.id)}"
            aria-label="Add to wishlist"
          >${isSaved ? "♥" : "♡"}</button>
          <img
            src="${escapeHTML(getProductImage(product))}"
            alt="${escapeHTML(product.name)}"
            loading="lazy"
          >
        </div>

        <div class="product-info">
          <span class="product-category">${escapeHTML(product.category || "COLLECTION")}</span>
          <h3>${escapeHTML(product.name)}</h3>

          <div class="product-price">
            <span>${money(price)}</span>
            ${discounted ? `<span class="old-price">${money(original)}</span>` : ""}
          </div>

          <div class="stock-label ${stock <= 0 ? "out" : ""}">
            ${stock <= 0 ? "Currently unavailable" : `${stock} in stock`}
          </div>

          <div class="product-actions">
            <button
              type="button"
              data-add="${escapeHTML(product.id)}"
              ${stock <= 0 ? "disabled" : ""}
            >${stock <= 0 ? "SOLD OUT" : "ADD TO BAG +"}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderCategories() {
  const container = $(".category-menu");
  if (!container) return;

  const categories = [
    ...new Set(
      products
        .map((product) => String(product.category || "").trim())
        .filter(Boolean)
    )
  ];

  container.innerHTML = `
    <button type="button" class="active" data-category="all">All products</button>
    ${categories.map((category) => `
      <button type="button" data-category="${escapeHTML(category)}">
        ${escapeHTML(category)}
      </button>
    `).join("")}
  `;
}

/* WISHLIST */

function toggleWishlist(id) {
  const exists = wishlist.some(
    (item) => String(item) === String(id)
  );

  if (exists) {
    wishlist = wishlist.filter(
      (item) => String(item) !== String(id)
    );
  } else {
    wishlist.push(id);
  }

  saveWishlist();
  renderProducts();
  renderWishlist();
}

function renderWishlist() {
  const grid = $("#wishlist-grid");
  const count = $("#wishlist-count");

  if (count) count.textContent = wishlist.length;
  if (!grid) return;

  const savedProducts = products.filter((product) =>
    wishlist.some((id) => String(id) === String(product.id))
  );

  if (!savedProducts.length) {
    grid.innerHTML = `<div class="empty-state">Your saved products will appear here.</div>`;
    return;
  }

  grid.innerHTML = savedProducts.map((product) => {
    const price = getProductPrice(product);
    const stock = getProductStock(product);

    return `
      <article class="product-card">
        <div class="product-image">
          <button
            class="wishlist-toggle active"
            type="button"
            data-wishlist="${escapeHTML(product.id)}"
          >♥</button>
          <img src="${escapeHTML(getProductImage(product))}" alt="${escapeHTML(product.name)}" loading="lazy">
        </div>
        <div class="product-info">
          <span class="product-category">${escapeHTML(product.category || "COLLECTION")}</span>
          <h3>${escapeHTML(product.name)}</h3>
          <div class="product-price">${money(price)}</div>
          <div class="product-actions">
            <button type="button" data-add="${escapeHTML(product.id)}" ${stock <= 0 ? "disabled" : ""}>
              ${stock <= 0 ? "SOLD OUT" : "ADD TO BAG +"}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/* CART */

function addToCart(id) {
  const product = products.find(
    (item) => String(item.id) === String(id)
  );

  if (!product) return;

  const stock = getProductStock(product);

  if (stock <= 0) {
    alert("This product is currently out of stock.");
    return;
  }

  const existing = cart.find(
    (item) => String(item.id) === String(id)
  );

  if (existing) {
    if (existing.quantity >= stock) {
      alert("You cannot add more than the available stock.");
      return;
    }

    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: getProductPrice(product),
      image_url: getProductImage(product),
      quantity: 1
    });
  }

  saveCart();
  renderCart();
}

function changeCartQuantity(id, change) {
  const item = cart.find(
    (product) => String(product.id) === String(id)
  );

  if (!item) return;

  const product = products.find(
    (p) => String(p.id) === String(id)
  );

  const stock = product ? getProductStock(product) : 0;
  const next = item.quantity + change;

  if (next <= 0) {
    cart = cart.filter(
      (product) => String(product.id) !== String(id)
    );
  } else if (next > stock) {
    alert("Available stock limit reached.");
    return;
  } else {
    item.quantity = next;
  }

  saveCart();
  renderCart();
  renderCheckoutTotals();
}

function removeFromCart(id) {
  cart = cart.filter(
    (item) => String(item.id) !== String(id)
  );

  saveCart();
  renderCart();
  renderCheckoutTotals();
}

function renderCart() {
  const container = $("#cart-items");
  const count = $("#cart-count");
  const mobileCount = $("#mobile-cart-count");

  const totalQuantity = cart.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  if (count) count.textContent = totalQuantity;
  if (mobileCount) mobileCount.textContent = totalQuantity;

  if (container) {
    if (!cart.length) {
      container.innerHTML = `<div class="empty-state">Your shopping bag is empty.</div>`;
    } else {
      container.innerHTML = cart.map((item) => `
        <div class="cart-item">
          <img src="${escapeHTML(item.image_url || "")}" alt="${escapeHTML(item.name)}">
          <div>
            <h4>${escapeHTML(item.name)}</h4>
            <div class="cart-item-price">${money(item.price)}</div>
            <div class="cart-quantity">
              <button type="button" data-quantity="${escapeHTML(item.id)}" data-change="-1">−</button>
              <span>${Number(item.quantity)}</span>
              <button type="button" data-quantity="${escapeHTML(item.id)}" data-change="1">+</button>
            </div>
          </div>
          <button class="cart-remove" type="button" data-remove="${escapeHTML(item.id)}">Remove</button>
        </div>
      `).join("");
    }
  }

  const total = $("#cart-total");
  if (total) total.textContent = money(calculateSubtotal());

  renderCheckoutTotals();
}

function openCart() {
  $("#cart-drawer")?.classList.add("active");
  $("#overlay")?.classList.add("active");
  document.body.classList.add("no-scroll");
}

function closeCart() {
  $("#cart-drawer")?.classList.remove("active");
  $("#overlay")?.classList.remove("active");
  document.body.classList.remove("no-scroll");
}

/* PAYMENT SETTINGS */

async function loadPaymentSettings() {
  try {
    const result = await fetchFunction("admin-settings", {
      method: "GET"
    });

    paymentSettings =
      result.payment_settings ||
      result.paymentSettings ||
      result.settings ||
      result ||
      {};
  } catch (error) {
    console.warn("Payment settings:", error.message);
  }
}

function getPaymentInformation(method) {
  const settings = paymentSettings;

  const paymentMap = {
    bkash: [
      settings.bkash_number,
      settings.bkash_account,
      settings.bkash_instructions
    ],
    nagad: [
      settings.nagad_number,
      settings.nagad_account,
      settings.nagad_instructions
    ],
    bank: [
      settings.bank_name,
      settings.bank_account,
      settings.bank_branch,
      settings.bank_instructions
    ]
  };

  const values = paymentMap[method] || [];

  return values
    .filter(Boolean)
    .join("\n") || "Please contact our team for payment instructions.";
}

function updatePaymentInformation() {
  const method = $('select[name="payment"]')?.value;
  const box = $("#payment-details");
  const text = $("#payment-info-text");

  if (!box || !text) return;

  if (!method) {
    text.textContent = "Select a payment method to see payment instructions.";
    return;
  }

  text.textContent = getPaymentInformation(method);
}

/* COUPON */

async function applyCoupon() {
  const input = $("#coupon-code");
  const message = $("#coupon-message");
  const code = input?.value.trim();

  if (!code) {
    if (message) message.textContent = "Enter a coupon code.";
    return;
  }

  if (!cart.length) {
    if (message) message.textContent = "Your cart is empty.";
    return;
  }

  if (message) message.textContent = "Checking coupon...";

  try {
    const result = await postOrderAction({
      action: "validate_coupon",
      coupon_code: code,
      subtotal: calculateSubtotal()
    });

    if (result.valid === false || result.error) {
      couponData = null;
      if (message) {
        message.textContent = result.message || result.error || "Invalid coupon.";
      }
    } else {
      couponData = result;
      if (message) {
        message.textContent = result.message || "Coupon applied successfully.";
      }
    }

    renderCheckoutTotals();
  } catch (error) {
    couponData = null;
    if (message) message.textContent = error.message;
    renderCheckoutTotals();
  }
}

/* REPEAT CUSTOMER DISCOUNT */

let repeatPreviewTimer;

function scheduleRepeatDiscountPreview() {
  clearTimeout(repeatPreviewTimer);

  repeatPreviewTimer = setTimeout(() => {
    previewRepeatDiscount();
  }, 650);
}

async function previewRepeatDiscount() {
  const form = $("#order-form");
  if (!form) return;

  const formData = new FormData(form);

  const customer = {
    name: formData.get("name") || "",
    phone: formData.get("phone") || "",
    whatsapp: formData.get("whatsapp") || "",
    district: formData.get("district") || "",
    area: formData.get("area") || "",
    address: formData.get("address") || ""
  };

  if (!customer.phone || !customer.address) {
    repeatDiscountData = null;
    renderCheckoutTotals();
    return;
  }

  try {
    const result = await postOrderAction({
      action: "preview_repeat_discount",
      customer,
      subtotal: calculateSubtotal(),
      coupon_discount: getCouponDiscount()
    });

    repeatDiscountData = result;
    renderCheckoutTotals();

    const count = $("#repeat-order-count");
    const percent = $("#repeat-discount-percent");

    if (count) {
      count.textContent = result.total_orders ?? result.order_count ?? 0;
    }

    if (percent) {
      percent.textContent = `${result.discount_percent ?? result.percent ?? 0}%`;
    }

    const message = $("#repeat-discount-message");

    if (message) {
      message.style.display =
        getRepeatDiscount() > 0 ? "flex" : "none";
    }
  } catch (error) {
    console.warn("Repeat discount preview:", error.message);
  }
}

/* CHECKOUT TOTALS */

function renderCheckoutTotals() {
  const subtotal = calculateSubtotal();
  const couponDiscount = getCouponDiscount();
  const repeatDiscount = getRepeatDiscount();
  const totalDiscount = couponDiscount + repeatDiscount;
  const grandTotal = Math.max(0, subtotal - totalDiscount);

  const values = {
    "#dialog-total": subtotal,
    "#dialog-discount": couponDiscount,
    "#dialog-repeat-discount": repeatDiscount,
    "#dialog-total-discount": totalDiscount,
    "#dialog-grand-total": grandTotal
  };

  Object.entries(values).forEach(([selector, value]) => {
    const element = $(selector);
    if (element) element.textContent = money(value);
  });
}

function openCheckout() {
  if (!cart.length) {
    alert("Your shopping bag is empty.");
    return;
  }

  closeCart();

  const dialog = $("#order-dialog");

  if (dialog && !dialog.open) {
    dialog.showModal();
  }

  renderCheckoutTotals();
  updatePaymentInformation();
  scheduleRepeatDiscountPreview();
}

/* PLACE ORDER */

async function submitOrder(event) {
  event.preventDefault();

  const form = $("#order-form");
  const message = $("#form-message");
  const submitButton = form?.querySelector('[type="submit"]');

  if (!form || !cart.length) {
    if (message) message.textContent = "Your cart is empty.";
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

  const paymentMethod = String(formData.get("payment") || "");

  if (!customer.name || !customer.phone || !customer.district ||
      !customer.area || !customer.address) {
    if (message) message.textContent = "Please complete all required fields.";
    return;
  }

  if (!["bkash", "nagad", "bank"].includes(paymentMethod)) {
    if (message) message.textContent = "Please select a valid payment method.";
    return;
  }

  for (const item of cart) {
    const product = products.find(
      (p) => String(p.id) === String(item.id)
    );

    if (!product || getProductStock(product) < item.quantity) {
      if (message) {
        message.textContent = `${item.name} does not have enough stock. Please update your cart.`;
      }
      return;
    }
  }

  const items = cart.map((item) => {
    const product = products.find(
      (p) => String(p.id) === String(item.id)
    );

    const price = product
      ? getProductPrice(product)
      : Number(item.price || 0);

    return {
      product_id: item.id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: price,
      total_price: price * item.quantity
    };
  });

  const payload = {
    action: "place_order",
    customer,
    payment_method: paymentMethod,
    items,
    note: String(formData.get("note") || "").trim(),
    coupon_code: couponData?.coupon?.code ||
      $("#coupon-code")?.value.trim() ||
      null
  };

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting order...";
  }

  if (message) {
    message.style.color = "var(--muted)";
    message.textContent = "Please wait. Your order is being submitted...";
  }

  try {
    const result = await postOrderAction(payload);

    const orderNumber =
      result.order_number ||
      result.order?.order_number ||
      result.data?.order_number ||
      result.id ||
      "Submitted";

    const total =
      result.grand_total ??
      result.order?.grand_total ??
      getGrandTotal();

    cart = [];
    couponData = null;
    repeatDiscountData = null;

    saveCart();
    renderCart();

    form.reset();

    const couponMessage = $("#coupon-message");
    if (couponMessage) couponMessage.textContent = "";

    const dialog = $("#order-dialog");
    if (dialog?.open) dialog.close();

    alert(
      `Thank you! Your order has been placed successfully.\n\nOrder Number: ${orderNumber}\nTotal: ${money(total)}\n\nYou can track your order from the Track Order page.`
    );

    window.location.href =
      `track-order.html?order=${encodeURIComponent(orderNumber)}`;

  } catch (error) {
    if (message) {
      message.style.color = "var(--danger)";
      message.textContent = error.message || "Could not place your order. Please try again.";
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Place order <span>↗</span>';
    }
  }
}

/* SEARCH AND FILTERS */

function runSearch() {
  const input = $("#product-search");
  searchTerm = String(input?.value || "").trim().toLowerCase();

  renderProducts();

  $("#products")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/* EVENT LISTENERS */

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  if (addButton) {
    addToCart(addButton.dataset.add);
    return;
  }

  const wishlistButton = event.target.closest("[data-wishlist]");
  if (wishlistButton) {
    toggleWishlist(wishlistButton.dataset.wishlist);
    return;
  }

  const quantityButton = event.target.closest("[data-quantity]");
  if (quantityButton) {
    changeCartQuantity(
      quantityButton.dataset.quantity,
      Number(quantityButton.dataset.change)
    );
    return;
  }

  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    removeFromCart(removeButton.dataset.remove);
    return;
  }

  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    activeCategory = categoryButton.dataset.category;

    $$(".product-tab").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.category === activeCategory
      );
    });

    $$(".category-menu button").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.category === activeCategory
      );
    });

    renderProducts();
    return;
  }
});

$("#cart-open")?.addEventListener("click", openCart);
$("#mobile-cart-open")?.addEventListener("click", openCart);
$("#cart-close")?.addEventListener("click", closeCart);
$("#overlay")?.addEventListener("click", closeCart);

$("#checkout-open")?.addEventListener("click", openCheckout);

$("#order-close")?.addEventListener("click", () => {
  $("#order-dialog")?.close();
});

$("#order-dialog")?.addEventListener("click", (event) => {
  if (event.target === $("#order-dialog")) {
    $("#order-dialog").close();
  }
});

$("#search-button")?.addEventListener("click", () => {
  $("#product-search")?.focus();
  $("#products")?.scrollIntoView({ behavior: "smooth" });
});

$("#search-submit")?.addEventListener("click", runSearch);

$("#product-search")?.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim().toLowerCase();
  renderProducts();
});

$("#product-search")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runSearch();
});

$("#apply-coupon")?.addEventListener("click", applyCoupon);

$('select[name="payment"]')?.addEventListener(
  "change",
  updatePaymentInformation
);

$("#order-form")?.addEventListener("submit", submitOrder);

$("#order-form")?.addEventListener("input", (event) => {
  const field = event.target.name;

  if (["name", "phone", "whatsapp", "district", "area", "address"].includes(field)) {
    scheduleRepeatDiscountPreview();
  }
});

$$(".product-tab").forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;

    $$(".product-tab").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });

    renderProducts();
  });
});

/* STARTUP */

function initializeStore() {
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  renderCart();
  renderWishlist();

  loadProducts();
  loadPaymentSettings();
  loadStoreSettings();
}

initializeStore();
