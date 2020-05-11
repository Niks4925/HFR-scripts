// ==UserScript==
// @name          [HFR] Bookmarks
// @version       0.3
// @namespace     forum.hardware.fr
// @description   Gestion de posts favoris avec stockage en MPStorage
// @icon          data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAilBMVEX%2F%2F%2F8AAADxjxvylSrzmzf5wYLzmjb%2F9er%2F%2Fv70nj32q1b5woT70qT82rT827b%2F%2B%2FjxkSHykybykyfylCjylCnzmDDzmjX0nTv1o0b1qFH2qVL2qlT3tGn4tmz4uHD4uXL5vHf83Lf83Lj937394MH%2B587%2B69f%2F8%2BX%2F8%2Bf%2F9On%2F9uz%2F%2BPH%2F%2BvT%2F%2FPmRE1AgAAAAwElEQVR42s1SyRbCIAysA7W2tdZ93%2Ff1%2F39PEtqDEt6rXnQOEMhAMkmC4E9QY9j9da1OkP%2BtTiBo1caOjGisDLRDANCk%2FVIHwwkBZGReh9avnGj2%2FWFg%2Feg5hD1bLZTwqdgU%2FlTSdrqZJWN%2FKImPOnGjiBJKhYqMvikxtlhLNTuz%2FgkxjmJRRza5mbcXpbz4zldLJ0lVEBY5nRL4CJx%2FMEfXE4L9j4Qr%2BZakpiandMpX6FO7%2FaPxxUTJI%2FsJ4cd4AoSOBgZnPvgtAAAAAElFTkSuQmCC
// @include       https://forum.hardware.fr/forum1.php*
// @include       https://forum.hardware.fr/forum2.php*
// @include       https://forum.hardware.fr/forum1f.php*
// @include       https://forum.hardware.fr/*/liste_sujet-*.htm
// @include       https://forum.hardware.fr/hfr/*/*-sujet_*_*.htm*
// @include       https://forum.hardware.fr
// @include       https://forum.hardware.fr/
// @author        Garath_
// @authororig    nykal, roger21, Wiripse
// @modifications Repompe du script de Wiripse en essayant de nettoyer un peu
// @modtype       Evolutions
// @noframes
// @grant         GM.getValue
// @grant         GM_getValue
// @grant         GM.setValue
// @grant         GM_setValue
// @grant         GM_openInTab
// @require https://raw.githubusercontent.com/Wiripse/HFRGMTools/master/MPStorage.user.js
// ==/UserScript==


