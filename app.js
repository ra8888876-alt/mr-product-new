"use strict";

/* =========================================
   MR PRODUCT — STOREFRONT APP
========================================= */

const CONFIG = window.MR_PRODUCT_CONFIG || {};

const SUPABASE_URL = (CONFIG.supabaseUrl || "").replace(/\/$/, "");
const SUPABASE_KEY = CONFIG.publishableKey || "";

const API = `${SUPABASE_URL}/rest/v1`;
const FUNCTIONS = `${SUPABASE_URL}/functions/v1`;

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const money = (amount) =>
  "৳" + Number(amount || 0).toLocaleString("en-BD", {
    maximumFractionDigits: 2
  });

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);

const safeImage = (url) => {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.origin);
    if (["http:", "https:"].includes(parsed.protocol)) return parsed.href;
  } catch (_) {}
  return "";
};

const STORAGE_CART = "mr_product_cart";
const STORAGE_WISHLIST = "mr_product_wishlist";

let products = [];
let categories = [];
let cart = [];
let wishlist = [];
let storeSettings = {};
let paymentSettings = {};
let selectedCategory = "all";
let selectedTab = "all";
let currentCoupon = null;
let couponDiscount = 0;
let repeatDiscount = 0;
let repeatOrderCount = 0;
let repeatDiscountPercent = 0;
let searchText = "";
let isSubmittingOrder = false;

/* =========================================
   STORAGE
========================================= */

function readStorage(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function saveCart() {
  localStorage.setItem(STORAGE_CART, JSON.stringify(cart));
}

function saveWishlist() {
  localStorage.setItem(STORAGE_WISHLIST, JSON.stringify(wishlist));
}

function loadCart() {
  const saved = readStorage(STORAGE_CART, []);
  cart = Array.isArray(saved) ? saved : [];
}

function loadWishlist() {
  const saved = readStorage(STORAGE_WISHLIST, []);
  wishlist = Array.isArray(saved) ? saved : [];
}

/* =========================================
   API
========================================= */

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra
  };
}

async function apiRequest(url, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase configuration missing. Check config.js");
  }

  const response = await fetch(url, {
    ...options,
    headers: headers(options.headers || {})
  });

  const text = await response.text();
  let result = {};

  try {
    result = text ? JSON.parse(text) : {};
  } catch (_) {
    result = { message: text };
  }

  if (!response.ok) {
    throw new Error(
      result.message ||
      result.error ||
      result.details ||
      `Request failed (${response.status})`
    );
  }

  return result;
}

async function callFunction(name, payload = null, method = "POST") {
  const options = {
    method,
    headers: {}
  };

  if (payload !== null) {
    options.body = JSON.stringify(payload);
  }

  return apiRequest(`${FUNCTIONS}/${name}`, options);
}

async function postOrderAction(payload) {
  return callFunction("place-order", payload, "POST");
}

/* =========================================
   NOTIFICATIONS
========================================= */

