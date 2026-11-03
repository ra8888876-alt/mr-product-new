const SUPABASE_URL = window.MR_PRODUCT_CONFIG?.supabaseUrl || '';
const SUPABASE_PUBLISHABLE_KEY = window.MR_PRODUCT_CONFIG?.publishableKey || '';

const money = n => '৳' + Number(n).toLocaleString('en-BD');

const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));

let products = [];
let cart = [];

const $ = s => document.querySelector(s);

$('#year').textContent = new Date().getFullYear();

function currentPrice(product) {
  const discounted = Number(product.discount_price);
  const regular = Number(product.price);

  return Number.isFinite(discounted) &&
    discounted > 0 &&
    discounted < regular
    ? discounted
    : regular;
}

function renderProducts() {
  const grid = $('#product-grid');

  if (!products.length) {
    grid.innerHTML =
      '<p class="muted">No products are available right now.</p>';
    return;
  }

  grid.innerHTML = products.map(p => {
    const price = currentPrice(p);
    const hasDiscount = price < Number(p.price);
    const stock = Number(p.stock ?? 0);

    return `
      <article class="product-card">
        <div class="product-image">
          ${p.image_url
            ? `<img src="${escapeHtml(p.image_url)}"
                alt="${escapeHtml(p.name)}" loading="lazy">`
            : 'MR'}
        </div>

        <h3>${escapeHtml(p.name)}</h3>

        <p class="muted small">
          ${escapeHtml(p.description || '')}
        </p>

        <div class="price">
          ${money(price)}
          ${hasDiscount
            ? `<del class="old-price">${money(p.price)}</del>
               <span class="discount-label">SALE</span>`
            : ''}
        </div>

        <p class="muted small">
          ${stock > 0 ? `In stock: ${stock}` : 'Out of stock'}
        </p>

        <button class="button gold-button"
          data-add="${escapeHtml(p.id)}"
          ${stock < 1 ? 'disabled' : ''}>
          ${stock > 0 ? 'Add to cart' : 'Out of stock'}
        </button>
      </article>
    `;
  }).join('');
}

function renderCart() {
  $('#cart-count').textContent =
    cart.reduce((n, x) => n + x.qty, 0);

  $('#cart-items').innerHTML = cart.length
    ? cart.map(x => `
        <div class="cart-line">
          <div>
            <b>${escapeHtml(x.name)}</b>
            <div class="muted small">
              ${money(x.price)} × ${x.qty}
            </div>
          </div>

          <div class="qty">
            <button data-dec="${escapeHtml(x.id)}">−</button>
            ${x.qty}
            <button data-inc="${escapeHtml(x.id)}">+</button>
          </div>
        </div>
      `).join('')
    : '<p class="muted">Your cart is empty.</p>';

  const total = cart.reduce(
    (n, x) => n + x.price * x.qty, 0
  );

  $('#cart-total').textContent = money(total);
  $('#dialog-total').textContent = money(total);
}

async function loadProducts() {
  const grid = $('#product-grid');

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    grid.innerHTML =
      '<p class="muted">Store database is not connected.</p>';
    return;
  }

  grid.innerHTML = '<p class="muted">Loading products…</p>';

  try {
    const url =
      `${SUPABASE_URL}/rest/v1/products?select=id,name,description,price,discount_price,image_url,category,stock,active&active=eq.true&order=created_at.desc`;

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error('Product loading failed.');
    }

    const rows = await response.json();

    products = rows.filter(p =>
      p && p.id &&
      Number(p.price) >= 0 &&
      Number.isFinite(Number(p.price))
    );

    renderProducts();

  } catch (error) {
    console.error(error);
    grid.innerHTML =
      '<p class="muted">Products could not be loaded.</p>';
  }
}

function openCart() {
  $('#overlay').hidden = false;
  $('#cart-drawer').classList.add('open');
  $('#cart-drawer').setAttribute('aria-hidden', 'false');
}

function closeCart() {
  $('#overlay').hidden = true;
  $('#cart-drawer').classList.remove('open');
  $('#cart-drawer').setAttribute('aria-hidden', 'true');
}

$('#product-grid').addEventListener('click', e => {
  const id = e.target.dataset.add;
  if (!id) return;

  const p = products.find(x => x.id === id);
  if (!p) return;

  const item = cart.find(x => x.id === id);
  const alreadyInCart = item?.qty || 0;

  if (alreadyInCart >= Number(p.stock || 0)) {
    alert('Available stock limit reached.');
    return;
  }

  if (item) {
    item.qty++;
  } else {
    cart.push({
      id: p.id,
      name: p.name,
      price: currentPrice(p),
      qty: 1,
      stock: Number(p.stock || 0)
    });
  }

  renderCart();
});

$('#cart-items').addEventListener('click', e => {
  const id = e.target.dataset.inc || e.target.dataset.dec;
  if (!id) return;

  const item = cart.find(x => x.id === id);
  if (!item) return;

  if (e.target.dataset.inc) {
    if (item.qty >= item.stock) {
      alert('Available stock limit reached.');
      return;
    }
    item.qty++;
  } else {
    item.qty--;
  }

  if (item.qty <= 0) {
    cart = cart.filter(x => x.id !== id);
  }

  renderCart();
});

$('#cart-open').onclick = openCart;
$('#cart-close').onclick = closeCart;
$('#overlay').onclick = closeCart;

$('#checkout-open').onclick = () => {
  if (!cart.length) {
    alert('Your cart is empty.');
    return;
  }

  closeCart();
  $('#order-dialog').showModal();
};

$('#order-close').onclick = () => {
  $('#order-dialog').close();
};

$('#order-form').addEventListener('submit', async e => {
  e.preventDefault();

  const msg = $('#form-message');

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    msg.textContent = 'Database is not connected.';
    return;
  }

  msg.textContent = 'Submitting your order…';

  const f = new FormData(e.currentTarget);

  const payload = {
    customer: {
      name: f.get('name'),
      phone: f.get('phone'),
      whatsapp: f.get('whatsapp'),
      district: f.get('district'),
      area: f.get('area'),
      address: f.get('address')
    },

    items: cart.map(x => ({
      product_id: x.id,
      quantity: x.qty
    })),

    payment_method: f.get('payment'),
    note: f.get('note')
  };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/place-order`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Order could not be submitted.');
    }

    msg.textContent =
      `Order received. Your order number is ${data.order_number}.`;

    cart = [];
    renderCart();
    e.currentTarget.reset();

    await loadProducts();

  } catch (err) {
    msg.textContent = err.message;
  }
});

renderCart();
loadProducts();
