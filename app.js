const products = [
  {id:"watch", name:"Luxury Watch", description:"A refined statement for everyday style.", price:2500, mark:"TIME"},
  {id:"dress", name:"Premium Dress", description:"An elegant look for special moments.", price:1800, mark:"STYLE"},
  {id:"beauty", name:"Beauty Collection", description:"A thoughtful addition to your routine.", price:950, mark:"BEAUTY"}
];
const cart = new Map();
const money = n => "৳" + Number(n).toLocaleString("en-BD");
const grid = document.getElementById("product-grid");
grid.innerHTML = products.map(p => `<article class="product-card"><div class="product-image">${p.mark}</div><h3>${p.name}</h3><p>${p.description}</p><div class="product-meta"><span class="price">${money(p.price)}</span><button class="add-button" data-add="${p.id}">ADD TO CART +</button></div></article>`).join("");
document.getElementById("year").textContent = new Date().getFullYear();

function renderCart(){
  const entries = [...cart.entries()];
  const count = entries.reduce((s,[,q])=>s+q,0);
  const total = entries.reduce((s,[id,q])=>s+products.find(p=>p.id===id).price*q,0);
  document.getElementById("cart-count").textContent = count;
  document.getElementById("cart-total").textContent = money(total);
  document.getElementById("dialog-total").textContent = money(total);
  document.getElementById("cart-items").innerHTML = entries.length ? entries.map(([id,q])=>{const p=products.find(x=>x.id===id);return `<div class="cart-line"><div><b>${p.name}</b><small>${money(p.price)} each</small></div><div class="qty"><button data-minus="${id}">−</button><span>${q}</span><button data-plus="${id}">+</button></div></div>`}).join("") : '<p class="muted">Your cart is empty.</p>';
}
document.addEventListener("click", e=>{
  const add=e.target.closest("[data-add]"); if(add){const id=add.dataset.add;cart.set(id,(cart.get(id)||0)+1);renderCart();add.textContent="ADDED ✓";setTimeout(()=>add.textContent="ADD TO CART +",900);}
  const plus=e.target.closest("[data-plus]");if(plus){const id=plus.dataset.plus;cart.set(id,(cart.get(id)||0)+1);renderCart();}
  const minus=e.target.closest("[data-minus]");if(minus){const id=minus.dataset.minus;const q=(cart.get(id)||0)-1;if(q<=0)cart.delete(id);else cart.set(id,q);renderCart();}
});
const drawer=document.getElementById("cart-drawer"), overlay=document.getElementById("overlay");
function openCart(){drawer.classList.add("open");drawer.setAttribute("aria-hidden","false");overlay.hidden=false;}
function closeCart(){drawer.classList.remove("open");drawer.setAttribute("aria-hidden","true");overlay.hidden=true;}
document.getElementById("cart-open").onclick=openCart;
document.getElementById("cart-close").onclick=closeCart;
overlay.onclick=closeCart;
const dialog=document.getElementById("order-dialog");
document.getElementById("checkout-open").onclick=()=>{if(!cart.size){alert("Please add a product first.");return;}closeCart();dialog.showModal();};
document.getElementById("order-close").onclick=()=>dialog.close();
document.getElementById("order-form").addEventListener("submit",e=>{
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.currentTarget).entries());
  const lines=[...cart.entries()].map(([id,q])=>{const p=products.find(x=>x.id===id);return `${p.name} × ${q} — ${money(p.price*q)}`;});
  document.getElementById("form-message").textContent="Preview only — no order has been sent or saved. Items: "+lines.join("; ")+". Customer: "+data.name+", "+data.phone+". Connect secure server-side order processing before accepting real orders.";
});
renderCart();