function showMessage(message, type = "success") {
  let toast = $("#mr-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "mr-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.dataset.type = type;
  toast.style.display = "block";

  clearTimeout(showMessage.timer);

  showMessage.timer = setTimeout(() => {
    toast.style.display = "none";
  }, 3200);
}

/* =========================================
   STORE SETTINGS
========================================= */

async function loadStoreSettings() {
  try {
    const result = await callFunction("admin-settings", null, "GET");

    if (result?.settings) {
      storeSettings = result.settings;
      applyStoreSettings();
    }
  } catch (error) {
    console.warn("Store settings:", error.message);
  }
}

function applyStoreSettings() {
  const settings = storeSettings;

  const storeName = settings.store_name || "MR PRODUCT";
  const description = settings.description || "";

  const nameElement = $("#store-name");
  const footerName = $("#footer-store-name");
  const descriptionElement = $("#store-description");

  if (nameElement) nameElement.textContent = storeName;
  if (footerName) footerName.textContent = storeName;
  if (descriptionElement && description) {
    descriptionElement.textContent = description;
  }

  if (settings.logo_url) {
    const logo = safeImage(settings.logo_url);

    $$(".brand-logo, #store-logo, .footer-logo img").forEach((element) => {
      if (element.tagName === "IMG") {
        element.src = logo;
      }
    });
  }

  if (settings.banner_url) {
    const banner = $("#hero-banner-image");
    if (banner) banner.src = safeImage(settings.banner_url);
  }

  if (settings.primary_color) {
    document.documentElement.style.setProperty(
      "--bronze",
      settings.primary_color
    );
  }

  const phone = settings.phone || "";
  const whatsapp = settings.whatsapp || "";
  const email = settings.email || "";

  const phoneText = $("#contact-phone");
  const phoneLink = $("#contact-phone-link");
  const whatsappText = $("#contact-whatsapp");
  const whatsappLink = $("#contact-whatsapp-link");
  const emailText = $("#contact-email");
  const emailLink = $("#contact-email-link");
  const footerPhone = $("#footer-phone");
  const footerEmail = $("#footer-email");
  const footerWhatsapp = $("#footer-whatsapp");

  if (phoneText) phoneText.textContent = phone || "Not available";
  if (phoneLink) {
    phoneLink.href = phone ? `tel:${phone.replace(/\s/g, "")}` : "#";
  }

  if (whatsappText) whatsappText.textContent = whatsapp || "Not available";
  if (whatsappLink) {
    const number = whatsapp.replace(/\D/g, "");
    whatsappLink.href = number ? `https://wa.me/${number}` : "#";
  }

  if (emailText) emailText.textContent = email || "Not available";
  if (emailLink) emailLink.href = email ? `mailto:${email}` : "#";

  if (footerPhone) footerPhone.textContent = phone;
  if (footerEmail) footerEmail.textContent = email;
  if (footerWhatsapp) footerWhatsapp.textContent = whatsapp;

  document.title = `${storeName} — Premium Store`;
}

/* =========================================
   PRODUCTS
========================================= */

async function loadProducts() {
  const grid = $("#product-grid");

  if (grid) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>Loading products...</h3>
        <p>Please wait.</p>
      </div>
    `;
  }

  try {
    const result = await apiRequest(
      `${API}/products?select=id,name,description,price,discount_price,image_url,category,stock,active,created_at&active=eq.true&order=created_at.desc`,
      { method: "GET" }
    );

    products = Array.isArray(result) ? result : [];

    renderCategories();
    renderProducts();
    renderWishlist();

  } catch (error) {
    console.error("Product loading error:", error);

    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>Products could not be loaded</h3>
          <p>${escapeHTML(error.message)}</p>
        </div>
      `;
    }
  }
}

function getProductPrice(product) {
  const regular = Number(product.price || 0);
  const discount = Number(product.discount_price || 0);

  if (discount > 0 && discount < regular) return discount;

  return regular;
}

function isDiscounted(product) {
  const regular = Number(product.price || 0);
  const discount = Number(product.discount_price || 0);

  return discount > 0 && discount < regular;
}

function getDiscountPercent(product) {
  if (!isDiscounted(product)) return 0;

  const regular = Number(product.price);
  const discount = Number(product.discount_price);

  return Math.round(((regular - discount) / regular) * 100);
}

