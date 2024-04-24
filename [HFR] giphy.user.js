// ==UserScript==
// @name         [HFR] Giphy
// @version      0.1
// @namespace    http://tampermonkey.net/
// @description  Ajoute la recherche et l'insertion de gifs via Giphy
// @author       Garath_
// @match        https://forum.hardware.fr/message.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hardware.fr
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let content_form = document.querySelector("#content_form");
    let placeholder = document.querySelector("#hop > table > tbody > tr:nth-child(5) > td");
    placeholder.appendChild(document.createElement("br"));

    let giphy = document.createElement("div");
    giphy.setAttribute("id", "giphy");
    let results = document.createElement("div");
    let icon = document.createElement("img");
    icon.src = "data:image/png;base64,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";
    icon.alt = "Giphy icon";
    icon.style = "margin-right:5px";
    let input_text = document.createElement("input");
    input_text.setAttribute("type", "text");
    input_text.style = "vertical-align: bottom";
    input_text.addEventListener('keyup', delay(function() {
        results.innerHTML = '';
        if (input_text.value.length >= 3) {
            results.style.overflowY = "scroll";
            results.style.height = "300px";
            searchGifs(input_text.value);
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
            searchGifs(input_text.value, offset);
        }
    });
    giphy.appendChild(icon);
    giphy.appendChild(input_text);
    giphy.appendChild(results);

    placeholder.appendChild(giphy);


    function searchGifs(query, offset) {
        let api_url = "https://api.giphy.com/v1/gifs/search?";
        let api_key = "mqYeZBg0TaUFT39vkTVwUNx9QWCAS8Fi";

        fetch(api_url + new URLSearchParams({
            api_key: api_key,
            q: query,
            offset: offset
        }))
            .then((response) => response.json())
            .then((json) => displayGifs(json.data));
    }

    function displayGifs(giphy_response) {
        giphy_response.forEach(function(gif){
            let image = document.createElement('img');
            image.src = gif.images.fixed_width_small.url;
            image.addEventListener('click', function(ev){addGif(gif.images.downsized.url)});
            results.appendChild(image);
        });
    }

    function addGif(url) {
        content_form.value += "[img]" + url + "[/img]";
    }

    function delay(fn, ms) {
        let timer = 0
        return function(...args) {
            clearTimeout(timer)
            timer = setTimeout(fn.bind(this, ...args), ms || 0)
        }
    }

})();
