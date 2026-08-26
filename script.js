/*********************
 * CONFIG Y COLORES  *
 * Inicia un bloque de comentario que describe la sección de configuración y colores. 
 * Define un objeto defaultConfig que contiene la configuración por defecto de la tienda.
 *********************/
const defaultConfig = {
  //Propiedades de texto para diferentes partes de la interfaz de usuario.
  store_title: "Mi Tienda en Línea",
  store_subtitle: "Vende productos físicos y digitales",
  checkout_title: "Finalizar compra",
  admin_panel_title: "Panel de administración",
  footer_text: "© 2026 Mi tienda en línea",

// Define los colores y estilos visuales de la aplicación 
// (colores morados oscuros, texto claro, botones morados y naranjas).
  background_color: "#1e1b4b",
  surface_color: "#0f172a",
  text_color: "#f1f5f9",
  primary_action_color: "#6366f1",
  secondary_action_color: "#f97316",
  font_family: "Segoe UI",
  font_size: 14
};

//Crea un controlador de aborto y un temporizador de 15 segundos para cancelar peticiones 
// que excedan ese tiempo (timeout global).
const controller =
  new AbortController();

const timeout =
  setTimeout(() => {
    controller.abort();
  }, 15000);

//Copia el objeto defaultConfig en currentConfig usando el operador spread, 
// permitiendo modificaciones sin alterar el objeto original.
let currentConfig = { ...defaultConfig };

/*********************
 * CONFIGURACIÓN API *
 * Define la URL base de la API backend. 
 * En producción, esta URL debería cambiar a la del servidor real.
 *********************/
/*const API_URL = "https://localhost:7171/api";*/
const API_URL = "https://mitiendaenlinea.runasp.net/api";


/*********************
 * ESTADO GLOBAL     *
 * Inicializa arreglos vacíos para almacenar productos y el carrito de compras.
 *********************/
let products = [];
let cart = [];

/*
 * currentFilter guarda el filtro actual de productos ("all", "fisico", "digital"). 
 * currentUser almacena los datos del usuario logueado.
 */
let currentFilter = "all";
let currentUser = null;

function isAdmin() {

  return (
    (currentUser?.role || "")
      .toString()
      .trim()
      .toLowerCase() === "admin"
  );
}

//Intenta recuperar el usuario del localStorage. 
// Si falla (por datos corruptos), asigna null.
try {
  currentUser = JSON.parse(
    localStorage.getItem("currentUser")
  );
} catch {
  currentUser = null;
}

//Variables para almacenar los términos de búsqueda y filtros en las vistas de usuarios, 
// pedidos y productos.
let userSearchTerm = "";
let userRoleFilter = "all";

let orderSearchTerm = "";
let orderStatusFilter = "all";

let productSearchTerm = "";
let categoryFilter = "all";
let priceFilter = "all";
let sortFilter = "default";

/**
* currentSelectedOrder/User: almacenan el elemento seleccionado para mostrar detalles.
* adminOrders: lista de pedidos para el panel admin.
* dropinInstance: instancia del widget de pago Braintree.
*/
let currentSelectedOrder = null;
let currentSelectedUser = null;

let adminOrders = [];

let dropinInstance = null;


/*********************
 * UTILIDADES        *
 *********************/

// Función que formatea un número como moneda en pesos mexicanos (MXN) con 2 decimales.
function formatCurrency(mxn = 0) {
  return Number(mxn).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2
  });
}

//Recorre el carrito, suma la cantidad total de artículos y el costo total de la compra.
function calculateCartTotals() {
  let count = 0;
  let total = 0;

  for (const item of cart) {
    count += Number(item.quantity);
    total += Number(item.quantity) * Number(item.price);
  }

  return { count, total };
}

//Genera un ID único de pedido con el prefijo "ORD-", 
// seguido de la marca de tiempo y un string aleatorio.
function generateOrderId() {
  return (
    "ORD-" +
    Date.now() +
    "-" +
    Math.random().toString(36).substring(2, 9)
  );
}

//Muestra un mensaje en un elemento específico, le aplica clases CSS 
// según el tipo y lo oculta automáticamente después de 4 segundos.
function showMessage(elementId, text, type = "success") {
  const el = document.getElementById(elementId);

  if (!el) return;

  el.textContent = text;
  el.className = `auth-message ${type} visible`;

  setTimeout(() => {
    el.classList.remove("visible");
  }, 4000);
}