function renderCategories() {
  const container = $(".category-list");

  if (!container) return;

  categories = [
    ...new Set(
      products
        .map((product) => product.category)
        .filter(Boolean)
    )
  ];

  if (!categories.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = categories.map((category) => `
    <button
      class="category-item ${selectedCategory === category ? "active" : ""}"
      type="button"
      data-category="${escapeHTML(category)}"
    >
      <strong>${escapeHTML(category)}</strong>
    </button>
  `).join("");

  container.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;
      selectedTab = "all";

      updateActiveTabs();
      renderCategories();
      renderProducts();

      $("#shop")?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function getFilteredProducts() {
  let list = [...products];

  if (selectedCategory !== "all") {
    list = list.filter(
      (product) => product.category === selectedCategory
    );
  }

  if (selectedTab === "sale") {
    list = list.filter(isDiscounted);
  }

  if (selectedTab === "featured") {
    list = list.filter((product) => product.stock > 0);
  }

  if (selectedTab === "new") {
    list = list.slice(0, 12);
  }

  if (searchText) {
    const search = searchText.toLowerCase();

    list = list.filter((product) => {
      return [
        product.name,
        product.description,
        product.category
      ].some((value) =>
        String(value || "").toLowerCase().includes(search)
      );
    });
  }

  const sort = $("#product-sort")?.value || "default";

  if (sort === "price-low") {
    list.sort((a, b) => getProductPrice(a) - getProductPrice(b));
  } else if (sort === "price-high") {
    list.sort((a, b) => getProductPrice(b) - getProductPrice(a));
  } else if (sort === "name") {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "discount") {
    list.sort((a, b) => getDiscountPercent(b) - getDiscountPercent(a));
  }

  return list;
}

function productCard(product) {
  const price = getProductPrice(product);
  const discounted = isDiscounted(product);
  const outOfStock = Number(product.stock || 0) <= 0;
  const image = safeImage(product.image_url);
  const liked = wishlist.includes(product.id);

  return `
    <article class="product-card" data-product-id="${escapeHTML(product.id)}">

      <div class="product-image-wrap">
        ${image ? `
          <img
            src="${escapeHTML(image)}"
            alt="${escapeHTML(product.name)}"
            loading="lazy"
            onerror="this.style.display='none'"
          >
        ` : ""}

        ${discounted ? `
          <span class="product-badge">
            ${getDiscountPercent(product)}% OFF
          </span>
        ` : ""}

        <button
          class="product-wishlist ${liked ? "active" : ""}"
          type="button"
          data-wishlist="${escapeHTML(product.id)}"
          aria-label="Add to wishlist"
        >${liked ? "♥" : "♡"}</button>
      </div>

      <div class="product-info">
        ${product.category ? `
          <div class="product-category">
            ${escapeHTML(product.category)}
          </div>
        ` : ""}

        <h3 class="product-name">
          ${escapeHTML(product.name)}
        </h3>

        ${product.description ? `
          <p class="product-description">
            ${escapeHTML(product.description)}
          </p>
        ` : ""}

        <div class="product-price">
          <strong>${money(price)}</strong>

          ${discounted ? `
            <del>${money(product.price)}</del>
          ` : ""}
        </div>

        <div class="product-stock ${outOfStock ? "out-of-stock" : ""}">
          ${outOfStock ? "Out of stock" : `In stock: ${Number(product.stock)}`}
        </div>

        <button
          class="product-add-button"
          type="button"
          data-add-cart="${escapeHTML(product.id)}"
          ${outOfStock ? "disabled" : ""}
        >
          ${outOfStock ? "Out of Stock" : "Add to Cart"}
        </button>
      </div>
    </article>
  `;
}

function renderProducts() {
  const grid = $("#product-grid");
  if (!grid) return;

  const list = getFilteredProducts();

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No products found</h3>
        <p>Please try another category or search.</p>
      </div>
    `;
  } else {
    grid.innerHTML = list.map(productCard).join("");
  }

  const count = $("#product-results-count");
  if (count) {
    count.textContent = `${list.length} products found`;
  }

  grid.querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.addCart);
    });
  });

  grid.querySelectorAll("[data-wishlist]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleWishlist(button.dataset.wishlist);
    });
  });

  updateActiveTabs();
}

/* =========================================
   PRODUCT TABS AND SEARCH
========================================= */

function updateActiveTabs() {
  $$(".product-tab").forEach((button) => {
    const tab = button.dataset.tab || button.dataset.filter || "all";

    button.classList.toggle("active", tab === selectedTab);
  });

  $$(".category-item").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.category === selectedCategory
    );
  });
}

function setupProductFilters() {
  $$(".product-tab").forEach((button) => {
    button.addEventListener("click", () => {
      selectedTab =
        button.dataset.tab ||
        button.dataset.filter ||
        "all";

      selectedCategory = "all";

      updateActiveTabs();
      renderCategories();
      renderProducts();
    });
  });

  const searchInputs = [
    $("#product-search"),
    $("#mobile-product-search")
  ].filter(Boolean);

  searchInputs.forEach((input) => {
    input.addEventListener("input", () => {
      searchText = input.value.trim();

      searchInputs.forEach((other) => {
        if (other !== input) other.value = input.value;
      });

      renderProducts();
    });
  });

  $("#search-button")?.addEventListener("click", () => {
    $("#shop")?.scrollIntoView({ behavior: "smooth" });
    $("#product-search")?.focus();
  });

  $("#product-sort")?.addEventListener("change", renderProducts);
}

/* =========================================
   WISHLIST
========================================= */

function toggleWishlist(productId) {
  const id = String(productId);

  if (wishlist.includes(id)) {
    wishlist = wishlist.filter((item) => item !== id);
    showMessage("Removed from wishlist");
  } else {
    wishlist.push(id);
    showMessage("Added to wishlist");
  }

  saveWishlist();
  renderProducts();
  renderWishlist();
}

function renderWishlist() {
  const grid = $("#wishlist-grid");
  const empty = $("#wishlist-empty");
  const count = $("#wishlist-count");

  const list = products.filter((product) =>
    wishlist.includes(String(product.id))
  );

  if (count) count.textContent = list.length;

  if (!grid) return;

  if (!list.length) {
    grid.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  grid.innerHTML = list.map(productCard).join("");

  grid.querySelectorAll("[data-add-cart]").forEach((button) => {
    button.addEventListener("click", () => {
      addToCart(button.dataset.addCart);
    });
  });

  grid.querySelectorAll("[data-wishlist]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleWishlist(button.dataset.wishlist);
    });
  });
}

/* =========================================
   CART
========================================= */

function findProduct(productId) {
  return products.find(
    (product) => String(product.id) === String(productId)
  );
}

function addToCart(productId, quantity = 1) {
  const product = findProduct(productId);

  if (!product) {
    showMessage("Product not found", "error");
    return;
  }

  const stock = Number(product.stock || 0);

  if (stock <= 0) {
    showMessage("This product is out of stock", "error");
    return;
  }

  const existing = cart.find(
    (item) => String(item.product_id) === String(productId)
  );

  const requestedQuantity = existing
    ? Number(existing.quantity) + Number(quantity)
    : Number(quantity);

  if (requestedQuantity > stock) {
    showMessage(`Only ${stock} items available`, "error");
    return;
  }

  if (existing) {
    existing.quantity = requestedQuantity;
  } else {
    cart.push({
      product_id: product.id,
      quantity: Number(quantity)
    });
  }

  saveCart();
  renderCart();
  showMessage("Product added to cart");
}

function changeCartQuantity(productId, change) {
  const item = cart.find(
    (cartItem) => String(cartItem.product_id) === String(productId)
  );

  if (!item) return;

  const product = findProduct(productId);
  if (!product) return;

  const nextQuantity = Number(item.quantity) + Number(change);

  if (nextQuantity <= 0) {
    removeFromCart(productId);
    return;
  }

  if (nextQuantity > Number(product.stock || 0)) {
    showMessage("Available stock limit reached", "error");
    return;
  }

  item.quantity = nextQuantity;

  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(
    (item) => String(item.product_id) !== String(productId)
  );

  saveCart();
  renderCart();
}

function getCartDetails() {
  return cart.map((item) => {
    const product = findProduct(item.product_id);

    if (!product) return null;

    const quantity = Number(item.quantity || 1);
    const price = getProductPrice(product);

    return {
      product,
      product_id: product.id,
      quantity,
      price,
      total: price * quantity
    };
  }).filter(Boolean);
}

function getCartSubtotal() {
  return getCartDetails().reduce(
    (sum, item) => sum + item.total,
    0
  );
}

function renderCart() {
  const container = $("#cart-items");
  const totalElement = $("#cart-total");

  const details = getCartDetails();

  const totalQuantity = details.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  if ($("#cart-count")) {
    $("#cart-count").textContent = totalQuantity;
  }

  if ($("#mobile-cart-count")) {
    $("#mobile-cart-count").textContent = totalQuantity;
  }

  if (!container) return;

  if (!details.length) {
    container.innerHTML = `
      <div class="cart-empty">
        <h3>Your cart is empty</h3>
        <p>Add some products to continue.</p>
      </div>
    `;

    if (totalElement) totalElement.textContent = money(0);
    return;
  }

  container.innerHTML = details.map((item) => `
    <div class="cart-item">
      <img
        src="${escapeHTML(safeImage(item.product.image_url))}"
        alt="${escapeHTML(item.product.name)}"
      >

      <div>
        <h4>${escapeHTML(item.product.name)}</h4>
        <p>${money(item.price)}</p>

        <div class="cart-quantity">
          <button
            type="button"
            data-cart-minus="${escapeHTML(item.product_id)}"
          >−</button>

          <span>${item.quantity}</span>

          <button
            type="button"
            data-cart-plus="${escapeHTML(item.product_id)}"
          >+</button>
        </div>
      </div>

      <button
        type="button"
        data-cart-remove="${escapeHTML(item.product_id)}"
      >Remove</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-cart-minus]").forEach((button) => {
    button.addEventListener("click", () => {
      changeCartQuantity(button.dataset.cartMinus, -1);
    });
  });

  container.querySelectorAll("[data-cart-plus]").forEach((button) => {
    button.addEventListener("click", () => {
      changeCartQuantity(button.dataset.cartPlus, 1);
    });
  });

  container.querySelectorAll("[data-cart-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      removeFromCart(button.dataset.cartRemove);
    });
  });

  if (totalElement) {
    totalElement.textContent = money(getCartSubtotal());
  }
}

