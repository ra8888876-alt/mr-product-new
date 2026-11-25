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
// PRODUCT GALLERY STATE
// =====================================

const galleryIndexes = {};

function getProductImages(product) {
  let images = [];

  if (Array.isArray(product.image_urls)) {
    images = product.image_urls;
  } else if (typeof product.image_urls === "string") {
    try {
      const parsed = JSON.parse(product.image_urls);
      if (Array.isArray(parsed)) images = parsed;
    } catch {
      images = [];
    }
  }

  images = images
    .filter((url) => typeof url === "string")
    .map((url) => url.trim())
    .filter(Boolean);

  if (!images.length && product.image_url) {
    images.push(product.image_url);
  }

  if (product.image_url && !images.includes(product.image_url)) {
    images.unshift(product.image_url);
  }

  return [...new Set(images)].slice(0, 10);
}

function changeGallery(productId, direction) {
  const product = products.find(
    (item) => String(item.id) === String(productId)
  );

  if (!product) return;

  const images = getProductImages(product);
  if (images.length <= 1) return;

  const current = galleryIndexes[productId] || 0;

  galleryIndexes[productId] =
    (current + direction + images.length) % images.length;

  renderProducts();
  renderWishlist();
}

function goToGalleryImage(productId, index) {
  const product = products.find(
    (item) => String(item.id) === String(productId)
  );

  if (!product) return;

  const images = getProductImages(product);
  if (index < 0 || index >= images.length) return;

  galleryIndexes[productId] = index;

  renderProducts();
  renderWishlist();
}

// =====================================
// GALLERY CSS
// =====================================

function installGalleryStyles() {
  if ($("#mr-gallery-styles")) return;

  const style = document.createElement("style");
  style.id = "mr-gallery-styles";

  style.textContent = `
    .mr-product-gallery {
      position: relative;
      width: 100%;
      overflow: hidden;
      touch-action: pan-y;
      user-select: none;
      background: #f5f2ed;
      border-radius: inherit;
    }

    .mr-product-gallery img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }

    .mr-gallery-arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 50%;
      background: rgba(0,0,0,.65);
      color: #fff;
      font-size: 22px;
      cursor: pointer;
      z-index: 4;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mr-gallery-prev { left: 8px; }
    .mr-gallery-next { right: 8px; }

    .mr-gallery-dots {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 10px;
      display: flex;
      justify-content: center;
      gap: 6px;
      z-index: 4;
    }

    .mr-gallery-dot {
      width: 7px;
      height: 7px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: rgba(255,255,255,.6);
      cursor: pointer;
    }

    .mr-gallery-dot.active {
      width: 18px;
      border-radius: 10px;
      background: var(--gold, #c6a34b);
    }

    .mr-gallery-counter {
      position: absolute;
      right: 9px;
      top: 9px;
      z-index: 4;
      padding: 4px 8px;
      border-radius: 20px;
      background: rgba(0,0,0,.65);
      color: white;
      font-size: 11px;
    }

    .mr-product-gallery.single-image .mr-gallery-arrow,
    .mr-product-gallery.single-image .mr-gallery-dots,
    .mr-product-gallery.single-image .mr-gallery-counter {
      display: none;
    }
  `;

  document.head.appendChild(style);
}

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

    return Array.isArray(saved) ? saved.map(String) : [];
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

  const total = Math.max(0, subtotal - totalDiscount);

  if ($("#dialog-total")) {
    $("#dialog-total").textContent = money(subtotal);
  }

  if ($("#dialog-discount")) {
    $("#dialog-discount").textContent = money(couponDiscount);
  }

  if ($("#dialog-repeat-discount")) {
    $("#dialog-repeat-discount").textContent = money(repeat);
  }

  if ($("#dialog-total-discount")) {
    $("#dialog-total-discount").textContent = money(totalDiscount);
  }

  if ($("#dialog-grand-total")) {
    $("#dialog-grand-total").textContent = money(total);
  }

  if ($("#repeat-order-count")) {
    $("#repeat-order-count").textContent =
      Number(repeatDiscount.previous_delivered_orders || 0);
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
    resetRepeatDiscount("Discount service is currently unavailable.");
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

    if (requestNumber !== repeatPreviewRequest) return;

    if (result.ok !== true) {
      throw new Error(
        result.error || "Could not check repeat discount."
      );
    }

    repeatDiscount = {
      previous_delivered_orders: Number(
        result.previous_delivered_orders || 0
      ),
      repeat_percent: Number(result.repeat_percent || 0),
      repeat_discount: Number(result.repeat_discount || 0)
    };

    if ($("#repeat-discount-message")) {
      $("#repeat-discount-message").textContent =
        repeatDiscount.repeat_percent > 0
          ? `Congratulations! You have ${repeatDiscount.repeat_percent}% repeat customer discount.`
          : "Your next repeat customer reward is waiting. Keep shopping with MR PRODUCT!";
    }

    updateCouponTotals();

  } catch (error) {
    console.error("Repeat discount preview error:", error);

    if (requestNumber !== repeatPreviewRequest) return;

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

  if (input) input.value = "";

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
    message.textContent = "Store database is not configured.";
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

    message.textContent = error.message || "Invalid coupon code.";

  } finally {
    button.disabled = false;
  }
}

