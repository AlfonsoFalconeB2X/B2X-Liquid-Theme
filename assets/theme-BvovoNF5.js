// \0vite/preload-helper.js
var scriptRel = "modulepreload";
var assetsURL = function(dep, importerUrl) {
	return new URL(dep, importerUrl).href;
};
var seen = {};
var isCssPreloadUrl = function isCssPreloadUrl(url) {
	return url.pathname.endsWith(".css");
};
var preloadOnce = function preloadOnce(seen, href, preload) {
	if (href in seen) return seen[href];
	const promise = preload();
	if (!promise) {
		seen[href] = void 0;
		return;
	}
	const preloadPromise = promise.then(() => {
		seen[href] = void 0;
	}, (err) => {
		seen[href] = void 0;
		throw err;
	});
	seen[href] = preloadPromise;
	return preloadPromise;
};
var __vitePreload = function preload(baseModule, deps, importerUrl) {
	let promise = Promise.resolve();
	if (deps && deps.length > 0) {
		let preloadedHrefs;
		const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
		const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
		function allSettled(promises) {
			return Promise.all(promises.map((p) => Promise.resolve(p).then((value) => ({
				status: "fulfilled",
				value
			}), (reason) => ({
				status: "rejected",
				reason
			}))));
		}
		function importMetaResolve(specifier) {
			if (import.meta.resolve) return new URL(import.meta.resolve(specifier));
			return new URL(
				specifier,
				/** #__KEEP__ */
				import.meta.url
			);
		}
		promise = allSettled(deps.map((depString) => {
			depString = assetsURL(depString, importerUrl);
			const dep = importMetaResolve(depString);
			const isCss = isCssPreloadUrl(dep);
			return preloadOnce(seen, dep.href, () => {
				if (preloadedHrefs === void 0) {
					preloadedHrefs = {
						all: /* @__PURE__ */ new Set(),
						styles: /* @__PURE__ */ new Set()
					};
					const links = document.getElementsByTagName("link");
					for (let i = links.length - 1; i >= 0; i--) {
						const link = links[i];
						preloadedHrefs.all.add(link.href);
						if (link.rel === "stylesheet") preloadedHrefs.styles.add(link.href);
					}
				}
				if ((isCss ? preloadedHrefs.styles : preloadedHrefs.all).has(dep.href)) return;
				const link = document.createElement("link");
				link.rel = isCss ? "stylesheet" : scriptRel;
				if (!isCss) link.as = "script";
				link.crossOrigin = "";
				link.href = dep.href;
				if (cspNonce) link.setAttribute("nonce", cspNonce);
				document.head.appendChild(link);
				if (isCss) return new Promise((res, rej) => {
					const handleSettle = (e) => {
						link.removeEventListener("load", handleSettle);
						link.removeEventListener("error", handleSettle);
						if (e.type === "error") rej(/* @__PURE__ */ new Error(`Unable to preload CSS for ${dep}`));
						else res(e);
					};
					link.addEventListener("load", handleSettle);
					link.addEventListener("error", handleSettle);
				});
			});
		}).filter((p) => p !== void 0));
	}
	function handlePreloadError(err) {
		const e = new Event("vite:preloadError", { cancelable: true });
		e.payload = err;
		window.dispatchEvent(e);
		if (!e.defaultPrevented) throw err;
	}
	return promise.then((res) => {
		for (const item of res || []) {
			if (item.status !== "rejected") continue;
			handlePreloadError(item.reason);
		}
		return baseModule().catch(handlePreloadError);
	});
};
// frontend/entrypoints/theme.js
var config = window.theme || {
	routes: {},
	strings: {}
};
var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
var designMode = Boolean(window.Shopify?.designMode);
var define = (name, constructor) => {
	if (!customElements.get(name)) customElements.define(name, constructor);
};
var debounce = (fn, wait = 300) => {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), wait);
	};
};
var parseHTML = (html) => new DOMParser().parseFromString(html, "text/html");
/**
* Mostra un messaggio breve per gli esiti senza un posto vicino in pagina (es. codice sconto applicato).
* Dentro un <dialog> modale il contenitore va nel dialog: fuori sarebbe inerte e nascosto dal velo.
*/
function showToast(message, { tone = "info" } = {}) {
	if (!message) return;
	const host = document.querySelector("dialog[open]") || document.body;
	let region = host.querySelector(":scope > .toasts");
	if (!region) {
		region = document.createElement("div");
		region.className = "toasts";
		region.setAttribute("role", "status");
		region.setAttribute("aria-live", "polite");
		host.append(region);
	}
	const toast = document.createElement("p");
	toast.className = `toast toast--${tone}`;
	toast.textContent = message;
	region.append(toast);
	setTimeout(() => {
		toast.classList.add("is-leaving");
		setTimeout(() => toast.remove(), 300);
	}, 4e3);
}
window.themeToast = showToast;
/** Section da riaggiornare dopo ogni modifica al carrello: tutte quelle marcate con data-cart-section. */
function cartSections() {
	const ids = /* @__PURE__ */ new Set(["cart-icon-bubble"]);
	document.querySelectorAll("[data-cart-section]").forEach((el) => ids.add(el.dataset.cartSection));
	return [...ids];
}
var cartCount = () => Number(document.querySelector(".cart-count")?.textContent || 0);
/** Sostituisce il contenuto degli elementi data-cart-section con l'HTML restituito dalla Section Rendering API. */
function renderCartSections(sections) {
	if (!sections) return;
	const activeId = document.activeElement?.id;
	const previousCount = cartCount();
	const previousProgress = document.querySelector("[data-free-shipping]")?.style.getPropertyValue("--progress");
	Object.entries(sections).forEach(([id, html]) => {
		if (!html) return;
		const source = parseHTML(html).querySelector(`[data-cart-section="${id}"]`);
		if (!source) return;
		document.querySelectorAll(`[data-cart-section="${id}"]`).forEach((target) => {
			target.innerHTML = source.innerHTML;
		});
	});
	if (previousProgress) document.querySelectorAll("[data-free-shipping]").forEach((bar) => {
		const next = bar.style.getPropertyValue("--progress");
		bar.style.setProperty("--progress", previousProgress);
		requestAnimationFrame(() => requestAnimationFrame(() => bar.style.setProperty("--progress", next)));
	});
	if (cartCount() > previousCount && !reducedMotion.matches) document.querySelectorAll(".cart-count").forEach((badge) => badge.classList.add("is-bumped"));
	if (activeId && !document.getElementById(activeId)) (document.querySelector("dialog[open] [data-cart-focus-fallback]") || document.querySelector("[data-cart-focus-fallback]"))?.focus();
	else if (activeId) document.getElementById(activeId)?.focus();
}
async function cartRequest(url, body, { render = true } = {}) {
	const isForm = body instanceof FormData;
	if (isForm && render) {
		body.append("sections", cartSections().join(","));
		body.append("sections_url", window.location.pathname);
	}
	const payload = isForm ? body : JSON.stringify(render ? {
		...body,
		sections: cartSections(),
		sections_url: window.location.pathname
	} : body);
	const response = await fetch(url, {
		method: "POST",
		headers: isForm ? {
			Accept: "application/json",
			"X-Requested-With": "XMLHttpRequest"
		} : {
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: payload
	});
	let data = {};
	try {
		data = await response.json();
	} catch {}
	if (!response.ok) throw new Error(data.description || data.message || config.strings.cartError);
	return data;
}
var announce = (detail) => document.dispatchEvent(new CustomEvent("cart:updated", { detail }));
var cart = {
	async add(formData) {
		const data = await cartRequest(`${config.routes.cartAdd}.js`, formData);
		renderCartSections(data.sections);
		announce({
			source: "add",
			item: data
		});
		return data;
	},
	async change(line, quantity) {
		const data = await cartRequest(`${config.routes.cartChange}.js`, {
			line,
			quantity
		});
		renderCartSections(data.sections);
		announce({
			source: "change",
			cart: data
		});
		return data;
	},
	/** Nota, attributi, codici sconto. Con render: false non ridisegna nulla (es. mentre il cliente scrive). */
	async update(body, { render = true } = {}) {
		const data = await cartRequest(`${config.routes.cartUpdate}.js`, body, { render });
		if (render) renderCartSections(data.sections);
		announce({
			source: "update",
			cart: data
		});
		return data;
	}
};
window.themeCart = cart;
/** Cassetto del carrello: <dialog> modale (focus intrappolato e resto della pagina inerte in modo nativo). */
var CartDrawer = class extends HTMLElement {
	connectedCallback() {
		this.dialog = this.querySelector("dialog");
		this.dialog.addEventListener("click", (event) => {
			if (event.target === this.dialog || event.target.closest("[data-cart-close]")) this.close();
		});
		this.dialog.addEventListener("close", () => this.opener?.focus?.());
	}
	open(opener) {
		if (this.dialog.open) return;
		this.opener = opener || document.activeElement;
		this.dialog.showModal();
	}
	close() {
		this.dialog.close();
	}
};
define("cart-drawer", CartDrawer);
var getCartDrawer = () => document.querySelector("cart-drawer");
document.addEventListener("click", (event) => {
	const toggle = event.target.closest("[data-cart-toggle]");
	const drawer = getCartDrawer();
	if (!toggle || !drawer) return;
	event.preventDefault();
	drawer.open(toggle);
});
document.addEventListener("animationend", (event) => {
	if (event.target.classList?.contains("is-bumped")) event.target.classList.remove("is-bumped");
});
var updateLine = async (lineEl, quantity) => {
	const line = Number(lineEl.dataset.line);
	const error = lineEl.querySelector("[data-line-error]");
	lineEl.setAttribute("aria-busy", "true");
	try {
		await cart.change(line, quantity);
	} catch (err) {
		lineEl.removeAttribute("aria-busy");
		if (error) {
			error.textContent = err.message;
			error.hidden = false;
		}
	}
};
var lineTimers = /* @__PURE__ */ new Map();
document.addEventListener("change", (event) => {
	const input = event.target.closest(".cart-line .quantity__input");
	if (!input) return;
	const lineEl = input.closest(".cart-line");
	const key = lineEl.id;
	clearTimeout(lineTimers.get(key));
	lineTimers.set(key, setTimeout(() => {
		lineTimers.delete(key);
		updateLine(document.getElementById(key) || lineEl, Math.max(0, Number(input.value) || 0));
	}, 350));
});
document.addEventListener("click", (event) => {
	const remove = event.target.closest("[data-line-remove]");
	if (!remove) return;
	event.preventDefault();
	updateLine(remove.closest(".cart-line"), 0);
});
var CartDiscount = class extends HTMLElement {
	connectedCallback() {
		this.addEventListener("submit", (event) => {
			if (!event.target.matches("[data-discount-form]")) return;
			event.preventDefault();
			const code = event.target.querySelector("input[name=\"discount\"]").value.trim();
			if (code) this.apply([...this.codes(), code], code);
		});
		this.addEventListener("click", (event) => {
			const remove = event.target.closest("[data-discount-remove]");
			if (!remove) return;
			const code = remove.dataset.discountRemove;
			this.apply(this.codes().filter((existing) => existing !== code), null);
		});
	}
	codes() {
		return [...this.querySelectorAll("[data-discount-remove]")].map((el) => el.dataset.discountRemove);
	}
	async apply(codes, added) {
		const button = this.querySelector("[data-discount-form] button");
		const error = this.querySelector("[data-discount-error]");
		button?.setAttribute("aria-busy", "true");
		if (error) error.hidden = true;
		try {
			await cart.update({ discount: [...new Set(codes)].join(",") });
			if (added) {
				const scope = document.querySelector("dialog[open] cart-discount") || document.querySelector("cart-discount");
				const chip = scope?.querySelector(`[data-discount-remove="${CSS.escape(added)}" i]`);
				if (!chip || chip.dataset.applicable === "false") {
					const message = (config.strings.discountInvalid || "").replace("[code]", added);
					const target = scope?.querySelector("[data-discount-error]");
					if (target) {
						target.textContent = message;
						target.hidden = false;
					} else showToast(message, { tone: "error" });
					return;
				}
				showToast((config.strings.discountApplied || "").replace("[code]", added), { tone: "success" });
			}
		} catch (err) {
			if (error) {
				error.textContent = err.message;
				error.hidden = false;
			}
		} finally {
			button?.removeAttribute("aria-busy");
		}
	}
};
define("cart-discount", CartDiscount);
var CartNote = class extends HTMLElement {
	connectedCallback() {
		this.save = debounce((field) => this.persist(field), 500);
		this.addEventListener("input", (event) => {
			if (event.target.matches("textarea, input[type=\"text\"]")) this.save(event.target);
		});
		this.addEventListener("change", (event) => {
			if (event.target.matches("input[type=\"checkbox\"]")) this.persist(event.target);
		});
	}
	async persist(field) {
		const status = this.querySelector("[data-note-status]");
		let body;
		if (field.name === "note") body = { note: field.value };
		else {
			const key = field.dataset.attribute;
			const value = field.type === "checkbox" ? field.checked ? field.value : "" : field.value;
			body = { attributes: { [key]: value } };
		}
		try {
			await cart.update(body, { render: false });
			if (status) {
				status.textContent = config.strings.saved || "";
				clearTimeout(this.statusTimer);
				this.statusTimer = setTimeout(() => {
					status.textContent = "";
				}, 2e3);
			}
		} catch (err) {
			showToast(err.message, { tone: "error" });
		}
	}
};
define("cart-note", CartNote);
var QuantityInput = class extends HTMLElement {
	connectedCallback() {
		this.input = this.querySelector("input");
		this.addEventListener("click", (event) => {
			const button = event.target.closest("[data-quantity]");
			if (!button) return;
			const step = Number(this.input.step) || 1;
			const min = Number(this.input.min) || 0;
			const max = this.input.max ? Number(this.input.max) : Infinity;
			const current = Number(this.input.value) || 0;
			const next = button.dataset.quantity === "plus" ? current + step : current - step;
			const value = Math.min(max, Math.max(min, next));
			if (value === current) return;
			this.input.value = value;
			this.input.dispatchEvent(new Event("change", { bubbles: true }));
		});
	}
};
define("quantity-input", QuantityInput);
var ProductForm = class extends HTMLElement {
	connectedCallback() {
		this.form = this.querySelector("form");
		this.form?.addEventListener("submit", (event) => this.onSubmit(event));
	}
	async onSubmit(event) {
		const drawer = getCartDrawer();
		if (config.cartType !== "drawer" || !drawer) return;
		event.preventDefault();
		const button = event.submitter || this.form.querySelector("[type=\"submit\"]");
		const error = this.querySelector("[data-form-error]");
		if (button?.getAttribute("aria-busy") === "true") return;
		button?.setAttribute("aria-busy", "true");
		if (error) error.hidden = true;
		try {
			await cart.add(new FormData(this.form));
			const dialog = this.closest("dialog");
			const opener = dialog?.returnFocusTo || button;
			if (dialog) {
				dialog.returnFocusTo = null;
				dialog.close();
			}
			drawer.open(opener);
		} catch (err) {
			if (error) {
				error.textContent = err.message;
				error.hidden = false;
			}
		} finally {
			button?.removeAttribute("aria-busy");
		}
	}
};
define("product-form", ProductForm);
document.addEventListener("click", async (event) => {
	const trigger = event.target.closest("[data-quick-view]");
	if (!trigger) return;
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
	event.preventDefault();
	const { openQuickView } = await __vitePreload(async () => {
		const { openQuickView } = await import("./quick-view-CzsS9Wh4.js");
		return { openQuickView };
	}, [], import.meta.url);
	openQuickView(trigger.getAttribute("href") || trigger.dataset.quickView, trigger);
});
var selectSwatch = (swatch) => {
	const card = swatch.closest(".card");
	if (!card) return;
	const image = card.querySelector(".card__image:not(.card__image--secondary)");
	if (image && swatch.dataset.src) {
		image.srcset = swatch.dataset.srcset || "";
		image.src = swatch.dataset.src;
		card.classList.add("card--swatch-selected");
	}
	if (swatch.dataset.url) card.querySelectorAll(".card__link, [data-quick-view]").forEach((link) => link.setAttribute("href", swatch.dataset.url));
	card.querySelectorAll("[data-card-swatch]").forEach((el) => el.setAttribute("aria-pressed", String(el === swatch)));
};
document.addEventListener("click", (event) => {
	const swatch = event.target.closest("[data-card-swatch]");
	if (swatch) selectSwatch(swatch);
});
document.addEventListener("pointerover", (event) => {
	if (event.pointerType !== "mouse") return;
	const swatch = event.target.closest?.("[data-card-swatch]");
	if (swatch) selectSwatch(swatch);
});
var dropdowns = () => document.querySelectorAll("details[data-menu-dropdown]");
var hoverQuery = window.matchMedia("(hover: hover) and (min-width: 990px)");
document.addEventListener("toggle", (event) => {
	const details = event.target;
	if (!(details instanceof HTMLDetailsElement) || !details.matches("[data-menu-dropdown]") || !details.open) return;
	dropdowns().forEach((other) => {
		if (other !== details) other.open = false;
	});
}, true);
document.addEventListener("click", (event) => {
	const summary = event.target.closest("details[data-menu-dropdown] > summary");
	if (summary && summary.parentElement.open && summary.parentElement._hoverOpened) {
		event.preventDefault();
		summary.parentElement._hoverOpened = false;
	}
	dropdowns().forEach((details) => {
		if (details.open && !details.contains(event.target)) details.open = false;
	});
});
document.addEventListener("keydown", (event) => {
	if (event.key !== "Escape") return;
	dropdowns().forEach((details) => {
		if (!details.open) return;
		details.open = false;
		details.querySelector("summary")?.focus();
	});
});
document.addEventListener("focusout", (event) => {
	const details = event.target.closest?.("details[data-menu-dropdown]");
	if (details && event.relatedTarget && !details.contains(event.relatedTarget)) details.open = false;
});
document.addEventListener("pointerover", (event) => {
	if (!hoverQuery.matches || event.pointerType !== "mouse") return;
	const details = event.target.closest?.("details[data-menu-dropdown]");
	if (!details) return;
	clearTimeout(details._closeTimer);
	if (!details.open) {
		details.open = true;
		details._hoverOpened = true;
	}
});
document.addEventListener("pointerout", (event) => {
	if (!hoverQuery.matches || event.pointerType !== "mouse") return;
	const details = event.target.closest?.("details[data-menu-dropdown]");
	if (!details || details.contains(event.relatedTarget)) return;
	details._closeTimer = setTimeout(() => {
		details.open = false;
		details._hoverOpened = false;
	}, 180);
});
function initHeaderScroll() {
	const header = document.querySelector(".header-wrapper--sticky");
	const section = header?.closest(".shopify-section");
	if (!section || section.dataset.scrollReady) return;
	section.dataset.scrollReady = "true";
	const hides = header.classList.contains("header-wrapper--hide-on-scroll");
	let lastY = window.scrollY;
	let ticking = false;
	const isBusy = () => header.querySelector("details[open]") || document.querySelector("[popover]:popover-open, dialog[open]");
	const update = () => {
		ticking = false;
		const y = window.scrollY;
		section.toggleAttribute("data-header-scrolled", y > 4);
		if (hides) {
			if (y > lastY && y > section.offsetHeight * 2 && !isBusy()) section.setAttribute("data-header-hidden", "");
			else if (y < lastY - 4 || y <= section.offsetHeight) section.removeAttribute("data-header-hidden");
		}
		lastY = y;
	};
	window.addEventListener("scroll", () => {
		if (!ticking) {
			ticking = true;
			requestAnimationFrame(update);
		}
	}, { passive: true });
	section.addEventListener("focusin", () => section.removeAttribute("data-header-hidden"));
	update();
}
var revealObserver;
function initReveal(root = document) {
	if (!document.body.classList.contains("reveal-on") || reducedMotion.matches || designMode) return;
	if (!("IntersectionObserver" in window)) return;
	document.documentElement.classList.add("reveal-ready");
	const scrollerSelector = ".grid--slider, .carousel__track, .ticker__group";
	revealObserver ||= new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;
			(entry.target.matches(scrollerSelector) ? entry.target.querySelectorAll(":scope > .reveal") : [entry.target]).forEach((el) => el.classList.add("is-visible"));
			revealObserver.unobserve(entry.target);
		});
	}, {
		rootMargin: "0px 0px -8% 0px",
		threshold: .1
	});
	root.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => {
		const siblings = [...el.parentElement.children].filter((child) => child.classList.contains("reveal"));
		el.style.setProperty("--reveal-index", String(Math.min(siblings.indexOf(el), 6)));
		const scroller = el.parentElement.closest(scrollerSelector);
		revealObserver.observe(scroller && scroller === el.parentElement ? scroller : el);
	});
}
var PredictiveSearch = class extends HTMLElement {
	connectedCallback() {
		this.input = this.querySelector("input[type=\"search\"]");
		this.results = this.querySelector("[data-predictive-results]");
		this.status = this.querySelector("[data-predictive-status]");
		this.controller = null;
		this.closest("[popover]")?.addEventListener("toggle", (event) => {
			if (event.newState === "open") this.input.focus();
		});
		if (!this.hasAttribute("data-enabled")) return;
		this.input.addEventListener("input", debounce(() => this.search(this.input.value.trim()), 250));
	}
	async search(term) {
		this.controller?.abort();
		if (!term) {
			this.results.innerHTML = "";
			this.status.textContent = "";
			return;
		}
		this.controller = new AbortController();
		const params = new URLSearchParams({
			q: term,
			section_id: "predictive-search",
			"resources[limit]": "6",
			"resources[limit_scope]": "each"
		});
		this.results.setAttribute("aria-busy", "true");
		try {
			const response = await fetch(`${config.routes.predictiveSearch}?${params}`, { signal: this.controller.signal });
			if (!response.ok) throw new Error(response.status);
			const content = parseHTML(await response.text()).querySelector("[data-predictive-content]");
			this.results.innerHTML = content ? content.innerHTML : "";
			const count = content?.dataset.count || "0";
			this.status.textContent = (config.strings.searchResults || "").replace("[count]", count);
		} catch (err) {
			if (err.name !== "AbortError") this.results.innerHTML = "";
		} finally {
			this.results.removeAttribute("aria-busy");
		}
	}
};
define("predictive-search", PredictiveSearch);
var AnnouncementBar = class extends HTMLElement {
	connectedCallback() {
		this.track = this.querySelector(".announcement__track");
		this.addEventListener("click", (event) => {
			const button = event.target.closest("[data-direction]");
			if (!button) return;
			const direction = Number(button.dataset.direction);
			const width = this.track.clientWidth;
			const max = this.track.scrollWidth - width;
			let next = this.track.scrollLeft + direction * width;
			if (next > max + 1) next = 0;
			if (next < -1) next = max;
			this.track.scrollTo({
				left: next,
				behavior: "smooth"
			});
		});
	}
};
define("announcement-bar", AnnouncementBar);
var TickerStrip = class extends HTMLElement {
	connectedCallback() {
		this.track = this.querySelector("[data-ticker-track]");
		this.group = this.querySelector("[data-ticker-group]");
		this.toggle = this.querySelector("[data-ticker-toggle]");
		if (!this.track || !this.group) return;
		this.toggle?.addEventListener("click", () => this.setPaused(!this.hasAttribute("data-paused")));
		if (reducedMotion.matches) return;
		const originals = [...this.group.children];
		let guard = 0;
		while (this.group.scrollWidth < this.clientWidth && originals.length && guard < 12) {
			originals.forEach((item) => this.group.append(this.hiddenClone(item)));
			guard += 1;
		}
		const copy = this.hiddenClone(this.group);
		copy.removeAttribute("data-ticker-group");
		this.track.append(copy);
		const speed = Number(this.dataset.speed) || 40;
		this.style.setProperty("--ticker-duration", `${(this.group.scrollWidth / speed).toFixed(2)}s`);
		this.setAttribute("data-ready", "");
	}
	hiddenClone(node) {
		const clone = node.cloneNode(true);
		clone.setAttribute("aria-hidden", "true");
		clone.querySelectorAll("a, button").forEach((el) => el.setAttribute("tabindex", "-1"));
		if (clone.matches("a, button")) clone.setAttribute("tabindex", "-1");
		return clone;
	}
	setPaused(paused) {
		this.toggleAttribute("data-paused", paused);
		if (!this.toggle) return;
		this.toggle.setAttribute("aria-pressed", String(paused));
		this.toggle.setAttribute("aria-label", paused ? this.toggle.dataset.labelPlay : this.toggle.dataset.labelPause);
	}
};
define("ticker-strip", TickerStrip);
var ProductRecommendations = class extends HTMLElement {
	connectedCallback() {
		const observer = new IntersectionObserver((entries) => {
			if (!entries[0].isIntersecting) return;
			observer.disconnect();
			this.load();
		}, { rootMargin: "0px 0px 400px 0px" });
		observer.observe(this);
	}
	async load() {
		try {
			const content = parseHTML(await (await fetch(this.dataset.url)).text()).querySelector("product-recommendations");
			if (content && content.querySelector("[data-recommendations-list]")) {
				this.innerHTML = content.innerHTML;
				initReveal(this);
			} else this.closest(".shopify-section")?.setAttribute("hidden", "");
		} catch {
			this.closest(".shopify-section")?.setAttribute("hidden", "");
		}
	}
};
define("product-recommendations", ProductRecommendations);
var DeferredMedia = class extends HTMLElement {
	connectedCallback() {
		this.querySelector("[data-deferred-play]")?.addEventListener("click", () => {
			const template = this.querySelector("template");
			if (!template) return;
			const content = template.content.firstElementChild.cloneNode(true);
			this.replaceChildren(content);
			if (content.tagName === "VIDEO") content.play?.();
			content.focus?.();
		});
	}
};
define("deferred-media", DeferredMedia);
document.addEventListener("change", (event) => {
	const select = event.target.closest("select[data-autosubmit]");
	if (select) select.form?.submit();
});
initHeaderScroll();
initReveal();
document.addEventListener("shopify:section:load", (event) => {
	document.querySelectorAll("[popover]:popover-open").forEach((el) => el.hidePopover());
	initHeaderScroll();
	initReveal(event.target);
});
export { __vitePreload as t };