/* =========================================
   CART DRAWER
========================================= */

function openCart() {
  $("#cart-drawer")?.classList.add("open");
  $("#overlay")?.classList.add("active");
  document.body.classList.add("no-scroll");
}

function closeCart() {
  $("#cart-drawer")?.classList.remove("open");
  $("#overlay")?.classList.remove("active");
  document.body.classList.remove("no-scroll");
}

function setupCartDrawer() {
  $("#cart-open")?.addEventListener("click", openCart);
  $("#mobile-cart-open")?.addEventListener("click", openCart);
  $("#cart-close")?.addEventListener("click", closeCart);
  $("#continue-shopping")?.addEventListener("click", closeCart);

  $("#overlay")?.addEventListener("click", () => {
    closeCart();
    closeMobileMenu();
  });
}

/* =========================================
   MOBILE MENU
========================================= */

function openMobileMenu() {
  $("#mobile-menu")?.classList.add("open");
  $("#overlay")?.classList.add("active");
  document.body.classList.add("no-scroll");
}

function closeMobileMenu() {
  $("#mobile-menu")?.classList.remove("open");

  if (!$("#cart-drawer")?.classList.contains("open")) {
    $("#overlay")?.classList.remove("active");
    document.body.classList.remove("no-scroll");
  }
}