if ($("#apply-coupon")) {
  $("#apply-coupon").addEventListener("click", applyCoupon);
}

if ($("#coupon-code")) {
  $("#coupon-code").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyCoupon();
    }
  });
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
      throw new Error("Could not load store settings.");
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

    document.querySelectorAll(".brand b").forEach((element) => {
      element.textContent = storeName;
    });

    const footerText = document.querySelector("footer > span");

    if (footerText) {
      footerText.innerHTML =
        `©️ <span id="year">${new Date().getFullYear()}</span> ${escapeHTML(storeName)}`;
    }
  }

  if (settings.logo_url) {
    document.querySelectorAll(".brand-mark").forEach((element) => {
      element.innerHTML = "";

      const image = document.createElement("img");
      image.src = settings.logo_url;
      image.alt = settings.store_name || "Store Logo";

      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "contain";
      image.style.display = "block";

      element.appendChild(image);
    });
  }

  if (settings.primary_color) {
    const color = settings.primary_color.trim();

    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      document.documentElement.style.setProperty("--gold", color);
      document.documentElement.style.setProperty("--primary-color", color);

      const themeColor = $('meta[name="theme-color"]');

      if (themeColor) themeColor.content = color;
    }
  }

  if (settings.banner_url) {
    const saleBanner = $(".sale-banner");

    if (saleBanner) {
      saleBanner.style.backgroundImage = `
        linear-gradient(90deg, rgba(13,13,13,.94), rgba(13,13,13,.55)),
        url("${settings.banner_url}")
      `;

      saleBanner.style.backgroundSize = "cover";
      saleBanner.style.backgroundPosition = "center";
      saleBanner.style.backgroundRepeat = "no-repeat";
    }

    const hero = $(".hero");

    if (hero) {
      hero.style.backgroundImage = `
        linear-gradient(90deg, rgba(13,13,13,.94), rgba(13,13,13,.48)),
        url("${settings.banner_url}")
      `;

      hero.style.backgroundSize = "cover";
      hero.style.backgroundPosition = "center";
    }
  }

  if (settings.description) {
    const description = settings.description.trim();

    const saleDescription = $(".sale-content p:not(.eyebrow)");
    if (saleDescription) saleDescription.textContent = description;

    const heroDescription = $(".hero-copy > p:not(.eyebrow)");
    if (heroDescription) heroDescription.textContent = description;

    const aboutDescription = $("#about > p:not(.eyebrow)");
    if (aboutDescription) aboutDescription.textContent = description;
  }

  const contactSection = $("#contact");

  if (contactSection) {
    const contactParagraph = contactSection.querySelector("div + p");

    if (contactParagraph) {
      const contactItems = [];

      if (settings.phone) {
        contactItems.push({
          label: "Phone",
          value: settings.phone,
          href: "tel:" + settings.phone.replace(/[^\d+]/g, "")
        });
      }

      if (settings.whatsapp) {
        const number = settings.whatsapp.replace(/\D/g, "");

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
        contactParagraph.innerHTML = contactItems.map((item) => `
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
    grid.textContent = "Store database is not configured.";
    return;
  }

  grid.textContent = "Loading products...";

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,description,price,discount_price,image_url,image_urls,category,stock,active&active=eq.true&order=created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!response.ok) throw new Error(await response.text());

    products = await response.json();

    products.forEach((product) => {
      const images = getProductImages(product);

      if (
        galleryIndexes[product.id] === undefined ||
        galleryIndexes[product.id] >= images.length
      ) {
        galleryIndexes[product.id] = 0;
      }
    });

    renderProducts();
    renderWishlist();

  } catch (error) {
    console.error("Product loading error:", error);

    grid.textContent =
      "Products could not be loaded. Please try again later.";
  }
}

// =====================================
// PRODUCT GALLERY HTML
// =====================================

function createProductGallery(product) {
  const images = getProductImages(product);

  if (!images.length) {
    return `<div class="product-image">MR</div>`;
  }

  const id = String(product.id);

  const index = Math.min(
    galleryIndexes[id] || 0,
    images.length - 1
  );

  const currentImage = images[index];

  return `
    <div
      class="product-image mr-product-gallery ${images.length === 1 ? "single-image" : ""}"
      data-gallery="${escapeHTML(id)}"
    >
      <img
        src="${escapeHTML(currentImage)}"
        alt="${escapeHTML(product.name)}"
        loading="lazy"
        draggable="false"
      >

      ${
        images.length > 1
          ? `
            <button
              type="button"
              class="mr-gallery-arrow mr-gallery-prev"
              data-gallery-prev="${escapeHTML(id)}"
              aria-label="Previous image"
            >‹</button>

            <button
              type="button"
              class="mr-gallery-arrow mr-gallery-next"
              data-gallery-next="${escapeHTML(id)}"
              aria-label="Next image"
            >›</button>

            <span class="mr-gallery-counter">
              ${index + 1}/${images.length}
            </span>

            <div class="mr-gallery-dots">
              ${images.map((image, dotIndex) => `
                <button
                  type="button"
                  class="mr-gallery-dot ${dotIndex === index ? "active" : ""}"
                  data-gallery-dot="${escapeHTML(id)}"
                  data-gallery-index="${dotIndex}"
                  aria-label="Show image ${dotIndex + 1}"
                ></button>
              `).join("")}
            </div>
          `
          : ""
      }
    </div>
  `;
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

  const image = createProductGallery(product);

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
              >Remove</button>
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
// GALLERY BUTTON EVENTS
// =====================================

function handleGalleryClick(event) {
  const previous = event.target.closest("[data-gallery-prev]");
  const next = event.target.closest("[data-gallery-next]");
  const dot = event.target.closest("[data-gallery-dot]");

  if (previous) {
    event.preventDefault();
    event.stopPropagation();
    changeGallery(previous.dataset.galleryPrev, -1);
    return true;
  }

  if (next) {
    event.preventDefault();
    event.stopPropagation();
    changeGallery(next.dataset.galleryNext, 1);
    return true;
  }

  if (dot) {
    event.preventDefault();
    event.stopPropagation();

    goToGalleryImage(
      dot.dataset.galleryDot,
      Number(dot.dataset.galleryIndex)
    );

    return true;
  }

  return false;
}

// =====================================
// GALLERY SWIPE
// =====================================

const galleryTouchPositions = new WeakMap();

function installGallerySwipe(container) {
  if (!container || container.dataset.swipeReady) return;

  container.dataset.swipeReady = "true";

  container.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;

    galleryTouchPositions.set(container, event.clientX);
  });

  container.addEventListener("pointerup", (event) => {
    const startX = galleryTouchPositions.get(container);
    if (startX === undefined) return;

    galleryTouchPositions.delete(container);

    const difference = event.clientX - startX;
    if (Math.abs(difference) < 35) return;

    const id = container.dataset.gallery;

    changeGallery(id, difference < 0 ? 1 : -1);
  });

  container.addEventListener("pointercancel", () => {
    galleryTouchPositions.delete(container);
  });
}

function setupGallerySwipe() {
  document.querySelectorAll(".mr-product-gallery").forEach(
    installGallerySwipe
  );
}

// =====================================
// SEARCH PRODUCTS
// =====================================

function renderProducts() {
  const grid = $("#product-grid");
  if (!grid) return;

  const filteredProducts = products.filter((product) => {
    const searchText = [
      product.name,
      product.description,
      product.category
    ].join(" ").toLowerCase();

    return searchText.includes(searchTerm.toLowerCase());
  });

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

  setupGallerySwipe();
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

      $("#shop")?.scrollIntoView({ behavior: "smooth" });
    }
  });
}

if (searchButton) {
  searchButton.addEventListener("click", () => {
    searchTerm = searchInput?.value.trim() || "";
    renderProducts();

    $("#shop")?.scrollIntoView({ behavior: "smooth" });
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
    (product) => wishlist.includes(String(product.id))
  );

  count.textContent = `${savedProducts.length} Saved`;

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
    .map((product) => createProductCard(product, true))
    .join("");

  setupGallerySwipe();
}

// =====================================
// WISHLIST ACTIONS
// =====================================

function toggleWishlist(id) {
  id = String(id);

  if (wishlist.includes(id)) {
    wishlist = wishlist.filter((item) => item !== id);
  } else {
    wishlist.push(id);
  }

  saveWishlist();
}

const productGrid = $("#product-grid");
const wishlistGrid = $("#wishlist-grid");

if (productGrid) {
  productGrid.addEventListener("click", (event) => {
    if (handleGalleryClick(event)) return;

    const button = event.target.closest("[data-wishlist-toggle]");
    if (!button) return;

    toggleWishlist(button.dataset.wishlistToggle);
  });
}

if (wishlistGrid) {
  wishlistGrid.addEventListener("click", (event) => {
    if (handleGalleryClick(event)) return;

    const button = event.target.closest("[data-wishlist-remove]");
    if (!button) return;

    toggleWishlist(button.dataset.wishlistRemove);
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
// SSL COMMERZ PAYMENT INFORMATION
// =====================================

function showPaymentDetails() {
  const detailsBox = $("#payment-details");
  const infoText = $("#payment-info-text");
  const paymentSelect = $('select[name="payment"]');

  if (!detailsBox || !infoText || !paymentSelect) return;

  const method = paymentSelect.value;

  if (!method) {
    detailsBox.hidden = true;
    infoText.textContent = "";
    return;
  }

  const methodNames = {
    bkash: "bKash",
    nagad: "Nagad",
    bank: "Bank Transfer"
  };

  if (!methodNames[method]) {
    detailsBox.hidden = true;
    infoText.textContent = "";
    return;
  }

  detailsBox.hidden = false;

  infoText.textContent =
    `${methodNames[method]} selected. You will be redirected to the secure payment gateway to complete your payment. Your order will be created only after successful payment verification.`;
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

  if (cartCount) cartCount.textContent = totalQuantity;
  if (mobileCartCount) mobileCartCount.textContent = totalQuantity;

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

  if (cartTotal) {
    cartTotal.textContent = money(getCartSubtotal());
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
  $("#cart-items").addEventListener("click", (event) => {
    const button = event.target.closest("[data-inc], [data-dec]");
    if (!button) return;

    const id = button.dataset.inc || button.dataset.dec;

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
  });
}

// =====================================
// CART OPEN / CLOSE
// =====================================

function openCart() {
  if (!$("#overlay") || !$("#cart-drawer")) return;

  $("#overlay").hidden = false;
  $("#cart-drawer").classList.add("open");

  $("#cart-drawer").setAttribute("aria-hidden", "false");
}

function closeCart() {
  if (!$("#overlay") || !$("#cart-drawer")) return;

  $("#overlay").hidden = true;
  $("#cart-drawer").classList.remove("open");

  $("#cart-drawer").setAttribute("aria-hidden", "true");
}

if ($("#cart-open")) {
  $("#cart-open").addEventListener("click", openCart);
}

if ($("#mobile-cart-open")) {
  $("#mobile-cart-open").addEventListener("click", openCart);
}

if ($("#cart-close")) {
  $("#cart-close").addEventListener("click", closeCart);
}

if ($("#overlay")) {
  $("#overlay").addEventListener("click", closeCart);
}

// =====================================
// CHECKOUT
// =====================================

if ($("#checkout-open")) {
  $("#checkout-open").addEventListener("click", () => {
    if (!cart.length) {
      alert("Your cart is empty.");
      return;
    }

    closeCart();

    $("#order-dialog").showModal();

    renderCart();
    showPaymentDetails();
    scheduleRepeatPreview();
  });
}

if ($("#order-close")) {
  $("#order-close").addEventListener("click", () => {
    $("#order-dialog").close();
  });
}

// =====================================
// CUSTOMER INPUT - REPEAT PREVIEW
// =====================================

if ($("#order-form")) {
  $("#order-form").addEventListener("input", (event) => {
    const name = event.target.name;

    if (["phone", "district", "area", "address"].includes(name)) {
      scheduleRepeatPreview();
    }
  });

  $("#order-form").addEventListener("change", (event) => {
    const name = event.target.name;

    if (["phone", "district", "area", "address"].includes(name)) {
      scheduleRepeatPreview();
    }
  });
}

// =====================================
// PAYMENT METHOD CHANGE
// =====================================

const paymentSelect = $('select[name="payment"]');

if (paymentSelect) {
  paymentSelect.addEventListener("change", showPaymentDetails);
}

// =====================================
// START SECURE PAYMENT
// =====================================

async function startSecurePayment(payload) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/create-payment`,
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

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Invalid response from payment server.");
  }

  if (!response.ok || result.ok !== true || !result.payment_url) {
    throw new Error(
      result.error || "Payment could not be started."
    );
  }

  return result;
}

// =====================================
// SSL COMMERZ CHECKOUT
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

      if (!message || !submitButton) return;

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

      if (!["bkash", "nagad", "bank"].includes(paymentMethod)) {
        message.textContent =
          "Please select a valid payment method.";
        return;
      }

      const payload = {
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
      };

      submitButton.disabled = true;
      submitButton.textContent = "Connecting to payment...";

      message.textContent =
        "Preparing your secure payment. Please wait...";

      try {
        const result = await startSecurePayment(payload);

        message.textContent =
          "Payment session ready. Redirecting...";

        window.location.assign(result.payment_url);

      } catch (error) {
        console.error("SSLCommerz checkout error:", error);

        message.textContent =
          error.message ||
          "Payment could not be started. Please try again.";

        submitButton.disabled = false;
        submitButton.textContent = "Pay Now";
      }
    }
  );
}