//Crea una notificación emergente ("toast") que aparece en la esquina superior derecha. 
// Usa colores verde para éxito y rojo para errores, con animación de entrada y salida.
function showToast(message, type = "success") {
  const toast = document.createElement("div");

  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    border-radius: 12px;
    font-size: 0.9em;
    font-weight: 600;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,.3);
  `;

  if (type === "success") {
    toast.style.background = "rgba(16,185,129,.95)";
    toast.style.border = "1px solid rgba(16,185,129,1)";
    toast.style.color = "#fff";
  } else {
    toast.style.background = "rgba(239,68,68,.95)";
    toast.style.border = "1px solid rgba(239,68,68,1)";
    toast.style.color = "#fff";
  }

  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideOut .3s ease";

    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

/*********************
 * API REQUEST       *
 *********************/
//Crea un nuevo controlador de aborto y temporizador de 15 segundos para cada petición.
async function apiRequest(endpoint, options = {}) {

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {

    //Muestra en consola la URL a la que se hace la petición y recupera el token JWT 
    // del localStorage.
    console.log(`📡 ${API_URL}${endpoint}`);

    const token =
      localStorage.getItem("token");

//Configuración base de la petición. Usa GET por defecto y aplica el options recibido 
// (para sobrescribir método, headers, body, etc.).      
    const config = {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
      ...options
    };

    //Si existe token, lo añade al header de autorización para autenticar la petición.
    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

//Si el body es un objeto, lo convierte a string JSON.
    if (
      config.body &&
      typeof config.body !== "string"
    ) {
      config.body =
        JSON.stringify(config.body);
    }

    //Realiza la petición fetch con la señal de aborto para cancelar en timeout.
    const response = await fetch(
      `${API_URL}${endpoint}`,
      {
        ...config,
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!response.ok) {

      console.error("❌ HTTP Status:", response.status);
      console.error("❌ URL:", `${API_URL}${endpoint}`);
      console.error("❌ Respuesta completa:", data);
      console.error("❌ Respuesta original:", text);

    if (response.status === 401) {

      localStorage.removeItem("currentUser");
      localStorage.removeItem("token");

      currentUser = null;

      showToast(
        "Sesión expirada. Inicia sesión nuevamente.",
        "error"
      );

      setActiveTab("auth");
    }

    if (response.status === 403) {

      showToast(
        "No tienes permisos para realizar esta operación.",
        "error"
      );
    }

      throw new Error(
        data.message ||
        data.error ||
        data.title ||
        `Error ${response.status}`
      );
    }

    return data;

  } catch (error) {

    if (error.name === "AbortError") {
      throw new Error(
        "Tiempo de espera agotado"
      );
    }

    console.error(
      `❌ Error ${endpoint}:`,
      error
    );

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}

/*********************
 * PRODUCTOS API     *
 *********************/
async function fetchProducts() {
  try {
    const data = await apiRequest("/products");

    products = Array.isArray(data.products)
      ? data.products
      : [];

    renderProducts();

  } catch (error) {
    console.error(error);
    showToast("Error cargando productos", "error");
  }
}

async function createProduct(product) {
  return await apiRequest("/products", {
    method: "POST",
    body: product
  });
}

async function updateProduct(id, product) {
  return await apiRequest(`/products/${id}`, {
    method: "PUT",
    body: product
  });
}

async function removeProductApi(id) {
  return await apiRequest(`/products/${id}`, {
    method: "DELETE"
  });
}

/*********************
 * AUTH REGISTER     *
 *********************/
async function handleRegister(event) {
  event.preventDefault();

  const btn =
    event.target.querySelector('button[type="submit"]');

  btn.classList.add("loading");
  btn.disabled = true;

  try {
    const formData = new FormData(event.target);

    const userData = {
      nombre: formData.get("nombre"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role") || "cliente",
      direccion: formData.get("direccion") || "",
      ciudad: formData.get("ciudad") || "",
      estado: formData.get("estado") || "",
      cp: formData.get("cp") || ""
    };

    if (userData.password.length < 6) {
      throw new Error(
        "La contraseña debe tener al menos 6 caracteres"
      );
    }

    const result = await apiRequest("/auth/register", {
      method: "POST",
      body: userData
    });

    if (result.success) {
      showMessage(
        "register-message",
        "Registro exitoso",
        "success"
      );

      event.target.reset();

      setTimeout(() => {
        switchAuthTab("login");
      }, 1200);

    } else {
      throw new Error(result.message || "Error registrando");
    }

  } catch (error) {
    console.error(error);

    showMessage(
      "register-message",
      error.message,
      "error"
    );

  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

/*********************
 * LOGIN             *
 *********************/
async function handleLogin(event) {
  event.preventDefault();

  const btn =
    event.target.querySelector('button[type="submit"]');

  btn.classList.add("loading");
  btn.disabled = true;

  try {
    const formData = new FormData(event.target);

    const credentials = {
      email: formData.get("email"),
      password: formData.get("password")
    };

    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: credentials
    });

    if (!result.success) {
      throw new Error(
        result.message || "Credenciales incorrectas"
      );
    }

    currentUser = result.user;

    console.log("LOGIN RESULT:", result);
    console.log("USER:", result.user);
    console.log("ROLE:", result.user?.role);

    localStorage.setItem(
      "currentUser",
      JSON.stringify(currentUser)
    );

    if (result.token) {
      localStorage.setItem("token", result.token);
    }

    updateUIForUser();

    showMessage(
      "login-message",
      "Inicio de sesión exitoso",
      "success"
    );

    setTimeout(() => {
      setActiveTab("catalog");
    }, 1000);

  } catch (error) {
    console.error(error);

    showMessage(
      "login-message",
      error.message,
      "error"
    );

  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

/*********************
 * LOGOUT            *
 *********************/
function handleLogout() {
  currentUser = null;

  localStorage.removeItem("currentUser");
  localStorage.removeItem("token");

  cart = [];

  updateUIForUser();
  renderCart();

  setActiveTab("catalog");

  showToast("Sesión cerrada", "success");
}

/*********************
 * UI USER           *
 *********************/
function updateUIForUser() {

    const userSection =
        document.getElementById("user-section");

    const userName =
        document.getElementById("user-name");

    const userRole =
        document.getElementById("user-role");

    const tabAdmin =
        document.getElementById("tab-admin");

    const tabUsers =
        document.getElementById("tab-users");

    const tabProducts =
        document.getElementById("tab-products-admin");


    if (currentUser) {

        // ==========================================
        // NORMALIZAR ROL
        // ==========================================

        const role =
            (currentUser.role || "")
                .toString()
                .trim()
                .toLowerCase();

        const isAdmin =
            role === "admin";


        // ==========================================
        // USUARIO
        // ==========================================

        if (userSection) {
            userSection.style.display = "flex";
        }


        // ==========================================
        // NOMBRE
        // ==========================================

        if (userName) {

            userName.textContent =
                currentUser.nombre ||
                currentUser.email ||
                "Usuario";
        }


        // ==========================================
        // ROL
        // ==========================================

        if (userRole) {

            userRole.textContent =
                isAdmin
                    ? "Administrador"
                    : "Cliente";
        }


        // ==========================================
        // PERMISOS
        // ==========================================

        if (tabAdmin) {
            tabAdmin.disabled = !isAdmin;
        }

        if (tabUsers) {
            tabUsers.disabled = !isAdmin;
        }

        if (tabProducts) {
            tabProducts.disabled = !isAdmin;
        }


        console.log("👤 Usuario:", currentUser);
        console.log("🔐 Rol:", currentUser.role);
        console.log("👑 Es administrador:", isAdmin);


    } else {

        if (userSection) {
            userSection.style.display = "none";
        }

        if (tabAdmin) {
            tabAdmin.disabled = true;
        }

        if (tabUsers) {
            tabUsers.disabled = true;
        }

        if (tabProducts) {
            tabProducts.disabled = true;
        }
    }
}

/*********************
 * AUTH UI           *
 *********************/
function switchAuthTab(tab) {
  const loginTab =
    document.getElementById("auth-tab-login");

  const registerTab =
    document.getElementById("auth-tab-register");

  const loginForm =
    document.getElementById("login-form");

  const registerForm =
    document.getElementById("register-form");

  if (
    !loginTab ||
    !registerTab ||
    !loginForm ||
    !registerForm
  ) {
    return;
  }

  if (tab === "login") {
    loginTab.classList.add("active");
    registerTab.classList.remove("active");

    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");

  } else {
    registerTab.classList.add("active");
    loginTab.classList.remove("active");

    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
  }
}

function toggleAddressFields() {
  const addressFields =
    document.getElementById("register-address-fields");

  if (!addressFields) return;

  const role =
    document.querySelector(
      'input[name="role"]:checked'
    )?.value || "cliente";

  if (role === "cliente") {
    addressFields.style.display = "block";
  } else {
    addressFields.style.display = "none";
  }
}

/*********************
 * RENDER PRODUCTS   *
 *********************/
function renderProducts() {
  const list =
    document.getElementById("product-list");

  const countEl =
    document.getElementById("products-count");

  if (!list) return;

  list.innerHTML = "";

  let filtered = [...products];

  if (currentFilter !== "all") {

    filtered = filtered.filter(p => {

      return (
        (p.type || "")
          .toLowerCase()
          .trim() === currentFilter
      );
    });
  }

  if (productSearchTerm.trim()) {
    const search =
      productSearchTerm.toLowerCase();

    filtered = filtered.filter(p =>
      (p.name || "")
        .toLowerCase()
        .includes(search)
    );
  }

  if (categoryFilter !== "all") {
    filtered = filtered.filter(
      p => (p.category || "")
              .toLowerCase()
              .trim() ===
            categoryFilter.toLowerCase().trim()
    );
  }

  if (priceFilter !== "all") {
    filtered = filtered.filter(p => {
      const price = Number(p.price);

      if (priceFilter === "0-200") {
        return price >= 0 && price <= 200;
      }

      if (priceFilter === "201-500") {
        return price >= 201 && price <= 500;
      }

      if (priceFilter === "501-1000") {
        return price >= 501 && price <= 1000;
      }

      if (priceFilter === "1001+") {
        return price > 1000;
      }

      return true;
    });
  }

  switch (sortFilter) {
    case "name-asc":
      filtered.sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );
      break;

    case "name-desc":
      filtered.sort((a, b) =>
        (b.name || "").localeCompare(a.name || "")
      );
      break;

    case "price-asc":
      filtered.sort(
        (a, b) => Number(a.price) - Number(b.price)
      );
      break;

    case "price-desc":
      filtered.sort(
        (a, b) => Number(b.price) - Number(a.price)
      );
      break;
  }

  if (countEl) {
    countEl.textContent = filtered.length;
  }

  if (filtered.length === 0) {
    list.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px">
        No se encontraron productos
      </div>
    `;
    return;
  }

  filtered.forEach(product => {
    const card = document.createElement("article");

    card.className = "product-card";

    const image =
      product.imageUrl ||
      "https://placehold.co/300x300/1e1b4b/f1f5f9?text=Producto";

    card.innerHTML = `
      <img
        src="${image}"
        class="product-img"
        onerror="this.src='https://placehold.co/300x300?text=Sin+Imagen'"
      />

      <div class="product-header">
        <div class="product-info">
          <h3>${escapeHtml(product.name)}</h3>
          <p>${product.description || ""}</p>
        </div>

          ${
            product.badge
              ? `
                <span class="product-badge">
                  ${product.badge}
                </span>
              `
              : ""
          }
      </div>

      <div class="product-footer">
        <span class="product-price">
          ${formatCurrency(Number(product.price) || 0)}
        </span>

        <div class="product-actions">
          <button
            type="button"
            class="add-to-cart-btn"
            data-product-id="${product.id}">
            Agregar
          </button>
        </div>
      </div>
    `;

    list.appendChild(card);
  });

  list
    .querySelectorAll("[data-product-id]")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        addToCart(
          btn.getAttribute("data-product-id")
        );
      });
    });
}