function setupMobileMenu() {
  $("#mobile-menu-open")?.addEventListener("click", openMobileMenu);
  $("#mobile-menu-close")?.addEventListener("click", closeMobileMenu);

  $$("#mobile-menu a").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });
}

/* =========================================
   CHECKOUT DIALOG
========================================= */

function openCheckout() {
  if (!cart.length) {
    showMessage("Your cart is empty", "error");
    return;
  }

  const dialog = $("#order-dialog");

  if (!dialog) {
    showMessage("Checkout form not found", "error");
    return;
  }

  closeCart();

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }

  renderCheckoutSummary();
  updatePaymentDetails();
  previewRepeatDiscount();
}

function closeCheckout() {
  const dialog = $("#order-dialog");

  if (!dialog) return;

  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function setupCheckout() {
  $("#checkout-open")?.addEventListener("click", openCheckout);
  $("#order-close")?.addEventListener("click", closeCheckout);

  $("#order-dialog")?.addEventListener("click", (event) => {
    if (event.target === $("#order-dialog")) {
      closeCheckout();
    }
  });
}

/* =========================================
   PAYMENT SETTINGS
========================================= */

async function loadPaymentSettings() {
  try {
    const result = await callFunction("admin-settings", null, "GET");

    paymentSettings = result?.settings || {};
    updatePaymentDetails();

  } catch (error) {
    console.warn("Payment settings:", error.message);
  }
}

function getSelectedPayment() {
  return $('input[name="payment"]:checked')?.value ||
    $('input[name="payment_method"]:checked')?.value ||
    "";
}

function updatePaymentDetails() {
  const method = getSelectedPayment();
  const details = $("#payment-details");
  const info = $("#payment-info-text");

  if (!details || !info) return;

  let text = "";

  if (method === "bkash") {
    text = paymentSettings.bkash_number
      ? `bKash Number: ${paymentSettings.bkash_number}`
      : "bKash payment information will be provided by the store.";
  } else if (method === "nagad") {
    text = paymentSettings.nagad_number
      ? `Nagad Number: ${paymentSettings.nagad_number}`
      : "Nagad payment information will be provided by the store.";
  } else if (method === "bank") {
    text = paymentSettings.bank_details ||
      "Bank payment information will be provided by the store.";
  } else {
    text = paymentSettings.payment_instructions ||
      "Follow the instructions provided by the store.";
  }

  info.textContent = text;
  details.hidden = false;
}

function setupPaymentMethods() {
  $$('input[name="payment"], input[name="payment_method"]').forEach((input) => {
    input.addEventListener("change", updatePaymentDetails);
  });
}

/* =========================================
   CHECKOUT SUMMARY
========================================= */

function getDeliveryCharge() {
  const element = $('[name="delivery_charge"]');
  return Number(element?.value || 0);
}

function renderCheckoutSummary() {
  const subtotal = getCartSubtotal();

  const subtotalElement = $("#dialog-total");
  const discountElement = $("#dialog-discount");
  const repeatElement = $("#dialog-repeat-discount");
  const totalDiscountElement = $("#dialog-total-discount");
  const grandTotalElement = $("#dialog-grand-total");

  const totalDiscount = couponDiscount + repeatDiscount;
  const grandTotal = Math.max(
    0,
    subtotal - totalDiscount + getDeliveryCharge()
  );

  if (subtotalElement) {
    subtotalElement.textContent = money(subtotal);
  }

  if (discountElement) {
    discountElement.textContent = money(couponDiscount);
  }

  if (repeatElement) {
    repeatElement.textContent = money(repeatDiscount);
  }

  if (totalDiscountElement) {
    totalDiscountElement.textContent = money(totalDiscount);
  }

  if (grandTotalElement) {
    grandTotalElement.textContent = money(grandTotal);
  }
}

/* =========================================
   CUSTOMER DETAILS
========================================= */

function getCustomerDetails() {
  const getValue = (...selectors) => {
    for (const selector of selectors) {
      const element = $(selector);
      if (element) return element.value.trim();
    }
    return "";
  };

  return {
    name: getValue(
      "#customer-name",
      "#name",
      '[name="name"]',
      '[name="customer_name"]'
    ),

    phone: getValue(
      "#customer-phone",
      "#phone",
      '[name="phone"]',
      '[name="customer_phone"]'
    ),

    whatsapp: getValue(
      "#customer-whatsapp",
      "#whatsapp",
      '[name="whatsapp"]'
    ),

    address: getValue(
      "#customer-address",
      "#address",
      '[name="address"]',
      '[name="customer_address"]'
    ),

    district: getValue(
      "#customer-district",
      "#district",
      '[name="district"]'
    ),

    area: getValue(
      "#customer-area",
      "#area",
      '[name="area"]'
    )
  };
}

function validateCustomer(customer) {
  if (!customer.name) {
    return "Please enter your name.";
  }

  if (!customer.phone) {
    return "Please enter your phone number.";
  }

  const digits = customer.phone.replace(/\D/g, "");

  if (digits.length < 10) {
    return "Please enter a valid phone number.";
  }

  if (!customer.address) {
    return "Please enter your full address.";
  }

  return "";
}

/* =========================================
   REPEAT CUSTOMER DISCOUNT
========================================= */

async function previewRepeatDiscount() {
  const customer = getCustomerDetails();
  const subtotal = getCartSubtotal();

  if (!customer.phone || !customer.address || subtotal <= 0) {
    repeatDiscount = 0;
    repeatOrderCount = 0;
    repeatDiscountPercent = 0;
    renderCheckoutSummary();
    return;
  }

  try {
    const result = await postOrderAction({
      action: "preview_repeat_discount",
      customer,
      subtotal,
      coupon_discount: couponDiscount
    });

    if (result?.ok) {
      repeatDiscount = Number(
        result.repeat_discount ??
        result.discount ??
        0
      );

      repeatOrderCount = Number(
        result.total_orders ??
        result.repeat_order_count ??
        result.order_count ??
        0
      );

      repeatDiscountPercent = Number(
        result.discount_percent ??
        result.repeat_discount_percent ??
        0
      );

      const message = $("#repeat-discount-message");

      if (message) {
        message.textContent = repeatDiscount > 0
          ? `Congratulations! You received ${repeatDiscountPercent}% repeat customer discount.`
          : "Your repeat customer discount will be checked automatically.";
      }
    }
  } catch (error) {
    console.warn("Repeat discount preview:", error.message);
  }

  const count = $("#repeat-order-count");
  const percent = $("#repeat-discount-percent");

  if (count) count.textContent = repeatOrderCount;
  if (percent) percent.textContent = `${repeatDiscountPercent}%`;

  renderCheckoutSummary();
}

function setupRepeatDiscountPreview() {
  let timer;

  [
    "#customer-phone",
    "#phone",
    '[name="phone"]',
    "#customer-address",
    "#address",
    '[name="address"]'
  ].forEach((selector) => {
    $(selector)?.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(previewRepeatDiscount, 700);
    });
  });
}

