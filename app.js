// =============================================
// MR PRODUCT — GRAPHITE LUXE ENHANCEMENTS
// Paste this code at the VERY END of app.js
// =============================================

(() => {
  "use strict";

  // ---------------------------------------------
  // STATE
  // ---------------------------------------------

  let selectedCategory = "All";

  // ---------------------------------------------
  // PREMIUM ENHANCEMENT STYLES
  // ---------------------------------------------

  const enhancementStyles = document.createElement("style");

  enhancementStyles.textContent = `
    .product-card {
      position: relative;
      overflow: hidden;
      transition:
        transform .28s ease,
        box-shadow .28s ease,
        border-color .28s ease;
      animation: mrProductEnter .45s ease both;
    }

    .product-card:hover {
      transform: translateY(-7px);
      box-shadow: 0 16px 35px rgba(0,0,0,.28);
    }

    .product-card:active {
      transform: scale(.975);
    }

    .product-card .product-image {
      overflow: hidden;
      position: relative;
    }

    .product-card .product-image img {
      transition: transform .45s ease;
    }

    .product-card:hover .product-image img {
      transform: scale(1.07);
    }

    .mr-product-badges {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 3;
      display: flex;
      flex-direction: column;
      gap: 6px;
      pointer-events: none;
    }

    .mr-badge {
      display: inline-flex;
      width: fit-content;
      padding: 5px 9px;
      border-radius: 7px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .5px;
      text-transform: uppercase;
      backdrop-filter: blur(10px);
    }

    .mr-discount-badge {
      background: #b9a58b;
      color: #202225;
    }

    .mr-stock-badge {
      background: rgba(141,154,150,.94);
      color: #151719;
    }

    .mr-low-stock {
      background: #d99b55;
      color: #202225;
    }

    .mr-out-stock {
      background: #a94d4d;
      color: white;
    }

    .mr-quick-view {
      width: 100%;
      margin-top: 8px;
      padding: 11px 14px;
      border: 1px solid #b9a58b;
      border-radius: 10px;
      background: transparent;
      color: #d7d9d8;
      font-weight: 700;
      cursor: pointer;
      transition: .25s ease;
    }

    .mr-quick-view:hover {
      background: #b9a58b;
      color: #202225;
    }

    .mr-category-filter {
      display: flex;
      gap: 9px;
      overflow-x: auto;
      padding: 12px 2px 18px;
      scrollbar-width: none;
    }

    .mr-category-filter::-webkit-scrollbar {
      display: none;
    }

    .mr-category-button {
      flex: 0 0 auto;
      border: 1px solid #45484c;
      background: #303338;
      color: #d7d9d8;
      border-radius: 30px;
      padding: 9px 16px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: .25s ease;
    }

    .mr-category-button.active,
    .mr-category-button:hover {
      background: #b9a58b;
      color: #202225;
      border-color: #b9a58b;
    }

    .mr-quick-modal {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(0,0,0,.82);
      backdrop-filter: blur(9px);
    }

    .mr-quick-modal.open {
      display: flex;
      animation: mrFadeIn .2s ease;
    }

    .mr-quick-box {
      position: relative;
      width: min(760px, 100%);
      max-height: 90vh;
      overflow-y: auto;
      background: #202225;
      border: 1px solid #45484c;
      border-radius: 20px;
      padding: 22px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 25px;
      box-shadow: 0 25px 80px rgba(0,0,0,.5);
    }

    .mr-quick-image {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      border-radius: 14px;
      background: #303338;
      cursor: zoom-in;
    }

    .mr-quick-info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 13px;
    }

    .mr-quick-info h2 {
      color: #e9e8e4;
      font-size: 23px;
      line-height: 1.3;
      margin: 0;
    }

    .mr-quick-description {
      color: #a8aaa9;
      font-size: 13px;
      line-height: 1.8;
    }

    .mr-quick-price {
      color: #b9a58b;
      font-size: 22px;
      font-weight: 800;
    }

    .mr-quick-old-price {
      color: #8d9a96;
      font-size: 14px;
      text-decoration: line-through;
      margin-right: 8px;
    }

    .mr-quick-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 36px;
      height: 36px;
      border: 1px solid #45484c;
      border-radius: 50%;
      background: #303338;
      color: white;
      font-size: 20px;
      cursor: pointer;
      z-index: 2;
    }

    .mr-quick-add {
      border: none;
      border-radius: 10px;
      background: #b9a58b;
      color: #202225;
      padding: 13px;
      font-weight: 800;
      cursor: pointer;
      transition: .25s ease;
    }

    .mr-quick-add:hover {
      transform: translateY(-2px);
      filter: brightness(1.08);
    }

    .mr-quick-add:disabled {
      opacity: .5;
      cursor: not-allowed;
    }

    .mr-image-zoom {
      position: fixed;
      inset: 0;
      z-index: 100001;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 15px;
      background: rgba(0,0,0,.95);
    }

    .mr-image-zoom.open {
      display: flex;
    }

    .mr-image-zoom img {
      max-width: 95%;
      max-height: 90vh;
      object-fit: contain;
      border-radius: 12px;
    }

    @keyframes mrProductEnter {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes mrFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @media (max-width: 600px) {
      .mr-quick-box {
        grid-template-columns: 1fr;
        gap: 15px;
        padding: 16px;
        max-width: 430px;
      }

      .mr-quick-image {
        max-height: 260px;
      }

      .mr-quick-info h2 {
        font-size: 19px;
      }

      .mr-quick-info {
        gap: 9px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .product-card,
      .product-card *,
      .mr-quick-modal {
        animation: none !important;
        transition: none !important;
      }
    }
  `;

  document.head.appendChild(enhancementStyles);

  // ---------------------------------------------
  // QUICK VIEW MODAL
  // ---------------------------------------------

  const quickModal = document.createElement("div");

  quickModal.className = "mr-quick-modal";

  quickModal.innerHTML = `
    <div class="mr-quick-box" role="dialog" aria-modal="true">
      <button
        class="mr-quick-close"
        type="button"
        aria-label="Close"
      >×</button>

      <img
        class="mr-quick-image"
        src=""
        alt=""
      >

      <div class="mr-quick-info">
        <h2></h2>
        <div class="mr-quick-price"></div>
        <div class="mr-quick-description"></div>
        <div class="mr-quick-stock"></div>

        <button
          class="mr-quick-add"
          type="button"
        >
          Add to Cart
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(quickModal);

  const zoomBox = document.createElement("div");

  zoomBox.className = "mr-image-zoom";

  zoomBox.innerHTML = `
    <img src="" alt="Product preview">
  `;

  document.body.appendChild(zoomBox);

  let activeQuickProduct = null;

  function closeQuickView() {
    quickModal.classList.remove("open");
    activeQuickProduct = null;
  }

  function openQuickView(product) {
    if (!product) return;

    activeQuickProduct = product;

    const oldPrice = Number(product.price || 0);
    const currentPrice = getProductPrice(product);
    const stock = Number(product.stock || 0);

    const image = quickModal.querySelector(
      ".mr-quick-image"
    );

    image.src = product.image_url || "";
    image.alt = product.name || "Product";

    quickModal.querySelector("h2").textContent =
      product.name || "";

    quickModal.querySelector(
      ".mr-quick-description"
    ).textContent =
      product.description || "No description available.";

    quickModal.querySelector(
      ".mr-quick-price"
    ).innerHTML =
      currentPrice < oldPrice
        ? `
          <span class="mr-quick-old-price">
            ${money(oldPrice)}
          </span>
          ${money(currentPrice)}
        `
        : money(currentPrice);

    quickModal.querySelector(
      ".mr-quick-stock"
    ).textContent =
      stock <= 0
        ? "Out of Stock"
        : stock <= 5
          ? `Only ${stock} left in stock`
          : "In Stock";

    const addButton = quickModal.querySelector(
      ".mr-quick-add"
    );

    addButton.disabled = stock <= 0;

    addButton.textContent =
      stock <= 0 ? "Out of Stock" : "Add to Cart";

    quickModal.classList.add("open");
  }

  quickModal.querySelector(
    ".mr-quick-close"
  ).addEventListener("click", closeQuickView);

  quickModal.addEventListener("click", (event) => {
    if (event.target === quickModal) {
      closeQuickView();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeQuickView();
      zoomBox.classList.remove("open");
    }
  });

  // ---------------------------------------------
  // IMAGE ZOOM
  // ---------------------------------------------

  quickModal.querySelector(
    ".mr-quick-image"
  ).addEventListener("click", () => {
    const source = quickModal.querySelector(
      ".mr-quick-image"
    ).src;

    if (!source) return;

    zoomBox.querySelector("img").src = source;
    zoomBox.classList.add("open");
  });

  zoomBox.addEventListener("click", () => {
    zoomBox.classList.remove("open");
  });

  // ---------------------------------------------
  // QUICK VIEW ADD TO CART
  // ---------------------------------------------

  quickModal.querySelector(
    ".mr-quick-add"
  ).addEventListener("click", () => {
    if (!activeQuickProduct) return;

    addToCart(activeQuickProduct.id);

    closeQuickView();
  });

  // ---------------------------------------------
  // ADD PRODUCT ID TO PRODUCT CARDS
  // ---------------------------------------------

  const originalCreateProductCard = createProductCard;

  createProductCard = function(product, isWishlist = false) {
    let html = originalCreateProductCard(
      product,
      isWishlist
    );

    html = html.replace(
      '<article class="product-card">',
      `<article
        class="product-card"
        data-mr-product-id="${escapeHTML(product.id)}"
      >`
    );

    return html;
  };

  // ---------------------------------------------
  // DECORATE PRODUCT CARDS
  // ---------------------------------------------

  function decorateProductCards(container) {
    if (!container) return;

    container.querySelectorAll(
      ".product-card[data-mr-product-id]"
    ).forEach((card) => {
      if (card.dataset.mrEnhanced === "true") {
        return;
      }

      const product = products.find(
        (item) =>
          String(item.id) ===
          String(card.dataset.mrProductId)
      );

      if (!product) return;

      card.dataset.mrEnhanced = "true";

      const oldPrice = Number(product.price || 0);
      const currentPrice = getProductPrice(product);
      const stock = Number(product.stock || 0);

      const badges = document.createElement("div");

      badges.className = "mr-product-badges";

      if (currentPrice < oldPrice && oldPrice > 0) {
        const percentage = Math.round(
          ((oldPrice - currentPrice) / oldPrice) * 100
        );

        const discount = document.createElement("span");

        discount.className =
          "mr-badge mr-discount-badge";

        discount.textContent =
          `${percentage}% OFF`;

        badges.appendChild(discount);
      }

      const stockBadge = document.createElement("span");

      stockBadge.className = "mr-badge";

      if (stock <= 0) {
        stockBadge.classList.add("mr-out-stock");
        stockBadge.textContent = "Out of Stock";
      } else if (stock <= 5) {
        stockBadge.classList.add("mr-low-stock");
        stockBadge.textContent = `Only ${stock} Left`;
      } else {
        stockBadge.classList.add("mr-stock-badge");
        stockBadge.textContent = "In Stock";
      }

      badges.appendChild(stockBadge);

      const imageBox = card.querySelector(
        ".product-image"
      );

      if (imageBox) {
        imageBox.appendChild(badges);
      }

      const quickButton = document.createElement("button");

      quickButton.type = "button";
      quickButton.className = "mr-quick-view";
      quickButton.textContent = "Quick View";

      quickButton.dataset.quickView =
        String(product.id);

      const addButton = card.querySelector(
        "[data-add]"
      );

      if (addButton) {
        addButton.insertAdjacentElement(
          "afterend",
          quickButton
        );
      } else {
        card.appendChild(quickButton);
      }
    });
  }

  // ---------------------------------------------
  // UPDATE CATEGORY FILTER
  // ---------------------------------------------

  function createCategoryFilter() {
    const grid = $("#product-grid");

    if (!grid) return;

    if ($("#mr-category-filter")) return;

    const categories = [
      "All",
      ...new Set(
        products
          .map((product) =>
            String(product.category || "").trim()
          )
          .filter(Boolean)
      )
    ];

    if (categories.length <= 1) return;

    const filter = document.createElement("div");

    filter.id = "mr-category-filter";
    filter.className = "mr-category-filter";

    categories.forEach((category) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className =
        "mr-category-button" +
        (category === "All" ? " active" : "");

      button.textContent = category;
      button.dataset.category = category;

      filter.appendChild(button);
    });

    grid.parentNode.insertBefore(filter, grid);

    filter.addEventListener("click", (event) => {
      const button = event.target.closest(
        "[data-category]"
      );

      if (!button) return;

      selectedCategory = button.dataset.category;

      filter.querySelectorAll(
        ".mr-category-button"
      ).forEach((item) => {
        item.classList.toggle(
          "active",
          item === button
        );
      });

      renderProducts();
    });
  }

  // ---------------------------------------------
  // CATEGORY FILTER + EXISTING SEARCH
  // ---------------------------------------------

  const originalRenderProducts = renderProducts;

  renderProducts = function() {
    const previousSearch = searchTerm;

    if (selectedCategory !== "All") {
      const category = selectedCategory.toLowerCase();

      const search = previousSearch.toLowerCase();

      const filtered = products.filter((product) => {
        const matchesCategory =
          String(product.category || "").toLowerCase() ===
          category;

        const searchText = [
          product.name,
          product.description,
          product.category
        ].join(" ").toLowerCase();

        return (
          matchesCategory &&
          searchText.includes(search)
        );
      });

      const grid = $("#product-grid");

      if (!grid) return;

      if (!filtered.length) {
        grid.innerHTML = `
          <div class="wishlist-empty">
            No products found in this category.
          </div>
        `;
      } else {
        grid.innerHTML = filtered
          .map((product) => createProductCard(product))
          .join("");
      }

      decorateProductCards(grid);

      return;
    }

    originalRenderProducts();

    decorateProductCards($("#product-grid"));
  };

  // ---------------------------------------------
  // WISHLIST DECORATION
  // ---------------------------------------------

  const originalRenderWishlist = renderWishlist;

  renderWishlist = function() {
    originalRenderWishlist();

    decorateProductCards($("#wishlist-grid"));
  };

  // ---------------------------------------------
  // QUICK VIEW BUTTON ACTION
  // ---------------------------------------------

  document.addEventListener("click", (event) => {
    const button = event.target.closest(
      "[data-quick-view]"
    );

    if (!button) return;

    const product = products.find(
      (item) =>
        String(item.id) ===
        String(button.dataset.quickView)
    );

    if (product) {
      openQuickView(product);
    }
  });

  // ---------------------------------------------
  // SEARCH RESET CATEGORY
  // ---------------------------------------------

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (selectedCategory !== "All") {
        selectedCategory = "All";

        $("#mr-category-filter")
          ?.querySelectorAll(".mr-category-button")
          .forEach((button) => {
            button.classList.toggle(
              "active",
              button.dataset.category === "All"
            );
          });

        originalRenderProducts();
        decorateProductCards($("#product-grid"));
      }
    });
  }

  // ---------------------------------------------
  // INITIAL SETUP
  // ---------------------------------------------

  const originalLoadProducts = loadProducts;

  loadProducts = async function() {
    await originalLoadProducts();

    createCategoryFilter();

    decorateProductCards($("#product-grid"));
    decorateProductCards($("#wishlist-grid"));
  };

})();