function escapeHtml(text = "") {

  text = String(text);

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/*********************
 * CART              *
 *********************/
function addToCart(productId) {

  const product = products.find(
    p => String(p.id) === String(productId)
  );

  if (!product) {
    showToast("Producto no encontrado", "error");
    return;
  }

  if (
    product.price === undefined ||
    product.price === null ||
    isNaN(Number(product.price))
  ) {
    showToast("Precio inválido", "error");
    return;
  }

  const existing = cart.find(
    p => String(p.id) === String(productId)
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: 1,
      type: product.type
    });
  }

  renderCart();

  showToast(
    `${product.name} agregado`,
    "success"
  );
}

function changeQuantity(productId, delta) {
  const item = cart.find(
    i => String(i.id) === String(productId)
  );

  if (!item) return;

  item.quantity += delta;

  if (item.quantity <= 0) {
    cart = cart.filter(
      i => String(i.id) !== String(productId)
    );
  }

  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(
    i => String(i.id) !== String(productId)
  );

  renderCart();
}

function clearCart() {
  cart = [];

  renderCart();

  showToast("Carrito vaciado", "success");
}

function renderCart() {
  const container =
    document.getElementById("cart-items");

  if (!container) return;

  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML = `
      <p style="font-size:.85em;color:#cbd5e1">
        Tu carrito está vacío
      </p>
    `;
  } else {

    cart.forEach(item => {
      const row = document.createElement("div");

      row.className = "cart-item";

      row.innerHTML = `
        <div class="cart-item-info">
          <p class="cart-item-name">
            ${item.name}
          </p>

          <p class="cart-item-price">
            ${formatCurrency(item.price)}
          </p>
        </div>

        <div class="cart-item-controls">
          <button
            class="qty-btn"
            data-id="${item.id}"
            data-action="dec">
            -
          </button>

          <span class="qty-display">
            ${item.quantity}
          </span>

          <button
            class="qty-btn"
            data-id="${item.id}"
            data-action="inc">
            +
          </button>
        </div>

        <button
          class="remove-btn"
          data-id="${item.id}"
          data-action="remove">
          Quitar
        </button>
      `;

      container.appendChild(row);
    });

    container
      .querySelectorAll("[data-action]")
      .forEach(btn => {

        btn.addEventListener("click", () => {

          const id =
            btn.getAttribute("data-id");

          const action =
            btn.getAttribute("data-action");

          if (action === "inc") {
            changeQuantity(id, 1);
          }

          if (action === "dec") {
            changeQuantity(id, -1);
          }

          if (action === "remove") {
            removeFromCart(id);
          }
        });
      });
  }

  const { count, total } =
    calculateCartTotals();

  const cartCount =
    document.getElementById("cart-count");

  const cartTotal =
    document.getElementById("cart-total");

  const summaryCount =
    document.getElementById(
      "cart-summary-count"
    );

  const summaryTotal =
    document.getElementById(
      "cart-summary-total"
    );

  if (cartCount) {
    cartCount.textContent = count;
  }

  if (cartTotal) {
    cartTotal.textContent =
      formatCurrency(total);
  }

  if (summaryCount) {
    summaryCount.textContent =
      `${count} artículo(s)`;
  }

  if (summaryTotal) {
    summaryTotal.textContent =
      formatCurrency(total);
  }

  renderCheckoutSummary();
}

/*********************
 * CHECKOUT          *
 *********************/
function renderCheckoutSummary() {
  const list =
    document.getElementById(
      "checkout-cart-list"
    );

  if (!list) return;

  list.innerHTML = "";

  const { count, total } =
    calculateCartTotals();

  // ✅ AGREGAR ESTO
  const itemsCountEl =
    document.getElementById(
      "checkout-items-count"
    );

  if (itemsCountEl) {
    itemsCountEl.textContent =
      `${count} artículo(s)`;
  }

  const subtotalEl =
    document.getElementById(
      "checkout-subtotal"
    );

  const shippingEl =
    document.getElementById(
      "checkout-shipping"
    );

  const totalEl =
    document.getElementById(
      "checkout-total"
    );

  if (count === 0) {

    list.innerHTML = `
      <p style="font-size:.85em;color:#cbd5e1">
        Carrito vacío
      </p>
    `;

  if (subtotalEl) {
    subtotalEl.textContent = formatCurrency(0);
  }

  if (shippingEl) {
    shippingEl.textContent = formatCurrency(0);
  }

  if (totalEl) {
    totalEl.textContent = formatCurrency(0);
  }

    return;
  }

  cart.forEach(item => {

    const row = document.createElement("div");

    row.className = "checkout-item";

    row.innerHTML = `
      <div class="checkout-item-info">
        <p class="checkout-item-name">
          ${item.name}
        </p>

        <p class="checkout-item-details">
          ${item.quantity} x
          ${formatCurrency(item.price)}
        </p>
      </div>

      <span class="checkout-item-total">
        ${formatCurrency(
          item.quantity * item.price
        )}
      </span>
    `;

    list.appendChild(row);
  });

  let shipping = 0;

  const envio =
    document.getElementById("envio");

  if (envio) {
    if (envio.value === "standard") {
      shipping = 99;
    }

    if (envio.value === "express") {
      shipping = 169;
    }
  }

  if (subtotalEl) {
    subtotalEl.textContent =
      formatCurrency(total);
  }

  if (shippingEl) {
    shippingEl.textContent =
      formatCurrency(shipping);
  }

  if (totalEl) {
    totalEl.textContent =
      formatCurrency(total + shipping);
  }
}

