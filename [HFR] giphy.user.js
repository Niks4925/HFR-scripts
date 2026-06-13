// ==UserScript==
// @name         [HFR] Giphy
// @version      0.7.0
// @namespace    http://tampermonkey.net/
// @description  Ajoute la recherche et l'insertion de gifs via Giphy, Klipy et 7tv
// @author       Garath_
// @match        https://forum.hardware.fr/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hardware.fr
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

/**
 * ===== ARCHITECTURE EXTENSIBLE =====
 *
 * Ce script offre une architecture modulaire pour ajouter facilement de nouveaux services de GIF.
 *
 * Composants principaux :
 * 1. GifService (classe abstraite) : interface commune pour tous les services
 * 2. Services concrets : Giphy, Klipy, Seven (implémentent GifService)
 * 3. ServiceRegistry : registre centralisé pour gérer les services
 * 4. Helpers : createImageElement(), appendImageBeforeSentinel(), safeFetchJson()
 *
 * Pour ajouter un nouveau service :
 *  - Créer une classe qui extends GifService
 *  - Implémenter : buildUrl(), parseResponse(), itemToImageData()
 *  - Enregistrer via ServiceRegistry.register()
 *  - Voir ADDING_SERVICES.md pour plus de détails
 *
 * Template Method Pattern :
 *  - GifService.search() gère le flux global (abort, fetch, parse, display, cleanup)
 *  - Les sous-classes définissent les comportements spécifiques
 *  - Hooks optionnels : onSearchStart(), onSearchEnd(), buildFetchOptions()
 */

