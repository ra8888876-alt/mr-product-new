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

try {
  cart = JSON.parse(localStorage.getItem("mr_product_cart") || "[]");
  if (!Array.isArray(cart)) cart = [];
} catch {
  cart = [];
}

$("#year").textContent = new Date().getFullYear();

function saveCart() {
  localStorage.setItem("mr_product_cart", JSON.stringify(cart));
}

function getProductPrice(product) {
  const price = Number(product.price || 0);
  const discount = Number(product.discount_price || 0);

  return discount > 0 && discount < price ? discount : price;
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

    if (settings.description) {
      $("#store-description").textContent = settings.description;
    }

    if (settings.phone) $("#store-phone").textContent = settings.phone;
    if (settings.whatsapp) $("#store-whatsapp").textContent = settings.whatsapp;
    if (settings.email) $("#store-email").textContent = settings.email;

    if (settings.banner_url) {
      $("#hero-banner-image").src = settings.banner_url;
    }

    if (settings.primary_color) {
      document.documentElement.style.setProperty(
        "--accent",
        settings.primary_color
      );
    }

  } catch (error) {
    console.error("Store settings:", error);
  }
}

/* PRODUCT LOADING */

async function loadProducts() {
  const grid = $("#product-grid");

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    grid.innerHTML = '<p class="loading-products">Store database is not configured. Please check config.js.</p>';
    return;
  }

  grid.innerHTML = '<p class="loading-products">Discovering your favourites...</p>';

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
      product && product.id && Number.isFinite(Number(product.price))
    );

    renderProducts();

    // Refresh cart prices and stock using current database values.
    cart = cart.map(item => {
      const latest = products.find(product => product.id === item.id);
      if (!latest) return item;

      return {
        ...item,
        name: latest.name,
        price: getProductPrice(latest),
        stock: Number(latest.stock || 0),
        qty: Math.min(Number(item.qty || 1), Number(latest.stock || 0))
      };
    }).filter(item => item.qty > 0);

    saveCart();
    renderCart();

  } catch (error) {
    console.error(error);
    grid.innerHTML = '<p class="loading-products">Products could not be loaded. Please try again later.</p>';
  }
}

/* PRODUCT SEARCH + SORT */