/* =========================================
   COUPONS
========================================= */

async function applyCoupon() {
  const input = $("#coupon-code");
  const message = $("#coupon-message");

  const code = input?.value.trim().toUpperCase();

  if (!code) {
    if (message) message.textContent = "Enter a coupon code.";
    return;
  }

  if (getCartSubtotal() <= 0) {
    if (message) message.textContent = "Your cart is empty.";
    return;
  }

  const button = $("#apply-coupon");

  if (button) {
    button.disabled = true;
    button.textContent = "Checking...";
  }

  try {
    const result = await postOrderAction({
      action: "validate_coupon",
      coupon_code: code,
      subtotal: getCartSubtotal()
    });

    if (!result?.ok) {
      throw new Error(result?.message || "Invalid coupon code.");
    }

    couponDiscount = Number(
      result.discount ??
      result.coupon_discount ??
      0
    );

    currentCoupon = code;

    if (message) {
      message.textContent =
        `Coupon applied! You saved ${money(couponDiscount)}.`;
    }

    showMessage("Coupon applied successfully");

    await previewRepeatDiscount();
    renderCheckoutSummary();

  } catch (error) {
    currentCoupon = null;
    couponDiscount = 0;

    if (message) message.textContent = error.message;

    renderCheckoutSummary();

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Apply";
    }
  }
}