(function() {
    'use strict';
    const PROXY = "https://hfr-gifs.niks4925.workers.dev";
    const MIN_QUERY_LENGTH = 3;
    const DEBOUNCE_MS = 700;

    const style = document.createElement('style');
    style.textContent = `
        #gif-results {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            padding: 4px 0;
            overflow-y: auto;
            max-height: 300px;
        }
        #gif-results img {
            height: 100px;
            width: auto;
            border-radius: 3px;
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        #gif-results img:hover {
            transform: scale(1.1);
            box-shadow: 0 3px 10px rgba(0,0,0,0.5);
            position: relative;
            z-index: 10;
        }
    `;
    document.head.appendChild(style);

    // ===== Utils réseau et images partagées =====

    /**
     * Récupère du JSON en toute sécurité avec gestion AbortController et vérification HTTP
     */
    async function safeFetchJson(url, options = {}, controller = null) {
        if (controller) options.signal = controller.signal;
        try {
            const resp = await fetch(url, options);
            if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
            return await resp.json();
        } catch (err) {
            if (err instanceof Error) {
                throw err;
            }
            throw new Error(String(err));
        }
    }

    /**
     * Crée un élément img avec événements et gestion d'erreur
     * @param {Object} imageData - { thumb, full, alt, title }
     * @param {GifService} service - la référence au service pour addGifToForm
     * @return {HTMLImageElement}
     */
    function createImageElement(imageData, service) {
        const { thumb, full, alt = '', title = '' } = imageData;
        const image = document.createElement('img');
        image.src = thumb;
        image.setAttribute('loading', 'lazy');
        image.alt = alt;
        image.title = title || alt;
        image.tabIndex = 0;
        image.addEventListener('click', () => service.addGifToForm(full));
        image.addEventListener('keydown', (e) => { if (e.key === 'Enter') image.click(); });
        image.addEventListener('error', () => { image.src = thumb + '?retry=' + Date.now(); });
        return image;
    }

    /**
     * Ajoute une image avant le sentinel ou à la fin si pas de sentinel
     */
    function appendImageBeforeSentinel(image, container) {
        const s = container.querySelector('.gif-sentinel');
        if (s) container.insertBefore(image, s);
        else container.appendChild(image);
    }

    // ===== Classe abstraite GifService =====

    /**
     * Classe de base pour tous les services de gif.
     *
     * À implémenter dans les sous-classes :
     * - buildUrl(query, offset) : retourne l'URL de la requête
     * - parseResponse(data) : retourne { items: [...], nextOffset?: value }
     * - itemToImageData(item) : retourne { thumb, full, alt?, title? }
     *
     * Le processus search() effectue automatiquement :
     * 1. Vérifie _loading (protection concurrence)
     * 2. Crée AbortController et appelle buildUrl
     * 3. Récupère et parse la réponse
     * 4. Crée et affiche les images
     * 5. Met à jour l'offset (nextOffset pour pagination)
     */
    class GifService {
        constructor(endpoint) {
            if (new.target === GifService) {
                throw new TypeError("GifService est une classe abstraite et ne peut pas être instanciée.");
            }
            this.endpoint = endpoint;
            this._controller = null;
            this._loading = false;
        }

        /**
         * Construit l'URL de recherche. À surcharger.
         * @param {string} query
         * @param {number} offset
         * @return {string}
         */
        buildUrl(_query, _offset) {
            throw new Error("buildUrl() doit être implémentée dans les sous-classes.");
        }

        /**
         * Parse la réponse JSON et extrait items + offset suivant. À surcharger.
         * @param {any} data - réponse JSON brute
         * @return {{ items: Array, nextOffset?: any }}
         */
        parseResponse(_data) {
            throw new Error("parseResponse() doit être implémentée dans les sous-classes.");
        }

        /**
         * Convertit un item d'API en structure { thumb, full, alt?, title? }. À surcharger.
         * @param {any} item - item brut de l'API
         * @return {{ thumb, full, alt?, title? }}
         */
        itemToImageData(_item) {
            throw new Error("itemToImageData() doit être implémentée dans les sous-classes.");
        }

        /**
         * Hook appelé avant de commencer une recherche (reinitilize offsets, flags, etc.)
         * @param {number} offset
         */
        onSearchStart(_offset) {}

        /**
         * Hook appelé après fin de recherche (succès ou erreur)
         */
        onSearchEnd() {}

        /**
         * Lance la recherche et affiche les résultats. Template Method pattern.
         */
        async search(query, offset, container) {
            if (this._loading) return;
            this._loading = true;

            this.abortOngoing();
            this._controller = new AbortController();
            this.onSearchStart(offset);

            try {
                const url = this.buildUrl(query, offset);
                const fetchOptions = {};
                const data = await safeFetchJson(url, fetchOptions, this._controller);
                const { items = [], nextOffset } = this.parseResponse(data);

                if (nextOffset !== undefined) {
                    this._nextOffset = nextOffset;
                }

                items.forEach(item => {
                    try {
                        const imageData = this.itemToImageData(item);
                        if (!imageData?.thumb || !imageData?.full) return;
                        const image = createImageElement(imageData, this);
                        appendImageBeforeSentinel(image, container);
                    } catch (e) {
                        console.warn(`${this.constructor.name}: erreur création image pour item:`, item, e);
                    }
                });
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error(`${this.constructor.name} fetch error:`, err);
                showStatus(`Erreur ${this.constructor.name}: ${err.message}`);
            } finally {
                this._controller = null;
                this._loading = false;
                this.onSearchEnd();
            }
        }

        abortOngoing() {
            if (this._controller) {
                try {
                    this._controller.abort();
                } catch (e) {
                    // Intentionally ignore abort errors
                }
                this._controller = null;
            }
        }

        addGifToForm(url) {
            if (!content_form) {
                alert("Champ de contenu introuvable : impossible d'insérer le gif.");
                return;
            }
            try {
                const start = content_form.selectionStart ?? content_form.value.length;
                const end = content_form.selectionEnd ?? start;
                const before = content_form.value.slice(0, start);
                const after = content_form.value.slice(end);
                const insert = `[img]${url}[/img]`;
                content_form.value = before + insert + after;
                const caret = before.length + insert.length;
                content_form.setSelectionRange && content_form.setSelectionRange(caret, caret);
                content_form.focus && content_form.focus();
            } catch (e) {
                console.error('Erreur insertion gif:', e);
            }
        }
    }

    class Giphy extends GifService {
        constructor() {
            super(`${PROXY}/giphy`);
        }

        buildUrl(query, offset) {
            return `${this.endpoint}?q=${encodeURIComponent(query)}&offset=${offset}&_ts=${Date.now()}`;
        }

        parseResponse(data) {
            return { items: data?.data ?? [] };
        }

        itemToImageData(item) {
            const thumb = item?.images?.fixed_width_small?.url ?? item?.images?.preview_gif?.url;
            const full = item?.images?.downsized?.url ?? item?.images?.original?.url;
            return {
                thumb,
                full,
                alt: item?.title ?? item?.slug ?? '',
                title: item?.title ?? item?.slug ?? ''
            };
        }
    }

    class Klipy extends GifService {
        #next = null;
        #lastSent = null;

        constructor() {
            super(`${PROXY}/klipy`);
        }

        onSearchStart(offset) {
            if (offset === 0) {
                this.#next = null;
                this.#lastSent = null;
            }
        }

        buildUrl(query, offset) {
            const posToSend = this.#next ?? '';
            // éviter d'envoyer plusieurs fois la même position
            if (offset !== 0 && posToSend && posToSend === this.#lastSent) {
                throw new Error('Klipy: même position que précédente, aucun progrès.');
            }
            this.#lastSent = posToSend;
            return `${this.endpoint}?q=${encodeURIComponent(query)}&pos=${posToSend}&_ts=${Date.now()}`;
        }

        parseResponse(data) {
            this.#next = data?.next ?? null;
            return { items: data?.results ?? [] };
        }

        itemToImageData(item) {
            const thumb = item?.media_formats?.nanogif?.url ?? item?.media_formats?.gif?.url;
            const full = item?.media_formats?.webp?.url ?? thumb;
            return {
                thumb,
                full,
                alt: item?.slug ?? item?.defaultName ?? '',
                title: item?.slug ?? item?.defaultName ?? ''
            };
        }
    }

    class Seven extends GifService {
        #ended = false;
        #page = 1;

        constructor() {
            super("https://7tv.io/v4/gql");
        }

        onSearchStart(offset) {
            if (offset === 0) {
                this.#ended = false;
                this.#page = 1;
            }
        }

        buildUrl(_query, _offset) {
            return this.endpoint + `?_ts=${Date.now()}`;
        }

        /**
         * Pour Seven, buildUrl retourne juste l'endpoint.
         * On doit retourner les options de fetch (POST, body) depuis une autre méthode.
         * On va surcharger search() pour cet appel spécial.
         */
        buildFetchOptions(query) {
            const gql = `query($query: String!, $page: Int!, $perPage: Int!, $sort: Sort!, $filters: Filters) {\n  emotes {\n    search(query: $query perPage: $perPage page: $page sort: $sort filters: $filters) {\n      items { id defaultName aspectRatio }\n      totalCount\n      pageCount\n    }\n  }\n}`;
            return {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: gql,
                    variables: {
                        query: query,
                        page: this.#page,
                        perPage: 50,
                        sort: { sortBy: "TOP_ALL_TIME", order: "DESCENDING" },
                        filters: { exactMatch: false }
                    }
                })
            };
        }

        parseResponse(data) {
            const searchData = data?.data?.emotes?.search;
            if (!searchData) return { items: [] };
            this.#ended = this.#page === searchData.pageCount;
            ++this.#page;
            return { items: searchData.items ?? [] };
        }

        itemToImageData(item) {
            return {
                thumb: "https://cdn.7tv.app/emote/" + item.id + "/4x.avif",
                full: "https://cdn.7tv.app/emote/" + item.id + "/4x.avif",
                alt: item.defaultName ?? '',
                title: item.defaultName ?? ''
            };
        }

        async search(query, offset, container) {
            if (this._loading) return;
            this._loading = true;

            this.abortOngoing();
            this._controller = new AbortController();
            this.onSearchStart(offset);

            if (this.#ended) {
                this._loading = false;
                return;
            }

            try {
                const url = this.buildUrl(query, offset);
                const fetchOptions = this.buildFetchOptions(query);
                const data = await safeFetchJson(url, fetchOptions, this._controller);
                const { items = [] } = this.parseResponse(data);

                items.forEach(item => {
                    try {
                        const imageData = this.itemToImageData(item);
                        if (!imageData?.thumb || !imageData?.full) return;
                        const image = createImageElement(imageData, this);
                        appendImageBeforeSentinel(image, container);
                    } catch (e) {
                        console.warn(`${this.constructor.name}: erreur création image pour item:`, item, e);
                    }
                });
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error(`${this.constructor.name} fetch error:`, err);
                showStatus(`Erreur ${this.constructor.name}: ${err.message}`);
            } finally {
                this._controller = null;
                this._loading = false;
                this.onSearchEnd();
            }
        }
    }

    /**
     * Registre centralisé pour tous les services de gif
     */
    const ServiceRegistry = {
        _services: {},

        /**
         * Enregistre un nouveau service
         * @param {string} id - identifiant unique du service (ex: 'giphy')
         * @param {string} label - label affiché dans le select (ex: 'Giphy')
         * @param {GifService} instance - instance du service
         */
        register(id, label, instance) {
            this._services[id] = { label, instance };
        },

        /**
         * Récupère une instance de service
         * @param {string} id
         * @return {GifService|undefined}
         */
        get(id) {
            return this._services[id]?.instance;
        },

        /**
         * Retourne tous les services enregistrés
         * @return {Array} [{ id, label, instance }, ...]
         */
        getAll() {
            return Object.entries(this._services).map(([id, { label, instance }]) => ({ id, label, instance }));
        },

        /**
         * Retourne les options pour un <select> HTML
         * @return {Array} [{ value, label }, ...]
         */
        getSelectOptions() {
            return Object.entries(this._services).map(([id, { label }]) => ({ value: id, label }));
        }
    };

    // Enregistrer les services via le registre centralisé
    ServiceRegistry.register('giphy', 'Giphy', new Giphy());
    ServiceRegistry.register('klipy', 'Klipy', new Klipy());
    ServiceRegistry.register('seven', '7tv', new Seven());

    let content_form = document.querySelector("#content_form");
    if (!content_form) {
        console.warn("[HFR] giphy: #content_form introuvable — arrêt du script.");
        return;
    }
    const placeholder = content_form.parentElement;
    placeholder.appendChild(document.createElement("br"));

    const gif = document.createElement("div");
    gif.setAttribute("id", "gif");

    const serviceSelector = document.createElement('select');
    serviceSelector.style.margin = "0 5px 0 0";

    // Créer les options du select à partir du registre
    ServiceRegistry.getSelectOptions().forEach(({ value, label }) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        serviceSelector.appendChild(opt);
    });

    serviceSelector.value = GM_getValue('selectedService', 'giphy');
    serviceSelector.addEventListener('change', () => {
        GM_setValue('selectedService', serviceSelector.value);
        update();
    });

    const input_text = document.createElement("input");
    input_text.setAttribute("type", "text");
    input_text.style.verticalAlign = "bottom";
    input_text.addEventListener('input', delay(update, DEBOUNCE_MS), false);

    const results = document.createElement("div");
    results.setAttribute("id", "gif-results");
    results.style.margin = "5px 0 0 0";

    let loading = false;
    const status = document.createElement('div');
    status.style.margin = '6px 0 0 6px';
    status.style.fontSize = '12px';
    status.style.color = '#666';
    status.textContent = '';
    function showStatus(text, ttl = 5000) {
        status.textContent = text || '';
        if (!text) return;
        setTimeout(() => { if (status.textContent === text) status.textContent = ''; }, ttl);
    }

    const sentinel = document.createElement('div');
    sentinel.className = 'gif-sentinel';
    sentinel.style.flexBasis = '100%';
    sentinel.style.width = '1px';
    sentinel.style.height = '1px';
    sentinel.style.order = '9999';

    const observer = new IntersectionObserver((entries) => {
        const e = entries[0];
        if (!e.isIntersecting) return;
        if (loading) return;
        const q = input_text.value.trim();
        if (q.length < MIN_QUERY_LENGTH) return;
        loading = true;
        getService()
            .search(q, results.querySelectorAll('img').length, results)
            .finally(() => { loading = false; });
    }, { root: results, rootMargin: '200px' });

    gif.appendChild(serviceSelector);
    gif.appendChild(input_text);
    gif.appendChild(results);
    gif.appendChild(status);
    results.appendChild(sentinel);
    observer.observe(sentinel);
    placeholder.appendChild(gif);

    results.addEventListener('scroll', throttle(() => {
        if (loading) return;
        const nearBottom = results.scrollTop + results.clientHeight >= results.scrollHeight - 50;
        if (nearBottom) {
            loading = true;
            const q = input_text.value.trim();
            if (q.length >= MIN_QUERY_LENGTH) {
                getService().search(q, results.querySelectorAll('img').length, results)
                    .finally(() => { loading = false; });
            } else {
                loading = false;
            }
        }
    }, 150));

    function getService() {
        const serviceId = serviceSelector.value;
        const service = ServiceRegistry.get(serviceId);
        if (!service) {
            console.warn(`Service "${serviceId}" non trouvé dans le registre`);
            return ServiceRegistry.get('giphy'); // fallback
        }
        return service;
    }

    function delay(fn, ms) {
        let timer = 0;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(fn.bind(this, ...args), ms || 0);
        }
    }

    // throttle simple pour scroll fallback
    function throttle(fn, ms) {
        let last = 0;
        return function(...args) {
            const now = Date.now();
            if (now - last > ms) {
                last = now;
                fn.apply(this, args);
            }
        }
    }

     function update() {
         results.innerHTML = '';
         // réapposer le sentinel en bas
         results.appendChild(sentinel);
         // ré-observer le sentinel (certaines implémentations peuvent cesser d'observer après retrait)
         try {
             observer.observe(sentinel);
         } catch (e) {
             // Intentionally ignore if already observing
         }
         loading = false;
        if (input_text.value.trim().length >= 3) {
            results.style.overflowY = "auto";
            results.style.maxHeight = "300px";
            results.style.height = "auto";
            getService().search(input_text.value.trim(), 0, results);
        } else {
            results.style.overflowY = null;
            results.style.maxHeight = null;
            results.style.height = null;
        }
    }

})();