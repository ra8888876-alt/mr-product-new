const SUPABASE_URL = window.MR_PRODUCT_CONFIG?.supabaseUrl || '';
const SUPABASE_PUBLISHABLE_KEY = window.MR_PRODUCT_CONFIG?.publishableKey || '';
const money = n => '৳' + Number(n).toLocaleString('en-BD');
const products = [
 {id:'10000000-0000-4000-8000-000000000001',name:'Hydrating Face Serum',price:850,description:'Daily hydration essential.'},
 {id:'10000000-0000-4000-8000-000000000002',name:'Daily Face Cream',price:650,description:'A simple everyday skincare pick.'},
 {id:'10000000-0000-4000-8000-000000000003',name:'Luxury Lipstick',price:550,description:'A refined finishing touch.'}
];
let cart=[];
const $=s=>document.querySelector(s);
$('#year').textContent=new Date().getFullYear();
function renderProducts(){ $('#product-grid').innerHTML=products.map(p=>`<article class="product-card"><div class="product-image">MR</div><h3>${p.name}</h3><p class="muted small">${p.description}</p><div class="price">${money(p.price)}</div><button class="button gold-button" data-add="${p.id}">Add to cart</button></article>`).join(''); }
function renderCart(){ $('#cart-count').textContent=cart.reduce((n,x)=>n+x.qty,0); $('#cart-items').innerHTML=cart.length?cart.map(x=>`<div class="cart-line"><div><b>${x.name}</b><div class="muted small">${money(x.price)} × ${x.qty}</div></div><div class="qty"><button data-dec="${x.id}">−</button>${x.qty}<button data-inc="${x.id}">+</button></div></div>`).join(''):'<p class="muted">Your cart is empty.</p>';const total=cart.reduce((n,x)=>n+x.price*x.qty,0);$('#cart-total').textContent=money(total);$('#dialog-total').textContent=money(total);}
function openCart(){ $('#overlay').hidden=false;$('#cart-drawer').classList.add('open');$('#cart-drawer').setAttribute('aria-hidden','false'); }
function closeCart(){ $('#overlay').hidden=true;$('#cart-drawer').classList.remove('open');$('#cart-drawer').setAttribute('aria-hidden','true'); }
$('#product-grid').addEventListener('click',e=>{const id=e.target.dataset.add;if(!id)return;const p=products.find(x=>x.id===id);const item=cart.find(x=>x.id===id);item?item.qty++:cart.push({...p,qty:1});renderCart();});
$('#cart-items').addEventListener('click',e=>{const id=e.target.dataset.inc||e.target.dataset.dec;if(!id)return;const item=cart.find(x=>x.id===id);item.qty+=e.target.dataset.inc?1:-1;if(item.qty<=0)cart=cart.filter(x=>x.id!==id);renderCart();});
$('#cart-open').onclick=openCart;$('#cart-close').onclick=closeCart;$('#overlay').onclick=closeCart;
$('#checkout-open').onclick=()=>{if(!cart.length){alert('Your cart is empty.');return;}closeCart();$('#order-dialog').showModal();};$('#order-close').onclick=()=>$('#order-dialog').close();
$('#order-form').addEventListener('submit',async e=>{e.preventDefault();const msg=$('#form-message');if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY){msg.textContent='Order submission is not connected yet. Please do not treat this preview as a placed order.';return;}msg.textContent='Submitting your order…';const f=new FormData(e.currentTarget);const payload={customer:{name:f.get('name'),phone:f.get('phone'),whatsapp:f.get('whatsapp'),district:f.get('district'),area:f.get('area'),address:f.get('address')},items:cart.map(x=>({product_id:x.id,quantity:x.qty})),payment_method:f.get('payment'),note:f.get('note')};try{const res=await fetch(`${SUPABASE_URL}/functions/v1/place-order`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${SUPABASE_PUBLISHABLE_KEY}`},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw new Error(data.error||'Order could not be submitted.');msg.textContent=`Order received. Your order number is ${data.order_number}.`;cart=[];renderCart();e.currentTarget.reset();}catch(err){msg.textContent=err.message;}});
renderProducts();renderCart();