function fillCheckoutForm() {
  if (!currentUser) return;

  [
    "nombre",
    "email",
    "direccion",
    "ciudad",
    "estado",
    "cp"
  ].forEach(field => {

    const input =
      document.getElementById(field);

    if (
      input &&
      currentUser[field]
    ) {
      input.value = currentUser[field];
    }
  });
}

/*********************
 * BRAINTREE INIT    *
 *********************/
let isInitializingBraintree = false;

async function initializeBraintree() {
  if (dropinInstance || isInitializingBraintree) {
    return;
  }

  const container =
    document.getElementById(
      "dropin-container"
    );

  if (!container) return;

  container.innerHTML = "";

  isInitializingBraintree = true;

  try {

    const tokenResult =
      await apiRequest("/payments/token");

    const clientToken =
      tokenResult.token;

    if (!clientToken) {
      throw new Error(
        "No se obtuvo token"
      );
    }

    dropinInstance =
      await braintree.dropin.create({
        authorization: clientToken,
        container: "#dropin-container"
      });

    console.log(
      "✅ Braintree inicializado"
    );

  } catch (error) {
    console.error(error);

    showToast(
      "Error cargando Braintree",
      "error"
    );
  }
  finally {
    isInitializingBraintree = false;
  }

}

/*********************
 * HANDLE CHECKOUT   *
 *********************/