// MPStorage
var LocalMPStorage = {
    /* Version of the MPStorage API used */
    version : '0.1',
    /* Current toolname used to access MPStorage */
    toolName : 'ClaudeMarks_GM',
    /* JSON datas from MPStorage about bookmarks management */
    bookmarks : void 0,
    /* Methods */
    getData : function(callback){
        // **********
        // ClaudeMarks_GM
        // Get MPStorage data and store it locally
        // CALLBACK is called with the bookmarks  data from MPStorage data
        // **********

        mpStorage.getStorageData(function(res){
            // Save bookmarks datas locally
            LocalMPStorage.bookmarks = res.data.filter(function(d){return LocalMPStorage.version === d.version;})[0].bookmarks || { list : [] };
            // We're done
            callback(LocalMPStorage.bookmarks);
        });
    },

    initBLMPStorage : function() {
        // **********
        // ClaudeMarks_GM
        // Init MPStorage bookmarks data
        // Return a Promise
        // **********

        return new Promise((resolve, reject) => {
            try {

                // We try to recover existing MPStorage conf locally
                Promise.all([
                    GM.getValue('mpStorage_username', void 0),
                    GM.getValue('mpStorage_mpId', void 0),
                    GM.getValue('mpStorage_mpRepId', void 0)
                ]).then(function([
                    mpStorage_username,
                    mpStorage_mpId,
                    mpStorage_mpRepId
                ]){

                    // We have the conf locally
                    if(!!mpStorage_username && !!mpStorage_mpId && !!mpStorage_mpRepId){

                        // We init the mpStorage lib with those datas
                        mpStorage.username = mpStorage_username;
                        mpStorage.mpId = mpStorage_mpId;
                        mpStorage.mpRepId = mpStorage_mpRepId;
                        mpStorage.initiated = true;

                        // And we retrieve the MPStorage datas
                        LocalMPStorage.getData(function(res){
                            resolve(res);
                        });

                        // TODO Wiripse Gestion cache local ?
                    }else{

                        // We don't have the conf locally
                        // We use mpStorage lib to init those datas
                        mpStorage.initStorage(function(res){
                            if(res){
                                // We store them locally
                                GM.setValue('mpStorage_username', mpStorage.username);
                                GM.setValue('mpStorage_mpId', mpStorage.mpId);
                                GM.setValue('mpStorage_mpRepId', mpStorage.mpRepId);

                                // And we retrieve the MPStorage datas
                                LocalMPStorage.getData(function(res){
                                    resolve(res);
                                });
                            }
                        });
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    },

    getCatOrPost : function(cat){
        var id2cat = {
            31: "service-client-shophfr",
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
        function indexObj(obj, str) {
            for(let prop in obj) {
                if(obj[prop] === str) {
                    return prop;
                }
            }
            return null;
        }
        // récupération de la cat et du topic dans l'url de la page
        var resultp = /^.*&cat=([0-9]+).*&post=([0-9]+)&.*$/.exec(window.location.href);
        if(resultp !== null) { // url à paramètres
            return cat ? resultp[1] : resultp[2];
        } else {
            var resultv = /^https:\/\/forum.hardware.fr\/hfr\/([^\/]+)\/.*sujet_([0-9]+)_[0-9]+\.htm.*$/.exec(window.location.href);
            if(resultv !== null) { // url verbeuse
                return cat ? indexObj(id2cat, resultv[1]) : resultv[2];
            }
        }
    }
};

// compatibilité gm4
if(typeof GM === "undefined") {
  GM = {};
}
if(typeof GM_getValue !== "undefined" && typeof GM.getValue === "undefined") {
  GM.getValue = function(...args) {
    return new Promise((resolve, reject) => {
      try {
        resolve(GM_getValue.apply(null, args));
      } catch (e) {
        reject(e);
      }
    });
  };
}
if(typeof GM_setValue !== "undefined" && typeof GM.setValue === "undefined") {
  GM.setValue = function(...args) {
    return new Promise((resolve, reject) => {
      try {
        resolve(GM_setValue.apply(null, args));
      } catch (e) {
        reject(e);
      }
    });
  };
}



// récupération des paramètres
LocalMPStorage.initBLMPStorage().then(function() {
  let root = document.querySelector("div#mesdiscussions.mesdiscussions");
  if(root) {


     let postId = LocalMPStorage.getCatOrPost(false);
     let catId = LocalMPStorage.getCatOrPost(true);


    // icônes et boutons
    let img_bookmarks = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAALvSURBVHjaYvz//z8DPrBt2za+v3//rvn37985IF0TFBT0B1keIICYiNC8Foit/vz5kwXELcuXL2dBVgMQQDgN2Lp1Kx9QA1izpaUlt4eHBy+QXQjELQsXLmSHqQMIIEZsXgBphtlsYWHBdfr0aQaQOicnJ4a1a9f+A4pvA+KgtLS03wABhOGCLVu2gGxeB9N86tQphm/fvjGwsrIyAMUYQkNDmYC0PRA3T5kyhQUggFjQNQMlQJotQZpPnjzJ8P37dwY+Pj4GSTUDhgXHnjEoivEwAC3gAaqxAGIegACCu2Dz5s1gm4EYrvnr168MvLy8DMAwYDh+7xPD1WdfGA7feMvg6x/ICNRsBMQ6AAHEBNMMsxkIuE6cOAHXbG5uznD58mWGcBNxBnE+NgYzeU6GCzfuglzBAcRsAAEENgBqs52trS3X8ePHUWwGGQZMAwyfP31kiDLgY/jz/inDzfMnfoG8UF5evg8ggMBhAOSAQpbl9+/fDPr6+gz3799nMDAwYAAZBgo8eXl5hiPXdjGcf3iE4cuPTwyff376/eHLW69yhvJzAAHEAnWBhba2NiMPDw84xEEajh07BtasoKDAsP/SZoanfy4yONlZMMgIqTLsv7qB+8SVw80WOVICAAHEBHXB18+fP4NtFBERATtZU1MTrPnnz58MR27uYDDQ0Gf4y/SXQV/SleEv428GC10rkNZsgACChYHBjRs3frOwsDAcPHiQQUxMjEFCQgJs0Nu3bxnefH7JwMrIw+CnmQuOsWLnWQzKYnogJgdAAIENiI+Pfwl0hdCdO3des7Ozgw158+YNw9OnTxnOnDnz4+3HVz+vPjvG0LE7EWxAx65EhruvLoGYPwACCJ4OUlNTvwBdonTr1q0XTExMDFeuXGE4f/78D6CY7r///3pOXDrGwMbAwrD58jQGNkYWhiMXDoK0TQUIIIy80NfXB0plt4GYG5RYqqur74DEgQHWAaSygJgXiD8D8bQTU55VAAQYAIooodRRzS8nAAAAAElFTkSuQmCC';
    let img_ok = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8%2F9hAAACl0lEQVR42q2T60uTYRiH%2FTv2bnttAwlkRCGChFD7FCQSm2ZDMQ%2FL0nRnj7TNGDbTooychzFSSssstdqc8zB1anNrSpm47FVCzH3pQLVhdLBfzztoJlifvOEHz4fnuu7nGBe311XgOyLMnTmsz%2FakMBljB8OSEVFY4kpkJM5Efbp9v%2FC%2FcJ43VSrzJId0HhluBy3oW%2BmKpnOpGSWuExD30iFxDy3dFSZdpZkTSZHr80Y41%2Fphe3UDpvnKaNixY60PjbNVOGTjRZJtvJ2SHE%2BKINOdtMHC7MSaQBkq%2FCXQzJ6DjqScpNp3HvY3D3B5ugIiC3dDdJMriAlk7iSDajwr2pmFWVDlPQPFTCEU0wVQTxfCvT4Ig1cJB5Hk9hxDwjWuISbIGBExncFmWINNqPAVQ%2FlUTsB8KKdIPPmYeOsCW6HIOtpeNMI234j4ei4TExy3J2w%2BWr2L2oAGWm8RWckAlj4uQDVZiPH1oSj8c%2BsH2p5fgWGyGH3BTvCN1GZMIH5Ib%2FavdMPoV6HWr8Xnb5%2Bi0Iev72KwZa4ealc29O6z6A92gF%2Fzt6CHZm4tNKF98Sp0U3KYfdWIfP8Shbd%2BbcHy7BLKnFnQEEFLoA7tXjPoKmp7C6l3%2BAb5QBrsq%2FdRPSmH2n0adTPlWH6%2FiLa5BpQOnoTCcQo6Zw7sr7uRbj0KupLaPsRkK09wgFyN2aPBY%2BYeKkfzoB3OgWpIBqWDDQtn48lyF4xDxeCrORu0mhLseAuJTVxpfAMVMbnL4CCS1oAZ%2BtEiXBiWo5VswU5gvbMIvFJOhMC7v8Z9DVwpbaJCkg4x2v1m9L60onfBCovXhLSWVPAVnBCt%2Bgf8p%2BiLXCFtoPR0DcXwtZwwX8UJk44MiZ4upYR7%2Fnt%2FA%2Bw9sdKFchsrAAAAAElFTkSuQmCC";
    let img_cancel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8%2F9hAAACEklEQVR42q1S%2FU9SYRhlbW13%2FQ0V5Woub05zfZkCXhUhpmmb8v3h5ZKoCQjcwVBi1Q%2B19Zf0d2lWxpeR3AuX93J8qGVjgK2tZ3u3d3t2znmecx6D4R%2BrsS5dGdiEnDXS4weCQ2Fe9QUSdafH3B%2Bc3UM7k4OeSPWQNIIi3xAjaG5u48fz1Y%2B1peU7PWAU3qBNT0%2FKaG3tnJOogXWe1NGKJYB8AZ3%2Fic2RqMxaL%2F0iSGe4dlLW23uvgPcfoOfyHQI0RYlX%2FSGe1KHtxAHqqyERJwtPWUWYv9w1oh5PcuxlnOlyFnj7DiydQSMcAalD244Buf2f%2F6rVTuA5rq9JregW15Q2WCu2S%2Bu8BvYLBMwD2RxUfxDVeRurzMxyF8cUFDnFG9CRo3V8QcDtA%2BQMqnMLetkicH%2FNWfH4O1EBlAacHmDVBeymaG87ipPT%2FMVgt49XvH5okSiQkgmYBuK0DhmorrlQMVnwdXyiP0nd5eUVjw%2BatAFQjIrbCzKLlabN%2BunSChDdRP3ZCor3H%2BJoeKSbhC6LJ3Vo4RekmoRCo5NZrDRl5oqPJrnjiQesZrUBYQmndgeOR8dweGPoDwldllB3uqGJEpQ1N8gsVnpiOjfsy%2Bg493nkLvtuEaA4FvFt7B4OrhmFrinosoTa4jLK5hmdzOpx%2B%2Bj2MPdp6BbrC%2F5dZZNFKD6eGhjVofEmd3D1umD4n3UGltFKFDkd60gAAAAASUVORK5CYII%3D";
    let img_add = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8%2F9hAAACeUlEQVR42rWQb0hTYRTG7UNJka1tjRAEYyFYsShUggqxsclyasKCWTPbzPwz0XAUalPDsraWOrFs1pbKcN6tmTEtzSkZZGSxlX%2BG0KdBWYTQwFIXKvfp3kuIQky%2F9MDDOe%2FL%2B%2FzO4Q0L%2Bx9SJ%2Byqqpdw5hqlO2GQsFAlZM8r4ni1Gwrnx3HK7qezSXMmBw8o35WxoUthoTRxByk9yK1ZF2CSstBGBQ1USCelzcbNVB6unOAgK441uy5Al7gdL0yVmO43YNRSipIkHjSiSBSJ%2Bcg7xl60lqeFhwSYs6N%2FBL9%2FwuwbE74ONmDccQ3%2B57cR8HtBFOydnWhXbwkJaFLsHwm878SMx4mFMYKynekDXgIPcwSekOHdUtvmmONqK1Ecj98eC4K%2Bp4wXPtrQfTkegsSCJzyxees%2Fw7wUIpwr6SiMkgzB93kODm067No0xnT%2FeuoXopJfgiN8dIkrbNm2Jsw96dgUkexQRqeOYGp6AR3TgMYHFL4DLrwCzvcB5c5uaExK5DWcgvyGMCgpO1S9Ajgga80QnTbAObqMlnGg%2BC2JgmESuQMksl0kVGYCNU4VnvmaMfbNDeOgGnKjAEeKIusYwIfK2OWZ3nLca%2B2Fsp%2BaSk1U9ZA410XijI2q%2BhS4JhvhmmoCrbqhizAO5dOAIAMYr9pHBtzXkZnXhtrBeSi6gLN2EnIrCZmFRKr2MPp8FqxWz0QzDQADmLQWV3grYpZUqltLCcphqKjVc1b5aAkfd9w50LmVTFg3oFy7AS2%2FvTCi%2Bmotd09Gb0t0UvsXvvjxPD%2B5a5Evci4K5FlLsrpY1Ltzmcl0pc8rf7ARUY%2F1lH%2FSa%2F%2Btevr%2BD5zsjQszBEUQAAAAAElFTkSuQmCC";
    let img_remove = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAL/SURBVHjaYvz//z8DPrBt2za+v3//rvn37985IF0TFBT0B1keIICYiNC8Foit/vz5kwXELcuXL2dBVgMQQDgN2Lp1Kx9QA1izpaUlt4eHBy+QXQjELQsXLmSHqQMIIEZsXgBphtlsYWHBdfr0aQaQOicnJ4a1a9f+A4pvA+KgtLS03wABhOGCLVu2gGxeB9N86tQphm/fvjGwsrIyAMUYQkNDmYC0PRA3T5kyhQUggFjQNQMlQJotQZpPnjzJ8P37dwY+Pj4GSTUDhgXHnjEoivEwAC3gAaqxAGIegACCu2Dz5s1gm4EYrvnr168MvLy8DMAwYDh+7xPD1WdfGA7feMvg6x/ICNRsBMQ6AAHEBNMMsxkIuE6cOAHXbG5uznD58mWGcBNxBnE+NgYzeU6GCzfuglzBAcRsAAEENgBqs52trS3X8ePHUWwGGQZMAwyfP31kiDLgY/jz/inDzfMnfoG8UF5evg8ggMBhAOSAQpbl9+/fDPr6+gz3799nMDAwYAAZBgo8eXl5hne7FzB8OrCYQfzFYwZhFoa3jP//uTGUl58DCCAWqAsstLW1GXl4eMAhDtJw7NgxsGYFBQWGt0DNbHf3MVhEZzOwK2ozfL+0S/La4d0tu11YvwIEEBPUBV8/f/4MtlFERATsZE1NTbDmnz9/MrzfPY9BzSGIgePuAQbGhZEMXPfWMyjICzP/Z/xfCBBAsDAwuHHjxm8WFhaGgwcPMoiJiTFISEiADXr79i0D8/tXDBwSigwMuZsYGDreMTBU3mNg+XqDgfkfowJAAIENiI+Pfwl0hdCdO3des7Ozgw158+YNw9OnTxnOnDnz4w8Lw4tvF7YyMDRIMvwsZ2R4D8SfXr5m+Mv8/xlAAMHTQWpq6hegS5Ru3br1gomJieHKlSsM58+f/wEU0+UWFJ159fihP89/cDJ8YmZleP+OkeHOU8a/wEwwDSCAMPJCX18fKJXdBmJuUGKprq6+AxI/GiFX8fXds3Tmv4zyQJufAnVNd9/1pw0gwAAR/6xXPNF0vQAAAABJRU5ErkJggg==";
    let img_bkgnd = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAACWCAYAAAA8AXHiAAABGklEQVR42u3ZQQqDMBRFUSfZirvPNrKukoHyQUP1N4NQzoGATsPlUeq2AQAAAAAAAAAAAAAAAAAAAAAAAAAAAADAF7XW3S2QjufJcVO8DquUcjmttfNZWEwJK0YlLKYulrCYElZfqXjicgkLi8W6ixXfhYXFYs2w7tZKWFgs%2FMbCYgmLfFjHN8HR%2F1luilRco9Oj8iEaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB%2BUGvd3QLpeJ4cN8XrsEopl9NaO5%2BFxZSwYlTCYupiCYspYfWViicul7CwWKy7WPFdWFgs1gzrbq2EhcXCbywslrDIh3V8Exz9n%2BWmSMU1Oj0qH6IBAAAAAAAAAAAAAPgXH8XjYT4KbLBkAAAAAElFTkSuQmCC";
    let img_bkgnd_with_quote = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAACWCAYAAAA8AXHiAAADwUlEQVR42u3ayYpiTRCG4b7nuIXa1z2IA46gOKOU84BFleKIC3UhKoJQi3Iox58IcNc0nq7mh6bfB4I8ylklH5mRyfnxAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwzwuHwxIIBMTv99uoFQwGJRKJyNPTk5RKJWGW4Fgmk5Hb7fbTWq%2FXEgqFpFgsEi44k06nfxms%2FX4vqVRKkskk4cKfCdZyuZTNZmMBSyQStnoxY%2Fj2VjibzaTT6cjLy4tEo1F5fn4mWHAerI%2BPD2k0GlIul6VWq9m4Wq3keDzK9XoVfZcZw7dXLK3z%2BWzBulwu1msxY3hINpu1APX7fel2u9Lr9WQ0GslgMJBmsynv7%2B8ynU4tYAQLjoOlYRqPxzIcDi1gGjR9fnt7k8ViYcHiZIiH5XI5C5auTlr1el1arZY9t9ttmUwm8vn5adthPB4nWHAWrK%2BvL%2BujdNS7q91uZ%2BN2u7UiWPitrfD19VUqlYqtWFq6YhUKBTsd5vN5CxzBguNTofZXWvfeSvssvcPS7VB%2FHw4HicViBAuP0Zt33QKr1ao16Vrz%2BdwuR7X0RKijbot6ScqM4eFg3e%2BrtE6nk5X2VLr93Xsu%2FY8VCw%2FTz2b0kxmfz2fl9XqtPB6PuN1uK5fLZaO%2Bx4wBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA%2BNuFw2EJBALi9%2Ftt1AoGgxKJROTp6UlKpZIwS3Ask8nI7Xb7aa3XawmFQlIsFgkXnEmn078M1n6%2Fl1QqJclkknDhzwRruVzKZrOxgCUSCVu9mDF8eyuczWbS6XTk5eVFotGoPD8%2FEyw4D9bHx4c0Gg0pl8tSq9VsXK1Wcjwe5Xq9ir7LjOHbK5bW%2BXy2YF0uF%2Bu1mDE8JJvNWoD6%2Fb50u13p9XoyGo1kMBhIs9mU9%2Fd3mU6nFjCCBcfB0jCNx2MZDocWMA2aPr%2B9vclisbBgcTLEw3K5nAVLVyeter0urVbLntvttkwmE%2Fn8%2FLTtMB6PEyw4C9bX15f1UTrq3dVut7Nxu91aESz81lb4%2BvoqlUrFViwtXbEKhYKdDvP5vAWOYMHxqVD7K617b6V9lt5h6Xaovw%2BHg8RiMYKFx%2BjNu26B1WrVmnSt%2BXxul6NaeiLUUbdFvSRlxvBwsO73VVqn08lKeyrd%2Fu49l%2F7HioWH6Wcz%2BsmMz%2Bez8nq9Vh6PR9xut5XL5bJR32PGAAAAAAAAAAAAAAAAAAAAAPyP%2FgN6xFwlEUspjwAAAABJRU5ErkJggg%3D%3D";
    let img_open_bookmark = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAKASURBVHjaYvz//z8DPrBt2za+v3//rvn37985IF0TFBT0B1keIICYiNC8Foit/vz5kwXELcuXL2dBVgMQQDgN2Lp1Kx9QA1izpaUlt4eHBy+QXQjELQsXLmSHqQMIIEZsXgBphtlsYWHBdfr0aQaQOicnJ4a1a9f+A4pvA+KgtLS03wABhOGCLVu2gGxeB9N86tQphm/fvjGwsrIyAMUYQkNDmYC0PRA3T5kyhQUggFjQNQMlQJotQZpPnjzJ8P37dwY+Pj4GSTUDhgXHnjEoivEwAC3gAaqxAGIegACCu2Dz5s1gm4EYrvnr168MvLy8DMAwYDh+7xPD1WdfGA7feMvg6x/ICNRsBMQ6AAHEBNMMsxkIuE6cOAHXbG5uznD58mWGcBNxBnE+NgYzeU6GCzfuglzBAcRsAAEENgBqs52trS3X8ePHUWwGGQZMAwyfP31kiDLgY/jz/inDzfMnfoG8UF5evg8ggMBhAOSAQpbl9+/fDPr6+gz3799nMDAwYAAZBgo8eXl5cEA+evyE4enNiz+AarUrKirugfQCBBDMBRZaWlqMPDw84OgCaTh27BgDCwsLg4KCAsPnz58ZHj16xHDp4oXvQM3qMM0gABBATFAXfAUpAtkoIiICdrKmpiZY88+fPxmePXvGcOnSJZBmDaDmR8gxBxBAMBcY3Lhx4zfIxoMHDzKIiYkxSEhIgA16+/YtSPNPoBqdysrKR+jpBiCA4Clx9uzZoLi9B3S+6I8fP8Bhcfv2bYYLFy6A/GxQVVV1E1uSBwgglKQMTFkgQ24DnS7ByMjIcO3aNZBm3erq6ju48gxAAGHkhb6+PrAhQMwNSiz4NIMAQIABAPYsj0djV8aMAAAAAElFTkSuQmCC';




    // ajoute l'onglet et le bouton
    function addButtons()
    {
        // Pas dans un topic
        if (window.location.href.indexOf("https://forum.hardware.fr/forum2.php") == -1) {
            let onglets = root.querySelector("table.none > tbody > tr > td > div.cadreonglet");

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

       if(postId > 0 && catId > 0){
           let pseudos = root.querySelectorAll("table.messagetable > tbody > tr > td.messCase2 > div.toolbar > div.left");
           for(let pseudo of pseudos) {
               let imgBK = document.createElement("img");
               imgBK.setAttribute("src", img_bookmarks);
               imgBK.setAttribute("title", "Ajouter un bookmark pour y revenir plus tard");
               imgBK.style.verticalAlign = "bottom";
               imgBK.style.cursor = "pointer";
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
          if(typeof event !== "undefined") {
              event.preventDefault();
              event.stopPropagation();
          }

          let mainTable = document.querySelector("#mesdiscussions > table.main");

          let tableBookmarks = document.createElement("table");
          tableBookmarks.setAttribute("class", "main");
          tableBookmarks.setAttribute("cellspacing", "0");

          let trHead = document.createElement("tr");
          trHead.setAttribute("class", "cBackHeader fondForum1Description");
          let th1 = document.createElement("th");
          trHead.appendChild(th1);

          let th2 = document.createElement("th");
          th2.appendChild(document.createTextNode("Sujet"));
          trHead.appendChild(th2);

          let th3 = document.createElement("th");
          th3.appendChild(document.createTextNode("Auteur du post"));
          trHead.appendChild(th3)

          let th4 = document.createElement("th");
          th4.appendChild(document.createTextNode("Date de création"));
          trHead.appendChild(th4)

          let th5 = document.createElement("th");
          trHead.appendChild(th5);

          tableBookmarks.appendChild(trHead);


          for(let item of LocalMPStorage.bookmarks.list)
          {
              let trBookmark = document.createElement("tr");
              trBookmark.setAttribute("class", "sujet ligne_booleen cBackCouleurTab1")
              trBookmark.style.fontSize = "small";


              let tdIcon = document.createElement("td");
              tdIcon.setAttribute("class", "sujetCase2");
              let icon = document.createElement("img");
              icon.setAttribute("src", img_open_bookmark);
              tdIcon.appendChild(icon);
              trBookmark.appendChild(tdIcon);

              let tdSujet = document.createElement("td");
              tdSujet.setAttribute("class", "sujetCase3");
              tdSujet.dataset.numreponse = item.numreponse;
              tdSujet.appendChild(document.createTextNode(item.label));
              tdSujet.style.cursor = "pointer";
              tdSujet.addEventListener("click", function() {
                  openBookmark(this.dataset.numreponse, function(){
                      displayBookmarksManagement();
                  });
              }, false);
              trBookmark.appendChild(tdSujet);

              let tdAuteur = document.createElement("td");
              tdAuteur.appendChild(document.createTextNode(item.author));
              trBookmark.appendChild(tdAuteur);

              let tdDate = document.createElement("td");
              var dateObj = new Date(item.createDate);
              tdDate.appendChild(document.createTextNode(dateObj.toLocaleString()));
              trBookmark.appendChild(tdDate);

              let tdInputRemove = document.createElement("td");
              tdInputRemove.style.textAlign = "right";
              let inputRemove = document.createElement("input");
              inputRemove.setAttribute("type", "image");
              inputRemove.setAttribute("src", img_remove);
              inputRemove.dataset.numreponse = item.numreponse;
              inputRemove.style.marginLeft = "8px";
              inputRemove.addEventListener("click", function() {
                  removeFromBookmarks(this.dataset.numreponse, function(){
                      displayBookmarksManagement();
                  });
              }, false);
              tdInputRemove.appendChild(inputRemove);
              trBookmark.appendChild(tdInputRemove);
              tableBookmarks.appendChild(trBookmark);
          }



        mainTable.parentNode.replaceChild(tableBookmarks, mainTable);
    }

    // affichage de la fenêtre d'ajout / suppression d'un bookmark
    function displayBookmarkQuestion(event) {
      event.stopPropagation();
      let postAnchor = this.parentElement.parentElement.parentElement.parentElement.querySelector("a").name;
      let authorValue = this.parentElement.parentElement.parentElement.parentElement.querySelector("div > b.s2").firstChild.nodeValue;
      // suppression des fenêtres ouvertes
      hidePopups();
      // construction de la fenêtre
      let divBookmarkQuestion = document.createElement("div");
      divBookmarkQuestion.setAttribute("id", "hfrBookmarkQuestion");
      divBookmarkQuestion.style.position = "absolute";
      divBookmarkQuestion.style.border = "1px solid grey";
      divBookmarkQuestion.style.padding = "8px";
      divBookmarkQuestion.style.background = "white";
      divBookmarkQuestion.style.zIndex = "1001";
      divBookmarkQuestion.style.cursor = "default";
      let divQuestion = document.createElement("div");
      divQuestion.appendChild(document.createTextNode("Ajouter ce post aux bookmarks ?"));
      divQuestion.style.fontSize = "8pt";
      let divLabel = document.createElement('div');
      divLabel.appendChild(document.createTextNode("Nom du bookmark: "));
      let inputLabel = document.createElement('input');
      inputLabel.setAttribute('type', 'text');
      inputLabel.setAttribute('size', 50);
      inputLabel.setAttribute('id', 'labelBM_'+postAnchor);
      divLabel.appendChild(inputLabel);
      divQuestion.appendChild(divLabel);
      let divValidation = document.createElement("div");
      divValidation.style.marginTop = "8px";
      divValidation.style.textAlign = "right";
      let inputOk = document.createElement("input");
      inputOk.setAttribute("type", "image");
      inputOk.setAttribute("src", img_ok);
      inputOk.setAttribute("title", "Valider");
      inputOk.addEventListener("click", function() {
          addToBookmarks(postAnchor, postId, catId, authorValue, document.getElementById('labelBM_'+postAnchor).value, function(){
              hidePopups();
          });
      }, false);
      let inputCancel = document.createElement("input");
      inputCancel.setAttribute("type", "image");
      inputCancel.setAttribute("src", img_cancel);
      inputCancel.style.marginLeft = "8px";
      inputCancel.setAttribute("title", "Annuler");
      inputCancel.addEventListener("click", function() {
        hidePopups();
      }, false);
      divValidation.appendChild(inputOk);
      divValidation.appendChild(inputCancel);
      divBookmarkQuestion.appendChild(divQuestion);
      divBookmarkQuestion.appendChild(divValidation);
      // positionnement et affichage de la fenêtre
      divBookmarkQuestion.style.top = (window.pageYOffset + event.clientY + 8) + "px";
      divBookmarkQuestion.style.left = (event.clientX + 8) + "px";
      divBookmarkQuestion.style.display = "block";
      root.appendChild(divBookmarkQuestion);
    }

    // suppression des fenêtres ouvertes
    function hidePopups() {
      if(document.getElementById("hfrBookmarkQuestion")) {
        let divBookmarkQuestion = document.getElementById("hfrBookmarkQuestion");
        divBookmarkQuestion.parentElement.removeChild(divBookmarkQuestion);
      }
    }

    // suppression des fenêtres ouvertes en cliquant en dehors
    document.addEventListener("click", function(e) {
      let target = e.target;
      while(target !== null && target.id !== "hfrBookmarkQuestion") {
        target = target.parentNode;
      }
      if(target === null) {
        hidePopups();
      }
    }, false);

    function getIdFromAnchor(anchor) {
      return parseInt(anchor.replace('t', ''));
    }

    function openBookmark(numreponse, callback){
        // TODO Wiripse : Check if exists
        let bookm = LocalMPStorage.bookmarks.list.filter(function(bm){ return getIdFromAnchor(numreponse) === bm.numreponse; })[0];
        if(bookm){
            GM_openInTab('https://forum.hardware.fr/forum2.php?config=hfr.inc&cat='+bookm.cat+'&post='+bookm.post+'&numreponse='+bookm.numreponse+'#t'+bookm.numreponse, false);
        }
         callback();
    }

    // ajoute un bookmark à la liste
    function addToBookmarks(anchor, post, cat, author, label, callback) {

        // We retrieve the latest version of the MPStorage datas
        LocalMPStorage.getData(function(res){
            var now = Date.now();

            // Create an entry for the pseudo to add
            var entry = {
                numreponse : getIdFromAnchor(anchor),
                post : post,
                cat : cat,
                author : author,
                label : label || 'Osef_'+anchor,
                createDate : now
            };

            // Add the new entry to the list and sort it
            LocalMPStorage.bookmarks.list.push(entry);
            LocalMPStorage.bookmarks.list.sort();
            // Set other relevant datas
            LocalMPStorage.bookmarks.sourceName = LocalMPStorage.toolName;
            LocalMPStorage.bookmarks.lastUpdate = now;

            // Add the new list to the global datas
            mpStorage.storageData.data.filter(function(d){return LocalMPStorage.version === d.version;})[0].bookmarks = LocalMPStorage.bookmarks;

            // And store the result with MPStorage
            mpStorage.setStorageData(mpStorage.storageData, LocalMPStorage.toolName);

            callback();
        });
    }

    // enlève un bookmark de la liste
    function removeFromBookmarks(numreponse, callback) {

        // We retrieve the latest version of the MPStorage datas
        LocalMPStorage.getData(function(res){
            // Look for the bookmark to delete in the list
            let i = LocalMPStorage.bookmarks.list.findIndex(function(d){ return getIdFromAnchor(numreponse) === d.numreponse; });

            if(i >= 0) {
                // Remove the entry from the list
                LocalMPStorage.bookmarks.list.splice(i, 1);
                // Set other relevant datas
                LocalMPStorage.bookmarks.sourceName = LocalMPStorage.toolName;
                LocalMPStorage.bookmarks.lastUpdate = Date.now();

                // Add the new list to the global datas
                mpStorage.storageData.data.filter(function(d){return LocalMPStorage.version === d.version;})[0].bookmarks = LocalMPStorage.bookmarks;

                // And store the result with MPStorage
                mpStorage.setStorageData(mpStorage.storageData, LocalMPStorage.toolName);

                callback();
            }
        });
    }

    // leggo!
    addButtons();

  }
});