function setupCoupon() {
  $("#apply-coupon")?.addEventListener("click", applyCoupon);
}

/* =========================================
   PLACE ORDER
========================================= */

function setFormMessage(message, type = "error") {
  const element = $("#form-message");

  if (!element) return;

  element.textContent = message;
  element.style.color = type === "success"
    ? "#8dba9c"
    : "#e49b9b";
}

async function placeOrder(event) {
  event.preventDefault();

  if (isSubmittingOrder) return;

  const customer = getCustomerDetails();
  const validationError = validateCustomer(customer);

  if (validationError) {
    setFormMessage(validationError);
    return;
  }

  if (!cart.length) {
    setFormMessage("Your cart is empty.");
    return;
  }

  const paymentMethod = getSelectedPayment();

  if (!paymentMethod) {
    setFormMessage("Please select a payment method.");
    return;
  }

  const items = getCartDetails();

  for (const item of items) {
    if (item.quantity > Number(item.product.stock || 0)) {
      setFormMessage(
        `${item.product.name} does not have enough stock.`
      );
      return;
    }
  }

  const note =
    $("#order-note")?.value.trim() ||
    $("#customer-note")?.value.trim() ||
    "";

  const submitButton =
    $("#place-order-button") ||
    $("#order-form")?.querySelector('[type="submit"]');

  const originalText = submitButton?.textContent;

  isSubmittingOrder = true;

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Placing Order...";
  }

  setFormMessage("Please wait. Your order is being processed.", "success");

  const payload = {
    customer,
    payment_method: paymentMethod,
    items: items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity
    })),
    note,
    coupon_code: currentCoupon || ""
  };

  try {
    const result = await postOrderAction(payload);

    if (!result?.ok) {
      throw new Error(result?.message || "Order could not be placed.");
    }

    const orderNumber = result.order_number || "";

    cart = [];
    saveCart();

    currentCoupon = null;
    couponDiscount = 0;
    repeatDiscount = 0;

    renderCart();

    const form = $("#order-form");
    form?.reset();

    closeCheckout();

    const message = orderNumber
      ? `Your order has been placed successfully! Order number: ${orderNumber}`
      : "Your order has been placed successfully!";

    showMessage(message);

    if (orderNumber) {
      const trackingUrl =
        `track-order.html?order=${encodeURIComponent(orderNumber)}`;

      setTimeout(() => {
        const shouldTrack = confirm(
          `${message}\n\nWould you like to track your order now?`
        );

        if (shouldTrack) {
          window.location.href = trackingUrl;
        }
      }, 350);
    }

    await loadProducts();

  } catch (error) {
    console.error("Place order error:", error);
    setFormMessage(error.message || "Something went wrong.");
    showMessage(error.message || "Order failed", "error");

  } finally {
    isSubmittingOrder = false;

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText || "Place Order";
    }
  }
}

