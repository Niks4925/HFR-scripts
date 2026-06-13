// ==UserScript==
// @name         [HFR] Giphy
// @version      0.6.2
// @namespace    http://tampermonkey.net/
// @description  Ajoute la recherche et l'insertion de gifs via Giphy, Klipy et 7tv
// @author       Garath_
// @match        https://forum.hardware.fr/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hardware.fr
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';
    const PROXY = "https://hfr-gifs.niks4925.workers.dev";

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

    class GifService {
        constructor(endpoint) {
            if (new.target === GifService) {
                throw new TypeError("GifService est une classe abstraite et ne peut pas être instanciée.");
            }
            this.endpoint = endpoint;
        }

        async search(query) {
            throw new Error("La méthode 'search' doit être implémentée dans les classes dérivées.");
        }

        addGifToForm(url) {
            content_form.value += "[img]" + url + "[/img]";
        }
    }

    class Giphy extends GifService {
        constructor() {
            super(`${PROXY}/giphy`);
        }

        async search(query, offset, container) {
            const url = `${this.endpoint}?q=${encodeURIComponent(query)}&offset=${offset}`;
            const response = await fetch(url);
            const data = await response.json();
            this._displayGifs(data.data, container);
        }

        _displayGifs(gifData, container) {
            gifData.forEach(gif => {
                const image = document.createElement('img');
                image.src = gif.images.fixed_width_small.url;
                image.addEventListener('click', () => {
                    this.addGifToForm(gif.images.downsized.url);
                });
                container.appendChild(image);
            });
        }
    }

    class Klipy extends GifService {
        #next = null;

        constructor() {
            super(`${PROXY}/klipy`);
        }

        async search(query, offset, container) {
            if (offset == 0) this.#next = null;
            const url = `${this.endpoint}?q=${encodeURIComponent(query)}&pos=${this.#next ?? ''}`;
            const response = await fetch(url);
            const data = await response.json();
            this.#next = data.next;
            this._displayGifs(data.results, container);
        }

        _displayGifs(gifData, container) {
            gifData.forEach(gif => {
                const image = document.createElement('img');
                image.src = gif.media_formats.nanogif.url;
                image.addEventListener('click', () => {
                    this.addGifToForm(gif.media_formats.webp.url);
                });
                container.appendChild(image);
            });
        }
    }

    class Seven extends GifService {
        #ended = false;
        #next = 1;

        constructor() {
            super("https://7tv.io/v4/gql");
        }

        async search(query, offset, container) {
            if (offset == 0) {
                this.#ended = false;
                this.#next = 1;
            }

            if (this.#ended) return;

            try {
                const response = await fetch(this.endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: `query seven($soso: Sort!, $fifi: Filters) {
                          emotes {
                            search(
                              query: "${query}"
                              perPage: 50
                              page: ${this.#next}
                              sort: $soso
                              filters: $fifi
                            ) {
                              items {
                                id
                                defaultName
                                aspectRatio
                              }
                              totalCount
                              pageCount
                            }
                          }
                        }`,
                        variables: {
                            soso: { sortBy: "TOP_ALL_TIME", order: "DESCENDING" },
                            fifi: { exactMatch: false }
                        }
                    })
                });

                const data = await response.json();
                this.#ended = this.#next === data.data.emotes.search.pageCount;
                ++this.#next;
                this._displayGifs(data.data.emotes.search.items, container);
            } catch (error) {
                console.error("Erreur lors de la recherche Seven:", error);
            }
        }

        _displayGifs(gifData, container) {
            gifData.forEach(gif => {
                const image = document.createElement('img');
                image.src = "https://cdn.7tv.app/emote/" + gif.id + "/4x.avif";
                image.setAttribute("title", gif.defaultName);
                image.setAttribute("loading", "lazy");
                image.addEventListener('click', () => {
                    this.addGifToForm(image.getAttribute("src"));
                });
                image.addEventListener('error', () => {
                    image.src = "https://cdn.7tv.app/emote/" + gif.id + "/4x.avif?retry=" + Date.now();
                });
                container.appendChild(image);
            });
        }
    }

    let content_form = document.querySelector("#content_form");
    const placeholder = content_form.parentElement;
    placeholder.appendChild(document.createElement("br"));

    const giphyService = new Giphy();
    const klipyService = new Klipy();
    const sevenService = new Seven();

    const gif = document.createElement("div");
    gif.setAttribute("id", "gif");

    const serviceSelector = document.createElement('select');
    serviceSelector.style.margin = "0 5px 0 0";

    [['giphy', 'Giphy'], ['klipy', 'Klipy'], ['seven', '7tv']].forEach(([value, label]) => {
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
    input_text.addEventListener('input', delay(update, 700), false); // corrige les doubles requêtes

    const results = document.createElement("div");
    results.setAttribute("id", "gif-results");
    results.style.margin = "5px 0 0 0";

    let loading = false;

    results.addEventListener("scroll", () => {
        const isBottom = results.scrollTop + results.clientHeight >= results.scrollHeight - 5;
        if (isBottom && !loading) {
            loading = true;
            getService()
                .search(input_text.value.trim(), results.children.length, results)
                .finally(() => { loading = false; });
        }
    });

    gif.appendChild(serviceSelector);
    gif.appendChild(input_text);
    gif.appendChild(results);
    placeholder.appendChild(gif);

    function getService() {
        const v = serviceSelector.value;
        if (v === 'giphy') return giphyService;
        if (v === 'klipy') return klipyService;
        if (v === 'seven') return sevenService;
    }

    function delay(fn, ms) {
        let timer = 0;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(fn.bind(this, ...args), ms || 0);
        }
    }

    function update() {
        results.innerHTML = '';
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