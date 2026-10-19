// ==UserScript==
// @name          [HFR] Bookmarks
// @version       1.0
// @namespace     forum.hardware.fr
// @description   Gestion de posts favoris avec stockage en MPStorage
// @icon          data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAilBMVEX%2F%2F%2F8AAADxjxvylSrzmzf5wYLzmjb%2F9er%2F%2Fv70nj32q1b5woT70qT82rT827b%2F%2B%2FjxkSHykybykyfylCjylCnzmDDzmjX0nTv1o0b1qFH2qVL2qlT3tGn4tmz4uHD4uXL5vHf83Lf83Lj937394MH%2B587%2B69f%2F8%2BX%2F8%2Bf%2F9On%2F9uz%2F%2BPH%2F%2BvT%2F%2FPmRE1AgAAAAwElEQVR42s1SyRbCIAysA7W2tdZ93%2Ff1%2F39PEtqDEt6rXnQOEMhAMkmC4E9QY9j9da1OkP%2BtTiBo1caOjGisDLRDANCk%2FVIHwwkBZGReh9avnGj2%2FWFg%2Feg5hD1bLZTwqdgU%2FlTSdrqZJWN%2FKImPOnGjiBJKhYqMvikxtlhLNTuz%2FgkxjmJRRza5mbcXpbz4zldLJ0lVEBY5nRL4CJx%2FMEfXE4L9j4Qr%2BZakpiandMpX6FO7%2FaPxxUTJI%2FsJ4cd4AoSOBgZnPvgtAAAAAElFTkSuQmCC
// @match         https://forum.hardware.fr/
// @match         https://forum.hardware.fr/forum1.php*
// @match         https://forum.hardware.fr/forum1f.php*
// @match         https://forum.hardware.fr/forum2.php*
// @match         https://forum.hardware.fr/*/liste_sujet-*.htm*
// @match         https://forum.hardware.fr/hfr/*/*-sujet_*_*.htm*
// @author        Garath_
// @authororig    nykal, roger21, Wiripse
// @run-at        document-end
// @noframes
// @grant         GM.getValue
// @grant         GM_getValue
// @grant         GM.setValue
// @grant         GM_setValue
// @require https://raw.githubusercontent.com/Wiripse/HFRGMTools/master/MPStorage.user.js
// ==/UserScript==