//# sourceMappingURL=data:application/json;base64,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ZTtHQUMxRSxNQUFNLFdBQVcsS0FBSyxjQUFjLFVBQVU7R0FDOUMsSUFBSSxDQUFDLFVBQVU7R0FDZixNQUFNLFVBQVUsU0FBUyxRQUFRLGtCQUFrQixVQUFVLElBQUk7R0FDakUsS0FBSyxnQkFBZ0IsT0FBTztHQUM1QixJQUFJLFFBQVEsWUFBWSxTQUFTLFFBQVEsT0FBTztHQUNoRCxRQUFRLFFBQVE7RUFDbEIsQ0FBQztDQUNIO0FBQ0Y7QUFDQSxPQUFPLGtCQUFrQixhQUFhO0FBR3RDLFNBQVMsaUJBQWlCLFdBQVcsVUFBVTtDQUM3QyxNQUFNLFNBQVMsTUFBTSxPQUFPLFFBQVEseUJBQXlCO0NBQzdELElBQUksUUFBUSxPQUFPLE1BQU0sT0FBTztBQUNsQyxDQUFDO0FBR0QsaUJBQWlCO0FBQ2pCLFdBQVc7QUFFWCxTQUFTLGlCQUFpQix5QkFBeUIsVUFBVTtDQUMzRCxTQUFTLGlCQUFpQix3QkFBd0IsQ0FBQyxDQUFDLFNBQVMsT0FBTyxHQUFHLFlBQVksQ0FBQztDQUNwRixpQkFBaUI7Q0FDakIsV0FBVyxNQUFNLE1BQU07QUFDekIsQ0FBQyIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiLi4vZnJvbnRlbmQvZW50cnlwb2ludHMvdGhlbWUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIHRoZW1lLmpzIOKAlCBKYXZhU2NyaXB0IGdsb2JhbGUgKG1vZHVsbyBFUywgY2FyaWNhdG8gaW4gZGlmZmVyaXRhIGRhbCBsYXlvdXQpLlxuICogQ29tcG9uZW50aSBjb21lIGN1c3RvbSBlbGVtZW50czogc2kgaW5pemlhbGl6emFubyBkYSBzb2xpIGFuY2hlIHF1YW5kbyBpbCB0aGVtZSBlZGl0b3IgcmljYXJpY2EgdW5hIHNlY3Rpb24uXG4gKiBDb25maWd1cmF6aW9uZSBkYSB3aW5kb3cudGhlbWUgKHJvdXRlcywgdGlwbyBkaSBjYXJyZWxsbywgdGVzdGkpLCBkZWZpbml0YSBpbiBsYXlvdXQvdGhlbWUubGlxdWlkLlxuICovXG5cbmNvbnN0IGNvbmZpZyA9IHdpbmRvdy50aGVtZSB8fCB7IHJvdXRlczoge30sIHN0cmluZ3M6IHt9IH07XG5jb25zdCByZWR1Y2VkTW90aW9uID0gd2luZG93Lm1hdGNoTWVkaWEoJyhwcmVmZXJzLXJlZHVjZWQtbW90aW9uOiByZWR1Y2UpJyk7XG5jb25zdCBkZXNpZ25Nb2RlID0gQm9vbGVhbih3aW5kb3cuU2hvcGlmeT8uZGVzaWduTW9kZSk7XG5cbmNvbnN0IGRlZmluZSA9IChuYW1lLCBjb25zdHJ1Y3RvcikgPT4ge1xuICBpZiAoIWN1c3RvbUVsZW1lbnRzLmdldChuYW1lKSkgY3VzdG9tRWxlbWVudHMuZGVmaW5lKG5hbWUsIGNvbnN0cnVjdG9yKTtcbn07XG5cbmNvbnN0IGRlYm91bmNlID0gKGZuLCB3YWl0ID0gMzAwKSA9PiB7XG4gIGxldCB0aW1lcjtcbiAgcmV0dXJuICguLi5hcmdzKSA9PiB7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4gZm4oLi4uYXJncyksIHdhaXQpO1xuICB9O1xufTtcblxuY29uc3QgcGFyc2VIVE1MID0gKGh0bWwpID0+IG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcoaHRtbCwgJ3RleHQvaHRtbCcpO1xuXG4vKiAtLS0tLS0tLS0tIE5vdGlmaWNoZSBicmV2aSAodG9hc3QpIC0tLS0tLS0tLS0gKi9cblxuLyoqXG4gKiBNb3N0cmEgdW4gbWVzc2FnZ2lvIGJyZXZlIHBlciBnbGkgZXNpdGkgc2VuemEgdW4gcG9zdG8gdmljaW5vIGluIHBhZ2luYSAoZXMuIGNvZGljZSBzY29udG8gYXBwbGljYXRvKS5cbiAqIERlbnRybyB1biA8ZGlhbG9nPiBtb2RhbGUgaWwgY29udGVuaXRvcmUgdmEgbmVsIGRpYWxvZzogZnVvcmkgc2FyZWJiZSBpbmVydGUgZSBuYXNjb3N0byBkYWwgdmVsby5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlLCB7IHRvbmUgPSAnaW5mbycgfSA9IHt9KSB7XG4gIGlmICghbWVzc2FnZSkgcmV0dXJuO1xuICBjb25zdCBob3N0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignZGlhbG9nW29wZW5dJykgfHwgZG9jdW1lbnQuYm9keTtcbiAgbGV0IHJlZ2lvbiA9IGhvc3QucXVlcnlTZWxlY3RvcignOnNjb3BlID4gLnRvYXN0cycpO1xuICBpZiAoIXJlZ2lvbikge1xuICAgIHJlZ2lvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHJlZ2lvbi5jbGFzc05hbWUgPSAndG9hc3RzJztcbiAgICByZWdpb24uc2V0QXR0cmlidXRlKCdyb2xlJywgJ3N0YXR1cycpO1xuICAgIHJlZ2lvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGl2ZScsICdwb2xpdGUnKTtcbiAgICBob3N0LmFwcGVuZChyZWdpb24pO1xuICB9XG4gIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO1xuICB0b2FzdC5jbGFzc05hbWUgPSBgdG9hc3QgdG9hc3QtLSR7dG9uZX1gO1xuICB0b2FzdC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gIHJlZ2lvbi5hcHBlbmQodG9hc3QpO1xuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICB0b2FzdC5jbGFzc0xpc3QuYWRkKCdpcy1sZWF2aW5nJyk7XG4gICAgc2V0VGltZW91dCgoKSA9PiB0b2FzdC5yZW1vdmUoKSwgMzAwKTtcbiAgfSwgNDAwMCk7XG59XG5cbndpbmRvdy50aGVtZVRvYXN0ID0gc2hvd1RvYXN0O1xuXG4vKiAtLS0tLS0tLS0tIENhcnJlbGxvIC0tLS0tLS0tLS0gKi9cblxuLyoqIFNlY3Rpb24gZGEgcmlhZ2dpb3JuYXJlIGRvcG8gb2duaSBtb2RpZmljYSBhbCBjYXJyZWxsbzogdHV0dGUgcXVlbGxlIG1hcmNhdGUgY29uIGRhdGEtY2FydC1zZWN0aW9uLiAqL1xuZnVuY3Rpb24gY2FydFNlY3Rpb25zKCkge1xuICBjb25zdCBpZHMgPSBuZXcgU2V0KFsnY2FydC1pY29uLWJ1YmJsZSddKTtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtY2FydC1zZWN0aW9uXScpLmZvckVhY2goKGVsKSA9PiBpZHMuYWRkKGVsLmRhdGFzZXQuY2FydFNlY3Rpb24pKTtcbiAgcmV0dXJuIFsuLi5pZHNdO1xufVxuXG5jb25zdCBjYXJ0Q291bnQgPSAoKSA9PiBOdW1iZXIoZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNhcnQtY291bnQnKT8udGV4dENvbnRlbnQgfHwgMCk7XG5cbi8qKiBTb3N0aXR1aXNjZSBpbCBjb250ZW51dG8gZGVnbGkgZWxlbWVudGkgZGF0YS1jYXJ0LXNlY3Rpb24gY29uIGwnSFRNTCByZXN0aXR1aXRvIGRhbGxhIFNlY3Rpb24gUmVuZGVyaW5nIEFQSS4gKi9cbmZ1bmN0aW9uIHJlbmRlckNhcnRTZWN0aW9ucyhzZWN0aW9ucykge1xuICBpZiAoIXNlY3Rpb25zKSByZXR1cm47XG4gIGNvbnN0IGFjdGl2ZUlkID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudD8uaWQ7XG4gIGNvbnN0IHByZXZpb3VzQ291bnQgPSBjYXJ0Q291bnQoKTtcbiAgY29uc3QgcHJldmlvdXNQcm9ncmVzcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWZyZWUtc2hpcHBpbmddJyk/LnN0eWxlLmdldFByb3BlcnR5VmFsdWUoJy0tcHJvZ3Jlc3MnKTtcblxuICBPYmplY3QuZW50cmllcyhzZWN0aW9ucykuZm9yRWFjaCgoW2lkLCBodG1sXSkgPT4ge1xuICAgIGlmICghaHRtbCkgcmV0dXJuO1xuICAgIGNvbnN0IHNvdXJjZSA9IHBhcnNlSFRNTChodG1sKS5xdWVyeVNlbGVjdG9yKGBbZGF0YS1jYXJ0LXNlY3Rpb249XCIke2lkfVwiXWApO1xuICAgIGlmICghc291cmNlKSByZXR1cm47XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChgW2RhdGEtY2FydC1zZWN0aW9uPVwiJHtpZH1cIl1gKS5mb3JFYWNoKCh0YXJnZXQpID0+IHtcbiAgICAgIHRhcmdldC5pbm5lckhUTUwgPSBzb3VyY2UuaW5uZXJIVE1MO1xuICAgIH0pO1xuICB9KTtcblxuICAvLyBMYSBiYXJyYSBkZWxsYSBzcGVkaXppb25lIGdyYXR1aXRhIHJpcGFydGUgZGFsIHZhbG9yZSBwcmVjZWRlbnRlLCBjb3PDrCBsJ2F2YW56YW1lbnRvIHNpIHZlZGUuXG4gIGlmIChwcmV2aW91c1Byb2dyZXNzKSB7XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtZnJlZS1zaGlwcGluZ10nKS5mb3JFYWNoKChiYXIpID0+IHtcbiAgICAgIGNvbnN0IG5leHQgPSBiYXIuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnLS1wcm9ncmVzcycpO1xuICAgICAgYmFyLnN0eWxlLnNldFByb3BlcnR5KCctLXByb2dyZXNzJywgcHJldmlvdXNQcm9ncmVzcyk7XG4gICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IGJhci5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1wcm9ncmVzcycsIG5leHQpKSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBJbCBjb250YXRvcmUgZGVsIGNhcnJlbGxvIFwicHVsc2FcIiBxdWFuZG8gYXVtZW50YS5cbiAgaWYgKGNhcnRDb3VudCgpID4gcHJldmlvdXNDb3VudCAmJiAhcmVkdWNlZE1vdGlvbi5tYXRjaGVzKSB7XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmNhcnQtY291bnQnKS5mb3JFYWNoKChiYWRnZSkgPT4gYmFkZ2UuY2xhc3NMaXN0LmFkZCgnaXMtYnVtcGVkJykpO1xuICB9XG5cbiAgLy8gU2UgbCdlbGVtZW50byBjb24gaWwgZm9jdXMgbm9uIGVzaXN0ZSBwacO5IChlcy4gcmlnYSByaW1vc3NhKSBpbCBmb2N1cyB2YSBzdSB1biBwdW50byBzdGFiaWxlLlxuICBpZiAoYWN0aXZlSWQgJiYgIWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGFjdGl2ZUlkKSkge1xuICAgIGNvbnN0IGZhbGxiYWNrID1cbiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2RpYWxvZ1tvcGVuXSBbZGF0YS1jYXJ0LWZvY3VzLWZhbGxiYWNrXScpIHx8XG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1jYXJ0LWZvY3VzLWZhbGxiYWNrXScpO1xuICAgIGZhbGxiYWNrPy5mb2N1cygpO1xuICB9IGVsc2UgaWYgKGFjdGl2ZUlkKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYWN0aXZlSWQpPy5mb2N1cygpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNhcnRSZXF1ZXN0KHVybCwgYm9keSwgeyByZW5kZXIgPSB0cnVlIH0gPSB7fSkge1xuICBjb25zdCBpc0Zvcm0gPSBib2R5IGluc3RhbmNlb2YgRm9ybURhdGE7XG4gIGlmIChpc0Zvcm0gJiYgcmVuZGVyKSB7XG4gICAgYm9keS5hcHBlbmQoJ3NlY3Rpb25zJywgY2FydFNlY3Rpb25zKCkuam9pbignLCcpKTtcbiAgICBib2R5LmFwcGVuZCgnc2VjdGlvbnNfdXJsJywgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lKTtcbiAgfVxuICBjb25zdCBwYXlsb2FkID0gaXNGb3JtXG4gICAgPyBib2R5XG4gICAgOiBKU09OLnN0cmluZ2lmeShyZW5kZXIgPyB7IC4uLmJvZHksIHNlY3Rpb25zOiBjYXJ0U2VjdGlvbnMoKSwgc2VjdGlvbnNfdXJsOiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgfSA6IGJvZHkpO1xuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgaGVhZGVyczogaXNGb3JtXG4gICAgICA/IHsgQWNjZXB0OiAnYXBwbGljYXRpb24vanNvbicsICdYLVJlcXVlc3RlZC1XaXRoJzogJ1hNTEh0dHBSZXF1ZXN0JyB9XG4gICAgICA6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJywgQWNjZXB0OiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICBib2R5OiBwYXlsb2FkLFxuICB9KTtcbiAgbGV0IGRhdGEgPSB7fTtcbiAgdHJ5IHtcbiAgICBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICB9IGNhdGNoIHtcbiAgICAvLyByaXNwb3N0YSBub24gSlNPTjogZ2VzdGl0YSBzb3R0byBjb21lIGVycm9yZVxuICB9XG4gIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoZGF0YS5kZXNjcmlwdGlvbiB8fCBkYXRhLm1lc3NhZ2UgfHwgY29uZmlnLnN0cmluZ3MuY2FydEVycm9yKTtcbiAgfVxuICByZXR1cm4gZGF0YTtcbn1cblxuY29uc3QgYW5ub3VuY2UgPSAoZGV0YWlsKSA9PiBkb2N1bWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgnY2FydDp1cGRhdGVkJywgeyBkZXRhaWwgfSkpO1xuXG5leHBvcnQgY29uc3QgY2FydCA9IHtcbiAgYXN5bmMgYWRkKGZvcm1EYXRhKSB7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IGNhcnRSZXF1ZXN0KGAke2NvbmZpZy5yb3V0ZXMuY2FydEFkZH0uanNgLCBmb3JtRGF0YSk7XG4gICAgcmVuZGVyQ2FydFNlY3Rpb25zKGRhdGEuc2VjdGlvbnMpO1xuICAgIGFubm91bmNlKHsgc291cmNlOiAnYWRkJywgaXRlbTogZGF0YSB9KTtcbiAgICByZXR1cm4gZGF0YTtcbiAgfSxcblxuICBhc3luYyBjaGFuZ2UobGluZSwgcXVhbnRpdHkpIHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgY2FydFJlcXVlc3QoYCR7Y29uZmlnLnJvdXRlcy5jYXJ0Q2hhbmdlfS5qc2AsIHsgbGluZSwgcXVhbnRpdHkgfSk7XG4gICAgcmVuZGVyQ2FydFNlY3Rpb25zKGRhdGEuc2VjdGlvbnMpO1xuICAgIGFubm91bmNlKHsgc291cmNlOiAnY2hhbmdlJywgY2FydDogZGF0YSB9KTtcbiAgICByZXR1cm4gZGF0YTtcbiAgfSxcblxuICAvKiogTm90YSwgYXR0cmlidXRpLCBjb2RpY2kgc2NvbnRvLiBDb24gcmVuZGVyOiBmYWxzZSBub24gcmlkaXNlZ25hIG51bGxhIChlcy4gbWVudHJlIGlsIGNsaWVudGUgc2NyaXZlKS4gKi9cbiAgYXN5bmMgdXBkYXRlKGJvZHksIHsgcmVuZGVyID0gdHJ1ZSB9ID0ge30pIHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgY2FydFJlcXVlc3QoYCR7Y29uZmlnLnJvdXRlcy5jYXJ0VXBkYXRlfS5qc2AsIGJvZHksIHsgcmVuZGVyIH0pO1xuICAgIGlmIChyZW5kZXIpIHJlbmRlckNhcnRTZWN0aW9ucyhkYXRhLnNlY3Rpb25zKTtcbiAgICBhbm5vdW5jZSh7IHNvdXJjZTogJ3VwZGF0ZScsIGNhcnQ6IGRhdGEgfSk7XG4gICAgcmV0dXJuIGRhdGE7XG4gIH0sXG59O1xuXG53aW5kb3cudGhlbWVDYXJ0ID0gY2FydDtcblxuLyoqIENhc3NldHRvIGRlbCBjYXJyZWxsbzogPGRpYWxvZz4gbW9kYWxlIChmb2N1cyBpbnRyYXBwb2xhdG8gZSByZXN0byBkZWxsYSBwYWdpbmEgaW5lcnRlIGluIG1vZG8gbmF0aXZvKS4gKi9cbmNsYXNzIENhcnREcmF3ZXIgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgIHRoaXMuZGlhbG9nID0gdGhpcy5xdWVyeVNlbGVjdG9yKCdkaWFsb2cnKTtcbiAgICB0aGlzLmRpYWxvZy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICAgICAgaWYgKGV2ZW50LnRhcmdldCA9PT0gdGhpcy5kaWFsb2cgfHwgZXZlbnQudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWNhcnQtY2xvc2VdJykpIHRoaXMuY2xvc2UoKTtcbiAgICB9KTtcbiAgICB0aGlzLmRpYWxvZy5hZGRFdmVudExpc3RlbmVyKCdjbG9zZScsICgpID0+IHRoaXMub3BlbmVyPy5mb2N1cz8uKCkpO1xuICB9XG5cbiAgb3BlbihvcGVuZXIpIHtcbiAgICBpZiAodGhpcy5kaWFsb2cub3BlbikgcmV0dXJuO1xuICAgIHRoaXMub3BlbmVyID0gb3BlbmVyIHx8IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gICAgdGhpcy5kaWFsb2cuc2hvd01vZGFsKCk7XG4gIH1cblxuICBjbG9zZSgpIHtcbiAgICB0aGlzLmRpYWxvZy5jbG9zZSgpO1xuICB9XG59XG5kZWZpbmUoJ2NhcnQtZHJhd2VyJywgQ2FydERyYXdlcik7XG5cbmNvbnN0IGdldENhcnREcmF3ZXIgPSAoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdjYXJ0LWRyYXdlcicpO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICBjb25zdCB0b2dnbGUgPSBldmVudC50YXJnZXQuY2xvc2VzdCgnW2RhdGEtY2FydC10b2dnbGVdJyk7XG4gIGNvbnN0IGRyYXdlciA9IGdldENhcnREcmF3ZXIoKTtcbiAgaWYgKCF0b2dnbGUgfHwgIWRyYXdlcikgcmV0dXJuO1xuICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICBkcmF3ZXIub3Blbih0b2dnbGUpO1xufSk7XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2FuaW1hdGlvbmVuZCcsIChldmVudCkgPT4ge1xuICBpZiAoZXZlbnQudGFyZ2V0LmNsYXNzTGlzdD8uY29udGFpbnMoJ2lzLWJ1bXBlZCcpKSBldmVudC50YXJnZXQuY2xhc3NMaXN0LnJlbW92ZSgnaXMtYnVtcGVkJyk7XG59KTtcblxuLyogUmlnaGUgZGVsIGNhcnJlbGxvOiBxdWFudGl0w6AgZSByaW1vemlvbmUgKGNhc3NldHRvIGUgcGFnaW5hKSAqL1xuY29uc3QgdXBkYXRlTGluZSA9IGFzeW5jIChsaW5lRWwsIHF1YW50aXR5KSA9PiB7XG4gIGNvbnN0IGxpbmUgPSBOdW1iZXIobGluZUVsLmRhdGFzZXQubGluZSk7XG4gIGNvbnN0IGVycm9yID0gbGluZUVsLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWxpbmUtZXJyb3JdJyk7XG4gIGxpbmVFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtYnVzeScsICd0cnVlJyk7XG4gIHRyeSB7XG4gICAgYXdhaXQgY2FydC5jaGFuZ2UobGluZSwgcXVhbnRpdHkpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBsaW5lRWwucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWJ1c3knKTtcbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgIGVycm9yLnRleHRDb250ZW50ID0gZXJyLm1lc3NhZ2U7XG4gICAgICBlcnJvci5oaWRkZW4gPSBmYWxzZTtcbiAgICB9XG4gIH1cbn07XG5cbi8vIFVuJ2F0dGVzYSBwZXIgcmlnYTogbW9kaWZpY2hlIHJhdnZpY2luYXRlIHN1IHJpZ2hlIGRpdmVyc2Ugbm9uIHNpIGFubnVsbGFubyBhIHZpY2VuZGEuXG5jb25zdCBsaW5lVGltZXJzID0gbmV3IE1hcCgpO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZXZlbnQpID0+IHtcbiAgY29uc3QgaW5wdXQgPSBldmVudC50YXJnZXQuY2xvc2VzdCgnLmNhcnQtbGluZSAucXVhbnRpdHlfX2lucHV0Jyk7XG4gIGlmICghaW5wdXQpIHJldHVybjtcbiAgY29uc3QgbGluZUVsID0gaW5wdXQuY2xvc2VzdCgnLmNhcnQtbGluZScpO1xuICBjb25zdCBrZXkgPSBsaW5lRWwuaWQ7XG4gIGNsZWFyVGltZW91dChsaW5lVGltZXJzLmdldChrZXkpKTtcbiAgbGluZVRpbWVycy5zZXQoXG4gICAga2V5LFxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgbGluZVRpbWVycy5kZWxldGUoa2V5KTtcbiAgICAgIC8vIExhIHJpZ2EgcG90cmViYmUgZXNzZXJlIHN0YXRhIHNvc3RpdHVpdGEgbmVsIGZyYXR0ZW1wbzogc2kgcmlwcmVuZGUgcXVlbGxhIGF0dHVhbGUuXG4gICAgICBjb25zdCBjdXJyZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoa2V5KSB8fCBsaW5lRWw7XG4gICAgICB1cGRhdGVMaW5lKGN1cnJlbnQsIE1hdGgubWF4KDAsIE51bWJlcihpbnB1dC52YWx1ZSkgfHwgMCkpO1xuICAgIH0sIDM1MCksXG4gICk7XG59KTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgY29uc3QgcmVtb3ZlID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWxpbmUtcmVtb3ZlXScpO1xuICBpZiAoIXJlbW92ZSkgcmV0dXJuO1xuICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICB1cGRhdGVMaW5lKHJlbW92ZS5jbG9zZXN0KCcuY2FydC1saW5lJyksIDApO1xufSk7XG5cbi8qIENvZGljaSBzY29udG8gKGNhc3NldHRvIGUgcGFnaW5hIGNhcnJlbGxvKSAqL1xuY2xhc3MgQ2FydERpc2NvdW50IGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIChldmVudCkgPT4ge1xuICAgICAgaWYgKCFldmVudC50YXJnZXQubWF0Y2hlcygnW2RhdGEtZGlzY291bnQtZm9ybV0nKSkgcmV0dXJuO1xuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGNvbnN0IGlucHV0ID0gZXZlbnQudGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W25hbWU9XCJkaXNjb3VudFwiXScpO1xuICAgICAgY29uc3QgY29kZSA9IGlucHV0LnZhbHVlLnRyaW0oKTtcbiAgICAgIGlmIChjb2RlKSB0aGlzLmFwcGx5KFsuLi50aGlzLmNvZGVzKCksIGNvZGVdLCBjb2RlKTtcbiAgICB9KTtcbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICBjb25zdCByZW1vdmUgPSBldmVudC50YXJnZXQuY2xvc2VzdCgnW2RhdGEtZGlzY291bnQtcmVtb3ZlXScpO1xuICAgICAgaWYgKCFyZW1vdmUpIHJldHVybjtcbiAgICAgIGNvbnN0IGNvZGUgPSByZW1vdmUuZGF0YXNldC5kaXNjb3VudFJlbW92ZTtcbiAgICAgIHRoaXMuYXBwbHkoXG4gICAgICAgIHRoaXMuY29kZXMoKS5maWx0ZXIoKGV4aXN0aW5nKSA9PiBleGlzdGluZyAhPT0gY29kZSksXG4gICAgICAgIG51bGwsXG4gICAgICApO1xuICAgIH0pO1xuICB9XG5cbiAgY29kZXMoKSB7XG4gICAgcmV0dXJuIFsuLi50aGlzLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWRpc2NvdW50LXJlbW92ZV0nKV0ubWFwKChlbCkgPT4gZWwuZGF0YXNldC5kaXNjb3VudFJlbW92ZSk7XG4gIH1cblxuICBhc3luYyBhcHBseShjb2RlcywgYWRkZWQpIHtcbiAgICBjb25zdCBidXR0b24gPSB0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWRpc2NvdW50LWZvcm1dIGJ1dHRvbicpO1xuICAgIGNvbnN0IGVycm9yID0gdGhpcy5xdWVyeVNlbGVjdG9yKCdbZGF0YS1kaXNjb3VudC1lcnJvcl0nKTtcbiAgICBidXR0b24/LnNldEF0dHJpYnV0ZSgnYXJpYS1idXN5JywgJ3RydWUnKTtcbiAgICBpZiAoZXJyb3IpIGVycm9yLmhpZGRlbiA9IHRydWU7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGNhcnQudXBkYXRlKHsgZGlzY291bnQ6IFsuLi5uZXcgU2V0KGNvZGVzKV0uam9pbignLCcpIH0pO1xuICAgICAgaWYgKGFkZGVkKSB7XG4gICAgICAgIC8vIElsIGNhcnJlbGxvIMOoIHN0YXRvIHJpZGlzZWduYXRvOiBsJ2VzaXRvIHNpIGxlZ2dlIGRhbCBjaGlwIGRlbCBjb2RpY2UgbmVsIG51b3ZvIEhUTUwuXG4gICAgICAgIGNvbnN0IHNjb3BlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignZGlhbG9nW29wZW5dIGNhcnQtZGlzY291bnQnKSB8fCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdjYXJ0LWRpc2NvdW50Jyk7XG4gICAgICAgIGNvbnN0IGNoaXAgPSBzY29wZT8ucXVlcnlTZWxlY3RvcihgW2RhdGEtZGlzY291bnQtcmVtb3ZlPVwiJHtDU1MuZXNjYXBlKGFkZGVkKX1cIiBpXWApO1xuICAgICAgICBpZiAoIWNoaXAgfHwgY2hpcC5kYXRhc2V0LmFwcGxpY2FibGUgPT09ICdmYWxzZScpIHtcbiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gKGNvbmZpZy5zdHJpbmdzLmRpc2NvdW50SW52YWxpZCB8fCAnJykucmVwbGFjZSgnW2NvZGVdJywgYWRkZWQpO1xuICAgICAgICAgIGNvbnN0IHRhcmdldCA9IHNjb3BlPy5xdWVyeVNlbGVjdG9yKCdbZGF0YS1kaXNjb3VudC1lcnJvcl0nKTtcbiAgICAgICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgICAgICB0YXJnZXQudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgICAgICAgICAgdGFyZ2V0LmhpZGRlbiA9IGZhbHNlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaG93VG9hc3QobWVzc2FnZSwgeyB0b25lOiAnZXJyb3InIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgc2hvd1RvYXN0KChjb25maWcuc3RyaW5ncy5kaXNjb3VudEFwcGxpZWQgfHwgJycpLnJlcGxhY2UoJ1tjb2RlXScsIGFkZGVkKSwgeyB0b25lOiAnc3VjY2VzcycgfSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgZXJyb3IudGV4dENvbnRlbnQgPSBlcnIubWVzc2FnZTtcbiAgICAgICAgZXJyb3IuaGlkZGVuID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIGJ1dHRvbj8ucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWJ1c3knKTtcbiAgICB9XG4gIH1cbn1cbmRlZmluZSgnY2FydC1kaXNjb3VudCcsIENhcnREaXNjb3VudCk7XG5cbi8qIE5vdGEgZSBhdHRyaWJ1dGkgZGVsbCdvcmRpbmU6IHNhbHZhdGkgbWVudHJlIGlsIGNsaWVudGUgc2NyaXZlLCBzZW56YSByaWRpc2VnbmFyZSBpbCBjYXJyZWxsbyAqL1xuY2xhc3MgQ2FydE5vdGUgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgIHRoaXMuc2F2ZSA9IGRlYm91bmNlKChmaWVsZCkgPT4gdGhpcy5wZXJzaXN0KGZpZWxkKSwgNTAwKTtcbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKGV2ZW50KSA9PiB7XG4gICAgICBpZiAoZXZlbnQudGFyZ2V0Lm1hdGNoZXMoJ3RleHRhcmVhLCBpbnB1dFt0eXBlPVwidGV4dFwiXScpKSB0aGlzLnNhdmUoZXZlbnQudGFyZ2V0KTtcbiAgICB9KTtcbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChldmVudCkgPT4ge1xuICAgICAgaWYgKGV2ZW50LnRhcmdldC5tYXRjaGVzKCdpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nKSkgdGhpcy5wZXJzaXN0KGV2ZW50LnRhcmdldCk7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBwZXJzaXN0KGZpZWxkKSB7XG4gICAgY29uc3Qgc3RhdHVzID0gdGhpcy5xdWVyeVNlbGVjdG9yKCdbZGF0YS1ub3RlLXN0YXR1c10nKTtcbiAgICBsZXQgYm9keTtcbiAgICBpZiAoZmllbGQubmFtZSA9PT0gJ25vdGUnKSB7XG4gICAgICBib2R5ID0geyBub3RlOiBmaWVsZC52YWx1ZSB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBrZXkgPSBmaWVsZC5kYXRhc2V0LmF0dHJpYnV0ZTtcbiAgICAgIGNvbnN0IHZhbHVlID0gZmllbGQudHlwZSA9PT0gJ2NoZWNrYm94JyA/IChmaWVsZC5jaGVja2VkID8gZmllbGQudmFsdWUgOiAnJykgOiBmaWVsZC52YWx1ZTtcbiAgICAgIGJvZHkgPSB7IGF0dHJpYnV0ZXM6IHsgW2tleV06IHZhbHVlIH0gfTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGNhcnQudXBkYXRlKGJvZHksIHsgcmVuZGVyOiBmYWxzZSB9KTtcbiAgICAgIGlmIChzdGF0dXMpIHtcbiAgICAgICAgc3RhdHVzLnRleHRDb250ZW50ID0gY29uZmlnLnN0cmluZ3Muc2F2ZWQgfHwgJyc7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0YXR1c1RpbWVyKTtcbiAgICAgICAgdGhpcy5zdGF0dXNUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIHN0YXR1cy50ZXh0Q29udGVudCA9ICcnO1xuICAgICAgICB9LCAyMDAwKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHNob3dUb2FzdChlcnIubWVzc2FnZSwgeyB0b25lOiAnZXJyb3InIH0pO1xuICAgIH1cbiAgfVxufVxuZGVmaW5lKCdjYXJ0LW5vdGUnLCBDYXJ0Tm90ZSk7XG5cbi8qIC0tLS0tLS0tLS0gUXVhbnRpdMOgIC0tLS0tLS0tLS0gKi9cbmNsYXNzIFF1YW50aXR5SW5wdXQgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgIHRoaXMuaW5wdXQgPSB0aGlzLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0Jyk7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICAgICAgY29uc3QgYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLXF1YW50aXR5XScpO1xuICAgICAgaWYgKCFidXR0b24pIHJldHVybjtcbiAgICAgIGNvbnN0IHN0ZXAgPSBOdW1iZXIodGhpcy5pbnB1dC5zdGVwKSB8fCAxO1xuICAgICAgY29uc3QgbWluID0gTnVtYmVyKHRoaXMuaW5wdXQubWluKSB8fCAwO1xuICAgICAgY29uc3QgbWF4ID0gdGhpcy5pbnB1dC5tYXggPyBOdW1iZXIodGhpcy5pbnB1dC5tYXgpIDogSW5maW5pdHk7XG4gICAgICBjb25zdCBjdXJyZW50ID0gTnVtYmVyKHRoaXMuaW5wdXQudmFsdWUpIHx8IDA7XG4gICAgICBjb25zdCBuZXh0ID0gYnV0dG9uLmRhdGFzZXQucXVhbnRpdHkgPT09ICdwbHVzJyA/IGN1cnJlbnQgKyBzdGVwIDogY3VycmVudCAtIHN0ZXA7XG4gICAgICBjb25zdCB2YWx1ZSA9IE1hdGgubWluKG1heCwgTWF0aC5tYXgobWluLCBuZXh0KSk7XG4gICAgICBpZiAodmFsdWUgPT09IGN1cnJlbnQpIHJldHVybjtcbiAgICAgIHRoaXMuaW5wdXQudmFsdWUgPSB2YWx1ZTtcbiAgICAgIHRoaXMuaW5wdXQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG4gICAgfSk7XG4gIH1cbn1cbmRlZmluZSgncXVhbnRpdHktaW5wdXQnLCBRdWFudGl0eUlucHV0KTtcblxuLyogLS0tLS0tLS0tLSBBZ2dpdW50YSBhbCBjYXJyZWxsbyAtLS0tLS0tLS0tICovXG5jbGFzcyBQcm9kdWN0Rm9ybSBleHRlbmRzIEhUTUxFbGVtZW50IHtcbiAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgdGhpcy5mb3JtID0gdGhpcy5xdWVyeVNlbGVjdG9yKCdmb3JtJyk7XG4gICAgdGhpcy5mb3JtPy5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCAoZXZlbnQpID0+IHRoaXMub25TdWJtaXQoZXZlbnQpKTtcbiAgfVxuXG4gIGFzeW5jIG9uU3VibWl0KGV2ZW50KSB7XG4gICAgY29uc3QgZHJhd2VyID0gZ2V0Q2FydERyYXdlcigpO1xuICAgIC8vIENhcnJlbGxvIGNvbWUgcGFnaW5hOiBpbnZpbyBuYXRpdm8gZGVsIGZvcm0gKHBvcnRhIGFsIGNhcnJlbGxvKS5cbiAgICBpZiAoY29uZmlnLmNhcnRUeXBlICE9PSAnZHJhd2VyJyB8fCAhZHJhd2VyKSByZXR1cm47XG5cbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGNvbnN0IGJ1dHRvbiA9IGV2ZW50LnN1Ym1pdHRlciB8fCB0aGlzLmZvcm0ucXVlcnlTZWxlY3RvcignW3R5cGU9XCJzdWJtaXRcIl0nKTtcbiAgICBjb25zdCBlcnJvciA9IHRoaXMucXVlcnlTZWxlY3RvcignW2RhdGEtZm9ybS1lcnJvcl0nKTtcbiAgICBpZiAoYnV0dG9uPy5nZXRBdHRyaWJ1dGUoJ2FyaWEtYnVzeScpID09PSAndHJ1ZScpIHJldHVybjtcblxuICAgIGJ1dHRvbj8uc2V0QXR0cmlidXRlKCdhcmlhLWJ1c3knLCAndHJ1ZScpO1xuICAgIGlmIChlcnJvcikgZXJyb3IuaGlkZGVuID0gdHJ1ZTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBjYXJ0LmFkZChuZXcgRm9ybURhdGEodGhpcy5mb3JtKSk7XG4gICAgICAvLyBEYWxsJ2FudGVwcmltYSByYXBpZGE6IHNpIGNoaXVkZSBlIGlsIGNhc3NldHRvIHJlc3RpdHVpcsOgIGlsIGZvY3VzIGFsbGEgY2FyZCBkaSBwYXJ0ZW56YS5cbiAgICAgIGNvbnN0IGRpYWxvZyA9IHRoaXMuY2xvc2VzdCgnZGlhbG9nJyk7XG4gICAgICBjb25zdCBvcGVuZXIgPSBkaWFsb2c/LnJldHVybkZvY3VzVG8gfHwgYnV0dG9uO1xuICAgICAgaWYgKGRpYWxvZykge1xuICAgICAgICBkaWFsb2cucmV0dXJuRm9jdXNUbyA9IG51bGw7XG4gICAgICAgIGRpYWxvZy5jbG9zZSgpO1xuICAgICAgfVxuICAgICAgZHJhd2VyLm9wZW4ob3BlbmVyKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBlcnJvci50ZXh0Q29udGVudCA9IGVyci5tZXNzYWdlO1xuICAgICAgICBlcnJvci5oaWRkZW4gPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGZpbmFsbHkge1xuICAgICAgYnV0dG9uPy5yZW1vdmVBdHRyaWJ1dGUoJ2FyaWEtYnVzeScpO1xuICAgIH1cbiAgfVxufVxuZGVmaW5lKCdwcm9kdWN0LWZvcm0nLCBQcm9kdWN0Rm9ybSk7XG5cbi8qIC0tLS0tLS0tLS0gQW50ZXByaW1hIHJhcGlkYSAobW9kdWxvIGNhcmljYXRvIGFsIHByaW1vIGNsaWMpIC0tLS0tLS0tLS0gKi9cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKGV2ZW50KSA9PiB7XG4gIGNvbnN0IHRyaWdnZXIgPSBldmVudC50YXJnZXQuY2xvc2VzdCgnW2RhdGEtcXVpY2stdmlld10nKTtcbiAgaWYgKCF0cmlnZ2VyKSByZXR1cm47XG4gIGlmIChldmVudC5tZXRhS2V5IHx8IGV2ZW50LmN0cmxLZXkgfHwgZXZlbnQuc2hpZnRLZXkgfHwgZXZlbnQuYnV0dG9uID09PSAxKSByZXR1cm47XG4gIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gIGNvbnN0IHsgb3BlblF1aWNrVmlldyB9ID0gYXdhaXQgaW1wb3J0KCcuLi9zY3JpcHRzL3F1aWNrLXZpZXcuanMnKTtcbiAgb3BlblF1aWNrVmlldyh0cmlnZ2VyLmdldEF0dHJpYnV0ZSgnaHJlZicpIHx8IHRyaWdnZXIuZGF0YXNldC5xdWlja1ZpZXcsIHRyaWdnZXIpO1xufSk7XG5cbi8qIC0tLS0tLS0tLS0gU3dhdGNoIGNvbG9yZSBzdWxsZSBjYXJkIC0tLS0tLS0tLS0gKi9cbmNvbnN0IHNlbGVjdFN3YXRjaCA9IChzd2F0Y2gpID0+IHtcbiAgY29uc3QgY2FyZCA9IHN3YXRjaC5jbG9zZXN0KCcuY2FyZCcpO1xuICBpZiAoIWNhcmQpIHJldHVybjtcbiAgY29uc3QgaW1hZ2UgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJy5jYXJkX19pbWFnZTpub3QoLmNhcmRfX2ltYWdlLS1zZWNvbmRhcnkpJyk7XG4gIGlmIChpbWFnZSAmJiBzd2F0Y2guZGF0YXNldC5zcmMpIHtcbiAgICBpbWFnZS5zcmNzZXQgPSBzd2F0Y2guZGF0YXNldC5zcmNzZXQgfHwgJyc7XG4gICAgaW1hZ2Uuc3JjID0gc3dhdGNoLmRhdGFzZXQuc3JjO1xuICAgIGNhcmQuY2xhc3NMaXN0LmFkZCgnY2FyZC0tc3dhdGNoLXNlbGVjdGVkJyk7XG4gIH1cbiAgaWYgKHN3YXRjaC5kYXRhc2V0LnVybCkge1xuICAgIGNhcmQucXVlcnlTZWxlY3RvckFsbCgnLmNhcmRfX2xpbmssIFtkYXRhLXF1aWNrLXZpZXddJykuZm9yRWFjaCgobGluaykgPT4gbGluay5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCBzd2F0Y2guZGF0YXNldC51cmwpKTtcbiAgfVxuICBjYXJkLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWNhcmQtc3dhdGNoXScpLmZvckVhY2goKGVsKSA9PiBlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIFN0cmluZyhlbCA9PT0gc3dhdGNoKSkpO1xufTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgY29uc3Qgc3dhdGNoID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWNhcmQtc3dhdGNoXScpO1xuICBpZiAoc3dhdGNoKSBzZWxlY3RTd2F0Y2goc3dhdGNoKTtcbn0pO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVyb3ZlcicsIChldmVudCkgPT4ge1xuICBpZiAoZXZlbnQucG9pbnRlclR5cGUgIT09ICdtb3VzZScpIHJldHVybjtcbiAgY29uc3Qgc3dhdGNoID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3Q/LignW2RhdGEtY2FyZC1zd2F0Y2hdJyk7XG4gIGlmIChzd2F0Y2gpIHNlbGVjdFN3YXRjaChzd2F0Y2gpO1xufSk7XG5cbi8qIC0tLS0tLS0tLS0gTWVudSBhIHRlbmRpbmEgZGVsbCdoZWFkZXIgLS0tLS0tLS0tLSAqL1xuY29uc3QgZHJvcGRvd25zID0gKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnZGV0YWlsc1tkYXRhLW1lbnUtZHJvcGRvd25dJyk7XG5jb25zdCBob3ZlclF1ZXJ5ID0gd2luZG93Lm1hdGNoTWVkaWEoJyhob3ZlcjogaG92ZXIpIGFuZCAobWluLXdpZHRoOiA5OTBweCknKTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcbiAgJ3RvZ2dsZScsXG4gIChldmVudCkgPT4ge1xuICAgIGNvbnN0IGRldGFpbHMgPSBldmVudC50YXJnZXQ7XG4gICAgaWYgKCEoZGV0YWlscyBpbnN0YW5jZW9mIEhUTUxEZXRhaWxzRWxlbWVudCkgfHwgIWRldGFpbHMubWF0Y2hlcygnW2RhdGEtbWVudS1kcm9wZG93bl0nKSB8fCAhZGV0YWlscy5vcGVuKSByZXR1cm47XG4gICAgZHJvcGRvd25zKCkuZm9yRWFjaCgob3RoZXIpID0+IHtcbiAgICAgIGlmIChvdGhlciAhPT0gZGV0YWlscykgb3RoZXIub3BlbiA9IGZhbHNlO1xuICAgIH0pO1xuICB9LFxuICB0cnVlLFxuKTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgLy8gVW4gcGFubmVsbG8gYXBwZW5hIGFwZXJ0byBkYWwgcGFzc2FnZ2lvIGRlbCBtb3VzZSByZXN0YSBhcGVydG8gYWwgcHJpbW8gY2xpYyBzdWwgdGl0b2xvLlxuICBjb25zdCBzdW1tYXJ5ID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoJ2RldGFpbHNbZGF0YS1tZW51LWRyb3Bkb3duXSA+IHN1bW1hcnknKTtcbiAgaWYgKHN1bW1hcnkgJiYgc3VtbWFyeS5wYXJlbnRFbGVtZW50Lm9wZW4gJiYgc3VtbWFyeS5wYXJlbnRFbGVtZW50Ll9ob3Zlck9wZW5lZCkge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgc3VtbWFyeS5wYXJlbnRFbGVtZW50Ll9ob3Zlck9wZW5lZCA9IGZhbHNlO1xuICB9XG4gIGRyb3Bkb3ducygpLmZvckVhY2goKGRldGFpbHMpID0+IHtcbiAgICBpZiAoZGV0YWlscy5vcGVuICYmICFkZXRhaWxzLmNvbnRhaW5zKGV2ZW50LnRhcmdldCkpIGRldGFpbHMub3BlbiA9IGZhbHNlO1xuICB9KTtcbn0pO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgKGV2ZW50KSA9PiB7XG4gIGlmIChldmVudC5rZXkgIT09ICdFc2NhcGUnKSByZXR1cm47XG4gIGRyb3Bkb3ducygpLmZvckVhY2goKGRldGFpbHMpID0+IHtcbiAgICBpZiAoIWRldGFpbHMub3BlbikgcmV0dXJuO1xuICAgIGRldGFpbHMub3BlbiA9IGZhbHNlO1xuICAgIGRldGFpbHMucXVlcnlTZWxlY3Rvcignc3VtbWFyeScpPy5mb2N1cygpO1xuICB9KTtcbn0pO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdmb2N1c291dCcsIChldmVudCkgPT4ge1xuICBjb25zdCBkZXRhaWxzID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3Q/LignZGV0YWlsc1tkYXRhLW1lbnUtZHJvcGRvd25dJyk7XG4gIGlmIChkZXRhaWxzICYmIGV2ZW50LnJlbGF0ZWRUYXJnZXQgJiYgIWRldGFpbHMuY29udGFpbnMoZXZlbnQucmVsYXRlZFRhcmdldCkpIGRldGFpbHMub3BlbiA9IGZhbHNlO1xufSk7XG5cbi8vIENvbiBpbCBtb3VzZSBpIHBhbm5lbGxpIHNpIGFwcm9ubyBhbCBwYXNzYWdnaW8gKGNvbiB1biBwaWNjb2xvIHJpdGFyZG8gaW4gY2hpdXN1cmEpLlxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcm92ZXInLCAoZXZlbnQpID0+IHtcbiAgaWYgKCFob3ZlclF1ZXJ5Lm1hdGNoZXMgfHwgZXZlbnQucG9pbnRlclR5cGUgIT09ICdtb3VzZScpIHJldHVybjtcbiAgY29uc3QgZGV0YWlscyA9IGV2ZW50LnRhcmdldC5jbG9zZXN0Py4oJ2RldGFpbHNbZGF0YS1tZW51LWRyb3Bkb3duXScpO1xuICBpZiAoIWRldGFpbHMpIHJldHVybjtcbiAgY2xlYXJUaW1lb3V0KGRldGFpbHMuX2Nsb3NlVGltZXIpO1xuICBpZiAoIWRldGFpbHMub3Blbikge1xuICAgIGRldGFpbHMub3BlbiA9IHRydWU7XG4gICAgZGV0YWlscy5faG92ZXJPcGVuZWQgPSB0cnVlO1xuICB9XG59KTtcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigncG9pbnRlcm91dCcsIChldmVudCkgPT4ge1xuICBpZiAoIWhvdmVyUXVlcnkubWF0Y2hlcyB8fCBldmVudC5wb2ludGVyVHlwZSAhPT0gJ21vdXNlJykgcmV0dXJuO1xuICBjb25zdCBkZXRhaWxzID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3Q/LignZGV0YWlsc1tkYXRhLW1lbnUtZHJvcGRvd25dJyk7XG4gIGlmICghZGV0YWlscyB8fCBkZXRhaWxzLmNvbnRhaW5zKGV2ZW50LnJlbGF0ZWRUYXJnZXQpKSByZXR1cm47XG4gIGRldGFpbHMuX2Nsb3NlVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBkZXRhaWxzLm9wZW4gPSBmYWxzZTtcbiAgICBkZXRhaWxzLl9ob3Zlck9wZW5lZCA9IGZhbHNlO1xuICB9LCAxODApO1xufSk7XG5cbi8qIC0tLS0tLS0tLS0gSGVhZGVyOiBvbWJyYSBkb3BvIGxvIHNjb3JyaW1lbnRvLCBhIHNjb21wYXJzYSBzY2VuZGVuZG8gKHNlIGF0dGl2bykgLS0tLS0tLS0tLSAqL1xuZnVuY3Rpb24gaW5pdEhlYWRlclNjcm9sbCgpIHtcbiAgY29uc3QgaGVhZGVyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmhlYWRlci13cmFwcGVyLS1zdGlja3knKTtcbiAgY29uc3Qgc2VjdGlvbiA9IGhlYWRlcj8uY2xvc2VzdCgnLnNob3BpZnktc2VjdGlvbicpO1xuICBpZiAoIXNlY3Rpb24gfHwgc2VjdGlvbi5kYXRhc2V0LnNjcm9sbFJlYWR5KSByZXR1cm47XG4gIHNlY3Rpb24uZGF0YXNldC5zY3JvbGxSZWFkeSA9ICd0cnVlJztcbiAgY29uc3QgaGlkZXMgPSBoZWFkZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdoZWFkZXItd3JhcHBlci0taGlkZS1vbi1zY3JvbGwnKTtcbiAgbGV0IGxhc3RZID0gd2luZG93LnNjcm9sbFk7XG4gIGxldCB0aWNraW5nID0gZmFsc2U7XG5cbiAgY29uc3QgaXNCdXN5ID0gKCkgPT5cbiAgICBoZWFkZXIucXVlcnlTZWxlY3RvcignZGV0YWlsc1tvcGVuXScpIHx8IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ1twb3BvdmVyXTpwb3BvdmVyLW9wZW4sIGRpYWxvZ1tvcGVuXScpO1xuXG4gIGNvbnN0IHVwZGF0ZSA9ICgpID0+IHtcbiAgICB0aWNraW5nID0gZmFsc2U7XG4gICAgY29uc3QgeSA9IHdpbmRvdy5zY3JvbGxZO1xuICAgIHNlY3Rpb24udG9nZ2xlQXR0cmlidXRlKCdkYXRhLWhlYWRlci1zY3JvbGxlZCcsIHkgPiA0KTtcbiAgICBpZiAoaGlkZXMpIHtcbiAgICAgIGNvbnN0IGdvaW5nRG93biA9IHkgPiBsYXN0WSAmJiB5ID4gc2VjdGlvbi5vZmZzZXRIZWlnaHQgKiAyO1xuICAgICAgaWYgKGdvaW5nRG93biAmJiAhaXNCdXN5KCkpIHNlY3Rpb24uc2V0QXR0cmlidXRlKCdkYXRhLWhlYWRlci1oaWRkZW4nLCAnJyk7XG4gICAgICBlbHNlIGlmICh5IDwgbGFzdFkgLSA0IHx8IHkgPD0gc2VjdGlvbi5vZmZzZXRIZWlnaHQpIHNlY3Rpb24ucmVtb3ZlQXR0cmlidXRlKCdkYXRhLWhlYWRlci1oaWRkZW4nKTtcbiAgICB9XG4gICAgbGFzdFkgPSB5O1xuICB9O1xuXG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFxuICAgICdzY3JvbGwnLFxuICAgICgpID0+IHtcbiAgICAgIGlmICghdGlja2luZykge1xuICAgICAgICB0aWNraW5nID0gdHJ1ZTtcbiAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHVwZGF0ZSk7XG4gICAgICB9XG4gICAgfSxcbiAgICB7IHBhc3NpdmU6IHRydWUgfSxcbiAgKTtcbiAgLy8gU2UgaWwgZm9jdXMgZW50cmEgbmVsbCdoZWFkZXIgbmFzY29zdG8gKHRhc3RpZXJhKSBsJ2hlYWRlciByaWNvbXBhcmUuXG4gIHNlY3Rpb24uYWRkRXZlbnRMaXN0ZW5lcignZm9jdXNpbicsICgpID0+IHNlY3Rpb24ucmVtb3ZlQXR0cmlidXRlKCdkYXRhLWhlYWRlci1oaWRkZW4nKSk7XG4gIHVwZGF0ZSgpO1xufVxuXG4vKiAtLS0tLS0tLS0tIENvbXBhcnNhIGR1cmFudGUgbG8gc2NvcnJpbWVudG8gLS0tLS0tLS0tLSAqL1xubGV0IHJldmVhbE9ic2VydmVyO1xuXG5mdW5jdGlvbiBpbml0UmV2ZWFsKHJvb3QgPSBkb2N1bWVudCkge1xuICBpZiAoIWRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmNvbnRhaW5zKCdyZXZlYWwtb24nKSB8fCByZWR1Y2VkTW90aW9uLm1hdGNoZXMgfHwgZGVzaWduTW9kZSkgcmV0dXJuO1xuICBpZiAoISgnSW50ZXJzZWN0aW9uT2JzZXJ2ZXInIGluIHdpbmRvdykpIHJldHVybjtcbiAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3JldmVhbC1yZWFkeScpO1xuXG4gIC8vIE5lbGxlIHJpZ2hlIGNoZSBzY29ycm9ubyBpbiBvcml6em9udGFsZSAoY2Fyb3NlbGxpLCBncmlnbGllIGEgc2NvcnJpbWVudG8gc3UgbW9iaWxlKSBnbGkgZWxlbWVudGkgZnVvcmkgc2NoZXJtb1xuICAvLyBub24gZW50cmVyZWJiZXJvIG1haSBuZWxsYSB2aXN0YTogc2kgb3NzZXJ2YSBpbCBjb250ZW5pdG9yZSBlIGNvbXBhaW9ubyB0dXR0aSBpbnNpZW1lLCBzZmFsc2F0aS5cbiAgY29uc3Qgc2Nyb2xsZXJTZWxlY3RvciA9ICcuZ3JpZC0tc2xpZGVyLCAuY2Fyb3VzZWxfX3RyYWNrLCAudGlja2VyX19ncm91cCc7XG5cbiAgcmV2ZWFsT2JzZXJ2ZXIgfHw9IG5ldyBJbnRlcnNlY3Rpb25PYnNlcnZlcihcbiAgICAoZW50cmllcykgPT4ge1xuICAgICAgZW50cmllcy5mb3JFYWNoKChlbnRyeSkgPT4ge1xuICAgICAgICBpZiAoIWVudHJ5LmlzSW50ZXJzZWN0aW5nKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHRhcmdldHMgPSBlbnRyeS50YXJnZXQubWF0Y2hlcyhzY3JvbGxlclNlbGVjdG9yKVxuICAgICAgICAgID8gZW50cnkudGFyZ2V0LnF1ZXJ5U2VsZWN0b3JBbGwoJzpzY29wZSA+IC5yZXZlYWwnKVxuICAgICAgICAgIDogW2VudHJ5LnRhcmdldF07XG4gICAgICAgIHRhcmdldHMuZm9yRWFjaCgoZWwpID0+IGVsLmNsYXNzTGlzdC5hZGQoJ2lzLXZpc2libGUnKSk7XG4gICAgICAgIHJldmVhbE9ic2VydmVyLnVub2JzZXJ2ZShlbnRyeS50YXJnZXQpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICB7IHJvb3RNYXJnaW46ICcwcHggMHB4IC04JSAwcHgnLCB0aHJlc2hvbGQ6IDAuMSB9LFxuICApO1xuXG4gIHJvb3QucXVlcnlTZWxlY3RvckFsbCgnLnJldmVhbDpub3QoLmlzLXZpc2libGUpJykuZm9yRWFjaCgoZWwpID0+IHtcbiAgICAvLyBTZmFsc2FtZW50byB0cmEgZWxlbWVudGkgZnJhdGVsbGkgKGdyaWdsaWUpLCBhbCBtYXNzaW1vIDYgcGFzc2kuXG4gICAgY29uc3Qgc2libGluZ3MgPSBbLi4uZWwucGFyZW50RWxlbWVudC5jaGlsZHJlbl0uZmlsdGVyKChjaGlsZCkgPT4gY2hpbGQuY2xhc3NMaXN0LmNvbnRhaW5zKCdyZXZlYWwnKSk7XG4gICAgZWwuc3R5bGUuc2V0UHJvcGVydHkoJy0tcmV2ZWFsLWluZGV4JywgU3RyaW5nKE1hdGgubWluKHNpYmxpbmdzLmluZGV4T2YoZWwpLCA2KSkpO1xuICAgIGNvbnN0IHNjcm9sbGVyID0gZWwucGFyZW50RWxlbWVudC5jbG9zZXN0KHNjcm9sbGVyU2VsZWN0b3IpO1xuICAgIHJldmVhbE9ic2VydmVyLm9ic2VydmUoc2Nyb2xsZXIgJiYgc2Nyb2xsZXIgPT09IGVsLnBhcmVudEVsZW1lbnQgPyBzY3JvbGxlciA6IGVsKTtcbiAgfSk7XG59XG5cbi8qIC0tLS0tLS0tLS0gUmljZXJjYSBwcmVkaXR0aXZhIC0tLS0tLS0tLS0gKi9cbmNsYXNzIFByZWRpY3RpdmVTZWFyY2ggZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgIHRoaXMuaW5wdXQgPSB0aGlzLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W3R5cGU9XCJzZWFyY2hcIl0nKTtcbiAgICB0aGlzLnJlc3VsdHMgPSB0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXByZWRpY3RpdmUtcmVzdWx0c10nKTtcbiAgICB0aGlzLnN0YXR1cyA9IHRoaXMucXVlcnlTZWxlY3RvcignW2RhdGEtcHJlZGljdGl2ZS1zdGF0dXNdJyk7XG4gICAgdGhpcy5jb250cm9sbGVyID0gbnVsbDtcblxuICAgIGNvbnN0IHBvcG92ZXIgPSB0aGlzLmNsb3Nlc3QoJ1twb3BvdmVyXScpO1xuICAgIHBvcG92ZXI/LmFkZEV2ZW50TGlzdGVuZXIoJ3RvZ2dsZScsIChldmVudCkgPT4ge1xuICAgICAgaWYgKGV2ZW50Lm5ld1N0YXRlID09PSAnb3BlbicpIHRoaXMuaW5wdXQuZm9jdXMoKTtcbiAgICB9KTtcblxuICAgIGlmICghdGhpcy5oYXNBdHRyaWJ1dGUoJ2RhdGEtZW5hYmxlZCcpKSByZXR1cm47XG4gICAgdGhpcy5pbnB1dC5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgJ2lucHV0JyxcbiAgICAgIGRlYm91bmNlKCgpID0+IHRoaXMuc2VhcmNoKHRoaXMuaW5wdXQudmFsdWUudHJpbSgpKSwgMjUwKSxcbiAgICApO1xuICB9XG5cbiAgYXN5bmMgc2VhcmNoKHRlcm0pIHtcbiAgICB0aGlzLmNvbnRyb2xsZXI/LmFib3J0KCk7XG4gICAgaWYgKCF0ZXJtKSB7XG4gICAgICB0aGlzLnJlc3VsdHMuaW5uZXJIVE1MID0gJyc7XG4gICAgICB0aGlzLnN0YXR1cy50ZXh0Q29udGVudCA9ICcnO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICAgIHE6IHRlcm0sXG4gICAgICBzZWN0aW9uX2lkOiAncHJlZGljdGl2ZS1zZWFyY2gnLFxuICAgICAgJ3Jlc291cmNlc1tsaW1pdF0nOiAnNicsXG4gICAgICAncmVzb3VyY2VzW2xpbWl0X3Njb3BlXSc6ICdlYWNoJyxcbiAgICB9KTtcbiAgICB0aGlzLnJlc3VsdHMuc2V0QXR0cmlidXRlKCdhcmlhLWJ1c3knLCAndHJ1ZScpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7Y29uZmlnLnJvdXRlcy5wcmVkaWN0aXZlU2VhcmNofT8ke3BhcmFtc31gLCB7XG4gICAgICAgIHNpZ25hbDogdGhpcy5jb250cm9sbGVyLnNpZ25hbCxcbiAgICAgIH0pO1xuICAgICAgaWYgKCFyZXNwb25zZS5vaykgdGhyb3cgbmV3IEVycm9yKHJlc3BvbnNlLnN0YXR1cyk7XG4gICAgICBjb25zdCBkb2MgPSBwYXJzZUhUTUwoYXdhaXQgcmVzcG9uc2UudGV4dCgpKTtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBkb2MucXVlcnlTZWxlY3RvcignW2RhdGEtcHJlZGljdGl2ZS1jb250ZW50XScpO1xuICAgICAgdGhpcy5yZXN1bHRzLmlubmVySFRNTCA9IGNvbnRlbnQgPyBjb250ZW50LmlubmVySFRNTCA6ICcnO1xuICAgICAgY29uc3QgY291bnQgPSBjb250ZW50Py5kYXRhc2V0LmNvdW50IHx8ICcwJztcbiAgICAgIHRoaXMuc3RhdHVzLnRleHRDb250ZW50ID0gKGNvbmZpZy5zdHJpbmdzLnNlYXJjaFJlc3VsdHMgfHwgJycpLnJlcGxhY2UoJ1tjb3VudF0nLCBjb3VudCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyLm5hbWUgIT09ICdBYm9ydEVycm9yJykgdGhpcy5yZXN1bHRzLmlubmVySFRNTCA9ICcnO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLnJlc3VsdHMucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWJ1c3knKTtcbiAgICB9XG4gIH1cbn1cbmRlZmluZSgncHJlZGljdGl2ZS1zZWFyY2gnLCBQcmVkaWN0aXZlU2VhcmNoKTtcblxuLyogLS0tLS0tLS0tLSBCYXJyYSBhbm51bmNpIC0tLS0tLS0tLS0gKi9cbmNsYXNzIEFubm91bmNlbWVudEJhciBleHRlbmRzIEhUTUxFbGVtZW50IHtcbiAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgdGhpcy50cmFjayA9IHRoaXMucXVlcnlTZWxlY3RvcignLmFubm91bmNlbWVudF9fdHJhY2snKTtcbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICBjb25zdCBidXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCgnW2RhdGEtZGlyZWN0aW9uXScpO1xuICAgICAgaWYgKCFidXR0b24pIHJldHVybjtcbiAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IE51bWJlcihidXR0b24uZGF0YXNldC5kaXJlY3Rpb24pO1xuICAgICAgY29uc3Qgd2lkdGggPSB0aGlzLnRyYWNrLmNsaWVudFdpZHRoO1xuICAgICAgY29uc3QgbWF4ID0gdGhpcy50cmFjay5zY3JvbGxXaWR0aCAtIHdpZHRoO1xuICAgICAgbGV0IG5leHQgPSB0aGlzLnRyYWNrLnNjcm9sbExlZnQgKyBkaXJlY3Rpb24gKiB3aWR0aDtcbiAgICAgIGlmIChuZXh0ID4gbWF4ICsgMSkgbmV4dCA9IDA7XG4gICAgICBpZiAobmV4dCA8IC0xKSBuZXh0ID0gbWF4O1xuICAgICAgdGhpcy50cmFjay5zY3JvbGxUbyh7IGxlZnQ6IG5leHQsIGJlaGF2aW9yOiAnc21vb3RoJyB9KTtcbiAgICB9KTtcbiAgfVxufVxuZGVmaW5lKCdhbm5vdW5jZW1lbnQtYmFyJywgQW5ub3VuY2VtZW50QmFyKTtcblxuLyogLS0tLS0tLS0tLSBUaWNrZXI6IGNvcGllIHBlciB1bm8gc2NvcnJpbWVudG8gY29udGludW8sIHZlbG9jaXTDoCBjb3N0YW50ZSwgcGF1c2EgLS0tLS0tLS0tLSAqL1xuY2xhc3MgVGlja2VyU3RyaXAgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgIHRoaXMudHJhY2sgPSB0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXRpY2tlci10cmFja10nKTtcbiAgICB0aGlzLmdyb3VwID0gdGhpcy5xdWVyeVNlbGVjdG9yKCdbZGF0YS10aWNrZXItZ3JvdXBdJyk7XG4gICAgdGhpcy50b2dnbGUgPSB0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXRpY2tlci10b2dnbGVdJyk7XG4gICAgaWYgKCF0aGlzLnRyYWNrIHx8ICF0aGlzLmdyb3VwKSByZXR1cm47XG5cbiAgICB0aGlzLnRvZ2dsZT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLnNldFBhdXNlZCghdGhpcy5oYXNBdHRyaWJ1dGUoJ2RhdGEtcGF1c2VkJykpKTtcbiAgICBpZiAocmVkdWNlZE1vdGlvbi5tYXRjaGVzKSByZXR1cm47XG5cbiAgICAvLyBJbCBncnVwcG8gZGV2ZSBlc3NlcmUgcGnDuSBsYXJnbyBkZWwgY29udGVuaXRvcmU6IHNpIHJpcGV0b25vIGdsaSBlbGVtZW50aSBmaW5jaMOpIHNlcnZlLlxuICAgIGNvbnN0IG9yaWdpbmFscyA9IFsuLi50aGlzLmdyb3VwLmNoaWxkcmVuXTtcbiAgICBsZXQgZ3VhcmQgPSAwO1xuICAgIHdoaWxlICh0aGlzLmdyb3VwLnNjcm9sbFdpZHRoIDwgdGhpcy5jbGllbnRXaWR0aCAmJiBvcmlnaW5hbHMubGVuZ3RoICYmIGd1YXJkIDwgMTIpIHtcbiAgICAgIG9yaWdpbmFscy5mb3JFYWNoKChpdGVtKSA9PiB0aGlzLmdyb3VwLmFwcGVuZCh0aGlzLmhpZGRlbkNsb25lKGl0ZW0pKSk7XG4gICAgICBndWFyZCArPSAxO1xuICAgIH1cbiAgICBjb25zdCBjb3B5ID0gdGhpcy5oaWRkZW5DbG9uZSh0aGlzLmdyb3VwKTtcbiAgICBjb3B5LnJlbW92ZUF0dHJpYnV0ZSgnZGF0YS10aWNrZXItZ3JvdXAnKTtcbiAgICB0aGlzLnRyYWNrLmFwcGVuZChjb3B5KTtcblxuICAgIGNvbnN0IHNwZWVkID0gTnVtYmVyKHRoaXMuZGF0YXNldC5zcGVlZCkgfHwgNDA7XG4gICAgdGhpcy5zdHlsZS5zZXRQcm9wZXJ0eSgnLS10aWNrZXItZHVyYXRpb24nLCBgJHsodGhpcy5ncm91cC5zY3JvbGxXaWR0aCAvIHNwZWVkKS50b0ZpeGVkKDIpfXNgKTtcbiAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS1yZWFkeScsICcnKTtcbiAgfVxuXG4gIGhpZGRlbkNsb25lKG5vZGUpIHtcbiAgICBjb25zdCBjbG9uZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgIGNsb25lLnNldEF0dHJpYnV0ZSgnYXJpYS1oaWRkZW4nLCAndHJ1ZScpO1xuICAgIGNsb25lLnF1ZXJ5U2VsZWN0b3JBbGwoJ2EsIGJ1dHRvbicpLmZvckVhY2goKGVsKSA9PiBlbC5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJy0xJykpO1xuICAgIGlmIChjbG9uZS5tYXRjaGVzKCdhLCBidXR0b24nKSkgY2xvbmUuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICctMScpO1xuICAgIHJldHVybiBjbG9uZTtcbiAgfVxuXG4gIHNldFBhdXNlZChwYXVzZWQpIHtcbiAgICB0aGlzLnRvZ2dsZUF0dHJpYnV0ZSgnZGF0YS1wYXVzZWQnLCBwYXVzZWQpO1xuICAgIGlmICghdGhpcy50b2dnbGUpIHJldHVybjtcbiAgICB0aGlzLnRvZ2dsZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIFN0cmluZyhwYXVzZWQpKTtcbiAgICB0aGlzLnRvZ2dsZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBwYXVzZWQgPyB0aGlzLnRvZ2dsZS5kYXRhc2V0LmxhYmVsUGxheSA6IHRoaXMudG9nZ2xlLmRhdGFzZXQubGFiZWxQYXVzZSk7XG4gIH1cbn1cbmRlZmluZSgndGlja2VyLXN0cmlwJywgVGlja2VyU3RyaXApO1xuXG4vKiAtLS0tLS0tLS0tIFByb2RvdHRpIGNvbnNpZ2xpYXRpIChjYXJpY2F0aSBxdWFuZG8gc3Rhbm5vIHBlciBlbnRyYXJlIG5lbGxvIHNjaGVybW8pIC0tLS0tLS0tLS0gKi9cbmNsYXNzIFByb2R1Y3RSZWNvbW1lbmRhdGlvbnMgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IEludGVyc2VjdGlvbk9ic2VydmVyKFxuICAgICAgKGVudHJpZXMpID0+IHtcbiAgICAgICAgaWYgKCFlbnRyaWVzWzBdLmlzSW50ZXJzZWN0aW5nKSByZXR1cm47XG4gICAgICAgIG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgdGhpcy5sb2FkKCk7XG4gICAgICB9LFxuICAgICAgeyByb290TWFyZ2luOiAnMHB4IDBweCA0MDBweCAwcHgnIH0sXG4gICAgKTtcbiAgICBvYnNlcnZlci5vYnNlcnZlKHRoaXMpO1xuICB9XG5cbiAgYXN5bmMgbG9hZCgpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh0aGlzLmRhdGFzZXQudXJsKTtcbiAgICAgIGNvbnN0IGRvYyA9IHBhcnNlSFRNTChhd2FpdCByZXNwb25zZS50ZXh0KCkpO1xuICAgICAgY29uc3QgY29udGVudCA9IGRvYy5xdWVyeVNlbGVjdG9yKCdwcm9kdWN0LXJlY29tbWVuZGF0aW9ucycpO1xuICAgICAgaWYgKGNvbnRlbnQgJiYgY29udGVudC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1yZWNvbW1lbmRhdGlvbnMtbGlzdF0nKSkge1xuICAgICAgICB0aGlzLmlubmVySFRNTCA9IGNvbnRlbnQuaW5uZXJIVE1MO1xuICAgICAgICBpbml0UmV2ZWFsKHRoaXMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jbG9zZXN0KCcuc2hvcGlmeS1zZWN0aW9uJyk/LnNldEF0dHJpYnV0ZSgnaGlkZGVuJywgJycpO1xuICAgICAgfVxuICAgIH0gY2F0Y2gge1xuICAgICAgdGhpcy5jbG9zZXN0KCcuc2hvcGlmeS1zZWN0aW9uJyk/LnNldEF0dHJpYnV0ZSgnaGlkZGVuJywgJycpO1xuICAgIH1cbiAgfVxufVxuZGVmaW5lKCdwcm9kdWN0LXJlY29tbWVuZGF0aW9ucycsIFByb2R1Y3RSZWNvbW1lbmRhdGlvbnMpO1xuXG4vKiAtLS0tLS0tLS0tIFZpZGVvIGNvbiBhbnRlcHJpbWEgKGNhcmljYSBpbCBwbGF5ZXIgc29sbyBhbCBjbGljKSAtLS0tLS0tLS0tICovXG5jbGFzcyBEZWZlcnJlZE1lZGlhIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICB0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWRlZmVycmVkLXBsYXldJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgY29uc3QgdGVtcGxhdGUgPSB0aGlzLnF1ZXJ5U2VsZWN0b3IoJ3RlbXBsYXRlJyk7XG4gICAgICBpZiAoIXRlbXBsYXRlKSByZXR1cm47XG4gICAgICBjb25zdCBjb250ZW50ID0gdGVtcGxhdGUuY29udGVudC5maXJzdEVsZW1lbnRDaGlsZC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICB0aGlzLnJlcGxhY2VDaGlsZHJlbihjb250ZW50KTtcbiAgICAgIGlmIChjb250ZW50LnRhZ05hbWUgPT09ICdWSURFTycpIGNvbnRlbnQucGxheT8uKCk7XG4gICAgICBjb250ZW50LmZvY3VzPy4oKTtcbiAgICB9KTtcbiAgfVxufVxuZGVmaW5lKCdkZWZlcnJlZC1tZWRpYScsIERlZmVycmVkTWVkaWEpO1xuXG4vKiAtLS0tLS0tLS0tIFNlbGV0dG9yaSBwYWVzZS9saW5ndWEgLS0tLS0tLS0tLSAqL1xuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGV2ZW50KSA9PiB7XG4gIGNvbnN0IHNlbGVjdCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCdzZWxlY3RbZGF0YS1hdXRvc3VibWl0XScpO1xuICBpZiAoc2VsZWN0KSBzZWxlY3QuZm9ybT8uc3VibWl0KCk7XG59KTtcblxuLyogLS0tLS0tLS0tLSBBdnZpbyBlIHRoZW1lIGVkaXRvciAtLS0tLS0tLS0tICovXG5pbml0SGVhZGVyU2Nyb2xsKCk7XG5pbml0UmV2ZWFsKCk7XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Nob3BpZnk6c2VjdGlvbjpsb2FkJywgKGV2ZW50KSA9PiB7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1twb3BvdmVyXTpwb3BvdmVyLW9wZW4nKS5mb3JFYWNoKChlbCkgPT4gZWwuaGlkZVBvcG92ZXIoKSk7XG4gIGluaXRIZWFkZXJTY3JvbGwoKTtcbiAgaW5pdFJldmVhbChldmVudC50YXJnZXQpO1xufSk7XG4iXSwiZmlsZSI6InRoZW1lLUJ2b3ZvTkY1LmpzIn0=