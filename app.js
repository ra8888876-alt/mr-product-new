/* =====================================
   MR PRODUCT - STORE APPLICATION
===================================== */

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

function safeImageURL(value) {
  try {
    const url = new URL(String(value || ""), window.location.href);
    return ["http:", "https:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

let products = [];
let cart = [];

try {
  cart = JSON.parse(localStorage.getItem("mr_product_cart") || "[]");

  if (!Array.isArray(cart)) cart = [];

  cart = cart.filter(item =>
    item &&
    item.id !== undefined &&
    Number(item.qty) > 0
  );

} catch {
  cart = [];
}

const yearElement = $("#year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

/* CART STORAGE */

function saveCart() {
  localStorage.setItem("mr_product_cart", JSON.stringify(cart));
}

function getProductPrice(product) {
  const price = Number(product.price || 0);
  const discount = Number(product.discount_price || 0);

  return discount > 0 && discount < price
    ? discount
    : price;
}

function getCartTotal() {
  return cart.reduce(
    (sum, item) =>
      sum + Number(item.price || 0) * Number(item.qty || 0),
    0
  );
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
    const settings = result.settings || result.data || result;

    if (settings.store_name) {
      document.querySelectorAll("#store-name").forEach(el => {
        el.textContent = settings.store_name;
      });
    }

    if (settings.description && $("#store-description")) {
      $("#store-description").textContent = settings.description;
    }

    if (settings.phone && $("#store-phone")) {
      $("#store-phone").textContent = settings.phone;
    }

    if (settings.whatsapp && $("#store-whatsapp")) {
      $("#store-whatsapp").textContent = settings.whatsapp;
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
    grid.innerHTML =
      '<p class="loading-products">Store database is not configured. Please check config.js.</p>';
    return;
  }

  grid.innerHTML =
    '<p class="loading-products">Discovering your favourites...</p>';

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

    products = products.filter(product =>
      product &&
      product.id !== undefined &&
      Number.isFinite(Number(product.price))
    );

    renderProducts();

    // Refresh cart using current product information.

    cart = cart.map(item => {
      const latest = products.find(
        product => String(product.id) === String(item.id)
      );

      if (!latest) return null;

      const stock = Math.max(0, Number(latest.stock || 0));

      return {
        id: latest.id,
        name: latest.name,
        price: getProductPrice(latest),
        stock,
        qty: Math.min(
          Math.max(1, Number(item.qty || 1)),
          stock
        )
      };

    }).filter(item => item && item.qty > 0);

    renderCart();

  } catch (error) {
    console.error("Product loading error:", error);

    grid.innerHTML =
      '<p class="loading-products">Products could not be loaded. Please try again later.</p>';
  }
}

/* PRODUCT SEARCH AND SORT */

function getVisibleProducts() {
  let list = [...products];

  const search = ($("#product-search")?.value || "")
    .trim()
    .toLowerCase();

  const sort = $("#product-sort")?.value || "newest";

  if (search) {
    list = list.filter(product =>
      `${product.name} ${product.description || ""} ${product.category || ""}`
        .toLowerCase()
        .includes(search)
    );
  }

  if (sort === "price-low") {
    list.sort(
      (a, b) => getProductPrice(a) - getProductPrice(b)
    );

  } else if (sort === "price-high") {
    list.sort(
      (a, b) => getProductPrice(b) - getProductPrice(a)
    );

  } else {
    list.sort(
      (a, b) =>
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
    grid.innerHTML =
      '<p class="loading-products">No products found.</p>';
    return;
  }

  grid.innerHTML = list.map(product => {
    const oldPrice = Number(product.price || 0);
    const currentPrice = getProductPrice(product);
    const stock = Math.max(0, Number(product.stock || 0));

    const imageURL = safeImageURL(product.image_url);

    const image = imageURL
      ? `<img src="${escapeHTML(imageURL)}" alt="${escapeHTML(product.name)}" loading="lazy">`
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

          ${
            currentPrice < oldPrice
              ? `<del>${money(oldPrice)}</del>`
              : ""
          }
        </div>

        <p class="muted small">
          ${stock > 0 ? `In stock: ${stock}` : "Out of stock"}
        </p>

        <button
          class="button button-dark"
          data-add="${escapeHTML(product.id)}"
          type="button"
          ${stock <= 0 ? "disabled" : ""}
        >
          ${stock <= 0 ? "Out of stock" : "Add to bag"}
        </button>

      </article>
    `;
  }).join("");
}

$("#product-search")?.addEventListener("input", renderProducts);

$("#product-sort")?.addEventListener("change", renderProducts);

/* CART DISPLAY */

function renderCart() {
  const count = cart.reduce(
    (total, item) => total + Number(item.qty || 0),
    0
  );

  // Update both header and drawer counters.
  document.querySelectorAll("#cart-count").forEach(el => {
    el.textContent = count;
  });

  const cartItems = $("#cart-items");

  if (cartItems) {
    cartItems.innerHTML = cart.length
      ? cart.map(item => `
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
                aria-label="Decrease quantity"
              >−</button>

              ${item.qty}

              <button
                type="button"
                data-inc="${escapeHTML(item.id)}"
                aria-label="Increase quantity"
              >+</button>

            </div>

          </div>
        `).join("")
      : '<p class="muted">Your bag is empty.</p>';
  }

  const total = getCartTotal();

  if ($("#cart-total")) {
    $("#cart-total").textContent = money(total);
  }

  if ($("#dialog-total")) {
    $("#dialog-total").textContent = money(total);
  }

  saveCart();
}

/* CART OPEN AND CLOSE */

function openCart() {
  if ($("#overlay")) {
    $("#overlay").hidden = false;
  }

  $("#cart-drawer")?.classList.add("open");

  $("#cart-drawer")?.setAttribute("aria-hidden", "false");
}

function closeCart() {
  if ($("#overlay")) {
    $("#overlay").hidden = true;
  }

  $("#cart-drawer")?.classList.remove("open");

  $("#cart-drawer")?.setAttribute("aria-hidden", "true");
}

$("#cart-open")?.addEventListener("click", openCart);

$("#cart-close")?.addEventListener("click", closeCart);

$("#overlay")?.addEventListener("click", closeCart);

/* ADD TO CART */

$("#product-grid")?.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");

  if (!button) return;

  const id = button.dataset.add;

  const product = products.find(
    item => String(item.id) === String(id)
  );

  if (!product) return;

  const stock = Math.max(0, Number(product.stock || 0));

  if (stock <= 0) {
    alert("This product is out of stock.");
    return;
  }

  const item = cart.find(
    entry => String(entry.id) === String(id)
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

  button.textContent = "Added to bag";

  setTimeout(() => {
    if (button.isConnected) {
      button.textContent = "Add to bag";
    }
  }, 1000);
});

/* CART QUANTITY CONTROL */

$("#cart-items")?.addEventListener("click", event => {
  const id =
    event.target.dataset.inc ||
    event.target.dataset.dec;

  if (!id) return;

  const item = cart.find(
    entry => String(entry.id) === String(id)
  );

  if (!item) return;

  if (event.target.dataset.inc) {
    if (item.qty >= item.stock) {
      alert("Maximum available stock reached.");
      return;
    }

    item.qty++;

  } else {
    item.qty--;

    if (item.qty <= 0) {
      cart = cart.filter(
        entry => String(entry.id) !== String(id)
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

  if ($("#form-message")) {
    $("#form-message").textContent = "";
  }

  $("#order-dialog")?.showModal();
});

/* CHECKOUT CLOSE */

$("#order-close")?.addEventListener("click", () => {
  $("#order-dialog")?.close();
});

/* ORDER SUBMISSION */

$("#order-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const message = $("#form-message");
  const submitButton = form.querySelector(
    'button[type="submit"]'
  );

  if (!cart.length) {
    message.textContent = "Your bag is empty.";
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    message.textContent =
      "Store checkout is not configured yet.";
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
  ).trim();

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
      "Please complete all required delivery details.";
    return;
  }

  if (!["bkash", "nagad", "bank"].includes(paymentMethod)) {
    message.textContent =
      "Please select a valid payment method.";
    return;
  }

  const orderPayload = {
    customer,

    payment_method: paymentMethod,

    items: cart.map(item => ({
      product_id: item.id,
      quantity: item.qty
    })),

    note
  };

  const originalButtonText = submitButton.textContent;

  submitButton.disabled = true;
  submitButton.textContent = "Submitting order...";

  message.textContent =
    "Please wait. Your order is being submitted...";

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

    message.textContent =
      `Order successful! Order number: ${orderNumber}.`;

  } catch (error) {
    console.error("Order submission failed:", error);

    message.textContent =
      error.message ||
      "Something went wrong. Please try again.";

  } finally {
    submitButton.disabled = false;

    submitButton.textContent =
      originalButtonText || "Place order";
  }
});

/* MOBILE MENU */

$("#mobile-menu-toggle")?.addEventListener("click", () => {
  $("#mobile-menu")?.classList.add("open");
});

$("#mobile-menu-close")?.addEventListener("click", () => {
  $("#mobile-menu")?.classList.remove("open");
});

$("#mobile-menu")?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    $("#mobile-menu")?.classList.remove("open");
  });
});

/* INITIALIZE */

renderCart();

loadStoreSettings();

loadProducts();
