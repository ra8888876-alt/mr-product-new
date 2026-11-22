(() => {
  "use strict";

  const CONFIG = window.MR_PRODUCT_CONFIG || {};
  const SUPABASE_URL = (CONFIG.supabaseUrl || "").replace(/\/$/, "");
  const SUPABASE_KEY = CONFIG.publishableKey || "";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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

  const placeholderImage =
    "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=700";

  const state = {
    products: [],
    cart: readStorage("mr_product_cart", []),
    wishlist: readStorage("mr_product_wishlist", []),
    settings: {},
    activeCategory: "all",
    search: "",
    sort: "featured",
    selectedPayment: "bkash",
    coupon: null,
    repeatDiscount: 0,
    customer: null,
    busy: false
  };

  function readStorage(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveStorage() {
    localStorage.setItem("mr_product_cart", JSON.stringify(state.cart));
    localStorage.setItem("mr_product_wishlist", JSON.stringify(state.wishlist));
  }

  function headers(extra = {}) {
    return {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...extra
    };
  }

  async function rest(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Supabase configuration পাওয়া যায়নি।");
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: headers(options.headers || {})
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || data.error || "Request failed");
    }

    return data;
  }

  async function edgeFunction(name, payload, method = "POST") {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/${name}`,
      {
        method,
        headers: headers(),
        ...(method === "GET" ? {} : { body: JSON.stringify(payload || {}) })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.ok === false) {
      throw new Error(data.message || data.error || "Request failed");
    }

    return data;
  }

  function notify(message, type = "success") {
    let toast = $("#toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element && value !== undefined && value !== null) {
      element.textContent = value;
    }
  }

  function setImage(selector, url) {
    const element = $(selector);
    if (element && url) {
      element.src = url;
    }
  }

  function applySettings(settings) {
    state.settings = settings || {};

    const name = state.settings.store_name || "MR PRODUCT";

    setText("#store-name", name);
    setText("#footer-store-name", name);
    setText("#store-description", state.settings.description || "");

    if (state.settings.logo_url) {
      const logo = $(".brand img");
      if (logo) logo.src = state.settings.logo_url;
    }

    if (state.settings.banner_url) {
      setImage("#hero-banner-image", state.settings.banner_url);
    }

    if (state.settings.primary_color) {
      document.documentElement.style.setProperty(
        "--accent",
        state.settings.primary_color
      );
    }

    const phone = state.settings.phone || "";
    const whatsapp = state.settings.whatsapp || "";
    const email = state.settings.email || "";

    setText("#contact-phone", phone);
    setText("#contact-whatsapp", whatsapp);
    setText("#contact-email", email);

    const phoneLink = $("#contact-phone-link");
    if (phoneLink && phone) phoneLink.href = `tel:${phone}`;

    const whatsappLink = $("#contact-whatsapp-link");
    if (whatsappLink && whatsapp) {
      whatsappLink.href = `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
    }

    const emailLink = $("#contact-email-link");
    if (emailLink && email) emailLink.href = `mailto:${email}`;

    setText("#footer-phone", phone);
    setText("#footer-email", email);
    setText("#footer-whatsapp", whatsapp);
  }

  async function loadSettings() {
    try {
      const result = await edgeFunction("admin-settings", {}, "GET");
      applySettings(result.settings || {});
    } catch (error) {
      console.warn("Store settings:", error.message);
    }
  }

  async function loadProducts() {
    try {
      const products = await rest(
        "products?select=id,name,description,price,discount_price,image_url,category,stock,active,created_at&active=eq.true&order=created_at.desc"
      );

      state.products = Array.isArray(products) ? products : [];
      renderProducts();
      renderCategories();
      renderWishlist();
    } catch (error) {
      console.error(error);
      const grid = $("#product-grid");
      if (grid) {
        grid.innerHTML = `
          <div class="empty-state">
            <h3>Products load হচ্ছে না</h3>
            <p>${escapeHTML(error.message)}</p>
          </div>`;
      }
    }
  }

  function productPrice(product) {
    return Number(product.discount_price || product.price || 0);
  }

  function productOldPrice(product) {
    return Number(product.price || 0);
  }

  function productDiscount(product) {
    const oldPrice = productOldPrice(product);
    const newPrice = productPrice(product);

    if (oldPrice > newPrice && oldPrice > 0) {
      return Math.round(((oldPrice - newPrice) / oldPrice) * 100);
    }

    return 0;
  }

  function isWishlisted(id) {
    return state.wishlist.some((item) => String(item) === String(id));
  }

  function productCard(product) {
    const price = productPrice(product);
    const oldPrice = productOldPrice(product);
    const discount = productDiscount(product);
    const stock = Number(product.stock || 0);
    const outOfStock = stock <= 0;
    const wished = isWishlisted(product.id);

    return `
      <article class="product-card" data-product-id="${escapeHTML(product.id)}">
        <div class="product-image product-image-wrap">
          <img
            src="${escapeHTML(product.image_url || placeholderImage)}"
            alt="${escapeHTML(product.name)}"
            loading="lazy"
            onerror="this.src='${placeholderImage}'"
          >

          <div class="product-badges">
            ${discount ? `<span class="discount-badge">${discount}% OFF</span>` : ""}
            ${outOfStock ? `<span class="stock-badge">Out of stock</span>` : ""}
          </div>

          <button
            class="wishlist-button ${wished ? "active" : ""}"
            type="button"
            data-wishlist="${escapeHTML(product.id)}"
            aria-label="Add to wishlist"
          >${wished ? "♥" : "♡"}</button>
        </div>

        <div class="product-info">
          <div class="product-category">${escapeHTML(product.category || "Beauty")}</div>
          <h3 class="product-name">${escapeHTML(product.name)}</h3>

          <div class="product-price-row">
            <span class="product-price">${money(price)}</span>
            ${oldPrice > price ? `<span class="product-old-price">${money(oldPrice)}</span>` : ""}
          </div>

          <div class="product-actions">
            <button
              class="add-to-cart"
              type="button"
              data-add-cart="${escapeHTML(product.id)}"
              ${outOfStock ? "disabled" : ""}
            >${outOfStock ? "Out of stock" : "Add to bag"}</button>
          </div>
        </div>
      </article>`;
  }

  function filteredProducts() {
    let products = [...state.products];

    if (state.activeCategory !== "all") {
      products = products.filter((product) =>
        String(product.category || "").toLowerCase() ===
        state.activeCategory.toLowerCase()
      );
    }

    if (state.search) {
      const query = state.search.toLowerCase();

      products = products.filter((product) =>
        [
          product.name,
          product.category,
          product.description
        ].some((value) => String(value || "").toLowerCase().includes(query))
      );
    }

    if (state.sort === "price-low") {
      products.sort((a, b) => productPrice(a) - productPrice(b));
    } else if (state.sort === "price-high") {
      products.sort((a, b) => productPrice(b) - productPrice(a));
    } else if (state.sort === "name") {
      products.sort((a, b) => a.name.localeCompare(b.name));
    }

    return products;
  }

  function renderProducts() {
    const grid = $("#product-grid");
    if (!grid) return;

    const products = filteredProducts();

    setText("#product-results-count", `${products.length} products`);

    if (!products.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No products found</h3>
          <p>অন্য কিছু search করে দেখুন।</p>
        </div>`;
      return;
    }

    grid.innerHTML = products.map(productCard).join("");
  }

  function renderCategories() {
    const container = $("#categories");
    if (!container) return;

    const categories = [
      ...new Set(
        state.products
          .map((product) => String(product.category || "").trim())
          .filter(Boolean)
      )
    ];

    const categoryImages = [
      "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=700",
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=700",
      "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?w=700",
      "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=700"
    ];

    container.innerHTML = categories.slice(0, 4).map((category, index) => `
      <button class="category-card" type="button"
        data-category="${escapeHTML(category)}">
        <img src="${categoryImages[index % categoryImages.length]}" alt="${escapeHTML(category)}">
        <h3>${escapeHTML(category)}</h3>
      </button>
    `).join("");
  }

  function renderWishlist() {
    const grid = $("#wishlist-grid");
    if (!grid) return;

    const products = state.products.filter((product) =>
      isWishlisted(product.id)
    );

    setText("#wishlist-count", `${products.length} saved`);

    if (!products.length) {
      grid.innerHTML = `
        <div class="wishlist-empty">
          <h3>Your wishlist is empty</h3>
          <p>পছন্দের product wishlist-এ যোগ করুন।</p>
        </div>`;
      return;
    }

    grid.innerHTML = products.map(productCard).join("");
  }

  function addToCart(id) {
    const product = state.products.find(
      (item) => String(item.id) === String(id)
    );

    if (!product) return;

    const stock = Number(product.stock || 0);

    if (stock <= 0) {
      notify("এই product এখন stock-এ নেই।", "error");
      return;
    }

    const existing = state.cart.find(
      (item) => String(item.id) === String(id)
    );

    if (existing) {
      if (existing.quantity >= stock) {
        notify("Available stock-এর বেশি নেওয়া যাবে না।", "error");
        return;
      }

      existing.quantity += 1;
    } else {
      state.cart.push({
        id: product.id,
        name: product.name,
        price: productPrice(product),
        image_url: product.image_url,
        stock,
        quantity: 1
      });
    }

    saveStorage();
    renderCart();
    notify("Product cart-এ যোগ হয়েছে।");
  }

  function changeQuantity(id, amount) {
    const item = state.cart.find(
      (product) => String(product.id) === String(id)
    );

    if (!item) return;

    const next = item.quantity + amount;

    if (next <= 0) {
      state.cart = state.cart.filter(
        (product) => String(product.id) !== String(id)
      );
    } else if (next <= Number(item.stock || 0)) {
      item.quantity = next;
    } else {
      notify("Available stock-এর বেশি নেওয়া যাবে না।", "error");
    }

    saveStorage();
    renderCart();
  }

  function removeCartItem(id) {
    state.cart = state.cart.filter(
      (item) => String(item.id) !== String(id)
    );

    saveStorage();
    renderCart();
  }

  function cartSubtotal() {
    return state.cart.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );
  }

  function renderCart() {
    const container = $("#cart-items");
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);

    setText("#cart-count", count);
    setText("#mobile-cart-count", count);
    setText("#cart-count-heading", count);
    setText("#cart-total", money(cartSubtotal()));

    if (!container) return;

    if (!state.cart.length) {
      container.innerHTML = `
        <div class="cart-empty">
          <p>আপনার shopping bag এখন খালি।</p>
        </div>`;
      return;
    }

    container.innerHTML = state.cart.map((item) => `
      <div class="cart-item">
        <img src="${escapeHTML(item.image_url || placeholderImage)}"
          alt="${escapeHTML(item.name)}">

        <div>
          <h4>${escapeHTML(item.name)}</h4>
          <p>${money(item.price)}</p>

          <div class="cart-item-quantity">
            <button type="button" data-quantity="-1" data-id="${escapeHTML(item.id)}">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-quantity="1" data-id="${escapeHTML(item.id)}">+</button>
          </div>
        </div>

        <button class="cart-item-remove" type="button"
          data-remove-cart="${escapeHTML(item.id)}">Remove</button>
      </div>
    `).join("");
  }

  function toggleWishlist(id) {
    if (isWishlisted(id)) {
      state.wishlist = state.wishlist.filter(
        (item) => String(item) !== String(id)
      );
      notify("Wishlist থেকে সরানো হয়েছে।");
    } else {
      state.wishlist.push(id);
      notify("Wishlist-এ যোগ হয়েছে।");
    }

    saveStorage();
    renderProducts();
    renderWishlist();
  }

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

  function openCheckout() {
    if (!state.cart.length) {
      notify("আগে cart-এ product যোগ করুন।", "error");
      return;
    }

    closeCart();

    const dialog = $("#order-dialog");

    if (dialog && typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog?.setAttribute("open", "");
    }

    updateCheckoutSummary();
    previewRepeatDiscount();
  }

  function closeCheckout() {
    const dialog = $("#order-dialog");

    if (dialog?.open) {
      dialog.close();
    } else {
      dialog?.removeAttribute("open");
    }
  }

  function checkoutDiscount() {
    return Number(state.coupon?.discount_amount || 0);
  }

  function updateCheckoutSummary() {
    const subtotal = cartSubtotal();
    const couponDiscount = checkoutDiscount();
    const repeatDiscount = Number(state.repeatDiscount || 0);
    const totalDiscount = Math.min(subtotal, couponDiscount + repeatDiscount);
    const grandTotal = Math.max(0, subtotal - totalDiscount);

    setText("#dialog-total", money(subtotal));
    setText("#dialog-discount", money(couponDiscount));
    setText("#dialog-repeat-discount", money(repeatDiscount));
    setText("#dialog-total-discount", money(totalDiscount));
    setText("#dialog-grand-total", money(grandTotal));
  }

  function selectedPayment() {
    const selected = $('input[name="payment_method"]:checked');
    return selected?.value || state.selectedPayment;
  }

  function updatePaymentDetails() {
    const method = selectedPayment();
    state.selectedPayment = method;

    const box = $("#payment-details");
    const text = $("#payment-info-text");

    if (!box || !text) return;

    const settings = state.settings;

    const details = {
      bkash: settings.bkash_number
        ? `bKash Number: ${settings.bkash_number}\nPayment type: Send Money`
        : "Admin এখনো bKash payment details যোগ করেননি।",
      nagad: settings.nagad_number
        ? `Nagad Number: ${settings.nagad_number}\nPayment type: Send Money`
        : "Admin এখনো Nagad payment details যোগ করেননি।",
      bank: settings.bank_details ||
        settings.bank_instructions ||
        "Bank payment details এখনো যোগ করা হয়নি।"
    };

    text.textContent = details[method] || "";
  }

  async function previewRepeatDiscount() {
    if (!state.cart.length) return;

    const phone = $("#customer-phone")?.value.trim() || "";
    const address = $("#customer-address")?.value.trim() || "";

    if (!phone || !address) return;

    try {
      const result = await edgeFunction("place-order", {
        action: "preview_repeat_discount",
        customer: {
          name: $("#customer-name")?.value.trim() || "",
          phone,
          address
        }
      });

      state.repeatDiscount = Number(
        result.repeat_discount || result.discount || 0
      );

      setText("#repeat-order-count", result.total_orders || 0);
      setText("#repeat-discount-percent", result.discount_percent || 0);

      const message = $("#repeat-discount-message");

      if (message) {
        message.textContent = state.repeatDiscount > 0
          ? `আপনার repeat customer discount: ${money(state.repeatDiscount)}`
          : "আপনার repeat customer discount এখনো প্রযোজ্য নয়।";
      }

      updateCheckoutSummary();
    } catch (error) {
      console.warn("Repeat discount:", error.message);
    }
  }

  async function applyCoupon() {
    const input = $("#coupon-code");
    const message = $("#coupon-message");
    const code = input?.value.trim();

    if (!code) {
      if (message) message.textContent = "Coupon code লিখুন।";
      return;
    }

    try {
      const result = await edgeFunction("place-order", {
        action: "validate_coupon",
        coupon_code: code,
        subtotal: cartSubtotal()
      });

      if (result.valid === false || result.ok === false) {
        throw new Error(result.message || "Coupon valid নয়।");
      }

      state.coupon = {
        code,
        discount_amount: Number(
          result.discount_amount || result.discount || 0
        )
      };

      if (message) {
        message.textContent = result.message || "Coupon applied হয়েছে।";
        message.className = "success-message";
      }

      updateCheckoutSummary();
    } catch (error) {
      state.coupon = null;

      if (message) {
        message.textContent = error.message;
        message.className = "error-message";
      }

      updateCheckoutSummary();
    }
  }

  function formValue(id) {
    return $(`#${id}`)?.value.trim() || "";
  }

  function showFormMessage(message, type = "error") {
    const element = $("#form-message");
    if (!element) return;

    element.textContent = message;
    element.className = type === "success"
      ? "success-message"
      : "error-message";
  }

  async function submitOrder(event) {
    event.preventDefault();

    if (state.busy) return;

    if (!state.cart.length) {
      showFormMessage("আপনার cart খালি।");
      return;
    }

    const customer = {
      name: formValue("customer-name"),
      phone: formValue("customer-phone"),
      whatsapp: formValue("customer-whatsapp"),
      address: formValue("customer-address"),
      district: formValue("customer-district"),
      area: formValue("customer-area")
    };

    if (!customer.name || !customer.phone || !customer.address) {
      showFormMessage("নাম, ফোন এবং ঠিকানা পূরণ করুন।");
      return;
    }

    const paymentMethod = selectedPayment();

    if (!["bkash", "nagad", "bank"].includes(paymentMethod)) {
      showFormMessage("একটি payment method নির্বাচন করুন।");
      return;
    }

    const button = $("#place-order-button");
    state.busy = true;

    if (button) {
      button.disabled = true;
      button.textContent = "Processing...";
    }

    try {
      const result = await edgeFunction("place-order", {
        customer,
        payment_method: paymentMethod,
        items: state.cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity
        })),
        note: formValue("order-note"),
        coupon_code: state.coupon?.code || ""
      });

      if (!result.ok) {
        throw new Error(result.message || "Order place করা যায়নি।");
      }

      state.cart = [];
      state.coupon = null;
      state.repeatDiscount = 0;

      saveStorage();
      renderCart();
      closeCheckout();

      const orderNumber = result.order_number || "";

      notify(
        orderNumber
          ? `Order সফল হয়েছে! Order ID: ${orderNumber}`
          : "আপনার order সফলভাবে গ্রহণ করা হয়েছে।"
      );

      $("#order-form")?.reset();

      setTimeout(() => {
        if (orderNumber) {
          window.location.href =
            `track-order.html?order=${encodeURIComponent(orderNumber)}`;
        }
      }, 1800);

    } catch (error) {
      showFormMessage(error.message || "Order place করা যায়নি।");
    } finally {
      state.busy = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Place Order";
      }
    }
  }

  function setupEvents() {
    document.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-add-cart]");
      if (addButton) {
        addToCart(addButton.dataset.addCart);
        return;
      }

      const wishlistButton = event.target.closest("[data-wishlist]");
      if (wishlistButton) {
        toggleWishlist(wishlistButton.dataset.wishlist);
        return;
      }

      const quantityButton = event.target.closest("[data-quantity]");
      if (quantityButton) {
        changeQuantity(
          quantityButton.dataset.id,
          Number(quantityButton.dataset.quantity)
        );
        return;
      }

      const removeButton = event.target.closest("[data-remove-cart]");
      if (removeButton) {
        removeCartItem(removeButton.dataset.removeCart);
        return;
      }

      const categoryButton = event.target.closest("[data-category]");
      if (categoryButton) {
        state.activeCategory = categoryButton.dataset.category;
        renderProducts();

        $("#shop")?.scrollIntoView({ behavior: "smooth" });
        return;
      }

      const tab = event.target.closest(".product-tab");
      if (tab) {
        $$(".product-tab").forEach((item) => item.classList.remove("active"));
        tab.classList.add("active");

        state.activeCategory = tab.dataset.category || "all";
        renderProducts();
      }
    });

    $("#cart-open")?.addEventListener("click", openCart);
    $("#mobile-cart-open")?.addEventListener("click", openCart);
    $("#cart-close")?.addEventListener("click", closeCart);
    $("#continue-shopping")?.addEventListener("click", closeCart);

    $("#overlay")?.addEventListener("click", closeCart);

    $("#checkout-open")?.addEventListener("click", openCheckout);
    $("#order-close")?.addEventListener("click", closeCheckout);

    $("#order-dialog")?.addEventListener("click", (event) => {
      if (event.target === $("#order-dialog")) {
        closeCheckout();
      }
    });

    $("#order-form")?.addEventListener("submit", submitOrder);
    $("#apply-coupon")?.addEventListener("click", applyCoupon);

    $("#product-search")?.addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      renderProducts();
    });

    $("#mobile-product-search")?.addEventListener("input", (event) => {
      state.search = event.target.value.trim();

      const desktopSearch = $("#product-search");
      if (desktopSearch) desktopSearch.value = state.search;

      renderProducts();
    });

    $("#product-sort")?.addEventListener("change", (event) => {
      state.sort = event.target.value;
      renderProducts();
    });

    $$('input[name="payment_method"]').forEach((input) => {
      input.addEventListener("change", updatePaymentDetails);
    });

    ["customer-name", "customer-phone", "customer-address"].forEach((id) => {
      $(`#${id}`)?.addEventListener("blur", previewRepeatDiscount);
    });

    $("#mobile-menu-open")?.addEventListener("click", () => {
      $("#mobile-menu")?.classList.add("open");
      document.body.classList.add("no-scroll");
    });

    $("#mobile-menu-close")?.addEventListener("click", closeMobileMenu);

    $$("#mobile-menu a").forEach((link) => {
      link.addEventListener("click", closeMobileMenu);
    });

    $("#year") && ($("#year").textContent = new Date().getFullYear());
  }

  function closeMobileMenu() {
    $("#mobile-menu")?.classList.remove("open");
    document.body.classList.remove("no-scroll");
  }

  async function init() {
    setupEvents();
    renderCart();

    await Promise.all([
      loadSettings(),
      loadProducts()
    ]);

    updatePaymentDetails();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
