// ==UserScript==
// @name         [HFR] Giphy
// @version      0.5
// @namespace    http://tampermonkey.net/
// @description  Ajoute la recherche et l'insertion de gifs via Giphy, Tenor et 7tv
// @author       Garath_
// @match        https://forum.hardware.fr/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hardware.fr
// @grant        none
// ==/UserScript==


(function() {
    'use strict';

    class GifService {
        #apiKey;

        constructor(endpoint) {
            if (new.target === GifService) {
                throw new TypeError("GifService est une classe abstraite et ne peut pas être instanciée.");
            }
            this.endpoint = endpoint;
        }

        async search(query) {
            throw new Error("La méthode 'search' doit être implémentée dans les classes dérivées.");
        }

        // Ajout du GIF cliqué à la page
        addGifToForm(url) {
            content_form.value += "[img]" + url + "[/img]";
        }
    }

    class Giphy extends GifService {
        #apiKey = "GIPHY_KEY";

        constructor() {
            super("https://api.giphy.com/v1/gifs/search");
        }

        async search(query, offset, container) {
            const url = `${this.endpoint}?api_key=${this.#apiKey}&q=${encodeURIComponent(query)}&limit=50&offset=${encodeURIComponent(offset)}`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                this._displayGifs(data.data, container);
            } catch (error) {
                console.error("Erreur lors de la recherche Giphy:", error);
                return [];
            }
        }

        _displayGifs(gifData, container) {
            gifData.forEach(gif => {
                const image = document.createElement('img');
                image.src = gif.images.fixed_width_small.url;
                image.style.margin = "0 5px 5px 0";

                image.addEventListener('click', () => {
                    this.addGifToForm(gif.images.downsized.url);
                });

                container.appendChild(image);
            });
        }
    }

    class Tenor extends GifService {
        #apiKey = "AIzaSyBfOwbqJ2jquGzlFS16_My8JO-ndCditCk";
        #next = null;

        constructor() {
            super("https://tenor.googleapis.com/v2/search");
        }

        async search(query, offset, container) {
            if (offset == 0) {
                this.#next = null;
            }

            const url = `${this.endpoint}?key=${this.#apiKey}&q=${encodeURIComponent(query)}&locale=fr_FR&country=FR&limit=50&pos=${this.#next}`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                this.#next = data.next;
                this._displayGifs(data.results, container);
            } catch (error) {
                console.error("Erreur lors de la recherche Tenor:", error);
                return [];
            }
        }

        _displayGifs(gifData, container) {
            gifData.forEach(gif => {
                const image = document.createElement('img');
                image.src = gif.media_formats.nanogif.url;
                image.style.margin = "0 5px 5px 0";

                image.addEventListener('click', () => {
                    this.addGifToForm(gif.media_formats.webp.url);
                });

                container.appendChild(image);
            });
        }
    }

    class Seven extends GifService {
        #apiKey = "prout";
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

            if (this.#ended) {
                return;
            }

            try {
                const response = await fetch(this.endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
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
                            soso: {
                                sortBy: "TOP_ALL_TIME",
                                order: "DESCENDING"
                            },
                            fifi: {
                                exactMatch: false
                            }
                        }
                    })
                });

                const data = await response.json();
                this.#ended = this.#next === data.data.emotes.search.pageCount;
                ++this.#next;
                this._displayGifs(data.data.emotes.search.items, container);
            } catch (error) {
                console.error("Erreur lors de la recherche Seven:", error);
                return [];
            }
        }

        _displayGifs(gifData, container) {
            gifData.forEach(gif => {
                const image = document.createElement('img');
                image.src = "https://cdn.7tv.app/emote/" + gif.id + "/4x.avif";
                image.setAttribute("title", gif.defaultName);
                image.setAttribute("loading", "lazy");
                image.style.margin = "0 5px 5px 0";

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

    var placeholder = null;
    let content_form = document.querySelector("#content_form");
    placeholder = content_form.parentElement;
    placeholder.appendChild(document.createElement("br"));

    const giphyService = new Giphy();
    const tenorService = new Tenor();
    const sevenService = new Seven();

    let gif = document.createElement("div");
    gif.setAttribute("id", "gif");

    const serviceSelector = document.createElement('select');
    serviceSelector.style.margin = "0 5px 0 0";
    const giphyOption = document.createElement('option');
    giphyOption.value = 'giphy';
    giphyOption.textContent = 'Giphy';

    const tenorOption = document.createElement('option');
    tenorOption.value = 'tenor';
    tenorOption.textContent = 'Tenor';

    const sevenOption = document.createElement('option');
    sevenOption.value = 'seven';
    sevenOption.textContent = '7tv';

    serviceSelector.appendChild(giphyOption);
    serviceSelector.appendChild(tenorOption);
    serviceSelector.appendChild(sevenOption);
    serviceSelector.addEventListener('change', update, false);

    let results = document.createElement("div");
    results.style.margin = "5px 0 0 0";
    let input_text = document.createElement("input");
    input_text.setAttribute("type", "text");
    input_text.style.verticalAlign = "bottom";
    input_text.addEventListener('keyup', delay(update, 500), false);
    input_text.addEventListener('paste', delay(update, 500), false);

    results.addEventListener("scroll", () => {
        const isBottom = results.scrollTop + results.clientHeight >= results.scrollHeight - 5;
        if (isBottom) {
            const offset = results.children.length;
            getService().search(input_text.value.trim(), offset, results);
        }
    });
    gif.appendChild(serviceSelector);
    gif.appendChild(input_text);
    gif.appendChild(results);

    placeholder.appendChild(gif);

    function getService() {
        const selectedService = serviceSelector.value;
        if (selectedService === 'giphy') {
            return giphyService
        } else if (selectedService === 'tenor') {
            return tenorService
        } else if (selectedService === 'seven') {
            return sevenService
        }
    }

    function delay(fn, ms) {
        let timer = 0
        return function(...args) {
            clearTimeout(timer)
            timer = setTimeout(fn.bind(this, ...args), ms || 0)
        }
    }

    function update() {
        results.innerHTML = '';
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