async function handleCheckout(event) {
  event.preventDefault();

  if (!currentUser) {
    showToast(
      "Debes iniciar sesión",
      "error"
    );

    setActiveTab("auth");

    return;
  }

  const btn =
    event.target.querySelector(
      'button[type="submit"]'
    );

  const message =
    document.getElementById(
      "checkout-message"
    );

  btn.classList.add("loading");
  btn.disabled = true;

  try {

    const { count, total } =
      calculateCartTotals();

    if (count === 0) {
      throw new Error(
        "Tu carrito está vacío"
      );
    }

    if (typeof braintree === "undefined") {
      throw new Error(
        "Braintree SDK no cargado"
      );
    }

    if (!dropinInstance) {
      await initializeBraintree();
    }

    if (!dropinInstance) {
      throw new Error(
        "No se pudo iniciar Braintree"
      );
    }

    const payload =
      await dropinInstance.requestPaymentMethod();

    if (!payload?.nonce) {
      throw new Error(
        "No se obtuvo nonce"
      );
    }

    const formData =
      new FormData(event.target);

    const envio =
      formData.get("envio") || "standard";

    let shipping = 0;

    if (envio === "standard") {
      shipping = 99;
    }

    if (envio === "express") {
      shipping = 169;
    }

    console.log("CURRENT USER:", currentUser);
    
    const checkoutPayload = {
      userId: currentUser.id,

      items: cart,

      total: total + shipping,

      shippingAddress:
        `${formData.get("direccion")}, ` +
        `${formData.get("ciudad")}, ` +
        `${formData.get("estado")}, ` +
        `CP: ${formData.get("cp")}`,

      paymentMethod: "Braintree",

      paymentMethodNonce:
        payload.nonce
    };

    const result =
      await apiRequest(
        "/payments/checkout",
        {
          method: "POST",
          body: checkoutPayload
        }
      );

    if (!result.success) {
      throw new Error(
        result.message ||
        "Pago rechazado"
      );
    }

    clearCart();

    event.target.reset();

    renderCheckoutSummary();

    message.textContent =
      `Pago exitoso. Orden #${result.orderId}`;

    message.style.color = "#22c55e";

    message.classList.add("visible");

    showToast(
      "Pago realizado correctamente",
      "success"
    );

    if (dropinInstance) {
      await dropinInstance.teardown();
      dropinInstance = null;
    }

    const container =
      document.getElementById(
        "dropin-container"
      );

    if (container) {
      container.innerHTML = "";
    }

  } catch (error) {

    console.error(error);

    message.textContent =
      error.message ||
      "Error procesando pago";

    message.style.color = "#ef4444";

    message.classList.add("visible");

    showToast(
      error.message,
      "error"
    );

  } finally {

    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

/*********************
 * ADMIN PRODUCTOS   *
 *********************/
function renderProductsAdmin() {

  if (!isAdmin()) {
    return;
  }

  const tbody =
    document.getElementById(
      "products-table-body"
    );

  if (!tbody) return;

  tbody.innerHTML = "";

  products.forEach(product => {

    const tr =
      document.createElement("tr");

    tr.innerHTML = `
      <td>${product.name}</td>

      <td>
        ${formatCurrency(product.price)}
      </td>

      <td>${product.type}</td>

      <td>${product.category}</td>

      <td>${product.stock || 0}</td>

      <td>
        ${product.description || ""}
      </td>

      <td>
        <img
          src="${product.imageUrl || ""}"
          style="
            width:50px;
            height:50px;
            object-fit:cover;
            border-radius:6px;
          "
          onerror="
            this.src='https://placehold.co/50x50?text=No+Img'
          "
        />
      </td>

      <td>
        <button
          class="secondary-btn"
          data-edit="${product.id}">
          Editar
        </button>

        <button
          class="secondary-btn"
          data-delete="${product.id}">
          Eliminar
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody
    .querySelectorAll("[data-edit]")
    .forEach(btn => {

      btn.addEventListener("click", () => {

        const id =
          btn.getAttribute("data-edit");

        const product =
          products.find(
            p => String(p.id) === String(id)
          );

        if (product) {
          loadProductForm(product);
        }
      });
    });

  tbody
    .querySelectorAll("[data-delete]")
    .forEach(btn => {

      btn.addEventListener("click", async () => {

        const id =
          btn.getAttribute("data-delete");

        if (!confirm("¿Eliminar producto?")) {
          return;
        }

        try {

          await removeProductApi(id);

          await fetchProducts();

          renderProductsAdmin();

          showToast(
            "Producto eliminado",
            "success"
          );

        } catch (error) {
          console.error(error);

          showToast(
            "Error eliminando producto",
            "error"
          );
        }
      });
    });
}

function loadProductForm(product) {
  document.getElementById(
    "product-id"
  ).value = product.id || "";

  document.getElementById(
    "product-name"
  ).value = product.name || "";

  document.getElementById(
    "product-price"
  ).value = product.price || 0;

  document.getElementById(
    "product-type"
  ).value = product.type || "fisico";

  document.getElementById(
    "product-category"
  ).value = product.category || "";

  document.getElementById(
    "product-description"
  ).value = product.description || "";

  document.getElementById(
    "product-stock"
  ).value = product.stock || 0;

  let imageName =
    product.imageUrl || "";

  try {
    imageName =
      new URL(imageName)
        .pathname
        .split("/")
        .pop();
  } catch {
    imageName =
      imageName.split("/").pop();
  }

  document.getElementById(
    "product-image"
  ).value = imageName;

  const title =
    document.getElementById(
      "product-form-title"
    );

  if (title) {
    title.textContent =
      "Detalles del producto";
  }
}

function resetProductForm() {
  const form =
    document.getElementById(
      "product-form"
    );

  if (form) {
    form.reset();
  }

  document.getElementById(
    "product-id"
  ).value = "";

  const title =
    document.getElementById(
      "product-form-title"
    );

  if (title) {
    title.textContent =
      "Nuevo producto";
  }
}

async function handleProductSubmit(event) {
  event.preventDefault();

  try {

    const id =
      document.getElementById(
        "product-id"
      ).value;

    const type =
      document.getElementById(
        "product-type"
      ).value;

    let imageInput =
      document
        .getElementById("product-image")
        .value
        .trim();

    try {
      imageInput =
        new URL(imageInput)
          .pathname
          .split("/")
          .pop();
    } catch {
      if (imageInput.includes("/")) {
        imageInput =
          imageInput.split("/").pop();
      }
    }

    const product = {
      name:
        document
          .getElementById("product-name")
          .value
          .trim(),

      price: parseFloat(
        document.getElementById(
          "product-price"
        ).value
      ),

      type,

      category:
        document.getElementById(
          "product-category"
        ).value,

      description:
        document
          .getElementById(
            "product-description"
          )
          .value
          .trim(),

      badge:
        type === "fisico"
          ? "Físico"
          : "Digital",

      stock:
        parseInt(
          document.getElementById(
            "product-stock"
          ).value
        ) || 0,

      imageUrl:
        imageInput.startsWith("http")
          ? imageInput
          : `/images/${imageInput}`
    };

    if (
      !product.name ||
      !product.description
    ) {
      throw new Error(
        "Nombre y descripción son obligatorios"
      );
    }

    if (id) {
      await updateProduct(id, product);

      showToast(
        "Producto actualizado",
        "success"
      );

    } else {
      await createProduct(product);

      showToast(
        "Producto creado",
        "success"
      );
    }

    resetProductForm();

    await fetchProducts();

    renderProductsAdmin();

  } catch (error) {
    console.error(error);

    showToast(
      error.message ||
      "Error guardando producto",
      "error"
    );
  }
}

/*********************
 * NAVEGACIÓN        *
 *********************/
function setActiveTab(tab) {
  const views = [
    "auth",
    "catalog",
    "checkout",
    "admin",
    "users",
    "products-admin"
  ];

  views.forEach(view => {

    const el =
      document.getElementById(
        `view-${view}`
      );

    if (el) {
      el.classList.add("hidden");
    }
  });

  const active =
    document.getElementById(
      `view-${tab}`
    );

  if (active) {
    active.classList.remove("hidden");
  }

  [
    "catalog",
    "checkout",
    "admin",
    "users",
    "products-admin"
  ].forEach(btn => {

    const el =
      document.getElementById(
        `tab-${btn}`
      );

    if (el) {
      el.classList.remove("active");
    }
  });

  if (tab !== "auth") {
    const activeBtn =
      document.getElementById(
        `tab-${tab}`
      );

    if (activeBtn) {
      activeBtn.classList.add("active");
    }
  }

  const cartSidebar =
    document.getElementById(
      "cart-sidebar"
    );

  if (cartSidebar) {
    if (
      tab === "catalog" ||
      tab === "checkout"
    ) {
      cartSidebar.style.display =
        "block";
    } else {
      cartSidebar.style.display =
        "none";
    }
  }

  if (tab === "checkout") {
    fillCheckoutForm();
    initializeBraintree();
  }

  const isAdmin =
      (currentUser?.role || "")
          .toString()
          .trim()
          .toLowerCase() === "admin";

  if (tab === "admin" && isAdmin) {
      renderOrders();
  }

  if (tab === "users" && isAdmin) {
      renderUsers();
  }

  if (tab === "products-admin") {
    renderProductsAdmin();
  }
}

/*********************
 * USERS             *
 *********************/
async function fetchUsers() {
  try {

    const result =
      await apiRequest("/users");

    return result.users || [];

  } catch (error) {
    console.error(error);

    return [];
  }
}

async function updateUser(id, user) {

    console.log(
        "📤 Actualizando usuario:",
        id
    );

    console.log(
        "📦 Payload:",
        user
    );

    return await apiRequest(
        `/users/${id}`,
        {
            method: "PUT",
            body: user
        }
    );
}

async function renderUsers() {

  const tbody =
    document.getElementById("users-table-body");

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center;padding:20px;">
        Cargando usuarios...
      </td>
    </tr>
  `;

  try {

    const users = await fetchUsers();

    console.log("USERS:", users);

    if (!users.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:20px;">
            No hay usuarios
          </td>
        </tr>
      `;

      return;
    }

tbody.innerHTML = "";

// FILTRAR USUARIOS
let filteredUsers = [...users];

// BUSCADOR
if (userSearchTerm.trim()) {

  const search =
    userSearchTerm.toLowerCase();

  filteredUsers = filteredUsers.filter(user => {

    return (
      (user.nombre || "")
        .toLowerCase()
        .includes(search)

      ||

      (user.email || "")
        .toLowerCase()
        .includes(search)
    );
  });
}

// FILTRO ROL
if (userRoleFilter !== "all") {

  filteredUsers = filteredUsers.filter(user => {

    return (
      (user.role || "")
        .toLowerCase()
        .trim() === userRoleFilter
    );
  });
}

// SIN RESULTADOS
if (!filteredUsers.length) {

  tbody.innerHTML = `
    <tr>
      <td colspan="6"
          style="text-align:center;padding:20px;">
        No se encontraron usuarios
      </td>
    </tr>
  `;

  return;
}

filteredUsers.forEach(user => {

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${user.id || "-"}</td>

        <td>${user.nombre || "-"}</td>

        <td>${user.email || "-"}</td>

        <td>${user.role || "-"}</td>

        <td>${user.estado || "-"}</td>

        <td style="display:flex;gap:8px;">

          <button
            class="secondary-btn"
            data-user-view="${user.id}">
            Ver
          </button>

          <button
            class="secondary-btn"
            data-user-edit="${user.id}">
            Editar
          </button>

        </td>
      `;

      tbody.appendChild(tr);
    });

// VER DETALLE
tbody
  .querySelectorAll("[data-user-view]")
  .forEach(btn => {

    btn.addEventListener("click", () => {

      const id =
        btn.getAttribute("data-user-view");

      const user =
        filteredUsers.find(
          u => String(u.id) === String(id)
        );

      if (!user) {
        showToast(
          "Usuario no encontrado",
          "error"
        );
        return;
      }

      currentSelectedUser = user;

      showUserDetail(user);
    });
  });

// EDITAR
tbody
  .querySelectorAll("[data-user-edit]")
  .forEach(btn => {

    btn.addEventListener("click", () => {

      const id =
        btn.getAttribute("data-user-edit");

      const user =
        filteredUsers.find(
          u => String(u.id) === String(id)
        );

      if (!user) {
        showToast(
          "Usuario no encontrado",
          "error"
        );
        return;
      }

      loadUserForm(user);
    });
  });
 


  } catch (error) {

    console.error(error);

    tbody.innerHTML = `
      <tr>
        <td colspan="6"
            style="text-align:center;padding:20px;color:red;">
          Error cargando usuarios
        </td>
      </tr>
    `;
  }
}



function showUserDetail(user) {

  if (!user) {
    console.error("Usuario inválido");
    return;
  }

  const empty =
    document.getElementById("user-detail-empty");

  const content =
    document.getElementById("user-detail-content");

  if (!content) {
    console.error(
      "No existe #user-detail-content"
    );
    return;
  }

  // ==========================================
  // DATOS DEL USUARIO
  // ==========================================

  const nombre =
    document.getElementById("user-detail-nombre");

  const email =
    document.getElementById("user-detail-email");

  const role =
    document.getElementById("user-detail-role");

  const direccion =
    document.getElementById("user-detail-direccion");

  const ciudad =
    document.getElementById("user-detail-ciudad");

  const estado =
    document.getElementById("user-detail-estado");

  const cp =
    document.getElementById("user-detail-cp");

  if (nombre) {
    nombre.textContent = user.nombre || "-";
  }

  if (email) {
    email.textContent = user.email || "-";
  }

  if (role) {
    role.textContent = user.role || "-";
  }

  if (direccion) {
    direccion.textContent = user.direccion || "-";
  }

  if (ciudad) {
    ciudad.textContent = user.ciudad || "-";
  }

  if (estado) {
    estado.textContent = user.estado || "-";
  }

  if (cp) {
    cp.textContent = user.cp || "-";
  }

  // ==========================================
  // MOSTRAR DETALLE
  // ==========================================

  if (empty) {
    empty.classList.add("hidden");
  }

  content.classList.remove("hidden");

  console.log("👤 Detalle usuario:", user);
}

function loadUserForm(user) {

    if (!user) {

        console.error(
            "Usuario inválido"
        );

        showToast(
            "Usuario inválido",
            "error"
        );

        return;
    }


    console.log(
        "✏️ Cargando usuario para editar:",
        user
    );


    currentSelectedUser = user;


    // ============================================
    // ELEMENTOS DEL FORMULARIO
    // ============================================

    const emptyMessage =
        document.getElementById(
            "user-edit-empty"
        );

    const form =
        document.getElementById(
            "user-edit-form"
        );


    if (!form) {

        console.error(
            "❌ No existe #user-edit-form"
        );

        return;
    }


    // ============================================
    // MOSTRAR FORMULARIO
    // ============================================

    if (emptyMessage) {

        emptyMessage.classList.add(
            "hidden"
        );
    }

    form.classList.remove(
        "hidden"
    );


    // ============================================
    // CARGAR DATOS
    // ============================================

    const nombre =
        document.getElementById(
            "edit-user-nombre"
        );

    const email =
        document.getElementById(
            "edit-user-email"
        );

    const role =
        document.getElementById(
            "edit-user-role"
        );

    const direccion =
        document.getElementById(
            "edit-user-direccion"
        );

    const ciudad =
        document.getElementById(
            "edit-user-ciudad"
        );

    const estado =
        document.getElementById(
            "edit-user-estado"
        );

    const cp =
        document.getElementById(
            "edit-user-cp"
        );


    if (nombre) {

        nombre.value =
            user.nombre || "";
    }


    if (email) {

        email.value =
            user.email || "";
    }


    if (role) {

        role.value =
            user.role || "Cliente";
    }


    if (direccion) {

        direccion.value =
            user.direccion || "";
    }


    if (ciudad) {

        ciudad.value =
            user.ciudad || "";
    }


    if (estado) {

        estado.value =
            user.estado || "";
    }


    if (cp) {

        cp.value =
            user.cp || "";
    }


    // ============================================
    // LIMPIAR MENSAJE
    // ============================================

    const message =
        document.getElementById(
            "user-edit-message"
        );

    if (message) {

        message.textContent = "";
    }


    console.log(
        "✅ Usuario cargado en formulario:",
        user.id
    );
}


/*********************
 * ORDERS            *
 *********************/
async function fetchOrders() {
  try {

    const result =
      await apiRequest("/orders");

    return result.orders || [];

  } catch (error) {
    console.error(error);

    return [];
  }
}

async function renderOrders() {

  const tbody =
    document.getElementById(
      "admin-orders-body"
    );

  if (!tbody) return;

  tbody.innerHTML = "";

  try {

    adminOrders = await fetchOrders();

    console.log("ORDERS:", adminOrders);

    if (!adminOrders.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="5"
              style="text-align:center;padding:20px;">
            No hay pedidos
          </td>
        </tr>
      `;

      return;
    }

    let totalVentas = 0;

    // FILTRAR PEDIDOS
    let filteredOrders = [...adminOrders];

    // BUSCADOR
    if (orderSearchTerm.trim()) {

      const search =
        orderSearchTerm.toLowerCase();

      filteredOrders =
        filteredOrders.filter(order => {

          return (
            String(order.id)
              .toLowerCase()
              .includes(search)

            ||

            (order.user?.email || "")
              .toLowerCase()
              .includes(search)

            ||

            (order.user?.nombre || "")
              .toLowerCase()
              .includes(search)
          );
        });
    }

    // FILTRO STATUS
    if (orderStatusFilter !== "all") {

      filteredOrders =
        filteredOrders.filter(order => {

          const status =
            (order.status || "")
              .toString()
              .toLowerCase()
              .trim();

          return (
            status ===
            orderStatusFilter
              .toLowerCase()
              .trim()
          );
        });
    }

    // SIN RESULTADOS
    if (!filteredOrders.length) {

      tbody.innerHTML = `
        <tr>
          <td colspan="5"
              style="text-align:center;padding:20px;">
            No se encontraron pedidos
          </td>
        </tr>
      `;

      return;
    }

    filteredOrders.forEach(order => {

      totalVentas += Number(order.total || 0);

      const tr =
        document.createElement("tr");

      tr.innerHTML = `
        <td>#${order.id}</td>

        <td>
          ${order.user?.nombre ||
            order.customerName ||
            "Cliente"}
        </td>

        <td>
          ${formatCurrency(order.total)}
        </td>

        <td>
          ${order.status || "Pendiente"}
        </td>

        <td>
          ${
            order.fechaPedido
              ? new Date(order.fechaPedido)
                  .toLocaleDateString("es-MX")
              : "-"
          }
        </td>
      `;

      tr.style.cursor = "pointer";

      tr.addEventListener("click", () => {
        showOrderDetail(order);
      });

      tbody.appendChild(tr);
    });

    const countEl =
      document.getElementById(
        "admin-orders-count"
      );

    const totalEl =
      document.getElementById(
        "admin-orders-total"
      );

    if (countEl) {
      countEl.textContent =
        filteredOrders.length;
    }

    if (totalEl) {
      totalEl.textContent =
        formatCurrency(totalVentas);
    }

  } catch (error) {

    console.error(error);

    tbody.innerHTML = `
      <tr>
        <td colspan="5"
            style="text-align:center;padding:20px;color:red;">
          Error cargando pedidos
        </td>
      </tr>
    `;
  }
}

function showOrderDetail(order) {

  document
    .getElementById(
      "admin-order-empty"
    )
    ?.classList.add("hidden");

  document
    .getElementById(
      "admin-order-detail"
    )
    ?.classList.remove("hidden");

  document.getElementById(
    "detail-nombre"
  ).textContent =
    order.user?.nombre ||
    order.customerName ||
    "-";

  document.getElementById(
    "detail-email"
  ).textContent =
    order.user?.email ||
    order.email ||
    "-";

  document.getElementById(
    "detail-envio"
  ).textContent =
    order.shippingMethod ||
    "-";

  document.getElementById(
    "detail-pago"
  ).textContent =
    order.paymentMethod ||
    "-";

  document.getElementById(
    "detail-direccion"
  ).textContent =
    order.shippingAddress ||
    "-";

  document.getElementById(
    "detail-status"
  ).value =
    order.status || "Pendiente";

  const statusSelect =
    document.getElementById("detail-status");

  if (statusSelect) {

    statusSelect.onchange = async function () {

      const newStatus = this.value;

      console.log(
        `🔄 Pedido #${order.id} ${order.status} → ${newStatus}`
      );

      try {

        this.disabled = true;

        await updateOrderStatus(
          order.id,
          newStatus
        );

        // Actualizar el objeto local
        order.status = newStatus;

        // Actualizar también el pedido dentro de adminOrders
        const index =
          adminOrders.findIndex(
            o => String(o.id) === String(order.id)
          );

        if (index !== -1) {
          adminOrders[index].status = newStatus;
        }

      } catch (error) {

        console.error(
          "❌ Error cambiando estado:",
          error
        );

        // Regresar al estado anterior
        this.value =
          order.status || "Pendiente";

      } finally {

        this.disabled = false;
      }
    };
  }


  document.getElementById(
    "detail-total"
  ).textContent =
    formatCurrency(order.total);

  const itemsList =
    document.getElementById(
      "detail-items"
    );

  if (!itemsList) return;

  itemsList.innerHTML = "";

  let items = [];

  try {

    items =
      typeof order.items === "string"
        ? JSON.parse(order.items)
        : order.items || [];

    // Si aún sigue siendo string, parsear otra vez
    if (typeof items === "string") {
      items = JSON.parse(items);
    }

    // Seguridad
    if (!Array.isArray(items)) {
      items = [];
    }

  } catch (error) {

    console.error("Error parseando items:", error);

    items = [];
  }

  items.forEach(item => {

    const li =
      document.createElement("li");

    li.textContent =
      `${item.quantity} x ${item.name} - ` +
      formatCurrency(item.price);

    itemsList.appendChild(li);
  });
}

/*********************
 * SUCCESS PAGE      *
 *********************/
/*
function getQueryParams() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  return {
    status: params.get("status"),
    paymentId:
      params.get("payment_id") ||
      params.get("collection_id")
  };
}

async function loadSuccessPage() {
  const {
    status,
    paymentId
  } = getQueryParams();

  if (status !== "approved") {
    return;
  }

  await new Promise(r =>
    setTimeout(r, 4000)
  );

  try {

    const order =
      await apiRequest(
        `/orders/by-payment/${paymentId}`
      );

    if (!order) return;

    clearCart();

    renderSuccess(order);

  } catch (error) {
    console.error(error);

    showToast(
      "Error cargando orden",
      "error"
    );
  }
}

function renderSuccess(order) {
  const container =
    document.getElementById(
      "success-container"
    );

  if (!container) return;

  container.innerHTML = `
    <h2>Pago exitoso</h2>

    <p>
      <strong>Orden:</strong>
      #${order.id}
    </p>

    <p>
      <strong>Total:</strong>
      ${formatCurrency(order.total)}
    </p>

    <p>
      <strong>Estado:</strong>
      ${order.status}
    </p>

    <p>
      <strong>Dirección:</strong>
      ${order.shippingAddress}
    </p>
  `;
}
*/

/*********************
 * EVENTOS           *
 *********************/
function initEvents() {

  document
    .getElementById("tab-catalog")
    ?.addEventListener("click", () => {
      setActiveTab("catalog");
    });

  document
    .getElementById("tab-checkout")
    ?.addEventListener("click", () => {

      if (!currentUser) {
        showToast(
          "Debes iniciar sesión",
          "error"
        );

        setActiveTab("auth");

        return;
      }

      setActiveTab("checkout");
    });

  document
    .getElementById("tab-admin")
    ?.addEventListener("click", () => {

      if (isAdmin()) {
        setActiveTab("admin");
      }
    });

  document
    .getElementById("tab-users")
    ?.addEventListener("click", () => {

      if (isAdmin()) {
        setActiveTab("users");
      }
    });

  document
    .getElementById(
      "tab-products-admin"
    )
    ?.addEventListener("click", () => {

      if (isAdmin()) {
        setActiveTab(
          "products-admin"
        );
      }
    });

  document
    .getElementById(
      "auth-tab-login"
    )
    ?.addEventListener("click", () => {
      switchAuthTab("login");
    });

  document
    .getElementById(
      "auth-tab-register"
    )
    ?.addEventListener("click", () => {
      switchAuthTab("register");
    });

  document
    .getElementById("login-form")
    ?.addEventListener(
      "submit",
      handleLogin
    );

  document
    .getElementById("register-form")
    ?.addEventListener(
      "submit",
      handleRegister
    );

  document
    .getElementById("logout-btn")
    ?.addEventListener(
      "click",
      handleLogout
    );

  document
    .querySelectorAll(
      'input[name="role"]'
    )
    .forEach(radio => {
      radio.addEventListener(
        "change",
        toggleAddressFields
      );
    });

  document
    .getElementById("product-search")
    ?.addEventListener(
      "input",
      e => {

        productSearchTerm =
          e.target.value;

        renderProducts();
      }
    );

  document
    .getElementById("category-filter")
    ?.addEventListener(
      "change",
      e => {

        categoryFilter =
          e.target.value;

        renderProducts();
      }
    );

  document
    .getElementById("price-filter")
    ?.addEventListener(
      "change",
      e => {

        priceFilter =
          e.target.value;

        renderProducts();
      }
    );

  document
    .getElementById("sort-filter")
    ?.addEventListener(
      "change",
      e => {

        sortFilter =
          e.target.value;

        renderProducts();
      }
    );

  document
    .getElementById(
      "btn-clear-cart"
    )
    ?.addEventListener(
      "click",
      clearCart
    );

  document
    .getElementById(
      "go-to-checkout"
    )
    ?.addEventListener(
      "click",
      () => {

        if (!currentUser) {
          showToast(
            "Debes iniciar sesión",
            "error"
          );

          setActiveTab("auth");

          return;
        }

        setActiveTab("checkout");
      }
    );

  document
    .getElementById(
      "shipping-form"
    )
    ?.addEventListener(
      "submit",
      handleCheckout
    );

  document
    .getElementById("envio")
    ?.addEventListener(
      "change",
      renderCheckoutSummary
    );

  document
    .getElementById("product-form")
    ?.addEventListener(
      "submit",
      handleProductSubmit
    );

  document
    .getElementById(
      "btn-cancel-edit"
    )
    ?.addEventListener(
      "click",
      resetProductForm
    );

  /*********************
   * FILTROS PRODUCTOS *
   *********************/

  // TODOS
  document
    .getElementById("filter-all")
    ?.addEventListener("click", () => {

      currentFilter = "all";

      renderProducts();
    });

  // FÍSICOS
  document
    .getElementById("filter-fisicos")
    ?.addEventListener("click", () => {

      currentFilter = "fisico";

      renderProducts();
    });

  // DIGITALES
  document
    .getElementById("filter-digitales")
    ?.addEventListener("click", () => {

      currentFilter = "digital";

      renderProducts();
    });

  // LIMPIAR FILTROS
  document
  .getElementById("clear-filters-btn")
    ?.addEventListener("click", () => {

      currentFilter = "all";

      productSearchTerm = "";
      categoryFilter = "all";
      priceFilter = "all";
      sortFilter = "default";

      // RESET UI
      const search =
        document.getElementById("product-search");

      const category =
        document.getElementById("category-filter");

      const price =
        document.getElementById("price-filter");

      const sort =
        document.getElementById("sort-filter");

      if (search) {
        search.value = "";
      }

      if (category) {
        category.value = "all";
      }

      if (price) {
        price.value = "all";
      }

      if (sort) {
        sort.value = "default";
      }

      renderProducts();

      showToast(
        "Filtros limpiados",
        "success"
      );
    });

/*********************
 * FILTROS USUARIOS  *
 *********************/

// BUSCADOR
document
  .getElementById("user-search")
  ?.addEventListener("input", e => {

    userSearchTerm = e.target.value;

    renderUsers();
  });

// FILTRO ROL
document
  .getElementById("user-role-filter")
  ?.addEventListener("change", e => {

    userRoleFilter = e.target.value;

    renderUsers();
  });

// LIMPIAR
document
  .getElementById("clear-user-filters")
  ?.addEventListener("click", () => {

    userSearchTerm = "";
    userRoleFilter = "all";

    const search =
      document.getElementById("user-search");

    const role =
      document.getElementById("user-role-filter");

    if (search) {
      search.value = "";
    }

    if (role) {
      role.value = "all";
    }

    renderUsers();

    showToast(
      "Filtros limpiados",
      "success"
    );
  });


  /*********************
   * FILTROS PEDIDOS   *
   *********************/

  // BUSCADOR PEDIDOS
  document
    .getElementById("order-search")
    ?.addEventListener("input", e => {

      orderSearchTerm = e.target.value;

      renderOrders();
    });

  // FILTRO STATUS
  document
    .getElementById("order-status-filter")
    ?.addEventListener("change", e => {

      orderStatusFilter = e.target.value;

      renderOrders();
    });

  // LIMPIAR FILTROS PEDIDOS
  document
    .getElementById("clear-order-filters")
    ?.addEventListener("click", () => {

      orderSearchTerm = "";
      orderStatusFilter = "all";

      const search =
        document.getElementById("order-search");

      const status =
        document.getElementById("order-status-filter");

      if (search) {
        search.value = "";
      }

      if (status) {
        status.value = "all";
      }

      renderOrders();

      showToast(
        "Filtros de pedidos limpiados",
        "success"
      );
    });


  toggleAddressFields();

  renderCheckoutSummary();
}

async function updateOrderStatus(orderId, newStatus) {

  try {

    console.log(
      `🔄 Actualizando pedido ${orderId} → ${newStatus}`
    );

    const result = await apiRequest(
      `/orders/${orderId}/status`,
      {
        method: "PUT",

        body: {
          status: newStatus
        }
      }
    );

    console.log(
      "✅ Estado actualizado:",
      result
    );

    showToast(
      `Pedido #${orderId} actualizado a "${newStatus}"`,
      "success"
    );

    // Recargar pedidos
    await fetchOrders();

    // Volver a pintar la vista
    await renderOrders();

    return result;

  } catch (error) {

    console.error(
      "❌ Error actualizando estado:",
      error
    );

    showToast(
      error.message ||
      "No se pudo actualizar el estado",
      "error"
    );

    throw error;
  }
}

function initializeUserEditForm() {

    const form =
        document.getElementById(
            "user-edit-form"
        );

    if (!form) {

        console.error(
            "❌ No existe #user-edit-form"
        );

        return;
    }


    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            if (!currentSelectedUser) {

                showToast(
                    "Selecciona un usuario primero.",
                    "error"
                );

                return;
            }


            try {

                const id =
                    currentSelectedUser.id;


                // ====================================
                // OBTENER DATOS
                // ====================================

                const payload = {

                    nombre:
                        document
                            .getElementById(
                                "edit-user-nombre"
                            )
                            ?.value
                            .trim() || "",


                    email:
                        document
                            .getElementById(
                                "edit-user-email"
                            )
                            ?.value
                            .trim() || "",


                    role:
                        document
                            .getElementById(
                                "edit-user-role"
                            )
                            ?.value || "Cliente",


                    direccion:
                        document
                            .getElementById(
                                "edit-user-direccion"
                            )
                            ?.value
                            .trim() || "",


                    ciudad:
                        document
                            .getElementById(
                                "edit-user-ciudad"
                            )
                            ?.value
                            .trim() || "",


                    estado:
                        document
                            .getElementById(
                                "edit-user-estado"
                            )
                            ?.value
                            .trim() || "",


                    cp:
                        document
                            .getElementById(
                                "edit-user-cp"
                            )
                            ?.value
                            .trim() || ""
                };


                console.log(
                    "📤 PUT usuario:",
                    id
                );

                console.log(
                    "📦 Datos enviados:",
                    payload
                );


                // ====================================
                // VALIDACIONES
                // ====================================

                if (!payload.nombre) {

                    throw new Error(
                        "El nombre es obligatorio."
                    );
                }


                if (!payload.email) {

                    throw new Error(
                        "El email es obligatorio."
                    );
                }


                // ====================================
                // ACTUALIZAR API
                // ====================================

                const result =
                    await updateUser(
                        id,
                        payload
                    );


                console.log(
                    "✅ Respuesta actualización:",
                    result
                );


                // ====================================
                // MENSAJE
                // ====================================

                const message =
                    document.getElementById(
                        "user-edit-message"
                    );


                if (message) {

                    message.textContent =
                        result.message ||
                        "Usuario actualizado correctamente.";
                }


                showToast(
                    result.message ||
                    "Usuario actualizado correctamente.",
                    "success"
                );


                // ====================================
                // ACTUALIZAR USUARIO SELECCIONADO
                // ====================================

                if (result.user) {

                    currentSelectedUser =
                        result.user;
                }


                // ====================================
                // RECARGAR LISTA
                // ====================================

                await renderUsers();


                // ====================================
                // ACTUALIZAR DETALLE
                // ====================================

                if (currentSelectedUser) {

                    showUserDetail(
                        currentSelectedUser
                    );
                }


            } catch (error) {

                console.error(
                    "❌ Error actualizando usuario:",
                    error
                );


                const message =
                    document.getElementById(
                        "user-edit-message"
                    );


                if (message) {

                    message.textContent =
                        error.message ||
                        "Error actualizando usuario.";
                }


                showToast(
                    error.message ||
                    "Error actualizando usuario.",
                    "error"
                );
            }

        }
    );
}



/*********************
 * MAIN              *
 *********************/
async function main() {

  initEvents();
  initializeUserEditForm();

  await fetchProducts();

  if (isAdmin()) {
    renderProductsAdmin();
  }

  renderCart();

  updateUIForUser();

  if (
    window.location.pathname.includes(
      "success"
    )
  ) {
    loadSuccessPage();
  }

  setActiveTab("catalog");
}

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    main
  );
} else {
  main();
}