function setupOrderForm() {
  $("#order-form")?.addEventListener("submit", placeOrder);
}

/* =========================================
   MOBILE NAVIGATION
========================================= */

function setupMobileNavigation() {
  $$(".mobile-nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;

      if (target) {
        document.querySelector(target)?.scrollIntoView({
          behavior: "smooth"
        });
      }

      $$(".mobile-nav-item").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");
    });
  });
}

/* =========================================
   FOOTER YEAR
========================================= */

function setupFooter() {
  const year = $("#year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }
}

/* =========================================
   GENERAL NAVIGATION
========================================= */

function setupNavigation() {
  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = link.getAttribute("href");

      if (!target || target === "#") return;

      const element = document.querySelector(target);

      if (element) {
        event.preventDefault();

        element.scrollIntoView({
          behavior: "smooth"
        });
      }
    });
  });
}

/* =========================================
   INITIALIZATION
========================================= */

async function initializeStore() {
  loadCart();
  loadWishlist();

  renderCart();

  setupProductFilters();
  setupCartDrawer();
  setupMobileMenu();
  setupCheckout();
  setupPaymentMethods();
  setupCoupon();
  setupOrderForm();
  setupRepeatDiscountPreview();
  setupMobileNavigation();
  setupFooter();
  setupNavigation();

  await Promise.all([
    loadStoreSettings(),
    loadPaymentSettings(),
    loadProducts()
  ]);

  renderCart();
  renderWishlist();
}

document.addEventListener("DOMContentLoaded", initializeStore);
