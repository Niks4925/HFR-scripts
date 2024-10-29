// ==UserScript==
// @name         [HFR] Giphy
// @version      0.4.1
// @namespace    http://tampermonkey.net/
// @description  Ajoute la recherche et l'insertion de gifs via Giphy et Tenor
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
        #apiKey = "mqYeZBg0TaUFT39vkTVwUNx9QWCAS8Fi";

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
                image.style.margin = "5px";

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
                image.style.margin = "5px";

                image.addEventListener('click', () => {
                    this.addGifToForm(gif.media_formats.webp.url);
                });

                container.appendChild(image);
            });
        }
    }

    var placeholder = null;
    let content_form = document.querySelector("#content_form");
    if (window.location.href.startsWith("https://forum.hardware.fr/message.php")) {
        placeholder = document.querySelector("#hop > table > tbody > tr:nth-child(5) > td");
    }
    else if (window.location.href.startsWith("https://forum.hardware.fr/forum2.php")) {
        placeholder = document.querySelector("#md_fast_search");
    }
    else {
        return
    }
    placeholder.appendChild(document.createElement("br"));

    const giphyService = new Giphy();
    const tenorService = new Tenor();

    let gif = document.createElement("div");
    gif.setAttribute("id", "gif");

    const serviceSelector = document.createElement('select');
    const giphyOption = document.createElement('option');
    giphyOption.value = 'giphy';
    giphyOption.textContent = 'Giphy';

    const tenorOption = document.createElement('option');
    tenorOption.value = 'tenor';
    tenorOption.textContent = 'Tenor';

    serviceSelector.appendChild(giphyOption);
    serviceSelector.appendChild(tenorOption);
    serviceSelector.addEventListener('change', function() {
        results.innerHTML = '';
        if (input_text.value.trim() !== "") {
            getService().search(input_text.value, 0, results);
        }
    });

    let results = document.createElement("div");
    let input_text = document.createElement("input");
    input_text.setAttribute("type", "text");
    input_text.style = "vertical-align: bottom";
    input_text.addEventListener('keyup', delay(function() {
        results.innerHTML = '';
        if (input_text.value.length >= 3) {
            results.style.overflowY = "scroll";
            results.style.height = "300px";
            getService().search(input_text.value, 0, results);
        }
        else {
            results.style.overflowY = null;
            results.style.height = null;
        }
    }, 500));

    results.addEventListener("scroll", () => {
        const isBottom = results.scrollTop + results.clientHeight >= results.scrollHeight;
        if (isBottom) {
            const offset = results.children.length;
            getService().search(input_text.value, offset, results);
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
        }
    }

    function delay(fn, ms) {
        let timer = 0
        return function(...args) {
            clearTimeout(timer)
            timer = setTimeout(fn.bind(this, ...args), ms || 0)
        }
    }

})();
