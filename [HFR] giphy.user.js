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
    icon.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAbBAMAAABhM9nVAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAALVBMVEUAAAD/Zmb/81zMukv/ZmbJwEmfjzqZkjcA/5kAAAAQBgZcH5l5KMmZM/8AzP/C9+pjAAAAAnRSTlMAEGsk3VwAAAABYktHRACIBR1IAAAACXBIWXMAAAsSAAALEgHS3X78AAAAPklEQVQY02NQAgFlF0cGIACzwxBs1TIIu6Nz5syZs1xcXIhhuzjgZ4PA7gMI9p4LCPZZJPbdwcF+BwcPcLEB6bOlnE3/uFMAAAAASUVORK5CYII=";
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