// =====================================
// START STORE
// =====================================

installGalleryStyles();

renderCart();
renderWishlist();

loadProducts();
loadPaymentSettings();
loadStoreSettings();

// =====================================
// MR PRODUCT - PRODUCT DETAILS SYSTEM
// =====================================

(function () {
  if (document.getElementById("mr-product-details-system")) return;

  const detailStyle = document.createElement("style");
  detailStyle.id = "mr-product-details-system";

  detailStyle.textContent = `
    .mr-details-overlay {
      position: fixed;
      inset: 0;
      z-index: 99990;
      background: rgba(0,0,0,.82);
      display: none;
      overflow-y: auto;
      padding: 25px 15px;
      backdrop-filter: blur(5px);
    }

    .mr-details-overlay.active {
      display: block;
    }

    .mr-details-container {
      position: relative;
      max-width: 1100px;
      margin: 20px auto;
      padding: 25px;
      background: #171717;
      color: #f5f0e6;
      border: 1px solid #b89545;
      border-radius: 16px;
    }

    .mr-details-close {
      position: absolute;
      right: 15px;
      top: 12px;
      width: 40px;
      height: 40px;
      border: 1px solid #c6a34b;
      border-radius: 50%;
      background: #222;
      color: #fff;
      font-size: 25px;
      cursor: pointer;
      z-index: 5;
    }

    .mr-details-back {
      display: inline-block;
      margin-bottom: 22px;
      padding: 10px 16px;
      background: transparent;
      border: 1px solid #c6a34b;
      color: #c6a34b;
      border-radius: 8px;
      cursor: pointer;
    }

    .mr-details-main {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 35px;
      align-items: start;
    }

    .mr-details-image-box {
      width: 100%;
      background: #242424;
      border-radius: 13px;
      overflow: hidden;
      position: relative;
    }

    .mr-details-main-image {
      width: 100%;
      height: 450px;
      object-fit: contain;
      display: block;
      background: #f5f2ed;
    }

    .mr-details-thumbnails {
      display: flex;
      gap: 10px;
      padding: 12px;
      overflow-x: auto;
    }

    .mr-details-thumb {
      width: 70px;
      height: 70px;
      flex-shrink: 0;
      border: 2px solid transparent;
      border-radius: 7px;
      overflow: hidden;
      cursor: pointer;
      background: #333;
    }

    .mr-details-thumb.active {
      border-color: #c6a34b;
    }

    .mr-details-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .mr-details-info {
      padding: 15px 0;
    }

    .mr-details-info h2 {
      color: #f5f0e6;
      font-size: 30px;
      line-height: 1.3;
      margin: 15px 0;
    }

    .mr-details-category {
      color: #c6a34b;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .mr-details-price {
      margin: 20px 0;
      font-size: 27px;
      color: #c6a34b;
      font-weight: bold;
    }

    .mr-details-old-price {
      color: #999;
      font-size: 17px;
      text-decoration: line-through;
      margin-right: 10px;
    }

    .mr-details-stock {
      display: inline-block;
      padding: 7px 12px;
      background: rgba(198,163,75,.12);
      border: 1px solid #c6a34b;
      border-radius: 6px;
      color: #c6a34b;
      margin-bottom: 20px;
      font-size: 13px;
    }

    .mr-details-description {
      color: #c5c0b7;
      line-height: 1.8;
      white-space: pre-line;
      margin: 15px 0 25px;
    }

    .mr-details-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .mr-details-actions button {
      padding: 13px 22px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      font-size: 14px;
    }

    .mr-details-add {
      background: #c6a34b;
      color: #111;
      border: 1px solid #c6a34b;
      flex: 1;
    }

    .mr-details-wishlist {
      background: transparent;
      color: #c6a34b;
      border: 1px solid #c6a34b;
    }

    .mr-related-section {
      margin-top: 45px;
      padding-top: 25px;
      border-top: 1px solid #39342a;
    }

    .mr-related-section h3 {
      color: #c6a34b;
      font-size: 22px;
      margin-bottom: 20px;
    }

    .mr-related-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0,1fr));
      gap: 15px;
    }

    .mr-related-card {
      background: #222;
      border: 1px solid #39342a;
      border-radius: 10px;
      overflow: hidden;
      cursor: pointer;
      transition: .2s;
    }

    .mr-related-card:hover {
      border-color: #c6a34b;
      transform: translateY(-3px);
    }

    .mr-related-card img {
      width: 100%;
      height: 150px;
      object-fit: cover;
      background: #f5f2ed;
    }

    .mr-related-card h4 {
      color: #f5f0e6;
      padding: 10px 10px 3px;
      font-size: 14px;
    }

    .mr-related-card p {
      color: #c6a34b;
      padding: 0 10px 12px;
      font-weight: bold;
    }

    @media(max-width:700px) {
      .mr-details-overlay {
        padding: 8px;
      }

      .mr-details-container {
        margin: 5px auto;
        padding: 15px;
      }

      .mr-details-main {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .mr-details-main-image {
        height: 320px;
      }

      .mr-details-info h2 {
        font-size: 23px;
      }

      .mr-related-grid {
        grid-template-columns: repeat(2,minmax(0,1fr));
      }

      .mr-related-card img {
        height: 130px;
      }
    }
  `;

  document.head.appendChild(detailStyle);

  const overlay = document.createElement("div");
  overlay.className = "mr-details-overlay";
  overlay.id = "mr-details-overlay";

  overlay.innerHTML = `
    <div class="mr-details-container">
      <button class="mr-details-close" id="mr-details-close">×</button>

      <button class="mr-details-back" id="mr-details-back">
        ← Back to Shop
      </button>

      <div id="mr-details-content"></div>

      <section class="mr-related-section">
        <h3>You May Also Like</h3>
        <div class="mr-related-grid" id="mr-related-grid"></div>
      </section>
    </div>
  `;

  document.body.appendChild(overlay);

  let currentDetailProduct = null;
  let currentDetailImage = 0;

  function openDetails(productId) {
    const product = products.find(
      (item) => String(item.id) === String(productId)
    );

    if (!product) return;

    currentDetailProduct = product;
    currentDetailImage = 0;

    renderDetails();

    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeDetails() {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
    currentDetailProduct = null;
  }

  function renderDetails() {
    const product = currentDetailProduct;
    if (!product) return;

    const images = getProductImages(product);
    const image = images[currentDetailImage] || "";

    const oldPrice = Number(product.price || 0);
    const currentPrice = getProductPrice(product);
    const stock = Number(product.stock || 0);
    const saved = wishlist.includes(String(product.id));

    const content = document.getElementById(
      "mr-details-content"
    );

    content.innerHTML = `
      <div class="mr-details-main">
        <div class="mr-details-image-box">
          ${
            image
              ? `<img class="mr-details-main-image"
                   src="${escapeHTML(image)}"
                   alt="${escapeHTML(product.name)}">`
              : `<div class="mr-details-main-image"></div>`
          }

          <div class="mr-details-thumbnails">
            ${images.map((url, index) => `
              <button
                class="mr-details-thumb ${index === currentDetailImage ? "active" : ""}"
                data-detail-image="${index}"
                type="button"
              >
                <img src="${escapeHTML(url)}" alt="">
              </button>
            `).join("")}
          </div>
        </div>

        <div class="mr-details-info">
          <span class="mr-details-category">
            ${escapeHTML(product.category || "MR PRODUCT")}
          </span>

          <h2>${escapeHTML(product.name)}</h2>

          <div class="mr-details-price">
            ${
              currentPrice < oldPrice
                ? `<span class="mr-details-old-price">${money(oldPrice)}</span>`
                : ""
            }
            ${money(currentPrice)}
          </div>

          <span class="mr-details-stock">
            ${stock > 0 ? `In Stock: ${stock}` : "Out of Stock"}
          </span>

          <h3>Product Description</h3>

          <p class="mr-details-description">
            ${escapeHTML(product.description || "No description available.")}
          </p>

          <div class="mr-details-actions">
            <button
              class="mr-details-add"
              id="mr-details-add"
              type="button"
              ${stock <= 0 ? "disabled" : ""}
            >
              ${stock > 0 ? "Add to Cart" : "Out of Stock"}
            </button>

            <button
              class="mr-details-wishlist"
              id="mr-details-wishlist"
              type="button"
            >
              ${saved ? "♥️ Saved" : "♡ Wishlist"}
            </button>
          </div>
        </div>
      </div>
    `;

    renderRelatedProducts(product);
  }

  function renderRelatedProducts(product) {
    const grid = document.getElementById("mr-related-grid");

    const others = products
      .filter((item) => String(item.id) !== String(product.id))
      .sort((a, b) => {
        const aSame = a.category === product.category ? 1 : 0;
        const bSame = b.category === product.category ? 1 : 0;
        return bSame - aSame;
      })
      .slice(0, 8);

    if (!others.length) {
      grid.innerHTML = `
        <p class="muted">More products coming soon.</p>
      `;
      return;
    }

    grid.innerHTML = others.map((item) => {
      const images = getProductImages(item);
      const image = images[0] || "";
      const price = getProductPrice(item);

      return `
        <article
          class="mr-related-card"
          data-related-product="${escapeHTML(item.id)}"
        >
          ${
            image
              ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(item.name)}" loading="lazy">`
              : ""
          }
          <h4>${escapeHTML(item.name)}</h4>
          <p>${money(price)}</p>
        </article>
      `;
    }).join("");
  }

  ["product-grid", "wishlist-grid"].forEach((id) => {
    const grid = document.getElementById(id);
    if (!grid) return;

    grid.addEventListener("click", (event) => {
      if (
        event.target.closest("button") ||
        event.target.closest("a") ||
        event.target.closest("input")
      ) return;

      const card = event.target.closest(".product-card");
      if (!card) return;

      const addButton = card.querySelector("[data-add]");

      const wishlistButton = card.querySelector(
        "[data-wishlist-toggle], [data-wishlist-remove]"
      );

      const productId =
        addButton?.dataset.add ||
        wishlistButton?.dataset.wishlistToggle ||
        wishlistButton?.dataset.wishlistRemove;

      if (productId) openDetails(productId);
    });
  });

  overlay.addEventListener("click", (event) => {
    const thumbnail = event.target.closest("[data-detail-image]");

    if (thumbnail) {
      currentDetailImage = Number(thumbnail.dataset.detailImage);
      renderDetails();
      return;
    }

    const related = event.target.closest("[data-related-product]");

    if (related) {
      openDetails(related.dataset.relatedProduct);
    }
  });

  overlay.addEventListener("click", (event) => {
    if (event.target.id === "mr-details-add") {
      if (!currentDetailProduct) return;
      addToCart(currentDetailProduct.id);
    }

    if (event.target.id === "mr-details-wishlist") {
      if (!currentDetailProduct) return;

      toggleWishlist(currentDetailProduct.id);
      renderDetails();
    }
  });

  document.getElementById("mr-details-close")
    .addEventListener("click", closeDetails);

  document.getElementById("mr-details-back")
    .addEventListener("click", closeDetails);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeDetails();
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      overlay.classList.contains("active")
    ) {
      closeDetails();
    }
  });

  window.openMRProductDetails = openDetails;
  window.closeMRProductDetails = closeDetails;

})();
