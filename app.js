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

$("#year").textContent = new Date().getFullYear();

function getProductPrice(product) {
  const price = Number(product.price || 0);
  const discount = Number(product.discount_price || 0);

  return discount > 0 && discount < price
    ? discount
    : price;
}

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
          ${Number(product.stock) <= 0 ? "Out of stock" : "Add to cart"}
        </button>
      </article>
    `;
  }).join("");
}

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
            <button type="button" data-dec="${escapeHTML(item.id)}">−</button>
            ${item.qty}
            <button type="button" data-inc="${escapeHTML(item.id)}">+</button>
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
  $("#cart-drawer").setAttribute("aria-hidden", "false");
}

function closeCart() {
  $("#overlay").hidden = true;
  $("#cart-drawer").classList.remove("open");
  $("#cart-drawer").setAttribute("aria-hidden", "true");
}

$("#product-grid").addEventListener("click", (event) => {
  const id = event.target.dataset.add;
  if (!id) return;

  const product = products.find((item) => item.id === id);
  if (!product) return;

  const item = cart.find((entry) => entry.id === id);

  if (item) {
    if (item.qty >= Number(product.stock)) {
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
      stock: Number(product.stock)
    });
  }

  renderCart();
});

$("#cart-items").addEventListener("click", (event) => {
  const id = event.target.dataset.inc || event.target.dataset.dec;
  if (!id) return;

  const item = cart.find((entry) => entry.id === id);
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
    cart = cart.filter((entry) => entry.id !== id);
  }

  renderCart();
});

$("#cart-open").addEventListener("click", openCart);
$("#cart-close").addEventListener("click", closeCart);
$("#overlay").addEventListener("click", closeCart);

$("#checkout-open").addEventListener("click", () => {
  if (!cart.length) {
    alert("Your cart is empty.");
    return;
  }

  closeCart();
  $("#order-dialog").showModal();
});

$("#order-close").addEventListener("click", () => {
  $("#order-dialog").close();
});

// Real order submission remains disabled until
// server-side discount calculation and payment verification
// are completed and tested.

$("#order-form").addEventListener("submit", (event) => {
  event.preventDefault();

  $("#form-message").textContent =
    "Order submission is not enabled yet. This is a preview only. Please do not make a payment.";
});

renderCart();
loadProducts();
