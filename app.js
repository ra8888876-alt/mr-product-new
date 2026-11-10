const CONFIG = window.MR_PRODUCT_CONFIG || {};

const SUPABASE_URL = CONFIG.supabaseUrl || "";
const SUPABASE_KEY = CONFIG.publishableKey || "";

const $ = (selector) => document.querySelector(selector);

const money = (amount) =>
  "৳" + Number(amount || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 0,
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

let products = [];
let cart = [];
let paymentSettings = null;
let storeSettings = null;
let searchTerm = "";

let appliedCoupon = null;

let repeatDiscount = {
  previous_delivered_orders: 0,
  repeat_percent: 0,
  repeat_discount: 0
};

let repeatPreviewTimer = null;
let repeatPreviewRequest = 0;

// =====================================
// API HELPER
// =====================================

async function postOrderAction(payload) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/place-order`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error || "Request could not be completed."
    );
  }

  return result;
}

// =====================================
// WISHLIST
// =====================================

const WISHLIST_KEY = "mr_product_wishlist";

function loadWishlist() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(WISHLIST_KEY) || "[]"
    );

    return Array.isArray(saved)
      ? saved.map(String)
      : [];

  } catch {
    return [];
  }
}

let wishlist = loadWishlist();

function saveWishlist() {
  localStorage.setItem(
    WISHLIST_KEY,
    JSON.stringify(wishlist)
  );

  renderProducts();
  renderWishlist();
}

// =====================================
// YEAR
// =====================================

if ($("#year")) {
  $("#year").textContent = new Date().getFullYear();
}

// =====================================
// PRODUCT PRICE
// =====================================

function getProductPrice(product) {
  const price = Number(product.price || 0);
  const discount = Number(product.discount_price || 0);

  return discount > 0 && discount < price
    ? discount
    : price;
}

// =====================================
// CART SUBTOTAL
// =====================================

function getCartSubtotal() {
  return cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );
}

// =====================================
// DISCOUNT TOTALS
// =====================================

function getCouponDiscount() {
  return Math.min(
    getCartSubtotal(),
    Math.max(0, Number(appliedCoupon?.discount || 0))
  );
}

function getRepeatDiscount() {
  return Math.min(
    Math.max(0, getCartSubtotal() - getCouponDiscount()),
    Math.max(0, Number(repeatDiscount.repeat_discount || 0))
  );
}

function updateCouponTotals() {
  const subtotal = getCartSubtotal();
  const couponDiscount = getCouponDiscount();
  const repeat = getRepeatDiscount();

  const totalDiscount = Math.min(
    subtotal,
    couponDiscount + repeat
  );

  const total = Math.max(
    0,
    subtotal - totalDiscount
  );

  if ($("#dialog-total")) {
    $("#dialog-total").textContent = money(subtotal);
  }

  if ($("#dialog-discount")) {
    $("#dialog-discount").textContent =
      money(couponDiscount);
  }

  if ($("#dialog-repeat-discount")) {
    $("#dialog-repeat-discount").textContent =
      money(repeat);
  }

  if ($("#dialog-total-discount")) {
    $("#dialog-total-discount").textContent =
      money(totalDiscount);
  }

  if ($("#dialog-grand-total")) {
    $("#dialog-grand-total").textContent =
      money(total);
  }

  if ($("#repeat-order-count")) {
    $("#repeat-order-count").textContent =
      Number(
        repeatDiscount.previous_delivered_orders || 0
      );
  }

  if ($("#repeat-discount-percent")) {
    $("#repeat-discount-percent").textContent =
      Number(repeatDiscount.repeat_percent || 0);
  }
}

// =====================================
// RESET REPEAT DISCOUNT
// =====================================

function resetRepeatDiscount(message = "") {
  repeatPreviewRequest++;

  repeatDiscount = {
    previous_delivered_orders: 0,
    repeat_percent: 0,
    repeat_discount: 0
  };

  if ($("#repeat-discount-message")) {
    $("#repeat-discount-message").textContent =
      message ||
      "Enter your delivery details to check your reward.";
  }

  updateCouponTotals();
}

// =====================================
// GET CHECKOUT CUSTOMER
// =====================================

function getCheckoutCustomer() {
  const form = $("#order-form");

  if (!form) return null;

  const formData = new FormData(form);

  return {
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    whatsapp: String(formData.get("whatsapp") || "").trim(),
    district: String(formData.get("district") || "").trim(),
    area: String(formData.get("area") || "").trim(),
    address: String(formData.get("address") || "").trim()
  };
}

// =====================================
// REPEAT CUSTOMER DISCOUNT PREVIEW
// =====================================

async function previewRepeatDiscount() {
  if (!cart.length) {
    resetRepeatDiscount();
    return;
  }

  const customer = getCheckoutCustomer();

  if (
    !customer ||
    !customer.phone ||
    !customer.district ||
    !customer.area ||
    !customer.address
  ) {
    resetRepeatDiscount(
      "Complete your phone number and delivery address to check your reward."
    );

    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    resetRepeatDiscount(
      "Discount service is currently unavailable."
    );

    return;
  }

  const requestNumber = ++repeatPreviewRequest;

  if ($("#repeat-discount-message")) {
    $("#repeat-discount-message").textContent =
      "Checking your previous delivered orders...";
  }

  try {
    const result = await postOrderAction({
      action: "preview_repeat_discount",
      customer,
      subtotal: getCartSubtotal(),
      coupon_discount: getCouponDiscount()
    });

    if (requestNumber !== repeatPreviewRequest) {
      return;
    }

    if (result.ok !== true) {
      throw new Error(
        result.error || "Could not check repeat discount."
      );
    }

    repeatDiscount = {
      previous_delivered_orders: Number(
        result.previous_delivered_orders || 0
      ),
      repeat_percent: Number(
        result.repeat_percent || 0
      ),
      repeat_discount: Number(
        result.repeat_discount || 0
      )
    };

    if ($("#repeat-discount-message")) {
      if (repeatDiscount.repeat_percent > 0) {
        $("#repeat-discount-message").textContent =
          `Congratulations! You have ${repeatDiscount.repeat_percent}% repeat customer discount.`;
      } else {
        $("#repeat-discount-message").textContent =
          "Your next repeat customer reward is waiting. Keep shopping with MR PRODUCT!";
      }
    }

    updateCouponTotals();

  } catch (error) {
    console.error("Repeat discount preview error:", error);

    if (requestNumber !== repeatPreviewRequest) {
      return;
    }

    resetRepeatDiscount(
      "Unable to check your reward right now. Your order can still be submitted."
    );
  }
}

function scheduleRepeatPreview() {
  clearTimeout(repeatPreviewTimer);

  repeatPreviewTimer = setTimeout(() => {
    previewRepeatDiscount();
  }, 650);
}

// =====================================
// CLEAR COUPON
// =====================================

function clearAppliedCoupon(showMessage = false) {
  appliedCoupon = null;

  const input = $("#coupon-code");

  if (input) {
    input.value = "";
  }

  if ($("#coupon-message")) {
    $("#coupon-message").textContent = showMessage
      ? "Cart changed. Please apply your coupon again."
      : "";
  }

  updateCouponTotals();
  scheduleRepeatPreview();
}

// =====================================
// APPLY COUPON
// =====================================

async function applyCoupon() {
  const input = $("#coupon-code");
  const button = $("#apply-coupon");
  const message = $("#coupon-message");

  if (!input || !button || !message) return;

  const code = input.value.trim().toUpperCase();

  if (!code) {
    message.textContent = "Please enter a coupon code.";
    return;
  }

  if (!cart.length) {
    message.textContent = "Your cart is empty.";
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    message.textContent =
      "Store database is not configured.";
    return;
  }

  button.disabled = true;
  message.textContent = "Checking coupon...";

  try {
    const result = await postOrderAction({
      action: "validate_coupon",
      coupon_code: code,
      subtotal: getCartSubtotal()
    });

    if (result.ok !== true) {
      throw new Error(
        result.error || "Coupon could not be applied."
      );
    }

    appliedCoupon = {
      code: result.coupon_code,
      discount: Number(result.discount || 0)
    };

    message.textContent =
      `Coupon ${result.coupon_code} applied successfully! You saved ${money(result.discount)}.`;

    updateCouponTotals();
    scheduleRepeatPreview();

  } catch (error) {
    appliedCoupon = null;
    updateCouponTotals();

    message.textContent =
      error.message || "Invalid coupon code.";

  } finally {
    button.disabled = false;
  }
}

if ($("#apply-coupon")) {
  $("#apply-coupon").addEventListener(
    "click",
    applyCoupon
  );
}

if ($("#coupon-code")) {
  $("#coupon-code").addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyCoupon();
      }
    }
  );
}

// =====================================
// LOAD STORE SETTINGS
// =====================================

async function loadStoreSettings() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

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
      throw new Error(
        "Could not load store settings."
      );
    }

    const result = await response.json();

    storeSettings = result.settings || null;

    if (storeSettings) {
      applyStoreBranding(storeSettings);
    }

  } catch (error) {
    console.error("Store settings error:", error);
  }
}

// =====================================
// APPLY STORE BRANDING
// =====================================

function applyStoreBranding(settings) {
  if (settings.store_name) {
    const storeName = settings.store_name.trim();

    document.title = `${storeName} — Premium Store`;

    document.querySelectorAll(".brand b").forEach(
      (element) => {
        element.textContent = storeName;
      }
    );

    const footerText = document.querySelector(
      "footer > span"
    );

    if (footerText) {
      footerText.innerHTML =
        `©️ <span id="year">${new Date().getFullYear()}</span> ${escapeHTML(storeName)}`;
    }
  }

  if (settings.logo_url) {
    document.querySelectorAll(".brand-mark").forEach(
      (element) => {
        element.innerHTML = "";

        const image = document.createElement("img");

        image.src = settings.logo_url;
        image.alt = settings.store_name || "Store Logo";

        image.style.width = "100%";
        image.style.height = "100%";
        image.style.objectFit = "contain";
        image.style.display = "block";

        element.appendChild(image);
      }
    );
  }

  if (settings.primary_color) {
    const color = settings.primary_color.trim();

    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      document.documentElement.style.setProperty(
        "--gold",
        color
      );

      document.documentElement.style.setProperty(
        "--primary-color",
        color
      );

      const themeColor = $(
        'meta[name="theme-color"]'
      );

      if (themeColor) {
        themeColor.content = color;
      }
    }
  }

  if (settings.banner_url) {
    const saleBanner = $(".sale-banner");

    if (saleBanner) {
      saleBanner.style.backgroundImage = `
        linear-gradient(
          90deg,
          rgba(13,13,13,.94),
          rgba(13,13,13,.55)
        ),
        url("${settings.banner_url}")
      `;

      saleBanner.style.backgroundSize = "cover";
      saleBanner.style.backgroundPosition = "center";
      saleBanner.style.backgroundRepeat = "no-repeat";
    }

    const hero = $(".hero");

    if (hero) {
      hero.style.backgroundImage = `
        linear-gradient(
          90deg,
          rgba(13,13,13,.94),
          rgba(13,13,13,.48)
        ),
        url("${settings.banner_url}")
      `;

      hero.style.backgroundSize = "cover";
      hero.style.backgroundPosition = "center";
    }
  }

  if (settings.description) {
    const description = settings.description.trim();

    const saleDescription = $(
      ".sale-content p:not(.eyebrow)"
    );

    if (saleDescription) {
      saleDescription.textContent = description;
    }

    const heroDescription = $(
      ".hero-copy > p:not(.eyebrow)"
    );

    if (heroDescription) {
      heroDescription.textContent = description;
    }

    const aboutDescription = $(
      "#about > p:not(.eyebrow)"
    );

    if (aboutDescription) {
      aboutDescription.textContent = description;
    }
  }

  const contactSection = $("#contact");

  if (contactSection) {
    const contactParagraph =
      contactSection.querySelector("div + p");

    if (contactParagraph) {
      const contactItems = [];

      if (settings.phone) {
        contactItems.push({
          label: "Phone",
          value: settings.phone,
          href:
            "tel:" +
            settings.phone.replace(/[^\d+]/g, "")
        });
      }

      if (settings.whatsapp) {
        const number =
          settings.whatsapp.replace(/\D/g, "");

        contactItems.push({
          label: "WhatsApp",
          value: settings.whatsapp,
          href: "https://wa.me/" + number
        });
      }

      if (settings.email) {
        contactItems.push({
          label: "Email",
          value: settings.email,
          href: "mailto:" + settings.email
        });
      }

      if (contactItems.length) {
        contactParagraph.innerHTML =
          contactItems.map((item) => `
            <div style="margin:10px 0">
              <strong style="color:var(--gold)">
                ${escapeHTML(item.label)}:
              </strong>

              <a
                href="${escapeHTML(item.href)}"
                style="color:var(--cream);text-decoration:underline"
              >
                ${escapeHTML(item.value)}
              </a>
            </div>
          `).join("");
      }
    }
  }
}

// =====================================
// LOAD PRODUCTS
// =====================================

async function loadProducts() {
  const grid = $("#product-grid");

  if (!grid) return;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    grid.textContent =
      "Store database is not configured.";

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
      throw new Error(await response.text());
    }

    products = await response.json();

    renderProducts();
    renderWishlist();

  } catch (error) {
    console.error(
      "Product loading error:",
      error
    );

    grid.textContent =
      "Products could not be loaded. Please try again later.";
  }
}

// =====================================
// PRODUCT CARD
// =====================================

function createProductCard(product, isWishlist = false) {
  const oldPrice = Number(product.price || 0);
  const currentPrice = getProductPrice(product);

  const id = String(product.id);
  const saved = wishlist.includes(id);
  const stock = Number(product.stock || 0);

  const image = product.image_url
    ? `
      <div class="product-image">
        <img
          src="${escapeHTML(product.image_url)}"
          alt="${escapeHTML(product.name)}"
          loading="lazy"
        >
      </div>
    `
    : `
      <div class="product-image">
        MR
      </div>
    `;

  return `
    <article class="product-card">

      ${image}

      ${
        !isWishlist
          ? `
            <button
              class="wishlist-toggle ${saved ? "active" : ""}"
              data-wishlist-toggle="${escapeHTML(id)}"
              type="button"
              aria-label="${saved ? "Remove from wishlist" : "Add to wishlist"}"
              aria-pressed="${saved}"
            >
              ${saved ? "♥️" : "♡"}
            </button>
          `
          : ""
      }

      <h3>${escapeHTML(product.name)}</h3>

      <p class="muted small">
        ${escapeHTML(product.description || "")}
      </p>

      <div class="price">
        ${
          currentPrice < oldPrice
            ? `
              <del class="old-price">${money(oldPrice)}</del>
              <strong>${money(currentPrice)}</strong>
            `
            : money(currentPrice)
        }
      </div>

      ${
        isWishlist
          ? `
            <div class="wishlist-actions">

              <button
                class="button gold-button"
                data-add="${escapeHTML(id)}"
                type="button"
                ${stock <= 0 ? "disabled" : ""}
              >
                ${stock <= 0 ? "Out of stock" : "Add to cart"}
              </button>

              <button
                class="remove-wishlist"
                data-wishlist-remove="${escapeHTML(id)}"
                type="button"
              >
                Remove
              </button>

            </div>
          `
          : `
            <button
              class="button gold-button"
              data-add="${escapeHTML(id)}"
              type="button"
              ${stock <= 0 ? "disabled" : ""}
            >
              ${stock <= 0 ? "Out of stock" : "Add to cart"}
            </button>
          `
      }

    </article>
  `;
}

// =====================================
// SEARCH PRODUCTS
// =====================================

function renderProducts() {
  const grid = $("#product-grid");

  if (!grid) return;

  const filteredProducts = products.filter(
    (product) => {
      const searchText = [
        product.name,
        product.description,
        product.category
      ].join(" ").toLowerCase();

      return searchText.includes(
        searchTerm.toLowerCase()
      );
    }
  );

  if (!filteredProducts.length) {
    grid.innerHTML = `
      <div class="wishlist-empty">
        No products found.
        <p>Try another search.</p>
      </div>
    `;

    return;
  }

  grid.innerHTML = filteredProducts
    .map((product) => createProductCard(product))
    .join("");
}

const searchInput = $("#product-search");
const searchButton = $("#search-button");

if (searchInput) {
  searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value.trim();
    renderProducts();
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      searchTerm = searchInput.value.trim();
      renderProducts();

      $("#shop")?.scrollIntoView({
        behavior: "smooth"
      });
    }
  });
}

if (searchButton) {
  searchButton.addEventListener("click", () => {
    searchTerm = searchInput?.value.trim() || "";
    renderProducts();

    $("#shop")?.scrollIntoView({
      behavior: "smooth"
    });
  });
}

// =====================================
// WISHLIST DISPLAY
// =====================================

function renderWishlist() {
  const grid = $("#wishlist-grid");
  const count = $("#wishlist-count");

  if (!grid || !count) return;

  const savedProducts = products.filter(
    (product) =>
      wishlist.includes(String(product.id))
  );

  count.textContent =
    `${savedProducts.length} Saved`;

  if (!savedProducts.length) {
    grid.innerHTML = `
      <div class="wishlist-empty">
        <span>♡</span>
        Your wishlist is empty.
        <p>Explore products and save your favorites.</p>
      </div>
    `;

    return;
  }

  grid.innerHTML = savedProducts
    .map((product) =>
      createProductCard(product, true)
    )
    .join("");
}

// =====================================
// WISHLIST ACTIONS
// =====================================

function toggleWishlist(id) {
  id = String(id);

  if (wishlist.includes(id)) {
    wishlist = wishlist.filter(
      (item) => item !== id
    );
  } else {
    wishlist.push(id);
  }

  saveWishlist();
}

const productGrid = $("#product-grid");
const wishlistGrid = $("#wishlist-grid");

if (productGrid) {
  productGrid.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-wishlist-toggle]"
    );

    if (!button) return;

    toggleWishlist(
      button.dataset.wishlistToggle
    );
  });
}

if (wishlistGrid) {
  wishlistGrid.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-wishlist-remove]"
    );

    if (!button) return;

    toggleWishlist(
      button.dataset.wishlistRemove
    );
  });
}

// =====================================
// PAYMENT SETTINGS
// =====================================

async function loadPaymentSettings() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

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
      throw new Error(
        "Could not load payment information."
      );
    }

    const result = await response.json();

    paymentSettings = result.settings || null;

  } catch (error) {
    console.error(
      "Payment settings error:",
      error
    );

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
  const cartCount = $("#cart-count");
  const mobileCartCount = $("#mobile-cart-count");
  const cartItems = $("#cart-items");
  const cartTotal = $("#cart-total");

  const totalQuantity = cart.reduce(
    (total, item) => total + item.qty,
    0
  );

  if (cartCount) {
    cartCount.textContent = totalQuantity;
  }

  if (mobileCartCount) {
    mobileCartCount.textContent = totalQuantity;
  }

  if (cartItems) {
    cartItems.innerHTML = cart.length
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
  }

  const total = getCartSubtotal();

  if (cartTotal) {
    cartTotal.textContent = money(total);
  }

  updateCouponTotals();
}

// =====================================
// ADD TO CART
// =====================================

function addToCart(id) {
  const product = products.find(
    (item) => String(item.id) === String(id)
  );

  if (!product) return;

  const item = cart.find(
    (entry) => String(entry.id) === String(id)
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

  clearAppliedCoupon(true);
  renderCart();

  alert("Product added to cart!");
}

// =====================================
// PRODUCT CART BUTTONS
// =====================================

if (productGrid) {
  productGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");

    if (!button) return;

    addToCart(button.dataset.add);
  });
}

if (wishlistGrid) {
  wishlistGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");

    if (!button) return;

    addToCart(button.dataset.add);
  });
}

// =====================================
// CART QUANTITY
// =====================================

if ($("#cart-items")) {
  $("#cart-items").addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(
        "[data-inc], [data-dec]"
      );

      if (!button) return;

      const id =
        button.dataset.inc || button.dataset.dec;

      const item = cart.find(
        (entry) => String(entry.id) === String(id)
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
          (entry) => String(entry.id) !== String(id)
        );
      }

      clearAppliedCoupon(true);
      renderCart();
    }
  );
}

// =====================================
// CART OPEN / CLOSE
// =====================================

function openCart() {
  if (!$("#overlay") || !$("#cart-drawer")) {
    return;
  }

  $("#overlay").hidden = false;

  $("#cart-drawer").classList.add("open");

  $("#cart-drawer").setAttribute(
    "aria-hidden",
    "false"
  );
}

function closeCart() {
  if (!$("#overlay") || !$("#cart-drawer")) {
    return;
  }

  $("#overlay").hidden = true;

  $("#cart-drawer").classList.remove("open");

  $("#cart-drawer").setAttribute(
    "aria-hidden",
    "true"
  );
}

if ($("#cart-open")) {
  $("#cart-open").addEventListener(
    "click",
    openCart
  );
}

if ($("#mobile-cart-open")) {
  $("#mobile-cart-open").addEventListener(
    "click",
    openCart
  );
}

if ($("#cart-close")) {
  $("#cart-close").addEventListener(
    "click",
    closeCart
  );
}

if ($("#overlay")) {
  $("#overlay").addEventListener(
    "click",
    closeCart
  );
}

// =====================================
// CHECKOUT
// =====================================

if ($("#checkout-open")) {
  $("#checkout-open").addEventListener(
    "click",
    () => {
      if (!cart.length) {
        alert("Your cart is empty.");
        return;
      }

      closeCart();

      $("#order-dialog").showModal();

      renderCart();
      showPaymentDetails();
      scheduleRepeatPreview();
    }
  );
}

if ($("#order-close")) {
  $("#order-close").addEventListener(
    "click",
    () => {
      $("#order-dialog").close();
    }
  );
}

// =====================================
// CUSTOMER INPUT - REPEAT PREVIEW
// =====================================

if ($("#order-form")) {
  $("#order-form").addEventListener(
    "input",
    (event) => {
      const name = event.target.name;

      if (
        ["phone", "district", "area", "address"].includes(name)
      ) {
        scheduleRepeatPreview();
      }
    }
  );

  $("#order-form").addEventListener(
    "change",
    (event) => {
      const name = event.target.name;

      if (
        ["phone", "district", "area", "address"].includes(name)
      ) {
        scheduleRepeatPreview();
      }
    }
  );
}

// =====================================
// PAYMENT METHOD CHANGE
// =====================================

const paymentSelect = $('select[name="payment"]');

if (paymentSelect) {
  paymentSelect.addEventListener(
    "change",
    showPaymentDetails
  );
}

// =====================================
// PLACE ORDER
// =====================================

if ($("#order-form")) {
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
        name: String(
          formData.get("name") || ""
        ).trim(),

        phone: String(
          formData.get("phone") || ""
        ).trim(),

        whatsapp: String(
          formData.get("whatsapp") || ""
        ).trim(),

        district: String(
          formData.get("district") || ""
        ).trim(),

        area: String(
          formData.get("area") || ""
        ).trim(),

        address: String(
          formData.get("address") || ""
        ).trim()
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
        !["bkash", "nagad", "bank"].includes(
          paymentMethod
        )
      ) {
        message.textContent =
          "Please select a valid payment method.";

        return;
      }

      submitButton.disabled = true;

      message.textContent =
        "Submitting your order...";

      try {
        const result = await postOrderAction({
          customer,

          payment_method: paymentMethod,

          items: cart.map((item) => ({
            product_id: item.id,
            quantity: item.qty
          })),

          note,

          coupon_code: appliedCoupon
            ? appliedCoupon.code
            : null
        });

        if (result.ok !== true) {
          throw new Error(
            result.error || "Order could not be completed."
          );
        }

        const orderSubtotal = Number(
          result.subtotal ?? getCartSubtotal()
        );

        const couponAmount = Number(
          result.discount || 0
        );

        const repeatAmount = Number(
          result.repeat_discount || 0
        );

        const finalTotal = Number(
          result.total ??
          Math.max(
            0,
            orderSubtotal - couponAmount - repeatAmount
          )
        );

        cart = [];
        appliedCoupon = null;

        resetRepeatDiscount();

        renderCart();

        form.reset();

        if ($("#coupon-message")) {
          $("#coupon-message").textContent = "";
        }

        if ($("#coupon-code")) {
          $("#coupon-code").value = "";
        }

        showPaymentDetails();

        message.textContent =
          `Order successful! Order number: ${result.order_number}. Subtotal: ${money(orderSubtotal)}. Coupon Discount: ${money(couponAmount)}. Repeat Discount: ${money(repeatAmount)}. Final Total: ${money(finalTotal)}.`;

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
}

// =====================================
// START STORE
// =====================================

renderCart();

renderWishlist();

loadProducts();

loadPaymentSettings();

loadStoreSettings();