function getVisibleProducts() {
  let list = [...products];

  const search = ($("#product-search")?.value || "").trim().toLowerCase();
  const sort = $("#product-sort")?.value || "newest";

  if (search) {
    list = list.filter(product =>
      `${product.name} ${product.description || ""} ${product.category || ""}`
        .toLowerCase()
        .includes(search)
    );
  }

  if (sort === "price-low") {
    list.sort((a, b) => getProductPrice(a) - getProductPrice(b));
  } else if (sort === "price-high") {
    list.sort((a, b) => getProductPrice(b) - getProductPrice(a));
  } else {
    list.sort((a, b) =>
      new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
  }

  return list;
}

function renderProducts() {
  const grid = $("#product-grid");
  const list = getVisibleProducts();

  if (!list.length) {
    grid.innerHTML = '<p class="loading-products">No products found.</p>';
    return;
  }

  grid.innerHTML = list.map(product => {
    const oldPrice = Number(product.price || 0);
    const currentPrice = getProductPrice(product);
    const stock = Number(product.stock || 0);

    const image = product.image_url
      ? `<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy">`
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

$("#product-search").addEventListener("input", renderProducts);
$("#product-sort").addEventListener("change", renderProducts);

/* CART */

function renderCart() {
  $("#cart-count").textContent =
    cart.reduce((total, item) => total + Number(item.qty || 0), 0);

  $("#cart-items").innerHTML = cart.length
    ? cart.map(item => `
        <div class="cart-line">
          <div>
            <b>${escapeHTML(item.name)}</b>
            <div class="muted small">
              ${money(item.price)} × ${item.qty}
            </div>
          </div>

          <div class="qty">
            <button type="button" data-dec="${escapeHTML(item.id)}">−</button>
            ${item.qty}
            <button type="button" data-inc="${escapeHTML(item.id)}">+</button>
          </div>
        </div>
      `).join("")
    : '<p class="muted">Your bag is empty.</p>';

  const total = cart.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.qty),
    0
  );

  $("#cart-total").textContent = money(total);
  $("#dialog-total").textContent = money(total);
  saveCart();
}

function openCart() {
  $("#overlay").hidden = false;
  $("#cart-drawer").classList.add("open");
  $("#cart-drawer").setAttribute("aria-hidden", "false");
}

function closeCart() {
  $("#overlay").hidden = true;
  $("#cart-drawer").classList.remove("open");
  $("#cart-drawer").setAttribute("aria-hidden", "true");
}

$("#product-grid").addEventListener("click", event => {
  const button = event.target.closest("[data-add]");
  const id = button?.dataset.add;

  if (!id) return;

  const product = products.find(item => item.id === id);
  if (!product) return;

  const item = cart.find(entry => entry.id === id);
  const stock = Number(product.stock || 0);

  if (item) {
    if (item.qty >= stock) {
      alert("Maximum available stock reached.");
      return;
    }
    item.qty++;
  } else {
    if (stock <= 0) {
      alert("This product is out of stock.");
      return;
    }

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

$("#cart-items").addEventListener("click", event => {
  const id = event.target.dataset.inc || event.target.dataset.dec;
  if (!id) return;

  const item = cart.find(entry => entry.id === id);
  if (!item) return;

  if (event.target.dataset.inc) {
    if (item.qty >= item.stock) {
      alert("Maximum available stock reached.");
      return;
    }
    item.qty++;
  } else {
    item.qty--;
  }

  if (item.qty <= 0) {
    cart = cart.filter(entry => entry.id !== id);
  }

  renderCart();
});

$("#cart-open").addEventListener("click", openCart);
$("#cart-close").addEventListener("click", closeCart);
$("#overlay").addEventListener("click", closeCart);

/* CHECKOUT */

$("#checkout-open").addEventListener("click", () => {
  if (!cart.length) {
    alert("Your bag is empty.");
    return;
  }

  closeCart();
  $("#form-message").textContent = "";
  $("#order-dialog").showModal();
});

$("#order-close").addEventListener("click", () => {
  $("#order-dialog").close();
});

$("#order-form").addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const message = $("#form-message");
  const submitButton = form.querySelector('button[type="submit"]');

  if (!cart.length) {
    message.textContent = "Your bag is empty.";
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    message.textContent = "Store checkout is not configured yet.";
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

  const paymentMethod = String(formData.get("payment") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (
    !customer.name ||
    !customer.phone ||
    !customer.district ||
    !customer.area ||
    !customer.address
  ) {
    message.textContent = "Please complete all required delivery details.";
    return;
  }

  if (!["bkash", "nagad", "bank"].includes(paymentMethod)) {
    message.textContent = "Please select a valid payment method.";
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
  message.textContent = "Please wait. Your order is being submitted...";

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
        result.error || "Your order could not be submitted. Please try again."
      );
    }

    const orderNumber = result.order_number || result.order_id || "Received";

    cart = [];
    renderCart();
    form.reset();

    message.textContent =
      `Order successful! Order number: ${orderNumber}.`;

  } catch (error) {
    console.error("Order submission failed:", error);
    message.textContent =
      error.message || "Something went wrong. Please try again.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText || "Place order";
  }
});

/* MOBILE MENU */

$("#mobile-menu-toggle").addEventListener("click", () => {
  $("#mobile-menu").classList.add("open");
});

$("#mobile-menu-close").addEventListener("click", () => {
  $("#mobile-menu").classList.remove("open");
});

$("#mobile-menu").querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    $("#mobile-menu").classList.remove("open");
  });
});

/* INITIALIZE */

renderCart();
loadStoreSettings();
loadProducts();