// Leading semicolon: the @require MPStorage code ends without one.
// eslint-disable-next-line no-extra-semi
;(function () {
    "use strict";

    // Userscript manager APIs
    const GMCompat = {
        getValue: function (key, defaultValue) {
            if (typeof GM !== "undefined" && typeof GM.getValue === "function") {
                return GM.getValue(key, defaultValue);
            }
            if (typeof GM_getValue === "function") {
                return Promise.resolve(GM_getValue(key, defaultValue));
            }
            return Promise.reject(new Error("GM.getValue is unavailable."));
        },
        setValue: function (key, value) {
            if (typeof GM !== "undefined" && typeof GM.setValue === "function") {
                return GM.setValue(key, value);
            }
            if (typeof GM_setValue === "function") {
                return Promise.resolve(GM_setValue(key, value));
            }
            return Promise.reject(new Error("GM.setValue is unavailable."));
        }
    };

    // Forum navigation
    const categoryNamesById = {
        31: "service-client-shophfr",
        32: "ia",
        1: "Hardware",
        16: "HardwarePeripheriques",
        15: "OrdinateursPortables",
        2: "OverclockingCoolingModding",
        30: "electroniquedomotiquediy",
        23: "gsmgpspda",
        25: "apple",
        3: "VideoSon",
        14: "Photonumerique",
        5: "JeuxVideo",
        4: "WindowsSoftware",
        22: "reseauxpersosoho",
        21: "systemereseauxpro",
        11: "OSAlternatifs",
        10: "Programmation",
        12: "Graphisme",
        6: "AchatsVentes",
        8: "EmploiEtudes",
        9: "Setietprojetsdistribues",
        13: "Discussions"
    };

    // MPStorage adapter
    const BookmarkStorage = {
        version: "0.1",
        toolName: "ClaudeMarks_GM",
        bookmarks: null,

        load: function () {
            return new Promise(function (resolve, reject) {
                try {
                    mpStorage.getStorageData(function (data) {
                        let versionData =
                            data &&
                            Array.isArray(data.data) &&
                            data.data.find(function (item) {
                                return BookmarkStorage.version === item.version;
                            });
                        if (!versionData) {
                            reject(
                                new Error("MPStorage data for version " + BookmarkStorage.version + " was not found.")
                            );
                            return;
                        }

                        let bookmarks = versionData.bookmarks || { list: [] };
                        if (!Array.isArray(bookmarks.list)) {
                            reject(new Error("MPStorage bookmarks list is invalid."));
                            return;
                        }

                        bookmarks.list.sort(function (a, b) {
                            return b.createDate - a.createDate;
                        });
                        BookmarkStorage.bookmarks = bookmarks;
                        resolve(bookmarks);
                    });
                } catch (error) {
                    reject(error);
                }
            });
        },

        init: async function () {
            const [username, mpId, mpRepId] = await Promise.all([
                GMCompat.getValue("mpStorage_username", void 0),
                GMCompat.getValue("mpStorage_mpId", void 0),
                GMCompat.getValue("mpStorage_mpRepId", void 0)
            ]);

            if (username && mpId && mpRepId) {
                mpStorage.username = username;
                mpStorage.mpId = mpId;
                mpStorage.mpRepId = mpRepId;
                mpStorage.initiated = true;
            } else {
                await new Promise(function (resolve, reject) {
                    try {
                        mpStorage.initStorage(function (result) {
                            if (result) {
                                resolve();
                            } else {
                                reject(new Error("MPStorage initialization failed."));
                            }
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
                await Promise.all([
                    GMCompat.setValue("mpStorage_username", mpStorage.username),
                    GMCompat.setValue("mpStorage_mpId", mpStorage.mpId),
                    GMCompat.setValue("mpStorage_mpRepId", mpStorage.mpRepId)
                ]);
            }

            return BookmarkStorage.load();
        },

        save: function (bookmarks) {
            let versionData =
                mpStorage.storageData &&
                Array.isArray(mpStorage.storageData.data) &&
                mpStorage.storageData.data.find(function (item) {
                    return BookmarkStorage.version === item.version;
                });
            if (!versionData) {
                throw new Error("MPStorage data for version " + BookmarkStorage.version + " was not found.");
            }

            bookmarks.sourceName = BookmarkStorage.toolName;
            bookmarks.lastUpdate = Date.now();
            versionData.bookmarks = bookmarks;
            BookmarkStorage.bookmarks = bookmarks;
            // MPStorage exposes no completion callback for setStorageData.
            mpStorage.setStorageData(mpStorage.storageData, BookmarkStorage.toolName);
        }
    };

    // Bookmark rules and operations
    const BookmarkDomain = {
        parseAnchor: function (anchor) {
            let match = /^t?(\d+)$/.exec(anchor);
            return match ? Number(match[1]) : NaN;
        },
        createEntry: function (anchor, postId, categoryId, author, label) {
            return {
                numreponse: BookmarkDomain.parseAnchor(anchor),
                post: postId,
                cat: categoryId,
                author: author,
                label: label || "Osef_" + anchor,
                createDate: Date.now()
            };
        },
        add: function (bookmarks, entry) {
            BookmarkDomain.remove(bookmarks, entry.numreponse);
            bookmarks.list.push(entry);
            bookmarks.list.sort(function (a, b) {
                return b.createDate - a.createDate;
            });
        },
        remove: function (bookmarks, responseId) {
            let index = bookmarks.list.findIndex(function (item) {
                return item.numreponse === responseId;
            });
            if (index < 0) {
                return false;
            }
            bookmarks.list.splice(index, 1);
            return true;
        }
    };

    const ForumUrls = {
        parsePageContext: function (href) {
            let url = new URL(href);
            let category = url.searchParams.get("cat");
            let post = url.searchParams.get("post");

            if (category && post) {
                return { categoryId: category, postId: post };
            }

            let topic = /\/hfr\/([^/]+)\/.*sujet_(\d+)_\d+\.htm/.exec(url.pathname);
            if (topic) {
                let categoryId = Object.keys(categoryNamesById).find(function (id) {
                    return categoryNamesById[id] === topic[1];
                });
                return { categoryId: categoryId || null, postId: topic[2] };
            }
            return { categoryId: null, postId: null };
        },
        buildBookmarkUrl: function (bookmark) {
            let url = new URL("https://forum.hardware.fr/forum2.php");
            url.searchParams.set("config", "hfr.inc");
            url.searchParams.set("cat", bookmark.cat);
            url.searchParams.set("post", bookmark.post);
            url.searchParams.set("numreponse", bookmark.numreponse);
            url.hash = "t" + bookmark.numreponse;
            return url.href;
        }
    };

    const BookmarkService = {
        add: async function (anchor, postId, categoryId, author, label) {
            let bookmarks = await BookmarkStorage.load();
            let entry = BookmarkDomain.createEntry(anchor, postId, categoryId, author, label);
            if (!Number.isFinite(entry.numreponse)) {
                throw new Error("Post anchor is invalid.");
            }
            BookmarkDomain.add(bookmarks, entry);
            BookmarkStorage.save(bookmarks);
            return true;
        },
        remove: async function (anchor) {
            let bookmarks = await BookmarkStorage.load();
            let responseId = BookmarkDomain.parseAnchor(anchor);
            if (!Number.isFinite(responseId)) {
                throw new Error("Bookmark response ID is invalid.");
            }
            if (!BookmarkDomain.remove(bookmarks, responseId)) {
                return false;
            }
            BookmarkStorage.save(bookmarks);
            return true;
        }
    };

    // DOM rendering and event wiring
    const BookmarkUI = {
        mount: async function () {
            let root = document.querySelector("div#mesdiscussions.mesdiscussions");
            if (!root) {
                return;
            }

            let { postId, categoryId: catId } = ForumUrls.parsePageContext(window.location.href);

            function announce(message, container) {
                let target = container || root;
                let status = target.querySelector("#hfrBookmarkStatus");
                if (!status) {
                    status = document.createElement("div");
                    status.id = "hfrBookmarkStatus";
                    status.className = "cBackCouleurTab1";
                    status.setAttribute("role", "status");
                    status.setAttribute("aria-live", "polite");
                    status.style.padding = "6px";
                    target.insertBefore(status, target.firstChild);
                }
                status.textContent = message;
            }

            function createIconButton(source, label) {
                let button = document.createElement("button");
                button.type = "button";
                button.setAttribute("aria-label", label);
                button.title = label;
                button.style.background = "transparent";
                button.style.border = "0";
                button.style.padding = "0";
                button.style.color = "inherit";
                button.style.font = "inherit";
                button.style.cursor = "pointer";

                let icon = document.createElement("img");
                icon.src = source;
                icon.alt = "";
                button.appendChild(icon);
                return button;
            }

            // icônes et boutons
            let img_bookmarks =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAALvSURBVHjaYvz//z8DPrBt2za+v3//rvn37985IF0TFBT0B1keIICYiNC8Foit/vz5kwXELcuXL2dBVgMQQDgN2Lp1Kx9QA1izpaUlt4eHBy+QXQjELQsXLmSHqQMIIEZsXgBphtlsYWHBdfr0aQaQOicnJ4a1a9f+A4pvA+KgtLS03wABhOGCLVu2gGxeB9N86tQphm/fvjGwsrIyAMUYQkNDmYC0PRA3T5kyhQUggFjQNQMlQJotQZpPnjzJ8P37dwY+Pj4GSTUDhgXHnjEoivEwAC3gAaqxAGIegACCu2Dz5s1gm4EYrvnr168MvLy8DMAwYDh+7xPD1WdfGA7feMvg6x/ICNRsBMQ6AAHEBNMMsxkIuE6cOAHXbG5uznD58mWGcBNxBnE+NgYzeU6GCzfuglzBAcRsAAEENgBqs52trS3X8ePHUWwGGQZMAwyfP31kiDLgY/jz/inDzfMnfoG8UF5evg8ggMBhAOSAQpbl9+/fDPr6+gz3799nMDAwYAAZBgo8eXl5hiPXdjGcf3iE4cuPTwyff376/eHLW69yhvJzAAHEAnWBhba2NiMPDw84xEEajh07BtasoKDAsP/SZoanfy4yONlZMMgIqTLsv7qB+8SVw80WOVICAAHEBHXB18+fP4NtFBERATtZU1MTrPnnz58MR27uYDDQ0Gf4y/SXQV/SleEv428GC10rkNZsgACChYHBjRs3frOwsDAcPHiQQUxMjEFCQgJs0Nu3bxnefH7JwMrIw+CnmQuOsWLnWQzKYnogJgdAAIENiI+Pfwl0hdCdO3des7Ozgw158+YNw9OnTxnOnDnz4+3HVz+vPjvG0LE7EWxAx65EhruvLoGYPwACCJ4OUlNTvwBdonTr1q0XTExMDFeuXGE4f/78D6CY7r///3pOXDrGwMbAwrD58jQGNkYWhiMXDoK0TQUIIIy80NfXB0plt4GYG5RYqqur74DEgQHWAaSygJgXiD8D8bQTU55VAAQYAIooodRRzS8nAAAAAElFTkSuQmCC";
            let img_ok =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8%2F9hAAACl0lEQVR42q2T60uTYRiH%2FTv2bnttAwlkRCGChFD7FCQSm2ZDMQ%2FL0nRnj7TNGDbTooychzFSSssstdqc8zB1anNrSpm47FVCzH3pQLVhdLBfzztoJlifvOEHz4fnuu7nGBe311XgOyLMnTmsz%2FakMBljB8OSEVFY4kpkJM5Efbp9v%2FC%2FcJ43VSrzJId0HhluBy3oW%2BmKpnOpGSWuExD30iFxDy3dFSZdpZkTSZHr80Y41%2Fphe3UDpvnKaNixY60PjbNVOGTjRZJtvJ2SHE%2BKINOdtMHC7MSaQBkq%2FCXQzJ6DjqScpNp3HvY3D3B5ugIiC3dDdJMriAlk7iSDajwr2pmFWVDlPQPFTCEU0wVQTxfCvT4Ig1cJB5Hk9hxDwjWuISbIGBExncFmWINNqPAVQ%2FlUTsB8KKdIPPmYeOsCW6HIOtpeNMI234j4ei4TExy3J2w%2BWr2L2oAGWm8RWckAlj4uQDVZiPH1oSj8c%2BsH2p5fgWGyGH3BTvCN1GZMIH5Ib%2FavdMPoV6HWr8Xnb5%2Bi0Iev72KwZa4ealc29O6z6A92gF%2Fzt6CHZm4tNKF98Sp0U3KYfdWIfP8Shbd%2BbcHy7BLKnFnQEEFLoA7tXjPoKmp7C6l3%2BAb5QBrsq%2FdRPSmH2n0adTPlWH6%2FiLa5BpQOnoTCcQo6Zw7sr7uRbj0KupLaPsRkK09wgFyN2aPBY%2BYeKkfzoB3OgWpIBqWDDQtn48lyF4xDxeCrORu0mhLseAuJTVxpfAMVMbnL4CCS1oAZ%2BtEiXBiWo5VswU5gvbMIvFJOhMC7v8Z9DVwpbaJCkg4x2v1m9L60onfBCovXhLSWVPAVnBCt%2Bgf8p%2BiLXCFtoPR0DcXwtZwwX8UJk44MiZ4upYR7%2Fnt%2FA%2Bw9sdKFchsrAAAAAElFTkSuQmCC";
            let img_cancel =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8%2F9hAAACEklEQVR42q1S%2FU9SYRhlbW13%2FQ0V5Woub05zfZkCXhUhpmmb8v3h5ZKoCQjcwVBi1Q%2B19Zf0d2lWxpeR3AuX93J8qGVjgK2tZ3u3d3t2znmecx6D4R%2BrsS5dGdiEnDXS4weCQ2Fe9QUSdafH3B%2Bc3UM7k4OeSPWQNIIi3xAjaG5u48fz1Y%2B1peU7PWAU3qBNT0%2FKaG3tnJOogXWe1NGKJYB8AZ3%2Fic2RqMxaL%2F0iSGe4dlLW23uvgPcfoOfyHQI0RYlX%2FSGe1KHtxAHqqyERJwtPWUWYv9w1oh5PcuxlnOlyFnj7DiydQSMcAalD244Buf2f%2F6rVTuA5rq9JregW15Q2WCu2S%2Bu8BvYLBMwD2RxUfxDVeRurzMxyF8cUFDnFG9CRo3V8QcDtA%2BQMqnMLetkicH%2FNWfH4O1EBlAacHmDVBeymaG87ipPT%2FMVgt49XvH5okSiQkgmYBuK0DhmorrlQMVnwdXyiP0nd5eUVjw%2BatAFQjIrbCzKLlabN%2BunSChDdRP3ZCor3H%2BJoeKSbhC6LJ3Vo4RekmoRCo5NZrDRl5oqPJrnjiQesZrUBYQmndgeOR8dweGPoDwldllB3uqGJEpQ1N8gsVnpiOjfsy%2Bg493nkLvtuEaA4FvFt7B4OrhmFrinosoTa4jLK5hmdzOpx%2B%2Bj2MPdp6BbrC%2F5dZZNFKD6eGhjVofEmd3D1umD4n3UGltFKFDkd60gAAAAASUVORK5CYII%3D";
            let img_remove =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAL/SURBVHjaYvz//z8DPrBt2za+v3//rvn37985IF0TFBT0B1keIICYiNC8Foit/vz5kwXELcuXL2dBVgMQQDgN2Lp1Kx9QA1izpaUlt4eHBy+QXQjELQsXLmSHqQMIIEZsXgBphtlsYWHBdfr0aQaQOicnJ4a1a9f+A4pvA+KgtLS03wABhOGCLVu2gGxeB9N86tQphm/fvjGwsrIyAMUYQkNDmYC0PRA3T5kyhQUggFjQNQMlQJotQZpPnjzJ8P37dwY+Pj4GSTUDhgXHnjEoivEwAC3gAaqxAGIegACCu2Dz5s1gm4EYrvnr168MvLy8DMAwYDh+7xPD1WdfGA7feMvg6x/ICNRsBMQ6AAHEBNMMsxkIuE6cOAHXbG5uznD58mWGcBNxBnE+NgYzeU6GCzfuglzBAcRsAAEENgBqs52trS3X8ePHUWwGGQZMAwyfP31kiDLgY/jz/inDzfMnfoG8UF5evg8ggMBhAOSAQpbl9+/fDPr6+gz3799nMDAwYAAZBgo8eXl5hne7FzB8OrCYQfzFYwZhFoa3jP//uTGUl58DCCAWqAsstLW1GXl4eMAhDtJw7NgxsGYFBQWGt0DNbHf3MVhEZzOwK2ozfL+0S/La4d0tu11YvwIEEBPUBV8/f/4MtlFERATsZE1NTbDmnz9/MrzfPY9BzSGIgePuAQbGhZEMXPfWMyjICzP/Z/xfCBBAsDAwuHHjxm8WFhaGgwcPMoiJiTFISEiADXr79i0D8/tXDBwSigwMuZsYGDreMTBU3mNg+XqDgfkfowJAAIENiI+Pfwl0hdCdO3des7Ozgw158+YNw9OnTxnOnDnz4w8Lw4tvF7YyMDRIMvwsZ2R4D8SfXr5m+Mv8/xlAAMHTQWpq6hegS5Ru3br1gomJieHKlSsM58+f/wEU0+UWFJ159fihP89/cDJ8YmZleP+OkeHOU8a/wEwwDSCAMPJCX18fKJXdBmJuUGKprq6+AxI/GiFX8fXds3Tmv4zyQJufAnVNd9/1pw0gwAAR/6xXPNF0vQAAAABJRU5ErkJggg==";
            let img_open_bookmark =
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAKASURBVHjaYvz//z8DPrBt2za+v3//rvn37985IF0TFBT0B1keIICYiNC8Foit/vz5kwXELcuXL2dBVgMQQDgN2Lp1Kx9QA1izpaUlt4eHBy+QXQjELQsXLmSHqQMIIEZsXgBphtlsYWHBdfr0aQaQOicnJ4a1a9f+A4pvA+KgtLS03wABhOGCLVu2gGxeB9N86tQphm/fvjGwsrIyAMUYQkNDmYC0PRA3T5kyhQUggFjQNQMlQJotQZpPnjzJ8P37dwY+Pj4GSTUDhgXHnjEoivEwAC3gAaqxAGIegACCu2Dz5s1gm4EYrvnr168MvLy8DMAwYDh+7xPD1WdfGA7feMvg6x/ICNRsBMQ6AAHEBNMMsxkIuE6cOAHXbG5uznD58mWGcBNxBnE+NgYzeU6GCzfuglzBAcRsAAEENgBqs52trS3X8ePHUWwGGQZMAwyfP31kiDLgY/jz/inDzfMnfoG8UF5evg8ggMBhAOSAQpbl9+/fDPr6+gz3799nMDAwYAAZBgo8eXl5cEA+evyE4enNiz+AarUrKirugfQCBBDMBRZaWlqMPDw84OgCaTh27BgDCwsLg4KCAsPnz58ZHj16xHDp4oXvQM3qMM0gABBATFAXfAUpAtkoIiICdrKmpiZY88+fPxmePXvGcOnSJZBmDaDmR8gxBxBAMBcY3Lhx4zfIxoMHDzKIiYkxSEhIgA16+/YtSPNPoBqdysrKR+jpBiCA4Clx9uzZoLi9B3S+6I8fP8Bhcfv2bYYLFy6A/GxQVVV1E1uSBwgglKQMTFkgQ24DnS7ByMjIcO3aNZBm3erq6ju48gxAAGHkhb6+PrAhQMwNSiz4NIMAQIABAPYsj0djV8aMAAAAAElFTkSuQmCC";

            // ajoute l'onglet et le bouton
            function addButtons() {
                // Pas dans un topic
                if (
                    window.location.href.indexOf("https://forum.hardware.fr/forum2.php") == -1 &&
                    window.location.href.indexOf("https://forum.hardware.fr/hfr/") == -1
                ) {
                    let onglets = root.querySelector("table.none > tbody > tr > td > div.cadreonglet");

                    if (!onglets) {
                        console.warn("[HFR] Bookmarks: topic tabs were not found.");
                    } else {
                        let div_avant = document.createElement("div");
                        div_avant.setAttribute("id", "beforBK");
                        div_avant.setAttribute("class", "beforonglet");
                        let div_apres = document.createElement("div");
                        div_apres.setAttribute("id", "afterBK");
                        div_apres.setAttribute("class", "afteronglet");
                        let onglet = document.createElement("a");
                        onglet.setAttribute("id", "ongletBK");
                        onglet.setAttribute("class", "onglet");
                        onglet.setAttribute("title", "Liste des bookmarks");
                        onglet.addEventListener("click", displayBookmarksManagement, false);
                        let boutton = document.createElement("img");
                        boutton.setAttribute("class", "npn_button");
                        boutton.setAttribute("src", img_open_bookmark);
                        boutton.setAttribute("alt", "Bookmarks");
                        onglet.appendChild(boutton);

                        onglets.appendChild(div_avant);
                        onglets.appendChild(onglet);
                        onglets.appendChild(div_apres);
                    }
                }

                if (postId > 0 && (catId > 0 || catId == "prive")) {
                    let pseudos = root.querySelectorAll(
                        "table.messagetable > tbody > tr > td.messCase2 > div.toolbar > div.left:first-of-type"
                    );
                    for (let pseudo of pseudos) {
                        let imgBK = createIconButton(img_bookmarks, "Ajouter ce post aux bookmarks");
                        imgBK.style.verticalAlign = "bottom";
                        imgBK.style.marginRight = "1px";
                        imgBK.style.marginLeft = "3px";
                        imgBK.style.marginBottom = "2px";
                        // ouverture de la fenetre de confirmation/gestion sur le clic du bouton
                        imgBK.addEventListener("click", displayBookmarkQuestion, false);
                        pseudo.insertBefore(imgBK, null);
                    }
                }
            }

            // affichage de la fenêtre de gestion des bookmarks
            function displayBookmarksManagement(event) {
                if (typeof event !== "undefined") {
                    event.preventDefault();
                    event.stopPropagation();
                }

                let mainTable = document.querySelector("#mesdiscussions > table.main");
                if (!mainTable || !mainTable.parentNode) {
                    console.warn("[HFR] Bookmarks: the discussion table was not found.");
                    return;
                }

                let tableBookmarks = document.createElement("table");
                tableBookmarks.setAttribute("class", "main");
                tableBookmarks.setAttribute("cellspacing", "0");
                tableBookmarks.style.tableLayout = "fixed";
                tableBookmarks.style.width = "100%";

                let columns = [
                    { title: "", width: "28px", align: "center" },
                    { title: "Sujet", width: "", align: "left" },
                    { title: "Auteur du post", width: "150px", align: "left" },
                    { title: "Ajouté le", width: "130px", align: "center" },
                    { title: "", width: "36px", align: "center" }
                ];

                let colgroup = document.createElement("colgroup");
                let trHead = document.createElement("tr");
                trHead.setAttribute("class", "cBackHeader fondForum1Description");
                trHead.style.height = "22px";
                for (let column of columns) {
                    let col = document.createElement("col");
                    if (column.width) {
                        col.style.width = column.width;
                    }
                    colgroup.appendChild(col);
                    let th = document.createElement("th");
                    th.textContent = column.title;
                    th.style.textAlign = column.align;
                    th.style.padding = "0 6px";
                    trHead.appendChild(th);
                }
                tableBookmarks.appendChild(colgroup);
                tableBookmarks.appendChild(trHead);

                if (BookmarkStorage.bookmarks.list.length === 0) {
                    let emptyRow = document.createElement("tr");
                    emptyRow.className = "sujet ligne_booleen cBackCouleurTab1";
                    let emptyCell = document.createElement("td");
                    emptyCell.colSpan = columns.length;
                    emptyCell.style.padding = "12px";
                    emptyCell.style.textAlign = "center";
                    emptyCell.textContent = "Aucun bookmark enregistré.";
                    emptyRow.appendChild(emptyCell);
                    tableBookmarks.appendChild(emptyRow);
                }

                let dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });
                let rowIndex = 0;
                for (let item of BookmarkStorage.bookmarks.list) {
                    let trBookmark = document.createElement("tr");
                    trBookmark.setAttribute(
                        "class",
                        "sujet ligne_booleen " + (rowIndex++ % 2 ? "cBackCouleurTab2" : "cBackCouleurTab1")
                    );
                    trBookmark.style.height = "28px";

                    const createCell = function (align) {
                        let td = document.createElement("td");
                        td.style.textAlign = align;
                        td.style.verticalAlign = "middle";
                        td.style.padding = "2px 6px";
                        td.style.overflow = "hidden";
                        td.style.textOverflow = "ellipsis";
                        td.style.whiteSpace = "nowrap";
                        trBookmark.appendChild(td);
                        return td;
                    };

                    let tdIcon = createCell("center");
                    let icon = document.createElement("img");
                    icon.setAttribute("src", img_open_bookmark);
                    icon.alt = "";
                    icon.style.verticalAlign = "middle";
                    tdIcon.appendChild(icon);

                    let tdSujet = createCell("left");
                    let link = document.createElement("a");
                    link.className = "cCatTopic hfrBookmarkOpen";
                    link.href = ForumUrls.buildBookmarkUrl(item);
                    link.target = "_blank";
                    link.rel = "noopener";
                    link.textContent = item.label;
                    link.title = item.label;
                    tdSujet.appendChild(link);

                    let tdAuteur = createCell("left");
                    tdAuteur.textContent = item.author;
                    tdAuteur.title = item.author;
                    tdAuteur.style.fontWeight = "bold";

                    let tdDate = createCell("center");
                    tdDate.textContent = dateFormat.format(new Date(item.createDate));

                    let tdInputRemove = createCell("center");
                    let inputRemove = createIconButton(img_remove, "Supprimer le bookmark : " + item.label);
                    inputRemove.dataset.numreponse = item.numreponse;
                    inputRemove.style.verticalAlign = "middle";
                    inputRemove.addEventListener(
                        "click",
                        function () {
                            inputRemove.disabled = true;
                            BookmarkService.remove(this.dataset.numreponse)
                                .then(function (removed) {
                                    displayBookmarksManagement();
                                    announce(removed ? "Bookmark supprimé." : "Ce bookmark n'existe plus.", root);
                                })
                                .catch(function (error) {
                                    inputRemove.disabled = false;
                                    announce("Impossible de supprimer ce bookmark. Réessayez.", root);
                                    reportStorageError(error);
                                });
                        },
                        false
                    );
                    tdInputRemove.appendChild(inputRemove);
                    tableBookmarks.appendChild(trBookmark);
                }

                mainTable.parentNode.replaceChild(tableBookmarks, mainTable);
            }

            // affichage de la fenêtre d'ajout / suppression d'un bookmark
            function displayBookmarkQuestion(event) {
                event.stopPropagation();
                let trigger = this;
                let message = this.closest("tr");
                let postLink = message && message.querySelector("a[name]");
                let author = message && message.querySelector("div > b.s2");
                if (!postLink || !author) {
                    console.warn("[HFR] Bookmarks: post details could not be read.");
                    return;
                }
                let postAnchor = postLink.name;
                let authorValue = author.textContent.trim();
                if (!Number.isFinite(BookmarkDomain.parseAnchor(postAnchor))) {
                    console.warn("[HFR] Bookmarks: post anchor is invalid.");
                    return;
                }
                // suppression des fenêtres ouvertes
                hidePopups();
                // construction de la fenêtre
                let divBookmarkQuestion = document.createElement("div");
                divBookmarkQuestion.setAttribute("id", "hfrBookmarkQuestion");
                divBookmarkQuestion.className = "cBackCouleurTab1";
                divBookmarkQuestion.setAttribute("role", "dialog");
                divBookmarkQuestion.setAttribute("aria-modal", "true");
                divBookmarkQuestion.setAttribute("aria-labelledby", "hfrBookmarkQuestionTitle");
                divBookmarkQuestion.style.position = "fixed";
                divBookmarkQuestion.style.border = "1px solid grey";
                divBookmarkQuestion.style.padding = "8px";
                divBookmarkQuestion.style.color = "inherit";
                divBookmarkQuestion.style.zIndex = "1001";
                divBookmarkQuestion.style.cursor = "default";
                divBookmarkQuestion.style.maxWidth = "calc(100vw - 16px)";
                divBookmarkQuestion.style.boxSizing = "border-box";
                let divQuestion = document.createElement("div");
                divQuestion.id = "hfrBookmarkQuestionTitle";
                divQuestion.appendChild(document.createTextNode("Ajouter ce post aux bookmarks ?"));
                divQuestion.style.fontSize = "8pt";
                let divLabel = document.createElement("label");
                divLabel.htmlFor = "labelBM_" + postAnchor;
                divLabel.appendChild(document.createTextNode("Nom du bookmark: "));
                let inputLabel = document.createElement("input");
                inputLabel.setAttribute("type", "text");
                inputLabel.setAttribute("size", 50);
                inputLabel.setAttribute("id", "labelBM_" + postAnchor);
                inputLabel.style.maxWidth = "100%";
                inputLabel.style.boxSizing = "border-box";
                divLabel.appendChild(inputLabel);
                divQuestion.appendChild(divLabel);
                let status = document.createElement("div");
                status.setAttribute("role", "status");
                status.setAttribute("aria-live", "polite");
                status.style.marginTop = "4px";
                let divValidation = document.createElement("div");
                divValidation.style.marginTop = "8px";
                divValidation.style.textAlign = "right";
                let inputOk = createIconButton(img_ok, "Valider l'ajout du bookmark");
                inputOk.addEventListener(
                    "click",
                    function () {
                        let label = document.getElementById("labelBM_" + postAnchor).value;
                        inputOk.disabled = true;
                        status.textContent = "Enregistrement…";
                        BookmarkService.add(postAnchor, postId, catId, authorValue, label)
                            .then(function () {
                                hidePopups();
                                announce("Bookmark ajouté.", root);
                                trigger.focus();
                            })
                            .catch(function (error) {
                                inputOk.disabled = false;
                                status.textContent = "Impossible d'enregistrer le bookmark. Réessayez.";
                                reportStorageError(error);
                            });
                    },
                    false
                );
                let inputCancel = createIconButton(img_cancel, "Annuler");
                inputCancel.style.marginLeft = "8px";
                inputCancel.addEventListener(
                    "click",
                    function () {
                        hidePopups();
                        trigger.focus();
                    },
                    false
                );
                divValidation.appendChild(inputOk);
                divValidation.appendChild(inputCancel);
                divBookmarkQuestion.appendChild(divQuestion);
                divBookmarkQuestion.appendChild(status);
                divBookmarkQuestion.appendChild(divValidation);
                divBookmarkQuestion.style.top = "8px";
                divBookmarkQuestion.style.left = "8px";
                divBookmarkQuestion.style.display = "block";
                root.appendChild(divBookmarkQuestion);
                let bounds = divBookmarkQuestion.getBoundingClientRect();
                divBookmarkQuestion.style.left =
                    Math.max(8, Math.min(event.clientX + 8, window.innerWidth - bounds.width - 8)) + "px";
                divBookmarkQuestion.style.top =
                    Math.max(8, Math.min(event.clientY + 8, window.innerHeight - bounds.height - 8)) + "px";
                inputLabel.focus();
                inputLabel.addEventListener("keydown", function (keyEvent) {
                    if (keyEvent.key === "Enter") {
                        keyEvent.preventDefault();
                        inputOk.click();
                    }
                });
                divBookmarkQuestion.addEventListener("keydown", function (keyEvent) {
                    if (keyEvent.key === "Escape") {
                        hidePopups();
                        trigger.focus();
                    }
                });
            }

            // suppression des fenêtres ouvertes
            function hidePopups() {
                let divBookmarkQuestion = document.getElementById("hfrBookmarkQuestion");
                if (divBookmarkQuestion) {
                    divBookmarkQuestion.remove();
                }
            }

            // suppression des fenêtres ouvertes en cliquant en dehors
            document.addEventListener(
                "click",
                function (e) {
                    let target = e.target;
                    while (target !== null && target.id !== "hfrBookmarkQuestion") {
                        target = target.parentNode;
                    }
                    if (target === null) {
                        hidePopups();
                    }
                },
                false
            );

            // leggo!
            addButtons();
        }
    };

    async function main() {
        await BookmarkStorage.init();
        await BookmarkUI.mount();
    }

    function reportStorageError(error) {
        console.error("[HFR] Bookmarks: unable to update bookmarks.", error);
    }

    main().catch(function (error) {
        console.error("[HFR] Bookmarks: unable to initialize MPStorage.", error);
    });
})();
